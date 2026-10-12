# AgencyForge Roadmap

**Current version:** v1.0.0-rc1 (production certified 2026-07-24)

This document supersedes `docs/architecture/15-roadmap.md`, which contains the original post-RC1 item list. Items from that doc are incorporated here with effort estimates and version assignments. The architecture doc is preserved as a historical reference.

Effort estimates are developer-weeks (1 dev, no interruptions).

---

## v1.1 — Stability & Small Improvements

**Theme:** Close the known operational gaps in RC1 without architectural changes. All items are self-contained and can be merged independently.

**Target:** 4–6 weeks after RC1 stabilization period.

---

### 1.1.1 — Graceful shutdown (SIGTERM/SIGINT handlers)

**Debt ref:** TD-H1  
**Effort:** 0.5 weeks  
**Architectural impact:** None — additive signal handler registration

Add to `runtime/src/index.ts`:
```typescript
process.on('SIGTERM', () => bootstrap.stop().then(() => process.exit(0)));
process.on('SIGINT',  () => bootstrap.stop().then(() => process.exit(0)));
```

Ensures SSE connections are closed cleanly, SQLite WAL is flushed, and OTLP traces are submitted on `pm2 stop` / `systemctl stop` / `docker stop`.

---

### 1.1.2 — OTLP flush on shutdown

**Debt ref:** TD-H6  
**Effort:** 0.5 weeks  
**Architectural impact:** None

Call `exporter.flush()` inside `bootstrap.stop()` before process exit. Eliminates the up-to-30s trace loss on clean shutdown.

---

### 1.1.3 — Parallel workflow step failure isolation

**Debt ref:** TD-H3  
**Effort:** 1 week  
**Architectural impact:** Low — changes `WorkflowEngineImpl` only; adds `failurePolicy` field to `WorkflowStep` type

Switch parallel step execution from `Promise.all` to `Promise.allSettled`. Default `fail-fast` preserved for backwards compatibility. New `failurePolicy: 'continue'` opt-in lets surviving steps proceed.

---

### 1.1.4 — JTI persistence across restarts

**Debt ref:** TD-C1  
**Effort:** 1 week  
**Architectural impact:** Low — adds one SQLite table; no API change

Persist used JTI values with expiry timestamps. Sweep expired rows every 60 seconds. Closes the token-replay-after-restart security gap.

---

### 1.1.5 — Improved startup error messages

**Debt ref:** TD-L5  
**Effort:** 0.25 weeks  
**Architectural impact:** None

Re-throw `PersistenceService.initializeDatabase()` errors with a message naming `AGENCYFORGE_DB_PATH` and the fix.

---

### 1.1.6 — handleRetry() cleanup

**Debt ref:** TD-L4  
**Effort:** 0.25 weeks  
**Architectural impact:** None

Remove or rename `handleRetry()` no-op in `WorkflowEngineImpl`. No behavior change.

---

### 1.1.7 — Math.random() to randomUUID() for correlation IDs

**Debt ref:** TD-L2  
**Effort:** 0.25 weeks  
**Architectural impact:** None

Replace `Math.random()` in `EnhancedEventBus.respond()` with `randomUUID()` from `crypto`.

---

**v1.1 total effort: ~4 weeks**

---

## v1.2 — Developer Experience

**Theme:** Make AgencyForge easier to extend, debug, and contribute to. No production behavior changes.

**Target:** 8–12 weeks after v1.1.

---

### 1.2.1 — Delete legacy AI provider stack

**Debt ref:** TD-H5  
**Effort:** 1 week  
**Architectural impact:** Medium — removes `runtime/src/providers/`; audit dashboard imports first

Remove `AIProviderRouter.ts`. Route `GET /api/ai/routing` through `AIService.getProviderHealth()`. Eliminates the two-stack confusion permanently.

---

### 1.2.2 — Merge the two EnhancedEventBus instances

**Debt ref:** TD-H4  
**Effort:** 2 weeks  
**Architectural impact:** Medium — changes `RuntimeCoordinator` constructor; requires event type collision audit

Pass bootstrap bus into `RuntimeCoordinator`. Coordinator events (`workflow.*`, `task.*`) become visible to the dashboard SSE stream and all bootstrap-bus subscribers.

---

### 1.2.3 — ILogger in memory-engine

