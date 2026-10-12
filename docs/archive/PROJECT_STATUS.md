# PROJECT_STATUS.md

**Updated:** 2026-07-23 (Production Completion Sprint)
**Reporter:** AgencyForge CTO

---

## Production Completion Sprint — Applied on top of M11

| Fix | Status |
|-----|--------|
| Security headers (X-Frame-Options, X-Content-Type-Options, CSP, etc.) | DONE — applied to every RuntimeBridge response |
| `.env.example` for runtime and dashboard | DONE |
| Docker — runtime Dockerfile | DONE |
| Docker — dashboard Dockerfile (with standalone mode) | DONE |
| docker-compose.yml (root) | DONE |
| Dead code — removed `useInitializeDemoData` (never called) | DONE |
| CI — dashboard typecheck now a hard gate (removed `continue-on-error`) | DONE |
| CI — kernel tests added to `kernel` job (59 tests discovered) | DONE |
| CI — Docker build jobs added | DONE |
| Human approval gate — `POST /api/runtime/approve` endpoint added | DONE |
| `RUNTIME_ENDPOINTS.approve` added to dashboard runtime-config | DONE |

---

## Stage 2 + M11 Status: COMPLETE

Integration milestones finished. M11 production hardening applied.

### M11 Hardening Summary
| Finding | Status |
|---------|--------|
| M11.2 Plugin auto-registration | DONE — all 4 manifests registered + activated in createRuntime() |
| M11.3 Dashboard hardcoded URLs | DONE — runtime-config.ts; env-driven NEXT_PUBLIC_RUNTIME_URL |
| M11.4 Runtime security | DONE — CORS configurable, bearer auth optional, 256KB body limit |
| M11.5 9Router enforcement | DONE — ProviderRouter no longer bypasses via forceProvider |
| M11.6 Demo search replaced | DONE — performGlobalSearch queries real SharedContext |
| M11.8 CI/CD | DONE — .github/workflows/ci.yml; 6-job matrix; runtime is hard gate |
| M11.1 Workspace | PARTIAL — pnpm-workspace.yaml correct; cross-package manager mix intentional |
| M11.7 Tests | PARTIAL — runtime 34/34; other packages have no test scripts yet |
| M11.9 Cleanup | DEFERRED — no critical dead code identified |
| M11.10 Docs | DONE — IMPLEMENTATION_LOG.md + PROJECT_STATUS.md updated |

---

## Module Completion Matrix

### Runtime
| Component | Status | Notes |
|-----------|--------|-------|
| EnhancedEventBus | DONE | Canonical bus; history capped 10,000; maxLogSize 1,000 |
| AgentRegistry | DONE | Capability index bug fixed; finds both instances and legacyAgents |
| WorkflowEngine | DONE | Topological sort + parallel step execution; 2-step DAG wired |
| RuntimeCoordinator | DONE | SQLiteRuntimeStateStore env-gated; real agent invocation |
| RuntimeBootstrap | DONE | Full init sequence; PersistenceService + CognitiveMemoryBridge wired |
| RuntimeBridge | DONE | SSE + REST; port 0 in VITEST for test isolation |
| CognitiveMemoryBridge | DONE | ESM/CJS dynamic import; MemoryEngineAdapter; graceful fallback |
| PersistenceService | DONE | All events persisted to SQLite when AGENCYFORGE_DB_PATH set |
| NineRouterProvider (9Router) | DONE | localhost:20128/v1; first in AI chain; health-checked |
| PluginRegistry | DONE | Firecrawl, Flowise, Paperclip, Research manifests |
| ResearchAgent | DONE | capability: 'research'; registered at bootstrap |
| LeadScorerAgent | DONE | capability: 'bant-scoring'; registered at bootstrap |
| ResearchBridge | DONE | Event type fixed; publishes RESEARCH_COMPLETED |
| Memory subscriptions | DONE | RESEARCH_COMPLETED, LEAD_SCORED, PROPOSAL_GENERATED wired to CognitiveMemory |

### Revenue Engine
| Component | Status | Notes |
|-----------|--------|-------|
| ProviderOrchestrator / CircuitBreaker / RetryManager / RateLimitManager | DONE | Clean typecheck |
| ExecutionPipeline | DONE | Fixed 2-arg bug |
| firecrawl adapter | DONE | website.scrape, website.audit; FIRECRAWL_API_KEY from env |
| google-search adapter | DONE | business.discovery, lead.extraction; SERPER_API_KEY from env |
| csv-import adapter | DONE | crm.read, crm.write, crm.sync; pure JS |
| manual-entry adapter | DONE | in-memory store; crm.write, crm.read, crm.sync |
| apollo adapter | DONE | business.discovery, lead.extraction, lead.enrichment, lead.scoring; APOLLO_API_KEY from env |
| google-maps adapter | DONE | business.discovery, lead.extraction, lead.enrichment; GOOGLE_MAPS_API_KEY from env |
| linkedin adapter | DONE | business.discovery, lead.extraction, lead.enrichment, needs.analysis; LINKEDIN_ACCESS_TOKEN from env |

### Research Engine
| Component | Status |
|-----------|--------|
| ResearchEngine, CompanyDiscovery, WebsiteAnalysis, CompetitorAnalysis, TechnologyDetection, SEOAnalysis | DONE |
| research plugin manifest | DONE |

### Kernel
| Component | Status |
|-----------|--------|
| EventBus, AgentRegistry, SequentialPlanner, TaskQueue, BasicExecutor | DONE |
| CognitiveMemoryProvider (M8 kernel adapter) | DONE |
| createAgencyForge() bootstrap | DONE |

### Dashboard
| Component | Status | Notes |
|-----------|--------|-------|
| Next.js App Shell, CharacterFace, VoicePanel, CEOBriefing | DONE | Compiles clean |
| /ai-routing page | DONE | Live 9Router health (10s poll) |
| Math.random() removed | DONE | All IDs use crypto.randomUUID() |
| VoicePanel STT/TTS | PARTIAL | UI exists; credentials required |

---

## Test Status

8/8 files passing — 34 pass, 3 skip (37 total). Test duration: 2.29s.

---

## Completed Milestones

| Date | Milestone |
|------|-----------|
| June 28-30 | Stage 0: All modules compile cleanly |
| July 9 | M9 UnifiedEventBus deleted; M3 ProviderRouter; SQLite execute() fix |
| July 10 | 9Router + /ai-routing dashboard; Plugin system (Firecrawl, Flowise, Paperclip, Research) |
| July 10 | M5 Revenue engine all 7 adapters; M7 Memory scoping ADR |
| July 10 | M8 CognitiveMemoryBridge + kernel adapter; M4 ResearchBridge event type fix |
| July 10 | E2E event wiring; integration smoke tests; AgentRegistry fix; real 2-step DAG workflow |
| July 11 | PersistenceService wired; test EADDRINUSE fixed; docs updated |

---

## Credentials Required to Activate Features

| Feature | Env Var |
|---------|---------|
| Firecrawl scraping | FIRECRAWL_API_KEY |
| Google Search (Serper) | SERPER_API_KEY |
| Apollo lead enrichment | APOLLO_API_KEY |
| Google Maps discovery | GOOGLE_MAPS_API_KEY |
| LinkedIn enrichment | LINKEDIN_ACCESS_TOKEN |
| SQLite persistence | AGENCYFORGE_DB_PATH |
| Voice STT/TTS | OPENAI_API_KEY or ELEVENLABS_API_KEY |
| 9Router AI gateway | NINE_ROUTER_URL (defaults to localhost:20128) |
