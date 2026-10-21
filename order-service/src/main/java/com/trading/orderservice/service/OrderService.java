package com.trading.orderservice.service;

import com.trading.orderservice.client.AIServiceClient;
import com.trading.orderservice.client.MarketDataClient;
import com.trading.orderservice.client.UserServiceClient;
import com.trading.orderservice.dto.OrderRequest;
import com.trading.orderservice.model.Order;
import com.trading.orderservice.model.OrderStatus;
import com.trading.orderservice.model.OrderType;
import com.trading.orderservice.repository.OrderRepository;
import com.trading.orderservice.telemetry.OrderMetrics;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private final OrderRepository orderRepository;
    private final UserServiceClient userServiceClient;
    private final MarketDataClient marketDataClient;
    private final AIServiceClient aiServiceClient;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final OrderMetrics metrics;

    /**
     * Place a BUY or SELL order.
     *
     * Flow:
     * 1. Get current market price
     * 2. Calculate total amount
     * 3. Call AI service for fraud check
     * 4. If clean → execute order
     * 5. If suspicious → flag order
     * 6. Publish order event to Kafka
     */
    @Transactional
    @WithSpan("order.place")
    public Order placeOrder(OrderRequest request) {
        log.info("Placing {} order: {} x {} for user: {}",
                request.getType(), request.getQuantity(),
                request.getSymbol(), request.getUserId());

        // Step 1: Get current market price
        Map<String, Object> priceData = marketDataClient
                .getStockPrice(request.getSymbol());
        BigDecimal currentPrice = new BigDecimal(
                priceData.get("price").toString());

        // Manual instrumentation: enrich the current span with business context
        Span.current().setAttribute("order.symbol", request.getSymbol());
        Span.current().setAttribute("order.type", request.getType().name());
        Span.current().setAttribute("order.quantity", request.getQuantity());
        Span.current().setAttribute("order.price", currentPrice.doubleValue());

        // Step 2: Calculate total amount
        BigDecimal totalAmount = currentPrice.multiply(
                BigDecimal.valueOf(request.getQuantity()));

        // Step 3: Create order as PENDING
        Order order = new Order();
        order.setUserId(request.getUserId());
        order.setSymbol(request.getSymbol());
        order.setType(request.getType());
        order.setQuantity(request.getQuantity());
        order.setPrice(currentPrice);
        order.setTotalAmount(totalAmount);
        order.setStatus(OrderStatus.AI_CHECK);

        Order saved = orderRepository.save(order);
        log.info("Order created: {} status: AI_CHECK", saved.getId());

        // Step 4: AI fraud check
        Map<String, Object> orderData = new HashMap<>();
        orderData.put("orderId", saved.getId());
        orderData.put("userId", request.getUserId());
        orderData.put("symbol", request.getSymbol());
        orderData.put("type", request.getType().name());
        orderData.put("quantity", request.getQuantity());
        orderData.put("totalAmount", totalAmount);
        orderData.put("price", currentPrice);

        // Get user's order history for AI context
        long recentOrderCount = orderRepository
                .countByUserIdAndCreatedAtAfter(
                        request.getUserId(),
                        LocalDateTime.now().minusHours(1));
        orderData.put("recentOrderCount", recentOrderCount);

        try {
            Map<String, Object> aiResult = aiServiceClient
                    .checkFraud(orderData);

            boolean isSuspicious = (Boolean) aiResult
                    .getOrDefault("isSuspicious", false);
            String aiReason = (String) aiResult
                    .getOrDefault("reason", "");
            double fraudScore = Double.parseDouble(
                    aiResult.getOrDefault("fraudScore", "0.0")
                            .toString());

            log.info("AI fraud check — orderId: {} suspicious: {} " +
                    "score: {}", saved.getId(), isSuspicious,
                    fraudScore);

            if (isSuspicious) {
                metrics.fraudCheck("flagged");
                Span.current().addEvent("order.flagged_by_ai");
                // Flag order — don't execute
                saved.setStatus(OrderStatus.FLAGGED);
                saved.setFlaggedByAI(true);
                saved.setAiReason(aiReason);
                saved.setFailureReason(
                        "Flagged by AI: " + aiReason);
                orderRepository.save(saved);

                // Publish flagged event
                publishOrderEvent("order.flagged", saved, aiReason);

                log.warn("Order FLAGGED by AI: {} reason: {}",
                        saved.getId(), aiReason);
                return saved;
            }
            metrics.fraudCheck("clean");

        } catch (Exception e) {
            metrics.fraudCheck("unavailable");
            log.warn("AI service unavailable — proceeding without check: {}",
                    e.getMessage());
        }

        // Step 5: Execute order
        try {
            if (request.getType() == OrderType.BUY) {
                // Deduct funds for BUY
                userServiceClient.deductFunds(
                        request.getUserId(), totalAmount);
            } else {
                // Credit funds for SELL
                userServiceClient.creditFunds(
                        request.getUserId(), totalAmount);
            }

            saved.setStatus(OrderStatus.EXECUTED);
            saved.setExecutedAt(LocalDateTime.now());
            orderRepository.save(saved);

            log.info("Order EXECUTED: {} {} x {} at ₹{}",
                    request.getType(), request.getQuantity(),
                    request.getSymbol(), currentPrice);

            // Publish executed event
            publishOrderEvent("order.executed", saved, null);

        } catch (Exception e) {
            saved.setStatus(OrderStatus.FAILED);
            saved.setFailureReason(e.getMessage());
            orderRepository.save(saved);

            log.error("Order FAILED: {} reason: {}",
                    saved.getId(), e.getMessage());

            publishOrderEvent("order.failed", saved,
                    e.getMessage());
        }

        return saved;
    }

    /**
     * Get all orders for a user.
     */
    public List<Order> getUserOrders(String userId) {
        return orderRepository
                .findByUserIdOrderByCreatedAtDesc(userId);
    }

    /**
     * Get order by ID.
     */
    public Order getOrder(String orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException(
                        "Order not found: " + orderId));
    }

    private void publishOrderEvent(String topic,
                                    Order order,
                                    String reason) {
        Map<String, Object> event = new HashMap<>();
        event.put("orderId", order.getId());
        event.put("userId", order.getUserId());
        event.put("symbol", order.getSymbol());
        event.put("type", order.getType().name());
        event.put("quantity", order.getQuantity());
        event.put("price", order.getPrice());
        event.put("totalAmount", order.getTotalAmount());
        event.put("status", order.getStatus().name());
        if (reason != null) event.put("reason", reason);
        kafkaTemplate.send(topic, order.getId(), event);
        log.info("Event published: {} for order: {}",
                topic, order.getId());
    }
}
