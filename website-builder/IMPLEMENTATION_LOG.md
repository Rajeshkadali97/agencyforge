# Website Builder — Milestone 1 Implementation Log

## Overview

Milestone 1 delivers the project intake flow: session management, project creation wizard, quota enforcement, and project listing/archiving. No AI pipeline. No file generation. No deployment.

## Package: `@agencyforge/website-builder`

### `src/types.ts`
All shared TypeScript types. No runtime code.

Key types:
- `ProjectStatus` — `draft | building | preview | deployed | error | archived`
- `OutputFormat` — `html | nextjs`
- `GoalType` — `leads | sales | credibility | portfolio | info`
- `StylePreference` — `minimal | bold | corporate | warm | creative`
- `RawBrief` — raw wizard submission
- `WebsiteProject` — full DB row shape (camelCase)
- `WebsiteProjectSummary` — list-view subset (no JSON blobs)
- `CreateProjectInput`, `ListProjectsInput`, `ListProjectsResult`, `UpdateProjectInput`
- `BillingEventData` — internal billing emission shape

### `src/errors.ts`
Three custom error classes:
- `WebsiteBuilderQuotaError(limit, current, max)` — thrown by `checkBuildQuota`
- `WebsiteBuilderNotFoundError(id)` — for explicit not-found signaling
- `WebsiteBuilderValidationError(message)` — thrown by sanitize functions

### `src/db/migration.ts`
`createTables(db: Database.Database): void`

Creates 7 tables (idempotent, `IF NOT EXISTS`):

| Table | Purpose |
|---|---|
| `website_projects` | Core project record |
| `website_pages` | Per-page metadata (populated M2+) |
| `website_files` | Generated file index (populated M2+) |
| `website_file_versions` | File version history (populated M2+) |
| `website_deploys` | Deploy records (populated M3+) |
| `website_build_events` | Build stage telemetry (populated M2+) |
| `website_billing_events` | Billing audit log (populated M1+) |

Indexes on `user_id`, `user_id+status`, and all FK columns.

`website_projects.status` CHECK constraint: enforces valid enum at DB level.

### `src/db/WebsiteDb.ts`
Singleton pattern: `getSharedDb()` opens one `Database` instance per process, sets WAL + foreign keys, calls `createTables`. `getWebsiteDb()` returns `new WebsiteDb(getSharedDb())`.

`WebsiteDb` methods:
- `createProject(input)` — inserts with `status='building'`, returns full row
- `updateProjectStatus(id, status)` — unchecked update (internal use only)
- `updateProject(id, userId, input)` — user-scoped partial update, returns boolean
- `getProject(id, userId)` — user-scoped fetch, returns null if not found or wrong user
- `listProjects(input)` — excludes `archived` by default; paginated; `ORDER BY created_at DESC, rowid DESC`
- `archiveProject(id, userId)` — sets `status='archived'` only if not already archived; returns boolean
- `countActiveBuilds(userId)` — counts `status='building'` for quota check
- `countUserProjects(userId)` — counts non-archived for quota check
- `createBillingEvent(data)` — inserts into `website_billing_events`

User isolation: every method that reads or writes project data includes `AND user_id = ?`.

### `src/quota.ts`
```
MAX_CONCURRENT_BUILDS = 3
MAX_PROJECTS_PER_USER = 10
```

`checkBuildQuota(db, userId)` throws `WebsiteBuilderQuotaError` with correct limit type if either threshold is met. Called before every `createProject`.

### `src/sanitize.ts`
All functions throw `WebsiteBuilderValidationError` on violation.

| Function | Limits |
|---|---|
| `sanitizeProjectName` | 1–100 chars, strips control chars |
| `sanitizeDescription` | max 2000 chars, strips control chars (preserves `\n`) |
| `sanitizeBusinessType` | 1–100 chars, strips control chars |
| `sanitizeAudience` | max 500 chars, strips control chars (preserves `\n`) |
| `sanitizeUrl` | must parse as valid http/https URL |

### `src/billing.ts`
Stub emitters that write to `website_billing_events`. No external calls.

- `emitBuildStarted(db, projectId, userId)` — event: `website.build.completed`
- `emitProductionDeploy(db, projectId, userId)` — event: `website.deploy.production`
- `emitImageGenerated(db, projectId, userId, count)` — event: `website.image.generated`
- `emitRegeneration(db, projectId, userId)` — event: `website.regeneration`

