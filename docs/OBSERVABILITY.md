# AgencyForge Observability

## Overview

AgencyForge emits structured JSON logs and OpenTelemetry-compatible traces. The observability stack is built on zero external runtime dependencies — all tracing uses Node.js built-ins and the internal `ObservabilityService`.

## Structured JSON Logs

Every log line is emitted as a JSON object to stdout:

```json
{
  "level": "info",
  "message": "RuntimeBridge: HTTP server listening on port 3001",
  "timestamp": "2026-07-24T12:00:00.000Z",
  "traceId": "abc123...",
  "spanId": "def456...",
  "component": "RuntimeBridge"
}
```

Redirect stdout to a log aggregator (Loki, Datadog, CloudWatch, etc.) to ingest these.

## Distributed Tracing

### Correlation Headers

Every HTTP response from the RuntimeBridge (port 3001) includes:

| Header | Description |
|--------|-------------|
| `X-Request-Id` | Unique UUID for this request |
| `X-Trace-Id` | Trace ID (from incoming `traceparent` or newly generated) |

Incoming requests may carry a W3C `traceparent` header. When present, AgencyForge extracts the trace ID and propagates it through the request lifecycle.

### Internal Spans

`ObservabilityService` tracks spans via `startTrace` / `endTrace`. Completed spans accumulate in memory and are periodically exported when OTLP export is configured.

## OTLP Export (Jaeger / Grafana Tempo)

Set the `OTEL_EXPORTER_OTLP_ENDPOINT` environment variable to enable trace export:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

AgencyForge POSTs OTLP JSON to `{endpoint}/v1/traces` every 30 seconds. The optional `OTEL_SERVICE_NAME` variable overrides the default service name (`agencyforge-runtime`).

### Export to Jaeger

1. Run Jaeger with the OTLP receiver enabled:

```bash
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest \
  --collector.otlp.enabled=true
```

2. Set env var and start AgencyForge:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
OTEL_SERVICE_NAME=agencyforge-runtime \
node dist/index.js
```

3. Open Jaeger UI at `http://localhost:16686` and select service `agencyforge-runtime`.

### Export to Grafana Tempo

1. Run Grafana + Tempo with the OTLP receiver:

```yaml
# tempo.yaml
server:
  http_listen_port: 3200
distributor:
  receivers:
    otlp:
      protocols:
        http:
          endpoint: 0.0.0.0:4318
```

```bash
docker run -d --name tempo \
  -v $(pwd)/tempo.yaml:/etc/tempo.yaml \
  -p 3200:3200 -p 4318:4318 \
  grafana/tempo:latest \
  -config.file=/etc/tempo.yaml
```

2. Start AgencyForge with the Tempo endpoint:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 node dist/index.js
```

3. In Grafana, add a Tempo data source pointing to `http://localhost:3200` and use the Explore panel to query traces by service name or trace ID.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (unset — export disabled) | OTLP HTTP endpoint base URL |
| `OTEL_SERVICE_NAME` | `agencyforge-runtime` | Service name in traces |

## Span Attributes

Spans include these standard attributes where applicable:

| Attribute | Example Value |
|-----------|---------------|
| `service.name` | `agencyforge-runtime` |
| `http.method` | `POST` |
| `http.url` | `/api/runtime/chat` |
| `http.status_code` | `200` |
| `error` | `true` (on error spans) |
