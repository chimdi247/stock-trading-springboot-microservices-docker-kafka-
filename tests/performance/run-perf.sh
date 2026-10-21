#!/usr/bin/env bash
# Run a k6 scenario INSIDE the compose network (no local k6 install needed).
#   ./tests/performance/run-perf.sh smoke|load|stress|spike|soak|breakpoint|api-latency
# Env passthrough:  PEAK_VUS=100 HOLD=5m DURATION=4h VUS=30 USERS=50
# Live metrics in Grafana:  PROM_RW=1 ./run-perf.sh load   (k6 -> Prometheus remote-write, tagged testid=<scenario>)
set -euo pipefail
cd "$(dirname "$0")"
SCENARIO=${1:-smoke}
[ -f "$SCENARIO.js" ] || { echo "unknown scenario '$SCENARIO'"; ls *.js | sed 's/\.js//' | grep -v '^lib'; exit 1; }
NETWORK=${COMPOSE_NETWORK:-stock-trading_trading-network}
mkdir -p results

OUT=()
if [ "${PROM_RW:-0}" = "1" ]; then
  OUT=(-o experimental-prometheus-rw -e K6_PROMETHEUS_RW_SERVER_URL=http://prometheus:9090/api/v1/write -e K6_PROMETHEUS_RW_TREND_STATS="p(95),p(99),avg,max")
fi
ENVS=()
for v in BASE_URL USERS PEAK_VUS RAMP HOLD RAMP_DOWN DURATION VUS; do
  [ -n "${!v:-}" ] && ENVS+=(-e "$v=${!v}")
done

docker run --rm -i --network "$NETWORK" \
  -v "$PWD:/scripts:ro" -v "$PWD/results:/results" \
  -w /scripts "${OUT[@]}" "${ENVS[@]}" \
  -e K6_PROMETHEUS_RW_PUSH_INTERVAL=5s \
  grafana/k6:0.54.0 run --tag testid="$SCENARIO" "/scripts/$SCENARIO.js"
