# CHECKLIST — Creative Director

> **Purpose:** Quality gate checklist used before every handoff.  
> **Usage:** The Creative Director self-reviews against this list. The Kernel may also validate outputs against it.  
> **Rule:** Every item must be checked before handoff is permitted.

---

## Section A: Input Validation

Ensure the raw client brief was properly ingested and understood.

| # | Check | Status |
|---|-------|--------|
| A.1 | `client_name` is clearly identified and consistent across all documents. | [ ] |
| A.2 | `industry` is identified and used to inform strategy and positioning. | [ ] |
| A.3 | `target_audience` is defined with at least one primary persona. | [ ] |
| A.4 | `project_goals` are stated in measurable or clearly defined terms. | [ ] |
| A.5 | All ambiguous or missing information is flagged as an assumption or risk. | [ ] |
| A.6 | The project scope (Brand + Website / Website Only / Refresh) is explicitly declared. | [ ] |

---

## Section B: Competitor Research

Verify that the competitive analysis is thorough and insightful.

| # | Check | Status |
|---|-------|--------|
| B.1 | At least 3 competitors (or market benchmarks) are analyzed. | [ ] |
| B.2 | For each competitor, at least one strength is identified. | [ ] |
| B.3 | For each competitor, at least one weakness or opportunity is identified. | [ ] |
| B.4 | A clear market gap or differentiation opportunity is articulated. | [ ] |
| B.5 | The analysis goes beyond surface-level observations (e.g., not just "they have a nice website"). | [ ] |

---

## Section C: Brand Positioning

Ensure the brand positioning is defensible and actionable.

| # | Check | Status |
|---|-------|--------|
| C.1 | A clear **Positioning Statement** is present. | [ ] |
| C.2 | The **Value Proposition** answers: "Why this brand over alternatives?" | [ ] |
| C.3 | The **Brand Voice** is defined with 3–5 descriptive adjectives and examples. | [ ] |
| C.4 | The positioning is **defensible** — a competitor could not credibly claim the exact same position. | [ ] |
| C.5 | The positioning is **actionable** — it directly informs design, copy, and UX decisions. | [ ] |

---

## Section D: Website Style Direction

Verify the style direction is clear without being prescriptive about design details.

| # | Check | Status |
|---|-------|--------|
| D.1 | The **aesthetic feel** is described in a way the UI/UX Designer can interpret. | [ ] |
| D.2 | The **interaction style** is defined (e.g., "scroll-driven narrative," "rapid exploration"). | [ ] |
| D.3 | The **content density** recommendation is justified by audience and goals. | [ ] |
| D.4 | The **motion philosophy** is appropriate for the brand and audience. | [ ] |
| D.5 | No specific colors, fonts, or components are prescribed (those belong to other agents). | [ ] |

---

## Section E: UX Strategy

Ensure the UX strategy is user-centric and measurable.

| # | Check | Status |
|---|-------|--------|
| E.1 | At least one **primary user flow** is mapped end-to-end. | [ ] |
| E.2 | The **content hierarchy** is defined for every primary page. | [ ] |
| E.3 | The **conversion actions** are stated and linked to business goals. | [ ] |
| E.4 | The strategy considers what happens when a user **lands**, **explores**, and **converts**. | [ ] |
| E.5 | Success is **measurable** — at least one metric is proposed per primary flow. | [ ] |

---

## Section F: Sitemap & Architecture

Verify the information architecture is logical and justified.

| # | Check | Status |
|---|-------|--------|
| F.1 | The sitemap lists all **primary pages** and their purpose. | [ ] |
| F.2 | The sitemap lists all **secondary pages** and their purpose. | [ ] |
| F.3 | Every page is justified by a **user goal** or **business goal**. | [ ] |
| F.4 | The **navigation structure** (primary, footer, utility) is defined. | [ ] |
| F.5 | No **orphan pages** exist (every page has at least one clear entry point). | [ ] |

---

## Section G: PRD Quality

The PRD must be the definitive guide for the entire project.

| # | Check | Status |
|---|-------|--------|
| G.1 | An **Executive Summary** (1 paragraph) is present and captures the project's essence. | [ ] |
| G.2 | The **Target Audience & Personas** section is present and detailed. | [ ] |
| G.3 | The **Competitor Analysis** is summarized (not just linked). | [ ] |
| G.4 | The **Website Style Direction** is included and consistent with brand positioning. | [ ] |
| G.5 | The **UX Strategy & User Flows** section is present and detailed. | [ ] |
| G.6 | The **Sitemap & Page Requirements** are included and cross-referenced. | [ ] |
| G.7 | **Functional Requirements** are listed (what the site must do, not how). | [ ] |
| G.8 | **Non-Functional Requirements** are listed (performance, accessibility, SEO). | [ ] |
| G.9 | The **Risk Register** is present, with every assumption and risk documented. | [ ] |
| G.10 | The **Success Criteria** are measurable and tied to project goals. | [ ] |
| G.11 | The PRD is **internally consistent** — no contradictions between sections. | [ ] |

---

## Section H: Agent Dispatch

Ensure the recommended agent sequence is logical and complete.

| # | Check | Status |
|---|-------|--------|
| H.1 | The dispatch order is listed sequentially with dependencies noted. | [ ] |
| H.2 | For each agent, the **required inputs** from the PRD are specified. | [ ] |
| H.3 | For each agent, the **expected deliverables** are specified. | [ ] |
| H.4 | The dispatch plan accounts for any parallel execution opportunities. | [ ] |

---

## Section I: Handoff Readiness

Final checks before transmitting the package to the Website Architect.

| # | Check | Status |
|---|-------|--------|
| I.1 | All deliverables are **versioned, dated, and attributed**. | [ ] |
| I.2 | The **Handoff Summary** is complete and accurate. | [ ] |
| I.3 | The **Risk Register** is up to date. | [ ] |
| I.4 | No **code** is present in any deliverable. | [ ] |
| I.5 | No **factual claims** are made without evidence or an accompanying assumption flag. | [ ] |
| I.6 | The package is **self-contained** — a new reader can understand the full project without external context. | [ ] |
| I.7 | The Website Architect can begin work immediately upon receiving this package. | [ ] |

---

## Checklist Workflow

### Self-Review (Automated or Manual)
1. The Creative Director iterates through every section (A–I).
2. Every item must be checked. If an item is unchecked, it is a **blocker**.
3. Blockers are addressed before proceeding.

### Human Checkpoint (if configured)
- Gate 1: After Section C (Brand Positioning) — Human approves brand direction before UX work begins.
- Gate 2: After Section G (PRD) — Human approves the full PRD before any build work begins.
- Gate 3: After Section I (Handoff Readiness) — Final human approval before the Website Architect is engaged.

### Kernel Validation
- The Kernel may run an automated scan of the deliverables against this checklist using a lightweight parser.
- If a critical item is missing (e.g., A.1, C.1, G.1, I.7), the Kernel will reject the handoff and return the package to the Creative Director for revision.

---

## Scoring

| Category | Weight | Passing Criteria |
|----------|--------|------------------|
| Input Validation (A) | 10% | All items checked. |
| Research (B) | 15% | At least 4/5 items checked. |
| Brand & Positioning (C) | 20% | All items checked. |
| Style & UX (D, E) | 20% | All items checked. |
| Architecture (F) | 10% | All items checked. |
| PRD Quality (G) | 15% | At least 10/11 items checked. |
| Dispatch & Handoff (H, I) | 10% | All items checked. |

**Minimum passing score:** 90%  
**Action on failure:** Return to the earliest failed section and iterate.
