# AgencyForge Next Action Plan

**Generated:** 2026-06-28  
**Purpose:** Top 20 blockers preventing AgencyForge from becoming a working product  
**Prioritization:** Revenue impact → User value → Technical dependency → Implementation effort

---

## Blocker Priority Matrix

| # | Blocker | Revenue Impact | User Value | Tech Dependency | Effort | Priority Score |
|---|---------|----------------|------------|-----------------|--------|----------------|
| 1 | Revenue Engine doesn't compile | 🔴 Critical | 🔴 Critical | None | 1 day | **100** |
| 2 | Research Engine doesn't compile | 🔴 Critical | 🟡 High | None | 0.5 day | **95** |
| 3 | Dashboard doesn't compile | 🟡 High | 🔴 Critical | None | 0.5 day | **90** |
| 4 | No Kernel ↔ Module integration | 🔴 Critical | 🔴 Critical | All modules | 5 days | **85** |
| 5 | Two duplicate MemoryEngines | 🔴 Critical | 🟡 High | Memory | 3 days | **80** |
| 6 | Zero test coverage | 🔴 Critical | 🟡 High | All modules | 2 days | **75** |
| 7 | No persistence layer | 🔴 Critical | 🟡 High | Kernel, Memory | 3 days | **70** |
| 8 | Planner creates single task only | 🔴 Critical | 🔴 Critical | Kernel | 5 days | **85** |
| 9 | No real providers (all mocks) | 🔴 Critical | 🟡 High | Research, Revenue | 10 days | **70** |
| 10 | No KernelConnection for Dashboard | 🟡 High | 🔴 Critical | Dashboard, Kernel | 3 days | **65** |
| 11 | No agent runtime | 🔴 Critical | 🔴 Critical | Kernel | 10 days | **75** |
| 12 | No voice runtime | 🟡 High | 🟡 High | Dashboard, Kernel | 5 days | **55** |
| 13 | No Website Builder | 🔴 Critical | 🟡 High | Agents, Revenue | 15 days | **60** |
| 14 | No Sales/Marketing/Automation modules | 🔴 Critical | 🟡 High | Dashboard, Revenue | 10 days | **55** |
| 15 | No model routing | 🟡 High | 🟡 High | Kernel | 5 days | **50** |
| 16 | No human approval gates | 🟡 High | 🟡 High | Kernel | 3 days | **50** |
| 17 | EventBus history unbounded | 🟢 Low | 🟢 Low | Kernel | 1 day | **20** |
| 18 | Dashboard store performance | 🟢 Low | 🟡 High | Dashboard | 1 day | **30** |
| 19 | Math.random() for IDs | 🟢 Low | 🟢 Low | Dashboard | 0.5 day | **15** |
| 20 | Documentation vs reality gap | 🟢 Low | 🟢 Low | All | 2 days | **20** |

---

## Top 20 Blockers — Detailed Action Items

### 1. 🔴 Revenue Engine Compilation Failure
**Impact:** Entire revenue pipeline (lead discovery, CRM, proposals, outreach) unusable  
**Root Cause:** Python `#` comments in TypeScript files, typos, undefined variables  
**Files:** 
- `revenue-engine/src/providers/orchestrator/execution-pipeline.ts` (lines 182, 369-372, 386-391, 402)
- `revenue-engine/src/providers/orchestrator/load-balancer.ts` (line 184)
- `revenue-engine/src/providers/orchestrator/rate-limit-manager.ts` (line 125)
- `revenue-engine/src/providers/orchestrator/provider-orchestrator.ts` (line 412)

**Action:** Replace all `#` with `//`, fix `compareProvider Suitability` → `compareProviderSuitability`, fix `keyProviderId` → `keyGenerator(providerId, operation)`, fix `# this could handle` → `// this could handle`

**Effort:** 1 day  
**Owner:** Backend Engineer  
**Verification:** `cd "revenue engine/revenue-engine" && npx tsc --noEmit` passes

---

