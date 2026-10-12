# AgencyForge Developer Handbook

**Get productive within one day.** This handbook is the practical entry point. It does not duplicate reference docs in `docs/architecture/` — it links to them.

---

## What is AgencyForge?

TypeScript/Node.js pnpm monorepo orchestrating AI agents for business workflows. Connects a local AI gateway (9Router), a Next.js dashboard, and a runtime that manages agents, workflows, memory, and event streaming.

**Five things to know before writing a line:**

1. Subsystems communicate exclusively via `EnhancedEventBus`. Never call across subsystems directly.
2. Two AI stacks exist: real inference in `runtime/src/ai/`; legacy dashboard health display in `runtime/src/providers/`. Do not add inference to the legacy stack.
3. All HTTP handlers must be sync outer + async inner. No `async requestHandler` passed to `http.createServer`.
4. Every timer handle must be stored and cleared in `stop()`/`dispose()`.
5. `pnpm --filter @agencyforge/runtime tsc --noEmit` must stay clean. That is the gate.

---

## Prerequisites

- Node.js 20 LTS
- pnpm 9 (`npm install -g pnpm`)
- 9Router running at `localhost:20128` (or set `NINE_ROUTER_URL`)
- Optional: Ollama at `localhost:11434` for local inference

---

## Setup from zero

```bash
git clone <repo> && cd AgencyForge
pnpm install
cp .env.example .env           # fill in RUNTIME_API_KEY, STREAM_TOKEN_SECRET
pnpm build                     # build all packages
pnpm --filter @agencyforge/runtime tsc --noEmit
pnpm --filter @agencyforge/runtime test          # 116 tests, 3 intentional skips
```

**Start development servers:**

```bash
# Terminal 1
pnpm --filter @agencyforge/runtime dev

# Terminal 2
pnpm --filter agencyforge-dashboard dev
```

Runtime: `http://localhost:3001` | Dashboard: `http://localhost:3000` | Health: `http://localhost:3002/health` (loopback only)

---

## Day 1 checklist

- [ ] `pnpm test` passes
- [ ] `tsc --noEmit` clean
- [ ] `GET http://localhost:3002/health` returns `{"status":"healthy"}`
- [ ] Dashboard loads at `http://localhost:3000`
- [ ] Read `docs/architecture/01-system-overview.md`
- [ ] Read `docs/architecture/02-runtime-lifecycle.md` (startup order)
- [ ] Read `docs/architecture/03-event-system.md` (how subsystems talk)
- [ ] Read `docs/architecture/14-contribution-guide.md` (PR checklist + GateGuard hook)

---

## Repo structure

```
AgencyForge/
├── runtime/                  # @agencyforge/runtime — Node.js AI orchestration core
│   └── src/
│       ├── ai/               # AI providers + AIService (PRIMARY STACK)
│       ├── agent/            # IAgentRuntime, BaseAgent, AgentOrchestrator
│       ├── bindings/         # Memory, Character, Voice, Dashboard bindings
│       ├── bridge/           # RuntimeBridge HTTP server + SSE (port 3001)
│       ├── contracts/        # RuntimeEvent types, createRuntimeEvent(), RuntimeEventTypes
│       ├── events/           # EnhancedEventBus
│       ├── health/           # HealthServer (port 3002), HealthManager
│       ├── kernel/           # RuntimeKernel, RuntimeCoordinator
│       ├── persistence/      # PersistenceService (SQLite WAL)
│       ├── plugins/          # PluginRegistry, plugin manifests
│       ├── providers/        # LEGACY AI stack — dashboard health display ONLY
│       ├── state/            # SQLiteRuntimeStateStore
│       ├── tests/            # Vitest test suite
│       └── workflow/         # WorkflowEngineImpl, InMemoryWorkflowStore
├── dashboard/                # agencyforge-dashboard — Next.js 15.1 frontend
├── kernel/                   # @agencyforge/kernel — shared interfaces
├── memory-engine/            # @agencyforge/memory-engine — SQLite long-term memory
├── research/                 # @agencyforge/research — research domain package
└── revenue-engine/           # @agencyforge/revenue-engine — revenue domain package
```

