# Product Architecture

Seven products built on AgencyForge v1.0. No product modifies platform code — all extend via `docs/architecture/12-extension-points.md`.

---

## 1. Revenue Engine

**Platform foundation:** `@agencyforge/revenue-engine` (6 domain services) + `RevenueAgent`. ~60% built.

### Purpose
Automate B2B revenue pipeline: discover businesses, score leads, audit websites, generate proposals, sync CRM, run outreach.

### What already exists
| Component | Location |
|---|---|
| Business discovery | `revenue-engine/src/business-discovery/` |
| Lead scoring | `revenue-engine/src/lead-scoring/` |
| Website audit | `revenue-engine/src/website-audit/` |
| Proposal generator | `revenue-engine/src/proposal-generator/` |
| CRM sync | `revenue-engine/src/crm/` |
| Outreach | `revenue-engine/src/outreach/` |
| RevenueAgent | `runtime/src/agent/impl/ResearchAgent.ts` |

### Package boundaries
```
packages/revenue-product/
├── src/agents/     # RevenueProductAgent (wraps @agencyforge/revenue-engine services)
├── src/plugins/    # CRMConnectorPlugin, EmailDeliveryPlugin
└── src/dashboard/  # Pipeline Kanban, lead detail, proposal preview
```

### Runtime integration
- `AgentRegistry.register(RevenueProductAgent)`
- Subscribe: `LEAD_SCORED`, `PROPOSAL_GENERATED` on bootstrap bus
- Publish: `revenue.pipeline.updated`, `revenue.outreach.sent`
- `WorkflowEngine` runs: discovery → scoring → audit → proposal → approval → outreach

### Required plugins
| Plugin | Capabilities | Source |
|---|---|---|
| Firecrawl | `web.scrape`, `web.search` | Existing |
| CRM Connector | `crm.create-contact`, `crm.update-deal` | New (HubSpot / Salesforce) |
| Email Delivery | `email.send`, `email.schedule` | New (SendGrid / Resend) |

### Required agents
| Agent | Status | Role |
|---|---|---|
| RevenueAgent | Existing | Lead scoring, proposal generation |
| OutreachAgent | New | Writes and sequences outreach emails |
| CRMSyncAgent | New | Pushes qualified leads to CRM |

### Memory usage
- Short-term: active lead context (company, score, audit results)
- Long-term: lead history, scored companies, proposal versions
- Scope key: `revenue.lead.<company_id>`

### AI models
| Task | Model |
|---|---|
| Lead scoring rationale | Claude Haiku 4.5 |
| Proposal generation | Claude Sonnet 5 |
| Outreach personalization | Claude Haiku 4.5 |
| Competitor analysis | Claude Sonnet 5 |

### Workflows
```
discovery-to-proposal:
  1. [sequential] DiscoverBusinesses → target list
  2. [parallel]   ScoreLead (per target) → scored list
  3. [sequential] FilterByThreshold → qualified leads
  4. [sequential] AuditWebsite → website report
  5. [sequential] GenerateProposal → draft proposal
  6. [approval]   HumanReview → approved / rejected
  7. [sequential] SendOutreach → outreach delivered
```

### Dashboard modules
- Pipeline board (Kanban: discovered → scored → proposal → approved → outreach)
- Lead detail view (score breakdown, audit, proposal preview)
- Outreach sequence builder
- CRM sync status panel

### APIs
- `POST /api/revenue/discover` — trigger discovery workflow
- `GET  /api/revenue/leads` — list leads with scores
- `POST /api/revenue/leads/:id/approve` — approve proposal
- `GET  /api/revenue/pipeline` — pipeline summary

### Storage
- Lead records: `runtime_state.db` `revenue_jobs` (existing)
- Proposal files: new `proposals` table in PersistenceDB
- Outreach log: new `outreach_log` table

### Extension points used
Agent registration, plugin registration, event subscription, workflow definitions, health check (CRM connectivity)

---

## 2. Research Studio

**Platform foundation:** `ResearchAgent` + Firecrawl plugin. ~30% built.

### Purpose
On-demand and scheduled business intelligence: query, scrape, synthesize, export AI research reports.

### What already exists
| Component | Location |
|---|---|
| ResearchAgent | `runtime/src/agent/impl/ResearchAgent.ts` |
| Firecrawl plugin | `runtime/src/plugins/manifests/firecrawl.ts` |
| `RESEARCH_COMPLETED` event | `runtime/src/contracts/` |

