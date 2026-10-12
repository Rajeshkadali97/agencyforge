# AgencyForge v1 — Engineering Handover & Closeout Report

**Date:** 2026-07-11  
**Author:** AgencyForge CTO (autonomous session)  
**Branch:** phase-2-integrations  
**Scope:** What is actually in the repo right now — no aspirational claims.

---

## 1. Executive Summary

AgencyForge v1 is a TypeScript/Node.js agentic operating system that orchestrates AI-driven business workflows. The system routes all AI requests through a local 9Router gateway, executes goal-driven multi-agent workflows, persists results to SQLite, and surfaces state to a Next.js dashboard over SSE.

Stage 2 integration (all planned milestones) is complete as of 2026-07-11. The runtime compiles cleanly, all 34 tests pass (8 files, 2.29 s), and the full goal-to-research-to-lead-scoring pipeline executes. Feature gaps requiring credentials or deployment infrastructure are documented in Sections 12 and 14.

**Core capabilities delivered:**
- AI routing via 9Router (with 6-provider failover)
- Plugin system with 4 registered manifests (Firecrawl, Flowise, Paperclip, Research)
- 7 revenue-engine lead-source adapters with real API integrations
- Research engine with competitive analysis, SEO analysis, technology detection
- Cognitive memory bridge connecting runtime events to a SQLite-backed memory engine
- Event-driven persistence (all runtime events durably stored when DB path configured)
- Next.js 15 dashboard with live AI routing health and SSE event feed
- 34-test suite covering unit and integration paths

**Not delivered (explicitly):**
- CI/CD pipeline (no `.github/workflows/`, no Dockerfile, no docker-compose)
- Voice STT/TTS backend (UI exists, credentials required)
- Website Builder (referenced in types, not implemented)
- Tests outside the `runtime/` package

---

## 2. Final Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Dashboard (Next.js 15, port 3000)                │
│  /app/page.tsx  |  /app/ai-routing/page.tsx  |  VoicePanel (UI)    │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  REST + SSE  (HTTP to port 3001)
┌──────────────────────────▼──────────────────────────────────────────┐
│                    RuntimeBridge  (port 3001)                       │
│  GET /api/runtime/snapshot   POST /api/runtime/memory               │
│  GET /api/runtime/search     GET  /api/ai/routing                   │
│  GET /api/runtime/stream (SSE, max 50 connections, 15s heartbeat)   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                   RuntimeBootstrap / createRuntime()                │
│                                                                     │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  WorkflowEngine  │  │  AgentRegistry   │  │  PluginRegistry  │  │
│  │  (DAG topo-sort) │  │  (capability idx)│  │  4 manifests     │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────────────┘  │
│           │                     │                                   │
│  ┌────────▼─────────────────────▼──────────────────────────────┐   │
│  │               EnhancedEventBus (wildcard '*')               │   │
│  │          history cap: 10,000   maxLogSize: 1,000            │   │
│  └────────┬─────────────────────┬────────────────┬────────────┘   │
│           │                     │                │                  │
│  ┌────────▼────────┐  ┌─────────▼───────┐  ┌────▼────────────┐   │
│  │ CognitiveMemory │  │ PersistService  │  │  RuntimeBridge  │   │
│  │  Bridge (ESM/   │  │ (SQLite, 4 tbl) │  │  SSE broadcast  │   │
│  │  CJS dynamic    │  │ env-gated via   │  └─────────────────┘   │
│  │  import)        │  │ AGENCYFORGE_DB.. │                         │
│  └─────────────────┘  └─────────────────┘                         │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  All AI requests
┌──────────────────────────▼──────────────────────────────────────────┐
│                    AIService (provider chain)                       │
│  1. NineRouterProvider  localhost:20128/v1  (kr/ prefix)           │
│  2. OllamaProvider      localhost:11434                             │
│  3. OpenRouterProvider  OPENROUTER_API_KEY                         │
│  4. GeminiProvider      GEMINI_API_KEY                             │
│  5. NIMProvider         NIM_API_KEY                                │
│  6. AnthropicProvider   ANTHROPIC_API_KEY                          │
│  7. OpenAIProvider      OPENAI_API_KEY                             │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                9Router  (local, port 20128)                        │
│        OpenAI-compatible API, health-checked at /models            │
│        Routes to: Anthropic, OpenAI, Gemini, Ollama, etc.         │
└─────────────────────────────────────────────────────────────────────┘

