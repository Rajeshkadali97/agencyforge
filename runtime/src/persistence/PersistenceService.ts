import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { ILogger } from '../interfaces';
import { RuntimeEvent, RuntimeEventPayload, BaseEventPayload } from '../contracts';

const DEFAULT_DB_PATH = './data/agencyforge.db';
const SNAPSHOT_INTERVAL_EVENTS = 50;
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;

export interface PersistenceConfig {
  dbPath?: string;
  snapshotIntervalEvents?: number;
  snapshotIntervalMs?: number;
}

export interface PersistedEvent {
  id: string;
  timestamp: string;
  eventType: string;
  payloadJson: string;
  sourceSubsystem: string;
}

export interface Snapshot {
  id: string;
  timestamp: string;
  contextJson: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  errorJson: string | null;
}

export interface AgentMemoryRecord {
  id: string;
  agentId: string;
  memoryType: string;
  contentJson: string;
  createdAt: string;
}

export interface EventReplayHandler {
  (event: RuntimeEvent): void | Promise<void>;
}

export class PersistenceService {
  private db: Database.Database;
  private logger: ILogger;
  private config: Required<PersistenceConfig>;
  private eventCountSinceSnapshot = 0;
  private lastSnapshotTime = Date.now();
  private snapshotTimer: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor(logger: ILogger, config: PersistenceConfig = {}) {
    this.logger = logger;
    this.config = {
      dbPath: config.dbPath ?? process.env.AGENCYFORGE_DB_PATH ?? DEFAULT_DB_PATH,
      snapshotIntervalEvents: config.snapshotIntervalEvents ?? SNAPSHOT_INTERVAL_EVENTS,
      snapshotIntervalMs: config.snapshotIntervalMs ?? SNAPSHOT_INTERVAL_MS,
    };
    this.db = this.initializeDatabase();
    this.setupSnapshotTimer();
  }

