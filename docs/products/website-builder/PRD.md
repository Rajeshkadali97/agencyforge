# Website Builder — Product Requirements Document

**Product:** AgencyForge Website Builder  
**Version:** 1.0 (MVP)  
**Platform:** AgencyForge v1.0  
**Status:** Pre-implementation — engineering plan only

---

## 1. Vision

**"Describe your business. Get a live website."**

Website Builder converts a natural-language business brief into a fully deployed, production-quality website — no design skills, no coding, no agency. The user describes what they do; the platform produces architecture, design, copy, code, and a live URL.

Built entirely on top of AgencyForge. No modifications to the platform. All generation runs through `AgentRegistry`, `WorkflowEngine`, `AIService`, and `PluginRegistry`.

**Differentiators:**
- Full pipeline: brief → live URL in < 3 minutes for a 5-page site
- Generated code is owned and exportable — no lock-in
- AI understands business context, not just visual preferences
- Iterative: any section can be regenerated with a single instruction

---

## 2. User Personas

### P1 — Solo Founder / Indie Maker
- No dev skills. Needs credibility before raising or selling.
- Wants a professional site in one afternoon, not two weeks.
- Budget-sensitive. Willing to pay < $50/mo for the right tool.
- Success metric: live URL to put in a pitch deck by end of day.

### P2 — Small Business Owner
- Runs a local or regional business (restaurant, law firm, trades, clinic).
- Has a logo, knows what they sell, cannot describe "design tokens."
- Current pain: paid a freelancer $2,000 and can't update the site themselves.
- Success metric: can update their own site without asking anyone.

### P3 — Agency Professional / Freelancer
- Builds 5–20 sites per month for clients. Speed is money.
- Needs predictable output quality and client preview links.
- Wants to edit the generated output, not start from scratch.
- Success metric: client-ready preview in < 1 hour, not 3 days.

### P4 — Marketing Manager
- Needs landing pages for campaigns without waiting for dev sprint.
- Has copy and brand guidelines; needs them turned into a deployable page.
- Success metric: landing page live before campaign launch date.

---

## 3. User Journeys

### J1 — First Build (Core Journey)

```
1. Sign in → land on empty Projects screen
2. Click "New Website"
3. Brief wizard (6 steps, ~3 minutes to complete):
   a. Business type (selector + freeform)
   b. Business description (freeform, 2–5 sentences)
   c. Target audience (freeform or guided)
   d. Goals (checkboxes: leads, sales, portfolio, credibility, etc.)
   e. Style preferences (mood board selector: minimal / bold / corporate / playful)
   f. Color preferences (optional color picker or "let AI decide")
4. Click "Build My Website"
5. Watch build progress screen:
   - Stage 1: Analyzing brief (~3s)
   - Stage 2: Planning site structure (~12s)
   - Stage 3: Generating design system (~10s)
   - Stage 4: Writing content (~18s)
   - Stage 5: Generating pages (~60–90s, shows each page name as it completes)
   - Stage 6: Assembling (~2s)
   - Stage 7: Deploying preview (~30–60s)
6. Preview screen: iframe showing live site, device toggle (desktop/tablet/mobile)
7. Click "Share Preview Link" → copy Vercel preview URL
```

### J2 — Iterate on a Section

```
1. On preview screen, click "Regenerate Section"
2. Select page and section from dropdown
3. Type instruction: "Make the hero headline more urgent. We solve a compliance problem."
4. Click "Regenerate"
5. Progress indicator (10–30s)
6. Preview refreshes with updated section
7. Accept or revert to previous version
```

### J3 — Deploy to Production

```
1. From preview screen, click "Deploy to Production"
2. Confirm modal: shows what will be deployed
3. (Optional) Connect GitHub: authorize, select org
4. (Optional) Configure custom domain: shows DNS instructions
5. Click "Confirm Deploy"
6. Progress: git push (if configured) → Vercel production promote
7. Live URL shown — copy and share
```

### J4 — Agency Client Handoff

```
1. Agency user creates project, completes build
2. Shares preview URL with client (no account required to view)
3. Client provides feedback via email or call
4. Agency user applies feedback via section regeneration
5. Agency deploys to production on client's Vercel account
6. Downloads ZIP of source files and hands over
```

---

## 4. Functional Requirements

### FR-01 — Brief Input Wizard
- Multi-step form with 6 fields (business type, description, audience, goals, style, colors)
- Freeform text accepted for all fields; structured options as shortcuts
- "Import from URL": user provides existing site URL → Firecrawl scrapes it → brief pre-filled
- Brief saved before build starts; resumable if tab closed

### FR-02 — AI Site Architecture Generation
- Output: named pages with slugs, section list per page, nav structure, content plan, SEO keywords
- Architecture reviewable as list before code generation begins
- User can add/remove pages, rename sections before codegen
- Architecture stored in DB; not regenerated on re-run unless user requests

### FR-03 — AI Design System Generation
- Output: color palette, typography pair, spacing scale, border radius, shadow system
- Shown as visual preview (color swatches, type specimen) before codegen
- User can override individual tokens before codegen
- Stored as JSON; injected as CSS custom properties into generated CSS

### FR-04 — AI Code Generation
- Output format: HTML5 + CSS (MVP); Next.js/React (v1.1)
- One AI call per page, parallel via WorkflowEngine parallel step
- Each page self-contained (references shared CSS; no JS bundle in MVP)
- Shared CSS: `styles/main.css` (design tokens + utility classes)
- Output validated: W3C structure, no broken internal references, no inline `<style>` blocks

### FR-05 — Live Preview
- Displayed in iframe on dashboard; device toggle (desktop 1280px / tablet 768px / mobile 375px)
- Preview URL is Vercel preview deploy (not localhost)
- "Open in new tab" always available