Full package dependency graph: `docs/architecture/01-system-overview.md`.

---

## Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Files | kebab-case | `research-agent.ts` |
| Classes | PascalCase | `ResearchAgent` |
| Interfaces | `I` + PascalCase | `IAgentRuntime` |
| Event types | `namespace.event` (dot) | `task.completed` |
| Plugin capabilities | `namespace.action` (dot) | `web.scrape` |
| Agent IDs | `agent.name` (dot) | `agent.research` |
| Env vars | `SCREAMING_SNAKE_CASE` | `RUNTIME_API_KEY` |
| Test files | `{component}.test.ts` | `workflow-engine.test.ts` |

---

## Folder conventions

- One class per file; file name is kebab-case of class name.
- `index.ts` re-exports public API only; internal files not imported from outside the directory.
- Circular imports forbidden — extract shared types to a third file.
- Env vars checked at first use, not at startup.
- New agents: `runtime/src/agent/impl/`
- New plugins: `runtime/src/plugins/manifests/`
- New AI providers: `runtime/src/ai/providers/`

---

## Development workflow

### Making a change

1. Read the relevant doc in `docs/architecture/` for the subsystem.
2. Check `docs/architecture/12-extension-points.md` — prefer extending over modifying core.
3. Make the change. Run `tsc --noEmit`. Run `pnpm test`.
4. Add a test for new behavior in `runtime/src/tests/`.

### Adding a subsystem

Nine documented extension points exist: AI providers, plugins, agents, event subscribers, health checks, bindings, workflow steps, observability exporters, scheduled jobs. All have zero-impact registration paths.

See `docs/architecture/12-extension-points.md` and `docs/SDK.md`.

### Before committing

Full PR checklist: `docs/architecture/14-contribution-guide.md`. Key items:

- `tsc --noEmit` clean
- `pnpm test` passes (116+, 3 intentional skips allowed)
- No new `any` types, no empty catch blocks
- Timer handles stored and cleared in `stop()`/`dispose()`
- New HTTP handlers: sync outer + async `_handle()` inner
- New events via `createRuntimeEvent()` + `RuntimeEventTypes` constants
- New env vars documented in `docs/architecture/02-runtime-lifecycle.md`

---

## Coding standards summary

Full standards: `docs/architecture/13-coding-standards.md`. Most commonly violated:

**Error handling — no silent swallows:**
```typescript
catch (err) {
  this.logger.error('ComponentName: context', {
    error: err instanceof Error ? err.message : String(err),
  });
}
```

**Events — always use factory:**
```typescript
this.eventBus.publish(createRuntimeEvent(
  RuntimeEventTypes.TASK_COMPLETED,
  { taskId, agentId, output, durationMs },
  traceId, spanId,
));
```

**Async HTTP handlers:**
```typescript
// Wrong
http.createServer(async (req, res) => { ... })

// Right
http.createServer((req, res) => { this._handle(req, res).catch(err => { ... }); })
private async _handle(req: IncomingMessage, res: ServerResponse) { ... }
```

**Env vars:**
```typescript
process.env['RUNTIME_API_KEY']  // correct bracket notation
```

---

## Debugging guide

### Runtime won't start

1. Check `RUNTIME_API_KEY` and `STREAM_TOKEN_SECRET` are set.
2. Check `AGENCYFORGE_DB_PATH` directory is writable (`PersistenceService` throws on startup if not).
3. Check ports 3001 and 3002 are free.
4. `pnpm --filter @agencyforge/runtime tsc --noEmit` for compile errors.

### AI requests failing

Provider chain: ninerouter → ollama → openrouter → gemini → nim → anthropic → openai.