### Package boundaries
```
packages/research-product/
├── src/agents/     # DeepResearchAgent, ReportAgent
├── src/plugins/    # PDFExportPlugin, GoogleSheetsPlugin, NewsAPIPlugin
├── src/scheduler/  # Scheduled research job registration
└── src/dashboard/  # Research query UI, report viewer, scheduler
```

### Runtime integration
- `AgentRegistry.register(DeepResearchAgent, ReportAgent)`
- Subscribe: `research.completed` for report storage and export
- `Scheduler` for recurring research jobs (market monitoring)

### Required plugins
| Plugin | Capabilities | Source |
|---|---|---|
| Firecrawl | `web.scrape`, `web.search`, `web.map` | Existing |
| PDF Export | `export.pdf` | New |
| Google Sheets | `sheets.write` | New |
| News API | `news.search` | New |

### Required agents
| Agent | Status | Role |
|---|---|---|
| ResearchAgent | Existing | Core research execution |
| DeepResearchAgent | New | Multi-source, multi-round deep research |
| ReportAgent | New | Synthesizes findings into structured reports |

### Memory usage
- Short-term: active research context (query, interim findings)
- Long-term: previous research for deduplication and trend tracking
- Scope key: `research.topic.<query_hash>`

### AI models
| Task | Model |
|---|---|
| Query planning | Claude Haiku 4.5 |
| Web data extraction | Claude Haiku 4.5 |
| Report synthesis | Claude Sonnet 5 |
| Trend analysis | Claude Sonnet 5 |

### Workflows
```
deep-research:
  1. [sequential]  PlanResearch → search queries
  2. [parallel]    SearchWeb (per query) → raw results
  3. [parallel]    ScrapeTopSources → scraped content
  4. [sequential]  SynthesizeReport → structured report
  5. [conditional] IF scheduled → SaveToHistory
  6. [sequential]  ExportReport (PDF / Sheets)
```

### Dashboard modules
- Research query interface
- Report viewer (sections, source citations)
- Scheduled jobs manager
- Trend comparison (diff between scheduled runs)

### APIs
- `POST /api/research/query` — start research workflow
- `GET  /api/research/reports` — list reports
- `GET  /api/research/reports/:id` — get report
- `POST /api/research/schedule` — create scheduled job

### Storage
- Reports: new `research_reports` table (`query`, `result_json`, `created_at`)
- Schedules: new `research_schedules` table + `Scheduler`

### Extension points used
Agent registration, plugin registration, event subscription, scheduled jobs

---

## 3. Voice Assistant

**Platform foundation:** `VoiceBinding` (session + 6 event types) + `CharacterBinding`. ~40% built.

### Purpose
Conversational AI via voice. Characters (personas) respond to voice commands, route to agents, speak responses. Requires HTTPS + Chromium.

### What already exists
| Component | Location |
|---|---|
| VoiceBinding | `runtime/src/bindings/voice/VoiceBinding.ts` |
| CharacterBinding | `runtime/src/bindings/character/CharacterBinding.ts` |
| `VOICE_STARTED/STOPPED/COMMAND/RESPONSE/LISTENING/ERROR` | `runtime/src/contracts/` |

### Package boundaries
```
packages/voice-product/
├── src/agents/     # IntentClassifierAgent, VoiceOrchestrationAgent, CharacterAgent
├── src/plugins/    # TTSPlugin (ElevenLabs), STTPlugin (Whisper)
└── src/dashboard/  # Voice console, character config UI
```

### Runtime integration
- Subscribe: `VOICE_COMMAND` → classify intent → route to target agent
- Publish: `VOICE_RESPONSE` with text → TTS plugin converts to audio
- `CharacterBinding` selects active persona and tone

### Required plugins
| Plugin | Capabilities | Source |
|---|---|---|
| TTS | `tts.synthesize` | New (ElevenLabs / OpenAI TTS) |
| STT | `stt.transcribe` | New (Whisper API / Web Speech API) |
| Wake Word | `wakeword.detect` | New (Picovoice Porcupine) |

### Required agents
| Agent | Status | Role |
|---|---|---|
| IntentClassifierAgent | New | Classifies voice command → intent + target agent |
| VoiceOrchestrationAgent | New | Routes intent, collects response, triggers TTS |
| CharacterAgent | New | Maintains persona context, injects character style |

