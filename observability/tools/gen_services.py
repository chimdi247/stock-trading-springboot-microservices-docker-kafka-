from dashlib import *

APPS = "api-gateway|user-service|market-data-service|order-service|portfolio-service|notification-service|ai-service|frontend"
D = Dash("trading-services-overview", "Trading Platform — Services Overview",
         ["trading", "slo", "red", "business"],
         "Uptime, latency, SLI/SLO, error rates, request totals, business KPIs and CPU/memory for every service, container and node.")
D.var_query("service", "label_values(http_server_request_duration_seconds_count, service_name)", "Service")
D.var_const("slo_availability", 99.9, "Availability SLO %")
D.var_const("slo_latency_s", 0.5, "Latency SLO (s)")

# Application HTTP selector (health probes excluded)
SEL = 'service_name=~"$service", http_route!~"/actuator.*|/health.*"'
CNT = f"http_server_request_duration_seconds_count{{{SEL}}}"
CNT5 = f'http_server_request_duration_seconds_count{{{SEL}, http_response_status_code=~"5.."}}'
CNT_OK = f'http_server_request_duration_seconds_count{{{SEL}, http_response_status_code=~"[23].."}}'
CNT_FAIL = f'http_server_request_duration_seconds_count{{{SEL}, http_response_status_code=~"[45].."}}'
BKT = f"http_server_request_duration_seconds_bucket{{{SEL}}}"

# ───────────────────────── UPTIME ─────────────────────────
D.row("Uptime & availability")
D.stat("Service status (black-box probe)", [('probe_success{job="blackbox-http"}', "{{service}}")],
       w=12, h=5, mappings=UP_DOWN, th=[(None, RED), (1, GREEN)],
       desc="1 = /health endpoint answered 2xx in the last probe.")
D.bargauge("Uptime % (selected time range)",
           [('100 * avg_over_time(probe_success{job="blackbox-http"}[$__range])', "{{service}}")],
           w=12, h=5, unit="percent", minv=95, maxv=100,
           th=[(None, RED), (99, ORANGE), (99.9, GREEN)])
D.table("Container uptime & restarts", [
    (f'time() - container_start_time_seconds{{name=~"{APPS}"}}', "uptime")],
    w=12, h=6, unit="s", sort_by="Value",
    transforms=[{"id": "organize", "options": {"excludeByName": {"Time": True, "id": True, "image": True, "instance": True, "job": True, "cluster": True},
                                             "renameByName": {"Value": "Uptime", "name": "Container"}}}],
    desc="Time since each container (re)started.")
D.timeseries("Container restarts (start-time changes)",
             [(f'changes(container_start_time_seconds{{name=~"{APPS}"}}[$__range])', "{{name}}")],
             w=12, h=6, draw="bars", fill=60, desc="Non-zero = the container restarted inside the selected range.")

# ───────────────────────── TRAFFIC / ERRORS ─────────────────────────
D.row("HTTP traffic — successful vs failed")
D.stat("Total requests", [(f"sum(increase({CNT}[$__range]))", "")], w=4, h=4, color_mode="value",
       decimals=0, th=[(None, BLUE)], graph=False)
D.stat("Successful (2xx/3xx)", [(f"sum(increase({CNT_OK}[$__range])) or vector(0)", "")], w=5, h=4,
       decimals=0, th=[(None, GREEN)])
D.stat("Failed (4xx + 5xx)", [(f"sum(increase({CNT_FAIL}[$__range])) or vector(0)", "")], w=5, h=4,
       decimals=0, th=[(None, GREEN), (1, ORANGE), (100, RED)])
D.stat("Server errors (5xx)", [(f"sum(increase({CNT5}[$__range])) or vector(0)", "")], w=5, h=4,
       decimals=0, th=[(None, GREEN), (1, RED)])
D.stat("Request rate", [(f"sum(rate({CNT}[$__rate_interval]))", "")], w=5, h=4, unit="reqps",
       color_mode="value", th=[(None, BLUE)], graph=True, decimals=2)

D.timeseries("Requests/sec by service", [(f"sum by (service_name) (rate({CNT}[$__rate_interval]))", "{{service_name}}")],
             w=8, unit="reqps", stack=True)
