package com.trading.orderservice.repository;

import com.trading.orderservice.model.Order;
import com.trading.orderservice.model.OrderType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, String> {
    List<Order> findByUserIdOrderByCreatedAtDesc(String userId);
    List<Order> findByUserIdAndSymbol(String userId, String symbol);
    long countByUserIdAndCreatedAtAfter(
            String userId, LocalDateTime after);
    List<Order> findByUserIdAndTypeOrderByCreatedAtDesc(
            String userId, OrderType type);
}