### `src/index.ts`
Public barrel. Re-exports everything from all modules.

---

## Dashboard Integration

### `lib/website-session.ts`
Cookie `wb_user_id` — httpOnly, sameSite:lax, 1-year maxAge. UUID generated on first request.

- `resolveUserId(request: NextRequest)` — for API routes
- `setUserIdCookie(response, userId)` — attaches Set-Cookie to response
- `getSessionUserId()` — for server components via `next/headers`

Replaced by NextAuth in M6.

### `app/api/websites/route.ts`
- `GET` — list projects (excludes archived, paginated)
- `POST` — validate → sanitize → checkBuildQuota → createProject → updateProjectStatus('preview') → emitBuildStarted → 201

M1 mock: immediately transitions `building→preview`. No actual build pipeline.

### `app/api/websites/[id]/route.ts`
- `GET` — fetch single project (404 for wrong user)
- `PATCH` — update name only
- `DELETE ?action=archive` — archive project; 400 for unknown action

### `app/websites/page.tsx`
Server component. EmptyState when no projects; ProjectCard grid otherwise.

### `app/websites/new/page.tsx`
Client component. 6-step wizard (name, businessType, description, targetAudience, goals, stylePreference). Handles 429 quota errors with user-readable messages.

### `app/websites/[id]/page.tsx`
Server component. Project header, StatusBadge, BriefSection, M2 placeholder, ArchiveButton.

### `app/websites/[id]/ArchiveButton.tsx`
`'use client'`. DELETE `/api/websites/:id?action=archive` → redirect to `/websites`.

### `components/sidebar.tsx` (modified)
Added Websites nav item with Globe icon.

---

## Build Verification

```
next build — Compiled successfully
9 routes generated, 0 type errors
```

## Test Results

```
51/51 passing

sanitize.test.ts   24 tests
quota.test.ts       7 tests
WebsiteDb.test.ts  20 tests
```

## Typecheck

```
@agencyforge/website-builder — 0 errors
agencyforge-dashboard        — 0 errors
```

## Production Readiness Review — Fixes Applied

### Critical Fixed
- **C1 Race condition**: `checkBuildQuota` + `createProject` now wrapped in `WebsiteDb.runTransaction()` — atomic SQLite transaction prevents concurrent quota bypass
- **C2 ArchiveButton silent success**: `response.ok` checked before redirect; error message shown on 404/500; network errors caught and displayed

### High Fixed
- **H1 Cookie secure flag**: `setUserIdCookie` sets `secure: true` in production (`NODE_ENV === 'production'`)
- **H2 Cookie UUID validation**: `resolveUserId` validates cookie against UUID v4 regex before trusting; malformed values generate new UUID
- **H3 Prompt injection stripping**: `sanitizeDescription`, `sanitizeBusinessType`, `sanitizeAudience` strip `IGNORE PREVIOUS`, `[INST]`, `<|system|>`, `<|user|>`, `[/INST]`, `</s>` patterns per PRD §15
- **H4 Limit/offset validation**: GET `/api/websites` clamps `limit` to 1–100, `offset` to ≥0; NaN handled with defaults
- **H5 DELETE API contract**: DELETE `/api/websites/:id` always archives (no `?action=archive` required); `ArchiveButton` updated to match
- **H6 Label/input association**: All 4 wizard text inputs have `id`; labels have matching `htmlFor`; hint text linked via `aria-describedby`
- **H7 Checkbox/radio ARIA**: Goal buttons have `role="checkbox"` + `aria-checked`; style buttons have `role="radio"` + `aria-checked`; groups have `role="group"`/`role="radiogroup"` with `aria-labelledby`

### Medium / Low (Documented, Not Fixed)
- M1: `emitBuildStarted` name vs `website.build.completed` event type — reconcile in M2
- M2: `website_files.file_path` vs PRD `path` column — needs migration script before M2 file writes
- M3: `website_file_versions` uses `file_id` FK vs PRD denormalized — verify M2 revert API compatibility
- M4: No schema migration runner — add before M2 column changes
- M5: No `Retry-After` header on 429
- M6: `getSessionUserId` returns `''` not `null | string` — fix when switching to NextAuth
- M7: `sanitizeUrl` exported but unused — remove when `importUrl` wired in M3
- M8: `getSharedDb` exported unnecessarily
- L1–L7: `aria-hidden` on icons, focus management on step advance, `aria-live` on errors, response body format per PRD

