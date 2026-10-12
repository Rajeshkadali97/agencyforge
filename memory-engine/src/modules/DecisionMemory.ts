import { MemoryItem, MemoryQuery, MemorySearchResult, MemoryType, MemoryStoreOptions, MemoryUpdateOptions } from '../types';
import { IMemoryEngine } from '../interfaces';
import { BaseMemoryModule } from './BaseMemoryModule';

export interface IDecisionMemory {
  getDecision(decisionId: string): Promise<MemoryItem | null>;
  recordDecision(data: {
    title: string;
    description: string;
    rationale: string;
    alternatives: string[];
    projectId?: string;
    owner: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  getProjectDecisions(projectId: string): Promise<MemoryItem[]>;
  getUserDecisions(userId: string): Promise<MemoryItem[]>;
  getDecisionHistory(decisionId: string): Promise<MemoryItem[]>;
  linkDecisionToTask(decisionId: string, taskId: string): Promise<void>;
}

export class DecisionMemoryModule extends BaseMemoryModule implements IDecisionMemory {
  readonly type: MemoryType = 'decision';

  constructor(engine: IMemoryEngine) {
    super(engine);
  }

  async initialize(): Promise<void> {}

  async shutdown(): Promise<void> {}

  async health(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: Record<string, unknown> }> {
    return { status: 'healthy' };
  }

  async getDecision(decisionId: string): Promise<MemoryItem | null> {
    return this.retrieve(decisionId);
  }

  async recordDecision(data: {
    title: string;
    description: string;
    rationale: string;
    alternatives: string[];
    projectId?: string;
    owner: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem> {
    const item: MemoryItem = {
      id: `decision_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'decision',
      owner: data.owner,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
      source: 'decision_recorded',
      entities: [],
      relationships: [],
      tags: ['decision', data.projectId || 'standalone', ...(data.tags || [])],
      importance: 0.8,
      visibility: data.projectId ? 'project' : 'private',
      security: 'internal',
      summary: data.title,
      rawContent: JSON.stringify(data, null, 2),
      metadata: { ...data.metadata, decision: true, projectId: data.projectId, alternatives: data.alternatives, rationale: data.rationale },
    };

    return this.store(item);
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

  async getUserDecisions(userId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['decision'],
      owner: userId,
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async getDecisionHistory(decisionId: string): Promise<MemoryItem[]> {
    const decision = await this.retrieve(decisionId);
    if (!decision) return [];

    const relatedIds = decision.relationships
      .filter(r => r.type === 'decision_history' || r.type === 'related_decision')
      .map(r => r.targetEntityId);

    const history: MemoryItem[] = [];
    for (const id of relatedIds) {
      const item = await this.retrieve(id);
      if (item && item.type === 'decision') {
        history.push(item);
      }
    }

    return history;
  }

  async linkDecisionToTask(decisionId: string, taskId: string): Promise<void> {
    await this.engine.relate(decisionId, taskId, 'influences_task');
  }
}