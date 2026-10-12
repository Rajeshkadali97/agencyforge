# OUTPUT_TEMPLATE — Creative Director

> **Purpose:** Define the exact structure and schema of every deliverable produced by the Creative Director.  
> **Rule:** Every output must follow these templates exactly. Deviation requires an explicit exception documented in the PRD.

---

## Metadata Header (Every File)

Every deliverable file must begin with the following metadata block:

```markdown
---
project: [Client Name]
agent: creative-director
version: [Semantic Version, e.g., 1.0.0]
date: [ISO 8601 date, e.g., 2026-06-26]
status: [draft | review | approved | archived]
---
```

---

## Deliverable 1: COMPETITIVE_ANALYSIS.md

**Purpose:** Document competitor strengths, weaknesses, and market opportunities.

**Template:**

```markdown
---
project: [Client Name]
agent: creative-director
version: 1.0.0
date: 2026-06-26
status: draft
---

# Competitive Analysis

## Market Context
[Brief paragraph on the industry and market dynamics relevant to the client.]

## Competitors Analyzed

### Competitor 1: [Name]
- **URL:** [competitor.com]
- **Positioning:** [How they describe themselves]
- **Strengths:**
  - [Specific, observable strength]
  - [Specific, observable strength]
- **Weaknesses:**
  - [Specific, observable weakness]
  - [Specific, observable weakness]
- **UX Observations:** [Navigation, layout, interaction patterns]
- **Messaging:** [Tone, key phrases, value prop]
- **Opportunity for Client:** [How the client can do better]

### Competitor 2: [Name]
- **URL:** [competitor.com]
...

### Competitor 3: [Name]
- **URL:** [competitor.com]
...

## Synthesis

### What Competitors Do Well
1. [Pattern 1]
2. [Pattern 2]

### Where Competitors Fall Short
1. [Gap 1]
2. [Gap 2]

### Market Opportunity
[The single most important opportunity for the client to exploit.]

## Strategic Implications
[How this analysis directly informs the brand positioning and UX strategy.]
```

---

## Deliverable 2: BRAND_POSITIONING.md

**Purpose:** Define the brand's market position, voice, and differentiation.

**Template:**

```markdown
---
project: [Client Name]
agent: creative-director
version: 1.0.0
date: 2026-06-26
status: draft
---

# Brand Positioning

## Positioning Statement
[For [target customer], [Brand Name] is the [category] that [key benefit], unlike [competitors], because [differentiation].]

## Value Proposition
[The primary reason a customer should choose this brand. Must be clear, specific, and defensible.]

## Brand Voice

| Adjective | What It Means | What It Does NOT Mean |
|-----------|----------------|----------------------|
| Bold | We speak with conviction. | We are not arrogant or dismissive. |
| [Word] | [Definition] | [Anti-definition] |

## Key Messaging Pillars

### Pillar 1: [Theme]
- **Headline angle:** [How this pillar is expressed in headlines]
- **Supporting points:**
  - [Point 1]
  - [Point 2]

### Pillar 2: [Theme]
...

### Pillar 3: [Theme]
...

## Differentiation
[The one thing this brand can claim that competitors cannot (or choose not to).]

## Target Audience Alignment
[How the positioning resonates with each primary persona.]

## Notes for Downstream Agents
- **Branding Engine:** [Specific direction for logo, color, and visual identity.]
- **Copywriter:** [Tone guidance for headlines, body copy, and CTAs.]
- **UI/UX Designer:** [Mood and emotional resonance to convey through design.]
```

---

## Deliverable 3: UX_STRATEGY.md

**Purpose:** Define the user experience strategy, flows, and conversion goals.

**Template:**

