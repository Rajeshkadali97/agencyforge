# AgencyForge Technical Debt Register

**As of RC1 (2026-07-24).** Sources: KNOWN_LIMITATIONS.md, docs/archive/PRODUCTION_CERTIFICATION.md section 4, validation phase findings (V-01–V-10), and fresh code audit. All 10 validation-phase bugs are fixed and documented in docs/archive/PRODUCTION_CERTIFICATION.md — they are not repeated here, but where they reveal structural patterns those patterns are captured.

Do not implement changes from this document without a corresponding PR and test plan.

---

## Priority key

| Priority | Meaning |
|---|---|
| Critical | Data loss, security breach, or crash under normal use |
| High | Significant operational risk; workaround exists but is fragile |
| Medium | Material quality issue; workaround is stable |
| Low | Minor issue; no user-visible impact at current load |

---

## Critical

### TD-C1 — JTI replay protection cleared on restart

**Location:** `runtime/src/bridge/StreamTokenManager.ts`

**Symptom:** Used JTI values are stored in an in-process `Set`. On restart, the Set clears. A stream token issued moments before a crash or restart remains valid for up to 120 seconds post-restart and can be replayed to open an unauthorized SSE connection.

**Scope:** Any party that intercepts a valid stream token during the 120-second window surrounding a restart can replay it.

**Workaround:** Keep `STREAM_TOKEN_SECRET` rotation tight; restart windows are brief in normal operation.

**Fix:** Persist JTI values in SQLite with an `expires_at` column (`issued_at + 120s`). Sweep expired rows at a cleanup interval. Alternatively: include a `server_start_at` claim in each token and reject tokens issued before the current process start time.

---

## High

### TD-H1 — No SIGTERM / SIGINT graceful shutdown

**Location:** `runtime/src/index.ts`

**Symptom:** No signal handlers registered. `pm2 stop`, `systemctl stop`, and `docker stop` send SIGTERM — the process exits immediately without draining SSE connections, flushing OTLP traces, or completing SQLite WAL sync.

**Workaround:** `pm2 --kill-timeout 10000` buys 10s before SIGKILL, but `bootstrap.stop()` never executes.

**Fix:**
```typescript
process.on('SIGTERM', () => bootstrap.stop().then(() => process.exit(0)));
process.on('SIGINT',  () => bootstrap.stop().then(() => process.exit(0)));
```

---

### TD-H2 — InMemoryWorkflowStore — all state lost on restart

**Location:** `runtime/src/workflow/InMemoryWorkflowStore.ts`

**Symptom:** All running and pending workflow state lives in-process. A crash or restart drops every workflow mid-execution with no recovery path.

**Workaround:** Keep workflows short-lived; design them to be idempotent and re-triggered externally.

**Fix:** Implement `SQLiteWorkflowStore` with the same `IWorkflowStore` interface. Persist `WorkflowExecution` on every state transition. Replay incomplete executions on startup.

---

### TD-H3 — Parallel workflow steps: one failure kills all siblings

**Location:** `runtime/src/workflow/WorkflowEngineImpl.ts`

**Symptom:** Parallel step groups use `Promise.all`. One step failure rejects the entire group, cancelling all sibling steps mid-execution.

**Workaround:** Design parallel groups to be independent and idempotent.

**Fix:** Switch to `Promise.allSettled`. Add a `failurePolicy: 'fail-fast' | 'continue'` field to `WorkflowStep`. Default to `'fail-fast'` for backwards compatibility.

---

### TD-H4 — Two isolated EnhancedEventBus instances

**Location:** `runtime/src/kernel/RuntimeCoordinator.ts`

**Symptom:** `RuntimeCoordinator` constructs its own `EnhancedEventBus` separate from the bootstrap bus. Coordinator events (`workflow.*`, `task.*` lifecycle) never reach the bootstrap bus — invisible to the dashboard SSE stream, MemoryBinding, and any subscriber wired to bootstrap.

**Workaround:** Dashboard relies on `RuntimeBridge` for the events it directly receives. Subscribers on the bootstrap bus miss coordinator events.

**Fix:** Pass the bootstrap bus into `RuntimeCoordinator` constructor. Audit `workflow.*` / `task.*` event type names for collisions before merging.

---