  private initializeDatabase(): Database.Database {
    const dbDir = require('path').dirname(this.config.dbPath);
    if (dbDir && dbDir !== '.') {
      require('fs').mkdirSync(dbDir, { recursive: true });
    }

    this.logger.info('PersistenceService: Opening database', { path: this.config.dbPath });
    const db = new Database(this.config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    this.createTables(db);
    this.logger.info('PersistenceService: Database initialized');
    return db;
  }

  private createTables(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS runtime_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        source_subsystem TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS shared_context_snapshots (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        context_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workflow_runs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        error_json TEXT
      );

      CREATE TABLE IF NOT EXISTS agent_memory (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        memory_type TEXT NOT NULL,
        content_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_runtime_events_timestamp ON runtime_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_runtime_events_type ON runtime_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_shared_context_snapshots_timestamp ON shared_context_snapshots(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
      CREATE INDEX IF NOT EXISTS idx_agent_memory_agent_id ON agent_memory(agent_id);
      CREATE INDEX IF NOT EXISTS idx_agent_memory_created_at ON agent_memory(created_at);
    `);
  }

  private setupSnapshotTimer(): void {
    this.snapshotTimer = setInterval(() => {
      this.checkSnapshotNeeded();
    }, this.config.snapshotIntervalMs);
  }

  private checkSnapshotNeeded(): void {
    const timeSinceSnapshot = Date.now() - this.lastSnapshotTime;
    if (timeSinceSnapshot >= this.config.snapshotIntervalMs) {
      this.logger.info('PersistenceService: Time-based snapshot triggered', { timeSinceSnapshot });
    }
  }

  persistEvent(
    eventType: string,
    payload: RuntimeEventPayload,
    sourceSubsystem: string,
    eventId?: string,
    traceId?: string,
    spanId?: string
  ): string {
    const id = eventId ?? `evt_${randomUUID()}`;
    const timestamp = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO runtime_events (id, timestamp, event_type, payload_json, source_subsystem)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      timestamp,
      eventType,
      JSON.stringify(payload),
      sourceSubsystem
    );

    this.eventCountSinceSnapshot++;

    if (this.eventCountSinceSnapshot >= this.config.snapshotIntervalEvents) {
      this.logger.info('PersistenceService: Event count snapshot triggered', {
        count: this.eventCountSinceSnapshot
      });
    }

    return id;
  }

  persistSnapshot(context: Record<string, unknown>): string {
    const id = `snap_${randomUUID()}`;
    const timestamp = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO shared_context_snapshots (id, timestamp, context_json)
      VALUES (?, ?, ?)
    `);

    stmt.run(id, timestamp, JSON.stringify(context));
    this.eventCountSinceSnapshot = 0;
    this.lastSnapshotTime = Date.now();

    this.logger.info('PersistenceService: Snapshot persisted', { id, timestamp });

    this.pruneOldEvents();

    return id;
  }

  private pruneOldEvents(): void {
    const latestSnapshot = this.getLatestSnapshot();
    if (!latestSnapshot) return;

    const cutoffTimestamp = latestSnapshot.timestamp;

    const deleteStmt = this.db.prepare(`
      DELETE FROM runtime_events
      WHERE timestamp <= ? AND event_type NOT IN (
        SELECT event_type FROM runtime_events WHERE timestamp > ?
        ORDER BY timestamp DESC LIMIT 1000
      )
    `);

    const result = deleteStmt.run(cutoffTimestamp, cutoffTimestamp);
    if (result.changes > 0) {
      this.logger.info('PersistenceService: Pruned old events', { count: result.changes });
    }
  }

  getLatestSnapshot(): Snapshot | null {
    const stmt = this.db.prepare(`
      SELECT id, timestamp, context_json
      FROM shared_context_snapshots
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    const row = stmt.get() as { id: string; timestamp: string; context_json: string } | undefined;
    if (!row) return null;

    return {
      id: row.id,
      timestamp: row.timestamp,
      contextJson: row.context_json,
    };
  }

  getEventsSince(timestamp: string): PersistedEvent[] {
    const stmt = this.db.prepare(`
      SELECT id, timestamp, event_type, payload_json, source_subsystem
      FROM runtime_events
      WHERE timestamp > ?
      ORDER BY timestamp ASC
    `);

    const rows = stmt.all(timestamp) as Array<{
      id: string;
      timestamp: string;
      event_type: string;
      payload_json: string;
      source_subsystem: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      eventType: row.event_type,
      payloadJson: row.payload_json,
      sourceSubsystem: row.source_subsystem,
    }));
  }

  replayEventsSinceLastSnapshot(handler: EventReplayHandler): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const latestSnapshot = this.getLatestSnapshot();
        const sinceTimestamp = latestSnapshot ? latestSnapshot.timestamp : '1970-01-01T00:00:00.000Z';

        this.logger.info('PersistenceService: Replaying events', { sinceTimestamp });

        const events = this.getEventsSince(sinceTimestamp);
        this.logger.info('PersistenceService: Found events to replay', { count: events.length });

        for (const persistedEvent of events) {
          try {
            const runtimeEvent: RuntimeEvent = {
              id: persistedEvent.id,
              type: persistedEvent.eventType,
              version: '1.0',
              timestamp: persistedEvent.timestamp,
              traceId: persistedEvent.id.split('_')[1] ?? persistedEvent.id,
              spanId: persistedEvent.id.split('_')[2] ?? persistedEvent.id,
              payload: JSON.parse(persistedEvent.payloadJson) as RuntimeEventPayload,
            };

            const result = handler(runtimeEvent);
            if (result instanceof Promise) {
              result.catch((err) => {
                this.logger.error('PersistenceService: Error replaying event', {
                  eventId: persistedEvent.id,
                  error: err instanceof Error ? err.message : String(err),
                });
              });
            }
          } catch (err) {
            this.logger.error('PersistenceService: Failed to parse event', {
              eventId: persistedEvent.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        this.logger.info('PersistenceService: Event replay complete', { eventsReplayed: events.length });
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  persistWorkflowRun(workflowId: string, status: string, error?: string): string {
    const id = `wfrun_${randomUUID()}`;
    const startedAt = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO workflow_runs (id, workflow_id, status, started_at, finished_at, error_json)
      VALUES (?, ?, ?, ?, NULL, ?)
    `);

    stmt.run(id, workflowId, status, startedAt, error ? JSON.stringify({ error }) : null);
    return id;
  }

  updateWorkflowRun(id: string, status: string, error?: string): void {
    const finishedAt = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE workflow_runs
      SET status = ?, finished_at = ?, error_json = ?
      WHERE id = ?
    `);

    stmt.run(status, finishedAt, error ? JSON.stringify({ error }) : null, id);
  }

  getWorkflowRuns(limit = 100): WorkflowRun[] {
    const stmt = this.db.prepare(`
      SELECT id, workflow_id, status, started_at, finished_at, error_json
      FROM workflow_runs
      ORDER BY started_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as Array<{
      id: string;
      workflow_id: string;
      status: string;
      started_at: string;
      finished_at: string | null;
      error_json: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      workflowId: row.workflow_id,
      status: row.status,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      errorJson: row.error_json,
    }));
  }

