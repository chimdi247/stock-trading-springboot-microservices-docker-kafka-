package com.trading.marketdata.telemetry;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.Meter;
import org.springframework.stereotype.Component;

/**
 * Prometheus names: trading_market_price_updates_total{symbol}
 *                   trading_market_cache_lookups_total{result}
 */
@Component
public class MarketMetrics {

    private static final AttributeKey<String> SYMBOL =
            AttributeKey.stringKey("symbol");
    private static final AttributeKey<String> RESULT =
            AttributeKey.stringKey("result");

    private final LongCounter priceUpdates;
    private final LongCounter cacheLookups;

    public MarketMetrics() {
        Meter meter = GlobalOpenTelemetry.getMeter("com.trading.marketdata");
        priceUpdates = meter.counterBuilder("trading.market.price.updates")
                .setDescription("Simulated price ticks published")
                .build();
        cacheLookups = meter.counterBuilder("trading.market.cache.lookups")
                .setDescription("Redis price cache lookups (hit/miss)")
                .build();
    }

    public void priceUpdated(String symbol) {
        priceUpdates.add(1, Attributes.of(SYMBOL, symbol));
    }

    public void cacheLookup(boolean hit) {
        cacheLookups.add(1, Attributes.of(RESULT, hit ? "hit" : "miss"));
    }
}
