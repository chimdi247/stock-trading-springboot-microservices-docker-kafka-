package com.trading.orderservice.model;

public enum OrderStatus {
    PENDING,
    AI_CHECK,        // Being checked by AI fraud detection
    EXECUTED,        // Successfully executed
    FAILED,          // Failed due to insufficient funds etc
    FLAGGED          // Flagged by AI as suspicious
}
