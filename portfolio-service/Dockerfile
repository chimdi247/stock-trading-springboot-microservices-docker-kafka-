# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────
# portfolio-service  — multi-stage build
#   stage 1: compile with Maven (dependency layer is cached)
#   stage 2: slim JRE + OpenTelemetry Java agent (auto-instrumentation)
# ─────────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml .
# Best-effort dependency pre-fetch so source edits don't re-download the world
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline || true
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -q clean package -Dmaven.test.skip=true

FROM eclipse-temurin:17-jre
ARG OTEL_AGENT_VERSION=2.10.0
ENV SERVER_PORT=8084 \
    JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 1001 --create-home app

# OpenTelemetry Java agent: auto-instruments Spring MVC/WebFlux, JDBC, Kafka,
# Feign/HttpURLConnection, Netty, Lettuce (Redis), logback, JVM metrics ...
# Configured purely through OTEL_* env vars (see docker-compose.yml and
# observability/otel/otel-javaagent.properties).
ADD --chmod=644 https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${OTEL_AGENT_VERSION}/opentelemetry-javaagent.jar /opt/otel/opentelemetry-javaagent.jar

WORKDIR /app
COPY --from=build /build/target/*.jar /app/app.jar
USER app

EXPOSE 8084
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=8 \
  CMD curl -fsS http://localhost:8084/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -javaagent:/opt/otel/opentelemetry-javaagent.jar -jar /app/app.jar"]