### Memory usage
- Short-term: current session context (last 10 turns)
- Long-term: user preferences, command history, character interaction history
- Scope key: `voice.session.<session_id>`

### AI models
| Task | Model |
|---|---|
| Intent classification | Claude Haiku 4.5 (latency critical) |
| Response generation | Claude Haiku 4.5 / Sonnet 5 (character-dependent) |

### Workflows
```
voice-command:
  1. [sequential] TranscribeAudio (STT) → text
  2. [sequential] ClassifyIntent → intent + target agent
  3. [sequential] RouteToAgent → agent result
  4. [sequential] GenerateVoiceResponse → spoken text
  5. [sequential] SynthesizeSpeech (TTS) → audio
```

### Dashboard modules
- Voice console (live transcript, session status)
- Character configuration (name, persona, voice, system prompt)
- Session history
- Wake word setup guide

### APIs
- `POST /api/voice/session/start`
- `POST /api/voice/session/:id/command`
- `GET  /api/voice/characters`
- `POST /api/voice/characters`

### Storage
- Sessions: `runtime_state.db` `voice_states` (existing)
- Characters: `runtime_state.db` `character_states` (existing)
- Transcripts: new `voice_transcripts` table

### Constraints
- HTTPS required (Web Speech API browser constraint)
- Chromium-based browser required for STT
- `ELEVENLABS_API_KEY` or `OPENAI_API_KEY` required for TTS

---

## 4. Website Builder

**Platform foundation:** `AIService` only. Fully greenfield product.

### Purpose
AI-powered website generation: company brief → deployed static site or Next.js app.

### Package boundaries
```
packages/website-builder/
├── src/agents/     # SiteArchitectAgent, UIUXDesignAgent, CodegenAgent, DeployAgent
├── src/plugins/    # GitPlugin, VercelPlugin, ImageGenPlugin
├── src/templates/  # Starter templates per site category
└── src/dashboard/  # Brief wizard, build progress, preview, file explorer
```

### Runtime integration
- Registers 4 agents
- Publish: `website.build.completed`, `website.deploy.completed`
- `WorkflowEngine` for end-to-end pipeline
- Memory stores project state between sessions

### Required plugins
| Plugin | Capabilities | Source |
|---|---|---|
| Git | `git.commit`, `git.push` | New |
| Vercel | `deploy.preview`, `deploy.production` | New |
| Image Gen | `image.generate` | New (DALL-E / Stability) |

### Required agents
| Agent | Role |
|---|---|
| SiteArchitectAgent | Translates brief → site structure (pages, sections, content plan) |
| UIUXDesignAgent | Generates design system (colors, typography, layout, components) |
| CodegenAgent | Generates HTML/CSS/JS or React from design spec |
| DeployAgent | Commits to git, triggers Vercel deploy |

### Memory usage
- Long-term: project brief, design decisions, generated files, deploy history
- Scope key: `website.project.<project_id>`

### AI models
| Task | Model |
|---|---|
| Site structure + design | Claude Sonnet 5 |
| HTML/CSS/React codegen | Claude Sonnet 5 |
| Copywriting | Claude Haiku 4.5 |

### Workflows
```
website-build:
  1. [sequential]  ParseBrief → site spec
  2. [sequential]  GenerateDesignSystem → design tokens
  3. [parallel]    GeneratePages (per page) → page code
  4. [sequential]  AssembleProject → deployable output
  5. [sequential]  DeployPreview → preview URL
  6. [approval]    ClientReview → approved / revision
  7. [sequential]  DeployProduction → live URL
```

### Dashboard modules
- Brief input wizard
- Build progress tracker
- Preview iframe
- File explorer (generated source)
- Deploy history

### APIs
- `POST /api/websites/build`
- `GET  /api/websites/:id/status`
- `GET  /api/websites/:id/files`
- `POST /api/websites/:id/deploy`

### Storage
- Projects: new `website_projects` table
- Generated files: filesystem or S3 plugin
- Deploys: new `website_deploys` table

---

## 5. Marketing Studio

**Platform foundation:** `AIService` + Firecrawl (competitor intel). Mostly greenfield.

### Purpose
AI-powered marketing: brief → copy, assets, scheduled posts, email sequences, ad creative.

