import { MemoryItem, MemoryQuery, MemorySearchResult, MemoryType, MemoryStoreOptions, MemoryUpdateOptions } from '../types';
import { IMemoryEngine } from '../interfaces';
import { BaseMemoryModule } from './BaseMemoryModule';

export interface ITaskMemory {
  getTaskContext(taskId: string): Promise<MemoryItem | null>;
  createTaskContext(data: {
    taskId: string;
    objective: string;
    projectId?: string;
    assignee?: string;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  updateTaskContext(taskId: string, updates: Record<string, unknown>): Promise<MemoryItem>;
  getTaskHistory(taskId: string): Promise<MemoryItem[]>;
  getProjectTasks(projectId: string): Promise<MemoryItem[]>;
  getUserTasks(userId: string): Promise<MemoryItem[]>;
  getAgentTasks(agentId: string): Promise<MemoryItem[]>;
  linkTaskToDecision(taskId: string, decisionId: string): Promise<void>;
  linkTaskToDocument(taskId: string, documentId: string): Promise<void>;
}

export class TaskMemoryModule extends BaseMemoryModule implements ITaskMemory {
  readonly type: MemoryType = 'task';

  constructor(engine: IMemoryEngine) {
    super(engine);
  }

  async initialize(): Promise<void> {}

  async shutdown(): Promise<void> {}

  async health(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: Record<string, unknown> }> {
    return { status: 'healthy' };
  }

  async getTaskContext(taskId: string): Promise<MemoryItem | null> {
    return this.retrieve(taskId);
  }

  async createTaskContext(data: {
    taskId: string;
    objective: string;
    projectId?: string;
    assignee?: string;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem> {
    const item: MemoryItem = {
      id: `task_${data.taskId}`,
      type: 'task',
      owner: data.assignee || 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
      source: 'task_creation',
      entities: [],
      relationships: [],
      tags: ['task', data.projectId || 'standalone'],
      importance: 0.7,
      visibility: data.projectId ? 'project' : 'private',
      security: 'internal',
      summary: data.objective,
      rawContent: JSON.stringify(data, null, 2),
      metadata: { ...data.metadata, taskContext: true, projectId: data.projectId, assignee: data.assignee, status: 'pending' },
    };

    return this.store(item);
  }

  async updateTaskContext(taskId: string, updates: Record<string, unknown>): Promise<MemoryItem> {
    return this.update(taskId, { metadata: updates, updatedAt: new Date().toISOString() });
  }

  async getTaskHistory(taskId: string): Promise<MemoryItem[]> {
    const task = await this.retrieve(taskId);
    if (!task) return [];

    const relatedIds = task.relationships
      .filter(r => r.type === 'task_history' || r.type === 'subtask' || r.type === 'parent_task')
      .map(r => r.targetEntityId);

    const history: MemoryItem[] = [];
    for (const id of relatedIds) {
      const item = await this.retrieve(id);
      if (item && item.type === 'task') {
        history.push(item);
      }
    }

    return history;
  }

  async getProjectTasks(projectId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['task'],
      tags: [projectId],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async getUserTasks(userId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['task'],
      owner: userId,
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async getAgentTasks(agentId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['task'],
      owner: agentId,
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async linkTaskToDecision(taskId: string, decisionId: string): Promise<void> {
    await this.engine.relate(taskId, decisionId, 'influenced_by_decision');
  }

  async linkTaskToDocument(taskId: string, documentId: string): Promise<void> {
    await this.engine.relate(taskId, documentId, 'references_document');
  }
}