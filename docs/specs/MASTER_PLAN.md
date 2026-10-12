# AgencyForge — Master Plan

> **An AI-Powered Creative Agency Operating System**
> Automating the full creative and business lifecycle from research → design → build → deploy → grow.

---

## 1. Vision & Philosophy

### Core Idea
AgencyForge is NOT a chatbot. It is a **modular, extensible operating system** for an AI-powered Creative Agency — capable of autonomously (or semi-autonomously) running every major function of a modern digital agency, from design to deployment to sales and marketing.

### Guiding Principles
1. **Modularity by Default** — Everything must plug into the system as a module, not as a core modification.
2. **Zero-Lock-In Architecture** — Avoid vendor-specific deep integrations. Abstract away external APIs behind clean internal interfaces.
3. **Human-in-the-Loop** — Empower creatives with AI; don't replace them. Every automated step should be reviewable and overridable.
4. **Pipeline-Driven** — Workflows are pipelines. Data flows from one stage to another, with hooks for human review or branching logic.
5. **Future-Proof** — Placeholders for new modules, tools, and models. The architecture must survive API changes, model upgrades, and new platforms.

### Target Outcomes
- A client kickoff → live website in **< 7 days** with minimal human effort.
- Brand, UI/UX, copy, assets, and deployment generated, reviewed, and shipped automatically.
- Sales & lead gen operate 24/7, with human escalation on high-value opportunities.

---

## 2. System Architecture

### 2.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AgencyForge Kernel                              │
│         (Event Bus, Task Queue, State Machine, Orchestrator)        │
└──────────┬──────────────────┬──────────────────┬───────────────────┘
           │                  │                  │
    ┌──────▼──────┐    ┌────▼──────┐    ┌──────▼──────┐
    │   Studio    │    │  Agency   │    │   Engine    │
    │  (Creators) │    │(Business) │    │  (Runners)  │
    └─────────────┘    └───────────┘    └─────────────┘
```

| Layer | Role | Description |
|-------|------|-------------|
| **Kernel** | Core | Event bus, task queue, state machine, orchestrator. The beating heart. |
| **Studio** | Creation | Modules for design, code, content, and creative generation. |
| **Agency** | Business | Modules for sales, marketing, research, and client management. |
| **Engine** | Runtime | Modules for deployment, agents, crawling, and automation infrastructure. |

### 2.2 Interaction Model: The 4D Loop

Every module should support the **4D Loop**:

1. **Discover** — Gather inputs (research, prompts, briefs, client data).
2. **Design** — Generate artifacts (UI, copy, proposals, decks).
3. **Deliver** — Execute and publish (deploy, send, schedule).
4. **Diagnose** — Measure and improve (analytics, feedback, iterate).

### 2.3 Module Interface Contract

Every module MUST implement the following:

```typescript
interface Module {
  id: string;                          // unique e.g. "studio.website"
  version: string;
  capabilities: Capability[];          // what it can do
  hooks: Hook[];                       // lifecycle hooks
  dependsOn?: string[];                // module IDs this module depends on

