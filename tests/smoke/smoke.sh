#!/usr/bin/env bash
# Fast "is the whole stack alive?" check — ~10 seconds, only needs curl.
#   ./tests/smoke/smoke.sh            (after `docker compose up -d --build`)
set -u
GW=${GATEWAY_URL:-http://localhost:8080}
FE=${FRONTEND_URL:-http://localhost:3000}
EMAIL=${ADMIN_EMAIL:-admin@example.com}
PASS=${ADMIN_PASSWORD:-password123}
GRAFANA=${GRAFANA_URL:-http://localhost:3001}
PROM=${PROMETHEUS_URL:-http://localhost:9090}

ok=0; fail=0
check() {  # check "<name>" "<url>" [expected-http-code]
  local name=$1 url=$2 want=${3:-200}
  local code; code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$url")
  if [ "$code" = "$want" ]; then printf '  \033[32m✔\033[0m %-34s %s\n' "$name" "$code"; ok=$((ok+1))
  else printf '  \033[31m✘\033[0m %-34s got %s, want %s  (%s)\n' "$name" "$code" "$want" "$url"; fail=$((fail+1)); fi
}

echo "── Application health"
check "frontend"              "$FE/healthz"
check "api-gateway"           "$GW/actuator/health"
for p in 8081:user-service 8082:market-data-service 8083:order-service 8084:portfolio-service 8085:notification-service; do
  check "${p#*:}" "http://localhost:${p%%:*}/actuator/health"
done
check "ai-service"            "http://localhost:8086/health"

echo "── Auth + API through the gateway"
check "protected route w/o token → 401" "$GW/api/v1/market/stocks" 401
RESP=$(curl -s -m 15 -X POST "$GW/api/v1/users/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
TOKEN=$(printf '%s' "$RESP" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
if [ -n "$TOKEN" ]; then printf '  \033[32m✔\033[0m %-34s token issued\n' "admin login"; ok=$((ok+1))
else printf '  \033[31m✘\033[0m %-34s %s\n' "admin login" "$RESP"; fail=$((fail+1)); fi
auth() { curl -s -o /dev/null -m 10 -w '%{http_code}' -H "Authorization: Bearer $TOKEN" "$1"; }
for r in /api/v1/users/me /api/v1/market/stocks /api/v1/orders/my-orders /api/v1/portfolio/me; do
  c=$(auth "$GW$r"); if [ "$c" = 200 ]; then printf '  \033[32m✔\033[0m %-34s 200\n' "GET $r"; ok=$((ok+1)); else printf '  \033[31m✘\033[0m %-34s %s\n' "GET $r" "$c"; fail=$((fail+1)); fi
done
STOCKS=$(curl -s -m 10 -H "Authorization: Bearer $TOKEN" "$GW/api/v1/market/stocks")
N=$(printf '%s' "$STOCKS" | grep -o '"symbol"' | wc -l)
if [ "$N" -ge 3 ]; then printf '  \033[32m✔\033[0m %-34s %s symbols\n' "market data flowing (redis)" "$N"; ok=$((ok+1)); else printf '  \033[31m✘\033[0m market data: %s symbols\n' "$N"; fail=$((fail+1)); fi

echo "── Data + messaging UIs"
check "kafka-ui"              "http://localhost:8090/actuator/health"
check "redis-ui"              "http://localhost:8091/"

echo "── Observability"
check "grafana"               "$GRAFANA/api/health"
check "prometheus"            "$PROM/-/ready"
check "loki"                  "http://localhost:3100/ready"
check "tempo"                 "http://localhost:3200/ready"
check "otel-collector (OTLP)" "http://localhost:4318/" 404
UP=$(curl -s -m 10 "$PROM/api/v1/query?query=count(up==1)" | sed -n 's/.*"value":\[[^,]*,"\([0-9]*\)".*/\1/p')
DOWN=$(curl -s -m 10 "$PROM/api/v1/query?query=count(up==0)" | sed -n 's/.*"value":\[[^,]*,"\([0-9]*\)".*/\1/p')
printf '  ℹ prometheus targets: %s up, %s down\n' "${UP:-?}" "${DOWN:-0}"

echo; echo "Smoke result: $ok passed, $fail failed"
[ "$fail" -eq 0 ]
