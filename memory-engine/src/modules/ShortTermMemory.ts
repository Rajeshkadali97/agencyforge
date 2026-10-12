import { MemoryItem, MemoryQuery, MemorySearchResult, MemoryType, MemoryStoreOptions, MemoryUpdateOptions, MemoryArchiveOptions, MemoryMergeOptions } from '../types';
import { IMemoryEngine } from '../interfaces';
import { BaseMemoryModule } from './BaseMemoryModule';

export interface IShortTermMemory {
  getActiveContext(owner: string): Promise<MemoryItem[]>;
  setActiveContext(owner: string, items: MemoryItem[]): Promise<void>;
  clearContext(owner: string): Promise<void>;
  getContextWindow(owner: string, maxTokens: number): Promise<MemoryItem[]>;
}

export class ShortTermMemoryModule extends BaseMemoryModule implements IShortTermMemory {
  readonly type: MemoryType = 'short-term';
  private contextCache: Map<string, MemoryItem[]> = new Map();

  constructor(engine: IMemoryEngine) {
    super(engine);
  }

  async initialize(): Promise<void> {
    this.contextCache.clear();
  }

  async shutdown(): Promise<void> {
    this.contextCache.clear();
  }

  async health(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: Record<string, unknown> }> {
    return { status: 'healthy' };
  }

  async getActiveContext(owner: string): Promise<MemoryItem[]> {
    return this.contextCache.get(owner) || [];
  }

  async setActiveContext(owner: string, items: MemoryItem[]): Promise<void> {
    this.contextCache.set(owner, items);
  }

  async clearContext(owner: string): Promise<void> {
    this.contextCache.delete(owner);
  }

  async getContextWindow(owner: string, maxTokens: number): Promise<MemoryItem[]> {
    const context = await this.getActiveContext(owner);
    let totalTokens = 0;
    const window: MemoryItem[] = [];

    for (const item of context) {
      const itemTokens = this.estimateTokens(item.rawContent);
      if (totalTokens + itemTokens > maxTokens) {
        break;
      }
      window.push(item);
      totalTokens += itemTokens;
    }

    return window;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}