# Website Builder — Database Schema

All 7 tables. SQLite, WAL mode, `foreign_keys = ON`.

```mermaid
erDiagram
    website_projects {
        TEXT id PK
        TEXT user_id
        TEXT name
        TEXT status
        TEXT brief_json
        TEXT analyzed_json
        TEXT spec_json
        TEXT design_json
        TEXT output_format
        TEXT github_repo_url
        INTEGER created_at
        INTEGER updated_at
    }
    website_pages {
        TEXT id PK
        TEXT project_id FK
        TEXT slug
        TEXT title
        TEXT meta_description
        TEXT status
        TEXT error_message
        INTEGER generated_at
    }
    website_files {
        TEXT id PK
        TEXT project_id FK
        TEXT page_id FK
        TEXT path
        TEXT content
        INTEGER size_bytes
        INTEGER version
        INTEGER created_at
    }
    website_file_versions {
        TEXT id PK
        TEXT project_id
        TEXT file_path
        INTEGER version
        TEXT content
        INTEGER created_at
    }
    website_deploys {
        TEXT id PK
        TEXT project_id FK
        TEXT type
        TEXT status
        TEXT deploy_url
        TEXT vercel_deploy_id
        TEXT commit_sha
        TEXT error_message
        INTEGER created_at
        INTEGER completed_at
    }
    website_build_events {
        TEXT id PK
        TEXT project_id FK
        TEXT stage
        TEXT page_slug
        TEXT status
        TEXT message
        INTEGER duration_ms
        INTEGER token_usage
        INTEGER created_at
    }
    website_billing_events {
        TEXT id PK
        TEXT project_id
        TEXT user_id
        TEXT event_type
        INTEGER quantity
        TEXT metadata_json
        INTEGER created_at
    }

    website_projects ||--o{ website_pages : "ON DELETE CASCADE"
    website_projects ||--o{ website_files : "ON DELETE CASCADE"
    website_pages |o--o{ website_files : "page_id ON DELETE SET NULL"
    website_projects ||--o{ website_deploys : "ON DELETE CASCADE"
    website_projects ||--o{ website_build_events : "ON DELETE CASCADE"
```

## Notes

**`website_file_versions` has no FK** — intentional PRD design. Composite identifier `(project_id, file_path)` used instead of FK to `website_files`. Consequence: deleting a `website_files` row does **not** cascade to `website_file_versions`; M2 application code must clean up version rows explicitly on file or project delete.

**`website_billing_events.project_id`** — no FK constraint. Billing records are retained even if the project is deleted.

**`website_pages |o--o{ website_files`** — `page_id` is nullable (`ON DELETE SET NULL`). A file belongs to zero or one pages. Deleting a page nulls `page_id` on all its files; the files themselves are not deleted.

## Indexes

| Index | Table | Columns |
|-------|-------|---------|
| `idx_website_projects_user_id` | `website_projects` | `user_id` |
| `idx_website_projects_user_status` | `website_projects` | `user_id, status` |
| `idx_website_pages_project_id` | `website_pages` | `project_id` |
| `idx_website_files_project_id` | `website_files` | `project_id` |
| `idx_website_file_versions_project` | `website_file_versions` | `project_id, file_path` |
| `idx_website_deploys_project_id` | `website_deploys` | `project_id` |
| `idx_website_build_events_project_id` | `website_build_events` | `project_id` |
| `idx_website_billing_events_user_id` | `website_billing_events` | `user_id` |

## Unique Constraints

| Table | Columns |
|-------|---------|
| `website_pages` | `(project_id, slug)` |
| `website_files` | `(project_id, path)` |
| `website_file_versions` | `(project_id, file_path, version)` |
