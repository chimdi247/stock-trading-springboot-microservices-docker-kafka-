package com.trading.orderservice.controller;

import com.trading.orderservice.dto.OrderRequest;
import com.trading.orderservice.model.Order;
import com.trading.orderservice.service.OrderService;
import com.trading.orderservice.telemetry.OrderMetrics;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
@Slf4j
public class OrderController {

    private final OrderService orderService;
    private final OrderMetrics orderMetrics;

    /**
     * Place buy or sell order.
     * userId comes from X-User-Id header — set by API Gateway
     * after JWT validation. User cannot fake their userId.
     */
    @PostMapping
    public ResponseEntity<Order> placeOrder(
            @RequestHeader("X-User-Id") String userId,
            @Valid @RequestBody OrderRequest request) {
        request.setUserId(userId); // override with header value
        Order placed = orderService.placeOrder(request);
        orderMetrics.recordOrder(placed); // business KPI: final status
        return ResponseEntity.status(HttpStatus.CREATED).body(placed);
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<Order> getOrder(
            @PathVariable String orderId,
            @RequestHeader("X-User-Id") String userId) {
        return ResponseEntity.ok(orderService.getOrder(orderId));
    }

    @GetMapping("/my-orders")
    public ResponseEntity<List<Order>> getMyOrders(
            @RequestHeader("X-User-Id") String userId) {
        return ResponseEntity.ok(
                orderService.getUserOrders(userId));
    }
}
