from dashlib import *
D = Dash("trading-proxysql", "ProxySQL — Connection Pool & Routing", ["trading", "proxysql", "mysql"],
         "ProxySQL built-in Prometheus exporter (:6070). Pool = backend connections shared by all app clients (multiplexing).")
D.var_const("max_backend_conns", 100, "Backend max_connections (docker/proxysql/proxysql.cnf)")

D.row("Status")
D.stat("ProxySQL status", [('up{job="proxysql"}', "")], w=4, mappings=UP_DOWN, th=[(None, RED), (1, GREEN)])
D.stat("Backend status", [('proxysql_connpool_conns_status', "{{endpoint}} hg{{hostgroup}}")], w=6,
       mappings=[{"type": "value", "options": {
           "1": {"text": "ONLINE", "color": "green", "index": 0}, "2": {"text": "SHUNNED", "color": "red", "index": 1},
           "3": {"text": "OFFLINE_SOFT", "color": "orange", "index": 2}, "4": {"text": "OFFLINE_HARD", "color": "red", "index": 3},
           "5": {"text": "SHUNNED (lag)", "color": "red", "index": 4}}}],
       th=[(None, RED), (1, GREEN)], desc="Status of each MySQL backend as seen by ProxySQL.")
D.stat("Uptime", [('max(proxysql_uptime_seconds_total)', "")], w=4, unit="s", th=[(None, BLUE)], color_mode="value")
D.stat("Queries/sec", [('sum(rate(proxysql_questions_total[$__rate_interval]))', "")], w=5, unit="ops", decimals=1, th=[(None, BLUE)], color_mode="value", graph=True)
D.stat("Active transactions", [('sum(proxysql_active_transactions)', "")], w=5, decimals=0, th=[(None, GREEN), (20, ORANGE)], graph=True)

D.row("Client connections (apps → ProxySQL)")
D.stat("Client connections", [('sum(proxysql_client_connections_connected)', "")], w=4, decimals=0, th=[(None, GREEN)], graph=True, color_mode="value")
D.timeseries("Client connections: connected / non-idle", [
    ('sum(proxysql_client_connections_connected)', "connected"),
    ('sum(proxysql_client_connections_non_idle)', "non-idle (busy)")], w=10)
D.timeseries("Client connections created / aborted per sec", [
    ('sum(rate(proxysql_client_connections_total{status="created"}[$__rate_interval]))', "created"),
    ('sum(rate(proxysql_client_connections_total{status="aborted"}[$__rate_interval]))', "aborted")], w=10, unit="ops")
D.timeseries("Waiting clients (delayed / failed backend-connection requests per sec)", [
    ('sum(rate(proxysql_server_connections_total{status="delayed"}[$__rate_interval]))', "delayed backend connections"),
    ('sum(rate(proxysql_connpool_get_conn_failure_total[$__rate_interval]))', "pool could not provide a connection")], w=12, unit="ops", minv=0,
    th=[(None, GREEN), (0.01, RED)],
    desc="ProxySQL has no 'queue length' metric. These two counters rise when clients had to wait for (or could not get) a backend connection — i.e. the pool is saturated.")
D.timeseries("Hostgroup-locked clients", [('sum(proxysql_client_connections_hostgroup_locked)', "locked to a hostgroup")], w=12)

D.row("Backend pool (ProxySQL → MySQL)")
D.stat("Active server connections", [('sum(proxysql_connpool_conns{status="used"})', "")], w=4, decimals=0, th=[(None, GREEN)], graph=True, color_mode="value")
D.stat("Idle server connections", [('sum(proxysql_connpool_conns{status="free"})', "")], w=4, decimals=0, th=[(None, BLUE)], graph=True, color_mode="value")
D.gauge("Pool utilization", [('100 * sum(proxysql_connpool_conns{status="used"}) / (sum(proxysql_connpool_conns{status="used"}) + sum(proxysql_connpool_conns{status="free"}))', "")], w=4,
        th=[(None, GREEN), (70, ORANGE), (90, RED)], desc="used / (used + free) connections currently open to MySQL.")
D.gauge("Used vs configured max", [('100 * sum(proxysql_connpool_conns{status="used"}) / $max_backend_conns', "")], w=4,
        th=[(None, GREEN), (70, ORANGE), (90, RED)], desc="Active connections vs mysql_servers.max_connections (100).")
D.timeseries("Server connections: active vs idle", [
    ('sum by (endpoint) (proxysql_connpool_conns{status="used"})', "active {{endpoint}}"),
    ('sum by (endpoint) (proxysql_connpool_conns{status="free"})', "idle {{endpoint}}")], w=8, stack=True)
D.timeseries("Multiplexing efficiency", [
    ('sum(rate(proxysql_myhgm_myconnpool_get_ok_total[$__rate_interval])) / sum(rate(proxysql_myhgm_myconnpool_get_total[$__rate_interval])) * 100', "pool hit % (connection reused)"),
    ('sum(proxysql_client_connections_connected) / sum(proxysql_server_connections_connected)', "clients per backend connection")], w=8, minv=0,
    desc="High reuse + many clients per backend connection = pooling is doing its job.")
D.timeseries("Connections opened to MySQL per sec", [
    ('sum(rate(proxysql_connpool_conns_total{status="ok"}[$__rate_interval]))', "established"),
    ('sum(rate(proxysql_server_connections_total{status="created"}[$__rate_interval]))', "created")], w=8, unit="ops")

