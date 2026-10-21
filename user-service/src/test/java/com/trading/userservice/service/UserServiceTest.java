package com.trading.userservice.service;

import com.trading.userservice.dto.AuthResponse;
import com.trading.userservice.dto.LoginRequest;
import com.trading.userservice.exception.ApiException;
import com.trading.userservice.model.User;
import com.trading.userservice.repository.UserRepository;
import com.trading.userservice.telemetry.UserMetrics;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Pure unit test (no Spring context, no DB, no Kafka).
 * Run:  cd user-service && mvn test
 */
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    // Same secret as application.yml default (hex chars are valid Base64)
    private static final String SECRET =
            "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970";

    @Mock private UserRepository userRepository;
    @Mock private KafkaTemplate<String, Object> kafkaTemplate;
    @Mock private UserMetrics metrics;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private UserService service;
    private User admin;

    @BeforeEach
    void setUp() {
        service = new UserService(userRepository, encoder, kafkaTemplate, metrics);
        ReflectionTestUtils.setField(service, "secretKey", SECRET);
        ReflectionTestUtils.setField(service, "jwtExpiration", 86_400_000L);
        ReflectionTestUtils.setField(service, "refreshExpiration", 604_800_000L);

        admin = new User();
        admin.setId("u-1");
        admin.setEmail("admin@example.com");
        admin.setPassword(encoder.encode("password123"));
        admin.setFirstName("Admin");
        admin.setLastName("User");
        admin.setWalletBalance(new BigDecimal("100000.00"));
    }

    private static LoginRequest login(String email, String password) {
        LoginRequest r = new LoginRequest();
        r.setEmail(email);
        r.setPassword(password);
        return r;
    }

    @Test
    void loginSucceedsAndIssuesJwtWithUserIdSubject() {
        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.of(admin));

        AuthResponse res = service.login(login("admin@example.com", "password123"));

        assertEquals("u-1", res.getUserId());
        assertEquals(new BigDecimal("100000.00"), res.getWalletBalance());
        assertNotNull(res.getAccessToken());
        verify(metrics).login(true);

        // The gateway verifies this token with the same secret and reads the subject
        Claims claims = Jwts.parserBuilder()
                .setSigningKey(Keys.hmacShaKeyFor(Decoders.BASE64.decode(SECRET)))
                .build().parseClaimsJws(res.getAccessToken()).getBody();
        assertEquals("u-1", claims.getSubject());
    }

    @Test
    void wrongPasswordIsRejectedWith401() {
        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.of(admin));

        ApiException ex = assertThrows(ApiException.class,
                () -> service.login(login("admin@example.com", "nope")));

        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatus());
        verify(metrics).login(false);
    }

    @Test
    void unknownUserGetsTheSameMessageAsWrongPassword() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());

        ApiException ex = assertThrows(ApiException.class,
                () -> service.login(login("ghost@example.com", "whatever")));

        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatus());
        assertEquals("Invalid email or password", ex.getMessage()); // no user enumeration
    }

    @Test
    void seededBcryptHashFromInitSqlMatchesPassword123() {
        // Hash from docker/mysql/init/03-seed-admin-user.sql ("$2b$" prefix)
        String seeded = "$2b$10$RGKoh1TrCqoCeIpT5BxIM.py5au8jhCazyA69MmMByz70gFCbBTYe";
        assertTrue(encoder.matches("password123", seeded));
        assertFalse(encoder.matches("password124", seeded));
    }
}