## M1.1 Database Alignment Sprint — Complete

### Objective
Resolve all schema deviations in `website_files` and `website_file_versions` so the implementation exactly matches the PRD database specification before M2 file writes begin.

### Schema Changes

#### `website_files`
| Column | Old (M1) | New (PRD-aligned) |
|--------|----------|-------------------|
| `file_path` | `TEXT NOT NULL` | REMOVED — renamed to `path` |
| `content_type` | `TEXT NOT NULL` | REMOVED — not in PRD |
| `updated_at` | `INTEGER NOT NULL` | REMOVED — not in PRD |
| `path` | (missing) | `TEXT NOT NULL` |
| `content` | (missing) | `TEXT NOT NULL DEFAULT ''` |
| `version` | (missing) | `INTEGER NOT NULL DEFAULT 1` |
| UNIQUE | `(project_id, file_path)` | `(project_id, path)` |

`page_id ON DELETE SET NULL` retained — safer than PRD's unspecified default.

#### `website_file_versions`
| Column | Old (M1) | New (PRD-aligned) |
|--------|----------|-------------------|
| `file_id` | `TEXT NOT NULL REFERENCES website_files(id) ON DELETE CASCADE` | REMOVED — replaced with denormalized columns |
| `version_number` | `INTEGER NOT NULL` | REMOVED — renamed to `version` |
| `project_id` | (missing) | `TEXT NOT NULL` (denormalized) |
| `file_path` | (missing) | `TEXT NOT NULL` (denormalized) |
| `version` | (missing) | `INTEGER NOT NULL` |
| UNIQUE | (none) | `(project_id, file_path, version)` |

#### Indexes
| Old | New |
|-----|-----|
| `idx_website_file_versions_file_id ON website_file_versions (file_id)` | REMOVED |
| (none) | `idx_website_file_versions_project ON website_file_versions (project_id, file_path)` |

### Files Modified
- `src/db/migration.ts` — full rewrite: PRD-aligned `createTables`, added `runMigrations` export plus two upgrade functions
- `src/types.ts` — added `WebsiteFile` and `WebsiteFileVersion` interfaces
- `src/db/WebsiteDb.ts` — `getSharedDb()` calls `runMigrations` instead of `createTables`
- `src/index.ts` — exports `runMigrations`, `WebsiteFile`, `WebsiteFileVersion`
- `src/__tests__/migration.test.ts` — 13 new migration tests (new file)

### Migration Strategy
- `runMigrations(db)` = `createTables(db)` (idempotent, IF NOT EXISTS) + two upgrade passes
- Detection: presence of old column (`file_path` / `file_id`) determines if upgrade needed
- `migrateWebsiteFiles`: rename old→`_m1`, create new schema, insert from `_m1`, keep `_m1` alive for JOIN
- `migrateWebsiteFileVersions`: rename old→`_m1`, create new schema, JOIN `website_file_versions_m1 v JOIN website_files_m1 f ON v.file_id = f.id` using old `file_path` column, drop child `_m1` then parent `_m1`
- Both functions are idempotent — second call detects new schema and skips

### Verification Results

```
Tests:      67/67 passing (13 new migration tests added)
Typechecks: 0 errors (@agencyforge/website-builder + agencyforge-dashboard)
Build:      Clean — 9 routes compiled
```

Migration test coverage:
- Fresh install: PRD column set, UNIQUE(project_id, file_path, version) constraint, idx_website_file_versions_project
- Upgrade website_files: column rename/removal, content/version defaults, full row data preserved
- Upgrade website_file_versions: column restructure, denormalized project_id+file_path from JOIN, multi-file/version case
- Idempotency: fresh DB x2, old DB x2, schema correct after second call

### Backward Compatibility
- M1 tables had zero rows — no data loss possible
- All M1 API routes unchanged — no file/version methods exposed until M2
- `createTables` signature unchanged — existing test callers unaffected
- `runMigrations` is a new additive export — non-breaking

### Column Classification — PRD vs M1 Implementation

Categories: **Match** | **Intentional deviation** | **Unintentional deviation (corrected)**

#### `website_files`

