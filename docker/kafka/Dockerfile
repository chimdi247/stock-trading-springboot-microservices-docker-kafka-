# Confluent Kafka (KRaft) + Prometheus JMX exporter as a Java agent.
# The agent exposes broker-level metrics (bytes/messages in/out, request
# latency, under-replicated / offline partitions, ...) on :7071/metrics.
FROM confluentinc/cp-kafka:7.4.0

ARG JMX_EXPORTER_VERSION=1.0.1
USER root

# Create the directory explicitly. If ADD creates it, --chmod=644 is applied to the
# directory too, which removes the execute bit and makes it unreadable for appuser.
RUN mkdir -p /opt/jmx && chmod 755 /opt/jmx

ADD --chmod=644 https://repo1.maven.org/maven2/io/prometheus/jmx/jmx_prometheus_javaagent/${JMX_EXPORTER_VERSION}/jmx_prometheus_javaagent-${JMX_EXPORTER_VERSION}.jar /opt/jmx/jmx_prometheus_javaagent.jar
COPY --chmod=644 jmx-exporter-kafka.yml /opt/jmx/kafka.yml

# Safety net: make sure the directory is traversable after the files are added.
RUN chmod 755 /opt/jmx

USER appuser
