from dashlib import *
D = Dash("trading-mysql", "MySQL — Database", ["trading", "mysql"],
         "Connections, throughput, latency, transactions, locks, buffer-pool cache, size and disk. Source: mysqld_exporter, cAdvisor.")
D.var_query("schema", 'label_values(mysql_info_schema_table_size, schema)', "Schema", regex="/^(user_db|order_db|portfolio_db)$/")

D.row("Status")
D.stat("Database status", [('mysql_up', "")], w=4, mappings=UP_DOWN, th=[(None, RED), (1, GREEN)])
D.stat("Uptime", [('mysql_global_status_uptime', "")], w=4, unit="s", th=[(None, BLUE)], color_mode="value")
D.stat("Connections", [('mysql_global_status_threads_connected', "")], w=4, decimals=0, th=[(None, GREEN)], graph=True, color_mode="value")
D.stat("Threads running", [('mysql_global_status_threads_running', "")], w=4, decimals=0, th=[(None, GREEN), (20, ORANGE), (50, RED)], graph=True)
D.stat("Queries/sec", [('rate(mysql_global_status_queries[$__rate_interval])', "")], w=4, decimals=1, unit="ops", color_mode="value", th=[(None, BLUE)], graph=True)
D.stat("Slow queries", [('increase(mysql_global_status_slow_queries[$__range])', "")], w=4, decimals=0, th=[(None, GREEN), (1, ORANGE)], desc="Queries slower than long_query_time (0.5 s).")

D.row("Connections / max connections")
D.gauge("Connection usage", [('100 * mysql_global_status_threads_connected / mysql_global_variables_max_connections', "")], w=4, th=[(None, GREEN), (70, ORANGE), (90, RED)])
D.timeseries("Connections vs max", [
    ('mysql_global_status_threads_connected', "connected"),
    ('mysql_global_status_max_used_connections', "max used (since start)"),
    ('mysql_global_variables_max_connections', "max_connections")], w=10)
D.timeseries("Connection attempts & aborts per sec", [
    ('rate(mysql_global_status_connections[$__rate_interval])', "attempts"),
    ('rate(mysql_global_status_aborted_connects[$__rate_interval])', "aborted connects"),
    ('rate(mysql_global_status_aborted_clients[$__rate_interval])', "aborted clients")], w=10, unit="ops",
    desc="With ProxySQL in front, MySQL sees only the pooled connections from the proxy.")

D.row("Queries")
D.timeseries("Queries / questions per sec", [
    ('rate(mysql_global_status_queries[$__rate_interval])', "queries"),
    ('rate(mysql_global_status_questions[$__rate_interval])', "questions (client)")], w=8, unit="ops")
D.timeseries("Statements per sec by type", [
    ('sum by (command) (rate(mysql_global_status_commands_total{command=~"select|insert|update|delete"}[$__rate_interval]))', "{{command}}")], w=8, unit="ops", stack=True)
D.timeseries("InnoDB row operations per sec", [
    ('rate(mysql_global_status_innodb_rows_read[$__rate_interval])', "read"),
    ('rate(mysql_global_status_innodb_rows_inserted[$__rate_interval])', "inserted"),
    ('rate(mysql_global_status_innodb_rows_updated[$__rate_interval])', "updated"),
    ('rate(mysql_global_status_innodb_rows_deleted[$__rate_interval])', "deleted")], w=8, unit="ops")

D.row("Query latency")
D.timeseries("Average statement latency", [
    ('sum(rate(mysql_perf_schema_events_statements_seconds_total[$__rate_interval])) / sum(rate(mysql_perf_schema_events_statements_total[$__rate_interval]))', "avg latency")],
    w=8, unit="s", minv=0, desc="From performance_schema statement digests (top 100 digests): total time / statement count.")
D.timeseries("Slowest statement digests (avg)", [
    ('topk(5, sum by (digest_text) (rate(mysql_perf_schema_events_statements_seconds_total[$__rate_interval])) / sum by (digest_text) (rate(mysql_perf_schema_events_statements_total[$__rate_interval])))', "{{digest_text}}")],
    w=8, unit="s", legend="bottom")
D.timeseries("Slow queries per sec", [('rate(mysql_global_status_slow_queries[$__rate_interval])', "slow")], w=8, unit="ops", th=[(None, GREEN), (0.01, RED)], minv=0)

D.row("Transactions — commits / rollbacks")
D.timeseries("Commits & rollbacks per sec", [
    ('rate(mysql_global_status_commands_total{command="commit"}[$__rate_interval])', "commit"),
    ('rate(mysql_global_status_commands_total{command="rollback"}[$__rate_interval])', "rollback")], w=12, unit="ops")
