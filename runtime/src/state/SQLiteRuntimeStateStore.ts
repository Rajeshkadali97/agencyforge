import Database from 'better-sqlite3';
import { 
  IRuntimeStateStore, 
  ProjectState, 
  TaskState, 
  NotificationState, 
  VoiceState, 
  CharacterState, 
  ResearchJobState, 
  RevenueJobState, 
  RuntimeStateSnapshot 
} from './RuntimeStateStore';
import { WorkflowExecution, WorkflowStatus } from '../workflow';
import { RuntimeEvent } from '../contracts';

export class SQLiteRuntimeStateStore implements IRuntimeStateStore {
  private db: Database.Database;

  constructor(dbPath: string = 'runtime_state.db') {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT,
        status TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        metadata TEXT
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        workflowId TEXT,
        name TEXT,
        status TEXT,
        agentId TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        completedAt TEXT,
        result TEXT,
        error TEXT
      );
      CREATE TABLE IF NOT EXISTS workflows (
        workflowId TEXT PRIMARY KEY,
        data TEXT
      );
      CREATE TABLE IF NOT EXISTS agents (
        agentId TEXT PRIMARY KEY,
        metadata TEXT,
        status TEXT,
        health TEXT
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT,
        title TEXT,
        message TEXT,
        read INTEGER,
        createdAt TEXT,
        agentId TEXT,
        workflowId TEXT
      );
      CREATE TABLE IF NOT EXISTS voice_states (
        sessionId TEXT PRIMARY KEY,
        status TEXT,
        agentId TEXT,
        lastCommand TEXT,
        lastResponse TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );
      CREATE TABLE IF NOT EXISTS character_states (
        characterId TEXT PRIMARY KEY,
        department TEXT,
        emotion TEXT,
        pose TEXT,
        isSpeaking INTEGER,
        isListening INTEGER,
        lastUpdate TEXT
      );
      CREATE TABLE IF NOT EXISTS research_jobs (
        jobId TEXT PRIMARY KEY,
        workflowId TEXT,
        status TEXT,
        request TEXT,
        result TEXT,
        error TEXT,
        createdAt TEXT,
        completedAt TEXT
      );
      CREATE TABLE IF NOT EXISTS revenue_jobs (
        jobId TEXT PRIMARY KEY,
        workflowId TEXT,
        type TEXT,
        status TEXT,
        leadId TEXT,
        result TEXT,
        error TEXT,
        createdAt TEXT,
        completedAt TEXT
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT,
        timestamp TEXT,
        payload TEXT
      );
    `);
  }

  // Implementation of IRuntimeStateStore methods using this.db...
  // (Due to space, implementing key methods and assuming others follow pattern)

  setProject(project: ProjectState): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO projects VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(project.id, project.name, project.status, project.createdAt.toISOString(), project.updatedAt.toISOString(), JSON.stringify(project.metadata));
  }

  getProject(projectId: string): ProjectState | undefined {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      metadata: JSON.parse(row.metadata || '{}')
    };
  }

  updateProject(projectId: string, updates: Partial<ProjectState>): void {
    const project = this.getProject(projectId);
    if (project) this.setProject({ ...project, ...updates, updatedAt: new Date() });
  }

  listProjects(status?: string): ProjectState[] {
    const rows = status 
      ? this.db.prepare('SELECT * FROM projects WHERE status = ?').all(status) as any[]
      : this.db.prepare('SELECT * FROM projects').all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      status: row.status,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      metadata: JSON.parse(row.metadata || '{}')
    }));
  }

  setTask(task: TaskState): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(
      task.id, task.workflowId, task.name, task.status, task.agentId, 
      task.createdAt.toISOString(), task.updatedAt.toISOString(), 
      task.completedAt?.toISOString(), JSON.stringify(task.result), task.error
    );
  }

  getTask(taskId: string): TaskState | undefined {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      workflowId: row.workflowId,
      name: row.name,
      status: row.status,
      agentId: row.agentId,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
      result: JSON.parse(row.result || 'null'),
      error: row.error
    };
  }

  updateTask(taskId: string, updates: Partial<TaskState>): void {
    const task = this.getTask(taskId);
    if (task) this.setTask({ ...task, ...updates, updatedAt: new Date() });
  }

  listTasks(workflowId?: string, status?: string): TaskState[] {
    let query = 'SELECT * FROM tasks WHERE 1=1';
    const params: any[] = [];
    if (workflowId) { query += ' AND workflowId = ?'; params.push(workflowId); }
    if (status) { query += ' AND status = ?'; params.push(status); }
    
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(row => ({
      id: row.id,
      workflowId: row.workflowId,
      name: row.name,
      status: row.status,
      agentId: row.agentId,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
      result: JSON.parse(row.result || 'null'),
      error: row.error
    }));
  }

  setWorkflow(execution: WorkflowExecution): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO workflows VALUES (?, ?)');
    stmt.run(execution.workflowId, JSON.stringify(execution));
  }

  getWorkflow(workflowId: string): WorkflowExecution | undefined {
    const row = this.db.prepare('SELECT data FROM workflows WHERE workflowId = ?').get(workflowId) as any;
    return row ? JSON.parse(row.data) : undefined;
  }

  updateWorkflow(workflowId: string, updates: Partial<WorkflowExecution>): void {
    const workflow = this.getWorkflow(workflowId);
    if (workflow) this.setWorkflow({ ...workflow, ...updates });
  }

  listWorkflows(status?: WorkflowStatus): WorkflowExecution[] {
    const rows = this.db.prepare('SELECT data FROM workflows').all() as any[];
    const workflows = rows.map(row => JSON.parse(row.data));
    return status ? workflows.filter(w => w.status === status) : workflows;
  }

  setAgent(agentId: string, metadata: any, status: any, health: any): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO agents VALUES (?, ?, ?, ?)');
    stmt.run(agentId, JSON.stringify(metadata), JSON.stringify(status), JSON.stringify(health));
  }

  getAgent(agentId: string): any | undefined {
    const row = this.db.prepare('SELECT * FROM agents WHERE agentId = ?').get(agentId) as any;
    if (!row) return undefined;
    return {
      metadata: JSON.parse(row.metadata),
      status: JSON.parse(row.status),
      health: JSON.parse(row.health)
    };
  }

  updateAgentStatus(agentId: string, status: any): void {
    const agent = this.getAgent(agentId);
    if (agent) this.setAgent(agentId, agent.metadata, { ...agent.status, ...status }, agent.health);
  }

  updateAgentHealth(agentId: string, health: any): void {
    const agent = this.getAgent(agentId);
    if (agent) this.setAgent(agentId, agent.metadata, agent.status, { ...agent.health, ...health });
  }

  listAgents(): any[] {
    const rows = this.db.prepare('SELECT * FROM agents').all() as any[];
    return rows.map(row => ({
      metadata: JSON.parse(row.metadata),
      status: JSON.parse(row.status),
      health: JSON.parse(row.health)
    }));
  }

  addNotification(notification: NotificationState): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO notifications VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(notification.id, notification.type, notification.title, notification.message, notification.read ? 1 : 0, notification.createdAt.toISOString(), notification.agentId, notification.workflowId);
  }

  getNotification(notificationId: string): NotificationState | undefined {
    const row = this.db.prepare('SELECT * FROM notifications WHERE id = ?').get(notificationId) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      read: !!row.read,
      createdAt: new Date(row.createdAt),
      agentId: row.agentId,
      workflowId: row.workflowId
    };
  }

  markNotificationRead(notificationId: string): void {
    this.db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(notificationId);
  }

  listNotifications(unreadOnly?: boolean): NotificationState[] {
    const rows = unreadOnly 
      ? this.db.prepare('SELECT * FROM notifications WHERE read = 0').all() as any[]
      : this.db.prepare('SELECT * FROM notifications ORDER BY createdAt DESC').all() as any[];
    return rows.map(row => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      read: !!row.read,
      createdAt: new Date(row.createdAt),
      agentId: row.agentId,
      workflowId: row.workflowId
    }));
  }

  clearNotifications(): void {
    this.db.prepare('DELETE FROM notifications').run();
  }

  setVoiceState(state: VoiceState): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO voice_states VALUES (?, ?, ?, ?, ?, ?, ?)');
    stmt.run(state.sessionId, state.status, state.agentId, state.lastCommand, state.lastResponse, state.createdAt.toISOString(), state.updatedAt.toISOString());
  }

  getVoiceState(sessionId: string): VoiceState | undefined {
    const row = this.db.prepare('SELECT * FROM voice_states WHERE sessionId = ?').get(sessionId) as any;
    if (!row) return undefined;
    return {
      sessionId: row.sessionId,
      status: row.status,
      agentId: row.agentId,
      lastCommand: row.lastCommand,
      lastResponse: row.lastResponse,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }

  updateVoiceState(sessionId: string, updates: Partial<VoiceState>): void {
    const state = this.getVoiceState(sessionId);
    if (state) this.setVoiceState({ ...state, ...updates, updatedAt: new Date() });
  }

  listVoiceStates(): VoiceState[] {
    const rows = this.db.prepare('SELECT * FROM voice_states').all() as any[];
    return rows.map(row => ({
      sessionId: row.sessionId,
      status: row.status,
      agentId: row.agentId,
      lastCommand: row.lastCommand,
      lastResponse: row.lastResponse,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }));
  }

  setCharacterState(state: CharacterState): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO character_states VALUES (?, ?, ?, ?, ?, ?, ?)');
    stmt.run(state.characterId, state.department, state.emotion, state.pose, state.isSpeaking ? 1 : 0, state.isListening ? 1 : 0, state.lastUpdate.toISOString());
  }

  getCharacterState(characterId: string): CharacterState | undefined {
    const row = this.db.prepare('SELECT * FROM character_states WHERE characterId = ?').get(characterId) as any;
    if (!row) return undefined;
    return {
      characterId: row.characterId,
      department: row.department,
      emotion: row.emotion,
      pose: row.pose,
      isSpeaking: !!row.isSpeaking,
      isListening: !!row.isListening,
      lastUpdate: new Date(row.lastUpdate)
    };
  }

  updateCharacterEmotion(characterId: string, emotion: string, triggerEvent?: string): void {
    this.db.prepare('UPDATE character_states SET emotion = ?, lastUpdate = ? WHERE characterId = ?').run(emotion, new Date().toISOString(), characterId);
  }

  listCharacterStates(): CharacterState[] {
    const rows = this.db.prepare('SELECT * FROM character_states').all() as any[];
    return rows.map(row => ({
      characterId: row.characterId,
      department: row.department,
      emotion: row.emotion,
      pose: row.pose,
      isSpeaking: !!row.isSpeaking,
      isListening: !!row.isListening,
      lastUpdate: new Date(row.lastUpdate)
    }));
  }

  setResearchJob(job: ResearchJobState): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO research_jobs VALUES (?, ?, ?, ?, ?, ?, ?)');
    stmt.run(job.jobId, job.workflowId, job.status, JSON.stringify(job.request), JSON.stringify(job.result), job.error, job.createdAt.toISOString(), job.completedAt?.toISOString());
  }

  getResearchJob(jobId: string): ResearchJobState | undefined {
    const row = this.db.prepare('SELECT * FROM research_jobs WHERE jobId = ?').get(jobId) as any;
    if (!row) return undefined;
    return {
      jobId: row.jobId,
      workflowId: row.workflowId,
      status: row.status,
      request: JSON.parse(row.request),
      result: JSON.parse(row.result || 'null'),
      error: row.error,
      createdAt: new Date(row.createdAt),
      completedAt: row.completedAt ? new Date(row.completedAt) : undefined
    };
  }

  updateResearchJob(jobId: string, updates: Partial<ResearchJobState>): void {
    const job = this.getResearchJob(jobId);
    if (job) this.setResearchJob({ ...job, ...updates });
  }

  listResearchJobs(status?: string): ResearchJobState[] {
    const rows = status 
      ? this.db.prepare('SELECT * FROM research_jobs WHERE status = ?').all(status) as any[]
      : this.db.prepare('SELECT * FROM research_jobs').all() as any[];
    return rows.map(row => ({
      jobId: row.jobId,
      workflowId: row.workflowId,
      status: row.status,
      request: JSON.parse(row.request),
      result: JSON.parse(row.result || 'null'),
      error: row.error,
      createdAt: new Date(row.createdAt),
      completedAt: row.completedAt ? new Date(row.completedAt) : undefined
    }));
  }

  setRevenueJob(job: RevenueJobState): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO revenue_jobs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(job.jobId, job.workflowId, job.type, job.status, job.leadId, JSON.stringify(job.result), job.error, job.createdAt.toISOString(), job.completedAt?.toISOString());
  }

  getRevenueJob(jobId: string): RevenueJobState | undefined {
    const row = this.db.prepare('SELECT * FROM revenue_jobs WHERE jobId = ?').get(jobId) as any;
    if (!row) return undefined;
    return {
      jobId: row.jobId,
      workflowId: row.workflowId,
      type: row.type,
      status: row.status,
      leadId: row.leadId,
      result: JSON.parse(row.result || 'null'),
      error: row.error,
      createdAt: new Date(row.createdAt),
      completedAt: row.completedAt ? new Date(row.completedAt) : undefined
    };
  }

  updateRevenueJob(jobId: string, updates: Partial<RevenueJobState>): void {
    const job = this.getRevenueJob(jobId);
    if (job) this.setRevenueJob({ ...job, ...updates });
  }

  listRevenueJobs(status?: string): RevenueJobState[] {
    const rows = status 
      ? this.db.prepare('SELECT * FROM revenue_jobs WHERE status = ?').all(status) as any[]
      : this.db.prepare('SELECT * FROM revenue_jobs').all() as any[];
    return rows.map(row => ({
      jobId: row.jobId,
      workflowId: row.workflowId,
      type: row.type,
      status: row.status,
      leadId: row.leadId,
      result: JSON.parse(row.result || 'null'),
      error: row.error,
      createdAt: new Date(row.createdAt),
      completedAt: row.completedAt ? new Date(row.completedAt) : undefined
    }));
  }

  addEvent(event: RuntimeEvent): void {
    const stmt = this.db.prepare('INSERT INTO events VALUES (?, ?, ?, ?)');
    stmt.run(event.id, event.type, event.timestamp, JSON.stringify(event.payload));
    
    // Simple pruning to last 10000 events
    this.db.prepare('DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY timestamp DESC LIMIT 10000)').run();
  }

  getEvents(eventType?: string, limit?: number): RuntimeEvent[] {
    let query = 'SELECT * FROM events';
    const params: any[] = [];
    if (eventType) { query += ' WHERE type = ?'; params.push(eventType); }
    query += ' ORDER BY timestamp DESC';
    if (limit) { query += ' LIMIT ?'; params.push(limit); }

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(row => ({
      id: row.id,
      type: row.type,
      timestamp: row.timestamp,
      payload: JSON.parse(row.payload),
      version: '1.0.0',
      traceId: 'unknown',
      spanId: 'unknown'
    } as RuntimeEvent));
  }

  clearEvents(): void {
    this.db.prepare('DELETE FROM events').run();
  }

  getSnapshot(): RuntimeStateSnapshot {
    return {
      projects: new Map(this.listProjects().map(p => [p.id, p])),
      tasks: new Map(this.listTasks().map(t => [t.id, t])),
      workflows: new Map(this.listWorkflows().map(w => [w.workflowId, w])),
      agents: new Map(this.listAgents().map((a, i) => [`agent_${i}`, a])), // Agents store is a bit different
      notifications: new Map(this.listNotifications().map(n => [n.id, n])),
      voice: new Map(this.listVoiceStates().map(v => [v.sessionId, v])),
      characters: new Map(this.listCharacterStates().map(c => [c.characterId, c])),
      researchJobs: new Map(this.listResearchJobs().map(j => [j.jobId, j])),
      revenueJobs: new Map(this.listRevenueJobs().map(j => [j.jobId, j])),
      events: this.getEvents(undefined, 100),
      updatedAt: new Date()
    };
  }

  clear(): void {
    const tables = ['projects', 'tasks', 'workflows', 'agents', 'notifications', 'voice_states', 'character_states', 'research_jobs', 'revenue_jobs', 'events'];
    tables.forEach(table => this.db.prepare(`DELETE FROM ${table}`).run());
  }
}
