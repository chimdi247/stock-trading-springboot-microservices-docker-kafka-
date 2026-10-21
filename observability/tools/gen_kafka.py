from dashlib import *
D = Dash("trading-kafka", "Kafka — Broker & Consumers", ["trading", "kafka"],
         "Broker health, replication, throughput, latency, consumer lag and broker resources. Sources: Kafka JMX exporter (java agent), kafka-exporter, cAdvisor.")
D.var_query("topic", 'label_values(kafka_topic_partitions, topic)', "Topic", regex="/^(?!__).*/")
D.var_query("group", 'label_values(kafka_consumergroup_lag, consumergroup)', "Consumer group")

D.row("Broker status")
D.stat("Broker status", [('min(kafka_server_kafkaserver_brokerstate) == bool 3', "")], w=4, mappings=[{"type": "value", "options": {"0": {"text": "NOT RUNNING", "color": "red", "index": 0}, "1": {"text": "RUNNING", "color": "green", "index": 1}}}],
       th=[(None, RED), (1, GREEN)], desc="Broker state 3 = RUNNING (JMX). No data = JMX endpoint unreachable.")
D.stat("Brokers (cluster view)", [('max(kafka_brokers)', "")], w=3, decimals=0, th=[(None, RED), (1, GREEN)])
D.stat("Active controller", [('sum(kafka_controller_kafkacontroller_activecontrollercount)', "")], w=3, decimals=0, th=[(None, RED), (1, GREEN)], desc="Exactly 1 expected.")
D.stat("Under-replicated partitions", [('sum(kafka_server_replicamanager_underreplicatedpartitions)', "")], w=4, decimals=0, th=[(None, GREEN), (1, RED)], desc="Should be 0. >0 means followers are lagging behind the leader.")
D.stat("Offline partitions", [('sum(kafka_controller_kafkacontroller_offlinepartitionscount)', "")], w=4, decimals=0, th=[(None, GREEN), (1, RED)], desc="Should be 0. >0 = partitions with no active leader (unavailable).")
D.stat("Under min-ISR", [('sum(kafka_server_replicamanager_underminisrpartitioncount)', "")], w=3, decimals=0, th=[(None, GREEN), (1, RED)])
D.stat("Topics / Partitions", [('max(kafka_controller_kafkacontroller_globaltopiccount)', "topics"), ('max(kafka_controller_kafkacontroller_globalpartitioncount)', "partitions")], w=3, decimals=0, color_mode="value", th=[(None, BLUE)])
D.timeseries("Under-replicated / offline partitions", [
    ('sum(kafka_server_replicamanager_underreplicatedpartitions)', "under-replicated"),
    ('sum(kafka_controller_kafkacontroller_offlinepartitionscount)', "offline"),
    ('sum(kafka_topic_partition_under_replicated_partition)', "under-replicated (exporter)")], w=12, th=[(None, GREEN), (1, RED)], minv=0)
D.timeseries("ISR shrinks / expands per sec", [
    ('sum(rate(kafka_server_replicamanager_isrshrinkspersec_total[$__rate_interval]))', "shrinks"),
    ('sum(rate(kafka_server_replicamanager_isrexpandspersec_total[$__rate_interval]))', "expands")], w=12, unit="ops")

D.row("Throughput")
D.timeseries("Messages/sec (in)", [('sum(rate(kafka_server_brokertopicmetrics_messagesinpersec_total[$__rate_interval]))', "all topics")], w=8, unit="ops")
D.timeseries("Messages/sec by topic", [('sum by (topic) (rate(kafka_server_brokertopicmetrics_topic_messagesinpersec_total{topic=~"$topic"}[$__rate_interval]))', "{{topic}}")], w=8, unit="ops", stack=True)
D.timeseries("Bytes in / out per sec", [
    ('sum(rate(kafka_server_brokertopicmetrics_bytesinpersec_total[$__rate_interval]))', "bytes in"),
    ('sum(rate(kafka_server_brokertopicmetrics_bytesoutpersec_total[$__rate_interval]))', "bytes out")], w=8, unit="Bps")
D.timeseries("Produce / Fetch requests per sec", [
    ('sum(rate(kafka_network_requestmetrics_requests_total{request="Produce"}[$__rate_interval]))', "Produce"),
    ('sum(rate(kafka_network_requestmetrics_requests_total{request="FetchConsumer"}[$__rate_interval]))', "FetchConsumer"),
    ('sum(rate(kafka_network_requestmetrics_requests_total{request="FetchFollower"}[$__rate_interval]))', "FetchFollower")], w=12, unit="reqps")
D.timeseries("Failed produce / fetch per sec", [
    ('sum(rate(kafka_server_brokertopicmetrics_failedproducerequestspersec_total[$__rate_interval]))', "failed produce"),
    ('sum(rate(kafka_server_brokertopicmetrics_failedfetchrequestspersec_total[$__rate_interval]))', "failed fetch")], w=12, unit="reqps", th=[(None, GREEN), (0.01, RED)], minv=0)

