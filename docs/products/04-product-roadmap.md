# Product Execution Roadmap

Prioritized by business value. Effort in developer-weeks (1 dev). Dependencies called out explicitly. Platform capabilities reused at each step noted.

Platform stability prerequisite: `docs/ROADMAP.md` v1.1 items (graceful shutdown, parallel step fix, JTI persistence) should land before product development begins at scale.

---

## Prioritization rationale

| Factor | Weight |
|---|---|
| Existing platform foundation (less build = faster ship) | High |
| Revenue-generating potential | High |
| Reusability of components built (agents, plugins) | High |
| Compliance and legal complexity | Risk factor (delays) |
| Greenfield scope | Risk factor (slows delivery) |

---

## Wave 1 — Leverage what already exists (Weeks 1–12)

These products have the most platform foundation. Fastest path to working software.

---

### W1.1 — Revenue Engine MVP (Weeks 1–6)

**Business value:** Direct revenue impact. `@agencyforge/revenue-engine` is already built. This is mostly wiring + dashboard.

**What already exists:**
- `@agencyforge/revenue-engine` — 6 domain services (discovery, scoring, audit, proposal, CRM, outreach)
- `RevenueAgent` — lead scoring + proposal generation via AgencyForge
- `LEAD_SCORED`, `PROPOSAL_GENERATED` events
- Firecrawl plugin (web scraping for research)

**What to build in Wave 1:**
- `packages/revenue-product/` shell (2 weeks)
- CRM Connector plugin — HubSpot first (1 week)
- Email Delivery plugin — SendGrid (1 week)
- Pipeline dashboard: Kanban view, lead detail, proposal preview (2 weeks)

**Deferred to Wave 2:** OutreachAgent, CRMSyncAgent, Salesforce connector

**Effort:** 6 weeks

**Platform capabilities reused:**
- `WorkflowEngine` — discovery → scoring → proposal → approval workflow
- `PluginRegistry` — Firecrawl, HubSpot, SendGrid registration
- `AgentRegistry` — RevenueAgent registration
- `PersistenceService` — lead + proposal storage
- `RuntimeBridge` SSE — real-time pipeline updates to dashboard

**Dependencies:** Firecrawl API key, HubSpot or Salesforce account, SendGrid account

---

### W1.2 — Research Studio MVP (Weeks 4–10)

**Business value:** Enables Revenue Engine's discovery phase. Also standalone product.

**What already exists:**
- `ResearchAgent` — web-scraping, research, competitor-analysis
- Firecrawl plugin — web.scrape, web.search, web.map

**What to build:**
- `DeepResearchAgent` (2 weeks) — multi-round, parallel search/scrape/synthesize
- `ReportAgent` (1 week) — structured report formatter
- PDF Export plugin (1 week) — `export.pdf` capability
- Research Studio dashboard: query UI, report viewer, scheduled jobs (3 weeks)

**Effort:** 7 weeks (overlaps with W1.1 — parallel track)

**Platform capabilities reused:**
- `ResearchAgent` + Firecrawl — core execution path
- `Scheduler` — recurring research jobs
- `WorkflowEngine` — deep-research workflow
- `CognitiveMemoryBridge` — past research deduplication
- `EnhancedEventBus` — `research.completed` subscription

**Dependencies:** Firecrawl API key, PDF generation library (e.g. `puppeteer`)

---

### W1.3 — Voice Assistant MVP (Weeks 8–16)

**Business value:** Differentiator product. Voice interface for all other products.

**What already exists:**
- `VoiceBinding` — full session + 6 event types
- `CharacterBinding` — persona management
- All `VOICE_*` event types in contracts

**What to build:**
- TTS plugin — ElevenLabs integration (1 week)
- STT plugin — Whisper API (1 week)
- `IntentClassifierAgent` (1 week)
- `VoiceOrchestrationAgent` (1 week)
- `CharacterAgent` (1 week)
- Voice console dashboard (2 weeks)
- Character configuration UI (1 week)

**Effort:** 8 weeks

**Platform capabilities reused:**
- `VoiceBinding` — session management, event routing
- `CharacterBinding` — persona selection
- `AgentRegistry` — intent routing to any registered agent
- `AIService` — response generation
- `MemoryBinding` — conversation history

**Dependencies:** ElevenLabs API key (or OpenAI TTS), HTTPS deployment (Web Speech API browser requirement), Chromium-based browser

---

## Wave 2 — Expand and deepen (Weeks 12–28)

