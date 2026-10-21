package com.trading.userservice.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    private String userId;
    private String email;
    private String firstName;
    private String lastName;
    private BigDecimal walletBalance;
    private String tokenType = "Bearer";
}
