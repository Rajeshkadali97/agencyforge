# Agent Library

Reusable agent catalog for AgencyForge products. Agents marked **Existing** are in `runtime/src/agent/impl/`. All others are new. All extend `BaseAgent` — see `docs/SDK.md` for implementation pattern.

Platform reference: `docs/architecture/06-agent-lifecycle.md`

---

## Shared / Platform Agents (Existing)

### ResearchAgent
**ID:** `agent.research` | **File:** `runtime/src/agent/impl/ResearchAgent.ts`

**Inputs:** `{ query: string; depth?: 'basic' | 'standard' | 'deep' }`

**Outputs:**
```typescript
{
  query: string;
  businessesFound: number;
  results: Array<{
    business: { name: string; domain: string; location: string };
    insights: string[];
    priorityActions: string[];
  }>;
}
```

**Memory:** Short-term: active research context. Long-term: none (results via event).

**Tools:** `web.scrape`, `web.search` (Firecrawl)

**Models:** Haiku for extraction; Sonnet for synthesis

**Runtime behavior:** Publishes `RESEARCH_COMPLETED`. AI enhancement optional — degrades gracefully to base data on failure.

---

### RevenueAgent
**ID:** `agent.revenue` | **File:** `runtime/src/agent/impl/ResearchAgent.ts`

**Inputs:** `{ action: 'score-lead' | 'generate-proposal'; data: Record<string, unknown> }`

**Outputs:** `LeadScore` or `Proposal` object (from `@agencyforge/revenue-engine`)

**Memory:** Short-term: active lead. Long-term: proposal history per company.

**Tools:** None — uses `@agencyforge/revenue-engine` domain services

**Models:** Haiku for scoring; Sonnet for proposals

**Runtime behavior:** Publishes `LEAD_SCORED` or `PROPOSAL_GENERATED`. AI optional — base result returned on failure.

---

### MemoryAgent
**ID:** `agent.memory` | **File:** `runtime/src/agent/impl/ResearchAgent.ts`

**Inputs:** `{ action: 'store' | 'retrieve' | 'delete'; key: string; value?: unknown; scope?: string }`

**Outputs:** `{ stored/value/deleted, key }` depending on action

**Memory:** Operates on MemoryBinding directly — IS the memory interface.

**Tools:** None. **Models:** None.

**Runtime behavior:** Synchronous. Returns `success: false` on unknown action.

---

## Revenue Engine Agents

### OutreachAgent
**ID:** `agent.outreach` | **Status:** New

**Inputs:**
```typescript
{
  lead: { name: string; domain: string; industry: string; score: number };
  proposal: { id: string; sections: string[] };
  sequence: 'cold' | 'follow-up-1' | 'follow-up-2';
}
```

**Outputs:** `{ subject: string; body: string; scheduledAt: string; channelRecommendation: 'email' | 'linkedin' }`

**Memory:** Long-term: outreach history per domain. Scope: `revenue.outreach.<company_domain>`

**Tools:** `email.send` (SendGrid), `social.post` (LinkedIn)

**Models:** Haiku (personalization at volume)

**Runtime behavior:** Checks long-term memory for recent contact before sending. Publishes `revenue.outreach.sent`. Returns `success: false` without sending if domain contacted < 7 days ago.

---

### CRMSyncAgent
**ID:** `agent.crm-sync` | **Status:** New

**Inputs:** `{ action: 'create-contact' | 'update-deal' | 'sync-lead'; lead: object; crmProvider: 'hubspot' | 'salesforce' }`

**Outputs:** `{ synced: boolean; crmId: string; provider: string }`

**Memory:** Long-term: CRM ID per company. Scope: `revenue.crm.<company_domain>`

**Tools:** `crm.create-contact`, `crm.update-deal`

**Models:** None — pure data routing

**Runtime behavior:** Idempotent — checks memory for existing CRM ID before creating duplicate. Publishes `revenue.crm.synced`. Returns `success: false` (not throw) when plugin unavailable.

---

## Research Studio Agents

### DeepResearchAgent
**ID:** `agent.deep-research` | **Status:** New

