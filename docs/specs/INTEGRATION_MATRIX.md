# AgencyForge Integration Matrix

**Updated:** 2026-07-11
**Scope:** Cross-module communication verification (Stage 2 complete)

---

## Integration Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully Implemented — wired, typed, operational |
| 🟡 | Partial — one direction only, or types/mocks only |
| ❌ | Missing — no integration code |

---

## Module-to-Module Integration Matrix (Current)

| From \ To | Runtime | Memory Engine | Research | Revenue | Dashboard | Plugin System |
|-----------|---------|---------------|----------|---------|-----------|---------------|
| **Runtime** | — | ✅ CognitiveMemoryBridge | ✅ ResearchAgent + ResearchBridge | ✅ LeadScorerAgent + 7 adapters | ✅ SSE bridge | ✅ PluginRegistry |
| **Memory Engine** | 🟡 Events only | — | ❌ | ❌ | ❌ | ❌ |
| **Research** | ✅ RESEARCH_COMPLETED events | 🟡 Via runtime bridge | — | ❌ | ❌ | ✅ research manifest |
| **Revenue** | ✅ LEAD_SCORED events | 🟡 Via runtime bridge | ❌ | — | ❌ | ❌ |
| **Dashboard** | ✅ SSE + REST (/api/runtime/*) | ❌ | ❌ | ❌ | — | ❌ |
| **9Router** | ✅ NineRouterProvider | ❌ | ❌ | ❌ | ✅ /ai-routing page | ❌ |

---

## Detailed Integration Status

### Runtime to Memory Engine
- **CognitiveMemoryBridge** (`runtime/src/bindings/memory/CognitiveMemoryBridge.ts`) — dynamically imports `@agencyforge/memory-engine` (ESM) from CJS runtime; wraps with `MemoryEngineAdapter`
- **Event subscriptions**: `RESEARCH_COMPLETED` to store (type: 'business', importance: 0.8), `LEAD_SCORED` to store (importance: 0.9/0.7/0.5 by tier), `PROPOSAL_GENERATED` to store (type: 'project')
- **PersistenceService** wired to EnhancedEventBus `'*'` wildcard; all events persisted to SQLite when `AGENCYFORGE_DB_PATH` set

### Runtime to Research
- **ResearchAgent** (`runtime/src/agent/impl/ResearchAgent.ts`) — capability: 'research'; registered at bootstrap
- **ResearchBridge** (`runtime/src/integration/ResearchBridge.ts`) — delegates to 'research.company' plugin; publishes `RuntimeEventTypes.RESEARCH_COMPLETED`
- **2-step DAG**: `step_research` invokes `ResearchAgent.execute()`, publishes `RESEARCH_COMPLETED`

### Runtime to Revenue / Lead Gen
- **LeadScorerAgent** (`runtime/src/integrations/leads/LeadScorerAgent.ts`) — capability: 'bant-scoring'; registered at bootstrap
- **7 provider adapters**: firecrawl, google-search, csv-import, manual-entry, apollo, google-maps, linkedin — all with real `onExecute()`; all credentials via env vars only
- **2-step DAG**: `step_lead_scoring` depends on `step_research`; invokes `LeadScorerAgent.execute()`, publishes `LEAD_SCORED`

### Runtime to Dashboard
- **RuntimeBridge** (`runtime/src/bridge/RuntimeBridge.ts`) — SSE endpoint `/api/runtime/stream`; REST: `/api/runtime/snapshot`, `/api/runtime/memory`, `/api/ai/routing`
- Dashboard `/ai-routing` page shows live AI routing health (10s poll)

### Runtime to Plugin System
- **PluginRegistry** (`runtime/src/plugins/PluginRegistry.ts`) — singleton; `getByCapability()` for capability lookup
- **Manifests**: Firecrawl (web.scrape, web.search, web.map), Flowise (workflow.list, workflow.execute, workflow.import), Paperclip (org.listTeams, org.assignGoal, ...), Research (wraps @agencyforge/research)

### 9Router to Runtime
- **NineRouterProvider** (`runtime/src/ai/providers/ninerouter.ts`) — `localhost:20128/v1`; first in AI provider chain; health-checked
- Flow: Dashboard to Runtime to 9Router to Selected AI Provider (never direct calls to OpenAI/Claude/Gemini)

---

## Operational Event Flow

```
User submits goal
    → RuntimeCoordinator.executeGoal()
    → WorkflowEngine (2-step DAG)
        → step_research: ResearchAgent.execute()
            → RESEARCH_COMPLETED published
            → CognitiveMemoryBridge.store() (type: business)
            → PersistenceService.persistEvent()
        → step_lead_scoring: LeadScorerAgent.execute()
            → LEAD_SCORED published
            → CognitiveMemoryBridge.store() (tier-based importance)
            → PersistenceService.persistEvent()
    → RuntimeBridge SSE broadcast to Dashboard
```

---

## Known Gaps (Not Critical)

| Gap | Reason Not Critical |
|----|----------------|
| Voice STT/TTS not wired | Credentials required; UI exists |
| Dashboard CEO approval gate | Enum + config exist; WorkflowEngine pause/resume not implemented |
| Website Builder | Out of scope for Stage 2 |