Build on Wave 1 foundations. Introduce new products. Reuse agents and plugins built in Wave 1.

---

### W2.1 — Revenue Engine Full (Weeks 12–18)

Extend the Wave 1 MVP with outreach, CRM sync, and Salesforce.

**What to build:**
- `OutreachAgent` (2 weeks) — personalized email sequences, per-domain send limits
- `CRMSyncAgent` (1 week) — idempotent CRM push with memory-backed dedup
- Salesforce plugin (1 week) — mirrors HubSpot connector
- LinkedIn plugin (1 week) — `social.post` for outreach
- Outreach sequence builder dashboard module (2 weeks)

**Effort:** 7 weeks

**Reuses from Wave 1:** HubSpot plugin, SendGrid plugin, RevenueAgent, WorkflowEngine approval step

---

### W2.2 — Marketing Studio MVP (Weeks 14–22)

**Business value:** High volume, relatively straightforward. Reuses CopywriterAgent and EmailAgent across multiple products.

**What to build:**
- `CopywriterAgent` (1 week)
- `SEOAgent` (1 week)
- `EmailAgent` (1 week)
- `SocialAgent` (1 week)
- Twitter/X plugin (1 week)
- LinkedIn plugin (reuse from W2.1 if built)
- Mailchimp plugin (1 week)
- Campaign builder + content calendar dashboard (3 weeks)

**Effort:** 9 weeks

**Platform capabilities reused:**
- Firecrawl — competitor research
- `Scheduler` — post scheduling
- `WorkflowEngine` — campaign workflow
- `CognitiveMemoryBridge` — brand voice long-term memory
- `AIService` — all generation tasks

**Note:** `CopywriterAgent` and `EmailAgent` are reusable by Revenue Engine (outreach copy) and Voice Assistant (response generation helpers). Build once, register once.

---

### W2.3 — Automation Studio MVP (Weeks 16–24)

**Business value:** Platform multiplier — connects AgencyForge to the rest of the user's tool stack.

**What already exists:**
- `WorkflowEngine` — full DAG, approval, retry, all step types
- `PluginRegistry` — ready for integration plugins
- `workflow_runs` — run history table already in PersistenceDB

**What to build:**
- `WorkflowBuilderAgent` (2 weeks) — NL to WorkflowDefinition JSON
- `DataTransformAgent` (1 week)
- Webhook plugin — inbound trigger (1 week)
- Slack plugin (1 week)
- Google Sheets plugin (1 week)
- HTTP plugin (1 week)
- Visual workflow builder (node-based drag-and-drop) (4 weeks — largest UI investment)
- Run history dashboard (1 week)

**Effort:** 12 weeks

**Platform capabilities reused:**
- `WorkflowEngine` — executes all user-defined automations
- `PluginRegistry` — all integration plugins listed in the action library
- `AgentRegistry` — any agent usable as a workflow step
- `PersistenceDB` `workflow_runs` — run history (no new storage needed)
- `Scheduler` — cron trigger support

---

## Wave 3 — Vertical and enterprise (Weeks 24–52)

Longer cycle products. Higher complexity, compliance requirements, or deep domain knowledge needed.

---

### W3.1 — Website Builder (Weeks 24–36)

**Business value:** High, but greenfield agent development is the bottleneck.

**What to build:**
- `SiteArchitectAgent` (2 weeks)
- `UIUXDesignAgent` (2 weeks)
- `CodegenAgent` (3 weeks — code generation quality iteration)
- Git plugin (1 week)
- Vercel plugin (1 week)
- Image Gen plugin — DALL-E or Stability (1 week)
- Website builder dashboard: brief wizard, progress tracker, preview, file explorer (4 weeks)

**Effort:** 14 weeks

**Platform capabilities reused:**
- `WorkflowEngine` — full build pipeline
- `CognitiveMemoryBridge` — project state between sessions
- `AIService` — all generation (architecture, design, code, copy)
- `PluginRegistry` — Git, Vercel, ImageGen

---

### W3.2 — DentalOS (Weeks 28–52)

**Business value:** High unit economics per client (vertical SaaS). But highest complexity and compliance burden.

**Prerequisites (non-platform, pre-build):**
- HIPAA compliance review of deployment architecture
- BAA signed with any cloud AI provider used for PHI-containing prompts
- Column-level encryption design for PHI tables
- Role-based access control design

