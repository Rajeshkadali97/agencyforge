# 11 — Deployment Topology

## Current architecture: single node

AgencyForge is designed for single-instance deployments only. All components run on one host.

```
┌──────────────────────────── Host ─────────────────────────────────┐
│                                                                     │
│  ┌──────────────────┐    ┌────────────────────┐                   │
│  │  Dashboard        │    │  Runtime            │                  │
│  │  Next.js :3000   │───▶│  Node.js :3001     │                  │
│  └──────────────────┘    │                     │                  │
│                           │  HealthServer       │                  │
│  ┌──────────────────┐    │  :3002 (loopback)   │                  │
│  │  Process monitor │───▶│                     │                  │
│  │  (pm2 / systemd) │    └──────────┬──────────┘                  │
│  └──────────────────┘               │                              │
│                           ┌─────────▼──────────┐                  │
│                           │  9Router :20128     │                  │
│                           │  (AI gateway)       │                  │
│                           └─────────┬──────────┘                  │
│                                     │                              │
│                           ┌─────────▼──────────┐                  │
│                           │  Ollama :11434      │                  │
│                           │  (optional local)   │                  │
│                           └────────────────────┘                  │
│                                                                     │
│  ┌─────────────────────────────────────────────┐                  │
│  │  SQLite files                                │                  │
│  │  $AGENCYFORGE_DB_PATH   (persistence DB)     │                  │
│  │  ./runtime_state.db     (state DB)           │                  │
│  └─────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘

External: Anthropic API, OpenAI, Gemini, OpenRouter, NIM (cloud fallbacks via 9Router)
```

---

## Port map

| Port | Service | Binding | Notes |
|---|---|---|---|
| 3000 | Dashboard (Next.js) | `0.0.0.0` | Put behind reverse proxy in prod |
| 3001 | RuntimeBridge | `0.0.0.0` | Primary API; all client traffic |
| 3002 | HealthServer | `127.0.0.1` | Loopback only; process monitor probes |
| 20128 | 9Router | `127.0.0.1` | Internal AI gateway |
| 11434 | Ollama | `127.0.0.1` | Optional local inference |

---

## Recommended hardware

### Minimum (development)
- CPU: 2 cores, RAM: 2 GB, Storage: 20 GB SSD

### Production (up to 50 concurrent users)
- CPU: 4 cores (8 preferred for parallel AI calls)
- RAM: 8 GB (4 GB runtime + 4 GB for co-located 9Router)
- Storage: 100 GB NVMe SSD
- Network: 1 Gbps

---

## Process supervision

### pm2 (recommended)

```js
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'agencyforge-runtime',
      script: 'dist/index.js',
      cwd: './runtime',
      env: { NODE_ENV: 'production', RUNTIME_API_KEY: '...', STREAM_TOKEN_SECRET: '...' },
      max_memory_restart: '4G',
      restart_delay: 5000,
    },
    {
      name: 'agencyforge-dashboard',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: './dashboard',
      env: { NODE_ENV: 'production', PORT: '3000' },
    }
  ]
};
```

### systemd

```ini
[Unit]
Description=AgencyForge Runtime
After=network.target

[Service]
Type=simple
User=agencyforge
WorkingDirectory=/opt/agencyforge/runtime
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
EnvironmentFile=/opt/agencyforge/.env

[Install]
WantedBy=multi-user.target
```

---

## Docker

No official Dockerfile in RC1. Recommended structure:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm --filter @agencyforge/runtime build
EXPOSE 3001
CMD ["node", "runtime/dist/index.js"]
```

Key Docker notes:
- Mount a volume for `AGENCYFORGE_DB_PATH` to persist SQLite across restarts.
- Do **not** expose port 3002 externally — it is loopback-only.
- Use `HEALTHCHECK CMD curl -f http://localhost:3002/health` in Dockerfile.
- Run 9Router as a separate container with `NINE_ROUTER_URL` pointing to it.

---

## Reverse proxy (nginx)

```nginx
location /api/ {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Connection '';   # required for SSE
    proxy_buffering off;              # required for SSE
    proxy_read_timeout 86400s;        # SSE connections are long-lived
}
location / {
    proxy_pass http://localhost:3000; # Next.js dashboard
}
```

`proxy_buffering off` and long `proxy_read_timeout` are critical for SSE.

---

## Scaling path (post-RC1)

Horizontal runtime scaling is **not supported in RC1** — shared in-memory state would diverge across instances.

| Step | What changes | Trigger |
|---|---|---|
| Vertical | More CPU/RAM; `--max-old-space-size=4096` | CPU > 70% sustained |
| Dashboard | Multiple Next.js instances (stateless today) | Traffic |
| Runtime | Redis-backed workflow store + event bus | > 100 concurrent users |
| Database | PostgreSQL adapters for both stores | SQLite write latency > 10ms P99 |
