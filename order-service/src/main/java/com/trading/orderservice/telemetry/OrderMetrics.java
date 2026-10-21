package com.trading.orderservice.telemetry;

import com.trading.orderservice.model.Order;
import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.metrics.DoubleHistogram;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.Meter;
import org.springframework.stereotype.Component;

/**
 * Business KPIs for order-service (OpenTelemetry API — manual instrumentation).
 *
 * Prometheus names (after the collector's translation):
 *   trading_orders_total{order_type,order_status,symbol}
 *   trading_order_value_{bucket,sum,count}{order_type,order_status}
 *   trading_fraud_checks_total{result}
 */
@Component
public class OrderMetrics {

    private static final AttributeKey<String> TYPE =
            AttributeKey.stringKey("order.type");
    private static final AttributeKey<String> STATUS =
            AttributeKey.stringKey("order.status");
    private static final AttributeKey<String> SYMBOL =
            AttributeKey.stringKey("symbol");
    private static final AttributeKey<String> RESULT =
            AttributeKey.stringKey("result");

    private final LongCounter orders;
    private final DoubleHistogram orderValue;
    private final LongCounter fraudChecks;

    public OrderMetrics() {
        Meter meter = GlobalOpenTelemetry.getMeter("com.trading.orderservice");
        orders = meter.counterBuilder("trading.orders")
                .setDescription("Orders processed, by type and final status")
                .build();
        orderValue = meter.histogramBuilder("trading.order.value")
                .setDescription("Order notional value (quantity x price)")
                .build();
        fraudChecks = meter.counterBuilder("trading.fraud.checks")
                .setDescription("AI fraud checks by result")
                .build();
    }

    /** Called once per order, with its FINAL status (EXECUTED/FAILED/FLAGGED). */
    public void recordOrder(Order order) {
        String type = order.getType().name();
        String status = order.getStatus().name();
        orders.add(1, Attributes.of(
                TYPE, type, STATUS, status, SYMBOL, order.getSymbol()));
        if (order.getTotalAmount() != null) {
            orderValue.record(order.getTotalAmount().doubleValue(),
                    Attributes.of(TYPE, type, STATUS, status));
        }
    }

    /** result = clean | flagged | unavailable */
    public void fraudCheck(String result) {
        fraudChecks.add(1, Attributes.of(RESULT, result));
    }
}