**What to build:**
- `AppointmentAgent` (2 weeks)
- `TreatmentPlanAgent` (3 weeks — clinical accuracy validation needed)
- `PatientCommAgent` (1 week)
- Calendar plugin (1 week)
- SMS plugin — Twilio (1 week)
- Insurance Eligibility plugin — Availity (2 weeks)
- Practice Management plugin — Dentrix G6 (3 weeks — complex API)
- PHI-encrypted database tables + audit log (2 weeks)
- DentalOS dashboard (patient chart, calendar, treatment editor, billing) (6 weeks)

**Effort:** 21 weeks

**Platform capabilities reused:**
- `WorkflowEngine` — intake + treatment planning workflows
- `PersistenceService` — audit log (existing infrastructure, new PHI tables)
- `MemoryBinding` + `CognitiveMemoryBridge` — patient context
- `EnhancedEventBus` — `dental.*` event routing

**Risk:** `TreatmentPlanAgent` requires clinical validation before production use. Plan for 2-week clinical review cycle after initial build.

---

## Agent and plugin reuse map

Agents and plugins built early that benefit multiple products:

| Component | Built in | Reused by |
|---|---|---|
| Firecrawl plugin | Platform (existing) | Revenue, Research, Marketing, Website Builder |
| `EmailAgent` | W2.2 Marketing | Revenue Engine (outreach copy) |
| `CopywriterAgent` | W2.2 Marketing | Revenue Engine (proposal copy), Voice (response style) |
| LinkedIn plugin | W2.1 Revenue | Marketing Studio |
| Google Sheets plugin | W2.3 Automation | Research Studio (export) |
| SendGrid plugin | W1.1 Revenue | Marketing Studio, DentalOS |
| `ReportAgent` | W1.2 Research | Revenue Engine (audit reports), DentalOS (treatment summaries) |
| `WorkflowBuilderAgent` | W2.3 Automation | Future: NL workflow creation in any product |
| PDF Export plugin | W1.2 Research | DentalOS (treatment plans, invoices) |
| SMS plugin | W3.2 DentalOS | Marketing Studio, Revenue Engine |

---

## Effort summary

| Product | Wave | Effort | Key dependency |
|---|---|---|---|
| Revenue Engine MVP | W1.1 | 6 weeks | Firecrawl, HubSpot, SendGrid |
| Research Studio MVP | W1.2 | 7 weeks | Firecrawl |
| Voice Assistant MVP | W1.3 | 8 weeks | ElevenLabs, HTTPS deploy |
| Revenue Engine Full | W2.1 | 7 weeks | W1.1 complete |
| Marketing Studio | W2.2 | 9 weeks | W1.1 (reuse email agent) |
| Automation Studio | W2.3 | 12 weeks | WorkflowEngine (platform) |
| Website Builder | W3.1 | 14 weeks | AIService, Git, Vercel |
| DentalOS | W3.2 | 21 weeks | HIPAA review, Dentrix API, W1.1 SMS |
| **Total** | | **~84 weeks** | |

At 2 developers working in parallel across waves: approximately 42 weeks (10 months) to all products in MVP state.

---

## Critical path

```
Platform v1.1 stability (4 weeks)
  └── W1.1 Revenue Engine MVP (6 weeks)
        └── W2.1 Revenue Engine Full (7 weeks)
              └── W2.2 Marketing Studio (9 weeks, partial parallel)

  └── W1.2 Research Studio (7 weeks, parallel to W1.1)

  └── W1.3 Voice Assistant (8 weeks, starts week 8)

Platform v1.2 developer experience
  └── W2.3 Automation Studio (12 weeks)
        └── W3.1 Website Builder (14 weeks, partial parallel)

HIPAA compliance review (external — start immediately)
  └── W3.2 DentalOS (21 weeks — starts after review complete)
```

---

## Platform gaps that will surface during product build

These are not blockers but will create friction. Each maps to a platform roadmap item:

| Gap surfaces when | Platform fix | Roadmap item |
|---|---|---|
| Revenue Engine runs multi-step outreach workflows and restarts lose state | Workflow persistence | v1.5.2 |
| Automation Studio needs bidirectional client commands | WebSocket | v1.5.3 |
| DentalOS needs multi-staff access with role isolation | Dashboard auth | v1.5.1 |
| Marketing Studio needs per-brand data isolation | Multi-tenant namespacing | v1.5.5 |
| Voice Assistant token in SSE URL visible in logs | SSE token header | v1.5.6 |
| Automation Studio scales beyond 20 concurrent workflows | Workflow queue | v2.0.3 |
