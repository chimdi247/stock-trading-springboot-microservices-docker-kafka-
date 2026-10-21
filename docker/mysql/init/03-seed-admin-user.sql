-- =====================================================================
-- 03 — Seed login:   admin@example.com  /  password123
--
-- The password is stored as a BCrypt hash (cost 10, "$2b$" prefix), the
-- same scheme user-service's BCryptPasswordEncoder uses to verify logins.
-- Never store the plain-text password.
--
-- Generated with:
--   python3 -c "import crypt,secrets,string; \
--     a='./'+string.ascii_letters+string.digits; \
--     print(crypt.crypt('password123','\$2b\$10\$'+''.join(secrets.choice(a) for _ in range(21))+'.'))"
-- =====================================================================
USE user_db;

INSERT INTO users
    (id, email, password, first_name, last_name, wallet_balance, status, created_at)
VALUES
    ('8f14e45f-ceea-4e67-a1b2-0a3c5d7e9f01',
     'admin@example.com',
     '$2b$10$RGKoh1TrCqoCeIpT5BxIM.py5au8jhCazyA69MmMByz70gFCbBTYe',
     'Admin',
     'User',
     100000.00,
     'ACTIVE',
     CURRENT_TIMESTAMP(6))
ON DUPLICATE KEY UPDATE
    email = VALUES(email);   -- idempotent: never overwrite an existing admin