### Package boundaries
```
packages/marketing-studio/
├── src/agents/     # CopywriterAgent, SEOAgent, EmailAgent, SocialAgent
├── src/plugins/    # TwitterPlugin, LinkedInPlugin, MailchimpPlugin
└── src/dashboard/  # Campaign builder, content calendar, brand voice manager
```

### Runtime integration
- Registers 4 agents
- Publish: `marketing.content.created`, `marketing.post.scheduled`
- `Scheduler` for post scheduling
- `WorkflowEngine` for campaign pipeline

### Required plugins
| Plugin | Capabilities | Source |
|---|---|---|
| Firecrawl | `web.scrape` | Existing |
| Twitter/X | `social.post`, `social.schedule` | New |
| LinkedIn | `social.post`, `social.schedule` | New |
| Mailchimp | `email.create-campaign`, `email.schedule` | New |

### Required agents
| Agent | Role |
|---|---|
| CopywriterAgent | Generates copy for any channel/format from brief + audience |
| SEOAgent | Keyword research, meta tags, content optimization |
| EmailAgent | Email sequence writing, subject line variants, personalization |
| SocialAgent | Platform-aware posts, hashtags, scheduling |

### Memory usage
- Brand voice: long-term (approved copy examples, tone rules)
- Campaign context: short-term (active brief + iterations)
- Scope key: `marketing.brand`, `marketing.campaign.<campaign_id>`

### AI models
| Task | Model |
|---|---|
| Copy generation | Claude Sonnet 5 |
| SEO analysis | Claude Haiku 4.5 |
| Email variants | Claude Haiku 4.5 |
| Competitor analysis | Claude Sonnet 5 |

### Workflows
```
campaign-creation:
  1. [sequential]  ParseBrief → content plan
  2. [sequential]  ResearchCompetitors → competitive intel
  3. [parallel]    GenerateContent (per channel) → draft content
  4. [sequential]  SEOOptimize → optimized copy
  5. [approval]    BrandReview → approved / revision
  6. [sequential]  SchedulePosts → calendar entries
```

### Dashboard modules
- Campaign brief input
- Content calendar
- Channel previews (email, LinkedIn, Twitter)
- Brand voice manager
- Engagement analytics

### APIs
- `POST /api/marketing/campaigns`
- `GET  /api/marketing/campaigns/:id/content`
- `POST /api/marketing/campaigns/:id/approve`
- `GET  /api/marketing/calendar`

### Storage
- Campaigns: new `marketing_campaigns` table
- Content: new `marketing_content` table
- Brand voice: long-term memory (CognitiveMemoryBridge)

---

## 6. DentalOS

**Platform foundation:** None. Fully greenfield vertical.

### Purpose
AI platform for dental practices: patient records, appointment scheduling, AI treatment planning, billing, patient communication.

### Package boundaries
```
packages/dental-os/
├── src/agents/     # AppointmentAgent, TreatmentPlanAgent, PatientCommAgent
├── src/plugins/    # DentrixPlugin, InsurancePlugin, SMSPlugin
├── src/domain/     # Patient, Appointment, TreatmentPlan types
└── src/dashboard/  # Patient chart, calendar, treatment editor, billing
```

### Runtime integration
- Registers 3 agents
- Publish: `dental.appointment.booked`, `dental.treatment.planned`, `dental.patient.messaged`
- All PHI writes go through PersistenceService with audit logging

### Required plugins
| Plugin | Capabilities | Source |
|---|---|---|
| Practice Management | `pms.read-patient`, `pms.write-appointment` | New (Dentrix / Eaglesoft) |
| Insurance Eligibility | `insurance.check-eligibility` | New |
| SMS / Email | `comms.sms`, `comms.email` | New |
| Calendar | `calendar.availability`, `calendar.book` | New |

### Required agents
| Agent | Role |
|---|---|
| AppointmentAgent | Checks availability, books, sends reminders |
| TreatmentPlanAgent | AI treatment plan generation from clinical notes |
| PatientCommAgent | Patient-facing messages (post-op, recall reminders) |

### Memory usage
- Long-term: patient history, preferences, clinical notes
- Scope key: `dental.patient.<patient_id>` — strict access control required

### AI models
| Task | Model |
|---|---|
| Treatment plan suggestions | Claude Sonnet 5 (accuracy critical) |
| Patient message drafting | Claude Haiku 4.5 |
| Appointment optimization | Claude Haiku 4.5 |