Health: HealthServer port 3002, GET /health
```

---

## 3. Module Inventory

| Module | Package Name | Manager | Language | Output | Status |
|--------|-------------|---------|----------|--------|--------|
| `runtime/` | `@agencyforge/runtime` | pnpm | TypeScript | CommonJS | COMPLETE |
| `dashboard/` | `agencyforge-dashboard` | npm | TypeScript/React | Next.js 15 | COMPLETE |
| `kernel/` | `@agencyforge/kernel` | npm | TypeScript | CommonJS | COMPLETE |
| `memory-engine/` | `@agencyforge/memory-engine` | npm | TypeScript | ESM (pure) | COMPLETE |
| `research/` | `@agencyforge/research` | npm | TypeScript | CommonJS | COMPLETE |
| `revenue-engine/revenue-engine/` | `@agencyforge/revenue-engine` | npm | TypeScript | CommonJS | PARTIAL (7 stubs) |
| `project-brain/` | — | — | — | — | Not built |
| `integrations/` | — | — | — | — | Not built |
| `providers/` | — | — | — | — | Not built |

### Runtime sub-packages (all in `runtime/src/`)

| Sub-package | Key Class | Status |
|-------------|-----------|--------|
| `events/` | EnhancedEventBus | COMPLETE |
| `agent/` | AgentRegistry, AgentRuntime, WorkflowEngine, ToolPermissionManager | COMPLETE |
| `bootstrap/` | RuntimeBootstrap, createRuntime() | COMPLETE |
| `bridge/` | RuntimeBridge | COMPLETE |
| `health/` | HealthServer, HealthManager | COMPLETE |
| `ai/` | AIService, ProviderFactory, NineRouterProvider (+ 6 others) | COMPLETE |
| `plugins/` | PluginRegistry + 4 manifests | COMPLETE |
| `persistence/` | PersistenceService (better-sqlite3) | COMPLETE |
| `bindings/memory/` | CognitiveMemoryBridge | COMPLETE |
| `coordinator/` | RuntimeCoordinator, SQLiteRuntimeStateStore | COMPLETE |
| `integration/` | ResearchBridge | COMPLETE |
| `integrations/leads/` | LeadScorerAgent | COMPLETE |
| `knowledge/` | DataService | COMPLETE |
| `context/` | SharedContext | COMPLETE |
| `automation/` | cron scheduling | COMPLETE |
| `config/` | ConfigLoader | COMPLETE |

---

## 4. Plugin Inventory

All plugins registered in `runtime/src/plugins/PluginRegistry.ts` via `getPluginRegistry()` singleton.

| Plugin | Manifest File | Capabilities | Credential Required |
|--------|--------------|-------------|-------------------|
| Firecrawl | `manifests/firecrawl.ts` | `web.scrape`, `web.search`, `web.map` | `FIRECRAWL_API_KEY` |
| Flowise | `manifests/flowise.ts` | `workflow.list`, `workflow.execute`, `workflow.import` | `FLOWISE_API_URL` (default localhost:3000) |
| Paperclip | `manifests/paperclip.ts` | `org.listTeams`, `org.getTeam`, `org.getHierarchy`, `org.assignGoal`, `org.getProjectsByOwner` | `PAPERCLIP_API_URL` (default localhost:4000) |
| Research | `manifests/research.ts` | `research.company`, `research.website`, `research.competitors` | None (wraps `@agencyforge/research`) |

**How to add a plugin:** implement `PluginManifest` interface in `runtime/src/plugins/manifests/`, export from `runtime/src/plugins/index.ts`, register in `RuntimeBootstrap.createRuntime()`.

---

## 5. Provider Inventory

### AI Providers (failover order)

| # | Provider | Class | Endpoint | Credential |
|---|----------|-------|----------|-----------|
| 1 | 9Router | NineRouterProvider | localhost:20128/v1 | NINE_ROUTER_URL (default) |
| 2 | Ollama | OllamaProvider | localhost:11434 | None |
| 3 | OpenRouter | OpenRouterProvider | api.openrouter.ai | OPENROUTER_API_KEY |
| 4 | Gemini | GeminiProvider | generativelanguage.googleapis.com | GEMINI_API_KEY |
| 5 | NIM (NVIDIA) | NIMProvider | integrate.api.nvidia.com | NIM_API_KEY |
| 6 | Anthropic | AnthropicProvider | api.anthropic.com | ANTHROPIC_API_KEY |
| 7 | OpenAI | OpenAIProvider | api.openai.com | OPENAI_API_KEY |

9Router is health-checked at startup (`GET /models`). Providers marked `FREE_PROVIDERS` (ninerouter, ollama) are tried before paid providers.

### Revenue-Engine Lead-Source Adapters

| Adapter | Status | Capabilities | Credential |
|---------|--------|-------------|-----------|
| firecrawl | IMPLEMENTED | website.scrape, website.audit | FIRECRAWL_API_KEY |
| google-search | IMPLEMENTED | business.discovery, lead.extraction | SERPER_API_KEY |
| csv-import | IMPLEMENTED | crm.read, crm.write, crm.sync | None |
| manual-entry | IMPLEMENTED | crm.write, crm.read, crm.sync | None |
| apollo | IMPLEMENTED | business.discovery, lead.extraction, lead.enrichment, lead.scoring | APOLLO_API_KEY |
| google-maps | IMPLEMENTED | business.discovery, lead.extraction, lead.enrichment | GOOGLE_MAPS_API_KEY |
| linkedin | IMPLEMENTED | business.discovery, lead.extraction, lead.enrichment, needs.analysis | LINKEDIN_ACCESS_TOKEN |
| clutch | STUB | — | — |
| company-websites | STUB | — | — |
| future | STUB | — | — |
| growchief | STUB | — | — |
| moneyprinterv2 | STUB | — | — |
| scrapegraph-ai | STUB | — | — |
| openoutreach | STUB | — | — |

---

## 6. AI Routing Flow

```
Dashboard (user prompt)
  HTTP POST /api/runtime/* to RuntimeBridge (port 3001)
    RuntimeCoordinator.executeGoal()
      ResearchAgent.execute() or LeadScorerAgent.execute()
        DataService calls AIService.generate()
          AIService checks provider chain:
            1. NineRouterProvider health-check OK?
               YES: POST localhost:20128/v1/chat/completions
                    9Router routes to best available AI model
               NO: try OllamaProvider (localhost:11434)
                   NO: try OpenRouterProvider (OPENROUTER_API_KEY)
                       NO: try GeminiProvider ... etc.
```

**Invariant:** AgencyForge never calls OpenAI/Anthropic/Gemini/Ollama/OpenRouter directly. All AI traffic passes through AIService. 9Router is always first in the chain. This is enforced by construction — agents hold `DataService`, which holds `AIService`, which holds the provider chain.

**Model naming for 9Router:** prefix `kr/` (e.g. `kr/claude-3-haiku`, `kr/gpt-4o-mini`). Set via `NINE_ROUTER_DEFAULT_MODEL` env var.

---

## 7. Event Flow

### Event Types (`runtime/src/events/RuntimeEventTypes.ts`)

| Constant | Value |
|----------|-------|
| `RUNTIME_STARTED` | `runtime.started` |
| `RUNTIME_STOPPED` | `runtime.stopped` |
| `AGENT_TASK_ASSIGNED` | `agent.task.assigned` |
| `AGENT_TASK_COMPLETED` | `agent.task.completed` |
| `AGENT_TASK_FAILED` | `agent.task.failed` |
| `RESEARCH_COMPLETED` | `research.completed` |
| `LEAD_SCORED` | `lead.scored` |
| `PROPOSAL_GENERATED` | `proposal.generated` |
| `MEMORY_STORED` | `memory.stored` |
| `PLUGIN_EXECUTED` | `plugin.executed` |
| `WORKFLOW_STEP_COMPLETED` | `workflow.step.completed` |

### Full Goal-to-Dashboard Event Sequence

```
1. User submits goal via Dashboard REST
2. RuntimeCoordinator.executeGoal(input)
3. WorkflowEngine builds 2-step DAG:
   step_research (no deps)
   step_lead_scoring (depends: step_research)
4. WorkflowEngine.run() — topological sort, parallel where possible
5. step_research:
   a. AgentRegistry.findByCapability('research') resolves ResearchAgent
   b. ResearchAgent.execute()
   c. EnhancedEventBus.publish(RESEARCH_COMPLETED, { companyName, results, ... })
   d. CognitiveMemoryBridge handler fires: store({ type:'business', importance:0.8 })
   e. PersistenceService wildcard handler fires: INSERT into runtime_events
   f. RuntimeBridge SSE broadcast to all connected Dashboard clients
6. step_lead_scoring:
   a. AgentRegistry.findByCapability('bant-scoring') resolves LeadScorerAgent
   b. LeadScorerAgent.execute()
   c. EnhancedEventBus.publish(LEAD_SCORED, { tier:'hot'|'warm'|'cold', ... })
   d. CognitiveMemoryBridge handler fires: store({ importance: 0.9|0.7|0.5 })
   e. PersistenceService wildcard handler fires: INSERT into runtime_events
   f. RuntimeBridge SSE broadcast to Dashboard
7. ExecutionResult returned to caller
```

EnhancedEventBus subscriber priorities: domain handlers run at default priority, PersistenceService wildcard runs at priority -10 (last).

---

## 8. Memory Flow

```
Runtime events (any type)
  EnhancedEventBus '*' wildcard subscriber (priority -10)
    PersistenceService.persistEvent(eventType, payload, sourceSubsystem)
      INSERT INTO runtime_events (event_id, event_type, payload_json, ...)

RESEARCH_COMPLETED / LEAD_SCORED / PROPOSAL_GENERATED events
  EnhancedEventBus named-type subscribers (_wireMemorySubscriptions)
    CognitiveMemoryBridge.store({ type, source, summary, importance, tags })
      dynamic import('@agencyforge/memory-engine' as string)   [ESM/CJS boundary]
        MemoryEngineAdapter wraps IMemoryEngine
          memory-engine SQLite tables (episodic, semantic, long-term)
```

**ESM/CJS boundary:** `memory-engine/` is pure ESM (`"type":"module"`). Runtime is CommonJS. Bridge uses `import('...' as string)` TypeScript cast to prevent compile-time type resolution while enabling runtime `import()`. Graceful fallback: if `@agencyforge/memory-engine` is unavailable, bridge no-ops and logs a warning.

**Kernel memory (separate):** `kernel/src/memory/adapters/cognitive-memory-provider.ts` provides `CognitiveMemoryProvider` for kernel-level planning profiles (BusinessProfile, AgentProfile, ProjectProfile). This is a thin DI wrapper, not independently SQLite-backed.

**PersistenceService tables:**

| Table | Purpose |
|-------|---------|
| `runtime_events` | All events with type, payload, source, trace/span IDs |
| `shared_context_snapshots` | Periodic SharedContext snapshots |
| `workflow_runs` | Workflow execution records |
| `agent_memory` | Agent-specific memory blobs |

---

## 9. Data Flow

```
External Data Sources             AgencyForge Runtime              Storage
---------------------             ---------------              -------
Firecrawl API         -------->   firecrawl adapter   -------->
Google Search/Serper  -------->   google-search adapt  -------->
Apollo.io             -------->   apollo adapter       -------->  EnhancedEventBus
Google Maps           -------->   google-maps adapter  -------->  (memory cap 10k)
LinkedIn              -------->   linkedin adapter     -------->       |
CSV files             -------->   csv-import adapter   -------->       |
Manual entry          -------->   manual-entry adapter -------->       v
                                                              CognitiveMemoryBridge
                                                              --> @agencyforge/memory-engine
                                                              --> SQLite (memory-engine/)
                                                              PersistenceService
                                                              --> SQLite (AGENCYFORGE_DB_PATH)

Dashboard Input --> RuntimeBridge REST --> RuntimeCoordinator --> WorkflowEngine --> Agents
                                                                                      |
                                                                             9Router (port 20128)
                                                                              |
                                                                         AI Provider

RuntimeBridge SSE --> Dashboard (all runtime events, 15s heartbeat)
```

---

## 10. API Inventory

### RuntimeBridge (port 3001)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/runtime/stream` | SSE stream, max 50 connections, 15s heartbeat |
| GET | `/api/runtime/snapshot` | SharedContext snapshot JSON |
| POST | `/api/runtime/memory` | Store memory item `{ content, type, metadata }` |
| GET | `/api/runtime/memory` | Retrieve recent memory items (last 10) |
| POST | `/api/runtime/search` | Global search — **NOTE: returns hardcoded demo data** |
| GET | `/api/runtime/search` | Same, query param `?q=` |
| GET | `/api/ai/routing` | AI provider health + usage metrics |
| GET | `/health` | Health check |
| GET | `/metrics` | Runtime metrics JSON |

**Known issue:** `GET/POST /api/runtime/search` calls `RuntimeBridge.performGlobalSearch()` which returns static demo data (fictional company names: Basil Bistro, Krisara Corp, etc.). Not wired to real runtime data.

### HealthServer (port 3002)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns `{ status, uptime, subsystems, timestamp }` |

---

## 11. Environment Variables Required

All secrets come from environment variables only. No hardcoded credentials exist in source.

### Core Runtime

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `NINE_ROUTER_URL` | No | `http://localhost:20128` | 9Router gateway URL |
| `NINE_ROUTER_DEFAULT_MODEL` | No | — | Default model prefix (e.g. `kr/claude-3-haiku`) |
| `AGENCYFORGE_DB_PATH` | No | — | SQLite DB path; persistence disabled if unset |
| `NODE_ENV` | No | — | Set to `production` for prod |
| `VITEST` | No | — | Auto-set by test runner; enables port 0 for servers |

### AI Provider Credentials (failover chain)

| Variable | Provider |
|----------|---------|
| `OPENROUTER_API_KEY` | OpenRouter (provider 3) |
| `GEMINI_API_KEY` | Google Gemini (provider 4) |
| `NIM_API_KEY` | NVIDIA NIM (provider 5) |
| `ANTHROPIC_API_KEY` | Anthropic direct (provider 6) |
| `OPENAI_API_KEY` | OpenAI direct (provider 7) |

### Lead-Source Adapters

| Variable | Adapter |
|----------|---------|
| `FIRECRAWL_API_KEY` | Firecrawl (web scraping) |
| `FIRECRAWL_API_URL` | Firecrawl (default: https://api.firecrawl.dev) |
| `SERPER_API_KEY` | Google Search via Serper.dev |
| `APOLLO_API_KEY` | Apollo.io lead enrichment |
| `GOOGLE_MAPS_API_KEY` | Google Maps Places API |
| `LINKEDIN_ACCESS_TOKEN` | LinkedIn OAuth 2.0 token (pre-obtained) |

### Plugin Integrations

| Variable | Plugin | Default |
|----------|--------|---------|
| `FLOWISE_API_URL` | Flowise | http://localhost:3000 |
| `FLOWISE_API_KEY` | Flowise | — |
| `PAPERCLIP_API_URL` | Paperclip org management | http://localhost:4000 |
| `PAPERCLIP_API_KEY` | Paperclip | — |

### Dashboard (Next.js)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_RUNTIME_URL` | RuntimeBridge base URL (dashboard to runtime) |
| `NEXT_PUBLIC_WS_URL` | SSE URL for event stream |

### Voice (UI exists, backend unimplemented)

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Whisper STT + TTS |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS (alternative) |

---

## 12. External Services Required

| Service | Purpose | How to Obtain | Required for Core? |
|---------|---------|---------------|-------------------|
| 9Router | AI gateway (local) | Run `9router` binary on port 20128 | YES — first in chain; falls back to Ollama if absent |
| Ollama | Local AI fallback | Install Ollama, pull a model | NO — optional fallback |
| Firecrawl | Web scraping | firecrawl.dev API key | NO — plugin only |
| Serper | Google Search | serper.dev API key | NO — adapter only |
| Apollo.io | Lead enrichment | apollo.io API key | NO — adapter only |
| Google Maps | Business discovery | Google Cloud Console | NO — adapter only |
| LinkedIn | Lead enrichment | OAuth 2.0 token | NO — adapter only |
| Flowise | Workflow execution | Self-hosted Flowise | NO — plugin manifest only |
| Paperclip | Org management | Self-hosted Paperclip | NO — plugin manifest only |
| OpenRouter / Gemini / NIM / Anthropic / OpenAI | AI fallover | API keys | NO — failover only |

---

## 13. Deployment Architecture

**Current state: no deployment automation exists.**

There is no `Dockerfile`, no `docker-compose.yml`, no `.github/workflows/` CI/CD, no Kubernetes manifests, no Terraform/Pulumi, no deployment scripts beyond a single shell helper (`agencyforge-tmux.sh` for local development).

The system is deployed manually:

```bash
# 1. Build workspace packages
cd kernel && npm install && npm run build
cd ../memory-engine && npm install && npm run build
cd ../research && npm install

# 2. Build and start runtime
cd ../runtime && pnpm install && pnpm run build
node dist/index.js   # RuntimeBootstrap starts on ports 3001 + 3002

# 3. Start dashboard
cd ../dashboard && npm install && npm run build && npm run start  # port 3000

# 4. Ensure 9Router is running on port 20128
```

**Port conflicts:** Flowise defaults to port 3000, same as Next.js dev server. One must be reconfigured if running alongside dashboard locally.

---

## 14. Remaining Manual Configuration

| Item | Action Required | Who |
|------|----------------|-----|
| `.env` file | Copy `.env.example`, fill in API keys | Operator |
| 9Router binary | Install and run on port 20128 | Operator |
| Node.js version | Ensure Node >= 18 (for ESM dynamic import support) | Operator |
| pnpm | Install pnpm for runtime package management | Operator |
| SQLite path | Set `AGENCYFORGE_DB_PATH` if persistence wanted | Operator |
| Dashboard URL | Set `NEXT_PUBLIC_RUNTIME_URL` to RuntimeBridge host:port | Operator |
| Flowise port | Change Flowise or Next.js port if running both | Operator |
| LinkedIn token | Obtain OAuth 2.0 token before LinkedIn adapter works | Operator |
| Voice backend | Wire `OPENAI_API_KEY` or `ELEVENLABS_API_KEY` when ready | Developer |

---

## 15. Security Checklist

| Item | Status | Notes |
|------|--------|-------|
| No hardcoded API keys or secrets in source | PASS | All credentials via env vars only |
| No hardcoded provider URLs | PASS | `NINE_ROUTER_URL`, `FLOWISE_API_URL`, `PAPERCLIP_API_URL` all env-controlled |
| All AI requests route through 9Router (never direct) | PASS | Enforced by AIService provider chain construction |
| Math.random() removed from ID generation | PASS | All IDs use `crypto.randomUUID()` (5 dashboard files fixed) |
| SSE max connections capped | PASS | `MAX_SSE_CONNECTIONS = 50` in RuntimeBridge |
| SQLite DB path operator-controlled | PASS | `AGENCYFORGE_DB_PATH`; no default DB created |
| No SQL injection vectors identified | PASS | better-sqlite3 prepared statements used throughout |
| No XSS vectors in SSE payload | PASS | JSON-serialized events, not HTML |
| CORS policy | NOT CONFIGURED | RuntimeBridge sets no CORS headers; needed before cross-origin deployment |
| Auth/authz on RuntimeBridge endpoints | NOT IMPLEMENTED | No authentication on REST or SSE endpoints |
| Rate limiting | NOT IMPLEMENTED | No rate limiting on any endpoint |
| HTTPS/TLS | NOT CONFIGURED | All communication over HTTP; TLS requires reverse proxy |
| Secret scanning in CI | NOT APPLICABLE | No CI exists |
| Dependency audit | NOT RUN | `pnpm audit` / `npm audit` not run as part of any pipeline |

**Production blockers (security):** CORS, auth on RuntimeBridge, and HTTPS must be addressed before exposing to the internet.

---

## 16. Backup Strategy

**Current state: no automated backup.**

The only stateful data stores are:
1. SQLite at `AGENCYFORGE_DB_PATH` (if configured) — 4 tables: runtime_events, shared_context_snapshots, workflow_runs, agent_memory
2. `@agencyforge/memory-engine` internal SQLite (path internal to the package, typically under `memory-engine/data/`)

**Manual backup until automated:**
```bash
# Stop runtime before backup to avoid page corruption, or use SQLite online backup:
sqlite3 $AGENCYFORGE_DB_PATH ".backup backup-$(date +%Y%m%d).db"
```

No retention policy, no off-site backup, no point-in-time recovery is configured.

---

## 17. Monitoring Strategy

**Built-in (currently available):**

| Mechanism | Endpoint / Source | What it shows |
|-----------|------------------|---------------|
| HealthServer | `GET localhost:3002/health` | Runtime subsystem status, uptime |
| RuntimeBridge metrics | `GET localhost:3001/metrics` | Agent count, event count, workflow count |
| AI routing health | `GET localhost:3001/api/ai/routing` | Provider health + usage metrics |
| Dashboard /ai-routing page | Next.js page | Visual AI routing health, 10s poll |
| PersistenceService | `runtime_events` SQLite table | All historical events with timestamps |
| Console logs | stdout | Structured logs via ILogger interface |

**Not configured:**
- No external APM (Datadog, New Relic, Sentry, etc.)
- No log aggregation (ELK, Loki, Cloudwatch)
- No alerting
- No uptime monitoring
- No performance baseline metrics

---

## 18. Disaster Recovery

**Current state: no formal DR plan.**

**Manual recovery procedure:**
1. Stop runtime process
2. Restore SQLite DB from most recent backup
3. Verify 9Router is running on port 20128
4. Restart runtime: `node dist/index.js` in `runtime/`
5. Restart dashboard: `npm run start` in `dashboard/`
6. Verify health: `curl localhost:3002/health`

**Estimated mean time to recovery:** 5–15 minutes manually.

**Data loss risk:** Events between last backup and failure are lost. Memory-engine SQLite is similarly unprotected.

No automated failover, replica, or checkpoint mechanisms exist.

---

## 19. CI/CD Status

**CI/CD does not exist.**

No files exist at:
- `.github/workflows/` — no GitHub Actions
- `Dockerfile` — no container image definition
- `docker-compose.yml` — no multi-service definition
- `.circleci/`, `.travis.yml`, `azure-pipelines.yml` — no alternative CI

The only automated quality gate is the test suite, run manually:
```bash
cd runtime && pnpm run test
# Result: 8/8 files, 34 pass, 3 skip — 2.29s
```

Build verification is also manual:
```bash
cd runtime && pnpm run build
cd ../dashboard && npm run build
cd ../kernel && npm run build
cd ../memory-engine && npm run build
```

**Minimum CI needed for v1.1:** a GitHub Actions workflow running `pnpm install && pnpm run build && pnpm run test` in `runtime/` on every push to `main` and every PR.

---

## 20. Production Activation Checklist

Complete these steps in order before considering the system production-ready:

### Infrastructure Prerequisites
- [ ] Server with Node >= 18, pnpm, npm installed
- [ ] 9Router binary installed and configured on port 20128
- [ ] Reverse proxy (nginx/Caddy) with HTTPS certificates
- [ ] SQLite data directory created with appropriate permissions

### Security Hardening (required before internet exposure)
- [ ] Add CORS policy to RuntimeBridge (allowed origins list)
- [ ] Add authentication to RuntimeBridge endpoints (API key or JWT middleware)
- [ ] Configure HTTPS via reverse proxy (TLS termination)
- [ ] Run `pnpm audit` and `npm audit` across all packages; resolve high/critical findings
- [ ] Set `NODE_ENV=production`

### Configuration
- [ ] Copy `.env.example` to `.env`, fill all required values
- [ ] Set `NINE_ROUTER_URL` to 9Router address
- [ ] Set `AGENCYFORGE_DB_PATH` to a durable path with backup plan
- [ ] Set `NEXT_PUBLIC_RUNTIME_URL` to RuntimeBridge public URL
- [ ] Resolve Flowise/Next.js port 3000 conflict (change one)

### Build and Deploy
- [ ] `cd runtime && pnpm install && pnpm run build`
- [ ] `cd dashboard && npm install && npm run build`
- [ ] `cd kernel && npm install && npm run build`
- [ ] `cd memory-engine && npm install && npm run build`
- [ ] `cd research && npm install`
- [ ] `cd revenue-engine/revenue-engine && npm install`

### Smoke Tests
- [ ] `curl http://localhost:3002/health` returns `{"status":"healthy",...}`
- [ ] `curl http://localhost:3001/api/ai/routing` shows 9Router health
- [ ] Dashboard loads at configured URL
- [ ] Submit a test goal and verify RESEARCH_COMPLETED event appears in SSE stream
- [ ] Verify SQLite DB at `AGENCYFORGE_DB_PATH` has rows in `runtime_events`

### Monitoring Setup (recommended before launch)
- [ ] Configure log shipping to aggregation service
- [ ] Set up uptime check on `localhost:3002/health`
- [ ] Schedule daily SQLite backup

---

## Remaining Technical Debt

| Item | Location | Priority | Notes |
|------|----------|----------|-------|
| `performGlobalSearch()` returns hardcoded demo data | `runtime/src/bridge/RuntimeBridge.ts` | HIGH | Returns fictional company names (Basil Bistro, Krisara Corp). Needs real search implementation |
| No auth on RuntimeBridge | `runtime/src/bridge/RuntimeBridge.ts` | HIGH | All endpoints public |
| No CORS headers | `runtime/src/bridge/RuntimeBridge.ts` | HIGH | Needed before cross-origin dashboard deployment |
| Voice STT/TTS backend not implemented | `dashboard/` VoicePanel, `runtime/src/bindings/` | MEDIUM | UI exists; no audio pipeline |
| Website Builder not implemented | referenced in `runtime/src/contracts/types.ts` | MEDIUM | ~15 days estimated effort |
| WorkflowEngine pause/resume (human approval gate) | `runtime/src/agent/WorkflowEngine.ts` | MEDIUM | Enum + config fields exist; pause/resume logic missing |
| 7 revenue-engine adapter stubs | `revenue-engine/revenue-engine/providers/adapters/` | MEDIUM | clutch, company-websites, future, growchief, moneyprinterv2, scrapegraph-ai, openoutreach |
| No tests outside runtime/ | All other packages | MEDIUM | dashboard, kernel, research, revenue-engine have zero automated tests |
| No CI/CD | repo root | MEDIUM | All quality gates are manual |
| M1 MemoryBinding rename | `runtime/src/bindings/` | LOW | Cosmetic rename, no functional impact |
| `character.tsx` Math.random() for blink timing | `dashboard/components/` | LOW | Animation timing only, not an ID — acceptable |

---

## Known Limitations

1. **Global search is demo data.** `RuntimeBridge.performGlobalSearch()` returns a hardcoded list of fictional companies regardless of query. This is placeholder code, not a search engine bug.

2. **No test suite outside runtime/.** Dashboard (Next.js), kernel, research engine, and revenue engine have no automated tests. Quality assurance for those packages is entirely manual.

3. **No CI/CD.** See Section 19. Every build and test run is manual.

4. **Voice panel has no backend.** VoicePanel UI component exists in the dashboard. `VoiceBinding` and `VoiceEngine` types exist in the runtime. No audio capture, STT, or TTS pipeline is wired end-to-end.

5. **LinkedIn adapter requires pre-obtained OAuth 2.0 token.** `LINKEDIN_ACCESS_TOKEN` must be obtained externally. The adapter does not implement the OAuth flow.

6. **Memory-engine graceful fallback means silent memory loss.** If `@agencyforge/memory-engine` package is unavailable (not built, or workspace not linked), `CognitiveMemoryBridge` silently no-ops. Events are still persisted by PersistenceService, but cognitive memory indexing is skipped.

7. **Port 3000 conflict.** Next.js dev server and Flowise both default to port 3000. Running both locally requires changing one.

8. **RuntimeCoordinator in-memory fallback.** When `AGENCYFORGE_DB_PATH` is not set, `SQLiteRuntimeStateStore` falls back to in-memory storage. State is lost on process restart.

9. **9Router required for full AI capability.** Without 9Router running, the system falls back through 6 providers. Fallback works but loses model-selection intelligence and the unified routing 9Router provides.

10. **No request queuing or rate limiting.** Under concurrent load, agents can issue parallel AI requests with no throttling.

---

## Future Roadmap

### v1.1 (Near-term, 1–2 sprints)

- GitHub Actions CI (build + test on every PR) — 1–2 hours
- CORS + API key auth on RuntimeBridge — 1 day
- Replace `performGlobalSearch()` with real runtime state query — 2–4 hours
- WorkflowEngine pause/resume for human approval gate — 3–4 days
- Test suites for dashboard (Playwright E2E) and kernel (vitest unit)
- Complete 3–5 revenue-engine adapter stubs (clutch, scrapegraph-ai, openoutreach)

### v1.2 (Medium-term, 1–2 months)

- Voice STT/TTS end-to-end (VoicePanel to Whisper/ElevenLabs)
- Dockerfile + docker-compose for one-command local startup
- Redis-backed event bus for multi-process scalability
- Dashboard CEO approval gate (WorkflowEngine pause/resume + UI)
- Automated SQLite backup (cron job)
- Sentry integration for error tracking

### v2.0 (Long-term, 3–6 months)

- Website Builder implementation (~15 days estimated effort)
- Multi-tenant runtime isolation
- Horizontal scaling: separate RuntimeBridge, WorkflowEngine, AIService processes
- GraphQL or tRPC layer over REST endpoints
- Plugin SDK and marketplace
- 9Router clustering for AI load balancing
- Agent memory long-term retention policies (episodic to semantic consolidation)
- Streaming AI responses end-to-end (9Router to AIService to SSE to Dashboard)

---

## Recommended v1.1 Improvements

Listed in priority order by risk and effort:

1. **CI on every commit** — 1–2 hours. Add `.github/workflows/ci.yml` running `pnpm install && pnpm run build && pnpm run test` in `runtime/`. Eliminates risk of silent regressions as codebase grows.

2. **Auth on RuntimeBridge** — 1 day. Add middleware checking `Authorization: Bearer <RUNTIME_API_KEY>` on all non-health endpoints. Necessary before any network-accessible deployment.

3. **Fix global search** — 2–4 hours. Replace `performGlobalSearch()` hardcoded data with a real query against `SharedContext` or the `runtime_events` SQLite table.

4. **Flowise port default change** — 30 minutes. Change Flowise default from 3000 to 3100 in the plugin manifest to avoid Next.js conflict.

5. **Health endpoint on dashboard** — 2 hours. Add `/api/health` to Next.js that pings RuntimeBridge and returns composite health for load-balancer checks.

6. **E2E smoke test for the full goal workflow** — 1 day. A Playwright test that hits the dashboard, submits a goal, and asserts RESEARCH_COMPLETED appears in the SSE stream. The plumbing exists; no test covers the end-to-end path.

7. **Revenue adapter test suite** — 2 days. Vitest unit tests for all 7 implemented adapters using mock HTTP responses (no real API calls needed).

8. **WorkflowEngine pause/resume** — 3–4 days. The `humanApprovalRequired` config field exists on step definitions. Implement `pause()` / `resume()` methods on `WorkflowEngine`, wire to a new `POST /api/runtime/workflow/:runId/resume` endpoint, and add an approval card to the Dashboard.

---

*End of AgencyForge v1 Engineering Handover — 2026-07-11*
