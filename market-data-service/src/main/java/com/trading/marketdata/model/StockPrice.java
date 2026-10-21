package com.trading.marketdata.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class StockPrice {

    private String symbol;        // AAPL, GOOGL, TCS, RELIANCE
    private String companyName;
    private BigDecimal price;
    private BigDecimal change;    // price change from previous
    private BigDecimal changePercent;
    private BigDecimal high;
    private BigDecimal low;
    private BigDecimal open;
    private long volume;
    private LocalDateTime timestamp;
}