**Inputs:**
```typescript
{
  query: string;
  sources: ('web' | 'news' | 'academic')[];
  depth: 'quick' | 'standard' | 'comprehensive';
  maxSources?: number;  // default 10
}
```

**Outputs:**
```typescript
{
  sections: Array<{ title: string; content: string; sources: Array<{ url: string; excerpt: string }> }>;
  summary: string;
  confidence: 'low' | 'medium' | 'high';
}
```

**Memory:** Short-term: interim findings. Long-term: past research for deduplication. Scope: `research.topic.<query_hash>`

**Tools:** `web.search`, `web.scrape`, `web.map`, `news.search`

**Models:** Haiku for extraction; Sonnet for synthesis

**Runtime behavior:** Multi-round (plan → parallel search → parallel scrape → synthesize). Publishes `research.completed`. Returns partial results if some sources fail.

---

### ReportAgent
**ID:** `agent.report` | **Status:** New

**Inputs:** `{ researchId: string; rawFindings: object[]; format: 'executive-summary' | 'detailed' | 'bullet-points'; exportFormat?: 'pdf' | 'markdown' | 'google-sheets' }`

**Outputs:** `{ reportId: string; title: string; sections: object[]; exportUrl?: string }`

**Memory:** None — stateless formatter

**Tools:** `export.pdf`, `sheets.write`

**Models:** Sonnet (report quality)

**Runtime behavior:** Publishes `research.report.exported` on export. Stateless — no side effects beyond export.

---

## Voice Assistant Agents

### IntentClassifierAgent
**ID:** `agent.intent-classifier` | **Status:** New

**Inputs:** `{ transcript: string; sessionId: string; conversationHistory: Array<{ role: string; content: string }> }`

**Outputs:** `{ intent: string; targetAgentId: string; extractedParams: object; confidence: number }`

**Memory:** Short-term: last 10 turns. Scope: `voice.session.<session_id>`

**Tools:** None

**Models:** Haiku (latency critical — target < 500ms)

**Runtime behavior:** Returns `targetAgentId: 'agent.general-chat'` when confidence < 0.6. Does not publish events — result consumed synchronously by VoiceOrchestrationAgent.

---

### VoiceOrchestrationAgent
**ID:** `agent.voice-orchestration` | **Status:** New

**Inputs:** `{ sessionId: string; intent: string; targetAgentId: string; extractedParams: object; characterId: string }`

**Outputs:** `{ spokenResponse: string; audioUrl?: string; agentUsed: string; durationMs: number }`

**Memory:** Short-term: active session + character context

**Tools:** `tts.synthesize`

**Models:** Haiku / Sonnet (character-dependent — configured per character)

**Runtime behavior:** Routes to `targetAgentId` via `AgentRegistry`. Publishes `VOICE_RESPONSE`. Returns text-only when TTS plugin unavailable.

---

### CharacterAgent
**ID:** `agent.character` | **Status:** New

**Inputs:** `{ characterId: string; rawResponse: string; conversationHistory: object[] }`

**Outputs:** `{ styledResponse: string; emotion?: string }`

**Memory:** Long-term: character definition (name, persona, system prompt, voice settings). Scope: `voice.character.<character_id>`

**Tools:** None

**Models:** Haiku (style injection is lightweight)

**Runtime behavior:** Stateless style pass. Reads character config from memory.

---

## Website Builder Agents

### SiteArchitectAgent
**ID:** `agent.site-architect` | **Status:** New

**Inputs:** `{ brief: string; businessType: string; goals: string[]; targetAudience: string; existingAssets?: object }`

**Outputs:**
```typescript
{
  siteName: string;
  pages: Array<{ slug: string; title: string; purpose: string; sections: object[] }>;
  navigationStructure: string[];
  contentPlan: Record<string, string>;
}
```

**Memory:** Long-term: project brief + architectural decisions. Scope: `website.project.<project_id>`

**Tools:** `web.scrape` (competitor research)

**Models:** Sonnet

**Runtime behavior:** Publishes `website.architecture.planned`. Idempotent — returns cached architecture if same `project_id` already planned.

---

### UIUXDesignAgent
**ID:** `agent.uiux-design` | **Status:** New

**Inputs:** `{ projectId: string; siteArchitecture: object; brandGuidelines?: object }`

