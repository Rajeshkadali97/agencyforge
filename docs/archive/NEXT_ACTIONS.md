# NEXT_ACTIONS.md

**Updated:** 2026-07-11
**Reporter:** AgencyForge CTO

---

## Status: Stage 2 Integration Complete

All Stage 2 integration milestones are done. The system is production-ready for core workflows.

---

## Completed (Stage 2)

| Item | Done |
|------|------|
| Runtime build system | ✅ |
| 9Router AI gateway (NineRouterProvider) | ✅ |
| Plugin system (PluginRegistry + manifests) | ✅ |
| Firecrawl, Flowise, Paperclip, Research plugin manifests | ✅ |
| ResearchBridge event wiring (RESEARCH_COMPLETED) | ✅ |
| CognitiveMemoryBridge (ESM/CJS dynamic import) | ✅ |
| kernel CognitiveMemoryProvider adapter | ✅ |
| Memory subscriptions (RESEARCH_COMPLETED, LEAD_SCORED, PROPOSAL_GENERATED) | ✅ |
| Revenue-engine adapters: firecrawl, google-search, csv-import, manual-entry, apollo, google-maps, linkedin | ✅ |
| Memory scoping ADR (M7) + kernel adapter + bootstrap wire-up (M8) | ✅ |
| UnifiedEventBus deleted; EnhancedEventBus canonical (M9) | ✅ |
| Integration smoke tests (8 test files, 34 tests) | ✅ |
| AgentRegistry capability index fix | ✅ |
| ResearchAgent + LeadScorerAgent at bootstrap | ✅ |
| Goal → 2-step DAG workflow (research + lead scoring) | ✅ |
| SQLite state store (env-gated via AGENCYFORGE_DB_PATH) | ✅ |
| PersistenceService wired (all events persisted to SQLite when configured) | ✅ |
| Math.random() replaced with crypto.randomUUID() (5 dashboard files) | ✅ |
| Design/ cleanup (unique assets moved, redundant files deleted) | ✅ |

---

## Remaining Items

### Credentials-Dependent (Cannot Proceed Without)

- Voice STT/TTS: requires `OPENAI_API_KEY` or `ELEVENLABS_API_KEY`
- Real provider APIs: Firecrawl (`FIRECRAWL_API_KEY`), Apollo (`APOLLO_API_KEY`), Google Maps (`GOOGLE_MAPS_API_KEY`), LinkedIn (`LINKEDIN_ACCESS_TOKEN`), Serper (`SERPER_API_KEY`)

### Infrastructure-Dependent

- Website Builder: ~15 days effort, requires deploy infrastructure
- Human approval gate: enum and config fields exist; WorkflowEngine pause/resume logic not implemented

### Low Priority

- `character.tsx` Math.random() for animation blink timing (not an ID — acceptable)
- Clutch provider adapter stub in revenue-engine

---

## Definition of Done — Checklist

- [x] All planned milestones implemented
- [x] Repo builds successfully (runtime, dashboard, kernel, research, revenue-engine)
- [x] Tests pass: 8/8 files, 34/34 tests
- [x] No unapproved duplicates
- [x] ADR-matching architecture (memory scoping, event bus)
- [x] Plugin/provider routing operational (9Router + PluginRegistry)
- [x] Core workflows executing (goal to research to lead-scoring to events)
- [x] Dashboard-runtime communication working (SSE bridge via RuntimeBridge)
- [x] Memory subsystem operational (CognitiveMemoryBridge + subscriptions)
- [x] Lead-gen subsystem operational (LeadScorerAgent + 7 revenue adapters)
- [x] Research subsystem operational (ResearchAgent + ResearchBridge)
- [x] Revenue subsystem operational (7 provider adapters implemented)
- [x] Docs reflecting implementation
