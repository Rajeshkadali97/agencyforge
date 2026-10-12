# Website Builder — Implementation Milestones

Each milestone is independently shippable. A user can exercise every completed milestone's features without any subsequent milestone being present.

Reference: `docs/products/website-builder/PRD.md` for full requirements.  
Platform reference: `docs/architecture/12-extension-points.md` for all legal extension hooks.

**Total MVP effort estimate:** 18–20 weeks (1 full-stack developer)  
**Parallel-track option:** M1–M4 can overlap 1 week each with 2 developers (~12 weeks to M4)

---

## M1 — Project Foundation + Brief Wizard

**Target weeks:** 1–3 | **Cumulative effort:** 3 weeks

### Goal

Skeleton package with full brief wizard, project persistence, and mock build response. No AI, no deployment. User can create projects and see them listed.

### Deliverables

**Package scaffold:**
- `packages/website-builder/` directory
- `package.json` with AgencyForge runtime peer dep pinned to v1.0.x
- `src/bootstrap.ts` — registers package with AgencyForge (agents, plugins, events, health check)
- `src/types.ts` — all TypeScript interfaces: `RawBrief`, `AnalyzedBrief`, `SiteSpec`, `DesignSystem`, `GeneratedFile`, `ProjectStatus`, `WebsiteBuildEvent`

**Database:**
- Migration file: creates all 7 tables from PRD.md section 10
- Migration registered in AgencyForge `PersistenceService` bootstrap sequence

**API layer:**
- `POST /api/websites` — creates project, enforces quota, mocks build (status → preview immediately)
- `GET  /api/websites` — list with filter and pagination
- `GET  /api/websites/:id` — project detail
- `PATCH /api/websites/:id` — rename
- `DELETE /api/websites/:id` — soft delete (archived)
- All endpoints: `user_id` extracted from session only, never from request body
- `checkBuildQuota(userId)` utility: 3 concurrent / 10 total limits
- HTTP 429 response: `{ error: 'QUOTA_EXCEEDED', limit: 'CONCURRENT_BUILDS'|'PROJECT_LIMIT', current: N }`

**Dashboard modules (additions to existing Next.js dashboard package):**
- Projects list page (`/websites`): card grid, status badges, empty state
- Brief wizard (`/websites/new`): 6-step form, all field types, validation, saves `RawBrief`
- Project detail stub (`/websites/:id`): brief summary, "Building..." placeholder
- "Websites" entry added to existing dashboard sidebar nav

**Billing stub:**
- `BillingService.emit(event)` writes to `website_billing_events` table (no Stripe)

### Dependencies

- AgencyForge platform running (v1.0)
- `PersistenceService` available (SQLite DB path configured)
- Existing dashboard Next.js 15.1 app
- No external API keys required

### Estimated Effort

3 weeks (1 developer): schema + migration (2d), API endpoints + quota (3d), brief wizard UI (4d), projects list UI (2d), package scaffold + bootstrap (2d), integration testing (2d)

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Brief wizard field scope creep | Medium | Lock to exactly 6 fields; no additions until post-MVP |
| Dashboard sidebar modification breaks existing routes | Low | Add nav item only; no restructuring of existing routes |
| Migration on existing DB corrupts data | Low | Test on DB copy before apply; backup script in runbook |

### Acceptance Criteria

- [ ] User can open `/websites`, see empty state, click "New Website"
- [ ] All 6 wizard steps complete; project appears in list with status badge
- [ ] User B cannot access User A's projects via direct URL (returns 404)
- [ ] Creating 11th project returns HTTP 429 `PROJECT_LIMIT`
- [ ] Creating 4th concurrent build returns HTTP 429 `CONCURRENT_BUILD_LIMIT`
- [ ] Archived project removed from list; row still present in DB
- [ ] All 7 `website_*` tables present in DB with correct schema

---

## M2 — AI Architecture + Design Generation

**Target weeks:** 4–6 | **Cumulative effort:** 6 weeks

### Goal

`BriefAnalysisAgent`, `SiteArchitectAgent`, and `UIUXDesignAgent` running end-to-end. User submits brief → sees generated site structure and design system. No code generation yet.

### Deliverables

**Agents (`packages/website-builder/src/agents/`):**
- `BriefAnalysisAgent` — Haiku 4.5; extracts `AnalyzedBrief` from `RawBrief`; system prompt versioned alongside source
- `SiteArchitectAgent` — Sonnet 5; produces `SiteSpec`; max 10 pages enforced in prompt
- `UIUXDesignAgent` — Sonnet 5; produces `DesignSystem` with `cssVariables` map
- All three registered via `AgentRegistry.register()` in bootstrap