### TD-H5 — Legacy AI provider stack is dead code

**Location:** `runtime/src/providers/AIProviderRouter.ts`

**Symptom:** `GET /api/ai/routing` already calls `AIService.healthCheck()` (primary stack). `AIProviderRouter` in `runtime/src/providers/` is initialized and held in memory but performs no inference. New contributors may add inference providers to the wrong stack.

**Workaround:** Documented clearly in `docs/architecture/01-system-overview.md`.

**Fix:** Delete `runtime/src/providers/AIProviderRouter.ts`. Confirm no dashboard code directly imports it first.

---

### TD-H6 — OTLP exporter does not flush on shutdown

**Location:** `runtime/src/observability/` (OTLP exporter)

**Symptom:** OTLP exporter flushes every 30s via setInterval. On clean shutdown, the interval clears but `exporter.flush()` is never called. Up to 30s of traces are lost on every restart.

**Workaround:** Accept trace loss; operational impact is low.

**Fix:** Call `exporter.flush()` in `bootstrap.stop()`.

---

## Medium

### TD-M1 — No dashboard authentication layer

**Location:** `dashboard/` — no auth middleware

**Symptom:** All dashboard pages and API routes are publicly accessible to any network peer who can reach port 3000.

**Workaround:** Deploy behind nginx + auth proxy (Cloudflare Access, Authelia, `nginx auth_basic`). Documented in `docs/architecture/11-deployment-topology.md`.

**Fix:** Add NextAuth.js or similar. Session auth for pages; bearer token validation for dashboard API routes.

---

### TD-M2 — SQLiteRuntimeStateStore activation path unclear

**Location:** `runtime/src/state/SQLiteRuntimeStateStore.ts`

**Symptom:** Construction path is ambiguous in RC1 — the store may not be activated by default. Nine state tables (projects, tasks, workflows, agents, notifications, voice_states, character_states, research_jobs, revenue_jobs) may be written to without being read by any consumer.

**Workaround:** Verify activation in bootstrap before using.

**Fix:** Audit `RuntimeBootstrap.ts` to confirm the store is wired. Add a startup log line confirming initialization.

---

### TD-M3 — memory-engine uses console.log instead of ILogger

**Location:** `memory-engine/src/`

**Symptom:** `@agencyforge/memory-engine` uses `console.log` directly. Logs are not structured, not routable to the OTLP exporter, and cannot be silenced in tests.

**Fix:** Thread an `ILogger` instance into `memory-engine` at construction. Replace all `console.log` with `this.logger.info/error/warn`.

---

### TD-M4 — No horizontal scaling (architectural limit)

**Location:** Entire runtime stack

**Symptom:** `EnhancedEventBus`, `InMemoryWorkflowStore`, `AgentOrchestrator`, and `PluginRegistry` are in-process singletons. Two runtime instances diverge immediately.

**Workaround:** Run one instance; scale vertically.

**Fix (roadmap v1.5/v2.0):** Redis-backed event bus + workflow store; PostgreSQL persistence adapters. See `docs/ROADMAP.md`.

---

### TD-M5 — SQLite only — no PostgreSQL adapter

**Location:** `PersistenceService`, `SQLiteRuntimeStateStore`

**Symptom:** Both persistence layers are SQLite-only. SQLite degrades above ~10 GB single-writer and cannot be shared across processes.

**Workaround:** Adequate for less than 1M events/day and single-instance deployments.

**Fix (roadmap v1.5):** Implement `PostgreSQLPersistenceService` and `PostgreSQLRuntimeStateStore` with identical interfaces.

---

### TD-M6 — No WebSocket support

**Location:** `runtime/src/bridge/RuntimeBridge.ts`

**Symptom:** Client-to-runtime communication is HTTP-only (REST + SSE). No bidirectional channel. Real-time client-initiated commands require separate HTTP calls.

**Fix (roadmap v1.5):** Add WebSocket upgrade handling alongside the existing HTTP server. Preserve SSE path for backwards compatibility.

---

### TD-M7 — Four integration stubs not exported or activated

**Locations:**
- `runtime/src/agent/impl/BrowserAgent.ts`
- `runtime/src/agent/impl/FrontendCodingAgent.ts`
- `runtime/src/agent/impl/MeetingAgent.ts`
- `runtime/src/plugins/manifests/ScrapeGraphAIConnector.ts`

