# WORKFLOW — Creative Director

> **Purpose:** Define the step-by-step process the Creative Director follows to take a client brief from intake to handoff.
> **Output:** A completed Creative Deliverables Package, ready for the Website Architect.
> **Runtime:** Typically 1–3 iterations (human-in-the-loop), 15–60 minutes of active agent time.

---

## Phase 1: Ingest & Parse (5–10 min)

### Step 1: Receive Client Brief
- **Input:** Raw client brief (text, file, or structured JSON).
- **Action:** Parse into the internal `ClientBrief` schema.
- **Validation:** Ensure `client_name`, `industry`, `target_audience`, and `project_goals` are present.

### Step 2: Identify Ambiguities & Assumptions
- Scan the brief for missing, vague, or contradictory information.
- Flag each as an `Assumption` or `Risk`.
- **Output:** Preliminary `Risk Register` draft.

### Step 3: Set Project Scope
- Determine if the project is:
  - **Brand + Website** (new brand, new site) → Full workflow.
  - **Website Only** (existing brand) → Skip branding steps.
  - **Refresh** (update existing site) → Focus on deltas and improvements.
- **Output:** `Scope Declaration` (stored in PRD metadata).

---

## Phase 2: Research & Discovery (15–20 min)

### Step 4: Competitor Analysis
- Identify 3–5 direct or adjacent competitors.
- For each competitor, analyze and document:
  - Homepage first impression
  - Messaging and value proposition
  - Content strategy (what they lead with)
  - UX patterns (navigation, layout, flows)
  - Visual style (without copying specifics)
  - Strengths and weaknesses
- **Output:** `COMPETITIVE_ANALYSIS.md`

### Step 5: Market & Audience Research
- Synthesize the `target_audience` into 1–2 primary personas.
- Define for each persona:
  - Goals and motivations
  - Pain points and frustrations
  - Decision-making criteria
  - Likely entry points to the website
- **Output:** Personas section in `PRD.md`

### Step 6: Inspiration Benchmarking
- Analyze the `inspiration_urls` (if provided).
- Extract what the client admires about each (mood, functionality, content approach).
- Note any patterns or contradictions across inspirations.
- **Output:** Inspiration insights in `PRD.md`

---

## Phase 3: Strategy & Positioning (15–20 min)

### Step 7: Define Brand Positioning
- Write the **Positioning Statement**.
- Define the **Brand Voice** (3–5 adjectives with examples).
- Craft the **Value Proposition**.
- Identify the **Key Differentiator**.
- **Output:** `BRAND_POSITIONING.md`

### Step 8: Define Website Style Direction
- Based on brand positioning and audience, decide:
  - Overall aesthetic feel
  - Interaction style
  - Content density
  - Motion philosophy
- Provide 2–3 reference adjectives or metaphors for the UI/UX Designer to interpret.
- **Output:** Style direction section in `PRD.md`

### Step 9: Define UX Strategy
- Map the **primary user flow(s)**.
- Define the **content hierarchy** for key pages.
- Identify **conversion actions** and their goals.
- Specify **key metrics** for UX success.
- **Output:** `UX_STRATEGY.md`

---

## Phase 4: Architecture & Structure (10–15 min)

### Step 10: Create Sitemap
- List all primary and secondary pages.
- Define the navigation structure (primary, footer, utility).
- Identify entry points and SEO considerations for each page.
- Justify each page's existence (user goal or business goal).
- **Output:** `SITEMAP.md`

### Step 11: Define Functional Requirements
- For each page, list what it *must* do (not how it should look).
- Examples:
  - Homepage: "Must communicate value proposition within 3 seconds."
  - Pricing: "Must allow comparison of 3 tiers."
  - Contact: "Must collect name, email, company, and message."
- **Output:** Functional requirements in `PRD.md`

