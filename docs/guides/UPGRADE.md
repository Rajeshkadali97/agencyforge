# AgencyForge Upgrade Guide

## Installing v0.2

### Prerequisites

- Node.js 20+
- pnpm 9+
- SQLite 3 (bundled via `better-sqlite3`)
- 9Router running on `localhost:20128` (optional but recommended as AI gateway)

### Fresh Install

```bash
git clone <repo-url> AgencyForge
cd AgencyForge
pnpm install
pnpm build
```

### Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required:

```env
RUNTIME_API_KEY=<your-secret-key>   # Bearer auth for all runtime endpoints
STREAM_TOKEN_SECRET=<random-256-bit> # HMAC signing key for SSE tokens
```

Optional:

```env
# AI providers (at least one required for AI features)
NINE_ROUTER_URL=http://localhost:20128
OLLAMA_URL=http://localhost:11434
OPENROUTER_API_KEY=...
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...

# SQLite persistence (omit to disable)
PERSISTENCE_DB_PATH=./data/agencyforge.db

# OTLP tracing (omit to disable)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=agencyforge-runtime

# Ports (defaults shown)
RUNTIME_PORT=3001
HEALTH_PORT=3002
```

### Generate STREAM_TOKEN_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Start Runtime

```bash
cd runtime
pnpm start
```

Verify:

```bash
curl http://localhost:3002/health
# {"status":"ok"}

curl -H "Authorization: Bearer $RUNTIME_API_KEY" http://localhost:3001/api/runtime/status
# {"status":"running",...}
```

### Start Dashboard

```bash
cd dashboard
pnpm dev      # development
pnpm build && pnpm start   # production
```

Dashboard available at `http://localhost:3000`.

---

## Upgrading from Prior Versions

There are no prior stable releases. This is v0.2 (alpha).

---

## Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
EXPOSE 3001 3002
CMD ["node", "runtime/dist/index.js"]
```

Build and run:

```bash
docker build -t agencyforge:rc1 .
docker run -p 3001:3001 -p 3002:3002 \
  -e RUNTIME_API_KEY=secret \
  -e STREAM_TOKEN_SECRET=<hex> \
  agencyforge:rc1
```

---

## Verifying the Install

```bash
# Health check
curl http://localhost:3002/health

# Token exchange
TOKEN=$(curl -s -X POST http://localhost:3001/api/runtime/stream-token \
  -H "Authorization: Bearer $RUNTIME_API_KEY" | jq -r .token)

# SSE stream (should receive heartbeat within 30s)
curl -N "http://localhost:3001/api/runtime/stream?token=$TOKEN"
```
