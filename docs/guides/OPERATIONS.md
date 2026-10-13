# AgencyForge Operations Runbook

## Environment Variables Reference

### Required

| Variable | Description | Example |
|---|---|---|
| `RUNTIME_API_KEY` | Bearer token for all authenticated endpoints | 64-char hex string |
| `STREAM_TOKEN_SECRET` | HMAC signing key for SSE stream tokens | 64-char hex string |

### AI Providers (configure at least one)

| Variable | Description |
|---|---|
| `NINE_ROUTER_URL` | 9Router gateway URL (default: `http://localhost:20128`) |
| `OLLAMA_URL` | Ollama local model URL (default: `http://localhost:11434`) |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `GEMINI_API_KEY` | Google Gemini API key |
| `NIM_API_KEY` | NVIDIA NIM API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |

### Optional

| Variable | Default | Description |
|---|---|---|
| `RUNTIME_PORT` | `3001` | RuntimeBridge HTTP port |
| `HEALTH_PORT` | `3002` | HealthServer port (loopback only) |
| `PERSISTENCE_DB_PATH` | unset (disabled) | SQLite file path |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |
| `RATE_LIMIT_MAX` | `300` | Max requests per window per IP (the dashboard proxy is one IP) |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | unset (disabled) | OTLP trace export endpoint |
| `OTEL_SERVICE_NAME` | `agencyforge-runtime` | Service name in traces |

---

## Backup

### SQLite Database

```bash
sqlite3 $PERSISTENCE_DB_PATH ".backup '/backup/agencyforge-$(date +%Y%m%d).db'"
```

Schedule daily via cron:

```cron
0 2 * * * sqlite3 /app/data/agencyforge.db ".backup '/backup/agencyforge-$(date +\%Y\%m\%d).db'"
```

Retain 30 days:

```bash
find /backup -name "agencyforge-*.db" -mtime +30 -delete
```

### Configuration

```bash
cp runtime/.env /backup/env-$(date +%Y%m%d)
```

---

## Restore

```bash
# Stop runtime
systemctl stop agencyforge

# Restore database
cp /backup/agencyforge-20260724.db /app/data/agencyforge.db

# Restore config
cp /backup/env-20260724 runtime/.env

# Start runtime
systemctl start agencyforge
```

Verify after restore:

```bash
curl http://localhost:3002/health
curl -H "Authorization: Bearer $RUNTIME_API_KEY" http://localhost:3001/api/runtime/status
```

---

## Disaster Recovery

### Process Crash

Process manager (PM2 or systemd) auto-restarts. SQLite WAL mode ensures durability on crash.

Check for corruption after crash:

```bash
sqlite3 $PERSISTENCE_DB_PATH "PRAGMA integrity_check;"
# Expected: ok
```

### Full Host Failure

1. Provision replacement host
2. Install Node.js 20+ and pnpm
3. Clone repository: `pnpm install --frozen-lockfile && pnpm build`
4. Restore `.env` from backup
5. Restore SQLite database from backup
6. Start runtime, verify health

RTO: ~15 minutes with Docker image. ~30 minutes from source.

### Corrupted Database

```bash
# Attempt repair
sqlite3 $PERSISTENCE_DB_PATH ".recover" | sqlite3 /tmp/recovered.db
mv /tmp/recovered.db $PERSISTENCE_DB_PATH

# If unrecoverable, restore from backup
cp /backup/agencyforge-<date>.db $PERSISTENCE_DB_PATH
```

---

## Monitoring

### Health Check

```bash
curl http://localhost:3002/health
# Expected: {"status":"ok"}
```

Monitor every 30 seconds. Alert if non-200 or unexpected body.

### Metrics

```bash
curl -H "Authorization: Bearer $RUNTIME_API_KEY" http://localhost:3001/metrics
```

Returns CPU, memory, active connections, request counts.

### OTLP Tracing (Optional)

```bash
docker run -d --name jaeger \
  -p 16686:16686 -p 4318:4318 \
  jaegertracing/all-in-one:latest
```

Set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`. Traces at `http://localhost:16686`.

---

## Logging

Logs emit to stdout as structured JSON:

```json
{
  "level": "info",
  "msg": "POST /api/runtime/chat 200",
  "requestId": "abc123",
  "traceId": "def456",
  "latencyMs": 42,
  "timestamp": "2026-07-24T00:00:00.000Z"
}
```

Aggregate via systemd journal or pipe to log collector. Use `X-Request-Id` and `X-Trace-Id` response headers to correlate specific requests across log lines and trace spans.

---

## Updating

```bash
cd AgencyForge
git pull
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
systemctl restart agencyforge
curl http://localhost:3002/health
```

---

## Troubleshooting

**Runtime won't start:** Verify `.env` has `RUNTIME_API_KEY` and `STREAM_TOKEN_SECRET`.

**SSE stream 401:** Stream tokens expire after 120s. Re-fetch from `POST /api/runtime/stream-token`.

**All AI providers failing:**
```bash
curl -H "Authorization: Bearer $RUNTIME_API_KEY" http://localhost:3001/api/ai/routing
```
Check which providers show `unhealthy`. Verify API keys and provider availability.

**Memory engine degraded:** Non-fatal. No memory providers configured. Check stdout for memory-engine logs.

**SQLite locked:**
```bash
fuser $PERSISTENCE_DB_PATH
```
Another process holds the write lock. Identify and stop it.

---

## Scaling

AgencyForge v0.2 is single-instance. Vertical options:

```bash
NODE_OPTIONS=--max-old-space-size=4096 node dist/index.js
```

For horizontal scaling limitations, see `KNOWN_LIMITATIONS.md`.