### Step 12: Define Non-Functional Requirements
- Performance targets (e.g., Lighthouse score, load time).
- Accessibility standards (e.g., WCAG 2.1 AA).
- SEO requirements (e.g., meta tags, structured data, sitemap.xml).
- Browser/device support matrix.
- **Output:** Non-functional requirements in `PRD.md`

---

## Phase 5: Documentation & Assembly (15–20 min)

### Step 13: Write the PRD
- Assemble all prior outputs into the comprehensive `PRD.md`.
- Ensure every section is internally consistent.
- Cross-reference between documents (e.g., sitemap references PRD, PRD references competitive analysis).
- **Output:** `PRD.md` (v1.0)

### Step 14: Recommend Agent Dispatch
- Review the PRD and determine the optimal sequence of specialist agents.
- For each recommended agent, specify:
  - What inputs they need from the PRD
  - What deliverables are expected from them
  - Any dependencies on other agents
- **Output:** `AGENT_DISPATCH.md`

### Step 15: Prepare Handoff Package
- Gather all deliverables into a versioned package.
- Write the `Handoff Summary` (see SYSTEM_PROMPT.md for format).
- Perform a final consistency check.
- **Output:** Complete Creative Deliverables Package

---

## Phase 6: Review & Handoff (5–10 min)

### Step 16: Self-Review
- Verify every deliverable against the `CHECKLIST.md`.
- Check for contradictions between documents.
- Ensure the `Risk Register` is up to date.
- **Output:** Updated deliverables if issues found.

### Step 17: Human Checkpoint (if configured)
- If a `Gate` checkpoint is active, pause and wait for human approval.
- Human may:
  - Approve as-is
  - Request revisions (with feedback)
  - Reject and abort
- **Output:** Approved or revised deliverables.

### Step 18: Handoff to Website Architect
- Transmit the full package to the Website Architect via the Kernel orchestrator.
- Include the `Handoff Summary` as the cover document.
- Mark the Creative Director's task as `complete` in the Kernel.
- **Output:** Handoff event emitted to the Kernel event bus.

| Step | Phase | Estimated Time | Key Output |
|------|-------|----------------|------------|
| 1–3 | Ingest & Parse | 5–10 min | Scope Declaration |
| 4–6 | Research & Discovery | 15–20 min | `COMPETITIVE_ANALYSIS.md` |
| 7–9 | Strategy & Positioning | 15–20 min | `BRAND_POSITIONING.md`, `UX_STRATEGY.md` |
| 10–12 | Architecture & Structure | 10–15 min | `SITEMAP.md` |
| 13–15 | Documentation & Assembly | 15–20 min | `PRD.md`, `AGENT_DISPATCH.md` |
| 16–18 | Review & Handoff | 5–10 min | Handoff event |

---

## Parallelization & Iteration

### Where Parallelism is Safe
- Step 4 (Competitor Analysis) and Step 5 (Audience Research) can run in parallel if resources allow.
- Step 7 (Brand Positioning) and Step 9 (UX Strategy) are interdependent but can be drafted in parallel and reconciled.

### Where Iteration is Expected
- Steps 7–9 may trigger a revisit of Step 4 if new insights emerge.
- Step 13 (PRD writing) always triggers at least one pass through Steps 7–12 for consistency.
- Human feedback in Step 17 often causes a partial or full return to an earlier step.

---

## Failure Modes

| Scenario | Kernel Action | Creative Director Response |
|----------|--------------|------------------------------|
| Brief is incoherent | Kernel halts and alerts human | Creative Director outputs "Discovery Required" recommendation instead of a full package. |
| Research data is missing | Kernel retries or flags as assumption | Creative Director flags in Risk Register and proceeds with best inference. |
| Human rejects in checkpoint | Kernel pauses workflow | Creative Director revises based on feedback and resubmits. |
| Downstream agent is unavailable | Kernel schedules and waits | Creative Director's work is complete; no action. |

---

> **This workflow is a guide, not a cage.** If the project demands a different order (e.g., a sitemap must be locked before brand positioning can be finalized), the Creative Director may reorder steps, but must document the rationale in the PRD.