**WorkflowEngine integration:**
- `website-build-partial` workflow (stages 1–3 only)
- `POST /api/websites` dispatches real workflow; status tracks `building`
- `GET  /api/websites/:id/status` returns stage progress
- `GET  /api/websites/:id/stream` SSE endpoint: `stage_started`, `stage_completed` events
- `website_build_events` rows written after each stage (with `duration_ms`, `token_usage`)

**Storage:**
- `website_projects.analyzed_json` populated after stage 1
- `website_projects.spec_json` populated after stage 2; `website_pages` rows created
- `website_projects.design_json` populated after stage 3

**Dashboard:**
- Build progress screen: stage list with animated states, driven by SSE
- Architecture review panel: pages + sections from `SiteSpec`
- Design preview panel: color swatches, font specimen from `DesignSystem`
- Token override UI: user can change font or primary color → stored in `brief_json` for next run

### Dependencies

- M1 complete
- `AIService` configured with Sonnet 5 and Haiku 4.5 provider
- `WorkflowEngine` available (platform)
- `AgentRegistry` available (platform)
- `MemoryBinding` available (platform)
- No plugin API keys required

### Estimated Effort

3 weeks (1 developer): BriefAnalysisAgent + prompt (2d), SiteArchitectAgent + prompt (3d), UIUXDesignAgent + prompt (2d), WorkflowEngine integration (2d), SSE endpoint (2d), progress UI + review panels (3d)

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| SiteArchitectAgent produces > 10 pages | Medium | JSON schema validation post-call; retry once if invalid |
| DesignSystem color contrast fails WCAG AA | Medium | Post-process contrast check; auto-darken primary if failing |
| SSE drops during long build | Medium | Client reconnects with `Last-Event-ID`; server re-sends from `website_build_events` |
| Platform TD-H4 (two event buses) causes SSE to miss events | Low | Subscribe to `RuntimeCoordinator` bus in SSE handler directly |

### Acceptance Criteria

- [ ] Submit brief → 3 stages complete in sequence → architecture + design visible
- [ ] Architecture review shows correct page and section names
- [ ] Design preview shows at least 5 color swatches and 2 font specimens
- [ ] `spec_json` and `design_json` populated in DB after build
- [ ] `website_build_events` has `started` + `completed` rows for each of 3 stages
- [ ] SSE delivers events in real time (verified with < 500ms latency between event and UI update)
- [ ] BriefAnalysisAgent failure → project `status = 'error'`; dashboard shows error state
- [ ] Token usage captured in `website_build_events.token_usage` for all 3 stages

---

## M3 — Code Generation Pipeline

**Target weeks:** 7–11 | **Cumulative effort:** 11 weeks

### Goal

`ContentAgent` and `CodegenAgent` running in parallel per page. Real HTML/CSS files generated. File explorer and ZIP download available.

### Deliverables

**Agents:**
- `ContentAgent` — Haiku 4.5; generates `SectionContent[]` per page
- `CodegenAgent` — Sonnet 5; generates HTML + CSS files; `isFirstPage` flag produces shared CSS
- Both registered via `AgentRegistry.register()`

**WorkflowEngine integration:**
- Full `website-build` workflow (all 7 stages, deploy skipped — returns after stage 6)
- Parallel content generation and codegen via `Promise.allSettled` workaround for platform TD-H3:

```typescript
// Per-page sub-workflow workaround for TD-H3 (Promise.all kills siblings)
const pageResults = await Promise.allSettled(
  pages.map(page =>
    workflowEngine.startWorkflow('website-page-build', { page, designSystem, analyzedBrief })
  )
);
// Collect successes; mark failures per page; assembly continues with successful pages
```

**AssemblyStep (deterministic, no AI):**
- Merges and deduplicates `styles/main.css` from all pages
- Validates all `<link href>` and `<img src>` references
- Injects canonical tags and meta descriptions from `SiteSpec`
- Generates `sitemap.xml` and `robots.txt`
- Writes all rows to `website_files`

**API additions:**
- `GET /api/websites/:id/files` — file summaries
- `GET /api/websites/:id/files/:encodedPath` — file content
- `GET /api/websites/:id/export` — ZIP stream

