import { MemoryItem, MemoryQuery, MemorySearchResult, MemoryType, MemoryStoreOptions, MemoryUpdateOptions } from '../types';
import { IMemoryEngine } from '../interfaces';
import { BaseMemoryModule } from './BaseMemoryModule';

export interface IAgentMemory {
  getAgentContext(agentId: string): Promise<MemoryItem | null>;
  createAgentContext(data: {
    agentId: string;
    name: string;
    capabilities: string[];
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  updateAgentContext(agentId: string, updates: Record<string, unknown>): Promise<MemoryItem>;
  getAgentPastWork(agentId: string, limit?: number): Promise<MemoryItem[]>;
  getAgentPreferences(agentId: string): Promise<Record<string, unknown>>;
  setAgentPreference(agentId: string, key: string, value: unknown): Promise<void>;
  getAgentMistakes(agentId: string): Promise<MemoryItem[]>;
  getAgentSuccessfulWorkflows(agentId: string): Promise<MemoryItem[]>;
  getAgentCurrentGoals(agentId: string): Promise<MemoryItem[]>;
  linkAgentToProject(agentId: string, projectId: string): Promise<void>;
  linkAgentToWorkflow(agentId: string, workflowId: string): Promise<void>;
}

export class AgentMemoryModule extends BaseMemoryModule implements IAgentMemory {
  readonly type: MemoryType = 'agent';

  constructor(engine: IMemoryEngine) {
    super(engine);
  }

  async initialize(): Promise<void> {}

  async shutdown(): Promise<void> {}

  async health(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: Record<string, unknown> }> {
    return { status: 'healthy' };
  }

  async getAgentContext(agentId: string): Promise<MemoryItem | null> {
    return this.retrieve(agentId);
  }

  async createAgentContext(data: {
    agentId: string;
    name: string;
    capabilities: string[];
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem> {
    const item: MemoryItem = {
      id: `agent_${data.agentId}`,
      type: 'agent',
      owner: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
      source: 'agent_registration',
      entities: [],
      relationships: [],
      tags: ['agent', ...data.capabilities],
      importance: 0.8,
      visibility: 'organization',
      security: 'internal',
      summary: `Agent: ${data.name}`,
      rawContent: JSON.stringify(data, null, 2),
      metadata: { ...data.metadata, agent: true, preferences: {}, pastWork: [], mistakes: [], successfulWorkflows: [], currentGoals: [] },
    };

    return this.store(item);
  }

  async updateAgentContext(agentId: string, updates: Record<string, unknown>): Promise<MemoryItem> {
    return this.update(agentId, { metadata: updates, updatedAt: new Date().toISOString() });
  }

  async getAgentPastWork(agentId: string, limit: number = 50): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['episodic', 'task', 'workflow'],
      owner: agentId,
      limit,
    };
    const results = await this.search(query);
    return results
      .map(r => r.item)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getAgentPreferences(agentId: string): Promise<Record<string, unknown>> {
    const context = await this.getAgentContext(agentId);
    return (context?.metadata.preferences as Record<string, unknown>) || {};
  }

  async setAgentPreference(agentId: string, key: string, value: unknown): Promise<void> {
    const context = await this.getAgentContext(agentId);
    if (!context) throw new Error(`Agent not found: ${agentId}`);

    const preferences = { ...(context.metadata.preferences as Record<string, unknown>), [key]: value };
    await this.update(agentId, { metadata: { ...context.metadata, preferences } });
  }

  async getAgentMistakes(agentId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['episodic', 'decision'],
      owner: agentId,
      tags: ['mistake', 'error', 'failure'],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async getAgentSuccessfulWorkflows(agentId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['workflow', 'episodic'],
      owner: agentId,
      tags: ['success', 'completed'],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async getAgentCurrentGoals(agentId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['task'],
      owner: agentId,
      tags: ['active', 'current', 'goal'],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async linkAgentToProject(agentId: string, projectId: string): Promise<void> {
    await this.engine.relate(agentId, projectId, 'works_on');
  }

  async linkAgentToWorkflow(agentId: string, workflowId: string): Promise<void> {
    await this.engine.relate(agentId, workflowId, 'executes');
  }
}