| Column | PRD Spec | M1 Implementation | Category |
|--------|----------|-------------------|----------|
| `id TEXT PRIMARY KEY` | same | same | Match |
| `project_id TEXT NOT NULL REFERENCES website_projects(id) ON DELETE CASCADE` | same | same | Match |
| `page_id TEXT REFERENCES website_pages(id) ON DELETE SET NULL` | `REFERENCES website_pages(id)` (no ON DELETE in PRD) | Added `ON DELETE SET NULL` | **Intentional deviation** — prevents orphaned `page_id` when page deleted |
| `path TEXT NOT NULL` | `path TEXT NOT NULL` | `file_path TEXT NOT NULL` | **Unintentional deviation (corrected)** — renamed |
| `content TEXT NOT NULL DEFAULT ''` | `content TEXT NOT NULL` (no DEFAULT in PRD) | column missing entirely | **Unintentional deviation (corrected)**; `DEFAULT ''` intentional addition for migration safety |
| `size_bytes INTEGER NOT NULL DEFAULT 0` | `size_bytes INTEGER NOT NULL` (no DEFAULT in PRD) | `size_bytes INTEGER NOT NULL DEFAULT 0` | Match — `DEFAULT 0` is **intentional deviation** for migration safety |
| `version INTEGER NOT NULL DEFAULT 1` | `version INTEGER NOT NULL` (no DEFAULT in PRD) | column missing entirely | **Unintentional deviation (corrected)**; `DEFAULT 1` intentional addition for migration safety |
| `created_at INTEGER NOT NULL` | same | same | Match |
| `content_type TEXT NOT NULL` | not in PRD | present | **Unintentional deviation (corrected)** — removed |
| `updated_at INTEGER NOT NULL` | not in PRD | present | **Unintentional deviation (corrected)** — removed |
| `UNIQUE(project_id, path)` | `UNIQUE(project_id, path)` | `UNIQUE(project_id, file_path)` | **Unintentional deviation (corrected)** |

#### `website_file_versions`

| Column | PRD Spec | M1 Implementation | Category |
|--------|----------|-------------------|----------|
| `id TEXT PRIMARY KEY` | same | same | Match |
| `project_id TEXT NOT NULL` (no FK) | denormalized, no FK | `file_id TEXT NOT NULL REFERENCES website_files(id) ON DELETE CASCADE` | **Unintentional deviation (corrected)** — replaced FK with denormalized columns |
| `file_path TEXT NOT NULL` | `file_path TEXT NOT NULL` | column missing entirely | **Unintentional deviation (corrected)** |
| `version INTEGER NOT NULL` | `version INTEGER NOT NULL` | `version_number INTEGER NOT NULL` | **Unintentional deviation (corrected)** — renamed |
| `content TEXT NOT NULL` | same | same | Match |
| `created_at INTEGER NOT NULL` | same | same | Match |
| `UNIQUE(project_id, file_path, version)` | `UNIQUE(project_id, file_path, version)` | missing | **Unintentional deviation (corrected)** |

### Property Verification

**Rollback safety:** Forward-only. `DROP TABLE website_file_versions_m1` and `DROP TABLE website_files_m1` are irreversible. No automatic rollback mechanism. If process crashes mid-migration, DB may be in partial state (see failure scenario test — `website_files_m1` orphan persists as known limitation). Recommendation: backup DB file before running `runMigrations` against a production database with existing rows. M1 had zero rows so no data was at risk during the M1→M1.1 upgrade.

**FK integrity:**
- `website_files.project_id → website_projects.id ON DELETE CASCADE` — enforced; test "rejects website_files insert with nonexistent project_id" confirms violation throws
- `website_files.page_id → website_pages.id ON DELETE SET NULL` — enforced; test "sets website_files.page_id to NULL when page deleted" confirms
- `website_file_versions` has NO FK — intentional PRD design (denormalized); confirmed by test "does NOT cascade to website_file_versions when website_files row deleted"
- All FK enforcement requires `PRAGMA foreign_keys = ON` — set in `WebsiteDb.ts` line 70 and in all test helpers via `makeFreshDb()`

**Cascade behavior:**
- Delete `website_projects` → CASCADE deletes all `website_files` for that project (enforced, tested)
- Delete `website_pages` → SET NULL on `website_files.page_id` (enforced, tested)
- Delete `website_files` row → `website_file_versions` rows become **orphaned** (no FK, no cascade) — M2 application code must explicitly delete version history when deleting a file
- Delete `website_projects` → `website_file_versions` rows are **not** deleted (no FK from versions to projects) — M2 must also clean up versions on project delete