### Workflows
```
new-patient-intake:
  1. [sequential] CreatePatientRecord
  2. [sequential] CheckInsuranceEligibility
  3. [sequential] BookInitialAppointment
  4. [sequential] SendConfirmation

treatment-planning:
  1. [sequential] ReadClinicalNotes → structured notes
  2. [sequential] GenerateTreatmentOptions → option list
  3. [approval]   DentistReview → approved plan
  4. [sequential] SendPatientSummary
```

### Dashboard modules
- Patient chart view
- Appointment calendar
- Treatment plan editor (AI suggestions + dentist override)
- Billing and insurance status
- Patient communication history

### APIs
- `POST /api/dental/patients`
- `GET  /api/dental/patients/:id`
- `POST /api/dental/appointments`
- `POST /api/dental/treatment-plans`
- `POST /api/dental/patients/:id/message`

### Storage
- PHI tables (encrypted at rest): `dental_patients`, `dental_appointments`, `dental_treatment_plans`
- All PHI access logged to audit table

### Compliance
Patient data is PHI under HIPAA. Required before production: encrypted columns, PHI access audit log, BAA with AI providers, staff-role access control. AgencyForge platform does not provide these — they are product-level responsibilities.

---

## 7. Automation Studio

**Platform foundation:** `WorkflowEngine` (full DAG + all step types) + `PluginRegistry`. ~30% built.

### Purpose
No-code/low-code workflow automation: drag-and-drop trigger → action flows powered by the AgencyForge WorkflowEngine.

### What already exists
| Component | Location |
|---|---|
| WorkflowEngine | `runtime/src/workflow/WorkflowEngineImpl.ts` |
| PluginRegistry | `runtime/src/plugins/PluginRegistry.ts` |
| `workflow_runs` table | PersistenceDB |

### Package boundaries
```
packages/automation-studio/
├── src/agents/     # WorkflowBuilderAgent, DataTransformAgent
├── src/plugins/    # WebhookPlugin, SlackPlugin, GoogleSheetsPlugin, HTTPPlugin
├── src/triggers/   # WebhookTrigger, ScheduleTrigger, EventTrigger
└── src/dashboard/  # Visual builder, action library, run history
```

### Runtime integration
- Translates visual builder output → `WorkflowDefinition` JSON
- Submits to `WorkflowEngine.startWorkflow()`
- Trigger system subscribes to events/webhooks, fires workflows
- Run history from `workflow_runs` (existing)

### Required plugins
| Plugin | Capabilities | Source |
|---|---|---|
| Webhook (inbound) | `trigger.webhook` | New |
| Slack | `slack.send`, `slack.read` | New |
| Google Sheets | `sheets.read`, `sheets.write` | New |
| HTTP | `http.get`, `http.post` | New |

### Required agents
| Agent | Role |
|---|---|
| WorkflowBuilderAgent | NL → valid `WorkflowDefinition` JSON |
| DataTransformAgent | Maps/transforms data between integration schemas |

### Memory usage
- Long-term: user-saved automation templates
- Scope key: `automation.template.<user_id>`

### AI models
| Task | Model |
|---|---|
| NL → WorkflowDefinition | Claude Sonnet 5 |
| Data transform suggestion | Claude Haiku 4.5 |
| Error diagnosis | Claude Haiku 4.5 |

### Workflows
```
build-from-description:
  1. [sequential]  ParseDescription → intent + steps
  2. [sequential]  GenerateWorkflowDefinition → JSON
  3. [sequential]  ValidateWorkflow → result
  4. [approval]    UserConfirm → activate / edit
  5. [sequential]  ActivateWorkflow → live automation
```

### Dashboard modules
- Visual workflow builder (node-based)
- Trigger configuration panel
- Action library (all plugin capabilities)
- Run history (reads `workflow_runs`)
- Error log with AI diagnosis

### APIs
- `POST /api/automation/workflows`
- `GET  /api/automation/workflows`
- `POST /api/automation/workflows/:id/trigger`
- `GET  /api/automation/runs`
- `POST /api/automation/webhooks`

### Storage
- Definitions: new `automation_definitions` table
- Run history: `workflow_runs` (existing)
- Webhooks: new `automation_webhooks` table

### Extension points used
Agent registration, plugin registration, workflow definitions, scheduled jobs, event subscription
