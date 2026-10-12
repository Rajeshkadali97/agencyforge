# AgencyForge v0.2 — Known Limitations

This document covers known gaps, constraints, and workarounds for the RC1 release.

---

## Architecture

### No Horizontal Scaling

AgencyForge runs as a single Node.js process. There is no multi-instance coordination, distributed lock management, or shared state protocol. Running multiple instances against the same SQLite database will cause write conflicts.

**Workaround:** Deploy a single instance. Scale vertically.

**Future:** PostgreSQL adapter + distributed event bus.

---

### SQLite Only

`PersistenceService` uses SQLite via `better-sqlite3`. No PostgreSQL, MySQL, or Redis adapter exists.

**Workaround:** SQLite is suitable for single-node production use. File-based, no additional infrastructure required.

**Future:** Pluggable persistence adapter interface planned post-RC1.

---

### No WebSocket Support

The runtime SSE stream is one-directional (server to client). There is no bidirectional WebSocket channel.

**Workaround:** Client-to-server communication uses REST endpoints (`POST /api/runtime/chat`, `POST /api/runtime/approve`, etc.).

---

## Integration Stubs

Four files in `runtime/src/integrations/` are stub implementations:

| File | External SDK | Status |
|---|---|---|
| `BrowserAgent.ts` | Playwright/Puppeteer | Stub — returns mock data |
| `FrontendCodingAgent.ts` | Cursor/Windsurf API | Stub — not implemented |
| `MeetingAgent.ts` | Meeting SDK | Stub — not implemented |
| `ScrapeGraphAIConnector.ts` | ScrapeGraphAI | Stub — not implemented |

None of these are exported from `runtime/src/index.ts` and none are activated in the production runtime. They are safe to ignore.

**Workaround:** Do not call these integrations. Use the plugin system (Firecrawl, Flowise) for web scraping and workflow needs.

**Future:** Activate integrations when external SDK dependencies are installed and configured.

---

## Observability

### Memory Engine Uses Console Logging

`memory-engine` package emits log output via `console.log` internally. It has no `ILogger` injection interface. These logs are not structured JSON and cannot be correlated with runtime request IDs.

**Workaround:** Memory engine logs appear on stdout alongside structured runtime logs. Filter by source if log aggregation is required.

**Future:** Add `ILogger` injection to memory-engine public API.

---

### OTLP Export Is Best-Effort

`OTLPExporter` flushes completed spans every 30 seconds via `setInterval`. If the process exits uncleanly, the last batch of spans may be lost. There is no shutdown flush on SIGTERM.

**Workaround:** Spans are lost only on unclean exit. Under normal `shutdown()` call the interval is cleared; in-flight spans for the final 30s window are not exported.

**Future:** Add `flush()` call in `RuntimeBootstrap.stop()` before process exit.

---

## Security

### No mTLS

Runtime-to-runtime communication uses no mutual TLS. Bearer token auth covers client-to-runtime calls only.

**Workaround:** Deploy behind a reverse proxy (nginx, Caddy) with TLS termination.

---

### Session Tokens Not Revocable Across Restarts

SSE stream tokens have a 120-second TTL enforced by expiry timestamp. The in-memory JTI replay set is cleared on process restart, meaning a restart within the 120s window could allow token replay.

**Workaround:** 120s TTL limits the replay window to 2 minutes maximum. Acceptable for RC1 use case.

**Future:** Persist JTI set to SQLite for cross-restart replay protection.

---

## AI Providers

### Live API Credentials Required for Revenue Engine

`revenue-engine` package contains adapters for Stripe, Paddle, and Lemon Squeezy. Unit tests mock these adapters. No live integration tests exist.

**Workaround:** Configure credentials in `.env` before enabling revenue features. Test against provider sandbox environments first.

---

### 9Router Not Bundled

9Router (the preferred AI gateway at `localhost:20128`) is a separate process not included in this repository. Without 9Router, `AIService` falls through to the next configured provider (Ollama, OpenRouter, etc.).

**Workaround:** Start 9Router separately or configure at least one direct AI provider API key.

---

## Dashboard

### No Authentication on Dashboard UI

The Next.js dashboard has no login page. Anyone who can reach port 3000 can view the dashboard. Dashboard API calls to the runtime use Bearer auth via server-side API routes, but the UI itself is open.

**Workaround:** Restrict access to port 3000 at the network level (firewall, VPN, reverse-proxy auth).

**Future:** Add optional NextAuth.js session layer.

---

### Voice Assistant Requires Browser Microphone Permission

The voice assistant uses the Web Speech API. It requires user microphone permission and only works in Chromium-based browsers over HTTPS (or localhost).

**Workaround:** Serve the dashboard over HTTPS in production or access via localhost.