D.row("Connection limits")
D.timeseries("Frontend connections vs limit", [
    ('sum(proxysql_client_connections_connected)', "connected"),
    ('max(proxysql_mysql_max_connections)', "mysql-max_connections")], w=8)
D.timeseries("Backend active vs limit", [
    ('sum(proxysql_connpool_conns{status="used"})', "active"),
    ('vector($max_backend_conns)', "backend max_connections")], w=8)
D.timeseries("Connections denied (limits) per sec", [
    ('sum(rate(proxysql_access_denied_max_connections_total[$__rate_interval]))', "max connections"),
    ('sum(rate(proxysql_access_denied_max_user_connections_total[$__rate_interval]))', "max user connections")], w=8, unit="ops", th=[(None, GREEN), (0.001, RED)], minv=0)

D.row("Throughput — queries & transactions")
D.timeseries("Queries/sec", [
    ('sum(rate(proxysql_questions_total[$__rate_interval]))', "queries"),
    ('sum(rate(proxysql_slow_queries_total[$__rate_interval]))', "slow queries")], w=8, unit="ops")
D.timeseries("Queries/sec per backend", [('sum by (endpoint, hostgroup) (rate(proxysql_connpool_conns_queries_total[$__rate_interval]))', "{{endpoint}} hg{{hostgroup}}")], w=8, unit="ops")
D.timeseries("Transactions/sec (commit + rollback)", [
    ('sum(rate(proxysql_com_commit_cnt_total[$__rate_interval])) + sum(rate(proxysql_com_rollback_total[$__rate_interval]))', "transactions"),
    ('sum(rate(proxysql_com_commit_cnt_total[$__rate_interval]))', "commits"),
    ('sum(rate(proxysql_com_rollback_total[$__rate_interval]))', "rollbacks")], w=8, unit="ops")

D.row("Latency")
D.timeseries("Avg backend query latency", [
    ('1000 * sum(rate(proxysql_backend_query_time_seconds_total[$__rate_interval])) / sum(rate(proxysql_questions_total[$__rate_interval]))', "backend network+execution per query")], w=8, unit="ms", minv=0,
    desc="Time ProxySQL spent talking to MySQL, per query. ProxySQL exports totals, not histograms, so percentiles are not available — see the MySQL dashboard for statement latency.")
D.timeseries("ProxySQL internal processing per query", [
    ('1000 * sum(rate(proxysql_query_processor_time_seconds_total[$__rate_interval])) / sum(rate(proxysql_questions_total[$__rate_interval]))', "query-processor time")], w=8, unit="ms", minv=0)
D.timeseries("Backend ping latency (monitor)", [('max by (endpoint) (proxysql_connpool_conns_latency_us) / 1000', "{{endpoint}}")], w=8, unit="ms", minv=0)
D.text("**Transaction latency:** ProxySQL's Prometheus exporter does not expose per-transaction duration. Use *Avg backend query latency* together with *Active transactions* above, and application-side spans in Tempo (`order.place`, JDBC spans) for end-to-end transaction timing.", h=2)

D.row("Errors")
D.timeseries("Connection errors per sec (to backends)", [
    ('sum by (endpoint) (rate(proxysql_connpool_conns_total{status="err"}[$__rate_interval]))', "backend connect errors {{endpoint}}"),
    ('sum(rate(proxysql_client_connections_total{status="aborted"}[$__rate_interval]))', "client connections aborted"),
    ('sum(rate(proxysql_max_connect_timeouts_total[$__rate_interval]))', "connect timeouts")], w=8, unit="ops", th=[(None, GREEN), (0.001, RED)], minv=0)
D.timeseries("Server login failures", [
    ('sum(rate(proxysql_mysql_monitor_connect_check_total{status="err"}[$__rate_interval]))', "monitor connect check failed"),
    ('sum by (endpoint) (rate(proxysql_connpool_conns_total{status="err"}[$__rate_interval]))', "backend login/connect failed {{endpoint}}"),
    ('sum(rate(proxysql_access_denied_wrong_password_total[$__rate_interval]))', "client wrong password (to ProxySQL)")], w=8, unit="ops", th=[(None, GREEN), (0.001, RED)], minv=0,
    desc="Failed attempts to log in to MySQL backends (wrong credentials / unreachable) plus failed client logins to ProxySQL.")
D.timeseries("MySQL errors by code", [('sum by (code) (rate(proxysql_mysql_error_total[$__rate_interval]))', "{{code}}")], w=8, unit="ops", minv=0)

D.row("Process")
D.timeseries("Memory (resident)", [('proxysql_jemalloc_bytes{type="resident"}', "resident"), ('container_memory_working_set_bytes{name="proxysql"}', "container working set")], w=8, unit="bytes")
D.timeseries("File descriptors", [('proxysql_fds_in_use', "in use")], w=8)
D.timeseries("Network to/from backends", [
    ('sum(rate(proxysql_queries_backends_bytes_total{traffic_flow="sent"}[$__rate_interval]))', "sent"),
    ('sum(rate(proxysql_queries_backends_bytes_total{traffic_flow="received"}[$__rate_interval]))', "received")], w=8, unit="Bps")
D.save("../grafana/dashboards/proxysql.json")
