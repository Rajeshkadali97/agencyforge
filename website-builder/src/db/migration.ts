import type Database from 'better-sqlite3';

interface ColumnInfo {
  name: string;
}

function getColumnNames(db: Database.Database, tableName: string): string[] {
  const cols = db.prepare(`PRAGMA table_info("${tableName}")`).all() as ColumnInfo[];
  return cols.map((c) => c.name);
}

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(tableName) as { name: string } | undefined;
  return row !== undefined;
}

export function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS website_projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      brief_json TEXT NOT NULL,
      analyzed_json TEXT,
      spec_json TEXT,
      design_json TEXT,
      output_format TEXT NOT NULL DEFAULT 'html',
      github_repo_url TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK (status IN ('draft','building','preview','deployed','error','archived')),
      CHECK (output_format IN ('html','nextjs'))
    );

    CREATE INDEX IF NOT EXISTS idx_website_projects_user_id
      ON website_projects (user_id);

    CREATE INDEX IF NOT EXISTS idx_website_projects_user_status
      ON website_projects (user_id, status);

    CREATE TABLE IF NOT EXISTS website_pages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES website_projects(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      meta_description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      generated_at INTEGER,
      CHECK (status IN ('pending','generating','done','error')),
      UNIQUE (project_id, slug)
    );

    CREATE INDEX IF NOT EXISTS idx_website_pages_project_id
      ON website_pages (project_id);

    CREATE TABLE IF NOT EXISTS website_files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES website_projects(id) ON DELETE CASCADE,
      page_id TEXT REFERENCES website_pages(id) ON DELETE SET NULL,
      path TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      UNIQUE (project_id, path)
    );

    CREATE INDEX IF NOT EXISTS idx_website_files_project_id
      ON website_files (project_id);

    CREATE TABLE IF NOT EXISTS website_file_versions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE (project_id, file_path, version)
    );

    CREATE TABLE IF NOT EXISTS website_deploys (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES website_projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      deploy_url TEXT,
      vercel_deploy_id TEXT,
      commit_sha TEXT,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      CHECK (type IN ('preview','production')),
      CHECK (status IN ('pending','building','ready','error'))
    );

    CREATE INDEX IF NOT EXISTS idx_website_deploys_project_id
      ON website_deploys (project_id);

    CREATE TABLE IF NOT EXISTS website_build_events (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES website_projects(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      page_slug TEXT,
      status TEXT NOT NULL,
      message TEXT,
      duration_ms INTEGER,
      token_usage INTEGER,
      created_at INTEGER NOT NULL,
      CHECK (status IN ('started','completed','failed'))
    );

    CREATE INDEX IF NOT EXISTS idx_website_build_events_project_id
      ON website_build_events (project_id);

    CREATE TABLE IF NOT EXISTS website_billing_events (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      metadata_json TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_website_billing_events_user_id
      ON website_billing_events (user_id);
  `);

  // Created separately: old-schema DBs have file_id not project_id; index would fail on wrong schema
  if (getColumnNames(db, 'website_file_versions').includes('project_id')) {
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_website_file_versions_project ON website_file_versions (project_id, file_path)`,
    );
  }
}

// Returns true when website_files_m1 was created and must be dropped after version migration
function migrateWebsiteFiles(db: Database.Database): boolean {
  if (!tableExists(db, 'website_files')) return false;
  const cols = getColumnNames(db, 'website_files');
  if (!cols.includes('file_path')) return false;

  db.exec(`ALTER TABLE website_files RENAME TO website_files_m1`);
  db.exec(`
    CREATE TABLE website_files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES website_projects(id) ON DELETE CASCADE,
      page_id TEXT REFERENCES website_pages(id) ON DELETE SET NULL,
      path TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      UNIQUE (project_id, path)
    )
  `);
  db.exec(`
    INSERT INTO website_files (id, project_id, page_id, path, content, size_bytes, version, created_at)
    SELECT id, project_id, page_id, file_path, '', size_bytes, 1, created_at
    FROM website_files_m1
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_website_files_project_id ON website_files (project_id)`);
  // website_files_m1 kept alive so migrateWebsiteFileVersions can JOIN it safely
  return true;
}

function migrateWebsiteFileVersions(db: Database.Database, filesM1Exists: boolean): void {
  if (!tableExists(db, 'website_file_versions')) {
    if (filesM1Exists) db.exec(`DROP TABLE IF EXISTS website_files_m1`);
    return;
  }
  const cols = getColumnNames(db, 'website_file_versions');
  if (!cols.includes('file_id')) {
    if (filesM1Exists) db.exec(`DROP TABLE IF EXISTS website_files_m1`);
    return;
  }

  db.exec(`ALTER TABLE website_file_versions RENAME TO website_file_versions_m1`);
  db.exec(`
    CREATE TABLE website_file_versions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE (project_id, file_path, version)
    )
  `);

  if (filesM1Exists) {
    // website_files_m1 still has old schema with file_path column; join it directly
    db.exec(`
      INSERT INTO website_file_versions (id, project_id, file_path, version, content, created_at)
      SELECT v.id, f.project_id, f.file_path, v.version_number, v.content, v.created_at
      FROM website_file_versions_m1 v
      JOIN website_files_m1 f ON v.file_id = f.id
    `);
  } else {
    // website_files already has new schema with path column
    db.exec(`
      INSERT INTO website_file_versions (id, project_id, file_path, version, content, created_at)
      SELECT v.id, f.project_id, f.path, v.version_number, v.content, v.created_at
      FROM website_file_versions_m1 v
      JOIN website_files f ON v.file_id = f.id
    `);
  }

  // Drop child table first so parent FK constraint is clear, then drop parent
  db.exec(`DROP TABLE website_file_versions_m1`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_website_file_versions_project ON website_file_versions (project_id, file_path)`,
  );
  if (filesM1Exists) {
    db.exec(`DROP TABLE website_files_m1`);
  }
}

export function runMigrations(db: Database.Database): void {
  createTables(db);
  const filesM1Exists = migrateWebsiteFiles(db);
  migrateWebsiteFileVersions(db, filesM1Exists);
}