### 2. 🔴 Research Engine Compilation Failure
**Impact:** Research pipeline (company discovery, website analysis, SEO, competitor) unusable  
**Root Cause:** Missing closing `>` in generic type  
**File:** `research/providers/registry.ts:4`  
`private companyDiscoveryProviders: IProvider<CompanyDiscoveryProvider[] = [];`

**Action:** Fix to `private companyDiscoveryProviders: IProvider<CompanyDiscoveryInput, CompanyDiscoveryOutput>[] = [];`

**Effort:** 0.5 day  
**Owner:** Backend Engineer  
**Verification:** `cd research && npx tsc --noEmit` passes

---

### 3. 🔴 Dashboard Compilation Failure
**Impact:** Cannot build/deploy Dashboard UI  
**Root Cause:** Two TypeScript errors  
**Files:**
- `app/page.tsx:151` — `DepartmentCard` expects `agent` object, receives `agentId` string
- `components/ceo-briefing.tsx:9` — `DepartmentId` not exported from `@/lib/events`

**Action:** 
1. Pass full `agent` object to `DepartmentCard` in `page.tsx`
2. Export `DepartmentId` from `dashboard/lib/events.ts`

**Effort:** 0.5 day  
**Owner:** Frontend Engineer  
**Verification:** `cd dashboard && npx tsc --noEmit` passes

---

### 4. 🔴 No Kernel ↔ Module Integration
**Impact:** Modules cannot communicate — Kernel orchestrates nothing  
**Root Cause:** No shared event bus, no DI across modules, no provider registration with Kernel  
**Evidence:** Integration Matrix shows ❌ for all cross-module pairs

**Action:**
1. Define `KernelModule` interface with `initialize(kernel: IKernel)`, `shutdown()`
2. Create `ModuleRegistry` in Kernel to register modules
3. Wire Kernel EventBus → Module event handlers
4. Implement `KernelConnection` for Dashboard (WebSocket or Server-Sent Events)
5. Register ResearchEngine, RevenueEngine, MemoryEngine as Kernel modules

**Effort:** 5 days  
**Owner:** Platform Engineer  
**Verification:** Kernel.ingestGoal() triggers ResearchEngine → stores to MemoryEngine → updates Dashboard

---

### 5. 🔴 Duplicate MemoryEngine Implementations
**Impact:** Confusion, wasted effort, inconsistent APIs, double maintenance burden every consumer  
**Root Cause:** Two complete systems: `memory-engine/` (15 modules, pipelines) and `kernel/src/memory/` (Cognee provider)

