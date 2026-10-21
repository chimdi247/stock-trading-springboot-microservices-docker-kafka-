package com.trading.notificationservice.service;

import com.trading.notificationservice.telemetry.NotificationMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationMetrics metrics;

    /**
     * Order executed successfully.
     */
    @KafkaListener(topics = "order.executed")
    public void consumeOrderExecuted(
            @Payload Map<String, Object> payload) {
        try {
            metrics.sent("order.executed");
            String userId = (String) payload.get("userId");
            String type = (String) payload.get("type");
            String symbol = (String) payload.get("symbol");
            Object quantity = payload.get("quantity");
            Object price = payload.get("price");
            Object totalAmount = payload.get("totalAmount");

            sendNotification(userId,
                    type.equals("BUY")
                            ? "✅ Order Executed — Buy"
                            : "✅ Order Executed — Sell",
                    String.format(
                            "%s %s shares of %s at ₹%s. " +
                            "Total: ₹%s",
                            type, quantity, symbol,
                            price, totalAmount));
        } catch (Exception e) {
            log.error("Error sending order notification: {}",
                    e.getMessage());
        }
    }

    /**
     * Order flagged by AI fraud detection.
     */
    @KafkaListener(topics = "order.flagged")
    public void consumeOrderFlagged(
            @Payload Map<String, Object> payload) {
        try {
            metrics.sent("order.flagged");
            String userId = (String) payload.get("userId");
            String symbol = (String) payload.get("symbol");
            String reason = (String) payload.get("reason");

            sendNotification(userId,
                    "🚨 Order Flagged by AI",
                    String.format(
                            "Your order for %s was flagged " +
                            "as suspicious. Reason: %s. " +
                            "Please contact support if this " +
                            "was a legitimate trade.",
                            symbol, reason));
        } catch (Exception e) {
            log.error("Error sending fraud notification: {}",
                    e.getMessage());
        }
    }

    /**
     * Order failed.
     */
    @KafkaListener(topics = "order.failed")
    public void consumeOrderFailed(
            @Payload Map<String, Object> payload) {
        try {
            metrics.sent("order.failed");
            String userId = (String) payload.get("userId");
            String symbol = (String) payload.get("symbol");
            String reason = (String) payload.get("reason");

            sendNotification(userId,
                    "❌ Order Failed",
                    String.format(
                            "Your order for %s failed. " +
                            "Reason: %s",
                            symbol, reason));
        } catch (Exception e) {
            log.error("Error sending failure notification: {}",
                    e.getMessage());
        }
    }

    /**
     * New user registered.
     */
    @KafkaListener(topics = "user.registered")
    public void consumeUserRegistered(
            @Payload Map<String, Object> payload) {
        try {
            metrics.sent("user.registered");
            String userId = (String) payload.get("userId");
            String firstName = (String) payload.get("firstName");
            Object walletBalance = payload.get("walletBalance");

            sendNotification(userId,
                    "🎉 Welcome to Stock Trading Platform!",
                    String.format(
                            "Welcome %s! Your account is ready. " +
                            "₹%s has been added to your wallet. " +
                            "Start trading now!",
                            firstName, walletBalance));
        } catch (Exception e) {
            log.error("Error sending welcome notification: {}",
                    e.getMessage());
        }
    }

    private void sendNotification(String userId,
                                   String title,
                                   String message) {
        log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        log.info("NOTIFICATION SENT");
        log.info("To User : {}", userId);
        log.info("Title   : {}", title);
        log.info("Message : {}", message);
        log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }
}
