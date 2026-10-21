package com.trading.marketdata.controller;

import com.trading.marketdata.model.StockPrice;
import com.trading.marketdata.service.MarketDataService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/market")
@RequiredArgsConstructor
@Slf4j
public class MarketDataController {

    private final MarketDataService marketDataService;

    /**
     * Get all available stocks with current prices.
     * GET /api/v1/market/stocks
     */
    @GetMapping("/stocks")
    public ResponseEntity<List<StockPrice>> getAllStocks() {
        return ResponseEntity.ok(marketDataService.getAllPrices());
    }

    /**
     * Get current price for specific stock.
     * GET /api/v1/market/stocks/AAPL
     */
    @GetMapping("/stocks/{symbol}")
    public ResponseEntity<StockPrice> getStockPrice(
            @PathVariable String symbol) {
        return ResponseEntity.ok(
                marketDataService.getPrice(symbol.toUpperCase()));
    }
}
