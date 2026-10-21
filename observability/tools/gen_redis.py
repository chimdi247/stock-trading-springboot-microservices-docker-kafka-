from dashlib import *
D = Dash("trading-redis", "Redis — Price Cache", ["trading", "redis"],
         "Key Redis health, memory, throughput, hit rate and eviction metrics. Source: redis_exporter.")

D.row("Overview")
D.stat("Redis status", [('redis_up', "")], w=4, mappings=UP_DOWN, th=[(None, RED), (1, GREEN)])
D.stat("Uptime", [('redis_uptime_in_seconds', "")], w=4, unit="s", th=[(None, BLUE)], color_mode="value")
D.stat("Connected clients", [('redis_connected_clients', "")], w=4, decimals=0, th=[(None, GREEN)], graph=True, color_mode="value")
D.stat("Ops/sec", [('rate(redis_commands_processed_total[$__rate_interval])', "")], w=4, unit="ops", decimals=1, th=[(None, BLUE)], graph=True, color_mode="value")
D.stat("Hit rate", [('100 * rate(redis_keyspace_hits_total[5m]) / (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m]))', "")], w=4, unit="percent", decimals=1, th=[(None, RED), (80, ORANGE), (95, GREEN)])
D.stat("Total keys", [('sum(redis_db_keys)', "")], w=4, decimals=0, th=[(None, BLUE)], color_mode="value")

D.row("Memory")
D.gauge("Memory used / max", [('100 * redis_memory_used_bytes / redis_memory_max_bytes', "")], w=4, th=[(None, GREEN), (70, ORANGE), (90, RED)], desc="maxmemory = 128 MB (docker/redis/redis.conf).")
D.timeseries("Memory", [('redis_memory_used_bytes', "used"), ('redis_memory_max_bytes', "maxmemory"), ('container_memory_working_set_bytes{name="redis"}', "container working set")], w=10, unit="bytes")
D.timeseries("Fragmentation ratio", [('redis_mem_fragmentation_ratio', "fragmentation")], w=5, minv=0, th=[(None, GREEN), (1.5, ORANGE), (2, RED)])
D.timeseries("Evicted / expired keys per sec", [('rate(redis_evicted_keys_total[$__rate_interval])', "evicted"), ('rate(redis_expired_keys_total[$__rate_interval])', "expired")], w=5, unit="ops")

D.row("Throughput & efficiency")
D.timeseries("Commands/sec", [('rate(redis_commands_processed_total[$__rate_interval])', "ops/sec")], w=8, unit="ops")
D.timeseries("Commands/sec by command (top 8)", [('topk(8, sum by (cmd) (rate(redis_commands_total[$__rate_interval])))', "{{cmd}}")], w=8, unit="ops", stack=True)
D.timeseries("Keyspace hits vs misses per sec", [('rate(redis_keyspace_hits_total[$__rate_interval])', "hits"), ('rate(redis_keyspace_misses_total[$__rate_interval])', "misses")], w=8, unit="ops")
D.timeseries("Avg command latency", [('sum(rate(redis_commands_duration_seconds_total[$__rate_interval])) / sum(rate(redis_commands_total[$__rate_interval]))', "avg")], w=8, unit="s", minv=0)
D.timeseries("Avg latency by command (top 5)", [('topk(5, sum by (cmd) (rate(redis_commands_duration_seconds_total[$__rate_interval])) / sum by (cmd) (rate(redis_commands_total[$__rate_interval])))', "{{cmd}}")], w=8, unit="s", minv=0)
D.timeseries("Slowlog length", [('redis_slowlog_length', "entries")], w=8, minv=0)

D.row("Clients, network, CPU")
D.timeseries("Clients", [('redis_connected_clients', "connected"), ('redis_blocked_clients', "blocked")], w=6)
D.timeseries("Rejected connections / sec", [('rate(redis_rejected_connections_total[$__rate_interval])', "rejected")], w=6, unit="ops", th=[(None, GREEN), (0.001, RED)], minv=0)
D.timeseries("Network I/O", [('rate(redis_net_input_bytes_total[$__rate_interval])', "in"), ('rate(redis_net_output_bytes_total[$__rate_interval])', "out")], w=6, unit="Bps")
D.timeseries("CPU", [('rate(redis_cpu_user_seconds_total[$__rate_interval])', "user"), ('rate(redis_cpu_sys_seconds_total[$__rate_interval])', "sys"),
                     ('sum(rate(container_cpu_usage_seconds_total{name="redis"}[$__rate_interval]))', "container")], w=6, unit="percentunit")
D.timeseries("Keys per database", [('redis_db_keys', "db{{db}}"), ('redis_db_keys_expiring', "expiring db{{db}}")], w=12)
D.timeseries("Persistence / fork", [('redis_rdb_last_save_timestamp_seconds', "last RDB save (ts)"), ('redis_latest_fork_usec / 1e6', "latest fork (s)")], w=12)
D.save("../grafana/dashboards/redis.json")
