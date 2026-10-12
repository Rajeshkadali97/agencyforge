# WORKFLOW — Website Architect

> **Purpose:** Define the step-by-step process the Website Architect follows to transform a creative strategy into a complete technical blueprint.  
> **Input:** Creative Director handoff (PRD.md, UX_STRATEGY.md, SITEMAP.md)  
> **Output:** A completed Technical Architecture Package, ready for the UI/UX Designer.  
> **Runtime:** Typically 1–2 iterations (human-in-the-loop), 10–30 minutes of active agent time.

---

## Phase 1: Ingest & Parse (5–10 min)

### Step 1: Receive Creative Director Handoff
- **Input:** The complete Creative Director handoff package.
- **Action:** Verify all required files are present: `PRD.md`, `UX_STRATEGY.md`, `SITEMAP.md`.
- **Validation:** If any required file is missing, halt and request it from the Kernel Orchestrator.

### Step 2: Parse Strategy Documents
- Read and internalize the PRD, UX Strategy, and Sitemap.
- Extract key decision drivers: functional requirements, performance targets, content needs, and risks.
- **Output:** Internal `ArchitectureContext` object containing all parsed requirements.

### Step 3: Identify Technical Ambiguities
- Scan the inputs for missing, vague, or contradictory technical requirements.
- Flag each as an `Assumption` or `Risk`.
- **Output:** Preliminary `Technical Risk Register` draft.

---

## Phase 2: Architecture Decisions (15–20 min)

### Step 4: Choose Framework & Rendering Strategy
- Evaluate the PRD and UX Strategy to determine the optimal framework.
- Decide on rendering strategy: Static Site Generation (SSG), Server-Side Rendering (SSR), Incremental Static Regeneration (ISR), or Client-Side Rendering (CSR).
- Consideration factors:
  - Content update frequency (static vs. dynamic)
  - SEO requirements (SSR/SSG vs. CSR)
  - Interactivity level (fully static vs. app-like)
  - Performance targets (bundle size, TTFB)
- **Output:** `TECH_STACK.md` — Framework & Rendering section

### Step 5: Design Data & CMS Architecture
- Determine the data sources: headless CMS, API, markdown files, or a hybrid.
- Define the data flow: how content gets from source to the frontend.
- If a CMS is needed, select the most appropriate option based on content complexity, update frequency, and client technical ability.
- **Output:** `TECH_STACK.md` — CMS & Data section

### Step 6: Choose Libraries & Tooling
- Select libraries for styling, animation, state management, forms, data fetching, and testing.
- Justify each choice with a specific requirement from the PRD or UX Strategy.
- **Output:** `TECH_STACK.md` — Libraries & Tooling section

### Step 7: Define Routing Strategy
- Map every page from the `SITEMAP.md` to a route.
- Identify dynamic routes (e.g., blog posts, product pages).
- Plan redirects and middleware if needed (e.g., for internationalization or A/B testing).
- **Output:** `TECH_STACK.md` — Routing section

---

## Phase 3: Structural Design (10–15 min)

### Step 8: Design Project Folder Structure
- Create a directory tree that is scalable and organized by feature or domain.
- Define naming conventions for files and folders.
- Ensure the structure supports the chosen framework's conventions.
- **Output:** `PROJECT_STRUCTURE.md`

### Step 9: Define Component Architecture
- Establish a component hierarchy (e.g., using Atomic Design or similar methodology).
- Define the difference between global/shared components and page-specific components.
- Plan for component composition patterns and prop interfaces.
- **Output:** `COMPONENT_TREE.md`

### Step 10: Plan Animation & Motion Architecture
- Review the PRD and UX Strategy for motion requirements.
- Choose primary and secondary animation libraries.
- Define a "Motion System" (how animations are triggered, timed, and sequenced).
- Set a performance budget for animations.
- **Output:** `ANIMATION_PLAN.md`

---

## Phase 4: Operational Plans (10–15 min)

### Step 11: Create Performance Plan
- Set specific, measurable targets for Core Web Vitals (LCP, INP, CLS).
- Define the loading strategy: code splitting, lazy loading, prefetching.
- Plan asset optimization: image formats, compression, font loading.
- Define caching strategy for static and dynamic content.
- **Output:** `PERFORMANCE_PLAN.md`

### Step 12: Create SEO Plan
- Plan metadata generation for every page (title, description, OG tags).
- Define structured data (JSON-LD) strategy.
- Plan sitemap generation and robots.txt.
- Consider technical SEO for dynamic content.
- **Output:** `SEO_PLAN.md`

