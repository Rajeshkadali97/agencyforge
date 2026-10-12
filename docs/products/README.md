# AgencyForge Product Suite

Architecture and planning for products built on top of AgencyForge v1.0. No product modifies the platform — all products extend it via its nine documented extension points.

Reference: `docs/architecture/12-extension-points.md` for all legal extension paths.

---

## What already exists vs. what is greenfield

| Product | Platform foundation already in AgencyForge | Greenfield |
|---|---|---|
| Revenue Engine | `@agencyforge/revenue-engine` (business-discovery, lead-scoring, website-audit, proposal-generator, crm-sync, outreach); `RevenueAgent`; `LEAD_SCORED` + `PROPOSAL_GENERATED` events | Email delivery, CRM write-back UI, pipeline dashboard |
| Research Studio | `ResearchAgent` (research, web-scraping, competitor-analysis); Firecrawl plugin (web.scrape, web.search, web.map) | Report builder, export, scheduled jobs, Research Studio dashboard |
| Voice Assistant | `VoiceBinding` (session management, 6 voice event types); `CharacterBinding`; `RuntimeEventTypes.VOICE_*` | Wake-word detection, TTS integration, voice UI, multi-character config |
| Website Builder | `AIService` (code generation via any provider) | All agents, plugins, workflows, dashboard modules, deploy pipeline |
| Marketing Studio | `AIService`; Firecrawl (`web.scrape` for competitive intel) | All agents, plugins, workflows, social connectors, campaign dashboard |
| DentalOS | None | Entire vertical: patient records, scheduling, treatment planning, billing |
| Automation Studio | `WorkflowEngine` (DAG, 5 step types, approval, retry); `PluginRegistry` | Visual builder, trigger system, integration library, run-history dashboard |

---

## Document index

| Doc | Contents |
|---|---|
| `01-product-architecture.md` | Per-product: purpose, package boundaries, agents, plugins, workflows, APIs, storage |
| `02-plugin-strategy.md` | Plugin categories, loading lifecycle, permissions, sandboxing, versioning |
| `03-agent-library.md` | Reusable agent catalog: inputs, outputs, memory, tools, models, runtime behavior |
| `04-product-roadmap.md` | Execution roadmap by business value with effort estimates and dependencies |

---

## Product development rules

1. **No platform modification.** Products only add new packages, agents, plugins, dashboard modules. Platform changes go through RFC + `docs/ROADMAP.md`.
2. **Register via extension points.** Agents via `AgentRegistry`. Plugins via `PluginRegistry`. Bindings via bootstrap `Promise.all`. Health checks via `HealthManager`.
3. **Events for cross-product communication.** Products publish/subscribe via `EnhancedEventBus`. No direct service-to-service calls.
4. **Shared agents live in `runtime/src/agent/impl/`.** Product-specific agents live in their own package.
5. **Platform version pinning.** Each product package pins to the AgencyForge version it was built against.
