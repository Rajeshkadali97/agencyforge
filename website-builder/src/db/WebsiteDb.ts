import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { runMigrations } from './migration';
import type {
  WebsiteProject,
  WebsiteProjectSummary,
  CreateProjectInput,
  ListProjectsInput,
  ListProjectsResult,
  UpdateProjectInput,
  BillingEventData,
  ProjectStatus,
  OutputFormat,
} from '../types';

interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  status: string;
  brief_json: string;
  analyzed_json: string | null;
  spec_json: string | null;
  design_json: string | null;
  output_format: string;
  github_repo_url: string | null;
  created_at: number;
  updated_at: number;
}

interface CountRow {
  c: number;
}

function rowToProject(row: ProjectRow): WebsiteProject {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    status: row.status as ProjectStatus,
    briefJson: row.brief_json,
    analyzedJson: row.analyzed_json,
    specJson: row.spec_json,
    designJson: row.design_json,
    outputFormat: row.output_format as OutputFormat,
    githubRepoUrl: row.github_repo_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToSummary(row: ProjectRow): WebsiteProjectSummary {
  return {
    id: row.id,
    name: row.name,
    status: row.status as ProjectStatus,
    outputFormat: row.output_format as OutputFormat,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

let _sharedDb: Database.Database | null = null;

export function getSharedDb(): Database.Database {
  if (_sharedDb) return _sharedDb;
  const path = process.env['AGENCYFORGE_DB_PATH'] ?? './data/agencyforge.db';
  _sharedDb = new Database(path);
  _sharedDb.pragma('journal_mode = WAL');
  _sharedDb.pragma('foreign_keys = ON');
  runMigrations(_sharedDb);
  return _sharedDb;
}

export class WebsiteDb {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  createProject(input: CreateProjectInput): WebsiteProject {
    const now = Date.now();
    const id = randomUUID();
    const briefJson = JSON.stringify(input.brief);
    const outputFormat = input.outputFormat ?? 'html';

    this.db
      .prepare(
        `INSERT INTO website_projects
           (id, user_id, name, status, brief_json, analyzed_json, spec_json,
            design_json, output_format, github_repo_url, created_at, updated_at)
         VALUES (?, ?, ?, 'building', ?, NULL, NULL, NULL, ?, NULL, ?, ?)`,
      )
      .run(id, input.userId, input.name, briefJson, outputFormat, now, now);

    const row = this.db
      .prepare('SELECT * FROM website_projects WHERE id = ?')
      .get(id) as ProjectRow;

    return rowToProject(row);
  }

  updateProjectStatus(id: string, status: ProjectStatus): void {
    const now = Date.now();
    this.db
      .prepare(
        'UPDATE website_projects SET status = ?, updated_at = ? WHERE id = ?',
      )
      .run(status, now, id);
  }

  updateProject(id: string, userId: string, input: UpdateProjectInput): boolean {
    const now = Date.now();
    const fields: string[] = ['updated_at = ?'];
    const values: (string | number)[] = [now];

    if (input.name !== undefined) {
      fields.push('name = ?');
      values.push(input.name);
    }
    if (input.status !== undefined) {
      fields.push('status = ?');
      values.push(input.status);
    }
    if (input.analyzedJson !== undefined) {
      fields.push('analyzed_json = ?');
      values.push(input.analyzedJson);
    }
    if (input.specJson !== undefined) {
      fields.push('spec_json = ?');
      values.push(input.specJson);
    }
    if (input.designJson !== undefined) {
      fields.push('design_json = ?');
      values.push(input.designJson);
    }
    if (input.githubRepoUrl !== undefined) {
      fields.push('github_repo_url = ?');
      values.push(input.githubRepoUrl);
    }

    values.push(id, userId);

    const result = this.db
      .prepare(
        `UPDATE website_projects SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      )
      .run(...values);

    return result.changes > 0;
  }

  getProject(id: string, userId: string): WebsiteProject | null {
    const row = this.db
      .prepare(
        'SELECT * FROM website_projects WHERE id = ? AND user_id = ?',
      )
      .get(id, userId) as ProjectRow | undefined;

    return row ? rowToProject(row) : null;
  }

  listProjects(input: ListProjectsInput): ListProjectsResult {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    let whereClause = 'user_id = ? AND status != ?';
    const params: (string | number)[] = [input.userId, 'archived'];

    if (input.status !== undefined) {
      whereClause = 'user_id = ? AND status = ?';
      params[1] = input.status;
    }

    const totalRow = this.db
      .prepare(`SELECT COUNT(*) as c FROM website_projects WHERE ${whereClause}`)
      .get(...params) as CountRow;

    const rows = this.db
      .prepare(
        `SELECT * FROM website_projects WHERE ${whereClause}
         ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as ProjectRow[];

    return {
      projects: rows.map(rowToSummary),
      total: totalRow.c,
    };
  }

  archiveProject(id: string, userId: string): boolean {
    const now = Date.now();
    const result = this.db
      .prepare(
        `UPDATE website_projects SET status = 'archived', updated_at = ?
         WHERE id = ? AND user_id = ? AND status != 'archived'`,
      )
      .run(now, id, userId);

    return result.changes > 0;
  }

  countActiveBuilds(userId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as c FROM website_projects
         WHERE user_id = ? AND status = 'building'`,
      )
      .get(userId) as CountRow;

    return row.c;
  }

  countUserProjects(userId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as c FROM website_projects
         WHERE user_id = ? AND status != 'archived'`,
      )
      .get(userId) as CountRow;

    return row.c;
  }

  runTransaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  createBillingEvent(data: BillingEventData): void {
    const id = randomUUID();
    const now = Date.now();

    this.db
      .prepare(
        `INSERT INTO website_billing_events
           (id, project_id, user_id, event_type, quantity, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        data.projectId,
        data.userId,
        data.eventType,
        data.quantity,
        data.metadataJson ?? null,
        now,
      );
  }
}

export function getWebsiteDb(): WebsiteDb {
  return new WebsiteDb(getSharedDb());
}