**Dashboard additions:**
- File explorer: tree view, sizes, click-to-view with syntax highlighting (bundled — no CDN)
- ZIP download button
- Per-page progress visible in stage 5 (page names appear as each completes)

### Dependencies

- M2 complete
- Sonnet 5 available (45s per-page timeout must be configured)
- Platform TD-H3 workaround in product code (no platform change needed)

### Estimated Effort

5 weeks (1 developer): ContentAgent + prompt (3d), CodegenAgent + prompt — 5 quality iterations expected (7d), AssemblyStep handler (3d), TD-H3 workaround (2d), file storage + APIs (3d), file explorer UI + syntax highlighting (3d), ZIP export (1d), prompt quality review on 10 sample outputs (5d), integration testing (3d)

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| CodegenAgent produces broken HTML | High | HTML structure validation post-call; re-prompt once if invalid |
| Codegen timeout for complex pages | Medium | 60s per-page timeout; reduce section count if consistently timing out |
| CSS variables missing in generated output | Medium | Prompt constraint + post-generation grep for hardcoded hex colors |
| Parallel Sonnet 5 throughput bottleneck | Medium | Cap parallel pages at 5; queue remainder (post-MVP feature) |

### Acceptance Criteria

- [ ] 5-page brief → 5 HTML files + shared `main.css` + `sitemap.xml` + `robots.txt`
- [ ] All HTML files have valid doctype and UTF-8 charset
- [ ] Zero inline `<style>` blocks in any HTML file
- [ ] Zero `<script>` blocks in any HTML file
- [ ] At least 3 CSS custom property references (`var(--)`) in each HTML/CSS file
- [ ] Every generated HTML file renders visibly in browser without console errors
- [ ] File explorer shows all files with correct sizes
- [ ] ZIP contains all files with correct relative paths
- [ ] One failed page does not fail the build — remaining pages assembled and available
- [ ] Build completes in < 5 minutes (wall clock) for a 5-page site

---

## M4 — Vercel Preview Deploy

**Target weeks:** 12–13 | **Cumulative effort:** 13 weeks

### Goal

`VercelPlugin` integrated. After every build, user receives a live Vercel preview URL. Deploy history visible.

### Deliverables

**VercelPlugin (`packages/website-builder/src/plugins/VercelPlugin.ts`):**
- `PluginManifest`: id `plugin.vercel`, capabilities `deploy.preview`, `deploy.production`, `deploy.status`
- `create(config)`: validates token; configures Vercel API client with `Authorization: Bearer` header
- `invoke('deploy.preview', { name, files })`: POSTs to `POST /v13/deployments`
- `invoke('deploy.status', { deployId })`: polls `GET /v13/deployments/:id`
- `isConfigured()`: returns `false` if `VERCEL_TOKEN` empty
- `dispose()`: cancels pending HTTP requests
- Registered via `pluginRegistry.register()` in bootstrap

**DeployAgent (`packages/website-builder/src/agents/DeployAgent.ts`):**
- No AI — pure plugin orchestration
- Collects files from `website_files`, calls `plugin.vercel`
- Polls `deploy.status` every 3s, timeout 120s
- On `READY`: inserts `website_deploys`, updates project `status = 'preview'`
- On timeout/ERROR: inserts error row, sets `status = 'error'`
- Publishes `website.build.completed` + `website.deploy.completed` on EventBus

**Full workflow:**
- `website-build` workflow now includes stage 7 (DeployAgent)
- SSE `build_done` event includes `previewUrl`

**API additions:**
- `POST /api/websites/:id/deploy/preview` — manual re-deploy
- `GET  /api/websites/:id/deploys` — deploy history

**Dashboard additions:**
- Preview URL with copy button after build
- Preview iframe with desktop/tablet/mobile device toggles
- Deploy history panel

### Dependencies

- M3 complete
- `PLUGIN_VERCEL_TOKEN` env var configured
- Vercel account with API access (personal account works)

### Estimated Effort

2 weeks (1 developer): VercelPlugin (4d), DeployAgent (2d), workflow integration (1d), API endpoints (1d), preview iframe + device toggles (2d), deploy history UI (1d), Vercel API testing (2d)

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Vercel cold deploy start > 60s | Medium | Poll timeout 120s; show "Deploying to Vercel…" message after 60s |
| Vercel rate limit (12 deploys/min) | Low | Track last deploy timestamp; add 5s delay if second deploy < 5s after first |
| Preview iframe blocked by CSP | Medium | Set `frame-src https://*.vercel.app` in dashboard CSP header |
| VERCEL_TOKEN scoping issues (team vs personal) | Medium | Document both configs; acceptance test with personal account |

