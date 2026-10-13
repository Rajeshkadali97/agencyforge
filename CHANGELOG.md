# Changelog

All notable changes to AgencyForge are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.3.1] — 2026-10-13

### Fixed
- **Accessibility.** An axe-core scan (WCAG 2 A/AA and best practices) of all seven screens now reports 0 violations. Fixed: the unnamed Focus-mode switch (critical, on every page), duplicate landmarks, and heading order on the API Explorer.
- **Rate limit headroom.** The dashboard proxy puts every browser user behind one IP, so the default `RATE_LIMIT_MAX` is now 300 per minute (was 100). Mission polling backs off after the first twenty polls and the overview poll runs every 5 s.
- **Clean shutdown.** The runtime releases the mission database handle when the bridge stops.

### Changed
- GitHub Actions bumped to current majors (checkout 7, setup-node 7, pnpm/action-setup 6, gitleaks-action 3, codeql-action 4), verified by CI.

---

## [0.3.0] — 2026-10-13

### Added
- **Mission persistence.** With `AGENCYFORGE_DB_PATH` set, missions are stored in SQLite and reloaded on start. A mission that was running at shutdown is marked failed ("Interrupted by a runtime restart.").
- **LLM planner.** When a provider is configured the model proposes the task list. Every tool name and argument is validated against the registry, and anything invalid falls back to the rules. Missions record `plannedBy`.
- **Same-origin event stream.** The dashboard proxies the SSE stream and attaches the server-held key, so browsers never call the runtime directly and no CORS setup is needed.
- **Team screen** with every agent, its live tool and a mood preview.
- `docs/GETTING_STARTED.md` with prerequisites, troubleshooting and next steps.
- Seven ready-made thumbnails in `docs/assets/thumbnails`.

### Fixed
- `RUNTIME_PORT` was documented but ignored. The runtime now honours `RUNTIME_PORT` and `HEALTH_PORT`.

---

## [0.2.1] — 2026-10-13

### Fixed
- **Mobile layout.** The sidebar took 250 px of a 390 px phone and left 124 px for content. Below the `lg` breakpoint it is now a slide-in drawer opened from a top bar.
- **Runtime key in the browser.** Mission, API-catalog, routing and stream-token calls now go through server-side proxy routes in the dashboard. `RUNTIME_API_KEY` stays on the server; the `NEXT_PUBLIC_RUNTIME_API_TOKEN` variable is gone.
- **Planner places.** Lowercase places ("weather in paris"), places without a preposition ("Compare Tokyo and Osaka", "visit Kyoto") and lists of places ("Tokyo and Osaka") are now recognised. Technology and company names are not mistaken for places.
- **Docker.** The image installs the native build toolchain, so `better-sqlite3` builds when no prebuilt binary matches. CI now builds both images.

### Added
- Dashboard tests for the runtime proxy (allowlist, key injection, error handling) and mission statistics.

---

## [0.2.0] — 2026-10-13

### Added
- **Missions**: visible `plan → assign → execute → respond` pipeline with stored intermediate results, HTTP API (`/api/runtime/missions`) and `mission.*` events.
- **Built-in agent tools** backed by key-less public APIs: Wikipedia, Open-Meteo, World Bank, Hacker News.
- **API catalog** of 1,700+ public APIs (generated from public-apis, MIT) with search API and the **API Explorer** screen.
- **3D-style vector avatars** for every department, reacting to agent state. No raster assets.
- **Headquarters** rebuilt on real mission data; command palette (Ctrl/Cmd+K); copy-as-Markdown briefs.
- `pnpm doctor` environment check.
- Community files, CI (build, typecheck, test, secret scan, CodeQL), Dependabot, issue and PR templates.

### Changed
- Project renamed to AgencyForge; monorepo Dockerfile builds from the repository root.
- Dashboard navigation lists only working screens; placeholder screens and fabricated sample data removed.
- Character PNG library (28 MB) replaced by generated SVG avatars.