  init(config: Config): Promise<void>;
  execute(task: Task): Promise<Result>;
  health(): Promise<HealthStatus>;
  shutdown(): Promise<void>;
}
```

**No module should directly call another module's internal functions. All communication goes through the Kernel's event bus.**

---

## 3. Module Ecosystem

### 3.1 Table of All Planned Modules

| # | Module | Layer | Status | Description |
|---|--------|-------|--------|-------------|
| 1 | **Website Builder** | Studio | Core | Premium website creation from prompt to live deploy. |
| 2 | **UI/UX Designer** | Studio | Core | Design system, wireframe, and design token generation. |
| 3 | **3D Experience** | Studio | Core | Interactive 3D web experiences and asset generation. |
| 4 | **Branding Engine** | Studio | Core | Logo, palette, typography, brand voice, guidelines. |
| 5 | **Social Media** | Agency | Core | Content generation + scheduling for social platforms. |
| 6 | **Lead Generation** | Agency | Core | Targeted prospecting, enrichment, and outbound. |
| 7 | **Sales Outreach** | Agency | Core | Email sequences, LinkedIn, cold calls, follow-ups. |
| 8 | **Proposal Generator** | Agency | Core | Auto-creates proposals from project briefs and SOW. |
| 9 | **Research** | Agency | Core | Market, competitive, and client research automation. |
| 10 | **Deployment Runner** | Engine | Core | Build, preview, deploy to staging and production. |
| 11 | *Firecrawl* | Engine | Future | Web scraping and structured data extraction. |
| 12 | *Claude Mem* | Engine | Future | Persistent memory and context across long sessions. |
| 13 | *OpenClaw* | Engine | Future | General-purpose agent framework integration. |
| 14 | *Hermes* | Engine | Future | Notifications, alerts, and real-time messaging. |
| 15 | *Open Design* | Studio | Future | Open-source design protocol and file format support. |
| 16 | *Figma Plugin* | Studio | Future | Native Figma integration for design export/import. |
| 17 | *Playwright* | Engine | Future | Browser automation, testing, and QA. |
| 18 | *MCP Server* | Kernel | Future | Model Context Protocol for external tool calling. |
| 19 | *GitHub* | Engine | Future | Repo management, CI/CD triggers, and code review. |
| 20 | *Voice* | Studio | Future | Voice synthesis, recognition, and conversational UX. |
| 21 | *Memory* | Kernel | Future | Long-term knowledge base and vector memory store. |
| 22 | *Dashboard* | Agency | Future | Real-time reporting, project status, and analytics. |

---

## 4. Core Module Definitions

### 4.1 Studio (Creative Modules)

#### Module: Website Builder
- **Purpose**: End-to-end website creation.
- **Functionality**:
  - Accept text brief or URL and generate full site structure.
  - Generate pages, components, assets, and copy.
  - Deploy to staging with preview URL.
- **Inputs**: Client brief, URL, design tokens, brand voice.
- **Outputs**: Codebase (Next.js/Tailwind by default), deploy preview, live URL.
- **Subcomponents**:
  - Site Architect (info architecture)
  - Page Generator (page-level generation)
  - Component Forge (UI components)
  - Asset Painter (images, icons, illustrations)

#### Module: UI/UX Designer
- **Purpose**: Generate and manage design systems and interfaces.
- **Functionality**:
  - Generate design tokens (color, typography, spacing, shadows).
  - Output component and page-level wireframes.
  - Export to Figma-compatible (or native) format.
- **Inputs**: Brand guidelines, mood board, user persona.
- **Outputs**: Design system JSON, wireframes, high-fidelity mockups.

#### Module: 3D Experience
- **Purpose**: Build interactive 3D web experiences.
- **Functionality**:
  - Generate 3D scenes from text prompts.
  - Support WebGL/Three.js/R3F output.
  - Animate and optimize for web performance.
- **Inputs**: Scene description, brand assets, animation brief.
- **Outputs**: 3D scene files, React Three Fiber code, deployed experience.

#### Module: Branding Engine
- **Purpose**: Generate full brand identities.
- **Functionality**:
  - Logo generation and variation.
  - Color palette and typography curation.
  - Brand voice and messaging framework.
- **Inputs**: Company name, industry, target audience, keywords.
- **Outputs**: Brand kit (logos, palette, fonts, tone guide).

---

### 4.2 Agency (Business Modules)

#### Module: Research
- **Purpose**: Automate market and client research.
- **Functionality**:
  - Analyze industry trends and competitors.
  - Summarize findings into briefs and strategy docs.
  - Enrich prospect and client data.
- **Inputs**: Industry, company names, keywords.
- **Outputs**: Research briefs, SWOT analysis, competitive landscape.

#### Module: Lead Generation
- **Purpose**: Find and qualify potential clients.
- **Functionality**:
  - Scrape directories, LinkedIn, and platforms for leads.
  - Score and rank leads based on fit.
  - Enrich lead profiles with contact data.
- **Inputs**: ICP definition, industry, geography.
- **Outputs**: Qualified lead lists with enriched profiles.

#### Module: Sales Outreach
- **Purpose**: Execute multi-channel sales campaigns.
- **Functionality**:
  - Generate personalized email sequences.
  - LinkedIn outreach and follow-ups.
  - Schedule calls and track responses.
- **Inputs**: Lead list, offer, tone, cadence.
- **Outputs**: Scheduled campaigns, reply tracking, escalation alerts.

#### Module: Social Media
- **Purpose**: Social content creation and scheduling.
- **Functionality**:
  - Generate posts, carousels, and video scripts.
  - Schedule across platforms.
  - Auto-respond and moderate comments.
- **Inputs**: Brand voice, calendar, events, content themes.
- **Outputs**: Published posts, engagement reports.

#### Module: Proposal Generator
- **Purpose**: Auto-generate client proposals.
- **Functionality**:
  - Parse client briefs and SOW documents.
  - Generate project scope, timeline, and pricing.
  - Output polished, branded PDF proposals.
- **Inputs**: Client brief, research data, pricing model.
- **Outputs**: Branded proposal PDF, editable source.

---

### 4.3 Engine (Infrastructure Modules)

#### Module: Deployment Runner
- **Purpose**: Build, preview, and deploy all creative outputs.
- **Functionality**:
  - Trigger builds on code change.
  - Generate deploy previews.
  - Promote to production on approval.
- **Environment Targets**: Vercel, Netlify, AWS, self-hosted.
- **Extensions**: Webhooks, A/B deploys, rollback.

#### Module: Agent Hub (Future: OpenClaw, MCP)
- **Purpose**: Host and orchestrate internal AI agents.
- **Functionality**:
  - Define agent roles and tool access.
  - Manage agent-to-agent and agent-to-module communication.
  - Log and audit all agent actions.
- **Inputs**: Agent definitions, task queues.
- **Outputs**: Completed tasks, audit trail.

---

## 5. Future-Ready Module Placeholders

| Module | Why It Matters | Readiness Trigger |
|--------|---------------|-------------------|
| **Firecrawl** | Structured web data for research and lead gen. | When any module needs real-time web scraping. |
| **Claude Mem** | Long-horizon memory across sessions. | When context windows are insufficient. |
| **OpenClaw** | Pluggable agent framework for complex tasks. | When multi-agent orchestration is needed. |
| **Hermes** | Real-time alerts and internal comms. | When async and real-time events need unification. |
| **Open Design** | Open design file formats (beyond Figma). | When vendor lock-in to Figma becomes a risk. |
| **Figma Plugin** | Bidirectional sync with the design tool. | When Studio modules need live Figma export. |
| **Playwright** | Browser automation and QA. | When automated testing of generated sites is needed. |
| **MCP Server** | Standardized calling of external tools. | When agent tool use needs to scale beyond hardcoded APIs. |
| **GitHub** | Source control and CI/CD. | When modules must auto-commit or trigger workflows. |
| **Voice** | Spoken interfaces and voice UX. | When clients need voice-driven experiences or assistants. |
| **Memory** | Persistent vector store for all knowledge. | When long-term learning and recall is required. |
| **Dashboard** | Centralized live view of all running systems. | When operational visibility is needed. |

### Placeholder Architecture
Each future module has a reserved directory, a stubbed interface, and a `README` explaining:
- What the module will do
- The expected interface contract
- Which core or other modules it depends on
- How to activate it when ready

---

## 6. Data & State Architecture

### 6.1 Data Flow

```
Client Input → Research Module → Studio Modules → Review/Approval → Engine → Live
                                       ↓
                              Agency Modules → CRM / Outreach → Sales