**Outputs:** `{ designSystem: { colors, typography, spacing, borderRadius, shadows }; componentSpecs: object[] }`

**Memory:** Long-term: design decisions. Scope: `website.project.<project_id>.design`

**Tools:** `figma.read-design` (optional)

**Models:** Sonnet

**Runtime behavior:** Publishes `website.design.completed`.

---

### CodegenAgent
**ID:** `agent.codegen` | **Status:** New

**Inputs:** `{ projectId: string; page: { slug: string; sections: object[] }; designSystem: object; framework: 'html' | 'nextjs' | 'react' }`

**Outputs:** `{ files: Array<{ path: string; content: string; language: string }>; pageSlug: string }`

**Memory:** Short-term: current page context

**Tools:** `code.execute-sandbox` (optional validation)

**Models:** Sonnet (code quality)

**Runtime behavior:** Publishes `website.page.generated` per page. Multiple instances run in parallel via workflow parallel step.

---

## Marketing Studio Agents

### CopywriterAgent
**ID:** `agent.copywriter` | **Status:** New

**Inputs:** `{ brief: string; audience: object; channel: 'email' | 'linkedin' | 'twitter' | 'landing-page' | 'ad'; format: string; brandVoiceExamples?: string[] }`

**Outputs:** `{ primary: string; alternatives: string[]; rationale: string }`

**Memory:** Long-term: brand voice examples and approved/rejected copy. Scope: `marketing.brand`

**Tools:** None

**Models:** Sonnet

**Runtime behavior:** Publishes `marketing.content.created`. Reads brand voice from long-term memory before generating.

---

### SEOAgent
**ID:** `agent.seo` | **Status:** New

**Inputs:** `{ content: string; targetKeywords?: string[]; competitorUrls?: string[]; pageType: string }`

**Outputs:** `{ optimizedContent: string; metaTitle: string; metaDescription: string; keywords: string[]; suggestions: string[] }`

**Memory:** Short-term: competitor research context

**Tools:** `web.scrape` (competitor analysis), `web.search` (keyword research)

**Models:** Haiku for keyword analysis; Sonnet for content rewrite

**Runtime behavior:** Stateless. No events published — returns inline.

---

### EmailAgent
**ID:** `agent.email` | **Status:** New

**Inputs:** `{ action: 'write-sequence' | 'write-single' | 'optimize-subject'; brief: string; audience: object; sequenceLength?: number }`

**Outputs:** `{ emails: Array<{ subject: string; preheader: string; body: string; sendDelay: string }> }`

**Memory:** Long-term: brand voice, past sequence performance notes. Scope: `marketing.brand`

**Tools:** `email.send` (optional — test sends only)

**Models:** Haiku for volume; Sonnet for quality sequences

**Runtime behavior:** Publishes `marketing.email.sequence.created`.

---

## DentalOS Agents

### AppointmentAgent
**ID:** `agent.dental-appointment` | **Status:** New

**Inputs:** `{ action: 'check-availability' | 'book' | 'cancel' | 'send-reminder'; patientId: string; appointmentType?: string; preferredDate?: string; appointmentId?: string }`

**Outputs:** `{ available?: slot[]; booked?: object; cancelled?: boolean; reminderSent?: boolean }`

**Memory:** Long-term: patient appointment history. Scope: `dental.patient.<patient_id>`

**Tools:** `calendar.availability`, `calendar.book`, `calendar.cancel`, `comms.sms`

**Models:** Haiku

**Runtime behavior:** Publishes `dental.appointment.booked` or `dental.appointment.cancelled`.

---

### TreatmentPlanAgent
**ID:** `agent.treatment-plan` | **Status:** New

**Inputs:** `{ patientId: string; clinicalNotes: string; chiefComplaint: string; existingConditions?: string[]; xrayNotes?: string }`

**Outputs:**
```typescript
{
  treatmentOptions: Array<{
    procedure: string;
    priority: 'urgent' | 'recommended' | 'elective';
    estimatedCost: string;
    timelineWeeks: number;
    rationale: string;
  }>;
  patientSummary: string;
}
```

**Memory:** Long-term: patient history and previous treatment plans. Scope: `dental.patient.<patient_id>`