**Symptom:** Files exist but are not exported from their package index and not activated in bootstrap. Appear functional from the outside but have no real implementation.

**Fix:** Either implement fully or delete. Dead stubs with no activation path create confusion.

---

## Low

### TD-L1 — EnhancedEventBus history cap O(n) shift

**Location:** `runtime/src/events/EnhancedEventBus.ts`

**Symptom:** At the 10,000-event cap, `Array.shift()` moves ~10k elements per event publish.

**Workaround:** Cap limits exposure; acceptable at current event rates.

**Fix:** Replace the array with a circular buffer. No API change needed.

---

### TD-L2 — Math.random() used for event correlation IDs

**Location:** `runtime/src/events/EnhancedEventBus.ts` (`respond()`)

**Symptom:** Correlation IDs generated via `Math.random()`. Not cryptographically random. Theoretical collision risk only — not a security issue in the current pattern.

**Fix:** Replace with `randomUUID()` from `crypto` (already imported elsewhere in runtime).

---

### TD-L3 — SSE stream token visible in access logs

**Location:** `runtime/src/bridge/RuntimeBridge.ts`

**Symptom:** Tokens passed as `?token=<value>` in SSE URL. Web server access logs capture query strings. Token valid for 120s from issue.

**Workaround:** HTTPS + log scrubbing. Documented in DEPLOYMENT.md.

**Fix:** Move token to a custom header (`X-Stream-Token`). Note: browser `EventSource` API does not support custom headers — requires a polyfill or fetch-based SSE client on the dashboard side.

---

### TD-L4 — handleRetry() no-op looks like a bug

**Location:** `runtime/src/workflow/WorkflowEngineImpl.ts`

**Symptom:** `handleRetry()` always returns `false`. Actual retry logic is in `executeWithRetry()`. The no-op method is intentional but looks like an unimplemented stub. Documented in `docs/architecture/14-contribution-guide.md`.

**Fix:** Rename to `_legacyNoOpRetry()` or remove it. Add a comment explaining why the method exists if kept.

---

### TD-L5 — Unhelpful startup error on bad AGENCYFORGE_DB_PATH

**Location:** `runtime/src/persistence/PersistenceService.ts`

**Symptom:** If the directory for `AGENCYFORGE_DB_PATH` does not exist or is not writable, the runtime crashes with a generic file system error that does not mention the env var or how to fix it.

**Fix:** Catch the initialization error and re-throw with: `"PersistenceService: AGENCYFORGE_DB_PATH directory is not writable. Create it and ensure write access."`.

---

## Summary table

| ID | Priority | Component | One-line |
|---|---|---|---|
| TD-C1 | Critical | StreamTokenManager | JTI replay set cleared on restart |
| TD-H1 | High | index.ts | No SIGTERM graceful shutdown |
| TD-H2 | High | InMemoryWorkflowStore | Workflow state lost on restart |
| TD-H3 | High | WorkflowEngineImpl | Parallel step failure kills siblings |
| TD-H4 | High | RuntimeCoordinator | Two event buses — coordinator events invisible |
| TD-H5 | High | AIProviderRouter | Dead legacy AI stack is live dead code |
| TD-H6 | High | Observability | OTLP traces lost on clean shutdown |
| TD-M1 | Medium | Dashboard | No auth layer |
| TD-M2 | Medium | SQLiteRuntimeStateStore | Activation path unclear |
| TD-M3 | Medium | memory-engine | Uses console.log not ILogger |
| TD-M4 | Medium | Architecture | No horizontal scaling |
| TD-M5 | Medium | Persistence | SQLite only |
| TD-M6 | Medium | RuntimeBridge | No WebSocket |
| TD-M7 | Medium | Stubs | Four dead stubs not exported or activated |
| TD-L1 | Low | EnhancedEventBus | O(n) shift at 10k cap |
| TD-L2 | Low | EnhancedEventBus | Math.random() correlation IDs |
| TD-L3 | Low | RuntimeBridge | SSE token in query string |
| TD-L4 | Low | WorkflowEngineImpl | handleRetry() no-op looks like bug |
| TD-L5 | Low | PersistenceService | Unhelpful startup error message |
