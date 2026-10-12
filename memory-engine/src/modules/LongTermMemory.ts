import { MemoryItem, MemoryQuery, MemorySearchResult, MemoryType, MemoryStoreOptions, MemoryUpdateOptions } from '../types';
import { IMemoryEngine } from '../interfaces';
import { BaseMemoryModule } from './BaseMemoryModule';

export interface ILongTermMemory {
  consolidate(owner: string): Promise<number>;
  archiveOldItems(olderThanDays: number): Promise<string[]>;
  getImportantMemories(owner: string, limit: number): Promise<MemoryItem[]>;
}

export class LongTermMemoryModule extends BaseMemoryModule implements ILongTermMemory {
  readonly type: MemoryType = 'long-term';

  constructor(engine: IMemoryEngine) {
    super(engine);
  }

  async initialize(): Promise<void> {}

  async shutdown(): Promise<void> {}

  async health(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: Record<string, unknown> }> {
    return { status: 'healthy' };
  }

  async consolidate(owner: string): Promise<number> {
    // Consolidate short-term memories into long-term
    const shortTermMemories = await this.engine.getShortTermMemory().getActiveContext(owner);
    let consolidated = 0;

    for (const memory of shortTermMemories) {
      if (memory.importance > 0.5) {
        await this.store(memory);
        consolidated++;
      }
    }

    return consolidated;
  }

  async archiveOldItems(olderThanDays: number): Promise<string[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // This would query the provider for old items
    // For now, return empty array
    return [];
  }

  async getImportantMemories(owner: string, limit: number): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      owner,
      types: ['long-term'],
      minImportance: 0.7,
      limit,
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }
}