**Action:**
1. **Decision:** Keep `kernel/src/memory/` as primary (integrated with Kernel exports, has Cognee)
2. Migrate `memory-engine/` unique features (15 module types, lifecycle pipelines) into `kernel/src/memory/`
3. Delete `memory-engine/` directory
4. Update all imports (currently none — modules don't use either)

**Effort:** 3 days  
**Owner:** Backend Engineer  
**Verification:** Single MemoryEngine, all 15 module types available, Cognee provider works

---

### 6. 🔴 Zero Test Coverage
**Impact:** No regression detection, no confidence in changes, no CI gate  
**Root Cause:** No test infrastructure, no test files

**Action:**
1. Add `vitest` to each module (or root workspace)
2. Create test utilities: `createMockKernel()`, `createMockMemoryEngine()`, `createMockEventBus()`
3. Write critical path tests:
   - Kernel: goal ingestion → task execution → event emission
   - Memory: store → retrieve → search → delete
   - Research: research() → report structure
   - Revenue: provider orchestration (retry, circuit breaker)
   - Dashboard: store updates → component re-renders
4. Add GitHub Actions CI workflow

**Effort:** 2 days (infrastructure) + ongoing  
**Owner:** QA/Platform Engineer  
**Verification:** `npm test` passes in all modules, CI green

---

### 7. 🔴 No Persistence Layer
**Impact:** All state lost on restart — unusable for production  
**Root Cause:** Everything in-memory (Maps, arrays)

**Action:**
1. **Kernel:** Add PostgreSQL adapter for TaskQueue, AgentRegistry, EventBus history
2. **MemoryEngine:** Add provider interface for persistent storage (PostgreSQL + pgvector, or Pinecone/Weaviate)
3. **Dashboard:** Add localStorage/IndexedDB for offline queue
4. Create migration system for schema changes

**Effort:** 3 days (initial) + ongoing  
**Owner:** Backend Engineer  
**Verification:** Restart Kernel → tasks/agents/events persist

---

### 8. 🔴 Planner Creates Single Task Only
**Impact:** Cannot decompose complex goals — no multi-step workflows  
**Root Cause:** `SequentialPlanner.plan()` returns TaskGraph with 1 root task

**Action:**
1. Implement `DAGPlanner` that:
   - Parses goal into subtasks (LLM-based or rule-based)
   - Creates TaskGraph with dependencies
   - Assigns capabilities to each task
2. Update `TaskQueue` to handle DAG (topological sort, parallel execution)
3. Update `BasicExecutor` to execute DAG (wait for dependencies, run parallel)
4. Add `TaskGraph` visualization for debugging

**Effort:** 5 days  
**Owner:** Backend Engineer  
**Verification:** Goal "Build website" → creates Research → Design → Build → Deploy tasks with correct dependencies

---

### 9. 🔴 No Real Providers (All Mocks)
**Impact:** Research and Revenue engines return fake data — no real business value  
**Root Cause:** All provider implementations are stubs returning hardcoded/Math.random() data

**Action (Priority Order):**
1. **Firecrawl** — Website scraping (Revenue + Research)
2. **Apollo** — Business discovery/enrichment (Revenue)
3. **Google Maps/Places** — Local business discovery (Revenue)
4. **LinkedIn** — Contact/profile enrichment (Revenue)
5. **OpenAI/Anthropic** — LLM calls for analysis (Research)
6. **Cognee** — Already implemented for Memory

**For each provider:**
1. Implement `onInitialize(config)` with real API client
2. Implement `execute(capability, operation, params)` with real API calls
3. Implement `onHealthCheck()` with real API ping
4. Add rate limiting, error handling, retries
5. Register with ProviderRegistry

**Effort:** 10 days (2 days per provider × 5)  
**Owner:** Backend Engineer  
**Verification:** ResearchEngine.research("stripe.com") → real company data

---

### 10. 🔴 No KernelConnection for Dashboard
**Impact:** Dashboard shows only mock data — no real-time updates  
**Root Cause:** `KernelConnection` interface defined in `dashboard/lib/events.ts:343-349` but no implementation

**Action:**
1. Implement `KernelConnection` using WebSocket (Socket.io) or Server-Sent Events
2. Kernel: Add WebSocket server (`ws` or `socket.io`) broadcasting Kernel events
3. Dashboard: Connect on mount, subscribe to event types
4. Map Kernel events → Dashboard events (using `emotionFromEvent`)
5. Add reconnection logic, auth token

**Effort:** 3 days  
**Owner:** Full-stack Engineer  
**Verification:** Kernel emits `task.started` → Dashboard agent shows "busy" emotion

---

### 11. 🔴 No Agent Runtime
**Impact:** Creative Director, Website Architect are documentation only — cannot execute  
**Root Cause:** No agent execution framework, no LLM integration, no tool calling

**Action:**
1. Define `AgentRuntime` interface: `execute(task: Task, context: AgentContext): Promise<TaskResult>`
2. Implement `LLMAgentRuntime` using OpenAI/Anthropic SDK:
   - Load system prompt from agent config
   - Inject context (memory, tools, previous results)
   - Parse structured output (JSON schema validation)
   - Handle tool calls (MCP, function calling)
3. Register agents in Kernel AgentRegistry with capabilities
4. Update `BasicExecutor` to use `AgentRuntime` instead of mock success

**Effort:** 10 days  
**Owner:** AI Engineer  
**Verification:** Kernel assigns task to "creative-director" → LLM executes → returns PRD

---

### 12. 🟡 No Voice Runtime
**Impact:** Voice UI exists but non-functional — no STT/TTS, no command processing  
**Root Cause:** `VoicePanel` is UI only, no WebSocket, no audio capture, no Kernel integration

**Action:**
1. Add Web Speech API or WebRTC for browser audio capture
2. Implement STT: OpenAI Whisper API or browser Web Speech API
3. Implement TTS: OpenAI TTS or ElevenLabs
4. Connect voice commands → Kernel.ingestGoal() via KernelConnection
5. Add wake word detection (Porcupine or simple keyword)
6. Sync CharacterFace emotion with voice state (listening/speaking/thinking)

**Effort:** 5 days  
**Owner:** Frontend/AI Engineer  
**Verification:** User says "Research dentists in Texas" → Dashboard shows Research agent working

---

### 13. 🟡 No Website Builder
**Impact:** Core Studio capability missing — cannot generate/deploy websites  
**Root Cause:** Referenced in agents, revenue, dashboard types — zero implementation

**Action:**
1. Implement `WebsiteBuilder` module with capabilities:
   - `website.generate` (React/Next.js code from spec)
   - `website.preview` (deploy to preview URL)
   - `website.deploy` (deploy to production)
2. Integrate with Website Architect agent output (PRD → code)
3. Use React code generation (AST-based or template-based)
4. Deploy to Vercel/Netlify via API

**Effort:** 15 days  
**Owner:** Full-stack Engineer  
**Verification:** Website Architect agent → WebsiteBuilder → live preview URL

---

### 14. 🟡 No Sales/Marketing/Automation Modules
**Impact:** Agency layer incomplete — Dashboard shows departments but no backend  
**Root Cause:** Only types/events exist in Dashboard, no backend modules

**Action:**
1. **Sales:** Implement `SalesEngine` with `ProposalGenerator`, `CRMSync`, `DealTracker`
2. **Marketing:** Implement `MarketingEngine` with `CampaignPlanner`, `ContentGenerator`, `Analytics`
3. **Automation:** Implement `AutomationEngine` with `WorkflowRunner`, `Scheduler`, `Integrations`
4. Each follows RevenueEngine provider pattern

**Effort:** 10 days  
**Owner:** Backend Engineer  
**Verification:** Dashboard Sales agent → real proposal generation

---

### 15. 🟡 No Model Routing
**Impact:** All LLM calls hardcoded to single model — no cost/quality optimization  
**Root Cause:** Spec in MODEL_ROUTING.md, zero implementation

**Action:**
1. Implement `ModelRouter` with:
   - Provider registry (OpenAI, Anthropic, Google, Ollama, OpenRouter)
   - Capability matrix (reasoning, coding, creative, fast, cheap)
   - Cost tracking per call
   - Fallback chain
2. Integrate with `AgentRuntime` and `Kernel`

**Effort:** 5 days  
**Owner:** AI Engineer  
**Verification:** Complex task → GPT-4, Simple task → GPT-4o-mini, Local → Ollama

---

### 16. 🟡 No Human Approval Gates
**Impact:** No human-in-the-loop — autonomous only, no review checkpoints  
**Root Cause:** TaskStatus has `WAITING_FOR_APPROVAL` but no logic

**Action:**
1. Add `ApprovalGate` to TaskGraph nodes
2. Kernel: Pause execution at approval nodes, emit `checkpoint.approval_required`
3. Dashboard: Show approval UI (approve/reject/modify)
4. Resume execution on approval

**Effort:** 3 days  
**Owner:** Backend Engineer  
**Verification:** Workflow pauses at "Deploy to production" → Dashboard shows approval → Resumes on approve

---

### 17. 🟢 EventBus History Unbounded
**Impact:** Memory leak over time  
**Root Cause:** `EventBus.history` array grows forever

**Action:** Add max history size (e.g., 10000), auto-trim on publish

**Effort:** 1 day  
**Owner:** Backend Engineer  
**Verification:** 20000 events published → history length ≤ 10000

---

### 18. 🟢 Dashboard Store Performance
**Impact:** Potential re-render storms on any state change  
**Root Cause:** `notify()` calls all listeners for any change

**Action:** 
1. Use granular selectors (subscribe to specific state slices)
2. Or use `useSyncExternalStore` with selector support

**Effort:** 1 day  
**Owner:** Frontend Engineer  
**Verification:** Update single agent → only that agent's components re-render

---

### 19. 🟢 Math.random() for IDs
**Impact:** Collision risk, non-deterministic, not crypto-safe  
**Root Cause:** Used in `store-context.tsx`, `page.tsx`, `character.tsx`, `hooks/use-toast.tsx`

**Action:** Replace with `crypto.randomUUID()` or `nanoid`

**Effort:** 0.5 day  
**Owner:** Frontend Engineer  
**Verification:** No `Math.random()` in source (excluding node_modules)

---

### 20. 🟢 Documentation vs Reality Gap
**Impact:** Developers misled by specs that don't match code  
**Root Cause:** All .md files describe target architecture

**Action:**
1. Add "Implementation Status" section to each .md file
2. Or create `ARCHITECTURE_AS_IS.md` documenting current state
3. Mark unimplemented sections clearly

**Effort:** 2 days  
**Owner:** Tech Writer/Architect  
**Verification:** README links to accurate status doc

---

## Execution Sequence (Dependency-Aware)

```
Week 1:  [1, 2, 3] → Fix all compilation errors (parallel)
Week 2:  [5] → Consolidate MemoryEngines
Week 3:  [4] → Kernel ↔ Module integration contracts
Week 4:  [6] → Test infrastructure + [7] Persistence layer (parallel)
Week 5:  [8] → DAG Planner/Executor
Week 6-7:[9] → Real providers (Firecrawl, Apollo, Google Maps, LinkedIn, OpenAI)
Week 8:  [10] → KernelConnection for Dashboard
Week 9:  [11] → Agent Runtime (LLM execution)
Week 10: [12] → Voice Runtime
Week 11: [15] → Model Routing + [16] Human Approval Gates
Week 12: [13] → Website Builder
Week 13: [14] → Sales/Marketing/Automation modules
Ongoing: [17, 18, 19, 20] → Quality improvements
```

---

## Success Criteria (Definition of Done)

| Blocker | Verification |
|---------|--------------|
| 1-3 | All `npx tsc --noEmit` pass |
| 4 | `Kernel.ingestGoal()` → ResearchEngine → MemoryEngine → Dashboard update |
| 5 | Single `MemoryEngine` import, `memory-engine/` deleted |
| 6 | `npm test` passes in all modules, CI green |
| 7 | Restart Kernel → tasks/agents persist |
| 8 | Complex goal → multi-task DAG with parallel execution |
| 9 | `ResearchEngine.research("real-company.com")` → real data |
| 10 | Voice command → Dashboard agent emotion change in <500ms |
| 11 | Kernel assigns task to agent → LLM executes → structured result |
| 12 | Browser mic → STT → Kernel → TTS → Speaker |
| 13 | Website Architect output → live preview URL |
| 14 | Dashboard Sales agent → real proposal PDF |
| 15 | Task complexity → appropriate model selected + cost logged |
| 16 | Workflow pauses at gate → Dashboard approve → Resumes |

---

## Resource Requirements

| Role | Weeks Needed | Focus |
|------|--------------|-------|
| Platform Engineer | 4 | Kernel integration, persistence, CI |
| Backend Engineer | 8 | Providers, Revenue/Research engines, Memory |
| AI Engineer | 4 | Agent runtime, Model routing, Voice STT/TTS |
| Frontend Engineer | 3 | Dashboard connection, Voice UI, Store optimization |
| QA/DevOps | 2 | Test infra, CI, deployment |

**Total: ~21 engineer-weeks to clear all P0/P1 blockers**