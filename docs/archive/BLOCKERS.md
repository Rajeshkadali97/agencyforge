# BLOCKERS.md

**Updated:** 2026-07-11
**Reporter:** AgencyForge CTO

---

## Active Blockers

None. All previously identified critical blockers are resolved.

---

## Pending Items (Not Blockers)

### Voice STT/TTS — Credentials Required

**Issue:** `VoiceBinding` and `VoiceEngine` exist; browser STT/TTS requires API key
**Options:** OpenAI Whisper (`OPENAI_API_KEY`) or ElevenLabs (`ELEVENLABS_API_KEY`)
**Impact:** Voice panel UI exists but has no audio backend
**Status:** Not a blocker for any other subsystem

### Website Builder — Infrastructure Required

**Issue:** Referenced in types but not implemented
**Effort:** ~15 days per original plan; requires deploy infrastructure
**Status:** Deferred; not a blocker for core workflows

---

## Resolved Blockers (History)

| Date | Blocker | Resolution |
|------|---------|------------|
| June 28 | Revenue Engine: 20+ syntax errors | Fixed Python `#` comments → `//` |
| June 28 | Research Engine: ProviderRegistry syntax error | Fixed generic syntax |
| June 28 | Dashboard: 2 type errors | Fixed props interface |
| June 29 | memory-engine: 140+ compilation errors | Consolidated interfaces, fixed imports |
| June 30 | Runtime: No build system | Created package.json, tsconfig.json |
| June 30 | Runtime: No module integration | Stage 2 integration wiring completed |
| July 10 | ResearchBridge: wrong event type string | Fixed: `RuntimeEventTypes.RESEARCH_COMPLETED` |
| July 10 | AgentRegistry: capability index bug | Fixed: `register()` populates index; `findByCapability()` checks legacyAgents |
| July 11 | Test suite: EADDRINUSE on port 3001/3002 | Fixed: port 0 in VITEST env; 181s to 2.29s |