### FR-06 — Section Regeneration
- User selects page + section, provides text instruction
- Only that page's code regenerated — rest of project unchanged
- Design system and site spec stay stable across iterations
- Previous file version kept; revert available

### FR-07 — File Explorer
- Tree view of all generated files with sizes
- Click file: syntax-highlighted viewer (read-only)
- Download individual file or entire project as ZIP

### FR-08 — GitHub Integration
- OAuth connect to GitHub
- Creates repo `<org>/<project-slug>` with initial commit
- Each production deploy pushes commit with message `deploy: <timestamp>`
- Repo URL shown in project settings

### FR-09 — Vercel Preview Deploy
- Auto-triggered at end of every build
- Uses VercelPlugin: POST file bundle → Vercel REST API
- Polls until `READY` or `ERROR` (timeout: 2 minutes)
- Preview URL stored in `website_deploys`

### FR-10 — Vercel Production Deploy
- User-triggered, requires confirmation modal
- Promotes preview deployment to production alias via Vercel API
- Custom alias: `<project-slug>.vercel.app` or user-configured
- Deploy history panel shows all past deploys

### FR-11 — Project Management
- Card grid: preview thumbnail, project name, status badge, last-updated
- Create, rename, duplicate, archive
- Search and filter by status

### FR-12 — Template Starters (v1.1, not MVP)
- 5 templates: SaaS, Portfolio, Restaurant, Agency, E-commerce landing
- Selection pre-fills brief wizard defaults

### FR-13 — Import from URL Brief Pre-fill
- User provides existing site URL
- Firecrawl `web.scrape` extracts business name, description, pages, copy
- Brief wizard pre-populated; user reviews before building

---

## 5. Non-Functional Requirements

### NFR-01 — Performance
- Brief → preview URL: < 3 minutes (p95), < 5 minutes (p99) for 5-page HTML site
- Dashboard page load: < 1.5s LCP
- API response (non-AI endpoints): < 200ms
- Generated site Lighthouse: Performance > 85, Accessibility > 90, SEO > 90

### NFR-02 — Reliability
- Build success rate: > 95% (failed stages retried once automatically)
- Deploy success rate: > 98%
- Platform uptime: > 99.5%

### NFR-03 — Scalability (MVP limits)
- 3 concurrent builds per user
- 10 projects per user
- 10 pages per site max
- 50 MB max total files per project

### NFR-04 — Security
- Project data isolated by `user_id` at DB query level
- Generated code never executed on platform — stored as text only
- All secrets server-side only; never returned to client or logged
- File paths validated: `^[a-zA-Z0-9/_.-]+$` — no `../` traversal

### NFR-05 — Generated Code Quality
- No broken internal links (validated post-assembly)
- No missing CSS references (validated post-assembly)
- No inline `<script>` blocks (no JS in MVP output)
- Images: placeholder src with descriptive alt text
- Mobile-responsive: CSS flexbox/grid with breakpoints

### NFR-06 — Observability
- All build events in `website_build_events` with stage, duration, token usage
- Build log visible in dashboard (collapsed by default)
- Failed stages include error detail in build event record

---

## 6. Dashboard UX

### Screen 1 — Projects List

```
┌─────────────────────────────────────────────────────────────┐
│  Website Builder                   [+ New Website]  [Search] │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ [thumbnail]  │  │ [thumbnail]  │  │ [thumbnail]  │      │
│  │ Acme Corp    │  │ Portfolio    │  │ Coffee Shop  │      │
│  │ ● Deployed   │  │ ○ Preview    │  │ ▓ Building…  │      │
│  │ 2h ago       │  │ 1d ago       │  │ ▓▓▓░░ 60%    │      │
│  │ [Deploy] [⋮] │  │ [Edit]  [⋮] │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

Status badges: `● Deployed` (green), `○ Preview` (blue), `⚠ Error` (red), `░ Draft` (gray), `▓ Building` (animated progress)

### Screen 2 — Brief Wizard

Multi-step with breadcrumb progress:

```
Step 1/6: What kind of business?
  ○ SaaS / Software    ○ Professional Services    ○ E-commerce
  ○ Restaurant / Food  ○ Portfolio / Creative      ○ Other: ________

Step 2/6: Describe what you do (in your own words)
  [                                                            ]
  [  We help small dental practices automate scheduling...    ]
  [  3–10 sentences work best                                 ]

Step 3/6: Who is your customer?
  [ freeform ]

Step 4/6: What should this site achieve?
  ☑ Generate leads       ☐ Sell products
  ☑ Build credibility    ☐ Showcase portfolio
  ☐ Recruit talent       ☐ Provide information

Step 5/6: Style
  ○ Minimal & Clean    ○ Bold & Modern    ○ Professional & Corporate
  ○ Warm & Friendly    ○ Creative & Playful

