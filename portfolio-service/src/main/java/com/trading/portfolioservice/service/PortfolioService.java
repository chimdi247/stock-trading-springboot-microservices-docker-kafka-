package com.trading.portfolioservice.service;

import com.trading.portfolioservice.client.MarketDataClient;
import com.trading.portfolioservice.model.Holding;
import com.trading.portfolioservice.repository.HoldingRepository;
import com.trading.portfolioservice.telemetry.PortfolioMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class PortfolioService {

    private final HoldingRepository holdingRepository;
    private final MarketDataClient marketDataClient;
    private final PortfolioMetrics metrics;

    /**
     * Consume order.executed event.
     * Update user's holdings based on BUY or SELL order.
     */
    @KafkaListener(topics = "order.executed")
    @Transactional
    public void consumeOrderExecuted(
            @Payload Map<String, Object> payload) {
        String orderType = null;
        try {
            String userId = (String) payload.get("userId");
            String symbol = (String) payload.get("symbol");
            String type = (String) payload.get("type");
            orderType = type;
            int quantity = Integer.parseInt(
                    payload.get("quantity").toString());
            BigDecimal price = new BigDecimal(
                    payload.get("price").toString());

            log.info("Updating portfolio — user: {} {} x {} at {}",
                    userId, type, quantity, price);

            if ("BUY".equals(type)) {
                addHolding(userId, symbol, quantity, price);
            } else if ("SELL".equals(type)) {
                removeHolding(userId, symbol, quantity);
            }
            metrics.update(orderType, true);

        } catch (Exception e) {
            metrics.update(orderType, false);
            log.error("Error updating portfolio: {}", e.getMessage());
        }
    }

    /**
     * Add or update holding after BUY order.
     * Calculates new average buy price.
     */
    private void addHolding(String userId, String symbol,
                             int quantity, BigDecimal price) {
        Holding holding = holdingRepository
                .findByUserIdAndSymbol(userId, symbol)
                .orElse(null);

        if (holding == null) {
            // First time buying this stock
            holding = new Holding();
            holding.setUserId(userId);
            holding.setSymbol(symbol);
            holding.setCompanyName(symbol); // simplified
            holding.setQuantity(quantity);
            holding.setAverageBuyPrice(price);
            holding.setTotalInvested(
                    price.multiply(BigDecimal.valueOf(quantity)));
        } else {
            // Already holding this stock — update average price
            int newQuantity = holding.getQuantity() + quantity;
            BigDecimal newInvested = holding.getTotalInvested()
                    .add(price.multiply(BigDecimal.valueOf(quantity)));
            BigDecimal newAvgPrice = newInvested
                    .divide(BigDecimal.valueOf(newQuantity), 2,
                            RoundingMode.HALF_UP);

            holding.setQuantity(newQuantity);
            holding.setTotalInvested(newInvested);
            holding.setAverageBuyPrice(newAvgPrice);
        }

        holdingRepository.save(holding);
        log.info("Holding updated: {} {} shares of {}",
                userId, holding.getQuantity(), symbol);
    }

    /**
     * Remove holding after SELL order.
     */
    private void removeHolding(String userId, String symbol,
                                int quantity) {
        Holding holding = holdingRepository
                .findByUserIdAndSymbol(userId, symbol)
                .orElseThrow(() -> new RuntimeException(
                        "Holding not found: " + symbol));

        if (holding.getQuantity() < quantity) {
            throw new RuntimeException(
                    "Insufficient shares to sell");
        }

        int newQuantity = holding.getQuantity() - quantity;

        if (newQuantity == 0) {
            holdingRepository.delete(holding);
            log.info("Holding removed: {} sold all {} shares",
                    userId, symbol);
        } else {
            BigDecimal newInvested = holding.getAverageBuyPrice()
                    .multiply(BigDecimal.valueOf(newQuantity));
            holding.setQuantity(newQuantity);
            holding.setTotalInvested(newInvested);
            holdingRepository.save(holding);
            log.info("Holding reduced: {} now has {} shares of {}",
                    userId, newQuantity, symbol);
        }
    }

    /**
     * Get portfolio with current P&L calculation.
     * Fetches current prices from Market Data Service.
     */
    public Map<String, Object> getPortfolio(String userId) {
        List<Holding> holdings = holdingRepository
                .findByUserId(userId);

        List<Map<String, Object>> portfolioItems = new ArrayList<>();
        BigDecimal totalInvested = BigDecimal.ZERO;
        BigDecimal currentValue = BigDecimal.ZERO;

        for (Holding holding : holdings) {
            try {
                // Get current market price
                Map<String, Object> priceData = marketDataClient
                        .getStockPrice(holding.getSymbol());
                BigDecimal currentPrice = new BigDecimal(
                        priceData.get("price").toString());

                BigDecimal holdingValue = currentPrice.multiply(
                        BigDecimal.valueOf(holding.getQuantity()));
                BigDecimal invested = holding.getTotalInvested();
                BigDecimal pnl = holdingValue.subtract(invested);
                BigDecimal pnlPercent = pnl.divide(invested, 4,
                        RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                        .setScale(2, RoundingMode.HALF_UP);

                Map<String, Object> item = new HashMap<>();
                item.put("symbol", holding.getSymbol());
                item.put("quantity", holding.getQuantity());
                item.put("averageBuyPrice",
                        holding.getAverageBuyPrice());
                item.put("currentPrice", currentPrice);
                item.put("currentValue", holdingValue);
                item.put("invested", invested);
                item.put("pnl", pnl);
                item.put("pnlPercent", pnlPercent);
                item.put("isProfit",
                        pnl.compareTo(BigDecimal.ZERO) > 0);

                portfolioItems.add(item);
                totalInvested = totalInvested.add(invested);
                currentValue = currentValue.add(holdingValue);

            } catch (Exception e) {
                log.error("Error fetching price for {}: {}",
                        holding.getSymbol(), e.getMessage());
            }
        }

        BigDecimal totalPnl = currentValue.subtract(totalInvested);
        BigDecimal totalPnlPercent = totalInvested
                .compareTo(BigDecimal.ZERO) > 0
                ? totalPnl.divide(totalInvested, 4,
                RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        Map<String, Object> portfolio = new HashMap<>();
        portfolio.put("userId", userId);
        portfolio.put("holdings", portfolioItems);
        portfolio.put("totalInvested", totalInvested);
        portfolio.put("currentValue", currentValue);
        portfolio.put("totalPnl", totalPnl);
        portfolio.put("totalPnlPercent", totalPnlPercent);
        portfolio.put("isProfit",
                totalPnl.compareTo(BigDecimal.ZERO) > 0);

        return portfolio;
    }
}
