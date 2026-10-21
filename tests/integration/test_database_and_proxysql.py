"""Talks to MySQL through ProxySQL (6033) and to the ProxySQL admin console (6032)."""
import os

import pymysql
import pytest

HOST = os.getenv("DB_HOST", "127.0.0.1")


def connect(port, user, password, db=None):
    try:
        return pymysql.connect(host=HOST, port=port, user=user, password=password, database=db, connect_timeout=5)
    except pymysql.err.OperationalError as e:
        pytest.skip(f"cannot reach {HOST}:{port} — {e}")


def test_app_user_reaches_mysql_via_proxysql():
    c = connect(6033, "trading_app", "trading_pass", "user_db")
    with c.cursor() as cur:
        cur.execute("SELECT email FROM users WHERE email=%s", ("admin@example.com",))
        assert cur.fetchone() == ("admin@example.com",)


def test_admin_password_is_stored_as_bcrypt_hash():
    c = connect(6033, "trading_app", "trading_pass", "user_db")
    with c.cursor() as cur:
        cur.execute("SELECT password FROM users WHERE email=%s", ("admin@example.com",))
        pw = cur.fetchone()[0]
    assert pw.startswith(("$2a$", "$2b$", "$2y$")) and len(pw) == 60
    assert "password123" not in pw


@pytest.mark.parametrize("db,table", [("user_db", "users"), ("order_db", "orders"), ("portfolio_db", "holdings")])
def test_schema_created_by_init_scripts(db, table):
    c = connect(6033, "trading_app", "trading_pass", db)
    with c.cursor() as cur:
        cur.execute("SHOW TABLES LIKE %s", (table,))
        assert cur.fetchone() is not None


def test_proxysql_backend_is_online():
    c = connect(6032, "radmin", "radmin")
    with c.cursor() as cur:
        cur.execute("SELECT hostgroup_id, hostname, status FROM runtime_mysql_servers")
        rows = cur.fetchall()
    assert rows and all(r[2] == "ONLINE" for r in rows), rows


def test_proxysql_pools_many_clients_over_few_backend_connections():
    """Open 20 client connections; ProxySQL should serve them with far fewer backend ones."""
    conns = [connect(6033, "trading_app", "trading_pass", "user_db") for _ in range(20)]
    try:
        for c in conns:
            with c.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        admin = connect(6032, "radmin", "radmin")
        with admin.cursor() as cur:
            cur.execute("SELECT SUM(ConnUsed + ConnFree) FROM stats_mysql_connection_pool")
            backend = int(cur.fetchone()[0] or 0)
        assert backend < 20, f"expected pooling, got {backend} backend connections for 20 clients"
    finally:
        for c in conns:
            c.close()
