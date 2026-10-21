from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
import os
import re
import uvicorn
import logging
import anthropic
import json
from datetime import datetime

# OpenTelemetry API — manual instrumentation.
# Auto-instrumentation (FastAPI, httpx, logging) is injected by
# `opentelemetry-instrument` (see Dockerfile). The API calls below are safe
# no-ops when no SDK is configured (e.g. `python main.py` on a laptop).
from opentelemetry import trace, metrics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

tracer = trace.get_tracer("com.trading.aiservice")
meter = metrics.get_meter("com.trading.aiservice")

fraud_checks_counter = meter.create_counter(
    "trading.fraud.ai.checks",
    description="Fraud checks served by the AI service, by provider and verdict",
)
fraud_score_histogram = meter.create_histogram(
    "trading.fraud.score",
    description="Distribution of fraud scores (0.0 - 1.0)",
)

# Claude client — key comes from the environment, never from source code.
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None
if client is None:
    logger.warning(
        "ANTHROPIC_API_KEY is not set — using the rule-based fallback "
        "for fraud checks. Set it in .env to enable Claude."
    )

app = FastAPI(
    title="AI Fraud Detection Service — Powered by Claude",
    description="""
    AI fraud detection using Claude (Anthropic).

    Claude analyzes each trade and returns:
    - Fraud score (0.0 to 1.0)
    - Whether order is suspicious
    - Detailed reasoning

    Without an ANTHROPIC_API_KEY the service falls back to simple
    rule-based scoring so the rest of the platform keeps working.
    """,
    version="2.1.0"
)


class OrderData(BaseModel):
    orderId: str
    userId: str
    symbol: str
    type: str
    quantity: int
    totalAmount: float
    price: float
    recentOrderCount: Optional[int] = 0


class FraudCheckResult(BaseModel):
    orderId: str
    isSuspicious: bool
    fraudScore: float
    reason: Optional[str] = None
    recommendation: str
    aiProvider: str = "Claude (Anthropic)"
    checkedAt: str


def rule_based_check(order: OrderData) -> dict:
    """Fallback scoring — mirrors the rules documented in README.md."""
    score = 0.0
    reasons = []

    recent = order.recentOrderCount or 0
    if recent > 10:
        score += min(0.4, 0.1 + (recent - 10) * 0.05)
        reasons.append(f"High frequency trading ({recent} orders in the last hour)")
    if order.totalAmount > 500000:
        score += 0.3
        reasons.append("Large order amount")
    if order.quantity > 1000:
        score += 0.2
        reasons.append("Large quantity")
    if order.quantity >= 500 and order.quantity % 100 == 0:
        score += 0.1
        reasons.append("Round-number quantity")

    score = min(score, 1.0)
    suspicious = score > 0.5
    return {
        "isSuspicious": suspicious,
        "fraudScore": score,
        "reason": "; ".join(reasons) if suspicious else None,
        "recommendation": "BLOCK" if suspicious else ("MONITOR" if score > 0.25 else "ALLOW"),
    }


def parse_model_json(text: str) -> dict:
    """Claude sometimes wraps JSON in ```json fences — strip them."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def record(provider: str, verdict: str, score: float):
    attrs = {"provider": provider, "verdict": verdict}
    fraud_checks_counter.add(1, attrs)
    fraud_score_histogram.record(score, {"provider": provider})


@app.get("/health")
def health():
    return {
        "status": "UP",
        "service": "ai-fraud-detection",
        "aiProvider": "Claude (Anthropic)" if client else "rule-based fallback"
    }


@app.post("/api/fraud/check", response_model=FraudCheckResult)
def check_fraud(order: OrderData):
    """
    AI Fraud Detection using Claude (rule-based fallback without an API key).
    """
    logger.info(
        f"Fraud check — orderId: {order.orderId} "
        f"symbol: {order.symbol} "
        f"type: {order.type} "
        f"quantity: {order.quantity} "
        f"amount: {order.totalAmount}"
    )

    with tracer.start_as_current_span("fraud.check") as span:
        span.set_attribute("order.id", order.orderId)
        span.set_attribute("order.symbol", order.symbol)
        span.set_attribute("order.type", order.type)
        span.set_attribute("order.total_amount", order.totalAmount)

        # ── No API key → rule-based ─────────────────────────────────────
        if client is None:
            result = rule_based_check(order)
            span.set_attribute("fraud.provider", "rule-based")
            span.set_attribute("fraud.score", result["fraudScore"])
            record("rule-based", "suspicious" if result["isSuspicious"] else "clean",
                   result["fraudScore"])
            return FraudCheckResult(
                orderId=order.orderId,
                isSuspicious=result["isSuspicious"],
                fraudScore=round(result["fraudScore"], 2),
                reason=result["reason"],
                recommendation=result["recommendation"],
                aiProvider="Rule-based fallback",
                checkedAt=datetime.now().isoformat()
            )

        try:
            # Build prompt for Claude
            prompt = f"""You are an AI fraud detection system for a stock trading platform.

