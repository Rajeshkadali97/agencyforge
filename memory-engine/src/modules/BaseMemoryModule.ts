import { MemoryItem, MemoryQuery, MemorySearchResult, MemoryType, MemoryStoreOptions, MemoryUpdateOptions } from '../types';
import { IMemoryEngine } from '../interfaces';
import { IMemoryModule } from '../interfaces/IMemoryEngine';

export abstract class BaseMemoryModule implements IMemoryModule {
  readonly type: MemoryType;
  readonly engine: IMemoryEngine;

  protected constructor(engine: IMemoryEngine) {
    this.engine = engine;
  }

  abstract initialize(): Promise<void>;
  abstract shutdown(): Promise<void>;
  abstract health(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: Record<string, unknown> }>;

  async store(item: MemoryItem, options?: MemoryStoreOptions): Promise<MemoryItem> {
    const typedItem = { ...item, type: this.type };
    return this.engine.store(typedItem, options);
  }

  async retrieve(id: string): Promise<MemoryItem | null> {
    const item = await this.engine.retrieve(id);
    if (item && item.type === this.type) {
      return item;
    }
    return null;
  }

  async update(id: string, updates: Partial<MemoryItem>, options?: MemoryUpdateOptions): Promise<MemoryItem> {
    return this.engine.update(id, { ...updates, type: this.type }, options);
  }

  async delete(id: string, permanent?: boolean): Promise<boolean> {
    const item = await this.engine.retrieve(id);
    if (item && item.type === this.type) {
      return this.engine.delete(id, permanent);
    }
    return false;
  }

  async search(query: MemoryQuery): Promise<MemorySearchResult[]> {
    const typedQuery = { ...query, types: [this.type, ...(query.types || [])] };
    return this.engine.search(typedQuery);
  }

  protected getProviderForType(): string | undefined {
    // Return the best provider for this memory type
    const providers = this.engine.listProviders();
    return providers.find(p => p.config.memoryTypes.includes(this.type))?.metadata.id;
  }
}