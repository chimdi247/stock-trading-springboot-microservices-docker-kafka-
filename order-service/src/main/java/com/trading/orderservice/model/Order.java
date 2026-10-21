package com.trading.orderservice.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "orders")
@Data
@AllArgsConstructor
@NoArgsConstructor
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String symbol;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderType type; // BUY or SELL

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal price; // price at time of order

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal totalAmount; // quantity × price

    @Column(name = "failure_reason", length = 2000)
    private String failureReason;

    // AI fraud check result
    // Explicit column name: the default naming strategy would turn
    // "flaggedByAI" into "flagged_byai", which is not what anyone expects.
    @Column(name = "flagged_by_ai")
    private Boolean flaggedByAI = false;

    @Column(name = "ai_reason", length = 2000)
    private String aiReason;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime executedAt;
}
