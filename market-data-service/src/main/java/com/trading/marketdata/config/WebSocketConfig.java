package com.trading.marketdata.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket Configuration using STOMP protocol.
 *
 * STOMP = Simple Text Oriented Messaging Protocol
 * Built on top of WebSocket — adds pub/sub messaging pattern.
 *
 * How it works:
 * 1. Client connects to /ws endpoint
 * 2. Client subscribes to /topic/prices/{symbol}
 * 3. Server publishes price updates to that topic
 * 4. Client receives updates in real time — no polling needed
 *
 * This is exactly how Zerodha/Robinhood stream real time prices.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Enable simple in-memory message broker
        // Topics prefixed with /topic → broadcast to all subscribers
        registry.enableSimpleBroker("/topic");

        // Application destination prefix
        // Client messages to /app/** are routed to @MessageMapping methods
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // WebSocket endpoint — clients connect here
        // SockJS fallback for browsers that don't support WebSocket
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}