D.timeseries("Requests/sec by status code",
             [(f"sum by (http_response_status_code) (rate({CNT}[$__rate_interval]))", "{{http_response_status_code}}")],
             w=8, unit="reqps", stack=True)
D.timeseries("Successful vs failed requests/sec",
             [(f"sum(rate({CNT_OK}[$__rate_interval])) or vector(0)", "successful"),
              (f"sum(rate({CNT_FAIL}[$__rate_interval])) or vector(0)", "failed")],
             w=8, unit="reqps",
             overrides=[{"matcher": {"id": "byName", "options": "failed"}, "properties": [{"id": "color", "value": {"mode": "fixed", "fixedColor": "red"}}]},
                        {"matcher": {"id": "byName", "options": "successful"}, "properties": [{"id": "color", "value": {"mode": "fixed", "fixedColor": "green"}}]}])
D.timeseries("Error rate % (5xx) by service",
             [(f"100 * sum by (service_name) (rate({CNT5}[$__rate_interval])) / sum by (service_name) (rate({CNT}[$__rate_interval]))", "{{service_name}}")],
             w=12, unit="percent", th=[(None, GREEN), (1, RED)], minv=0,
             desc="Share of requests answered with HTTP 5xx. Red line = 1%.")
D.timeseries("Failed requests/sec (4xx + 5xx) by service",
             [(f"sum by (service_name) (rate({CNT_FAIL}[$__rate_interval]))", "{{service_name}}")],
             w=12, unit="reqps")

# ───────────────────────── LATENCY ─────────────────────────
D.row("Latency")
D.timeseries("Latency percentiles (selected services)", [
    (f"histogram_quantile(0.50, sum by (le) (rate({BKT}[$__rate_interval])))", "p50"),
    (f"histogram_quantile(0.95, sum by (le) (rate({BKT}[$__rate_interval])))", "p95"),
    (f"histogram_quantile(0.99, sum by (le) (rate({BKT}[$__rate_interval])))", "p99")], w=8, unit="s")
D.timeseries("p95 latency by service",
             [(f"histogram_quantile(0.95, sum by (le, service_name) (rate({BKT}[$__rate_interval])))", "{{service_name}}")],
             w=8, unit="s", th=[(None, GREEN), (0.5, RED)], desc="Red line = latency SLO (500 ms).")
D.timeseries("Average latency by service",
             [(f"sum by (service_name) (rate(http_server_request_duration_seconds_sum{{{SEL}}}[$__rate_interval])) / sum by (service_name) (rate({CNT}[$__rate_interval]))", "{{service_name}}")],
             w=8, unit="s")
D.table("Slowest routes (p95)", [
    (f"topk(10, histogram_quantile(0.95, sum by (le, service_name, http_route) (rate({BKT}[$__range]))))", "")],
    w=24, h=7, unit="s", sort_by="Value",
    transforms=[{"id": "organize", "options": {"excludeByName": {"Time": True}, "renameByName": {"Value": "p95", "service_name": "Service", "http_route": "Route"}}}])

# ───────────────────────── SLI / SLO ─────────────────────────
D.row("SLI / SLO  (availability target 99.9 %, latency target 95 % under 500 ms)")
D.stat("Availability SLI (non-5xx)",
       [(f"100 * (1 - (sum(increase({CNT5}[$__range])) or vector(0)) / sum(increase({CNT}[$__range])))", "")],
       w=6, h=5, unit="percent", decimals=3, th=[(None, RED), (99, ORANGE), (99.9, GREEN)],
       desc="Good requests / all requests in the selected range. SLO: 99.9 %.")
D.stat("Latency SLI (requests < 500 ms)",
       [(f'100 * sum(increase(http_server_request_duration_seconds_bucket{{{SEL}, le="0.5"}}[$__range])) / sum(increase({CNT}[$__range]))', "")],
       w=6, h=5, unit="percent", decimals=2, th=[(None, RED), (90, ORANGE), (95, GREEN)],
       desc="Share of requests served in 500 ms or less. SLO: 95 %.")
