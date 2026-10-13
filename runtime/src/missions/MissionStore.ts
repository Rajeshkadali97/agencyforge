import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { Mission } from './types';

/** Persistence port for missions. The runtime works without one (memory only). */
export interface MissionStore {
  /** Most recent missions, newest first. */
  load(limit: number): Mission[];
  save(mission: Mission): void;
  close?(): void;
}

/**
 * SQLite-backed store. It opens its own connection to the runtime database file
 * (WAL mode allows several connections) and keeps each mission as one JSON row.
 */
export class SqliteMissionStore implements MissionStore {
  private readonly db: Database.Database;
  private readonly upsert: Database.Statement;
  private readonly recent: Database.Statement;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS missions (
        id         TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        payload    TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_missions_created ON missions (created_at DESC);
    `);
    this.upsert = this.db.prepare(
      `INSERT INTO missions (id, created_at, updated_at, payload) VALUES (@id, @created_at, @updated_at, @payload)
       ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, payload = excluded.payload`,
    );
    this.recent = this.db.prepare('SELECT payload FROM missions ORDER BY created_at DESC LIMIT ?');
  }

  load(limit: number): Mission[] {
    const rows = this.recent.all(Math.max(1, limit)) as Array<{ payload: string }>;
    const missions: Mission[] = [];
    for (const row of rows) {
      try {
        missions.push(JSON.parse(row.payload) as Mission);
      } catch {
        // Skip a corrupt row instead of failing startup.
      }
    }
    return missions;
  }

  save(mission: Mission): void {
    this.upsert.run({
      id: mission.id,
      created_at: mission.createdAt,
      updated_at: mission.updatedAt,
      payload: JSON.stringify(mission),
    });
  }

  close(): void {
    this.db.close();
  }
}