**Tools:** `vision.describe` (for X-ray images — optional)

**Models:** **Sonnet only** — never downgrade to Haiku for clinical suggestions

**Runtime behavior:** Publishes `dental.treatment.planned`. Output MUST route through `[approval]` dentist review step before any patient communication.

---

### PatientCommAgent
**ID:** `agent.patient-comm` | **Status:** New

**Inputs:** `{ patientId: string; messageType: 'post-op-instructions' | 'recall-reminder' | 'appointment-confirmation' | 'treatment-summary'; context: object; channel: 'sms' | 'email' }`

**Outputs:** `{ message: string; sent: boolean; deliveryId?: string }`

**Memory:** Long-term: patient communication history. Scope: `dental.patient.<patient_id>.comms`

**Tools:** `comms.sms`, `email.send`

**Models:** Haiku (patient-friendly, empathetic tone)

**Runtime behavior:** Publishes `dental.patient.messaged`. All PHI in context logged to audit table.

---

## Automation Studio Agents

### WorkflowBuilderAgent
**ID:** `agent.workflow-builder` | **Status:** New

**Inputs:** `{ description: string; availablePlugins: string[]; availableAgents: string[] }`

**Outputs:** `{ workflowDefinition: WorkflowDefinition; explanation: string; warnings: string[] }`

**Memory:** Long-term: saved user workflow templates. Scope: `automation.template.<user_id>`

**Tools:** None

**Models:** Sonnet (must produce valid `WorkflowDefinition` JSON)

**Runtime behavior:** Validates output against `WorkflowDefinition` schema before returning. Returns `success: false` on schema validation failure — never returns invalid JSON.

---

### DataTransformAgent
**ID:** `agent.data-transform` | **Status:** New

**Inputs:** `{ sourceData: unknown; sourceSchema: string; targetSchema: string; mappingHints?: string[] }`

**Outputs:** `{ transformedData: unknown; mapping: object[]; confidence: number }`

**Memory:** None — stateless

**Tools:** `code.execute-sandbox` (optional validation)

**Models:** Haiku

**Runtime behavior:** Stateless. Used inside automation workflows as a data mapping step.

---

## Summary

| Agent | ID | Status | Products | Model |
|---|---|---|---|---|
| ResearchAgent | `agent.research` | Existing | Research, Revenue | Haiku/Sonnet |
| RevenueAgent | `agent.revenue` | Existing | Revenue Engine | Haiku/Sonnet |
| MemoryAgent | `agent.memory` | Existing | All | None |
| OutreachAgent | `agent.outreach` | New | Revenue | Haiku |
| CRMSyncAgent | `agent.crm-sync` | New | Revenue | None |
| DeepResearchAgent | `agent.deep-research` | New | Research | Haiku/Sonnet |
| ReportAgent | `agent.report` | New | Research | Sonnet |
| IntentClassifierAgent | `agent.intent-classifier` | New | Voice | Haiku |
| VoiceOrchestrationAgent | `agent.voice-orchestration` | New | Voice | Haiku/Sonnet |
| CharacterAgent | `agent.character` | New | Voice | Haiku |
| SiteArchitectAgent | `agent.site-architect` | New | Website Builder | Sonnet |
| UIUXDesignAgent | `agent.uiux-design` | New | Website Builder | Sonnet |
| CodegenAgent | `agent.codegen` | New | Website Builder | Sonnet |
| CopywriterAgent | `agent.copywriter` | New | Marketing | Sonnet |
| SEOAgent | `agent.seo` | New | Marketing | Haiku/Sonnet |
| EmailAgent | `agent.email` | New | Marketing, Revenue | Haiku/Sonnet |
| AppointmentAgent | `agent.dental-appointment` | New | DentalOS | Haiku |
| TreatmentPlanAgent | `agent.treatment-plan` | New | DentalOS | **Sonnet only** |
| PatientCommAgent | `agent.patient-comm` | New | DentalOS | Haiku |
| WorkflowBuilderAgent | `agent.workflow-builder` | New | Automation | Sonnet |
| DataTransformAgent | `agent.data-transform` | New | Automation | Haiku |

**Totals:** 3 existing, 18 new, 21 total