D.gauge("Error budget remaining",
        [(f"clamp(100 * (1 - ((sum(increase({CNT5}[$__range])) or vector(0)) / sum(increase({CNT}[$__range]))) / 0.001), 0, 100)", "")],
        w=6, h=5, th=[(None, RED), (25, ORANGE), (50, GREEN)],
        desc="Budget = 0.1 % of requests may fail (99.9 % SLO). 100 % = untouched.")
D.stat("Apdex-style satisfaction (< 250 ms)",
       [(f'100 * sum(increase(http_server_request_duration_seconds_bucket{{{SEL}, le="0.25"}}[$__range])) / sum(increase({CNT}[$__range]))', "")],
       w=6, h=5, unit="percent", decimals=1, th=[(None, RED), (80, ORANGE), (90, GREEN)])
D.timeseries("Error-budget burn rate (1h window) by service",
             [(f"(sum by (service_name) (rate({CNT5}[1h])) / sum by (service_name) (rate({CNT}[1h]))) / 0.001", "{{service_name}}")],
             w=12, th=[(None, GREEN), (1, RED)], minv=0,
             desc="1.0 = burning the budget exactly as fast as the SLO allows. >1 = SLO at risk. (Needs ≥1h of data.)")
D.bargauge("Availability by service (selected range)",
           [(f"100 * (1 - (sum by (service_name) (increase({CNT5}[$__range])) or (0 * sum by (service_name) (increase({CNT}[$__range])))) / sum by (service_name) (increase({CNT}[$__range])))", "{{service_name}}")],
           w=12, unit="percent", minv=95, maxv=100, th=[(None, RED), (99, ORANGE), (99.9, GREEN)])

# ───────────────────────── BUSINESS KPIs ─────────────────────────
D.row("Business KPIs (custom OpenTelemetry metrics)")
def ordc(status): return f'sum(increase(trading_orders_total{{order_status="{status}"}}[$__range])) or vector(0)'
D.stat("Orders executed", [(ordc("EXECUTED"), "")], w=4, decimals=0, th=[(None, GREEN)])
D.stat("Orders failed", [(ordc("FAILED"), "")], w=4, decimals=0, th=[(None, GREEN), (1, RED)])
D.stat("Orders flagged by AI", [(ordc("FLAGGED"), "")], w=4, decimals=0, th=[(None, GREEN), (1, ORANGE)])
D.stat("Order success rate",
       [('100 * (sum(increase(trading_orders_total{order_status="EXECUTED"}[$__range])) or vector(0)) / sum(increase(trading_orders_total[$__range]))', "")],
       w=4, unit="percent", decimals=1, th=[(None, RED), (90, ORANGE), (98, GREEN)])
D.stat("Value traded (executed)", [('sum(increase(trading_order_value_sum{order_status="EXECUTED"}[$__range])) or vector(0)', "")],
       w=4, unit="currencyINR", decimals=0, th=[(None, BLUE)])
D.stat("Avg order value", [('sum(increase(trading_order_value_sum{order_status="EXECUTED"}[$__range])) / sum(increase(trading_order_value_count{order_status="EXECUTED"}[$__range]))', "")],
       w=4, unit="currencyINR", decimals=0, th=[(None, BLUE)])

D.timeseries("Orders per minute by status",
             [('60 * sum by (order_status) (rate(trading_orders_total[$__rate_interval]))', "{{order_status}}")], w=8, stack=True)
D.piechart("Executed orders by symbol",
           [('sum by (symbol) (increase(trading_orders_total{order_status="EXECUTED"}[$__range]))', "{{symbol}}")], w=8)
D.piechart("BUY vs SELL (executed)",
           [('sum by (order_type) (increase(trading_orders_total{order_status="EXECUTED"}[$__range]))', "{{order_type}}")], w=8)

D.stat("Registrations", [('sum(increase(trading_user_registrations_total{outcome="success"}[$__range])) or vector(0)', "")], w=4, decimals=0, th=[(None, BLUE)])
D.stat("Logins OK", [('sum(increase(trading_user_logins_total{outcome="success"}[$__range])) or vector(0)', "")], w=4, decimals=0, th=[(None, GREEN)])
D.stat("Logins failed", [('sum(increase(trading_user_logins_total{outcome="failure"}[$__range])) or vector(0)', "")], w=4, decimals=0, th=[(None, GREEN), (10, ORANGE), (50, RED)],
       desc="Wrong e-mail/password. A sudden spike can indicate credential stuffing.")
