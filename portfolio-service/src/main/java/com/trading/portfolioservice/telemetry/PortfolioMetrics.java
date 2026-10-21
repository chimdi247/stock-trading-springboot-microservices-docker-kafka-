package com.trading.portfolioservice.telemetry;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.Meter;
import org.springframework.stereotype.Component;

/** Prometheus name: trading_portfolio_updates_total{order_type,outcome} */
@Component
public class PortfolioMetrics {

    private static final AttributeKey<String> TYPE =
            AttributeKey.stringKey("order.type");
    private static final AttributeKey<String> OUTCOME =
            AttributeKey.stringKey("outcome");

    private final LongCounter updates;

    public PortfolioMetrics() {
        Meter meter = GlobalOpenTelemetry.getMeter("com.trading.portfolioservice");
        updates = meter.counterBuilder("trading.portfolio.updates")
                .setDescription("Holdings updates from order.executed events")
                .build();
    }

    public void update(String orderType, boolean success) {
        updates.add(1, Attributes.of(TYPE, orderType == null ? "UNKNOWN" : orderType,
                OUTCOME, success ? "success" : "failure"));
    }
}
