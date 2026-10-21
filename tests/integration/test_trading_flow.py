"""End-to-end API flow across gateway -> market -> order -> user -> (Kafka) -> portfolio."""
import pytest

from conftest import wait_until


def stocks(c):
    r = c.get("/api/v1/market/stocks")
    assert r.status_code == 200, r.text
    return r.json()


def test_market_lists_stocks_with_prices(trader):
    data = stocks(trader)
    assert len(data) >= 3
    for s in data:
        assert s["symbol"] and float(s["price"]) > 0


def test_single_stock_lookup(trader):
    sym = stocks(trader)[0]["symbol"]
    r = trader.get(f"/api/v1/market/stocks/{sym}")
    assert r.status_code == 200 and r.json()["symbol"] == sym


def place(c, symbol, type_, qty):
    return c.post("/api/v1/orders", json={"userId": c.user["userId"], "symbol": symbol, "type": type_, "quantity": qty})


def test_buy_order_executes_debits_wallet_and_updates_portfolio(trader):
    sym = stocks(trader)[0]["symbol"]
    before = float(trader.get("/api/v1/users/me").json()["walletBalance"])

    r = place(trader, sym, "BUY", 2)
    assert r.status_code == 201, r.text
    order = r.json()
    assert order["status"] == "EXECUTED", order
    total = float(order["totalAmount"])
    assert total == pytest.approx(float(order["price"]) * 2, rel=1e-6)

    after = float(trader.get("/api/v1/users/me").json()["walletBalance"])
    assert after == pytest.approx(before - total, abs=0.01)

    # Portfolio is updated asynchronously through Kafka (order.executed topic)
    def holding():
        p = trader.get("/api/v1/portfolio/me").json()
        return next((h for h in p.get("holdings", []) if h["symbol"] == sym and h["quantity"] == 2), None)

    h = wait_until(holding, timeout=40)
    assert h, "portfolio-service never consumed order.executed from Kafka"
    assert float(h["currentPrice"]) > 0


def test_order_shows_up_in_history(trader):
    sym = stocks(trader)[0]["symbol"]
    oid = place(trader, sym, "BUY", 1).json()["id"]
    mine = trader.get("/api/v1/orders/my-orders").json()
    assert any(o["id"] == oid for o in mine)
    one = trader.get(f"/api/v1/orders/{oid}")
    assert one.status_code == 200 and one.json()["id"] == oid


def test_insufficient_funds_marks_order_failed_and_keeps_wallet(trader):
    s = max(stocks(trader), key=lambda x: float(x["price"]))
    qty = int(100000 // float(s["price"])) + 50                 # more than the wallet can pay
    before = float(trader.get("/api/v1/users/me").json()["walletBalance"])

    r = place(trader, s["symbol"], "BUY", qty)
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "FAILED"
    assert "insufficient" in (body.get("failureReason") or "").lower()
    assert float(trader.get("/api/v1/users/me").json()["walletBalance"]) == pytest.approx(before, abs=0.01)


def test_invalid_quantity_is_rejected(trader):
    sym = stocks(trader)[0]["symbol"]
    assert place(trader, sym, "BUY", 0).status_code == 400


def test_orders_are_scoped_to_the_calling_user(trader, admin):
    sym = stocks(trader)[0]["symbol"]
    oid = place(trader, sym, "BUY", 1).json()["id"]
    assert all(o["id"] != oid for o in admin.get("/api/v1/orders/my-orders").json())