D.stat("Fraud checks flagged", [('sum(increase(trading_fraud_checks_total{result="flagged"}[$__range])) or vector(0)', "")], w=4, decimals=0, th=[(None, GREEN), (1, ORANGE)])
D.stat("AI service unavailable", [('sum(increase(trading_fraud_checks_total{result="unavailable"}[$__range])) or vector(0)', "")], w=4, decimals=0, th=[(None, GREEN), (1, RED)],
       desc="Orders that were processed without a fraud verdict because ai-service did not answer.")
D.stat("Notifications sent", [('sum(increase(trading_notifications_total[$__range])) or vector(0)', "")], w=4, decimals=0, th=[(None, BLUE)])

D.timeseries("Fraud checks by result", [('sum by (result) (rate(trading_fraud_checks_total[$__rate_interval]))', "{{result}}")], w=6, unit="ops", stack=True)
D.timeseries("AI fraud score (avg)",
             [('sum(rate(trading_fraud_score_sum[$__rate_interval])) / sum(rate(trading_fraud_score_count[$__rate_interval]))', "avg score")], w=6, minv=0, maxv=1)
D.timeseries("Notifications by event", [('sum by (event) (rate(trading_notifications_total[$__rate_interval]))', "{{event}}")], w=6, unit="ops", stack=True)
D.timeseries("Portfolio updates (Kafka consumer)", [('sum by (order_type, outcome) (rate(trading_portfolio_updates_total[$__rate_interval]))', "{{order_type}} {{outcome}}")], w=6, unit="ops")
D.timeseries("Market price ticks/sec", [('sum(rate(trading_market_price_updates_total[$__rate_interval]))', "ticks/s")], w=8, unit="ops", desc="6 symbols every 2 s ≈ 3 ticks/s.")
D.timeseries("Redis price-cache hit ratio",
             [('100 * sum(rate(trading_market_cache_lookups_total{result="hit"}[$__rate_interval])) / sum(rate(trading_market_cache_lookups_total[$__rate_interval]))', "hit %")],
             w=8, unit="percent", minv=0, maxv=100)
D.timeseries("Wallet operations", [('sum by (operation) (rate(trading_wallet_operations_total[$__rate_interval]))', "{{operation}}")], w=8, unit="ops", stack=True)

# ───────────────────────── CONTAINERS ─────────────────────────
D.row("Containers — CPU & memory  (alert threshold 40 %)")
CPU_PCT = ('100 * sum by (name) (rate(container_cpu_usage_seconds_total{name!=""}[$__rate_interval])) / on (name) '
           'sum by (name) (container_spec_cpu_quota{name!=""} / container_spec_cpu_period{name!=""} > 0)')
MEM_PCT = ('100 * max by (name) (container_memory_working_set_bytes{name!=""}) / on (name) '
           'max by (name) (container_spec_memory_limit_bytes{name!=""} > 0)')
D.timeseries("Container CPU % of limit", [(CPU_PCT, "{{name}}")], w=12, unit="percent", minv=0,
             th=[(None, GREEN), (40, RED)], desc="Red line = Grafana alert threshold (40 %).")
D.timeseries("Container memory % of limit", [(MEM_PCT, "{{name}}")], w=12, unit="percent", minv=0,
             th=[(None, GREEN), (40, RED)], desc="Working-set memory / container limit. Red line = alert threshold.")
D.bargauge("CPU % now", [(CPU_PCT, "{{name}}")], w=6, h=9, unit="percent", maxv=100, th=[(None, GREEN), (40, ORANGE), (80, RED)])
D.bargauge("Memory % now", [(MEM_PCT, "{{name}}")], w=6, h=9, unit="percent", maxv=100, th=[(None, GREEN), (40, ORANGE), (80, RED)])
D.timeseries("Container memory (working set)", [('max by (name) (container_memory_working_set_bytes{name!=""})', "{{name}}")], w=12, h=9, unit="bytes")
D.timeseries("Container network I/O",
             [('sum by (name) (rate(container_network_receive_bytes_total{name!=""}[$__rate_interval]))', "rx {{name}}"),
              ('- sum by (name) (rate(container_network_transmit_bytes_total{name!=""}[$__rate_interval]))', "tx {{name}}")],
             w=12, h=8, unit="Bps", fill=5)