D.timeseries("Rollback ratio %", [
    ('100 * rate(mysql_global_status_commands_total{command="rollback"}[$__rate_interval]) / (rate(mysql_global_status_commands_total{command="commit"}[$__rate_interval]) + rate(mysql_global_status_commands_total{command="rollback"}[$__rate_interval]))', "rollback %")],
    w=12, unit="percent", minv=0, th=[(None, GREEN), (5, RED)])

D.row("Locks / deadlocks")
D.stat("Deadlocks (range)", [('sum(increase(mysql_info_schema_innodb_metrics_lock_lock_deadlocks_total[$__range]))', "")], w=4, decimals=0, th=[(None, GREEN), (1, RED)])
D.stat("Row-lock waits now", [('mysql_global_status_innodb_row_lock_current_waits', "")], w=4, decimals=0, th=[(None, GREEN), (1, ORANGE), (10, RED)])
D.stat("Avg row-lock wait", [('mysql_global_status_innodb_row_lock_time_avg / 1000', "")], w=4, unit="s", decimals=3, th=[(None, GREEN), (0.1, ORANGE), (1, RED)])
D.timeseries("Row-lock waits / deadlocks per sec", [
    ('rate(mysql_global_status_innodb_row_lock_waits[$__rate_interval])', "row lock waits"),
    ('rate(mysql_info_schema_innodb_metrics_lock_lock_deadlocks_total[$__rate_interval])', "deadlocks"),
    ('rate(mysql_global_status_table_locks_waited[$__rate_interval])', "table lock waits")], w=12, unit="ops")

D.row("Cache hit ratio (InnoDB buffer pool)")
D.gauge("Buffer-pool hit ratio", [('100 * (1 - rate(mysql_global_status_innodb_buffer_pool_reads[5m]) / rate(mysql_global_status_innodb_buffer_pool_read_requests[5m]))', "")], w=4,
        th=[(None, RED), (90, ORANGE), (99, GREEN)], minv=50)
D.timeseries("Buffer-pool hit ratio %", [('100 * (1 - rate(mysql_global_status_innodb_buffer_pool_reads[$__rate_interval]) / rate(mysql_global_status_innodb_buffer_pool_read_requests[$__rate_interval]))', "hit ratio")], w=10, unit="percent", minv=0, maxv=100)
D.timeseries("Buffer-pool usage", [
    ('mysql_global_status_innodb_buffer_pool_pages_data * mysql_global_status_innodb_page_size', "data"),
    ('mysql_global_status_innodb_buffer_pool_pages_dirty * mysql_global_status_innodb_page_size', "dirty"),
    ('mysql_global_variables_innodb_buffer_pool_size', "pool size")], w=10, unit="bytes")

D.row("Database size & disk")
D.stat("Total data + index", [('sum(mysql_info_schema_table_size{component=~"data_length|index_length", schema=~"$schema"})', "")], w=4, unit="bytes", th=[(None, BLUE)], color_mode="value")
D.bargauge("Size by database", [('sum by (schema) (mysql_info_schema_table_size{component=~"data_length|index_length", schema=~"$schema"})', "{{schema}}")], w=8, unit="bytes")
D.table("Largest tables", [('topk(10, sum by (schema, table) (mysql_info_schema_table_size{component=~"data_length|index_length", schema=~"$schema"}))', "")], w=12, unit="bytes", sort_by="Value",
        transforms=[{"id": "organize", "options": {"excludeByName": {"Time": True}, "renameByName": {"Value": "Size"}}}])
D.timeseries("Database size over time", [('sum by (schema) (mysql_info_schema_table_size{component=~"data_length|index_length", schema=~"$schema"})', "{{schema}}")], w=8, unit="bytes", stack=True)
D.timeseries("Disk I/O (InnoDB data read / written)", [
    ('rate(mysql_global_status_innodb_data_read[$__rate_interval])', "read"),
    ('rate(mysql_global_status_innodb_data_written[$__rate_interval])', "written")], w=8, unit="Bps")
D.timeseries("Container disk, CPU & memory", [
    ('container_fs_usage_bytes{name="mysql"}', "container fs usage"),
    ('container_memory_working_set_bytes{name="mysql"}', "memory working set")], w=8, unit="bytes")
D.timeseries("Network I/O (bytes/sec)", [
    ('rate(mysql_global_status_bytes_received[$__rate_interval])', "received"),
    ('rate(mysql_global_status_bytes_sent[$__rate_interval])', "sent")], w=12, unit="Bps")
D.timeseries("Container CPU (cores)", [('sum(rate(container_cpu_usage_seconds_total{name="mysql"}[$__rate_interval]))', "mysql")], w=12)
D.save("../grafana/dashboards/mysql.json")
