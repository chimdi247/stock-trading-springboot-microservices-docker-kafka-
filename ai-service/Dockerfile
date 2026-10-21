FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
 # Install the auto-instrumentation packages that match what is installed
 # (FastAPI/Starlette, httpx, logging, ...).
 && opentelemetry-bootstrap -a install

COPY main.py .

EXPOSE 8086
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fsS http://localhost:8086/health || exit 1

# `opentelemetry-instrument` wraps the process and wires traces/metrics/logs
# using the OTEL_* environment variables set in docker-compose.yml.
CMD ["opentelemetry-instrument", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8086"]