```markdown
---
project: [Client Name]
agent: creative-director
version: 1.0.0
date: 2026-06-26
status: draft
---

# UX Strategy

## Primary User Flows

### Flow 1: [Name]
**Goal:** [What the user wants to achieve]
**Entry Point:** [How they arrive]

| Step | Page/Section | User Action | Business Goal | Content Priority |
|------|--------------|-------------|---------------|------------------|
| 1 | [Homepage] | Understands value prop | Awareness | Hero headline + CTA |
| 2 | [Product] | Explores features | Consideration | Feature comparison |
| 3 | [Pricing] | Compares plans | Decision | Pricing table |
| 4 | [Sign Up] | Creates account | Conversion | Simplified form |

### Flow 2: [Name]
...

## Content Hierarchy (Per Page)

### [Page Name]
1. **Primary Message:** [The one thing this page must communicate]
2. **Supporting Points:**
   - [Point 1]
   - [Point 2]
3. **Conversion Action:** [What we want the user to do]
4. **SEO Focus:** [Primary keyword or topic]

## Conversion Strategy

| CTA | Location | Goal | Friction Level |
|-----|----------|------|----------------|
| [Button text] | [Homepage hero] | [Sign up] | Low |

## Key Metrics
- **Primary:** [The most important metric for this project]
- **Secondary:** [Supporting metrics]
- **Baseline:** [Current metric values, if known]
- **Target:** [Desired metric values]

## Notes for UI/UX Designer
- [Specific layout or interaction expectations.]
- [Any accessibility or performance constraints.]
```

---

## Deliverable 4: SITEMAP.md

**Purpose:** Define the complete information architecture of the website.

**Template:**

```markdown
---
project: [Client Name]
agent: creative-director
version: 1.0.0
date: 2026-06-26
status: draft
---

# Sitemap

## Primary Navigation

| Page | URL Slug | Purpose | Priority | Entry Points |
|------|----------|---------|----------|-------------|
| Homepage | `/` | [Primary goal] | P0 | Direct, SEO, Ads |
| Product | `/product` | [Goal] | P0 | Nav, Homepage CTA |
| Pricing | `/pricing` | [Goal] | P0 | Nav, Product CTA |
| About | `/about` | [Goal] | P1 | Nav, Footer |
| Contact | `/contact` | [Goal] | P1 | Nav, Footer, Pricing |

## Secondary Navigation

| Page | URL Slug | Purpose | Priority |
|------|----------|---------|----------|
| Blog | `/blog` | [Goal] | P2 |
| Careers | `/careers` | [Goal] | P2 |
| Case Studies | `/case-studies` | [Goal] | P2 |

## Utility Navigation
- Privacy Policy (`/privacy`)
- Terms of Service (`/terms`)
- Cookie Policy (`/cookies`)

## Navigation Structure

```
[Home] [Product] [Pricing] [About] [Contact]
                              └── [Dropdown if any]

Footer:
  ├─ Product
  ├─ Company
  │   ├─ About
  │   ├─ Careers
  │   └─ Blog
  ├─ Legal
  └─ Social
```

## Page-to-Page Flow
```
Homepage ──→ Product ──→ Pricing ──→ Sign Up
    │
    └──→ About ──→ Contact
```

## Notes
- [Any special routing, dynamic pages, or future expansions.]
```

---

## Deliverable 5: PRD.md

**Purpose:** The single source of truth for the entire project.

**Template:**