### Acceptance Criteria

- [ ] Build completes → preview URL visible in dashboard within 3 minutes total
- [ ] Preview URL opens live site in new tab with correct content and styles
- [ ] Preview iframe renders site at desktop viewport
- [ ] Device toggle resizes iframe (desktop 1280px / tablet 768px / mobile 375px)
- [ ] Deploy history shows most recent preview deploy with status and URL
- [ ] Absent Vercel token → build succeeds through stage 6; stage 7 fails with clear error
- [ ] `website.deploy.completed` event published after successful deploy
- [ ] Manual re-deploy (`POST .../deploy/preview`) succeeds on already-built project

---

## M5 — Section Regeneration + File Versions

**Target weeks:** 14–15 | **Cumulative effort:** 15 weeks

### Goal

User can regenerate any page section with a text instruction. Previous version kept for revert. Dashboard polish.

### Deliverables

**Regeneration pipeline:**
- `POST /api/websites/:id/regenerate` — `{ pageSlug, sectionId, instruction }` → runs ContentAgent + CodegenAgent for that page only
- `GET  /api/websites/:id/regenerate/:regenerationId` — polling endpoint
- Version bump: current file moved to `website_file_versions`; new content written to `website_files` with `version + 1`
- Maximum 5 versions per file (oldest pruned on insert of version 6)
- Rate limit: 5 regenerations per user per hour (SQLite counter)

**Revert:**
- `POST /api/websites/:id/files/:encodedPath/revert` with `{ version }` body
- Copies specified version content to `website_files` current row

**Dashboard additions:**
- "Regenerate Section" button on preview screen
- Page + section selector (from `SiteSpec` in DB)
- Instruction text field
- In-flight spinner (~30s estimate shown)
- Version badge in file explorer ("v2", "v3")
- "Revert to vN" button in file detail view
- Build log panel (collapsed by default): all `website_build_events` rows with timing
- Rate limit indicator: "4 of 5 regenerations used today"
- Project thumbnails on project cards (screenshot of preview or color-based placeholder)

### Dependencies

- M4 complete
- ContentAgent + CodegenAgent implemented (M3)

### Estimated Effort

2 weeks (1 developer): regeneration pipeline + version bump (3d), revert API (1d), rate limit (1d), regeneration UI + section selector (2d), version badges + revert button (2d), build log panel (1d), thumbnails + card polish (1d), testing — 5-iteration coherence test (3d)

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Regenerated page drifts from design system | Medium | Full `cssVariables` map passed to CodegenAgent on every call |
| User instruction contains prompt injection | Medium | Same sanitization filter as brief fields (`INJECTION_PATTERNS`) |
| Version history grows unbounded | Low | Keep last 5 versions per file; prune on version 6 insert |

### Acceptance Criteria

- [ ] User selects page + section + instruction → page regenerated in < 45s
- [ ] Regenerated page uses same design system tokens as original (spot check `var(--)` usage)
- [ ] Other pages unchanged after regeneration
- [ ] File explorer shows "v2" badge after first regeneration
- [ ] Revert to v1 restores exact original content (byte-for-byte)
- [ ] 6th regeneration in one hour returns HTTP 429
- [ ] Build log shows timing + token usage for all stages
- [ ] Project card thumbnails visible in projects list

---

## M6 — Production Deploy + GitHub + Auth

**Target weeks:** 16–18 | **Cumulative effort:** 18 weeks

### Goal

Full deployment pipeline: Vercel production promote + optional GitHub push. NextAuth.js multi-user auth. Stripe billing event emitter.

### Deliverables

**GitPlugin (`packages/website-builder/src/plugins/GitPlugin.ts`):**
- `PluginManifest`: id `plugin.git`, capabilities `git.init`, `git.commit`, `git.push`
- Implementation: `isomorphic-git` (no system git binary required)
- `git.push` fails gracefully if `GITHUB_TOKEN` absent (non-blocking warning)
- `isConfigured()`: returns `true` even without token (init + commit work without push)