### Fixed
- `better-sqlite3` upgraded for Node 24 prebuilt binaries; native build scripts allow-listed for pnpm 10.
- Runtime declared its `@agencyforge/memory-engine` dependency; memory engine ships CommonJS so Node can load it, and the cognitive memory bridge passes the event bus it requires.
- Nested interactive elements and time-dependent text that caused hydration errors.
- `pnpm start:runtime` now starts the server entry point.
- Removed a Windows-only native package from the dashboard's hard dependencies.

---

## [1.0.0-rc1] — 2026-07-24

### Added

**Core Runtime**
- `RuntimeBridge` — HTTP server (port 3001) with SSE stream, REST endpoints, rate limiting, CORS, bearer auth
- `RuntimeBootstrap` — full lifecycle orchestration: start, stop, executeGoal
- `WorkflowEngine` — DAG-based workflow execution with parallel step support, retry policies, rollback
- `EnhancedEventBus` — wildcard pub/sub with 10k history cap
- `RuntimeCoordinator` — agent registry + workflow orchestration
- `HealthServer` — internal HTTP health server (port 3002, loopback-only)
- `ObservabilityService` — counters, gauges, histograms, trace spans, health checks
- `OTLPExporter` — zero-dependency OTLP HTTP/JSON trace export (Jaeger, Grafana Tempo)
- `PersistenceService` — SQLite event log, env-gated
- `CognitiveMemoryBridge` — dynamic ESM bridge to memory-engine

**AI Routing**
- `AIService` — 7-provider chain with automatic failover (9Router → Ollama → OpenRouter → Gemini → NIM → Anthropic → OpenAI)
- 9Router integration (localhost:20128) as primary AI gateway
- Provider health-checking at request time
- Streaming support with chunked fallback

**Security**
- Bearer token authentication via `RUNTIME_API_KEY` env var
- Short-lived HMAC-SHA256 signed SSE tokens (120s TTL, JTI replay protection)
- `POST /api/runtime/stream-token` endpoint for token exchange
- Rate limiting — per-IP sliding window, configurable max/window
- 6 security headers on all HTTP responses
- 256 KB request body limit
- HealthServer bound to loopback (127.0.0.1)

**Observability**
- Structured JSON logs on stdout
- `X-Request-Id` and `X-Trace-Id` response headers on all HTTP responses
- W3C `traceparent` header propagation
- OTLP export (enabled by `OTEL_EXPORTER_OTLP_ENDPOINT` env var)

**Plugin System**
- `PluginRegistry` — register, activate, invoke, deactivate lifecycle
- 4 plugin manifests: Firecrawl (web.scrape, web.search), Flowise, Paperclip, Research

**Dashboard**
- Next.js 14 SSE-driven live UI
- Real-time agent status, events, heartbeats
- AI routing dashboard (live provider health, request counts)
- Voice assistant wired to `POST /api/runtime/chat`
- Short-lived token exchange before each EventSource connection

**Memory Engine**
- 17 typed memory modules (episodic, semantic, procedural, working, emotional, etc.)
- Provider abstraction: SQLite provider, Cognee provider stub
- Checkpoint/recovery system
- Full-text search (FTS5), vector embeddings, relationship graph

**Testing**
- 270 tests across 4 packages (runtime 116, kernel 59, dashboard 53, memory-engine 42)
- SSE auth tests: signed token exchange, replay protection, open mode
- Security header tests, approve endpoint tests, integration smoke tests

### Fixed
- Approve endpoint event signature bug (`eventBus.publish()` called with 2 args instead of 1 `RuntimeEvent`)
- `HealthServer` binding to all interfaces; now loopback-only
- `OPTIONS` preflight bypassing rate limiter; moved rate check before OPTIONS handler
- `/health` endpoint exposing uptime/connections; now returns `{"status":"ok"}` only
- 500 responses leaking raw `err.message`; now returns `"Internal server error"`
- SSE route match failure when `?token=` query param present
- Memory engine returning `unhealthy` with no providers registered
- ProviderRouter bypassing 9Router via `forceProvider` instead of `preferredProvider`

### Security
- Raw API key in `?token=` query param now rejected (401); only HMAC-signed tokens accepted
- All endpoints except `/health` require authentication when `RUNTIME_API_KEY` is set

---

## [Unreleased]

See `KNOWN_LIMITATIONS.md` for planned improvements.