D.timeseries("Container CPU (cores)", [('sum by (name) (rate(container_cpu_usage_seconds_total{name!=""}[$__rate_interval]))', "{{name}}")], w=12, h=8, unit="short")

# ───────────────────────── NODES ─────────────────────────
D.row("Node (host)")
D.gauge("Node CPU %", [('100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[2m])))', "")], w=4, th=[(None, GREEN), (40, ORANGE), (80, RED)])
D.gauge("Node memory %", [('100 * (1 - sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes))', "")], w=4, th=[(None, GREEN), (40, ORANGE), (80, RED)])
D.gauge("Node disk % (/)", [('100 * (1 - max(node_filesystem_avail_bytes{mountpoint="/", fstype!~"tmpfs|overlay"}) / max(node_filesystem_size_bytes{mountpoint="/", fstype!~"tmpfs|overlay"}))', "")], w=4, th=[(None, GREEN), (70, ORANGE), (85, RED)])
D.stat("Load (1m)", [('node_load1', "")], w=4, h=5, th=[(None, GREEN)], decimals=2)
D.stat("Node uptime", [('time() - node_boot_time_seconds', "")], w=4, h=5, unit="s", th=[(None, BLUE)])
D.stat("Services up", [('count(probe_success{job="blackbox-http"} == 1) or vector(0)', "")], w=4, h=5, th=[(None, RED), (8, GREEN)], decimals=0,
       desc="Out of 8 probed services. Firing Grafana alerts: Alerting -> Alert rules.")
D.timeseries("Node CPU % / memory %", [
    ('100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[$__rate_interval])))', "CPU %"),
    ('100 * (1 - sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes))', "Memory %")],
    w=12, unit="percent", minv=0, th=[(None, GREEN), (40, RED)])
D.timeseries("Node network & disk I/O", [
    ('sum(rate(node_network_receive_bytes_total{device!~"lo|veth.*|br-.*|docker.*"}[$__rate_interval]))', "net rx"),
    ('sum(rate(node_network_transmit_bytes_total{device!~"lo|veth.*|br-.*|docker.*"}[$__rate_interval]))', "net tx"),
    ('sum(rate(node_disk_read_bytes_total[$__rate_interval]))', "disk read"),
    ('sum(rate(node_disk_written_bytes_total[$__rate_interval]))', "disk write")], w=12, unit="Bps")

# ───────────────────────── JVM ─────────────────────────
D.row("JVM (OpenTelemetry runtime metrics)")
D.timeseries("Heap used by service", [('sum by (service_name) (jvm_memory_used_bytes{jvm_memory_type="heap", service_name=~"$service"})', "{{service_name}}")], w=8, unit="bytes")
D.timeseries("JVM CPU utilisation", [('max by (service_name) (jvm_cpu_recent_utilization_ratio{service_name=~"$service"})', "{{service_name}}")], w=8, unit="percentunit", minv=0)
D.timeseries("Live threads", [('sum by (service_name) (jvm_thread_count{service_name=~"$service"})', "{{service_name}}")], w=8)
D.timeseries("GC time per second", [('sum by (service_name) (rate(jvm_gc_duration_seconds_sum{service_name=~"$service"}[$__rate_interval]))', "{{service_name}}")], w=12, unit="s")
D.timeseries("Loaded classes", [('sum by (service_name) (jvm_class_count{service_name=~"$service"})', "{{service_name}}")], w=12)

# ───────────────────────── LOGS & TRACES ─────────────────────────
D.row("Logs & traces  (open a log line → “Open trace in Tempo”)")
D.logs("Application logs", '{service_name=~"$service"}', h=11,
       desc="Expand a line and click the trace_id link to jump to the trace and its spans.")
D.logs("Errors & warnings", '{service_name=~"$service"} |~ "(?i)(error|exception|warn|fail)"', h=9)
D.traces("Recent error traces", '{ status = error }', h=8,
         desc="TraceQL search. Click a trace to see spans; from a span use “Logs for this span”.")
D.save("../grafana/dashboards/trading-services-overview.json")