Step 6/6: Colors (optional)
  ○ Let AI decide    ○ I have a brand color: [#______]
```

### Screen 3 — Build Progress

```
┌─────────────────────────────────────────────────────────────┐
│  Building: Acme Corp Website                                 │
├─────────────────────────────────────────────────────────────┤
│  ✓ Analyzing brief                                    (3s)   │
│  ✓ Planning site architecture                        (12s)   │
│  ✓ Generating design system                          (10s)   │
│  ✓ Writing content                                   (18s)   │
│  ▓ Generating pages                                          │
│    ✓ Home                                            (22s)   │
│    ✓ About                                           (19s)   │
│    ▓ Services                                  (generating…) │
│    ○ Contact                                       (waiting) │
│  ○ Assembling project                                        │
│  ○ Deploying preview                                         │
├─────────────────────────────────────────────────────────────┤
│  Estimated: 45s remaining                                    │
└─────────────────────────────────────────────────────────────┘
```

### Screen 4 — Preview + File Explorer

```
┌──────────────────────┬──────────────────────────────────────┐
│ Files                │  [◻ Desktop] [▣ Tablet] [▢ Mobile]  │
│                      ├──────────────────────────────────────┤
│ ▾ acme-corp/         │                                      │
│   ▾ pages/           │      [  Live Preview Iframe  ]       │
│     index.html  8KB  │                                      │
│     about.html  6KB  │   https://acme-xyz.vercel.app        │
│     services.html    │                                      │
│     contact.html     │                                      │
│   ▾ styles/          │                                      │
│     main.css   12KB  │                                      │
│   sitemap.xml        │                                      │
│   robots.txt         ├──────────────────────────────────────┤
│                      │ [↻ Regenerate Section]  [→ Deploy]   │
│  [⬇ Download ZIP]   │ [✎ Edit Brief]                       │
└──────────────────────┴──────────────────────────────────────┘
```

### Screen 5 — Deploy Panel

```
┌─────────────────────────────────────────────────────────────┐
│  Deploy Acme Corp Website                                    │
├─────────────────────────────────────────────────────────────┤
│  Preview URL (auto-deployed)                                 │
│  🔗 https://acme-xyz.vercel.app       [Copy]  [Open]        │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│  Production Deploy                                           │
│                                                              │
│  GitHub  [Connect GitHub]                                    │
│  Alias   acme-corp.vercel.app  (or configure custom domain) │
│                                                              │
│  [Deploy to Production]                                      │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│  Deploy History                                              │
│  ● Production  2h ago  acme-corp.vercel.app     ✓ Ready     │
│  ○ Preview     4h ago  acme-xyz.vercel.app      ✓ Ready     │
│  ○ Preview     6h ago  (superseded)             ✓ Ready     │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. AI Workflow

### Pipeline Overview

```
RawBrief (JSON from wizard)
  │
[Stage 1] BriefAnalysisAgent — Haiku 4.5, ~3s
  Output: AnalyzedBrief { businessType, coreValueProp, audience, goals[], contentTone,
                          stylePreference, colorHints, competitorUrls[], seoKeywords[] }
  │
[Stage 2] SiteArchitectAgent — Sonnet 5, ~12s
  Input:  AnalyzedBrief
  Output: SiteSpec { pages[{ slug, title, sections[{ id, type, contentPlan }] }],
                     navStructure[], seoKeywords[], contentTone }
  Memory: website.project.<id>.spec
  │
[Stage 3] UIUXDesignAgent — Sonnet 5, ~10s
  Input:  SiteSpec + stylePreference + colorHints
  Output: DesignSystem { colors{}, typography{}, spacing{}, borderRadius{},
                         shadows{}, cssVariables{} }
  Memory: website.project.<id>.design
  │
[Stage 4] ContentAgent × N pages — Haiku 4.5, parallel, ~3–5s per page
  Input:  PageSpec + DesignSystem + AnalyzedBrief
  Output: SectionContent[] { headline, subheadline, body, cta, imagePrompt }
  Memory: website.project.<id>.content.<page_slug>
  │ (all pages ready)
[Stage 5] CodegenAgent × N pages — Sonnet 5, parallel, ~20–30s per page
  Input:  PageSpec + DesignSystem + SectionContent[]
  Output: GeneratedFiles[] { path, content }
  Note:   isFirstPage=true generates shared styles/main.css
  │ (all pages done)
[Stage 6] AssemblyStep — deterministic, no AI, ~0.5s
  - Merge + dedup shared CSS
  - Validate internal references
  - Inject canonical + meta tags
  - Generate sitemap.xml, robots.txt
  - Write final rows to website_files
  │
[Stage 7] PreviewDeployStep — VercelPlugin, ~30–60s
  - POST file bundle to Vercel REST API
  - Poll status
  - Store URL in website_deploys
  - Publish website.build.completed + website.deploy.completed
```

### Prompt Design Principles

- Agents receive only the JSON they need — no raw brief text reaches CodegenAgent
- Structured JSON contracts between every stage — no free-form agent-to-agent messages
- Sonnet 5 for quality-critical stages (architecture, design, codegen); Haiku 4.5 for extraction/content
- Each prompt includes: system context, exact input schema, exact output schema, hard quality constraints
- System prompts versioned alongside agent source

---

## 8. Agent Architecture

### BriefAnalysisAgent
**ID:** `agent.website.brief-analysis` | **Status:** New

**Input:**
```typescript
interface RawBrief {
  businessType: string;
  description: string;
  targetAudience: string;
  goals: string[];
  stylePreference: 'minimal' | 'bold' | 'corporate' | 'warm' | 'creative';
  colorHint?: string;
  importUrl?: string;
}
```

**Output:**
```typescript
interface AnalyzedBrief {
  businessType: string;
  coreValueProp: string;
  targetAudience: { primary: string; painPoints: string[] };
  goals: Array<'leads' | 'sales' | 'credibility' | 'portfolio' | 'info'>;
  contentTone: 'professional' | 'conversational' | 'technical' | 'friendly';
  stylePreference: string;
  colorHints: { primary?: string; mood: string };
  competitorUrls: string[];
  seoKeywords: string[];
}
```

**Model:** Haiku 4.5 | **Memory:** None (stateless pass) | **Tools:** None

---

### SiteArchitectAgent
**ID:** `agent.website.architect` | **Status:** New

**Input:** `AnalyzedBrief`

**Output:**
```typescript
interface SiteSpec {
  siteName: string;
  pages: Array<{
    slug: string;
    title: string;
    purpose: string;
    metaDescription: string;
    sections: Array<{
      id: string;
      type: 'hero' | 'features' | 'testimonials' | 'pricing' | 'faq' |
            'cta' | 'about' | 'contact' | 'gallery' | 'stats';
      contentPlan: string;
      seoKeyword?: string;
    }>;
  }>;
  navStructure: Array<{ label: string; slug: string }>;
  contentTone: string;
  seoKeywords: string[];
}
```

**Model:** Sonnet 5 | **Memory:** Long-term write `website.project.<id>.spec`

---

### UIUXDesignAgent
**ID:** `agent.website.design` | **Status:** New

**Input:** `{ siteSpec: SiteSpec; stylePreference: string; colorHints: object }`

**Output:**
```typescript
interface DesignSystem {
  colors: {
    primary: string;        // hex
    secondary: string;
    accent: string;
    neutrals: string[];     // 5 shades light to dark
    surface: string;
    text: string;
    textMuted: string;
  };
  typography: {
    headingFont: string;    // Google Fonts name
    bodyFont: string;
    scale: Record<'xs'|'sm'|'base'|'lg'|'xl'|'2xl'|'3xl', string>;
    weights: { normal: number; medium: number; bold: number };
  };
  spacing: { base: number; scale: number[] };
  borderRadius: { sm: string; md: string; lg: string; full: string };
  shadows: { sm: string; md: string; lg: string };
  cssVariables: Record<string, string>;  // ready to inject as :root { ... }
}
```

**Model:** Sonnet 5 | **Memory:** Long-term write `website.project.<id>.design`

---

### ContentAgent
**ID:** `agent.website.content` | **Status:** New  
(Distinct from `agent.copywriter` in Marketing Studio — website generation requires different context and constraints)

**Input:**
```typescript
{
  projectId: string;
  page: { slug: string; title: string; sections: SectionSpec[] };
  analyzedBrief: AnalyzedBrief;
  designSystem: DesignSystem;
}
```

**Output:**
```typescript
{
  pageSlug: string;
  sections: Array<{
    id: string;
    headline?: string;
    subheadline?: string;
    body?: string;
    cta?: { text: string; href: string };
    items?: Array<{ title: string; description: string }>;
    imagePrompt?: string;
  }>;
}
```

**Model:** Haiku 4.5 | **Memory:** Short-term active page context

---

### CodegenAgent
**ID:** `agent.website.codegen` | **Status:** New

**Input:**
```typescript
{
  projectId: string;
  page: PageSpec;
  designSystem: DesignSystem;
  content: SectionContent[];
  isFirstPage: boolean;
  outputFormat: 'html';
}
```

**Output:**
```typescript
{
  pageSlug: string;
  files: Array<{ path: string; content: string; sizeBytes: number }>;
}
```

**Model:** Sonnet 5 | **Memory:** None (stateless per page)

**Hard constraints in system prompt:**
- Valid HTML5 with doctype
- External CSS references only — no inline `<style>` blocks
- No `<script>` blocks in HTML output
- All CSS values use design token variables (`var(--color-primary)`, etc.)
- All images: `<img src="[PLACEHOLDER]" alt="[descriptive alt text]">`
- Mobile-first responsive: CSS grid/flexbox, breakpoints at 768px and 1280px
- Navigation references all pages in `navStructure`

---

### DeployAgent
**ID:** `agent.website.deploy` | **Status:** New | **No AI**

**Input:**
```typescript
{
  projectId: string;
  files: GeneratedFile[];
  deployType: 'preview' | 'production';
  githubRepo?: string;
}
```

**Output:**
```typescript
{
  deployId: string;
  deployUrl: string;
  status: 'ready' | 'error';
  durationMs: number;
}
```

**Tools:** `git.commit`, `git.push`, `deploy.preview`, `deploy.production`  
**Memory:** Long-term write `website.project.<id>.deploys`

---

### WorkflowEngine Integration

```typescript
// website-build WorkflowDefinition (registered on bootstrap)
{
  id: 'website-build',
  steps: [
    { id: 'analyze',   type: 'sequential', agentId: 'agent.website.brief-analysis' },
    { id: 'architect', type: 'sequential', agentId: 'agent.website.architect',
      dependsOn: ['analyze'] },
    { id: 'design',    type: 'sequential', agentId: 'agent.website.design',
      dependsOn: ['architect'] },
    { id: 'content',   type: 'parallel',   agentId: 'agent.website.content',
      itemsFrom: 'architect.output.pages', dependsOn: ['design'] },
    { id: 'codegen',   type: 'parallel',   agentId: 'agent.website.codegen',
      itemsFrom: 'architect.output.pages', dependsOn: ['content'] },
    { id: 'assemble',  type: 'sequential', handler: 'assembleProject',
      dependsOn: ['codegen'] },
    { id: 'deploy',    type: 'sequential', agentId: 'agent.website.deploy',
      dependsOn: ['assemble'] },
  ]
}
```

---

## 9. Plugin Requirements

### GitPlugin

**ID:** `plugin.git`  
**Capabilities:** `git.init`, `git.commit`, `git.push`, `git.read-diff`  
**Implementation:** `isomorphic-git` (pure JS — no system git binary required)  
**Config:**
```
PLUGIN_GIT_GITHUB_TOKEN=ghp_...
PLUGIN_GIT_GITHUB_ORG=my-org          # optional; defaults to personal account
```
**isConfigured():** Returns `true` even without token — `git.push` fails gracefully if token absent (push is optional)

---

### VercelPlugin

**ID:** `plugin.vercel`  
**Capabilities:** `deploy.preview`, `deploy.production`, `deploy.status`, `deploy.domain`  
**Implementation:** Vercel REST API v9 (`api.vercel.com`)  
**Config:**
```
PLUGIN_VERCEL_TOKEN=vercel_...
PLUGIN_VERCEL_TEAM_ID=team_...         # optional; personal accounts work without
```
**isConfigured():** Returns `false` if `VERCEL_TOKEN` absent  
**Key API calls:**
- `POST /v13/deployments` — create deployment with file list
- `GET  /v13/deployments/:id` — poll status until `READY`
- `POST /v6/deployments/:id/aliases` — promote to production alias

---

### ImageGenPlugin

**ID:** `plugin.image-gen`  
**Capabilities:** `image.generate`, `image.describe-alt-text`  
**Implementation:** OpenAI DALL-E 3 API  
**Config:**
```
PLUGIN_IMAGEGEN_OPENAI_API_KEY=sk-...
PLUGIN_IMAGEGEN_MODEL=dall-e-3
PLUGIN_IMAGEGEN_SIZE=1024x1024
```
**isConfigured():** Returns `false` if `OPENAI_API_KEY` absent  
**MVP limit:** 1 image per section; called post-codegen; replaces `[PLACEHOLDER]` src attributes  
**Fallback:** If plugin not configured, placeholder src kept; no build failure

---

### FirecrawlPlugin (existing — reused, not modified)

Used for FR-13 (Import from URL) only.  
**Capability:** `web.scrape` with `{ formats: ['markdown'] }`

---

## 10. Database Schema

All tables added to existing AgencyForge `PersistenceDB` (SQLite). No new DB file.

```sql
-- Projects
CREATE TABLE website_projects (
  id              TEXT    PRIMARY KEY,
  user_id         TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  status          TEXT    NOT NULL
                          CHECK (status IN ('draft','building','preview','deployed','error')),
  brief_json      TEXT    NOT NULL,   -- RawBrief
  analyzed_json   TEXT,               -- AnalyzedBrief (after stage 1)
  spec_json       TEXT,               -- SiteSpec (after stage 2)
  design_json     TEXT,               -- DesignSystem (after stage 3)
  output_format   TEXT    NOT NULL DEFAULT 'html'
                          CHECK (output_format IN ('html','nextjs')),
  github_repo_url TEXT,
  created_at      INTEGER NOT NULL,   -- Unix ms
  updated_at      INTEGER NOT NULL
);
CREATE INDEX idx_wp_user    ON website_projects(user_id);
CREATE INDEX idx_wp_status  ON website_projects(status);

-- Pages (one per page in SiteSpec)
CREATE TABLE website_pages (
  id              TEXT    PRIMARY KEY,
  project_id      TEXT    NOT NULL REFERENCES website_projects(id) ON DELETE CASCADE,
  slug            TEXT    NOT NULL,
  title           TEXT    NOT NULL,
  meta_description TEXT,
  status          TEXT    NOT NULL
                          CHECK (status IN ('pending','generating','done','error')),
  error_message   TEXT,
  generated_at    INTEGER,
  UNIQUE(project_id, slug)
);
CREATE INDEX idx_wpp_project ON website_pages(project_id);

-- Generated Files (current version)
CREATE TABLE website_files (
  id              TEXT    PRIMARY KEY,
  project_id      TEXT    NOT NULL REFERENCES website_projects(id) ON DELETE CASCADE,
  page_id         TEXT    REFERENCES website_pages(id),  -- null for shared files
  path            TEXT    NOT NULL,   -- relative: 'pages/index.html', 'styles/main.css'
  content         TEXT    NOT NULL,
  size_bytes      INTEGER NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL,
  UNIQUE(project_id, path)            -- only current version here
);
CREATE INDEX idx_wf_project ON website_files(project_id);

-- File Version History (for revert)
CREATE TABLE website_file_versions (
  id              TEXT    PRIMARY KEY,
  project_id      TEXT    NOT NULL,
  file_path       TEXT    NOT NULL,
  version         INTEGER NOT NULL,
  content         TEXT    NOT NULL,
  created_at      INTEGER NOT NULL,
  UNIQUE(project_id, file_path, version)
);

-- Deployments
CREATE TABLE website_deploys (
  id               TEXT    PRIMARY KEY,
  project_id       TEXT    NOT NULL REFERENCES website_projects(id) ON DELETE CASCADE,
  type             TEXT    NOT NULL CHECK (type IN ('preview','production')),
  status           TEXT    NOT NULL CHECK (status IN ('pending','building','ready','error')),
  deploy_url       TEXT,
  vercel_deploy_id TEXT,
  commit_sha       TEXT,
  error_message    TEXT,
  created_at       INTEGER NOT NULL,
  completed_at     INTEGER
);
CREATE INDEX idx_wd_project ON website_deploys(project_id);

-- Build Events (progress + observability)
CREATE TABLE website_build_events (
  id              TEXT    PRIMARY KEY,
  project_id      TEXT    NOT NULL REFERENCES website_projects(id) ON DELETE CASCADE,
  stage           TEXT    NOT NULL,  -- analyze|architect|design|content|codegen|assemble|deploy
  page_slug       TEXT,              -- set for per-page stages (content, codegen)
  status          TEXT    NOT NULL CHECK (status IN ('started','completed','failed')),
  message         TEXT,
  duration_ms     INTEGER,
  token_usage     INTEGER,           -- approximate tokens consumed
  created_at      INTEGER NOT NULL
);
CREATE INDEX idx_wbe_project ON website_build_events(project_id);

-- Billing Events Stub
CREATE TABLE website_billing_events (
  id              TEXT    PRIMARY KEY,
  project_id      TEXT    NOT NULL,
  user_id         TEXT    NOT NULL,
  event_type      TEXT    NOT NULL,  -- website.build.completed|deploy.production|image.generated
  quantity        INTEGER NOT NULL DEFAULT 1,
  metadata_json   TEXT,
  created_at      INTEGER NOT NULL
);
CREATE INDEX idx_wbe2_user ON website_billing_events(user_id);
```

---

## 11. API Specification

All routes prefixed `/api/websites`. Auth: `Authorization: Bearer <session_token>` (server-side only).

### Projects

```
POST   /api/websites
  Body:    { name: string; brief: RawBrief; outputFormat?: 'html' }
  Effect:  Create project record, enforce quota, dispatch WorkflowEngine build
  Returns: { projectId: string; status: 'building'; estimatedSeconds: 180 }
  Errors:  429 QUOTA_EXCEEDED { limit: 'CONCURRENT_BUILDS'|'PROJECT_LIMIT', current: number }

GET    /api/websites
  Query:   ?status=deployed&limit=20&offset=0
  Returns: { projects: WebsiteProjectSummary[]; total: number }

GET    /api/websites/:id
  Returns: WebsiteProject (full, inc spec_json, design_json)
  Errors:  404 if not found OR belongs to different user (no existence disclosure)

PATCH  /api/websites/:id
  Body:    { name?: string }
  Returns: { updated: true }

DELETE /api/websites/:id
  Effect:  Soft-delete (status = 'archived')
  Returns: { archived: true }
```

### Build Status + Streaming

```
GET    /api/websites/:id/status
  Returns: {
    status: ProjectStatus;
    stages: Array<{ stage: string; status: string; pageSlug?: string; durationMs?: number }>;
    currentStage?: string;
    progressPercent: number;
    estimatedSecondsRemaining?: number;
  }

GET    /api/websites/:id/stream
  Protocol: SSE (text/event-stream)
  Auth:     Authorization header (NOT query string — avoids log exposure of tokens)
  Events:   data: JSON<WebsiteBuildEvent>
  Types:
    { type: 'stage_started';   stage: string; pageSlug?: string }
    { type: 'stage_completed'; stage: string; pageSlug?: string; durationMs: number }
    { type: 'stage_failed';    stage: string; error: string }
    { type: 'build_done';      previewUrl: string; totalDurationMs: number }
    { type: 'build_failed';    error: string }
```

### Content Access

```
GET    /api/websites/:id/spec
  Returns: SiteSpec JSON

GET    /api/websites/:id/design
  Returns: DesignSystem JSON

GET    /api/websites/:id/files
  Returns: { files: FileSummary[] }  -- id, path, sizeBytes, version, pageId, createdAt

GET    /api/websites/:id/files/:encodedPath
  Note:    encodedPath is URL-encoded relative path: 'pages%2Findex.html'
  Returns: { path: string; content: string; sizeBytes: number; version: number }

GET    /api/websites/:id/export
  Returns: application/zip of all current-version files
```

### Iteration

```
POST   /api/websites/:id/regenerate
  Body:    { pageSlug: string; sectionId: string; instruction: string }
  Effect:  Reruns ContentAgent + CodegenAgent for that page only
  Returns: { regenerationId: string; estimatedSeconds: 30 }

GET    /api/websites/:id/regenerate/:regenerationId
  Returns: { status: 'pending'|'running'|'done'|'error'; durationMs?: number }

POST   /api/websites/:id/files/:encodedPath/revert
  Body:    { version: number }
  Effect:  Copies specified version to current in website_files
  Returns: { reverted: true; path: string; version: number }
```

### Deployment

```
POST   /api/websites/:id/deploy/preview
  Effect:  Dispatches DeployAgent with deployType='preview'
  Returns: { deployId: string }

GET    /api/websites/:id/deploys
  Returns: { deploys: WebsiteDeploy[] }

POST   /api/websites/:id/deploy/production
  Effect:  Promotes latest ready preview deploy to production alias
  Returns: { deployId: string; productionUrl: string }

POST   /api/websites/:id/github/connect
  Body:    { repoName: string; org?: string }
  Effect:  Creates GitHub repo, pushes current files via GitPlugin
  Returns: { repoUrl: string }
```

---

## 12. State Management

### Project State Machine

```
[draft] ──build──► [building] ──success──► [preview] ──deploy──► [deploying] ──ready──► [deployed]
                       │                                              │
                    failure                                        failure
                       │                                              │
                    [error] ◄─────────────────────────────────────────┘
                       │
                   user reset
                       │
                    [draft]
```

**Transitions:**
- `draft → building`: `POST /api/websites` or "Rebuild" action
- `building → preview`: all 7 stages complete, Vercel preview URL confirmed
- `building → error`: any stage fails after 1 automatic retry
- `preview → deploying`: user triggers production deploy
- `deploying → deployed`: Vercel production alias confirmed READY
- `deploying → error`: Vercel timeout or API error
- `error → draft`: user clicks "Reset and Retry" (clears generated files, keeps brief)

### Build Sub-State

Tracked via `website_build_events` rows only — not a separate status column. Progress percent computed client-side from event count vs expected total.

### Client-Side State (SSE-driven)

```typescript
interface BuildState {
  status: ProjectStatus;
  stages: Map<string, 'pending' | 'running' | 'done' | 'error'>;
  pageStatuses: Map<string, 'pending' | 'running' | 'done' | 'error'>;
  previewUrl: string | null;
  error: string | null;
  progressPercent: number;   // computed from completed stages / total expected stages
}
```

SSE connection opened on build start. Closed on `build_done` or `build_failed` event.

---

## 13. File Generation Pipeline

### Total Expected Duration (5-page HTML site)

| Stage | Parallelism | Expected time |
|---|---|---|
| Brief analysis | 1 call | ~3s |
| Architecture | 1 call | ~12s |
| Design system | 1 call | ~10s |
| Content (5 pages) | 5 parallel calls | ~5s (wall clock) |
| Codegen (5 pages) | 5 parallel calls | ~30s (wall clock) |
| Assembly | deterministic | ~0.5s |
| Preview deploy | Vercel API | ~45s |
| **Total** | | **~106s ≈ 2 min** |

p95 target: < 3 minutes (accounting for model latency variance + cold deploy start)

### Assembly Step Detail

```
Inputs: all GeneratedFile rows for project

1. Select canonical styles/main.css (from first page's codegen output)
2. For every HTML file:
   a. Validate all <link href="..."> resolve to a file in the set
   b. Validate all <img src="..."> are either [PLACEHOLDER] or a known path
   c. Inject <meta name="description"> from SiteSpec.pages[].metaDescription
   d. Inject <link rel="canonical" href="https://[domain]/[slug]">
   e. Replace [PLACEHOLDER] image src with ImageGen URLs (if plugin active)
3. Generate sitemap.xml from all page slugs
4. Generate robots.txt (User-agent: * / Allow: /)
5. Compute total file count and size; update project record
6. Write build event: stage='assemble', status='completed', duration_ms

Validation failures: logged as warnings in build event message — build continues.
Broken references flagged with ⚠ icon in file explorer.
```

### Section Regeneration Pipeline (FR-06)

```
User selects page + section, provides instruction text
  │
POST /api/websites/:id/regenerate { pageSlug, sectionId, instruction }
  │
1. Load current SiteSpec and DesignSystem from project record
2. Run ContentAgent for that page only (with instruction injected into prompt)
3. Run CodegenAgent for that page only
4. Version previous file:
   INSERT INTO website_file_versions (project_id, file_path, version, content)
   SELECT project_id, path, version, content FROM website_files WHERE path = 'pages/<slug>.html'
5. UPDATE website_files SET content = new_content, version = version + 1
6. Return { status: 'done' } — no Vercel re-deploy triggered
   (preview iframe is reloaded from file content directly; production requires explicit re-deploy)
```

---

## 14. Deployment Pipeline

### Preview Deploy (auto, every build)

```
[Stage 6 Assembly complete]
         │
[DeployAgent receives: { projectId, files[], deployType: 'preview' }]
         │
[VercelPlugin.invoke('deploy.preview', {
  name: slugify(project.name),
  files: files.map(f => ({ file: f.path, data: f.content })),
  projectSettings: { framework: null, outputDirectory: '.' }
})]
         │
Vercel REST: POST /v13/deployments
         │
Poll: GET /v13/deployments/:deployId every 3s, timeout 120s
         │
  status = READY:
    INSERT website_deploys (type='preview', status='ready', deploy_url, vercel_deploy_id)
    UPDATE website_projects SET status='preview'
    EventBus.publish('website.deploy.completed', { type: 'preview', url })
    SSE: { type: 'build_done', previewUrl }
         │
  status = ERROR or timeout:
    INSERT website_deploys (type='preview', status='error', error_message)
    UPDATE website_projects SET status='error'
    SSE: { type: 'build_failed', error }
```

### Production Deploy (user-triggered)

```
[POST /api/websites/:id/deploy/production]
         │
Verify: latest preview deploy exists with status='ready'
         │
[Step A — optional, parallel] GitPlugin push:
  git.init({ projectId })
  git.commit({ files, message: `deploy: ${timestamp}` })
  git.push({ repoUrl: project.githubRepoUrl })
  (failure here does NOT block Vercel promote — logged as warning)
         │
[Step B] VercelPlugin.invoke('deploy.production', {
  deployId: latestPreviewDeploy.vercelDeployId,
  alias: `${slugify(project.name)}.vercel.app`
})
  → Vercel: POST /v6/deployments/:deployId/aliases
         │
Poll alias status: GET /v13/deployments/:aliasDeployId
         │
  READY:
    INSERT website_deploys (type='production', status='ready', deploy_url)
    UPDATE website_projects SET status='deployed'
    EventBus.publish('website.deploy.completed', { type: 'production', url })
```

---

## 15. Security

### Project Data Isolation

```typescript
// Enforced on every DB query — never trusts client-supplied projectId alone
const project = await db.get(
  'SELECT * FROM website_projects WHERE id = ? AND user_id = ?',
  [projectId, session.userId]
);
if (!project) throw new NotFoundError();  // 404, not 403 — no existence disclosure
```

### Generated Code Safety

- Generated HTML stored as `TEXT` in SQLite — never `eval()`'d or rendered server-side
- File paths validated before write: `if (!/^[a-zA-Z0-9/_.-]+$/.test(path)) throw new Error('Invalid path')`
- No user-supplied content in CodegenAgent prompt — only structured JSON from previous stages
- ImageGen prompts (from ContentAgent output): strip any markdown or code blocks before passing to DALL-E

### AI Input Sanitization

Applied to RawBrief fields before stage 1:
```typescript
const INJECTION_PATTERNS = [
  /<\|system\|>/gi, /<\|user\|>/gi, /<\/s>/gi,
  /IGNORE PREVIOUS/gi, /\[INST\]/gi, /\[\/INST\]/gi,
];
function sanitizeBriefField(value: string): string {
  let clean = value;
  for (const pattern of INJECTION_PATTERNS) clean = clean.replace(pattern, '');
  return clean.slice(0, 2000);  // hard length cap per field
}
```

### Secret Management

- `VERCEL_TOKEN`, `GITHUB_TOKEN`, `PLUGIN_IMAGEGEN_OPENAI_API_KEY` — server env only
- Never returned in any API response
- Never included in log output (masked: `vercel_***`)
- Env var names validated against allow-list at bootstrap — typos caught early

### Preview Iframe Security

```html
<!-- Dashboard iframe -->
<iframe
  src="https://[project-slug].vercel.app"
  sandbox="allow-scripts allow-same-origin"
  referrerpolicy="no-referrer"
></iframe>
```

CSP header on dashboard: `frame-src https://*.vercel.app;`

### Rate Limiting

- Max 3 concurrent builds per user (checked before `WorkflowEngine.startWorkflow()`)
- Max 10 projects per user (checked before `INSERT website_projects`)
- Max 5 regeneration requests per user per hour (simple counter in Redis or SQLite)
- Vercel API limit: 12 deployments/min — build queue enforces via delay if approaching limit

---

## 16. Billing Readiness

Full Stripe integration: M6 (not MVP). Infrastructure scaffolded from day 1.

### Plan Tiers (future implementation)

| Plan | Price | Projects | Pages | Output | Deploy |
|---|---|---|---|---|---|
| Free | $0 | 2 | 5 | HTML | Preview only |
| Starter | $19/mo | 10 | 10 | HTML | Preview + Production |
| Pro | $49/mo | Unlimited | 20 | HTML + Next.js | Preview + Production |
| Agency | $149/mo | 50 workspaces | 30 | All | Priority queue |

### Metered Billing Events (emitted from day 1)

```typescript
type BillingEvent =
  | { event: 'website.build.completed';    projectId: string; pageCount: number; tokenUsage: number }
  | { event: 'website.deploy.production';  projectId: string }
  | { event: 'website.image.generated';    projectId: string; count: number }
  | { event: 'website.regeneration';       projectId: string }
```

Stored in `website_billing_events` table. Stripe `reportUsage()` call added in M6.

### Quota Enforcement (from day 1)

```typescript
async function checkBuildQuota(userId: string): Promise<void> {
  const [activeBuilds, projectCount] = await Promise.all([
    db.get('SELECT COUNT(*) as c FROM website_projects WHERE user_id=? AND status=?', [userId, 'building']),
    db.get('SELECT COUNT(*) as c FROM website_projects WHERE user_id=? AND status!=?', [userId, 'archived']),
  ]);
  if (activeBuilds.c >= 3) throw new QuotaError('CONCURRENT_BUILD_LIMIT', 3);
  if (projectCount.c >= 10) throw new QuotaError('PROJECT_LIMIT', 10);
}
```

HTTP 429 response: `{ error: 'QUOTA_EXCEEDED', limit: 'CONCURRENT_BUILDS', current: 3, plan: 'free' }`

---

## 17. Success Metrics

### Primary KPIs

| Metric | Target | Source |
|---|---|---|
| Build success rate | > 95% | `website_build_events` failure count / total builds |
| Time to preview URL (p95) | < 3 min | `website_deploys.completed_at - website_projects.created_at` |
| User activation rate | > 60% | Users with ≥1 completed build / total signups |
| Net Promoter Score | > 40 | In-app survey after first production deploy |

### Quality KPIs

| Metric | Target | Source |
|---|---|---|
| Generated site Lighthouse performance | > 85 | Automated Lighthouse CI post-deploy |
| Generated site accessibility score | > 90 | Same |
| Generated site SEO score | > 90 | Same |
| Section regeneration rate | < 30% | Regenerations / builds (lower = higher first-pass quality) |
| First-pass deploy rate | > 70% | Production deploys without regeneration |

### Business KPIs

| Metric | Target | Cadence |
|---|---|---|
| Weekly active builders | +20% month-over-month | Weekly |
| Projects per user (day 7) | > 2 | Cohort |
| Preview → Production conversion | > 50% | Weekly |

---

## 18. MVP Scope

### Included in v1.0

- Brief wizard (6 fields, all types)
- "Import from URL" brief pre-fill via Firecrawl
- HTML5 + CSS output (no JavaScript, no framework)
- Up to 5 pages per site
- Up to 8 sections per page
- AI image generation (DALL-E 3, 1 per section, replaces placeholder)
- Image generation graceful fallback (placeholder kept if plugin absent)
- Vercel preview deploy (auto, after every build)
- File explorer with syntax highlighting
- ZIP export of all files
- SSE build progress with per-page stage visibility
- Section regeneration (text + code, one page at a time)
- File version history + revert (one version deep)
- Project list with status badges and thumbnails
- Quota enforcement (3 concurrent builds, 10 projects per user)
- Observability (all build events logged with timing and token usage)
- Billing event emission (to `website_billing_events`, no Stripe yet)

### Excluded from MVP (explicitly deferred)

| Feature | Version |
|---|---|
| Next.js / React output format | v1.1 |
| Vercel production deploy | v1.1 |
| GitHub repository push | v1.1 |
| Template starters | v1.1 |
| Custom domain setup | v1.2 |
| Section-level style overrides (sliders) | v1.2 |
| Figma design import | v1.2 |
| Team workspace sharing | v1.2 |
| Stripe billing + plan enforcement | v1.2 |
| White-label / agency mode | v2.0 |
| CMS integration (Contentful, Sanity) | v2.0 |
| A/B testing (Vercel split traffic) | v2.0 |
| Analytics embed | v2.0 |
| Ecommerce (Stripe Checkout) | v2.0 |

---

## 19. Post-MVP Scope

### v1.1 — Full Deploy Pipeline (~6 weeks after MVP)
- Next.js 15 App Router output (components, layouts, `app/` directory)
- GitHub OAuth + repository creation + `git push`
- Vercel production deploy with alias promotion
- 5 template starters (SaaS, Portfolio, Restaurant, Agency, E-commerce landing)
- Page limit raised to 10

### v1.2 — Customization + Teams (~12 weeks after MVP)
- Custom domain configuration: step-by-step DNS guide + Vercel domain API integration
- Section-level style overrides: UI sliders for color, font, spacing that update DesignSystem tokens
- Figma import: `figma.read-design` capability → DesignSystem pre-filled from Figma file
- Team workspaces: shared project pool, invite by email, viewer vs editor roles
- Stripe billing: Starter + Pro tiers enforced; metered usage reporting
- Page limit raised to 20

### v2.0 — Scale + Verticals (~24 weeks after MVP)
- CMS integration: Contentful + Sanity (editable content decoupled from generated code)
- White-label agency mode: custom branding, 50 client workspace slots per agency
- A/B testing: generate 2 hero section variants, Vercel split traffic via Edge Config
- Analytics embed: Plausible or Vercel Analytics injected into generated `<head>`
- Ecommerce: Stripe Checkout embed for simple digital or physical product sales
- Internationalization: multi-language brief → multi-locale site with hreflang
