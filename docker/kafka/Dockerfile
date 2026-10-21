# Confluent Kafka (KRaft) + Prometheus JMX exporter as a Java agent.
# The agent exposes broker-level metrics (bytes/messages in/out, request
# latency, under-replicated / offline partitions, ...) on :7071/metrics.
FROM confluentinc/cp-kafka:7.4.0

ARG JMX_EXPORTER_VERSION=1.0.1
USER root
ADD --chmod=644 https://repo1.maven.org/maven2/io/prometheus/jmx/jmx_prometheus_javaagent/${JMX_EXPORTER_VERSION}/jmx_prometheus_javaagent-${JMX_EXPORTER_VERSION}.jar /opt/jmx/jmx_prometheus_javaagent.jar
COPY --chmod=644 jmx-exporter-kafka.yml /opt/jmx/kafka.yml
USER appuser
