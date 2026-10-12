import { MemoryItem, MemoryQuery, MemorySearchResult, MemoryType, MemoryStoreOptions, MemoryUpdateOptions } from '../types';
import { IMemoryEngine } from '../interfaces';
import { BaseMemoryModule } from './BaseMemoryModule';

export interface IWorkflowMemory {
  getWorkflowContext(workflowId: string): Promise<MemoryItem | null>;
  createWorkflowContext(data: {
    workflowId: string;
    name: string;
    definition: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  updateWorkflowContext(workflowId: string, updates: Record<string, unknown>): Promise<MemoryItem>;
  getWorkflowExecutions(workflowId: string): Promise<MemoryItem[]>;
  getWorkflowSteps(workflowId: string): Promise<MemoryItem[]>;
  getWorkflowDecisions(workflowId: string): Promise<MemoryItem[]>;
  linkWorkflowToProject(workflowId: string, projectId: string): Promise<void>;
  linkWorkflowToAgent(workflowId: string, agentId: string): Promise<void>;
}

export class WorkflowMemoryModule extends BaseMemoryModule implements IWorkflowMemory {
  readonly type: MemoryType = 'workflow';

  constructor(engine: IMemoryEngine) {
    super(engine);
  }

  async initialize(): Promise<void> {}

  async shutdown(): Promise<void> {}

  async health(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: Record<string, unknown> }> {
    return { status: 'healthy' };
  }

  async getWorkflowContext(workflowId: string): Promise<MemoryItem | null> {
    return this.retrieve(workflowId);
  }

  async createWorkflowContext(data: {
    workflowId: string;
    name: string;
    definition: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem> {
    const item: MemoryItem = {
      id: `workflow_${data.workflowId}`,
      type: 'workflow',
      owner: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
      source: 'workflow_registration',
      entities: [],
      relationships: [],
      tags: ['workflow', data.name],
      importance: 0.8,
      visibility: 'project',
      security: 'internal',
      summary: `Workflow: ${data.name}`,
      rawContent: JSON.stringify(data, null, 2),
      metadata: { ...data.metadata, workflowContext: true },
    };

    return this.store(item);
  }

  async updateWorkflowContext(workflowId: string, updates: Record<string, unknown>): Promise<MemoryItem> {
    return this.update(workflowId, { metadata: updates, updatedAt: new Date().toISOString() });
  }

  async getWorkflowExecutions(workflowId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['episodic', 'task'],
      tags: ['execution', workflowId],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async getWorkflowSteps(workflowId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['task', 'procedural'],
      tags: ['step', workflowId],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async getWorkflowDecisions(workflowId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['decision'],
      tags: [workflowId],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async linkWorkflowToProject(workflowId: string, projectId: string): Promise<void> {
    await this.engine.relate(workflowId, projectId, 'belongs_to_project');
  }

  async linkWorkflowToAgent(workflowId: string, agentId: string): Promise<void> {
    await this.engine.relate(workflowId, agentId, 'executed_by');
  }
}