```

### 6.2 State Machine

Major workflows are state machines (e.g., `ProjectState`):
- `INITIATED` → `RESEARCHING` → `DESIGNING` → `REVIEWING` → `BUILDING` → `DEPLOYING` → `LIVE`
- Human gate at `REVIEWING` (configurable).
- Rollback triggers from any later state to any earlier state.

### 6.3 Shared Data Schema

- **Project**: Central entity. Contains all artifacts, state, and permissions.
- **Brief**: Structured input used by Studio and Agency.
- **Artifact**: Any generated file (image, code, PDF, design file).
- **PipelineRun**: Record of an automated workflow execution.

### 6.4 Storage Strategy

| Data Type | Storage | Notes |
|-----------|---------|-------|
| Config | Environment / JSON | Version controlled |
| State | SQLite/PostgreSQL | Fast, relational, ACID |
| Artifacts | Object store (local/cloud) | BLOBs, build artifacts |
| Logs | Append-only / Loki | Immutable, queryable |
| Memory (vectors) | Placeholder for future *Memory* module | Pinecone, Weaviate, or Chroma |

---

## 7. Operational Model

### 7.1 Execution Modes

| Mode | Description | Human Involvement |
|------|-------------|-------------------|
| **Manual** | Human triggers each step. | Full control, step by step. |
| **Assisted** | AI suggests; human approves. | Review gate at key transitions. |
| **Autonomous** | Full pipeline runs automatically. | Alert only on exception or completion. |

### 7.2 Review Gates
Eligible for human review at any of these granularities:
- **Per Module** (e.g., review every generated logo)
- **Per Stage** (e.g., review after all design is done)
- **Per Project** (review only final deliverable)

### 7.3 Error Handling & Escalation
- All modules must emit standardized `Error` and `Warning` events.
- Retry with exponential backoff (max 3 attempts, configurable).
- Escalate to human on persistent failure.
- Dead-letter queue for unprocessable tasks.

---

## 8. Roadmap

### Phase 0: Foundation (Weeks 1–4)
- [ ] Kernel implementation (event bus, task queue, state machine)
- [ ] Module registry and loader
- [ ] Basic CLI and config system
- [ ] First module: **Research**

### Phase 1: Studio Core (Weeks 5–10)
- [ ] Module: **Branding Engine**
- [ ] Module: **UI/UX Designer**
- [ ] Module: **Website Builder**
- [ ] Integration: Branding → UI/UX → Website

### Phase 2: Agency Core (Weeks 11–16)
- [ ] Module: **Lead Generation**
- [ ] Module: **Sales Outreach**
- [ ] Module: **Proposal Generator**
- [ ] Integration: Research → Lead Gen → Outreach → Proposal

### Phase 3: Engine & Scale (Weeks 17–22)
- [ ] Module: **Deployment Runner**
- [ ] Module: **3D Experience**
- [ ] Module: **Social Media**
- [ ] Full pipeline: Brief → Live website + ongoing marketing

### Phase 4: Integration & Intelligence (Weeks 23–28)
- [ ] Placeholder: **Firecrawl**, **GitHub**, **Playwright**
- [ ] Placeholder: **Figma**, **Voice**, **Dashboard**
- [ ] Placeholder: **MCP**, **Claude Mem**, **OpenClaw**
- [ ] Continuous improvement, self-healing, and full autonomy experiments

---

## 9. Success Metrics

| Metric | Target |
|--------|--------|
| Time from brief to live website | < 7 days |
| Human hours per premium site | < 10 hours (vs. 100+ today) |
| Leads generated per week | Scalable (100→1000) |
| Proposal acceptance rate | > 30% |
| New module integration time | < 2 days |
| System uptime | > 99.5% |
| Human review ratio | User configurable, default 20% |

---

## 10. Appendix

### 10.1 Naming Conventions
- Modules: `kebab-case` for directories, `PascalCase` for code.
- Events: `domain.action` (e.g., `project.approved`, `site.deployed`).
- State labels: `SCREAMING_SNAKE_CASE`.

### 10.2 Reference Architecture Stack (Recommended)
- **Frontend**: Next.js, TailwindCSS, shadcn/ui.
- **Backend**: Node.js (or Python for ML-heavy modules) with clean, language-agnostic interfaces.
- **Queue**: Bull / BullMQ or in-memory for small scale, SQS / RabbitMQ for large scale.
- **Database**: PostgreSQL for state, object store for artifacts.
- **AI Models**: OpenAI, Anthropic, Gemini, local LLMs — abstracted behind a unified `LLM Gateway`.
- **Memory (Future)**: Vector store (Pinecone, Weaviate, Chroma).
- **Monitoring**: OpenTelemetry, structured logging, and a future *Dashboard* module.

### 10.3 Contribution & Extension
- Every new module must:
  1. Implement the `Module` interface.
  2. Include a `README` with capabilities, inputs, outputs, and dependencies.
  3. Register in the module manifest.
  4. Maintain ≥ 80% test coverage.
  5. Not break any existing module's contract.

---

> **AgencyForge is the factory. The modules are the machines. The kernel is the power grid.**
> Whatever creative or business task you can define, it should be plug-and-play into this system.
