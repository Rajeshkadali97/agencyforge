# AgencyForge Technical Debt Register

**Generated:** 2026-06-28  
**Scope:** All identified technical debt from source code inspection

---

## Debt Classification

| Severity | Definition |
|----------|------------|
| **P0 - Critical** | Blocks compilation, runtime crashes, data loss, security vulnerability |
| **P1 - High** | Major feature incomplete, significant bug, architecture violation |
| **P2 - Medium** | Code quality, maintainability, performance, missing tests |
| **P3 - Low** | Cosmetic, documentation, minor inconsistency |

---

## P0 - Critical (Must Fix Immediately)

| ID | Module | Title | Description | Location |
|----|--------|-------|-------------|----------|
| TD-001 | Revenue Engine | **Syntax errors prevent compilation** | 20+ TypeScript errors: Python `#` comments, typos, undefined variables | `src/providers/orchestrator/execution-pipeline.ts`, `load-balancer.ts`, `rate-limit-manager.ts`, `provider-orchestrator.ts` |
| TD-002 | Research Engine | **Syntax error in ProviderRegistry** | Missing closing `>` in generic type declaration | `providers/registry.ts:4` |
| TD-003 | Dashboard | **TypeScript compilation fails** | 2 errors: `agentId` prop mismatch, `DepartmentId` not exported | `app/page.tsx:151`, `components/ceo-briefing.tsx:9` |
| TD-004 | All Modules | **Zero test coverage** | No unit, integration, or e2e tests exist anywhere | Entire repo |
| TD-005 | All Modules | **No cross-module integration** | All modules isolated — no event flow, no DI, no shared state | Architecture-wide |
| TD-006 | Memory | **Duplicate MemoryEngine implementations** | Two complete, incompatible memory systems (`memory-engine/` and `kernel/src/memory/`) | `memory-engine/`, `kernel/src/memory/` |
| TD-007 | Kernel | **No persistence layer** | All state in-memory — restart loses everything | `kernel/task_queue`, `kernel/event_bus`, `kernel/agent_registry` |
|

---

## P1 - High (Major Gaps)

| ID | Module | Title | Description | Location |
|----|--------|-------|-------------|----------|
| TD-008 | Kernel | **Planner creates single task only** | `SequentialPlanner.plan()` returns TaskGraph with 1 task — no DAG decomposition | `kernel/planner/index.ts` |
| TD-009 | Kernel | **No workflow/DAG execution** | TaskGraph types support DAG but executor only runs root task | `kernel/executor/index.ts`, `kernel/task_queue/index.ts` |
| TD-010 | Kernel | **No model routing** | Spec in MODEL_ROUTING.md, zero implementation | — |
| TD-011 | Kernel | **No human approval gates** | TaskStatus has WAITING_FOR_APPROVAL but no logic | `kernel/types/task.ts`, `kernel/executor/index.ts` |
| TD-012 | Research | **All providers are mocks** | CompanyDiscovery, WebsiteAnalysis, etc. return hardcoded/Math.random() data | `research/*/index.ts` |
| TD-013 | Revenue | **All provider adapters are stubs** | 14 adapters (Firecrawl, Apollo, LinkedIn, etc.) have empty implementations | `revenue-engine/src/providers/adapters/*` |
| TD-014 | Dashboard | **No Kernel connection** | `KernelConnection` interface defined, no implementation | `dashboard/lib/events.ts:343-349` |
| TD-015 | Dashboard | **All data is demo/mock** | `initializeDemoData()` populates entire state — no real data | `dashboard/lib/store-context.tsx:487-577` |
| TD-016 | Agents | **No agent runtime** | Creative Director, Website Architect are docs only — no execution code | `agents/*/` |
| TD-017 | Voice | **No voice runtime** | Types and UI exist, no STT/TTS, no WebSocket, no Kernel integration | `dashboard/components/voice-panel.tsx` |
| TD-018 | Website Builder | **Not implemented** | Referenced in types, agents, revenue — zero code | — |
| TD-019 | Sales/Marketing/Automation | **Not implemented** | Referenced in Dashboard types/events — zero code | — |
| TD-020 | Memory (mem-engine) | **No storage providers** | All 15 modules use in-memory Maps — no PostgreSQL, Redis, Pinecone, etc. | `memory-engine/src/modules/*` |
| TD-021 | Memory (kernel) | **Single provider only** | Only Cognee provider — no fallback, no local alternative | `kernel/src/memory/cognee/` |
| TD-022 | Research | **ProviderRegistry uncompilable** | Syntax error blocks the provider fallback system | `research/providers/registry.ts` |
| TD-023 | Revenue | **Orchestrator broken** | CircuitBreaker, RetryManager, RateLimitManager, LoadBalancer all have syntax errors | `revenue-engine/src/providers/orchestrator/*` |