**Production deploy:**
- `POST /api/websites/:id/deploy/production`
- Finds latest preview deploy with `status='ready'`
- Calls GitPlugin `git.push` (non-blocking — failure does not block Vercel)
- Calls VercelPlugin `deploy.production`: `POST /v6/deployments/:id/aliases`
- Polls until READY (120s timeout)
- Inserts `website_deploys` (type='production')
- Updates `website_projects.status = 'deployed'`
- Publishes `website.deploy.completed { type: 'production' }`

**GitHub connect:**
- `POST /api/websites/:id/github/connect` — creates repo via GitHub API, pushes files

**Dashboard auth (NextAuth.js):**
- NextAuth.js session for all dashboard routes
- `user_id` extracted from session in all API handlers (replaces mock user ID from M1)
- Sign-in page at `/auth/signin`; sign-out in user menu

**Billing Stripe hook:**
- `BillingService.emit()` calls `stripe.billing.meterEvents.create()` if `STRIPE_SECRET_KEY` set
- Falls back to DB-only if key absent
- No subscription management in this milestone

**Dashboard additions:**
- "Deploy to Production" button (requires confirmation modal)
- Production URL with green badge
- "Connect GitHub" OAuth button; repo URL shown after connect
- Auth: sign-in page, user menu with sign-out

### Dependencies

- M5 complete
- `PLUGIN_GIT_GITHUB_TOKEN` env var (optional, for push)
- NextAuth.js compatible provider (GitHub OAuth recommended)
- `STRIPE_SECRET_KEY` optional

### Estimated Effort

3 weeks (1 developer): GitPlugin with isomorphic-git (3d), production deploy API + Vercel alias (3d), GitHub connect OAuth (2d), NextAuth.js + sign-in page (3d), user isolation audit (1d), Stripe billing hook (2d), production deploy UI + confirmation modal (2d), end-to-end testing (3d)

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| NextAuth.js conflicts with existing (absent) auth (TD-M1) | High | This IS the auth implementation; test thoroughly against fresh DB |
| Vercel alias conflicts with other users' deployments | Medium | Alias: `<project-slug>-<short-user-id>.vercel.app` to ensure uniqueness |
| isomorphic-git push requires specific GitHub token scopes | Medium | Document required scopes: `repo`, `workflow`; check in acceptance test |

### Acceptance Criteria

- [ ] User can sign in and sign out via dashboard
- [ ] User A cannot access User B's project via direct URL (returns 404)
- [ ] "Deploy to Production" button visible after preview URL exists
- [ ] Confirmation modal shows project name + target alias before deploy
- [ ] Production deploy completes → production URL with green badge shown
- [ ] "Connect GitHub" → OAuth flow → repo created → all files pushed → repo URL shown
- [ ] Git push failure does not block Vercel promote (warning shown, deploy proceeds)
- [ ] `website_billing_events` has rows for each build + each production deploy
- [ ] If `STRIPE_SECRET_KEY` set, meter event visible in Stripe test dashboard

---

## M7 — MVP Hardening + Release

**Target weeks:** 19–20 | **Cumulative effort:** 20 weeks

### Goal

Production-ready hardening: error recovery, retry logic, performance validation, Lighthouse CI, documentation. MVP release candidate.

### Deliverables

**Error recovery:**
- "Reset and Retry" on error state: clears `website_files` and `website_pages` status, re-dispatches workflow
- Per-stage auto-retry: each stage retried once on failure before project marks error
- Stuck build cleanup: `website_build_events` rows in 'started' state older than 10 minutes → mark failed on startup
- Human-readable error messages: error code → user message map (no stack traces in UI)

**Build robustness:**
- Per-agent timeout enforcement (stage-specific: analyze 10s, architect 30s, design 20s, content 15s, codegen 60s)
- Partial build recovery: failed pages show ⚠ in file explorer; assembly proceeds with successful pages
- WCAG AA contrast check in AssemblyStep: auto-adjust primary color lightness if contrast < 4.5:1

**Rate limit UI:**
- Concurrent build limit shown inline ("You have 3 active builds — limit reached")
- Regeneration rate shown in panel ("4 of 5 regenerations used today")

**Lighthouse CI:**
- Post-deploy async check (non-blocking): Lighthouse run against each preview URL
- Scores stored in `website_build_events` as metadata JSON
- Dashboard: Performance / Accessibility / SEO scores shown after deploy

**Performance validation:**
- 10 diverse briefs built and timed; p95 < 3 minutes confirmed
- Profile slowest stage; optimize prompt if codegen > 2 minutes

