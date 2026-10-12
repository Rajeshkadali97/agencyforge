import Database from 'better-sqlite3';
import { describe, it, expect } from 'vitest';
import { createTables, runMigrations } from '../db/migration';

interface ColInfo {
  name: string;
}

function colNames(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info("${table}")`).all() as ColInfo[]).map((c) => c.name);
}

function makeFreshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function makeOldSchemaDb(): Database.Database {
  const db = makeFreshDb();
  db.exec(`
    CREATE TABLE website_projects (
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
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE website_pages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES website_projects(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      meta_description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      generated_at INTEGER,
      UNIQUE (project_id, slug)
    );
    CREATE TABLE website_files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES website_projects(id) ON DELETE CASCADE,
      page_id TEXT REFERENCES website_pages(id) ON DELETE SET NULL,
      file_path TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (project_id, file_path)
    );
    CREATE INDEX idx_website_files_project_id ON website_files (project_id);
    CREATE TABLE website_file_versions (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL REFERENCES website_files(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_website_file_versions_file_id ON website_file_versions (file_id);
    CREATE TABLE website_deploys (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES website_projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      deploy_url TEXT,
      vercel_deploy_id TEXT,
      commit_sha TEXT,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );
    CREATE TABLE website_build_events (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES website_projects(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      page_slug TEXT,
      status TEXT NOT NULL,
      message TEXT,
      duration_ms INTEGER,
      token_usage INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE website_billing_events (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      metadata_json TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  return db;
}

describe('createTables — fresh install', () => {
  it('creates website_files with PRD schema', () => {
    const db = makeFreshDb();
    createTables(db);
    const cols = colNames(db, 'website_files');
    expect(cols).toContain('path');
    expect(cols).toContain('content');
    expect(cols).toContain('version');
    expect(cols).not.toContain('file_path');
    expect(cols).not.toContain('content_type');
    expect(cols).not.toContain('updated_at');
  });

  it('creates website_file_versions with PRD schema', () => {
    const db = makeFreshDb();
    createTables(db);
    const cols = colNames(db, 'website_file_versions');
    expect(cols).toContain('project_id');
    expect(cols).toContain('file_path');
    expect(cols).toContain('version');
    expect(cols).not.toContain('file_id');
    expect(cols).not.toContain('version_number');
  });

  it('enforces UNIQUE(project_id, file_path, version) on website_file_versions', () => {
    const db = makeFreshDb();
    createTables(db);
    db.exec(`INSERT INTO website_projects (id,user_id,name,status,brief_json,output_format,created_at,updated_at) VALUES ('p1','u1','N','draft','{}','html',1,1)`);
    db.exec(`INSERT INTO website_file_versions (id,project_id,file_path,version,content,created_at) VALUES ('v1','p1','index.html',1,'x',1)`);
    expect(() =>
      db.exec(`INSERT INTO website_file_versions (id,project_id,file_path,version,content,created_at) VALUES ('v2','p1','index.html',1,'y',2)`)
    ).toThrow();
  });

  it('creates idx_website_file_versions_project index', () => {
    const db = makeFreshDb();
    createTables(db);
    const indexes = (
      db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='website_file_versions'`).all() as { name: string }[]
    ).map((r) => r.name);
    expect(indexes).toContain('idx_website_file_versions_project');
  });
});

describe('runMigrations — upgrade from M1 schema', () => {
  it('migrates website_files columns: file_path→path, drops content_type/updated_at, adds content/version', () => {
    const db = makeOldSchemaDb();
    db.exec(`INSERT INTO website_projects (id,user_id,name,status,brief_json,output_format,created_at,updated_at) VALUES ('p1','u1','My Site','draft','{}','html',1000,1000)`);
    db.exec(`INSERT INTO website_files (id,project_id,page_id,file_path,content_type,size_bytes,created_at,updated_at) VALUES ('f1','p1',NULL,'index.html','text/html',512,1000,2000)`);

    runMigrations(db);

    const cols = colNames(db, 'website_files');
    expect(cols).toContain('path');
    expect(cols).toContain('content');
    expect(cols).toContain('version');
    expect(cols).not.toContain('file_path');
    expect(cols).not.toContain('content_type');
    expect(cols).not.toContain('updated_at');
  });

  it('preserves website_files row data during migration', () => {
    const db = makeOldSchemaDb();
    db.exec(`INSERT INTO website_projects (id,user_id,name,status,brief_json,output_format,created_at,updated_at) VALUES ('p1','u1','My Site','draft','{}','html',1000,1000)`);
    db.exec(`INSERT INTO website_files (id,project_id,page_id,file_path,content_type,size_bytes,created_at,updated_at) VALUES ('f1','p1',NULL,'pages/index.html','text/html',512,1000,2000)`);

    runMigrations(db);

    const row = db.prepare('SELECT * FROM website_files WHERE id = ?').get('f1') as Record<string, unknown>;
    expect(row['path']).toBe('pages/index.html');
    expect(row['content']).toBe('');
    expect(row['version']).toBe(1);
    expect(row['size_bytes']).toBe(512);
    expect(row['created_at']).toBe(1000);
    expect(row['project_id']).toBe('p1');
    expect(row['page_id']).toBeNull();
  });

  it('migrates website_file_versions columns: file_id+version_number→project_id+file_path+version', () => {
    const db = makeOldSchemaDb();
    db.exec(`INSERT INTO website_projects (id,user_id,name,status,brief_json,output_format,created_at,updated_at) VALUES ('p1','u1','My Site','draft','{}','html',1000,1000)`);
    db.exec(`INSERT INTO website_files (id,project_id,page_id,file_path,content_type,size_bytes,created_at,updated_at) VALUES ('f1','p1',NULL,'style.css','text/css',200,1000,1000)`);
    db.exec(`INSERT INTO website_file_versions (id,file_id,content,version_number,created_at) VALUES ('v1','f1','body{}',1,2000)`);

    runMigrations(db);

    const cols = colNames(db, 'website_file_versions');
    expect(cols).toContain('project_id');
    expect(cols).toContain('file_path');
    expect(cols).toContain('version');
    expect(cols).not.toContain('file_id');
    expect(cols).not.toContain('version_number');
  });

  it('denormalizes project_id+file_path from joined website_files during version migration', () => {
    const db = makeOldSchemaDb();
    db.exec(`INSERT INTO website_projects (id,user_id,name,status,brief_json,output_format,created_at,updated_at) VALUES ('p1','u1','My Site','draft','{}','html',1000,1000)`);
    db.exec(`INSERT INTO website_files (id,project_id,page_id,file_path,content_type,size_bytes,created_at,updated_at) VALUES ('f1','p1',NULL,'style.css','text/css',200,1000,1000)`);
    db.exec(`INSERT INTO website_file_versions (id,file_id,content,version_number,created_at) VALUES ('v1','f1','body { color: red; }',3,2000)`);

    runMigrations(db);

    const row = db.prepare('SELECT * FROM website_file_versions WHERE id = ?').get('v1') as Record<string, unknown>;
    expect(row['project_id']).toBe('p1');
    expect(row['file_path']).toBe('style.css');
    expect(row['version']).toBe(3);
    expect(row['content']).toBe('body { color: red; }');
    expect(row['created_at']).toBe(2000);
  });

  it('migrates multiple files and versions', () => {
    const db = makeOldSchemaDb();
    db.exec(`INSERT INTO website_projects (id,user_id,name,status,brief_json,output_format,created_at,updated_at) VALUES ('p1','u1','Site','draft','{}','html',1,1)`);
    db.exec(`INSERT INTO website_files (id,project_id,page_id,file_path,content_type,size_bytes,created_at,updated_at) VALUES ('f1','p1',NULL,'a.html','text/html',1,1,1),('f2','p1',NULL,'b.css','text/css',2,1,1)`);
    db.exec(`INSERT INTO website_file_versions (id,file_id,content,version_number,created_at) VALUES ('v1','f1','<html/>',1,1),('v2','f2','body{}',1,1),('v3','f1','<html>v2</html>',2,2)`);

    runMigrations(db);

    const rows = db.prepare('SELECT * FROM website_file_versions ORDER BY id').all() as Record<string, unknown>[];
    expect(rows).toHaveLength(3);
    const v1 = rows.find((r) => r['id'] === 'v1');
    const v2 = rows.find((r) => r['id'] === 'v2');
    const v3 = rows.find((r) => r['id'] === 'v3');
    expect(v1?.['file_path']).toBe('a.html');
    expect(v2?.['file_path']).toBe('b.css');
    expect(v3?.['file_path']).toBe('a.html');
    expect(v3?.['version']).toBe(2);
  });

  it('creates idx_website_file_versions_project after upgrade', () => {
    const db = makeOldSchemaDb();
    runMigrations(db);
    const indexes = (
      db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='website_file_versions'`).all() as { name: string }[]
    ).map((r) => r.name);
    expect(indexes).toContain('idx_website_file_versions_project');
  });
});

describe('runMigrations — idempotency', () => {
  it('running twice on fresh DB does not throw', () => {
    const db = makeFreshDb();
    expect(() => {
      runMigrations(db);
      runMigrations(db);
    }).not.toThrow();
  });

  it('running twice on already-migrated old DB does not throw', () => {
    const db = makeOldSchemaDb();
    expect(() => {
      runMigrations(db);
      runMigrations(db);
    }).not.toThrow();
  });

  it('schema stays correct after second runMigrations on fresh DB', () => {
    const db = makeFreshDb();
    runMigrations(db);
    runMigrations(db);
    expect(colNames(db, 'website_files')).toContain('path');
    expect(colNames(db, 'website_files')).not.toContain('file_path');
    expect(colNames(db, 'website_file_versions')).toContain('project_id');
    expect(colNames(db, 'website_file_versions')).not.toContain('file_id');
  });
});

describe('constraints and FK integrity', () => {
  it('rejects website_files insert with nonexistent project_id', () => {
    const db = makeFreshDb();
    runMigrations(db);
    expect(() =>
      db.exec(
        `INSERT INTO website_files (id,project_id,page_id,path,content,size_bytes,version,created_at) VALUES ('f1','ghost_project',NULL,'a.html','',0,1,1)`,
      ),
    ).toThrow();
  });

  it('rejects website_files insert with nonexistent page_id', () => {
    const db = makeFreshDb();
    runMigrations(db);
    db.exec(
      `INSERT INTO website_projects (id,user_id,name,status,brief_json,output_format,created_at,updated_at) VALUES ('p1','u1','N','draft','{}','html',1,1)`,
    );
    expect(() =>
      db.exec(
        `INSERT INTO website_files (id,project_id,page_id,path,content,size_bytes,version,created_at) VALUES ('f1','p1','ghost_page','a.html','',0,1,1)`,
      ),
    ).toThrow();
  });

  it('sets website_files.page_id to NULL when page deleted (ON DELETE SET NULL)', () => {
    const db = makeFreshDb();
    runMigrations(db);
    db.exec(
      `INSERT INTO website_projects (id,user_id,name,status,brief_json,output_format,created_at,updated_at) VALUES ('p1','u1','N','draft','{}','html',1,1)`,
    );
    db.exec(
      `INSERT INTO website_pages (id,project_id,slug,title,status) VALUES ('pg1','p1','home','Home','pending')`,
    );
    db.exec(
      `INSERT INTO website_files (id,project_id,page_id,path,content,size_bytes,version,created_at) VALUES ('f1','p1','pg1','index.html','',0,1,1)`,
    );
    db.exec(`DELETE FROM website_pages WHERE id = 'pg1'`);
    const row = db.prepare('SELECT page_id FROM website_files WHERE id = ?').get('f1') as Record<string, unknown>;
    expect(row['page_id']).toBeNull();
  });

  it('rejects duplicate UNIQUE(project_id, path) in website_files', () => {
    const db = makeFreshDb();
    runMigrations(db);
    db.exec(
      `INSERT INTO website_projects (id,user_id,name,status,brief_json,output_format,created_at,updated_at) VALUES ('p1','u1','N','draft','{}','html',1,1)`,
    );
    db.exec(
      `INSERT INTO website_files (id,project_id,page_id,path,content,size_bytes,version,created_at) VALUES ('f1','p1',NULL,'index.html','',0,1,1)`,
    );
    expect(() =>
      db.exec(
        `INSERT INTO website_files (id,project_id,page_id,path,content,size_bytes,version,created_at) VALUES ('f2','p1',NULL,'index.html','',0,1,1)`,
      ),
    ).toThrow();
  });
});

describe('cascade and orphan behavior', () => {
  it('cascades delete to website_files when project deleted', () => {
    const db = makeFreshDb();
    runMigrations(db);
    db.exec(
      `INSERT INTO website_projects (id,user_id,name,status,brief_json,output_format,created_at,updated_at) VALUES ('p1','u1','N','draft','{}','html',1,1)`,
    );
    db.exec(
      `INSERT INTO website_files (id,project_id,page_id,path,content,size_bytes,version,created_at) VALUES ('f1','p1',NULL,'a.html','',0,1,1)`,
    );
    db.exec(`DELETE FROM website_projects WHERE id = 'p1'`);
    const row = db.prepare('SELECT * FROM website_files WHERE id = ?').get('f1');
    expect(row).toBeUndefined();
  });

  it('does NOT cascade to website_file_versions when website_files row deleted (no FK — PRD denormalized design)', () => {
    const db = makeFreshDb();
    runMigrations(db);
    db.exec(
      `INSERT INTO website_projects (id,user_id,name,status,brief_json,output_format,created_at,updated_at) VALUES ('p1','u1','N','draft','{}','html',1,1)`,
    );
    db.exec(
      `INSERT INTO website_files (id,project_id,page_id,path,content,size_bytes,version,created_at) VALUES ('f1','p1',NULL,'a.html','',0,1,1)`,
    );
    db.exec(
      `INSERT INTO website_file_versions (id,project_id,file_path,version,content,created_at) VALUES ('v1','p1','a.html',1,'<html/>',1)`,
    );
    db.exec(`DELETE FROM website_files WHERE id = 'f1'`);
    // version row orphaned — no FK link to website_files; M2 app code must clean up explicitly
    const vRow = db.prepare('SELECT * FROM website_file_versions WHERE id = ?').get('v1');
    expect(vRow).toBeDefined();
  });
});

describe('CRUD after migration from M1 schema', () => {
  it('can INSERT and SELECT website_files with new schema after upgrade', () => {
    const db = makeOldSchemaDb();
    runMigrations(db);
    db.exec(
      `INSERT INTO website_projects (id,user_id,name,status,brief_json,output_format,created_at,updated_at) VALUES ('p1','u1','S','draft','{}','html',1,1)`,
    );
    db.exec(
      `INSERT INTO website_files (id,project_id,page_id,path,content,size_bytes,version,created_at) VALUES ('newf','p1',NULL,'new.html','<html>',42,1,999)`,
    );
    const row = db.prepare('SELECT * FROM website_files WHERE id = ?').get('newf') as Record<string, unknown>;
    expect(row['path']).toBe('new.html');
    expect(row['content']).toBe('<html>');
    expect(row['size_bytes']).toBe(42);
  });

  it('can INSERT and SELECT website_file_versions with new schema after upgrade', () => {
    const db = makeOldSchemaDb();
    runMigrations(db);
    db.exec(
      `INSERT INTO website_file_versions (id,project_id,file_path,version,content,created_at) VALUES ('nv1','p1','main.css',1,'body{}',999)`,
    );
    const row = db.prepare('SELECT * FROM website_file_versions WHERE id = ?').get('nv1') as Record<string, unknown>;
    expect(row['project_id']).toBe('p1');
    expect(row['file_path']).toBe('main.css');
    expect(row['version']).toBe(1);
  });

  it('stores multiple versions for same (project_id, file_path)', () => {
    const db = makeFreshDb();
    runMigrations(db);
    db.exec(
      `INSERT INTO website_file_versions (id,project_id,file_path,version,content,created_at) VALUES ('v1','p1','a.html',1,'v1',1)`,
    );
    db.exec(
      `INSERT INTO website_file_versions (id,project_id,file_path,version,content,created_at) VALUES ('v2','p1','a.html',2,'v2',2)`,
    );
    const rows = db
      .prepare('SELECT version FROM website_file_versions WHERE project_id=? AND file_path=? ORDER BY version')
      .all('p1', 'a.html') as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.['version']).toBe(1);
    expect(rows[1]?.['version']).toBe(2);
  });
});

describe('failure scenarios — partial migration state', () => {
  it('recovers when website_files_m1 orphan exists but website_files absent (crash after RENAME, before CREATE)', () => {
    // Simulates crash between ALTER TABLE RENAME and CREATE TABLE in migrateWebsiteFiles.
    // createTables creates fresh website_files (IF NOT EXISTS); migration then skips (no old file_path col).
    // website_files_m1 remains as orphan — known limitation; manual cleanup required in this edge case.
    const db = makeFreshDb();
    db.exec(`
      CREATE TABLE website_projects (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft', brief_json TEXT NOT NULL,
        analyzed_json TEXT, spec_json TEXT, design_json TEXT,
        output_format TEXT NOT NULL DEFAULT 'html', github_repo_url TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE website_pages (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES website_projects(id) ON DELETE CASCADE,
        slug TEXT NOT NULL, title TEXT NOT NULL, meta_description TEXT,
        status TEXT NOT NULL DEFAULT 'pending', error_message TEXT, generated_at INTEGER,
        UNIQUE (project_id, slug)
      );
      CREATE TABLE website_files_m1 (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, page_id TEXT,
        file_path TEXT NOT NULL, content_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
    `);
    expect(() => runMigrations(db)).not.toThrow();
    expect(colNames(db, 'website_files')).toContain('path');
    expect(colNames(db, 'website_files')).not.toContain('file_path');
    const orphan = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='website_files_m1'`)
      .get() as { name: string } | undefined;
    expect(orphan).toBeDefined();
  });
});
