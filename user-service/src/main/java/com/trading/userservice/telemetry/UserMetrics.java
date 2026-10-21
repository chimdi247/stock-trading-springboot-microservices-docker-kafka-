package com.trading.userservice.telemetry;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.Meter;
import org.springframework.stereotype.Component;

/**
 * Business KPIs for user-service (OpenTelemetry API — manual instrumentation).
 *
 * Prometheus names (after the collector's translation):
 *   trading_user_registrations_total{outcome}
 *   trading_user_logins_total{outcome}
 *   trading_wallet_operations_total{operation}
 */
@Component
public class UserMetrics {

    private static final AttributeKey<String> OUTCOME =
            AttributeKey.stringKey("outcome");
    private static final AttributeKey<String> OPERATION =
            AttributeKey.stringKey("operation");

    private final LongCounter registrations;
    private final LongCounter logins;
    private final LongCounter walletOps;

    public UserMetrics() {
        Meter meter = GlobalOpenTelemetry.getMeter("com.trading.userservice");
        registrations = meter.counterBuilder("trading.user.registrations")
                .setDescription("User registration attempts")
                .build();
        logins = meter.counterBuilder("trading.user.logins")
                .setDescription("Login attempts")
                .build();
        walletOps = meter.counterBuilder("trading.wallet.operations")
                .setDescription("Wallet add/deduct/credit operations")
                .build();
    }

    public void registration(boolean success) {
        registrations.add(1, Attributes.of(OUTCOME, success ? "success" : "failure"));
    }

    public void login(boolean success) {
        logins.add(1, Attributes.of(OUTCOME, success ? "success" : "failure"));
    }

    public void walletOperation(String operation) {
        walletOps.add(1, Attributes.of(OPERATION, operation));
    }
}