**Debt ref:** TD-M3  
**Effort:** 1 week  
**Architectural impact:** Low — changes `@agencyforge/memory-engine` constructor signature

Thread `ILogger` into `memory-engine`. Replace all `console.log`. Structured memory-engine logs appear in OTLP traces.

---

### 1.2.4 — SQLiteRuntimeStateStore activation audit

**Debt ref:** TD-M2  
**Effort:** 0.5 weeks  
**Architectural impact:** Low

Trace construction in bootstrap. Add startup log line. Document confirmed behavior in `docs/architecture/09-database-schema.md`.

---

### 1.2.5 — Delete or implement four integration stubs

**Debt ref:** TD-M7  
**Effort:** 0.5 weeks (delete) / 4–8 weeks each (implement)  
**Architectural impact:** None (delete) / High (implement)

Decide: implement or delete `BrowserAgent`, `FrontendCodingAgent`, `MeetingAgent`, `ScrapeGraphAIConnector`. If deleting, remove completely — no stub files.

---

### 1.2.6 — EnhancedEventBus circular buffer

**Debt ref:** TD-L1  
**Effort:** 1 week  
**Architectural impact:** None — internal data structure change only

Replace `history: RuntimeEvent[]` + `shift()` with a circular buffer. O(1) amortized publish at cap.

---

### 1.2.7 — Extension SDK test harness

**Effort:** 2 weeks  
**Architectural impact:** None — test infrastructure only

Add `runtime/src/tests/sdk/` with template tests for the nine extension points. Contributor adding a new agent, plugin, or provider copies a template.

---

**v1.2 total effort: ~8–9 weeks**

---

## v1.5 — Enterprise Features

**Theme:** Authentication, multi-user, WebSocket, horizontal scale foundations, and PostgreSQL.

**Target:** 6–9 months after v1.0.

---

### 1.5.1 — Dashboard authentication

**Debt ref:** TD-M1  
**Effort:** 3 weeks  
**Architectural impact:** Medium — adds NextAuth.js to dashboard; adds bearer token middleware for dashboard API routes

Session-based auth for dashboard pages. Bearer token validation for dashboard API routes. Configured via `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.

---

### 1.5.2 — SQLiteWorkflowStore (persistent workflows)

**Debt ref:** TD-H2  
**Effort:** 3 weeks  
**Architectural impact:** Medium — new `IWorkflowStore` implementation; startup replay logic

Persist `WorkflowExecution` on every state transition. On startup, replay workflows in `running`/`pending` state. Eliminates workflow state loss on restart.

---

### 1.5.3 — WebSocket bidirectional channel

**Debt ref:** TD-M6  
**Effort:** 3 weeks  
**Architectural impact:** Medium — adds WebSocket upgrade handling to `RuntimeBridge`; SSE path preserved

Real-time client-to-runtime commands without polling. SSE path remains for backwards compatibility.

---

### 1.5.4 — PostgreSQL persistence adapters

**Debt ref:** TD-M5  
**Effort:** 4 weeks  
**Architectural impact:** High — new implementations of `PersistenceService` and `SQLiteRuntimeStateStore` interfaces

Implement `PostgreSQLPersistenceService` and `PostgreSQLRuntimeStateStore`. Activated by `DATABASE_URL=postgres://...`. SQLite remains default; PostgreSQL is opt-in. Required for deployments above 10 GB event volume.

---

### 1.5.5 — Multi-tenant agent namespacing

**Effort:** 3 weeks  
**Architectural impact:** High — adds `tenantId` to event payloads, agent metadata, workflow definitions, and all persistence queries

`EnhancedEventBus` routes events to per-tenant subscribers. Multiple isolated tenants on one runtime instance.

---

### 1.5.6 — SSE token in header (not query string)

**Debt ref:** TD-L3  
**Effort:** 2 weeks  
**Architectural impact:** Low — changes SSE connection handshake; requires fetch-based SSE client in dashboard

Move stream token from `?token=` to `X-Stream-Token` header. Eliminates token exposure in access logs. Requires replacing browser `EventSource` with a fetch-based SSE client (EventSource does not support custom headers).

---

### 1.5.7 — Agent capability versioning

**Effort:** 1 week  
**Architectural impact:** Low — changes `AgentCapability` type; updates `findByCapability()` for version ranges

Add semver to capability IDs: `'research@1'`, `'web-scraping@1'`. `findByCapability()` supports version ranges.

