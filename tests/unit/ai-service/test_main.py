"""Unit tests for ai-service.  Run:

    cd ai-service && pip install -r requirements.txt pytest httpx
    ANTHROPIC_API_KEY= pytest ../tests/unit/ai-service -q

(No API key -> the rule-based fallback is exercised, so no network/LLM is needed.)
"""
import os
import sys
import json

import pytest

os.environ["ANTHROPIC_API_KEY"] = ""          # force the rule-based path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "ai-service"))

from fastapi.testclient import TestClient      # noqa: E402
import main                                    # noqa: E402


def order(**kw):
    base = dict(orderId="o-1", userId="u-1", symbol="AAPL", type="BUY",
                quantity=10, totalAmount=2000.0, price=200.0, recentOrderCount=0)
    base.update(kw)
    return main.OrderData(**base)


# ---------------------------------------------------------------- rule engine
def test_normal_order_is_allowed():
    r = main.rule_based_check(order())
    assert r["isSuspicious"] is False
    assert r["fraudScore"] == 0.0
    assert r["recommendation"] == "ALLOW"


def test_high_frequency_alone_is_monitored_not_blocked():
    r = main.rule_based_check(order(recentOrderCount=15))
    assert 0.25 < r["fraudScore"] <= 0.5
    assert r["isSuspicious"] is False
    assert r["recommendation"] == "MONITOR"


def test_large_round_quantity_and_amount_is_blocked():
    r = main.rule_based_check(order(quantity=1200, totalAmount=600000.0))
    assert r["isSuspicious"] is True
    assert r["recommendation"] == "BLOCK"
    assert "Large order amount" in r["reason"]


def test_score_is_capped_at_one():
    r = main.rule_based_check(order(quantity=5000, totalAmount=9e9, recentOrderCount=500))
    assert r["fraudScore"] <= 1.0


# ---------------------------------------------------------------- JSON parsing
def test_parse_model_json_strips_code_fences():
    raw = '```json\n{"isSuspicious": false, "fraudScore": 0.1}\n```'
    assert main.parse_model_json(raw)["fraudScore"] == 0.1


def test_parse_model_json_plain():
    assert main.parse_model_json('{"a": 1}') == {"a": 1}


def test_parse_model_json_rejects_garbage():
    with pytest.raises(json.JSONDecodeError):
        main.parse_model_json("sorry, I cannot help")


# ---------------------------------------------------------------- HTTP API
client = TestClient(main.app)


def test_health_reports_fallback_provider():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "UP"
    assert "rule-based" in r.json()["aiProvider"]


def test_fraud_check_endpoint_clean_order():
    r = client.post("/api/fraud/check", json=order().model_dump())
    assert r.status_code == 200
    body = r.json()
    assert body["orderId"] == "o-1"
    assert body["isSuspicious"] is False


def test_fraud_check_endpoint_flags_suspicious_order():
    r = client.post("/api/fraud/check", json=order(quantity=1200, totalAmount=700000.0).model_dump())
    assert r.status_code == 200
    assert r.json()["isSuspicious"] is True


def test_fraud_check_validates_payload():
    r = client.post("/api/fraud/check", json={"orderId": "x"})
    assert r.status_code == 422