Analyze the following trade order and determine if it is suspicious:

Order Details:
- Order ID: {order.orderId}
- User ID: {order.userId}
- Stock Symbol: {order.symbol}
- Order Type: {order.type}
- Quantity: {order.quantity} shares
- Price per share: ₹{order.price}
- Total Amount: ₹{order.totalAmount}
- Recent orders in last hour: {order.recentOrderCount}

Analyze this trade for:
1. High frequency trading (too many orders in short time)
2. Unusually large order amounts
3. Suspicious quantity patterns
4. Any other red flags

Respond ONLY with a valid JSON object in this exact format:
{{
    "isSuspicious": true or false,
    "fraudScore": number between 0.0 and 1.0,
    "reason": "brief explanation if suspicious, null if clean",
    "recommendation": "BLOCK or ALLOW or MONITOR"
}}

Be reasonable — legitimate large trades by genuine investors should not be flagged.
Only flag genuinely suspicious patterns."""

            # Call Claude API (httpx is auto-instrumented → child span)
            message = client.messages.create(
                model=ANTHROPIC_MODEL,
                max_tokens=256,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )

            # Parse Claude's response
            response_text = message.content[0].text.strip()
            logger.info(f"Claude response: {response_text}")

            ai_result = parse_model_json(response_text)

            is_suspicious = ai_result.get("isSuspicious", False)
            fraud_score = float(ai_result.get("fraudScore", 0.0))
            reason = ai_result.get("reason", None)
            recommendation = ai_result.get(
                "recommendation", "ALLOW")

            span.set_attribute("fraud.provider", "claude")
            span.set_attribute("fraud.score", fraud_score)
            span.set_attribute("fraud.suspicious", bool(is_suspicious))
            record("claude", "suspicious" if is_suspicious else "clean", fraud_score)

            if is_suspicious:
                logger.warning(
                    f"ORDER FLAGGED by Claude — "
                    f"orderId: {order.orderId} "
                    f"score: {fraud_score} "
                    f"reason: {reason}"
                )
            else:
                logger.info(
                    f"Order cleared by Claude — "
                    f"orderId: {order.orderId} "
                    f"score: {fraud_score}"
                )

            return FraudCheckResult(
                orderId=order.orderId,
                isSuspicious=is_suspicious,
                fraudScore=round(fraud_score, 2),
                reason=reason,
                recommendation=recommendation,
                aiProvider="Claude (Anthropic)",
                checkedAt=datetime.now().isoformat()
            )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Claude response: {e}")
            span.record_exception(e)
            record("claude", "parse_error", 0.0)
            # Fallback to allow if parsing fails
            return FraudCheckResult(
                orderId=order.orderId,
                isSuspicious=False,
                fraudScore=0.0,
                reason="AI parsing error — defaulting to allow",
                recommendation="ALLOW",
                aiProvider="Claude (Anthropic) — fallback",
                checkedAt=datetime.now().isoformat()
            )

        except Exception as e:
            logger.error(f"Claude API error: {e}")
            span.record_exception(e)
            record("claude", "api_error", 0.0)
            # Fallback — don't block orders if AI is down
            return FraudCheckResult(
                orderId=order.orderId,
                isSuspicious=False,
                fraudScore=0.0,
                reason="AI service error — defaulting to allow",
                recommendation="ALLOW",
                aiProvider="Claude (Anthropic) — unavailable",
                checkedAt=datetime.now().isoformat()
            )


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8086,
        reload=True
    )
