package com.trading.notificationservice.telemetry;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.Meter;
import org.springframework.stereotype.Component;

/** Prometheus name: trading_notifications_total{event} */
@Component
public class NotificationMetrics {

    private static final AttributeKey<String> EVENT =
            AttributeKey.stringKey("event");

    private final LongCounter notifications;

    public NotificationMetrics() {
        Meter meter = GlobalOpenTelemetry.getMeter("com.trading.notificationservice");
        notifications = meter.counterBuilder("trading.notifications")
                .setDescription("Notifications dispatched, by source event")
                .build();
    }

    public void sent(String event) {
        notifications.add(1, Attributes.of(EVENT, event));
    }
}
