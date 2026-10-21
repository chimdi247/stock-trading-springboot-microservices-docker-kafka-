-- =====================================================================
-- 01 — Databases and database users
-- Runs once, on first start of an EMPTY mysql-data volume
-- (docker-entrypoint-initdb.d executes *.sql files in alphabetical order).
-- To re-run:  docker compose down -v && docker compose up -d --build
-- =====================================================================

-- One database per microservice (database-per-service pattern)
CREATE DATABASE IF NOT EXISTS user_db      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS order_db     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS portfolio_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Application user — the ONLY credentials the services use. They connect
-- through ProxySQL, which authenticates clients with mysql_native_password,
-- so the account is created with that plugin explicitly.
-- (Dev credentials — also referenced in docker/proxysql/proxysql.cnf)
-- ---------------------------------------------------------------------
CREATE USER IF NOT EXISTS 'trading_app'@'%'
    IDENTIFIED WITH mysql_native_password BY 'trading_pass';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
    ON user_db.*      TO 'trading_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
    ON order_db.*     TO 'trading_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
    ON portfolio_db.* TO 'trading_app'@'%';

-- ---------------------------------------------------------------------
-- ProxySQL monitor user — used by ProxySQL's health/ping/read-only checks
-- ---------------------------------------------------------------------
CREATE USER IF NOT EXISTS 'monitor'@'%'
    IDENTIFIED WITH mysql_native_password BY 'monitor';
GRANT USAGE, REPLICATION CLIENT ON *.* TO 'monitor'@'%';

-- ---------------------------------------------------------------------
-- Prometheus mysqld_exporter user (least privilege, connection-capped)
-- ---------------------------------------------------------------------
CREATE USER IF NOT EXISTS 'exporter'@'%'
    IDENTIFIED WITH mysql_native_password BY 'exporter_pass'
    WITH MAX_USER_CONNECTIONS 5;
GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'exporter'@'%';

FLUSH PRIVILEGES;
