# 15 — Future Roadmap

> **Superseded.** `docs/ROADMAP.md` is the authoritative roadmap — it incorporates all items below with effort estimates, version assignments (v1.1/v1.2/v1.5/v2.0), and architectural impact ratings. This file is preserved as a historical reference.

Based on `KNOWN_LIMITATIONS.md`, `docs/archive/PRODUCTION_CERTIFICATION.md`, and RC1 validation phase findings. Ordered by impact.

---

## Post-RC1 (near-term)

### Graceful shutdown

No SIGTERM handler in `index.ts` calls `bootstrap.stop()`. Process exits on signal without draining SSE connections or flushing persistence.

```typescript
process.on('SIGTERM', () => bootstrap.stop().then(() => process.exit(0)));
process.on('SIGINT',  () => bootstrap.stop().then(() => process.exit(0)));
```

Workaround until fixed: use `pm2 --kill-timeout 10000`.

### Workflow persistence

`InMemoryWorkflowStore` loses all workflow state on restart. Implement `SQLiteWorkflowStore` backed by the Persistence DB. Persist `WorkflowExecution` on each state transition; replay on startup.

### OTLP flush on shutdown

Exporter flushes every 30s via interval. Up to 30s of traces lost on clean shutdown. Fix: call `exporter.flush()` in `bootstrap.stop()`.

### Parallel step failure isolation

`Promise.all` on parallel workflow steps — one failure kills all siblings. Switch to `Promise.allSettled` with per-step failure policy.

---

## Scaling (medium-term)

### Redis-backed event bus

Replace `EnhancedEventBus` with a Redis pub/sub adapter. Required for horizontal runtime scaling. Preserve the same `subscribe`/`publish` API.

### Redis-backed workflow store

Implement `RedisWorkflowStore` with the same `IWorkflowStore` interface. Atomic step transitions via Redis transactions.

### PostgreSQL adapters

SQLite degrades above ~10 GB single-writer. Implement `PostgreSQLPersistenceService` and `PostgreSQLRuntimeStateStore` with identical interfaces.

### Dashboard authentication

Add NextAuth.js or similar. Session-based auth for dashboard UI; bearer token for API calls. Currently: must deploy behind nginx + auth proxy.

---

## Architecture improvements (long-term)

### Merge the two event buses

`RuntimeCoordinator` creates its own `EnhancedEventBus` separate from the bootstrap bus. Coordinator events (workflow, task lifecycle) never reach the dashboard.

Fix: pass the bootstrap bus into `RuntimeCoordinator`. Risk: naming collisions on `workflow.*` / `task.*` event types need audit.

### Merge the two AI provider stacks

Remove `runtime/src/providers/AIProviderRouter.ts` (legacy dashboard health). Route `GET /api/ai/routing` through `AIService.healthCheck()` (already implemented — endpoint already calls it).

### Workflow queue

No back-pressure. Add a queue with configurable concurrency limits; `WorkflowEngineImpl` pulls from queue rather than executing inline.

### Agent capability versioning

Capability IDs are unversioned strings. Add semver: `'web-scrape@1'`. `getByCapability()` supports version ranges.

---

## Accepted RC1 limitations

| Limitation | Severity | Workaround |
|---|---|---|
| Single-instance only | High | Vertical scale; document the limit |
| No SIGTERM graceful shutdown | High | `pm2 --kill-timeout 10000` |
| In-memory state lost on crash | Medium | Enable `AGENCYFORGE_DB_PATH` |
| No dashboard auth | Medium | nginx + auth proxy |
| No workflow persistence | Medium | Keep workflows short-lived |
| EventBus O(n) shift at 10k cap | Low | Acceptable at current event rates |
| OTLP no shutdown flush | Low | ≤30s traces lost |
| `?token=` in SSE access logs | Low | HTTPS + log scrubbing |

---

## Production limits (RC1)

| Resource | Limit | Set by |
|---|---|---|
| Concurrent AI requests | 10 | `AgentOrchestrator.maxConcurrentTasks` |
| SSE connections | 50 | `RuntimeBridgeConfig.maxConnections` |
| Request body | 1 MB | `maxBodyBytes` |
| Stream duration | 5 min | `BaseAIProvider.streamTimeoutMs` |
| EventBus history | 10k | `EnhancedEventBus.maxHistorySize` |
| Concurrent workflows | ~20 recommended | In-memory DAG |
| SQLite DB size | < 10 GB | `better-sqlite3` perf threshold |