### Step 13: Define Deployment Strategy
- Choose a deployment platform (e.g., Vercel, Netlify, AWS) based on project needs.
- Define the build and CI/CD pipeline.
- Plan environment variables and secrets management.
- Define preview and production deployment flows.
- **Output:** `DEPLOYMENT_PLAN.md`

---

## Phase 5: Roadmap & Handoff (5–10 min)

### Step 14: Write Development Roadmap
- Break the project into logical phases (e.g., Foundation, Features, Polish, Launch).
- Define milestones and dependencies between tasks.
- Estimate the complexity of each phase.
- **Output:** `DEVELOPMENT_ROADMAP.md`

### Step 15: Recommend Agent Dispatch
- Based on the architecture, determine the optimal sequence of specialist agents.
- For each recommended agent, specify:
  - What inputs they need from the architecture package
  - What deliverables are expected from them
  - Any dependencies on other agents
- **Output:** `AGENT_DISPATCH.md`

### Step 16: Prepare Handoff Package
- Gather all deliverables into a versioned package.
- Write the `Handoff Summary` (see SYSTEM_PROMPT.md for format).
- Perform a final consistency check.
- **Output:** Complete Technical Architecture Package

---

## Phase 6: Review & Handoff (5–10 min)

### Step 17: Self-Review
- Verify every deliverable against the `CHECKLIST.md`.
- Check for contradictions between documents (e.g., a library chosen in TECH_STACK that doesn't support the framework).
- Ensure the `Technical Risk Register` is up to date.
- **Output:** Updated deliverables if issues found.

### Step 18: Human Checkpoint (if configured)
- If a `Gate` checkpoint is active, pause and wait for human approval.
- Human may:
  - Approve as-is
  - Request revisions (with feedback)
  - Reject and abort
- **Output:** Approved or revised deliverables.

### Step 19: Handoff to UI/UX Designer
- Transmit the full package to the UI/UX Designer via the Kernel orchestrator.
- Include the `Handoff Summary` as the cover document.
- Mark the Website Architect's task as `complete` in the Kernel.
- **Output:** Handoff event emitted to the Kernel event bus.

| Step | Phase | Estimated Time | Key Output |
|------|-------|----------------|------------|
| 1–3 | Ingest & Parse | 5–10 min | `ArchitectureContext` |
| 4–7 | Architecture Decisions | 15–20 min | `TECH_STACK.md` |
| 8–10 | Structural Design | 10–15 min | `PROJECT_STRUCTURE.md`, `COMPONENT_TREE.md`, `ANIMATION_PLAN.md` |
| 11–13 | Operational Plans | 10–15 min | `PERFORMANCE_PLAN.md`, `SEO_PLAN.md`, `DEPLOYMENT_PLAN.md` |
| 14–16 | Roadmap & Handoff | 5–10 min | `DEVELOPMENT_ROADMAP.md`, `AGENT_DISPATCH.md` |
| 17–19 | Review & Handoff | 5–10 min | Handoff event |

---

## Parallelization & Iteration

### Where Parallelism is Safe
- Step 4 (Framework) and Step 5 (CMS) are sequential.
- Step 6 (Libraries) and Step 7 (Routing) can be drafted in parallel and reconciled.
- Step 11 (Performance) and Step 12 (SEO) are largely independent and can be done in parallel.

### Where Iteration is Expected
- Step 4 (Framework) may force a revisit of Step 8 (Folder Structure) if the framework choice changes.
- Step 10 (Animation) may be revisited after Step 11 (Performance) if the performance budget requires simpler animations.
- Human feedback in Step 18 often causes a partial or full return to an earlier step.

---

## Failure Modes

| Scenario | Kernel Action | Website Architect Response |
|----------|-------------|------------------------------|
| Creative Director deliverables are missing | Kernel halts and alerts human | Halt and request missing files from the Kernel. |
| Requirement is technically infeasible | Kernel flags for human review | Document the infeasibility, propose an alternative, and flag in the Risk Register. |
| Human rejects in checkpoint | Kernel pauses workflow | Revise the affected architecture documents based on feedback and resubmit. |
| Chosen framework has a critical vulnerability | Kernel alerts and suggests alternatives | Evaluate alternatives and update `TECH_STACK.md` with the new choice and justification. |

---

> **This workflow is a guide, not a cage.** If the project demands a different order (e.g., the CMS choice must be locked before the framework), the Website Architect may reorder steps, but must document the rationale in the PRD.
