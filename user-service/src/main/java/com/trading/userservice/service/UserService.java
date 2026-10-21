package com.trading.userservice.service;

import com.trading.userservice.dto.AuthResponse;
import com.trading.userservice.dto.LoginRequest;
import com.trading.userservice.dto.RegisterRequest;
import com.trading.userservice.dto.UserResponse;
import com.trading.userservice.exception.ApiException;
import com.trading.userservice.telemetry.UserMetrics;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.springframework.http.HttpStatus;
import com.trading.userservice.model.User;
import com.trading.userservice.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final UserMetrics metrics;

    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.expiration}")
    private long jwtExpiration;

    @Value("${jwt.refresh-expiration}")
    private long refreshExpiration;

    /**
     * Register new trader.
     * Generates JWT token after registration.
     */
    @Transactional
    @WithSpan("user.register")
    public AuthResponse register(RegisterRequest request) {
        log.info("Registering user: {}", request.getEmail());

        if (userRepository.existsByEmail(request.getEmail())) {
            metrics.registration(false);
            throw new ApiException(HttpStatus.CONFLICT,
                    "Email already registered");
        }

        User user = new User();
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setEmail(request.getEmail());
        user.setPassword(
                passwordEncoder.encode(request.getPassword()));
        user.setWalletBalance(
                request.getInitialDeposit() != null
                        ? request.getInitialDeposit()
                        : BigDecimal.valueOf(10000));

        User saved = userRepository.save(user);
        log.info("User registered: {}", saved.getId());
        metrics.registration(true);
        Span.current().setAttribute("user.id", saved.getId());

        // Publish user.registered event
        Map<String, Object> event = new HashMap<>();
        event.put("userId", saved.getId());
        event.put("email", saved.getEmail());
        event.put("firstName", saved.getFirstName());
        event.put("lastName", saved.getLastName());
        event.put("walletBalance", saved.getWalletBalance());
        kafkaTemplate.send("user.registered", saved.getId(), event);

        String token = generateToken(saved.getId(), saved.getEmail());
        String refreshToken = generateRefreshToken(saved.getId());

        return buildAuthResponse(saved, token, refreshToken);
    }

    /**
     * Login user.
     * Returns JWT token.
     */
    @WithSpan("user.login")
    public AuthResponse login(LoginRequest request) {
        log.info("Login attempt: {}", request.getEmail());

        User user = userRepository.findByEmail(request.getEmail())
                .orElse(null);

        // Same error for "no such user" and "wrong password" so the API
        // does not reveal which emails are registered.
        if (user == null || !passwordEncoder.matches(
                request.getPassword(), user.getPassword())) {
            metrics.login(false);
            throw new ApiException(HttpStatus.UNAUTHORIZED,
                    "Invalid email or password");
        }

        log.info("Login successful: {}", user.getId());
        metrics.login(true);
        Span.current().setAttribute("user.id", user.getId());

        String token = generateToken(user.getId(), user.getEmail());
        String refreshToken = generateRefreshToken(user.getId());

        return buildAuthResponse(user, token, refreshToken);
    }

    /**
     * Get user by ID.
     * Called by other services via Feign (internal).
     */
    public UserResponse getUserById(String userId) {
        return mapToResponse(findById(userId));
    }

    /**
     * Add funds to wallet.
     */
    @Transactional
    public UserResponse addFunds(String userId, BigDecimal amount) {
        User user = findById(userId);
        user.setWalletBalance(user.getWalletBalance().add(amount));
        User saved = userRepository.save(user);
        log.info("Funds added: {} to user: {}", amount, userId);
        metrics.walletOperation("add");
        return mapToResponse(saved);
    }

    /**
     * Deduct funds from wallet — called on BUY order.
     */
    @Transactional
    public UserResponse deductFunds(String userId, BigDecimal amount) {
        User user = findById(userId);

        if (user.getWalletBalance().compareTo(amount) < 0) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Insufficient wallet balance");
        }

        user.setWalletBalance(
                user.getWalletBalance().subtract(amount));
        User saved = userRepository.save(user);
        log.info("Funds deducted: {} from user: {}", amount, userId);
        metrics.walletOperation("deduct");
        return mapToResponse(saved);
    }

    /**
     * Credit funds to wallet — called on SELL order.
     */
    @Transactional
    public UserResponse creditFunds(String userId, BigDecimal amount) {
        User user = findById(userId);
        user.setWalletBalance(user.getWalletBalance().add(amount));
        User saved = userRepository.save(user);
        log.info("Funds credited: {} to user: {}", amount, userId);
        metrics.walletOperation("credit");
        return mapToResponse(saved);
    }

    /**
     * Generate JWT access token.
     * Contains userId and email.
     * Validated by API Gateway on every request.
     */
    private String generateToken(String userId, String email) {
        return Jwts.builder()
                .claim("userId", userId)
                .setSubject(email)
                .setIssuedAt(new Date())
                .setExpiration(new Date(
                        System.currentTimeMillis() + jwtExpiration))
                .signWith(getSignInKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    /**
     * Generate refresh token — 7 days expiry.
     */
    private String generateRefreshToken(String userId) {
        return Jwts.builder()
                .claim("userId", userId)
                .setSubject(userId)
                .setIssuedAt(new Date())
                .setExpiration(new Date(
                        System.currentTimeMillis() + refreshExpiration))
                .signWith(getSignInKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    private Key getSignInKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secretKey);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    private User findById(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND, "User not found"));
    }

    private AuthResponse buildAuthResponse(User user,
                                            String token,
                                            String refreshToken) {
        AuthResponse response = new AuthResponse();
        response.setAccessToken(token);
        response.setRefreshToken(refreshToken);
        response.setUserId(user.getId());
        response.setEmail(user.getEmail());
        response.setFirstName(user.getFirstName());
        response.setLastName(user.getLastName());
        response.setWalletBalance(user.getWalletBalance());
        return response;
    }

    private UserResponse mapToResponse(User user) {
        UserResponse response = new UserResponse();
        response.setId(user.getId());
        response.setEmail(user.getEmail());
        response.setFirstName(user.getFirstName());
        response.setLastName(user.getLastName());
        response.setWalletBalance(user.getWalletBalance());
        response.setStatus(user.getStatus());
        response.setCreatedAt(user.getCreatedAt());
        return response;
    }
}