**Index integrity:**
- `idx_website_files_project_id ON website_files (project_id)` — supports `SELECT * FROM website_files WHERE project_id = ?`; created in both `createTables` and `migrateWebsiteFiles`
- `idx_website_file_versions_project ON website_file_versions (project_id, file_path)` — supports version lookup by `(project_id, file_path)`; created conditionally in `createTables` (skipped on old-schema DB where `project_id` column absent) and at end of `migrateWebsiteFileVersions`; existence confirmed by test "creates idx_website_file_versions_project index"

**Constraint enforcement:**
- `UNIQUE(project_id, path)` on `website_files` — enforced; tested in "rejects duplicate UNIQUE(project_id, path) in website_files"
- `UNIQUE(project_id, file_path, version)` on `website_file_versions` — enforced; tested in "enforces UNIQUE(project_id, file_path, version) on website_file_versions"
- `NOT NULL` on all required columns — enforced at DB level; violation throws immediately
- `CHECK(status IN (...))` and `CHECK(output_format IN (...))` on `website_projects` — covered by existing `WebsiteDb.test.ts`

**Version history preservation:** M1 tables had zero rows — the AI pipeline that writes file content is M2+. No version records existed at migration time. The migration JOIN logic (`website_file_versions_m1 JOIN website_files_m1`) is correct for any future data, but zero rows meant zero rows to preserve. No data loss was possible or occurred.

### Test Coverage Matrix

| Scenario | Status | Test |
|----------|--------|------|
| Fresh install — website_files PRD columns | Covered | "creates website_files with PRD schema" |
| Fresh install — website_file_versions PRD columns | Covered | "creates website_file_versions with PRD schema" |
| Fresh install — UNIQUE(project_id, file_path, version) | Covered | "enforces UNIQUE(project_id, file_path, version)..." |
| Fresh install — idx_website_file_versions_project | Covered | "creates idx_website_file_versions_project index" |
| M1 upgrade — website_files column rename/removal | Covered | "migrates website_files columns: file_path→path..." |
| M1 upgrade — website_files row data preserved | Covered | "preserves website_files row data during migration" |
| M1 upgrade — website_file_versions column restructure | Covered | "migrates website_file_versions columns..." |
| M1 upgrade — JOIN denormalization | Covered | "denormalizes project_id+file_path from joined website_files..." |
| M1 upgrade — multiple files and versions | Covered | "migrates multiple files and versions" |
| M1 upgrade — idx created post-upgrade | Covered | "creates idx_website_file_versions_project after upgrade" |
| Idempotency — fresh DB x2 | Covered | "running twice on fresh DB does not throw" |
| Idempotency — upgraded DB x2 | Covered | "running twice on already-migrated old DB does not throw" |
| Idempotency — schema correct after second call | Covered | "schema stays correct after second runMigrations on fresh DB" |
| FK integrity — project_id enforced | Covered | "rejects website_files insert with nonexistent project_id" |
| FK integrity — page_id enforced | Covered | "rejects website_files insert with nonexistent page_id" |
| FK integrity — page delete → SET NULL | Covered | "sets website_files.page_id to NULL when page deleted" |
| Constraint — UNIQUE(project_id, path) | Covered | "rejects duplicate UNIQUE(project_id, path) in website_files" |
| Cascade — project delete → files deleted | Covered | "cascades delete to website_files when project deleted" |
| Cascade — file delete → versions NOT deleted | Covered | "does NOT cascade to website_file_versions when website_files row deleted" |
| CRUD after upgrade — website_files | Covered | "can INSERT and SELECT website_files with new schema after upgrade" |
| CRUD after upgrade — website_file_versions | Covered | "can INSERT and SELECT website_file_versions with new schema after upgrade" |
| Versioning — multiple versions same file | Covered | "stores multiple versions for same (project_id, file_path)" |
| Failure — partial state / orphan after crash | Covered | "recovers when website_files_m1 orphan exists but website_files absent" |
| Data preservation — M1 had zero rows | N/A | Explicitly: M1 had no file writes; migration logic handles any future data correctly |
| Repository compatibility | N/A | No WebsiteDb methods for files/versions until M2; project CRUD covered by existing WebsiteDb.test.ts |

See `docs/schema.md` for Mermaid ER diagram of all 7 tables.

## Remaining Work Before M2

- AI pipeline: brief analysis, spec generation, design tokens, HTML/Next.js generation
- File explorer UI (website_pages, website_files tables)
- Preview iframe
- Regeneration flow
- Error recovery UI for status='error'
- NextAuth session (M6, but auth shape affects M2 API contracts)
