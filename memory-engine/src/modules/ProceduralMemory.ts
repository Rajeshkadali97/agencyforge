import { MemoryItem, MemoryQuery, MemorySearchResult, MemoryType, MemoryStoreOptions, MemoryUpdateOptions } from '../types';
import { IMemoryEngine } from '../interfaces';
import { BaseMemoryModule } from './BaseMemoryModule';

export interface IProceduralMemory {
  getProcedures(owner: string, domain?: string): Promise<MemoryItem[]>;
  getProcedure(procedureId: string): Promise<MemoryItem | null>;
  recordExecution(procedureId: string, success: boolean, durationMs: number, context: Record<string, unknown>): Promise<void>;
  getBestPractices(domain: string): Promise<MemoryItem[]>;
}

export class ProceduralMemoryModule extends BaseMemoryModule implements IProceduralMemory {
  readonly type: MemoryType = 'procedural';

  constructor(engine: IMemoryEngine) {
    super(engine);
  }

  async initialize(): Promise<void> {}

  async shutdown(): Promise<void> {}

  async health(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: Record<string, unknown> }> {
    return { status: 'healthy' };
  }

  async getProcedures(owner: string, domain?: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: domain || '',
      owner,
      types: ['procedural'],
      tags: domain ? [domain] : undefined,
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async getProcedure(procedureId: string): Promise<MemoryItem | null> {
    return this.retrieve(procedureId);
  }

  async recordExecution(procedureId: string, success: boolean, durationMs: number, context: Record<string, unknown>): Promise<void> {
    const procedure = await this.retrieve(procedureId);
    if (!procedure) return;

    const executionRecord = {
      timestamp: new Date().toISOString(),
      success,
      durationMs,
      context,
    };

    const updatedMetadata = {
      ...procedure.metadata,
      executions: [...(procedure.metadata.executions as unknown[] || []), executionRecord],
      lastExecuted: new Date().toISOString(),
      successRate: this.calculateSuccessRate(procedure),
    };

    await this.update(procedureId, { metadata: updatedMetadata });
  }

  async getBestPractices(domain: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: domain,
      types: ['procedural'],
      tags: [domain, 'best-practice'],
      minImportance: 0.8,
      limit: 10,
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  private calculateSuccessRate(procedure: MemoryItem): number {
    const executions = (procedure.metadata.executions as unknown[]) || [];
    if (executions.length === 0) return 0;
    const successful = executions.filter(e => (e as Record<string, unknown>).success === true).length;
    return successful / executions.length;
  }
}