1. `GET /api/ai/routing` (bearer auth) shows provider health.
2. If 9Router down, runtime falls back to remote providers — takes up to 20s to detect.
3. Check env vars: `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, etc.

### SSE stream not connecting

1. Fetch token: `POST /api/runtime/stream-token` with bearer auth.
2. Connect: `GET /api/runtime/stream?token=<token>` (no Authorization header — token in query).
3. Tokens are valid 120s, single-use (JTI replay protection).
4. Behind nginx: requires `proxy_buffering off` and `proxy_read_timeout 86400s`.

### Dashboard shows stale state

1. Check SSE connection is open (browser DevTools → Network → EventSource).
2. `POST /api/runtime/sync` triggers manual broadcast.
3. `GET /api/runtime/events` to verify runtime is publishing.

### Workflow stuck

1. `GET /api/runtime/snapshot` — check `workflows` section.
2. Approval steps wait for `POST /api/runtime/workflow/:id/approve`.
3. Retry steps: check if max retry count exceeded (step fails permanently after exhaustion).

### Tests failing

```bash
pnpm --filter @agencyforge/runtime test -- --reporter=verbose
pnpm --filter @agencyforge/runtime test -- <test-name-filter>
```

3 intentional skips are normal (require live API keys). All other tests must pass.

---

## Testing guide

**Runner:** Vitest.

```bash
pnpm --filter @agencyforge/runtime test            # all tests
pnpm --filter @agencyforge/runtime test -- --watch # watch mode
pnpm --filter @agencyforge/runtime test -- workflow # filter
```

**File location:** `runtime/src/tests/{component}.test.ts`

**Naming:**
```typescript
describe('WorkflowEngineImpl', () => {
  it('fails the workflow when a sequential step throws', async () => { ... });
  // Not: it('should fail...')
});
```

No external service calls in unit tests. Mock at the boundary. Tests requiring API keys use `it.skip`.

---

## Release process

1. `pnpm test` clean, `tsc --noEmit` clean.
2. Update `CHANGELOG.md`.
3. Bump version in affected `package.json` files.
4. Tag: `git tag vX.Y.Z`.
5. If certified limits change, append a new section to `docs/archive/PRODUCTION_CERTIFICATION.md` — do not alter the RC1 audit record.

---

## Deployment

Full 12-step guide: `DEPLOYMENT.md`.

**Quick path:**
```bash
NODE_ENV=production RUNTIME_API_KEY=... STREAM_TOKEN_SECRET=... pnpm build
pm2 start ecosystem.config.js && pm2 save
curl http://localhost:3002/health
```

Nginx config and Docker instructions: `docs/architecture/11-deployment-topology.md`.

**RC1 production limits:**

| Resource | Limit |
|---|---|
| Concurrent AI requests | 10 |
| SSE connections | 50 |
| Request body | 1 MB |
| Stream duration | 5 min |
| Concurrent workflows | ~20 recommended |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `PersistenceService: directory not writable` | Bad `AGENCYFORGE_DB_PATH` | `mkdir -p /data && chown agencyforge /data` |
| Agents unavailable | Not registered in bootstrap | Add to `RuntimeBootstrap.ts` |
| Plugin not activating | `isConfigured()` returns false | Set required env var |
| Workflow never completes | Approval step pending | `POST /api/runtime/workflow/:id/approve` |
| SSE drops after ~1 min | nginx timeout too short | `proxy_read_timeout 86400s` |
| Dashboard auth not working | No auth in RC1 | Deploy behind nginx auth proxy |

---

## Reference map

| Topic | Doc |
|---|---|
| System architecture | `docs/architecture/01-system-overview.md` |
| Startup sequence | `docs/architecture/02-runtime-lifecycle.md` |
| Event system + catalog | `docs/architecture/03-event-system.md` |
| AI providers | `docs/architecture/04-ai-providers.md` |
| Workflow engine | `docs/architecture/05-workflow-engine.md` |
| Agent lifecycle | `docs/architecture/06-agent-lifecycle.md` |
| Memory system | `docs/architecture/07-memory-system.md` |
| RuntimeBridge API | `docs/architecture/08-runtime-bridge.md` |
| Database schema | `docs/architecture/09-database-schema.md` |
| Plugin system | `docs/architecture/10-plugin-system.md` |
| Extension points | `docs/architecture/12-extension-points.md` |
| Coding standards | `docs/architecture/13-coding-standards.md` |
| PR checklist | `docs/architecture/14-contribution-guide.md` |
| Extension how-tos | `docs/SDK.md` |
| Technical debt | `docs/TECH_DEBT.md` |
| Roadmap | `docs/ROADMAP.md` |
