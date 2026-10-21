# Tests

| Suite | Folder | Needs the stack? | Run |
|---|---|---|---|
| Unit — frontend (26 tests, Node's built-in runner, no install) | `unit/frontend` | no | `node --test tests/unit/frontend/*.test.mjs` |
| Unit — ai-service (pytest) | `unit/ai-service` | no | `cd ai-service && pip install -r requirements.txt pytest httpx && pytest ../tests/unit/ai-service -q` |
| Unit — user-service (JUnit + Mockito) | `user-service/src/test` | no | `cd user-service && mvn test` |
| Smoke (curl, ~10 s) | `smoke` | yes | `tests/smoke/smoke.sh` |
| Integration (API flow through gateway, Kafka→portfolio, DB via ProxySQL) | `integration` | yes | `cd tests/integration && pip install -r requirements.txt && pytest -v` |
| End-to-end (Playwright: UI flows + Grafana provisioning) | `e2e` | yes | `cd tests/e2e && npm i && npx playwright install chromium && npx playwright test` |
| Selenium (WebDriver UI checks) | `selenium` | yes | `cd tests/selenium && pip install -r requirements.txt && pytest -v` |
| Performance (k6) | `performance` | yes | `tests/performance/run-perf.sh <scenario>` |

Everything at once: `tests/run-all.sh all` (or `unit`, `smoke`, `integration`, `e2e`, `selenium`, `perf-smoke`).

## Performance scenarios (k6, run inside the compose network via Docker)

| Scenario | Purpose | Shape |
|---|---|---|
| `smoke` | scripts + system sanity | 1 VU, 30 s |
| `load` | expected traffic, SLO check (p95<500 ms, <1 % errors) | ramp → 50 VUs hold 10 min → ramp down |
| `stress` | find the degradation point | 50 → 400 VUs in steps |
| `spike` | sudden surge + recovery | 10 → 300 VUs in 20 s, hold, drop, recover |
| `soak` | leaks / pool exhaustion / lag growth | 30 VUs for `DURATION` (default 1 h) |
| `breakpoint` | capacity in req/s | ramping arrival rate until thresholds fail |
| `api-latency` | per-endpoint baseline | 5 VUs, 1 min |

Overrides: `PEAK_VUS=100 HOLD=5m DURATION=4h VUS=30 USERS=50 ./run-perf.sh load`.
Stream k6 metrics into Prometheus/Grafana while it runs: `PROM_RW=1 ./run-perf.sh load` (tagged `testid=<scenario>`),
and watch the Services / MySQL / ProxySQL / Kafka dashboards at the same time — that is the point of running them together.
Each run writes `performance/results/<scenario>-summary.json`.

Test data: perf and integration tests register their own throw-away users (huge wallet), so the seeded admin is never drained.
