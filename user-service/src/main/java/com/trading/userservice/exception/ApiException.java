package com.trading.userservice.exception;

import org.springframework.http.HttpStatus;

/** Business error that maps to a specific HTTP status instead of a bare 500. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