---

**v1.5 total effort: ~19 weeks (1 dev) / ~10 weeks (2 devs in parallel)**

---

## v2.0 — Major Platform Evolution

**Theme:** Horizontal scaling, pluggable infrastructure, platform model for third-party extensions.

**Target:** 12–18 months after v1.0. Requires v1.5 as foundation.

---

### 2.0.1 — Redis-backed event bus

**Debt ref:** TD-M4  
**Effort:** 4 weeks  
**Architectural impact:** Very high — `EnhancedEventBus` replaced by Redis pub/sub adapter; same API preserved

Implement `RedisEventBus`. Wildcard matching via Redis pattern subscriptions. Required for horizontal runtime scaling.

---

### 2.0.2 — Redis-backed workflow store

**Effort:** 3 weeks  
**Architectural impact:** Very high — replaces `SQLiteWorkflowStore`; atomic step transitions via Redis MULTI/EXEC

Multiple runtime instances can execute different workflow steps safely.

---

### 2.0.3 — Workflow execution queue

**Effort:** 3 weeks  
**Architectural impact:** High — adds queue layer between submission and `WorkflowEngineImpl`

Configurable `maxConcurrentWorkflows` and `maxConcurrentSteps`. Enables back-pressure, rate limiting, priority queuing.

---

### 2.0.4 — Plugin marketplace / remote plugins

**Effort:** 6 weeks  
**Architectural impact:** Very high — network-capable plugin loader; security model for untrusted plugins

Plugins run as separate processes or remote HTTP services. `PluginRegistry.invoke()` routes transparently. Enables third-party plugin distribution.

---

### 2.0.5 — Agent sandboxing

**Effort:** 6 weeks  
**Architectural impact:** Very high — agents run in isolated worker threads or containers; IPC replaces direct method calls

Prevents one agent's memory leak or crash from affecting the runtime. Required for untrusted or user-supplied agents.

---

### 2.0.6 — Streaming workflow results

**Effort:** 3 weeks  
**Architectural impact:** High — SSE/WebSocket push during workflow execution, not just on completion

Intermediate step results pushed to dashboard in real time. No polling required.

---

### 2.0.7 — Multi-region deployment

**Effort:** 8 weeks  
**Architectural impact:** Very high — requires 2.0.1 + 2.0.2 + 1.5.4

Runtime instances in multiple regions with shared Redis event bus and PostgreSQL. Cross-region SSE routing. Geo-affinity for agent assignment.

---

**v2.0 total effort: ~33 weeks (1 dev) / ~16 weeks (2 devs)**

---

## Effort summary

| Version | Theme | Total effort (1 dev) | Key dependency |
|---|---|---|---|
| v1.1 | Stability | ~4 weeks | RC1 |
| v1.2 | Developer experience | ~8–9 weeks | v1.1 |
| v1.5 | Enterprise features | ~19 weeks | v1.2 |
| v2.0 | Platform evolution | ~33 weeks | v1.5 |

---

## RC1 limitation resolution map

| Limitation (from KNOWN_LIMITATIONS.md) | Resolved in |
|---|---|
| No SIGTERM graceful shutdown | v1.1.1 |
| Workflow state lost on restart | v1.5.2 |
| OTLP no flush on shutdown | v1.1.2 |
| Parallel step failure kills siblings | v1.1.3 |
| JTI replay after restart | v1.1.4 |
| No dashboard auth | v1.5.1 |
| SQLite only | v1.5.4 |
| No WebSocket | v1.5.3 |
| No horizontal scaling | v2.0.1 + v2.0.2 |
| EventBus O(n) shift at 10k | v1.2.6 |
| Token in SSE URL / access logs | v1.5.6 |

---

## Production limits (RC1) — unchanged until v1.5

| Resource | Limit | Set by |
|---|---|---|
| Concurrent AI requests | 10 | `AgentOrchestrator.maxConcurrentTasks` |
| SSE connections | 50 | `RuntimeBridgeConfig.maxConnections` |
| Request body | 1 MB | `maxBodyBytes` |
| Stream duration | 5 min | `BaseAIProvider.streamTimeoutMs` |
| EventBus history | 10k | `EnhancedEventBus.maxHistorySize` |
| Concurrent workflows | ~20 recommended | In-memory DAG |
| SQLite DB size | < 10 GB | `better-sqlite3` perf threshold |
