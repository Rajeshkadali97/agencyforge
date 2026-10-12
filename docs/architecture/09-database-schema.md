# 09 — Database Schema

## Two SQLite databases

AgencyForge uses two independent SQLite databases. Both are optional — the runtime starts fully without either.

| Database | Activation | Class | Purpose |
|---|---|---|---|
| **Persistence DB** | `AGENCYFORGE_DB_PATH` env set | `PersistenceService` | Raw event log + context snapshots |
| **State DB** | `runtime_state.db` (hardcoded default) | `SQLiteRuntimeStateStore` | Structured domain state (projects, tasks, agents) |

Both use `better-sqlite3`. WAL mode + foreign keys enabled at open.

---

## Database 1: Persistence DB (PersistenceService)

File: `runtime/src/persistence/PersistenceService.ts`

Opened at construction time. Invalid path or non-writable directory causes `createRuntime()` to throw.

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
```

### runtime_events

Append-only event log. Every bootstrap-bus event is written here (wildcard `*` subscriber, priority -10).

```sql
CREATE TABLE IF NOT EXISTS runtime_events (
  id               TEXT PRIMARY KEY,  -- evt_<uuid>
  timestamp        TEXT NOT NULL,     -- ISO 8601
  event_type       TEXT NOT NULL,     -- e.g. 'task.completed'
  payload_json     TEXT NOT NULL,     -- full event payload as JSON
  source_subsystem TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runtime_events_timestamp ON runtime_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_runtime_events_type      ON runtime_events(event_type);
```

### shared_context_snapshots

Periodic full `SharedContextManager` state snapshots. Used for crash recovery — replay events from last snapshot forward.

```sql
CREATE TABLE IF NOT EXISTS shared_context_snapshots (
  id           TEXT PRIMARY KEY,   -- uuid
  timestamp    TEXT NOT NULL,      -- ISO 8601
  context_json TEXT NOT NULL       -- full SharedContextState as JSON
);
CREATE INDEX IF NOT EXISTS idx_shared_context_snapshots_timestamp
  ON shared_context_snapshots(timestamp DESC);
```

Snapshot triggers: every 50 events (`SNAPSHOT_INTERVAL_EVENTS = 50`) or every 5 minutes (`SNAPSHOT_INTERVAL_MS = 300000`).

### workflow_runs

```sql
CREATE TABLE IF NOT EXISTS workflow_runs (
  id          TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  status      TEXT NOT NULL,   -- 'pending'|'running'|'completed'|'failed'|'cancelled'
  started_at  TEXT NOT NULL,
  finished_at TEXT,            -- NULL while running
  error_json  TEXT             -- NULL on success
);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status      ON workflow_runs(status);
```

### agent_memory

```sql
CREATE TABLE IF NOT EXISTS agent_memory (
  id           TEXT PRIMARY KEY,
  agent_id     TEXT NOT NULL,
  memory_type  TEXT NOT NULL,   -- 'episodic', 'semantic', 'working'
  content_json TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent_id   ON agent_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_created_at ON agent_memory(created_at);
```

---

## Database 2: State DB (SQLiteRuntimeStateStore)

File: `runtime/src/state/SQLiteRuntimeStateStore.ts`

Stores structured domain objects. No pragmas set at open beyond defaults. JSON blobs used for complex fields.

### projects
```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, name TEXT, status TEXT,
  createdAt TEXT, updatedAt TEXT, metadata TEXT  -- JSON
);
```

### tasks
```sql
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, workflowId TEXT, name TEXT, status TEXT,
  agentId TEXT, createdAt TEXT, updatedAt TEXT, completedAt TEXT,
  result TEXT,  -- JSON or plain string
  error TEXT
);
```

### workflows
```sql
CREATE TABLE IF NOT EXISTS workflows (
  workflowId TEXT PRIMARY KEY,
  data TEXT  -- full WorkflowExecution as JSON blob
);
```

### agents
```sql
CREATE TABLE IF NOT EXISTS agents (
  agentId TEXT PRIMARY KEY, metadata TEXT,  -- JSON
  status TEXT, health TEXT
);
```

### notifications
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, type TEXT, title TEXT, message TEXT,
  read INTEGER,  -- 0 or 1
  createdAt TEXT, agentId TEXT, workflowId TEXT
);
```

### voice_states
```sql
CREATE TABLE IF NOT EXISTS voice_states (
  sessionId TEXT PRIMARY KEY, status TEXT, agentId TEXT,
  lastCommand TEXT, lastResponse TEXT, createdAt TEXT, updatedAt TEXT
);
```

### character_states
```sql
CREATE TABLE IF NOT EXISTS character_states (
  characterId TEXT PRIMARY KEY, department TEXT, emotion TEXT, pose TEXT,
  isSpeaking INTEGER, isListening INTEGER,  -- 0 or 1
  lastUpdate TEXT
);
```

### research_jobs
```sql
CREATE TABLE IF NOT EXISTS research_jobs (
  jobId TEXT PRIMARY KEY, workflowId TEXT, status TEXT,
  request TEXT,     -- JSON
  result TEXT,      -- JSON
  error TEXT, createdAt TEXT, completedAt TEXT
);
```

### revenue_jobs
```sql
CREATE TABLE IF NOT EXISTS revenue_jobs (
  jobId TEXT PRIMARY KEY, workflowId TEXT, type TEXT, status TEXT,
  leadId TEXT, result TEXT  -- JSON; additional columns in source
);
```

---

## Design notes

**No cross-database foreign keys.** The two databases are logically related but have no FK constraints between them.

**JSON blobs.** Complex fields (`metadata`, `data`, `payload_json`) stored as JSON strings. No JSON column indexing — filter in application code.

**No migrations.** Schema uses `CREATE TABLE IF NOT EXISTS`. Adding columns requires manual `ALTER TABLE`.

**WAL mode** (Persistence DB only). Enables concurrent reads without blocking writers.

**Recommended size limit:** Less than 10 GB per database.