**Documentation:**
- `packages/website-builder/README.md`: developer setup, env vars, architecture summary
- `docs/products/website-builder/RUNBOOK.md`: operator guide (env vars, Vercel setup, GitHub setup, quota config, troubleshooting)

**Load test:**
- 3 concurrent builds by 3 users → all complete, no data bleed
- Verify `user_id` isolation under concurrent DB writes

### Dependencies

- M6 complete (full MVP feature set)
- CI environment for Lighthouse (GitHub Actions or equivalent)
- Access to Vercel + GitHub accounts for end-to-end validation

### Estimated Effort

2 weeks (1 developer): error recovery UX + reset (2d), per-stage retry (1d), stuck build cleanup (1d), rate limit UI (1d), Lighthouse CI integration (2d), WCAG contrast check (1d), performance validation — 10 sample builds (2d), docs (2d), load test (1d), buffer for bug fixes discovered during hardening (3d)

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Lighthouse CI adds > 2min to pipeline | Medium | Run Lighthouse async after deploy (non-blocking); update score when done |
| p95 > 3min discovered during validation | Medium | Profile stages; reduce max sections per page from 8 to 6 if needed |
| Load test reveals DB write collision | Low | All queries include `user_id` filter; verify with concurrent integration test |

### Acceptance Criteria

- [ ] Failed build shows human-readable error message (no stack trace visible)
- [ ] "Reset and Retry" clears files and restarts build successfully
- [ ] Stage failure triggers 1 auto-retry before project errors
- [ ] 5 consecutive builds on same brief all succeed (flakiness threshold: 0 failures)
- [ ] p95 build time < 3 minutes confirmed across 10 diverse briefs (times logged)
- [ ] Lighthouse scores (Performance / Accessibility / SEO) visible in dashboard after deploy
- [ ] Generated HTML passes WCAG AA contrast check for primary text on background
- [ ] 3 concurrent builds by different users complete without data bleed
- [ ] `packages/website-builder/README.md` covers: env vars, setup, architecture, agents, plugins
- [ ] `docs/products/website-builder/RUNBOOK.md` covers: all env vars, Vercel setup, GitHub setup, quota config, error troubleshooting table

---

## Milestone Summary

| # | Milestone | Weeks | Cumulative | Ships to user |
|---|---|---|---|---|
| M1 | Foundation + Brief Wizard | 1–3 | 3w | Create/manage projects, complete brief |
| M2 | AI Architecture + Design | 4–6 | 6w | See generated site plan + design system |
| M3 | Code Generation | 7–11 | 11w | Real HTML/CSS files, explorer, ZIP |
| M4 | Vercel Preview Deploy | 12–13 | 13w | Live preview URL after every build |
| M5 | Section Regeneration | 14–15 | 15w | Iterate sections, revert versions |
| M6 | Production Deploy + Auth | 16–18 | 18w | Full deploy pipeline, multi-user |
| M7 | Hardening + MVP Release | 19–20 | 20w | Production-ready, documented |

**MVP ships at end of M7.**

---

## Platform Capabilities Reused (Zero Platform File Modifications)

| AgencyForge Capability | Used in milestone | How |
|---|---|---|
| `AgentRegistry.register()` | M2, M3 | All 6 agents registered in bootstrap |
| `PluginRegistry.register()` + `activate()` | M4, M6 | VercelPlugin, GitPlugin, ImageGenPlugin, Firecrawl |
| `WorkflowEngine.startWorkflow()` | M2–M4 | Main build pipeline + per-page sub-workflows |
| `WorkflowEngine` parallel step (+ TD-H3 workaround) | M3 | Content + codegen (5 pages parallel) |
| `WorkflowEngine` sequential step | M2–M4 | All non-parallel stages |
| `AIService` | M2, M3 | Routes to Sonnet 5 / Haiku 4.5 per agent |
| `PersistenceService` | M1 | All 7 new tables in existing SQLite DB |
| `MemoryBinding` | M2, M3 | Spec, design, content, deploy history per project |
| `CognitiveMemoryBridge` | M3+ | Project state continuity across browser sessions |
| `EnhancedEventBus` | M4 | `website.build.completed`, `website.deploy.completed` |
| `RuntimeBridge` SSE | M2 | Build progress streaming to dashboard |
| `Scheduler` | Post-MVP | Scheduled re-builds, Lighthouse CI triggers |
| `HealthManager` | M1 | Health check: DB tables present, Vercel connectivity |