D.row("Latency (Produce / Fetch)")
for req, title in [("Produce", "Produce request latency"), ("FetchConsumer", "Fetch (consumer) latency")]:
    D.timeseries(title + " — total time", [
        (f'max(kafka_network_requestmetrics_totaltimems{{request="{req}", stat="50thPercentile"}})', "p50"),
        (f'max(kafka_network_requestmetrics_totaltimems{{request="{req}", stat="95thPercentile"}})', "p95"),
        (f'max(kafka_network_requestmetrics_totaltimems{{request="{req}", stat="99thPercentile"}})', "p99")], w=6, unit="ms", minv=0)
    D.timeseries(title + " — breakdown (mean)", [
        (f'max(kafka_network_requestmetrics_requestqueuetimems{{request="{req}", stat="Mean"}})', "request queue"),
        (f'max(kafka_network_requestmetrics_localtimems{{request="{req}", stat="Mean"}})', "local (broker)"),
        (f'max(kafka_network_requestmetrics_remotetimems{{request="{req}", stat="Mean"}})', "remote (replication / wait)"),
        (f'max(kafka_network_requestmetrics_responsequeuetimems{{request="{req}", stat="Mean"}})', "response queue"),
        (f'max(kafka_network_requestmetrics_responsesendtimems{{request="{req}", stat="Mean"}})', "response send")], w=6, unit="ms", stack=True, minv=0)

D.row("Consumer lag")
D.stat("Total lag", [('sum(kafka_consumergroup_lag{consumergroup=~"$group", topic=~"$topic"})', "")], w=4, h=5, decimals=0, th=[(None, GREEN), (100, ORANGE), (1000, RED)])
D.timeseries("Consumer lag by group", [('sum by (consumergroup) (kafka_consumergroup_lag{consumergroup=~"$group", topic=~"$topic"})', "{{consumergroup}}")], w=10, h=5, th=[(None, GREEN), (1000, RED)], minv=0)
D.timeseries("Consumer lag by topic", [('sum by (topic) (kafka_consumergroup_lag{consumergroup=~"$group", topic=~"$topic"})', "{{topic}}")], w=10, h=5, minv=0)
D.table("Lag per partition", [('kafka_consumergroup_lag{consumergroup=~"$group", topic=~"$topic"}', "")], w=12, h=7, sort_by="Value",
        transforms=[{"id": "organize", "options": {"excludeByName": {"Time": True, "job": True, "instance": True, "cluster": True}, "renameByName": {"Value": "Lag"}}}])
D.timeseries("Consume rate (messages/sec) by group", [('sum by (consumergroup) (rate(kafka_consumergroup_current_offset{consumergroup=~"$group"}[$__rate_interval]))', "{{consumergroup}}")], w=12, h=7, unit="ops")

D.row("Resources — CPU / Memory / Disk / Network (kafka container + JVM)")
D.timeseries("CPU", [('100 * sum(rate(container_cpu_usage_seconds_total{name="kafka"}[$__rate_interval]))', "CPU % (100 = one core)")], w=6, unit="percent", minv=0)
D.timeseries("Memory", [('container_memory_working_set_bytes{name="kafka"}', "container working set"),
                        ('container_spec_memory_limit_bytes{name="kafka"} > 0', "limit"),
                        ('sum(jvm_memory_used_bytes{job="kafka-jmx", area="heap"})', "JVM heap used")], w=6, unit="bytes")
D.timeseries("Disk", [('sum(kafka_log_size_bytes)', "Kafka log size (all partitions)"),
                      ('container_fs_usage_bytes{name="kafka"}', "container writable layer")], w=6, unit="bytes",
             desc="Kafka log size is measured by the broker itself. Host disk usage: see the Services dashboard (Node).")
D.timeseries("Network", [('sum(rate(container_network_receive_bytes_total{name="kafka"}[$__rate_interval]))', "rx"),
                         ('sum(rate(container_network_transmit_bytes_total{name="kafka"}[$__rate_interval]))', "tx")], w=6, unit="Bps")
D.timeseries("Log size by topic", [('sum by (topic) (kafka_log_size_bytes{topic=~"$topic"})', "{{topic}}")], w=8, unit="bytes", stack=True)
D.timeseries("Handler / network idle %", [('100 * max(kafka_server_requesthandleravgidlepercent)', "request handlers idle"),
                                          ('100 * max(kafka_network_socketserver_networkprocessoravgidlepercent)', "network processors idle")], w=8, unit="percent", minv=0, maxv=100,
             desc="Low idle % = broker saturated.")
D.timeseries("Open file descriptors", [('max(kafka_os_openfiledescriptorcount)', "open"), ('max(kafka_os_maxfiledescriptorcount)', "max")], w=8)
D.save("../grafana/dashboards/kafka.json")
