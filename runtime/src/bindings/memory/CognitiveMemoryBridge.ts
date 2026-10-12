import { ILogger } from '../../interfaces';

// Local structural mirror of ICognitiveMemoryEngine (kernel).
// No cross-package import needed — TypeScript structural typing handles compatibility.
export interface ICognitiveMemoryEngine {
  store(item: {
    type: string;
    owner: string;
    rawContent: string;
    summary: string;
    tags: string[];
    importance: number;
    visibility: string;
    security: string;
    source: string;
    confidence: number;
    entities: unknown[];
    relationships: unknown[];
    metadata: Record<string, unknown>;
  }): Promise<{ id: string; type: string; rawContent: string; metadata: Record<string, unknown> }>;
  retrieve(id: string): Promise<{ id: string; type: string; rawContent: string; metadata: Record<string, unknown> } | null>;
  search(query: { query: string; types?: string[]; owner?: string; tags?: string[] }): Promise<Array<{ id: string; type: string; rawContent: string; metadata: Record<string, unknown>; similarity?: number }>>;
  summarize(ids: string[]): Promise<string>;
  delete(id: string, permanent?: boolean): Promise<boolean>;
  health(): Promise<{ status: string; details?: Record<string, unknown> }>;
}

/**
 * Minimal in-process event bus handed to the memory engine, which requires an
 * IEventBus (publish / subscribe / unsubscribe / getEventHistory) at construction.
 */
class LocalMemoryEventBus {
  private handlers = new Map<string, { type: string; handler: (event: unknown) => void | Promise<void> }>();
  private history: Array<{ type?: string }> = [];
  private nextId = 0;

  publish(event: { type?: string }): void {
    this.history.push(event);
    if (this.history.length > 1000) this.history.shift();
    for (const { type, handler } of this.handlers.values()) {
      if (type === event.type) void Promise.resolve(handler(event)).catch(() => undefined);
    }
  }

  subscribe(type: string, handler: (event: unknown) => void | Promise<void>): string {
    const id = `mem-sub-${++this.nextId}`;
    this.handlers.set(id, { type, handler });
    return id;
  }

  unsubscribe(id: string): boolean {
    return this.handlers.delete(id);
  }

  getEventHistory(type?: string, limit = 100): Array<{ type?: string }> {
    const items = type ? this.history.filter((e) => e.type === type) : this.history;
    return items.slice(-limit);
  }
}

// Adapts the real @agencyforge/memory-engine IMemoryEngine to ICognitiveMemoryEngine.
class MemoryEngineAdapter implements ICognitiveMemoryEngine {
  constructor(
    private real: {
      store(item: Record<string, unknown>): Promise<Record<string, unknown>>;
      retrieve(id: string): Promise<Record<string, unknown> | null>;
      search(query: Record<string, unknown>): Promise<Array<{ item: Record<string, unknown>; score: number }>>;
      summarize(ids: string[]): Promise<string>;
      delete(id: string, permanent?: boolean): Promise<boolean>;
      health(): Promise<{ status: string; details?: Record<string, unknown> }>;
    }
  ) {}

  async store(item: Parameters<ICognitiveMemoryEngine['store']>[0]): ReturnType<ICognitiveMemoryEngine['store']> {
    const result = await this.real.store(item as unknown as Record<string, unknown>);
    return result as unknown as ReturnType<ICognitiveMemoryEngine['store']>;
  }

  async retrieve(id: string): ReturnType<ICognitiveMemoryEngine['retrieve']> {
    const result = await this.real.retrieve(id);
    if (!result) return null;
    return {
      id: result['id'] as string,
      type: result['type'] as string,
      rawContent: result['rawContent'] as string,
      metadata: (result['metadata'] as Record<string, unknown>) ?? {},
    };
  }

  async search(query: Parameters<ICognitiveMemoryEngine['search']>[0]): ReturnType<ICognitiveMemoryEngine['search']> {
    const results = await this.real.search(query as unknown as Record<string, unknown>);
    return results.map((r) => {
      const item = r.item;
      return {
        id: item['id'] as string,
        type: item['type'] as string,
        rawContent: item['rawContent'] as string,
        metadata: (item['metadata'] as Record<string, unknown>) ?? {},
        similarity: r.score,
      };
    });
  }

  async summarize(ids: string[]): Promise<string> {
    return this.real.summarize(ids);
  }

  async delete(id: string, permanent?: boolean): Promise<boolean> {
    return this.real.delete(id, permanent);
  }

  async health(): Promise<{ status: string; details?: Record<string, unknown> }> {
    return this.real.health();
  }
}

export class CognitiveMemoryBridge {
  private instance: ICognitiveMemoryEngine | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private logger: ILogger) {}

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    try {
      // Dynamic import crosses ESM/CJS boundary — @agencyforge/memory-engine is a CommonJS package.
      // The 'as string' cast prevents TypeScript from resolving types for the ESM package,
      // avoiding module-type conflicts at compile time.
      const mod = await import('@agencyforge/memory-engine' as string) as {
        createMemoryEngine?: (eventBus: LocalMemoryEventBus, config?: Record<string, unknown>) => { initialize(): Promise<void>; [key: string]: unknown };
        MemoryEngine?: new (eventBus: LocalMemoryEventBus, config?: Record<string, unknown>) => { initialize(): Promise<void>; [key: string]: unknown };
      };

      let engine: { initialize(): Promise<void>; [key: string]: unknown } | null = null;

      if (typeof mod.createMemoryEngine === 'function') {
        engine = mod.createMemoryEngine(new LocalMemoryEventBus(), {});
      } else if (typeof mod.MemoryEngine === 'function') {
        engine = new mod.MemoryEngine(new LocalMemoryEventBus(), {});
      }

      if (!engine) {
        this.logger.warn('CognitiveMemoryBridge: @agencyforge/memory-engine has no createMemoryEngine or MemoryEngine export — bridge unavailable');
        return;
      }

      await engine.initialize();

      this.instance = new MemoryEngineAdapter(engine as unknown as {
        store(item: Record<string, unknown>): Promise<Record<string, unknown>>;
        retrieve(id: string): Promise<Record<string, unknown> | null>;
        search(query: Record<string, unknown>): Promise<Array<{ item: Record<string, unknown>; score: number }>>;
        summarize(ids: string[]): Promise<string>;
        delete(id: string, permanent?: boolean): Promise<boolean>;
        health(): Promise<{ status: string; details?: Record<string, unknown> }>;
      });
      this.logger.info('CognitiveMemoryBridge: Cognitive memory engine ready');
    } catch (err) {
      this.logger.warn('CognitiveMemoryBridge: Failed to load @agencyforge/memory-engine — cognitive memory unavailable', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  getEngine(): ICognitiveMemoryEngine | null {
    return this.instance;
  }

  isAvailable(): boolean {
    return this.instance !== null;
  }
}
