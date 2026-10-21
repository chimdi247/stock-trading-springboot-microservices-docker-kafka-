#!/usr/bin/env bash
# Convenience runner. The stack must be up for everything except `unit`.
#   ./tests/run-all.sh unit | smoke | integration | e2e | selenium | perf-smoke | all
set -uo pipefail
cd "$(dirname "$0")"
T=${1:-all}
rc=0
run() { echo; echo "════════ $1 ════════"; shift; "$@" || rc=1; }

unit()        { run "unit: frontend (node:test)" node --test unit/frontend/*.test.mjs
                run "unit: ai-service (pytest)"  bash -c 'cd ../ai-service && python3 -m pytest ../tests/unit/ai-service -q'
                run "unit: user-service (JUnit)" bash -c 'cd ../user-service && mvn -q test'; }
smoke()       { run "smoke" ./smoke/smoke.sh; }
integration() { run "integration (pytest)" bash -c 'cd integration && python3 -m pytest -v'; }
e2e()         { run "e2e (Playwright)" bash -c 'cd e2e && npm install --no-audit --no-fund && npx playwright install chromium && npx playwright test'; }
selenium()    { run "selenium" bash -c 'cd selenium && python3 -m pytest -v'; }
perfsmoke()   { run "performance smoke (k6)" ./performance/run-perf.sh smoke; }

case "$T" in
  unit) unit;; smoke) smoke;; integration) integration;; e2e) e2e;; selenium) selenium;; perf-smoke) perfsmoke;;
  all) unit; smoke; integration; e2e; selenium; perfsmoke;;
  *) echo "usage: $0 unit|smoke|integration|e2e|selenium|perf-smoke|all"; exit 2;;
esac
exit $rc
