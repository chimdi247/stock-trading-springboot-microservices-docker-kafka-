-- =====================================================================
-- 02 — Schema for all services
-- Column names/types mirror the JPA entities (Spring Boot's default
-- camelCase -> snake_case naming). The services run with
-- JPA_DDL_AUTO=none in Docker, so THIS FILE is the source of truth.
-- =====================================================================

-- ─────────────────────────────  user-service  ─────────────────────────
USE user_db;

CREATE TABLE IF NOT EXISTS users (
    id              VARCHAR(255)  NOT NULL,
    email           VARCHAR(255)  NOT NULL,
    password        VARCHAR(255)  NOT NULL,                 -- BCrypt hash
    first_name      VARCHAR(255)  NOT NULL,
    last_name       VARCHAR(255)  NOT NULL,
    wallet_balance  DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    status          ENUM('ACTIVE','SUSPENDED','BLOCKED') NULL DEFAULT 'ACTIVE',
    created_at      DATETIME(6)   NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────  order-service  ────────────────────────
USE order_db;

CREATE TABLE IF NOT EXISTS orders (
    id              VARCHAR(255)  NOT NULL,
    user_id         VARCHAR(255)  NOT NULL,
    symbol          VARCHAR(255)  NOT NULL,
    type            ENUM('BUY','SELL') NOT NULL,
    status          ENUM('PENDING','AI_CHECK','EXECUTED','FAILED','FLAGGED') NOT NULL,
    quantity        INT           NOT NULL,
    price           DECIMAL(15,2) NOT NULL,
    total_amount    DECIMAL(15,2) NOT NULL,
    failure_reason  VARCHAR(2000) NULL,
    flagged_by_ai   TINYINT(1)    NULL DEFAULT 0,
    ai_reason       VARCHAR(2000) NULL,
    created_at      DATETIME(6)   NULL DEFAULT CURRENT_TIMESTAMP(6),
    executed_at     DATETIME(6)   NULL,
    PRIMARY KEY (id),
    KEY idx_orders_user_created (user_id, created_at),
    KEY idx_orders_status (status),
    KEY idx_orders_symbol (symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────  portfolio-service  ───────────────────────
USE portfolio_db;

CREATE TABLE IF NOT EXISTS holdings (
    id                  VARCHAR(255)  NOT NULL,
    user_id             VARCHAR(255)  NOT NULL,
    symbol              VARCHAR(255)  NOT NULL,
    company_name        VARCHAR(255)  NOT NULL,
    quantity            INT           NOT NULL,
    average_buy_price   DECIMAL(15,2) NULL,
    total_invested      DECIMAL(15,2) NULL,
    updated_at          DATETIME(6)   NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_holdings_user_symbol (user_id, symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
