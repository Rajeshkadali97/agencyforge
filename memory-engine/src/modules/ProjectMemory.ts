import { MemoryItem, MemoryQuery, MemorySearchResult, MemoryType, MemoryStoreOptions, MemoryUpdateOptions } from '../types';
import { IMemoryEngine } from '../interfaces';
import { BaseMemoryModule } from './BaseMemoryModule';

export interface IProjectMemory {
  getProjectContext(projectId: string): Promise<MemoryItem | null>;
  createProjectContext(data: {
    name: string;
    description?: string;
    owner: string;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  updateProjectContext(projectId: string, updates: Record<string, unknown>): Promise<MemoryItem>;
  getProjectTimeline(projectId: string): Promise<MemoryItem[]>;
  getProjectFiles(projectId: string): Promise<MemoryItem[]>;
  getProjectDecisions(projectId: string): Promise<MemoryItem[]>;
  getProjectTasks(projectId: string): Promise<MemoryItem[]>;
  getProjectDeliverables(projectId: string): Promise<MemoryItem[]>;
  getProjectDependencies(projectId: string): Promise<MemoryItem[]>;
  getProjectConversations(projectId: string): Promise<MemoryItem[]>;
  linkProjectToBusiness(projectId: string, businessId: string): Promise<void>;
  linkProjectToUser(projectId: string, userId: string, role: string): Promise<void>;
  linkProjectToAgent(projectId: string, agentId: string): Promise<void>;
}

export class ProjectMemoryModule extends BaseMemoryModule implements IProjectMemory {
  readonly type: MemoryType = 'project';

  constructor(engine: IMemoryEngine) {
    super(engine);
  }

  async initialize(): Promise<void> {}

  async shutdown(): Promise<void> {}

  async health(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: Record<string, unknown> }> {
    return { status: 'healthy' };
  }

  async getProjectContext(projectId: string): Promise<MemoryItem | null> {
    return this.retrieve(projectId);
  }

  async createProjectContext(data: {
    name: string;
    description?: string;
    owner: string;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem> {
    const item: MemoryItem = {
      id: `project_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'project',
      owner: data.owner,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
      source: 'project_creation',
      entities: [],
      relationships: [],
      tags: ['project', data.name],
      importance: 0.9,
      visibility: 'project',
      security: 'internal',
      summary: `Project: ${data.name}`,
      rawContent: JSON.stringify(data, null, 2),
      metadata: { ...data.metadata, projectContext: true },
    };

    return this.store(item);
  }

  async updateProjectContext(projectId: string, updates: Record<string, unknown>): Promise<MemoryItem> {
    return this.update(projectId, { metadata: updates, updatedAt: new Date().toISOString() });
  }

  async getProjectTimeline(projectId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['episodic', 'conversation', 'decision', 'task'],
      tags: [projectId],
    };
    const results = await this.search(query);
    return results
      .map(r => r.item)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async getProjectFiles(projectId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['document'],
      tags: [projectId],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async getProjectDecisions(projectId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['decision'],
      tags: [projectId],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
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

  async getProjectDeliverables(projectId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['document', 'knowledge'],
      tags: ['deliverable', projectId],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async getProjectDependencies(projectId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['project', 'task'],
      tags: ['dependency', projectId],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async getProjectConversations(projectId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['conversation'],
      tags: [projectId],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async linkProjectToBusiness(projectId: string, businessId: string): Promise<void> {
    await this.engine.relate(projectId, businessId, 'belongs_to_business');
  }

  async linkProjectToUser(projectId: string, userId: string, role: string): Promise<void> {
    await this.engine.relate(projectId, userId, 'has_member', { role });
  }

  async linkProjectToAgent(projectId: string, agentId: string): Promise<void> {
    await this.engine.relate(projectId, agentId, 'assigned_agent');
  }
}