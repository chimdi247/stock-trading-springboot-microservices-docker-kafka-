package com.trading.marketdata.service;

import com.trading.marketdata.model.StockPrice;
import com.trading.marketdata.telemetry.MarketMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Market Data Service.
 *
 * Simulates real time stock price updates.
 * In production → connects to market data provider (NSE, BSE, NYSE)
 * For demo → generates realistic price movements using random walk algorithm
 *
 * Every 2 seconds:
 * 1. Update stock prices (random walk)
 * 2. Cache latest prices in Redis
 * 3. Broadcast via WebSocket → clients see real time updates
 * 4. Publish to Kafka → other services react to price changes
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MarketDataService {

    private final SimpMessagingTemplate messagingTemplate;
    private final RedisTemplate<String, Object> redisTemplate;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final MarketMetrics metrics;

    private final Random random = new Random();

    private static final String PRICE_KEY_PREFIX = "stock:price:";

    /**
     * Initial stock data — simulated portfolio of popular stocks
     * Mix of Indian and US stocks for broad appeal
     */
    private final Map<String, StockPrice> stockPrices =
            new HashMap<>() {{
        put("RELIANCE", new StockPrice("RELIANCE",
                "Reliance Industries", BigDecimal.valueOf(2850.00),
                BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.valueOf(2900.00),
                BigDecimal.valueOf(2800.00),
                BigDecimal.valueOf(2840.00), 1500000L,
                LocalDateTime.now()));
        put("TCS", new StockPrice("TCS",
                "Tata Consultancy Services", BigDecimal.valueOf(3920.00),
                BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.valueOf(3980.00),
                BigDecimal.valueOf(3890.00),
                BigDecimal.valueOf(3910.00), 800000L,
                LocalDateTime.now()));
        put("INFY", new StockPrice("INFY",
                "Infosys", BigDecimal.valueOf(1650.00),
                BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.valueOf(1680.00),
                BigDecimal.valueOf(1630.00),
                BigDecimal.valueOf(1645.00), 1200000L,
                LocalDateTime.now()));
        put("AAPL", new StockPrice("AAPL",
                "Apple Inc", BigDecimal.valueOf(189.50),
                BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.valueOf(191.00),
                BigDecimal.valueOf(188.00),
                BigDecimal.valueOf(189.00), 5000000L,
                LocalDateTime.now()));
        put("GOOGL", new StockPrice("GOOGL",
                "Alphabet Inc", BigDecimal.valueOf(141.80),
                BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.valueOf(143.00),
                BigDecimal.valueOf(140.50),
                BigDecimal.valueOf(141.20), 3000000L,
                LocalDateTime.now()));
        put("MSFT", new StockPrice("MSFT",
                "Microsoft Corp", BigDecimal.valueOf(378.90),
                BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.valueOf(381.00),
                BigDecimal.valueOf(377.00),
                BigDecimal.valueOf(378.00), 4000000L,
                LocalDateTime.now()));
    }};

    /**
     * Scheduled price update — runs every 2 seconds.
     *
     * Random Walk Algorithm:
     * Each price moves up or down by 0-0.5% randomly.
     * This creates realistic looking market movements.
     *
     * In production → replace with live market data feed.
     */
    @Scheduled(fixedRateString = "${market.price-update-interval}")
    public void updatePrices() {
        stockPrices.forEach((symbol, currentPrice) -> {
            BigDecimal oldPrice = currentPrice.getPrice();

            // Random price movement — up or down by 0-0.5%
            double changePercent = (random.nextDouble() - 0.5) * 0.5;
            BigDecimal priceChange = oldPrice
                    .multiply(BigDecimal.valueOf(changePercent / 100))
                    .setScale(2, RoundingMode.HALF_UP);

            BigDecimal newPrice = oldPrice.add(priceChange)
                    .setScale(2, RoundingMode.HALF_UP);

            // Ensure price doesn't go negative
            if (newPrice.compareTo(BigDecimal.valueOf(1)) < 0) {
                newPrice = BigDecimal.valueOf(1);
            }

            BigDecimal changeAmount = newPrice.subtract(
                    currentPrice.getOpen())
                    .setScale(2, RoundingMode.HALF_UP);

            BigDecimal changePct = changeAmount
                    .divide(currentPrice.getOpen(), 4,
                            RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(2, RoundingMode.HALF_UP);

            // Update high/low
            BigDecimal newHigh = newPrice.compareTo(
                    currentPrice.getHigh()) > 0
                    ? newPrice : currentPrice.getHigh();
            BigDecimal newLow = newPrice.compareTo(
                    currentPrice.getLow()) < 0
                    ? newPrice : currentPrice.getLow();

            currentPrice.setPrice(newPrice);
            currentPrice.setChange(changeAmount);
            currentPrice.setChangePercent(changePct);
            currentPrice.setHigh(newHigh);
            currentPrice.setLow(newLow);
            currentPrice.setTimestamp(LocalDateTime.now());

            // 1. Cache in Redis
            redisTemplate.opsForValue().set(
                    PRICE_KEY_PREFIX + symbol, currentPrice);

            // 2. Broadcast via WebSocket → all subscribed clients
            messagingTemplate.convertAndSend(
                    "/topic/prices/" + symbol, currentPrice);

            // 3. Publish to Kafka → Order Service needs current prices
            Map<String, Object> priceEvent = new HashMap<>();
            priceEvent.put("symbol", symbol);
            priceEvent.put("price", newPrice);
            priceEvent.put("timestamp",
                    LocalDateTime.now().toString());
            kafkaTemplate.send("stock.price.updated",
                    symbol, priceEvent);

            metrics.priceUpdated(symbol);
        });

        log.debug("Prices updated for {} stocks",
                stockPrices.size());
    }

    /**
     * Get current price from Redis cache.
     * Instant response — no calculation needed.
     */
    public StockPrice getPrice(String symbol) {
        Object cached = redisTemplate.opsForValue()
                .get(PRICE_KEY_PREFIX + symbol);

        metrics.cacheLookup(cached != null);
        if (cached != null) {
            return (StockPrice) cached;
        }

        // Fallback to in-memory if Redis is empty
        StockPrice price = stockPrices.get(symbol.toUpperCase());
        if (price == null) {
            throw new RuntimeException(
                    "Stock not found: " + symbol);
        }
        return price;
    }

    /**
     * Get all available stocks.
     */
    public List<StockPrice> getAllPrices() {
        return stockPrices.values().stream().toList();
    }
}