```markdown
---
project: [Client Name]
agent: creative-director
version: 1.0.0
date: 2026-06-26
status: draft
---

# Product Requirements Document (PRD)

## 1. Executive Summary
[One paragraph that captures the project's essence, audience, and goals. A reader should understand the entire project from this paragraph alone.]

## 2. Business Context
- **Client:** [Name]
- **Industry uniquely:** [Industry]
- **Market Position:** [Where they sit]
- **Business Goals:** [What success looks like in business terms]
- **Success Metrics:** [How we measure success]

## 3. Target Audience & Personas

### Persona 1: [Name]
- **Role:** [Job title or description]
- **Goals:** [What they want to achieve]
- **Pain Points:** [What frustrates them]
- **Decision Criteria:** [What they care about when choosing a solution]
- **Tech Savviness:** [Low / Medium / High]

## 4. Competitor Analysis
[Summary of COMPETITIVE_ANALYSIS.md. Link to full document.]

## 5. Brand Positioning & Voice
[Summary of BRAND_POSITIONING.md. Link to full document.]

## 6. Website Style Direction
- **Aesthetic:** [Description]
- **Interaction Style:** [Description]
- **Content Density:** [Description]
- **Motion Philosophy:** [Description]

## 7. UX Strategy & User Flows
[Summary of UX_STRATEGY.md. Link to full document.]

## 8. Sitemap & Page Requirements
[Summary of SITEMAP.md. Link to full document.]

## 9. Functional Requirements

### Global
- [Requirement 1]
- [Requirement 2]

### Per Page
#### [Page Name]
- [Requirement 1]
- [Requirement 2]

## 10. Non-Functional Requirements
- **Performance:** [e.g., Lighthouse score > 90, TTFB < 600ms]
- **Accessibility:** [e.g., WCAG 2.1 AA]
- **SEO:** [e.g., meta tags, structured data, sitemap.xml]
- **Browser Support:** [e.g., Last 2 versions of Chrome, Firefox, Safari, Edge]
- **Device Support:** [e.g., Desktop, tablet, mobile]
- **Security:** [e.g., HTTPS, CSP, no inline scripts]

## 11. Dependencies & Assumptions

### Dependencies
- [External service, API, or tool the project relies on.]

### Assumptions
- [Anything taken for granted due to missing information.]

## 12. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | [Description] | High/Med/Low | High/Med/Low | [How to reduce or handle] |

## 13. Success Criteria
- [Criterion 1]
- [Criterion 2]

## 14. Recommended Agent Dispatch Order
1. [Branding Engine] → [Task]
2. [UI/UX Designer] → [Task]
3. [Copywriter] → [Task]
4. [Website Architect] → [Task]

## 15. Appendices
- [Links to inspiration, references, or supporting documents.]
```

---

## Deliverable 6: AGENT_DISPATCH.md

**Purpose:** Explicit instruction to the Kernel Orchestrator about which agents to run next.

**Template:**

```markdown
---
project: [Client Name]
agent: creative-director
version: 1.0.0
date: 2026-06-26
status: draft
---

# Agent Dispatch Plan

## Summary
[1–2 sentences on the overall execution strategy.]

## Recommended Sequence

### Step 1: [Agent Name]
- **Task:** [What this agent should do]
- **Inputs:** [Which PRD sections and files to consume]
- **Expected Outputs:** [What this agent should produce]
- **Dependencies:** [None, or which prior step must complete]
- **Parallelizable:** Yes / No

### Step 2: [Agent Name]
- **Task:** ...
- **Inputs:** ...
- **Expected Outputs:** ...
- **Dependencies:** ...
- **Parallelizable:** Yes / No

## Parallel Execution Groups
If applicable, list tasks that can run simultaneously:
- **Group A:** [Agent 1], [Agent 2]
- **Group B:** [Agent 3] (depends on Group A)

## Contingencies
- **If [condition]:** Then [alternative agent or task].
- **If [condition]:** Then [skip step or add step].
```

---

## Handoff Summary (In-Deliverable)

Included as the cover page of the final handoff package:

```markdown
## Handoff Summary
**From:** Creative Director  
**To:** Website Architect  
**Date:** [ISO date]  
**Project:** [Client Name]  
**Version:** [e.g., 1.0.0]

### Key Decisions Made
1. [Decision 1 with brief rationale]
2. [Decision 2 with brief rationale]

### Critical Assumptions
1. [Assumption 1]
2. [Assumption 2]

### Recommended Next Steps
1. **[Agent Name]** → [Task description]
2. **[Agent Name]** → [Task description]

### Known Risks
1. [Risk 1 with proposed mitigation]
2. [Risk 2 with proposed mitigation]

### Deliverables Enclosed
- `COMPETITIVE_ANALYSIS.md`
- `BRAND_POSITIONING.md`
- `UX_STRATEGY.md`
- `SITEMAP.md`
- `PRD.md`
- `AGENT_DISPATCH.md`
```

---

## Versioning Rules
- **Major (X.0.0):** When a fundamental strategy decision changes (e.g., brand positioning is revised after human feedback).
- **Minor (x.Y.0):** When a new page is added to the sitemap, or a significant requirement is added.
- **Patch (x.y.Z):** When typos are fixed, formatting is improved, or minor clarifications are added.

**Rule:** Any version change after handoff must trigger a re-check of the `CHECKLIST.md`.
