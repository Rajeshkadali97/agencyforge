# AgencyForge Production Deployment Guide

## Overview

Step-by-step guide for deploying AgencyForge v0.2 from a fresh clone to a running production system.

---

## Step 1 — Clone and Install

```bash
git clone <repo-url> AgencyForge
cd AgencyForge

# Verify Node.js version (20+ required)
node --version

# Install pnpm if not present
npm install -g pnpm@9

# Install all workspace dependencies
pnpm install --frozen-lockfile
```

---

## Step 2 — Environment Configuration

```bash
cp runtime/.env.example runtime/.env
cp dashboard/.env.example dashboard/.env.local
```

### Runtime `.env` (required fields)

```env
RUNTIME_API_KEY=<generate-strong-secret>
STREAM_TOKEN_SECRET=<generate-with-command-below>
```

### Runtime `.env` (optional fields)

```env
# AI providers — configure at least one
NINE_ROUTER_URL=http://localhost:20128
OLLAMA_URL=http://localhost:11434
OPENROUTER_API_KEY=...
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Persistence
PERSISTENCE_DB_PATH=./data/agencyforge.db

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=agencyforge-runtime

# Ports (defaults shown)
RUNTIME_PORT=3001
HEALTH_PORT=3002
```

### Dashboard `.env.local`

```env
NEXT_PUBLIC_RUNTIME_URL=http://localhost:3001
RUNTIME_BRIDGE_URL=http://localhost:3001
RUNTIME_API_KEY=<same value as runtime>
```

### Generate secrets

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run twice — one value for `RUNTIME_API_KEY`, one for `STREAM_TOKEN_SECRET`.

---

## Step 3 — Production Build

```bash
pnpm build
```

Verify typecheck:

```bash
pnpm typecheck
```

Both must complete with zero errors before proceeding.

---

## Step 4 — Database Initialization

SQLite database is created automatically on first runtime start when `PERSISTENCE_DB_PATH` is set. Pre-create the data directory:

```bash
mkdir -p data
```

No manual schema migration required — `CREATE TABLE IF NOT EXISTS` runs on startup.

---

## Step 5 — Start Runtime

```bash
cd runtime
node dist/index.js
```

Expected startup output:

```
{"level":"info","msg":"RuntimeBridge listening on port 3001"}
{"level":"info","msg":"HealthServer listening on 127.0.0.1:3002"}
{"level":"info","msg":"AgencyForge runtime started"}
```

---

## Step 6 — Verify Health Server

```bash
curl http://localhost:3002/health
```

Expected:

```json
{"status":"ok"}
```

HealthServer is bound to `127.0.0.1` (loopback only). Not externally accessible by design.

---

## Step 7 — Verify Runtime

```bash
curl -H "Authorization: Bearer $RUNTIME_API_KEY" \
  http://localhost:3001/api/runtime/snapshot
```

Expected: `{"dashboard":...,"context":...,"kernel":...,"observability":...}`

---

## Step 8 — Verify SSE Stream

```bash
# Exchange bearer token for a short-lived stream token
TOKEN=$(curl -s -X POST http://localhost:3001/api/runtime/stream-token \
  -H "Authorization: Bearer $RUNTIME_API_KEY" | node -e \
  "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")

# Open SSE stream — expect heartbeat within 30s, Ctrl+C to exit
curl -N "http://localhost:3001/api/runtime/stream?token=$TOKEN"
```

Expected:

```
data: {"type":"heartbeat","timestamp":"..."}
```

---

## Step 9 — Memory Initialization

Memory engine initializes on runtime start. Verify:

```bash
curl -H "Authorization: Bearer $RUNTIME_API_KEY" \
  http://localhost:3001/api/runtime/memory/health
```

`{"status":"healthy"}` or `{"status":"degraded","reason":"no providers"}` (non-fatal at startup).

---

## Step 10 — AI Provider Connectivity

```bash
curl -s -X POST http://localhost:3001/api/runtime/chat \
  -H "Authorization: Bearer $RUNTIME_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"ping"}'
```

Expected: JSON with `content` field. If `{"error":"All AI providers failed"}` — verify at least one provider is configured in `.env`.

---

## Step 11 — Start Dashboard

```bash
cd dashboard

# Production
pnpm build && pnpm start

# Development
pnpm dev
```

Dashboard: `http://localhost:3000`

---

## Step 12 — 9Router Connectivity (Optional)

```bash
# Verify 9Router process is running
curl http://localhost:20128/health

# Verify routing through 9Router
curl -s -X POST http://localhost:3001/api/runtime/chat \
  -H "Authorization: Bearer $RUNTIME_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"test","preferredProvider":"ninerouter"}'
```

---

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | Public | `{"status":"ok"}` |
| GET | `/metrics` | Bearer | CPU, memory, connection stats |
| GET | `/api/runtime/stream?token=<signed>` | Signed token | SSE event stream |
| POST | `/api/runtime/stream-token` | Bearer | Exchange bearer for stream token |
| GET | `/api/runtime/snapshot` | Bearer | Runtime state snapshot |
| GET | `/api/runtime/search?q=` | Bearer | Search shared context |
| GET | `/api/runtime/memory?key=` | Bearer | Read memory key |
| POST | `/api/runtime/memory` | Bearer | Write memory key |
| POST | `/api/runtime/chat` | Bearer | Chat with AI |
| POST | `/api/runtime/approve` | Bearer | Submit workflow approval |
| GET | `/api/ai/routing` | Bearer | AI provider health and metrics |

Auth header: `Authorization: Bearer <RUNTIME_API_KEY>`

SSE stream requires a short-lived signed token from `POST /api/runtime/stream-token`.

---

## Docker Deployment

```bash
docker build -t agencyforge:rc1 .

docker run -d \
  --name agencyforge \
  -p 3001:3001 \
  -e RUNTIME_API_KEY=<secret> \
  -e STREAM_TOKEN_SECRET=<hex> \
  -e ANTHROPIC_API_KEY=<key> \
  -v agencyforge-data:/app/data \
  agencyforge:rc1
```

Health check:

```bash
docker exec agencyforge curl http://localhost:3002/health
```

---

## Production Checklist

- [ ] `RUNTIME_API_KEY` set (min 32 chars, random)
- [ ] `STREAM_TOKEN_SECRET` set (min 32 hex chars, random)
- [ ] At least one AI provider configured
- [ ] Port 3001 behind reverse proxy with TLS
- [ ] Port 3002 blocked from external access
- [ ] Port 3000 access restricted (firewall or auth proxy)
- [ ] SQLite data directory backed up (if `PERSISTENCE_DB_PATH` set)
- [ ] Process manager configured (systemd, PM2, or Docker restart policy)
- [ ] Log aggregation pointed at stdout
- [ ] Health check endpoint monitored (port 3002)