---

## P2 - Medium (Quality & Maintainability)

| ID | Module | Title | Description | Location |
|----|--------|-------|-------------|----------|
| TD-024 | Kernel | **EventBus history unbounded** | `history` array grows forever — no TTL or size limit | `kernel/event_bus/index.ts:9` |
| TD-025 | Kernel | **TaskQueue no persistence** | In-memory array, no durability | `kernel/task_queue/index.ts` |
| TD-026 | Kernel | **AgentRegistry no persistence** | In-memory Map, no durability | `kernel/agent_registry/index.ts` |
| TD-027 | Dashboard | **Store notifies all on any change** | `notify()` calls all listeners for any state change — potential re-render storms | `dashboard/lib/store-context.tsx:101-103` |
| TD-028 | Dashboard | **Math.random() for IDs** | Non-crypto random used for message/briefing/activity IDs | `store-context.tsx:106`, `page.tsx:421`, `character.tsx:229` |
| TD-029 | Dashboard | **Hardcoded keyword routing in VoicePanel** | If/else chain for agent selection — not extensible | `voice-panel.tsx:149-163` |
| TD-030 | Research | **Regex HTML parsing** | Fragile, XSS risk if rendered, misses dynamic content | `website_analysis/index.ts`, `seo_analysis/index.ts` |
| TD-031 | Research | **Hardcoded competitor DB** | Only 5 companies in COMPETITOR_DB | `competitor_analysis/index.ts:4-10` |
| TD-032 | Revenue | **Empty adapter implementations** | All 14 adapters return `ok({ status: "available" })` — no real health checks | `revenue-engine/src/providers/adapters/*` |
| TD-033 | Memory (mem-engine) | **No vector search** | Semantic search is text substring matching | `memory-engine/src/lifecycle/retrieve.ts` |
| TD-034 | Memory (mem-engine) | **SecurityManager stub** | Created but no actual encryption/access control logic | `memory-engine/src/security/MemorySecurityManager.ts` |
| TD-035 | All | **No monorepo workspace** | Independent package.json files, no shared dependency management | Root |
| TD-036 | All | **Inconsistent TypeScript configs** | Different targets, module systems, strictness levels | Each module |
| TD-037 | Kernel | **No distributed tracing propagation** | trace_id/span_id generated but not passed to sub-operations | `kernel/kernel.ts`, `kernel/event_bus/index.ts` |
| TD-038 | Dashboard | **CharacterFace complex inline SVG** | 400+ lines of SVG animation logic in component — hard to maintain | `dashboard/components/character.tsx` |
| TD-039 | Revenue | **ExecutionPipeline uses `#` comments** | Python syntax in TypeScript files — indicates copy-paste from Python | `execution-pipeline.ts:182,369-372,386-391,402` |
| TD-040 | Kernel | **ConsoleLogger only** | No structured logging backend (Datadog, CloudWatch, etc.) | `kernel/logging/index.ts` |

---

## P3 - Low (Cosmetic & Documentation)