  persistAgentMemory(agentId: string, memoryType: string, content: Record<string, unknown>): string {
    const id = `mem_${randomUUID()}`;
    const createdAt = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO agent_memory (id, agent_id, memory_type, content_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, agentId, memoryType, JSON.stringify(content), createdAt);
    return id;
  }

  getAgentMemory(agentId: string, memoryType?: string): AgentMemoryRecord[] {
    let sql = `
      SELECT id, agent_id, memory_type, content_json, created_at
      FROM agent_memory
      WHERE agent_id = ?
    `;
    const params: string[] = [agentId];

    if (memoryType) {
      sql += ' AND memory_type = ?';
      params.push(memoryType);
    }

    sql += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as Array<{
      id: string;
      agent_id: string;
      memory_type: string;
      content_json: string;
      created_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      memoryType: row.memory_type,
      contentJson: row.content_json,
      createdAt: row.created_at,
    }));
  }

  getEventCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM runtime_events');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  getSnapshotCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM shared_context_snapshots');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  initialize(): void {
    this.initialized = true;
    this.logger.info('PersistenceService: Initialized');
  }

  async shutdown(): Promise<void> {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }

    const latestSnapshot = this.getLatestSnapshot();
    if (!latestSnapshot || this.eventCountSinceSnapshot > 0) {
      this.logger.info('PersistenceService: Creating final snapshot on shutdown');
    }

    this.db.close();
    this.logger.info('PersistenceService: Shutdown complete');
  }

  clearAllData(): void {
    this.db.exec(`
      DELETE FROM runtime_events;
      DELETE FROM shared_context_snapshots;
      DELETE FROM workflow_runs;
      DELETE FROM agent_memory;
    `);
    this.eventCountSinceSnapshot = 0;
    this.logger.info('PersistenceService: All data cleared');
  }

  saveMemorySnapshot(memoryJson: string): string {
    const id = `mem_snap_${randomUUID()}`;
    const timestamp = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO agent_memory (id, agent_id, memory_type, content_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, 'runtime', 'memory_snapshot', memoryJson, timestamp);
    this.logger.info('PersistenceService: Memory snapshot saved', { id, timestamp });
    return id;
  }

  loadLatestMemorySnapshot(): { id: string; timestamp: string; memoryJson: string } | null {
    const stmt = this.db.prepare(`
      SELECT id, created_at as timestamp, content_json as memoryJson
      FROM agent_memory
      WHERE agent_id = 'runtime' AND memory_type = 'memory_snapshot'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const row = stmt.get() as { id: string; timestamp: string; memoryJson: string } | undefined;
    if (!row) {
      this.logger.info('PersistenceService: No memory snapshot found');
      return null;
    }

    this.logger.info('PersistenceService: Memory snapshot loaded', { id: row.id, timestamp: row.timestamp });
    return row;
  }

  pruneMemorySnapshots(keepCount: number = 5): void {
    const stmt = this.db.prepare(`
      DELETE FROM agent_memory
      WHERE agent_id = 'runtime'
        AND memory_type = 'memory_snapshot'
        AND id NOT IN (
          SELECT id FROM agent_memory
          WHERE agent_id = 'runtime' AND memory_type = 'memory_snapshot'
          ORDER BY created_at DESC
          LIMIT ?
        )
    `);

    const result = stmt.run(keepCount);
    if (result.changes > 0) {
      this.logger.info('PersistenceService: Pruned memory snapshots', { deletedCount: result.changes });
    }
  }
}

export function createPersistenceService(logger: ILogger, config?: PersistenceConfig): PersistenceService {
  return new PersistenceService(logger, config);
}