| ID | Module | Title | Description | Location |
|----|--------|-------|-------------|----------|
| TD-041 | Docs | **Documentation describes target, not reality** | All .md files describe planned architecture, not current implementation | All .md files |
| TD-042 | Kernel | **Unused imports in index.ts** | Exports types/interfaces not used by Kernel class | `kernel/index.ts` |
| TD-043 | Dashboard | **Unused event types** | 52 event types defined, only ~10 used in emotionFromEvent | `dashboard/lib/events.ts` |
| TD-044 | Research | **Unused provider types** | Provider interfaces defined but registry broken | `research/providers/types.ts` |
| TD-045 | Revenue | **Duplicate provider directories** | `src/providers/adapters/` and `business-discovery/providers/` both have Firecrawl, Apollo | `revenue-engine/src/providers/adapters/`, `business-discovery/providers/` |
| TD-046 | Character | **DepartmentId defined in two places** | `dashboard/components/characters/core/types.ts` and `dashboard/lib/events.ts` | Both files |
| TD-047 | All | **No .env.example files** | No documentation of required environment variables | Each module |
| TD-048 | Kernel | **DefaultConfig magic strings** | Priority strings duplicated in config and TaskQueue | `kernel/config/index.ts`, `kernel/task_queue/index.ts` |

---

## Debt by Category

| Category | P0 | P1 | P2 | P3 | Total |
|----------|----|----|----|----|-------|
| Compilation/Build | 3 | 0 | 0 | 0 | 3 |
| Architecture/Integration | 2 | 5 | 2 | 1 | 10 |
| Missing Features | 1 | 7 | 0 | 0 | 8 |
| Code Quality | 0 | 0 | 8 | 2 | 10 |
| Testing | 1 | 0 | 0 | 0 | 1 |
| Security | 0 | 0 | 0 | 0 | 0 |
| Documentation | 0 | 0 | 0 | 1 | 1 |
| **Total** | **7** | **12** | **10** | **4** | **33** |

---

## Remediation Priority Order

1. **TD-001, TD-002, TD-003** — Fix all compilation errors (Revenue, Research, Dashboard)
2. **TD-006** — Consolidate two MemoryEngine implementations
3. **TD-005** — Establish Kernel ↔ Module integration contracts
4. **TD-004** — Add test infrastructure (vitest/jest + testing library)
5. **TD-007** — Add persistence layer (SQLite/PostgreSQL for Kernel state)
6. **TD-008, TD-009** — Implement DAG planner and executor
7. **TD-012, TD-013** — Implement at least one real provider per capability
8. **TD-014, TD-015** — Implement KernelConnection for Dashboard
9. **TD-016, TD-017, TD-018, TD-019** — Implement agent runtime or remove from types
10. **TD-024, TD-025, TD-026** — Add persistence to Kernel core
11. **TD-020, TD-021** — Add storage providers to MemoryEngine
12. **TD-027, TD-028** — Fix Dashboard store performance and ID generation
13. **TD-030, TD-031** — Replace Research mocks with real implementations
14. **TD-039** — Clean up Python syntax in RevenueEngine
15. Remaining P2/P3 items

---

## Estimated Effort to Clear P0/P1

| Item | Effort (days) | Dependencies |
|------|---------------|--------------|
| Fix Revenue Engine syntax errors | 1 | None |
| Fix Research Engine syntax error | 0.5 | None |
| Fix Dashboard TypeScript errors | 0.5 | None |
| Consolidate MemoryEngines | 3 | TD-001-003 |
| Kernel ↔ Module integration contracts | 5 | TD-006 |
| Test infrastructure | 2 | None |
| Persistence layer | 3 | TD-006 |
| DAG Planner/Executor | 5 | TD-005 |
| Real provider implementations | 10 | TD-005 |
| KernelConnection for Dashboard | 3 | TD-005 |
| Agent runtime | 10 | TD-005 |
| Voice runtime | 5 | TD-005 |
| **Total P0/P1** | **~48 days** | |

---

## Debt Not Worth Fixing (Delete/Replace)

| Item | Reason |
|------|--------|
| `memory-engine/` OR `kernel/src/memory/` | Keep one, delete the other — duplicate |
| Research Engine mock providers | Replace entirely with real implementations |
| Revenue Engine stub adapters | Replace entirely with real implementations |
| Dashboard `initializeDemoData()` | Remove once real data flows exist |
| `voice-panel.tsx` keyword routing | Replace with intent classification |