import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryEngine } from '../MemoryEngine';
import type { IMemoryProvider } from '../interfaces/IProvider';
import type { ProviderConfig, ProviderMetadata, ProviderCapabilities, MemoryType, MemoryItem } from '../types';

// ─── Mock Provider Factory ────────────────────────────────────────────────────

const BASE_CAPABILITIES: ProviderCapabilities = {
  vectorSearch: false, keywordSearch: true, graphSearch: false, hybridSearch: false,
  timelineSearch: false, entitySearch: false, semanticSearch: false, embeddings: false,
  knowledgeGraph: false, factExtraction: false, summarization: true, classification: false,
  relationships: true, transactions: false, replication: false, encryption: false, compression: false,
};

function makeProviderConfig(id: string, memoryTypes: MemoryType[]): ProviderConfig {
  return {
    id, type: 'memory', name: id, version: '1.0', enabled: true, priority: 10,
    capabilities: BASE_CAPABILITIES, memoryTypes,
  };
}

function makeProviderMetadata(id: string): ProviderMetadata {
  return {
    id, type: 'memory', name: id, version: '1.0', status: 'connected',
    stats: { operations: 0, errors: 0, avgLatencyMs: 0, bytesStored: 0, bytesRetrieved: 0 },
  };
}

function createMockProvider(id: string, memoryTypes: MemoryType[] = ['knowledge', 'business']): IMemoryProvider {
  const items = new Map<string, any>();
  return {
    metadata: makeProviderMetadata(id),
    config: makeProviderConfig(id, memoryTypes),
    initialize: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    health: vi.fn().mockResolvedValue({ status: 'healthy', latencyMs: 1, lastCheck: new Date().toISOString() }),
    store: vi.fn().mockImplementation(async (item: any) => { items.set(item.id, item); return item; }),
    retrieve: vi.fn().mockImplementation(async (id: string) => items.get(id) ?? null),
    update: vi.fn().mockImplementation(async (id: string, updates: any) => {
      const item = items.get(id);
      if (!item) throw new Error(`Item not found: ${id}`);
      const updated = { ...item, ...updates };
      items.set(id, updated);
      return updated;
    }),
    delete: vi.fn().mockImplementation(async (id: string) => { const had = items.has(id); items.delete(id); return had; }),
    archive: vi.fn().mockResolvedValue(undefined),
    merge: vi.fn().mockImplementation(async (src: string, tgt: string) => {
      const s = items.get(src), t = items.get(tgt);
      if (!s || !t) throw new Error('Items not found');
      const merged = { ...s, id: `merged_${src}_${tgt}`, rawContent: `${s.rawContent}\n${t.rawContent}` };
      items.set(merged.id, merged);
      return merged;
    }),
    search: vi.fn().mockResolvedValue([]),
    retrieveByQuery: vi.fn().mockResolvedValue([]),
    summarize: vi.fn().mockResolvedValue('Summary text'),
    relate: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue({
      totalItems: items.size, itemsByType: {}, totalEmbeddings: 0,
      totalEntities: 0, totalRelationships: 0, storageSizeBytes: 0,
    }),
    listTypes: vi.fn().mockReturnValue(memoryTypes),
    supportsType: vi.fn().mockImplementation((t: string) => memoryTypes.includes(t as MemoryType)),
    onEvent: vi.fn().mockReturnValue('sub_1'),
    offEvent: vi.fn().mockReturnValue(true),
  } as unknown as IMemoryProvider;
}

const nopBus = { publish: vi.fn(), subscribe: vi.fn().mockReturnValue('sub_1'), unsubscribe: vi.fn(), getEventHistory: vi.fn().mockReturnValue([]) };

const BASE_ITEM: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'> = {
  type: 'business',
  owner: 'test',
  rawContent: 'Test business content for unit testing',
  summary: '',
  importance: 0.5,
  confidence: 0.9,
  tags: [],
  visibility: 'private',
  security: 'internal',
  source: 'unit-test',
  entities: [],
  relationships: [],
  metadata: {},
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MemoryEngine — construction', () => {
  it('creates instance with generated id', () => {
    const e = new MemoryEngine(nopBus);
    expect(e.id).toMatch(/^engine_/);
  });

  it('accepts config id override', () => {
    const e = new MemoryEngine(nopBus, { id: 'custom_engine', enableSecurity: false });
    expect(e.id).toBe('custom_engine');
  });

  it('starts with no providers', () => {
    const e = new MemoryEngine(nopBus);
    expect(e.listProviders()).toHaveLength(0);
  });

  it('exposes event bus', () => {
    const e = new MemoryEngine(nopBus);
    expect(e.eventBus).toBe(nopBus);
  });
});

describe('MemoryEngine — provider registry', () => {
  let engine: MemoryEngine;
  beforeEach(() => { engine = new MemoryEngine(nopBus); });

  it('registerProvider adds provider', () => {
    engine.registerProvider(createMockProvider('p1'));
    expect(engine.listProviders()).toHaveLength(1);
  });

  it('multiple providers stack', () => {
    engine.registerProvider(createMockProvider('p1'));
    engine.registerProvider(createMockProvider('p2'));
    expect(engine.listProviders()).toHaveLength(2);
  });

  it('getProvider returns registered provider by id', () => {
    const p = createMockProvider('p1');
    engine.registerProvider(p);
    expect(engine.getProvider('p1')).toBe(p);
  });

  it('getProvider returns undefined for unknown id', () => {
    expect(engine.getProvider('nonexistent')).toBeUndefined();
  });

  it('unregisterProvider removes provider and returns true', () => {
    engine.registerProvider(createMockProvider('p1'));
    const removed = engine.unregisterProvider('p1');
    expect(removed).toBe(true);
    expect(engine.listProviders()).toHaveLength(0);
  });

  it('unregisterProvider returns false for unknown id', () => {
    expect(engine.unregisterProvider('nobody')).toBe(false);
  });

  it('getMemoryTypes returns empty array with no providers', () => {
    expect(engine.getMemoryTypes()).toHaveLength(0);
  });

  it('getMemoryTypes returns deduplicated types across providers', () => {
    engine.registerProvider(createMockProvider('p1', ['business', 'knowledge']));
    engine.registerProvider(createMockProvider('p2', ['knowledge', 'user']));
    const types = engine.getMemoryTypes();
    expect(types).toContain('business');
    expect(types).toContain('knowledge');
    expect(types).toContain('user');
    expect(new Set(types).size).toBe(types.length);
  });
});

describe('MemoryEngine — lifecycle', () => {
  let engine: MemoryEngine;
  beforeEach(() => { engine = new MemoryEngine(nopBus); });

  it('initialize() resolves with no providers', async () => {
    await expect(engine.initialize()).resolves.toBeUndefined();
  });

  it('initialize() is idempotent', async () => {
    await engine.initialize();
    await expect(engine.initialize()).resolves.toBeUndefined();
  });

  it('initialize() calls provider.initialize()', async () => {
    const p = createMockProvider('p1');
    engine.registerProvider(p);
    await engine.initialize();
    expect(p.initialize).toHaveBeenCalledOnce();
  });

  it('shutdown() resolves after initialize', async () => {
    await engine.initialize();
    await expect(engine.shutdown()).resolves.toBeUndefined();
  });

  it('shutdown() calls provider.shutdown()', async () => {
    const p = createMockProvider('p1');
    engine.registerProvider(p);
    await engine.initialize();
    await engine.shutdown();
    expect(p.shutdown).toHaveBeenCalledOnce();
  });

  it('shutdown() before initialize is a no-op', async () => {
    await expect(engine.shutdown()).resolves.toBeUndefined();
  });
});

describe('MemoryEngine — health', () => {
  it('returns healthy with no providers', async () => {
    const engine = new MemoryEngine(nopBus);
    const h = await engine.health();
    expect(h.status).toBe('healthy');
    expect(h.providers).toEqual({});
  });

  it('returns healthy when all providers are healthy', async () => {
    const engine = new MemoryEngine(nopBus);
    engine.registerProvider(createMockProvider('p1'));
    await engine.initialize();
    const h = await engine.health();
    expect(h.status).toBe('healthy');
    expect(h.providers['p1'].status).toBe('healthy');
  });

  it('includes lastCheck timestamp', async () => {
    const engine = new MemoryEngine(nopBus);
    const h = await engine.health();
    expect(h.lastCheck).toBeDefined();
    expect(new Date(h.lastCheck).getTime()).not.toBeNaN();
  });

  it('includes numeric latency metric', async () => {
    const engine = new MemoryEngine(nopBus);
    const h = await engine.health();
    expect(typeof h.metrics.latencyMs).toBe('number');
  });

  it('degraded when some providers unhealthy', async () => {
    const engine = new MemoryEngine(nopBus);
    const p1 = createMockProvider('p1');
    const p2 = createMockProvider('p2');
    (p2.health as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'unhealthy', latencyMs: 999, lastCheck: new Date().toISOString() });
    engine.registerProvider(p1);
    engine.registerProvider(p2);
    await engine.initialize();
    const h = await engine.health();
    expect(h.status).toBe('degraded');
  });

  it('unhealthy when all providers unhealthy', async () => {
    const engine = new MemoryEngine(nopBus);
    const p = createMockProvider('p1');
    (p.health as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'unhealthy', latencyMs: 999, lastCheck: new Date().toISOString() });
    engine.registerProvider(p);
    await engine.initialize();
    const h = await engine.health();
    expect(h.status).toBe('unhealthy');
  });
});

describe('MemoryEngine — getStats', () => {
  it('returns zero counts with no providers', async () => {
    const engine = new MemoryEngine(nopBus);
    const s = await engine.getStats();
    expect(s.totalItems).toBe(0);
    expect(s.totalEmbeddings).toBe(0);
    expect(s.totalEntities).toBe(0);
    expect(s.totalRelationships).toBe(0);
    expect(s.storageSizeBytes).toBe(0);
  });

  it('aggregates across providers', async () => {
    const engine = new MemoryEngine(nopBus);
    const p1 = createMockProvider('p1');
    const p2 = createMockProvider('p2');
    (p1.getStats as ReturnType<typeof vi.fn>).mockResolvedValue({ totalItems: 10, itemsByType: {}, totalEmbeddings: 5, totalEntities: 2, totalRelationships: 1, storageSizeBytes: 1024 });
    (p2.getStats as ReturnType<typeof vi.fn>).mockResolvedValue({ totalItems: 5, itemsByType: {}, totalEmbeddings: 3, totalEntities: 1, totalRelationships: 0, storageSizeBytes: 512 });
    engine.registerProvider(p1);
    engine.registerProvider(p2);
    const s = await engine.getStats();
    expect(s.totalItems).toBe(15);
    expect(s.totalEmbeddings).toBe(8);
    expect(s.storageSizeBytes).toBe(1536);
  });
});

describe('MemoryEngine — store', () => {
  it('throws when no provider handles the memory type', async () => {
    const engine = new MemoryEngine(nopBus);
    await engine.initialize();
    await expect(engine.store(BASE_ITEM)).rejects.toThrow('No provider available');
  });

  it('returns item with generated id', async () => {
    const engine = new MemoryEngine(nopBus);
    engine.registerProvider(createMockProvider('p1', ['business']));
    await engine.initialize();
    const result = await engine.store(BASE_ITEM);
    expect(result.id).toMatch(/^mem_/);
    expect(result.type).toBe('business');
  });

  it('assigns createdAt and updatedAt', async () => {
    const engine = new MemoryEngine(nopBus);
    engine.registerProvider(createMockProvider('p1', ['business']));
    await engine.initialize();
    const result = await engine.store(BASE_ITEM);
    expect(new Date(result.createdAt).getTime()).not.toBeNaN();
    expect(new Date(result.updatedAt).getTime()).not.toBeNaN();
  });

  it('delegates to provider.store()', async () => {
    const engine = new MemoryEngine(nopBus);
    const p = createMockProvider('p1', ['business']);
    engine.registerProvider(p);
    await engine.initialize();
    await engine.store(BASE_ITEM);
    expect(p.store).toHaveBeenCalledOnce();
  });

  it('auto-generates summary from rawContent when not provided', async () => {
    const engine = new MemoryEngine(nopBus);
    engine.registerProvider(createMockProvider('p1', ['business']));
    await engine.initialize();
    const result = await engine.store({ ...BASE_ITEM, rawContent: 'Important business data point' });
    expect(result.summary).toBeDefined();
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('uses provided summary over auto-generated', async () => {
    const engine = new MemoryEngine(nopBus);
    engine.registerProvider(createMockProvider('p1', ['business']));
    await engine.initialize();
    const result = await engine.store({ ...BASE_ITEM, summary: 'Custom summary' });
    expect(result.summary).toBe('Custom summary');
  });

  it('importance is a number between 0 and 1', async () => {
    const engine = new MemoryEngine(nopBus);
    engine.registerProvider(createMockProvider('p1', ['business']));
    await engine.initialize();
    const result = await engine.store(BASE_ITEM);
    expect(result.importance).toBeGreaterThanOrEqual(0);
    expect(result.importance).toBeLessThanOrEqual(1);
  });
});

describe('MemoryEngine — retrieve', () => {
  it('returns null when no providers', async () => {
    const engine = new MemoryEngine(nopBus);
    await engine.initialize();
    expect(await engine.retrieve('mem_x')).toBeNull();
  });

  it('delegates to first provider', async () => {
    const engine = new MemoryEngine(nopBus);
    const p = createMockProvider('p1');
    engine.registerProvider(p);
    await engine.initialize();
    await engine.retrieve('mem_test');
    expect(p.retrieve).toHaveBeenCalledWith('mem_test');
  });
});

describe('MemoryEngine — search', () => {
  it('returns empty array when no providers', async () => {
    const engine = new MemoryEngine(nopBus);
    await engine.initialize();
    expect(await engine.search({ query: 'anything' })).toEqual([]);
  });

  it('delegates to provider search', async () => {
    const engine = new MemoryEngine(nopBus);
    const p = createMockProvider('p1', ['knowledge']);
    const mockResults = [{ item: { id: 'mem_1', type: 'knowledge' } as any, score: 0.95, excerpt: 'hit' }];
    (p.search as ReturnType<typeof vi.fn>).mockResolvedValue(mockResults);
    engine.registerProvider(p);
    await engine.initialize();
    const results = await engine.search({ query: 'test query', types: ['knowledge'] });
    expect(results).toEqual(mockResults);
  });

  it('retrieveByQuery delegates to search', async () => {
    const engine = new MemoryEngine(nopBus);
    const p = createMockProvider('p1', ['knowledge']);
    engine.registerProvider(p);
    await engine.initialize();
    const spy = vi.spyOn(engine, 'search');
    await engine.retrieveByQuery({ query: 'q' });
    expect(spy).toHaveBeenCalled();
  });
});

describe('MemoryEngine — delete / forget', () => {
  it('delete() returns false with no providers', async () => {
    const engine = new MemoryEngine(nopBus);
    await engine.initialize();
    expect(await engine.delete('mem_x')).toBe(false);
  });

  it('delete() delegates with permanent=false by default', async () => {
    const engine = new MemoryEngine(nopBus);
    const p = createMockProvider('p1');
    const mockItem = { id: 'mem_1', type: 'business' as MemoryType, rawContent: 'test', owner: 'test',
      summary: 'test', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      visibility: 'internal' as const, security: 'standard' as const, source: 'test',
      entities: [], relationships: [], metadata: {}, importance: 0.5, confidence: 0.9, tags: [] };
    (p.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(mockItem);
    engine.registerProvider(p);
    await engine.initialize();
    await engine.delete('mem_1');
    expect(p.delete).toHaveBeenCalledWith('mem_1', false);
  });

  it('forget() permanently deletes', async () => {
    const engine = new MemoryEngine(nopBus);
    const p = createMockProvider('p1');
    const mockItem = { id: 'mem_1', type: 'business' as MemoryType, rawContent: 'test', owner: 'test',
      summary: 'test', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      visibility: 'internal' as const, security: 'standard' as const, source: 'test',
      entities: [], relationships: [], metadata: {}, importance: 0.5, confidence: 0.9, tags: [] };
    (p.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(mockItem);
    engine.registerProvider(p);
    await engine.initialize();
    await engine.forget('mem_1', 'cleanup');
    expect(p.delete).toHaveBeenCalledWith('mem_1', true);
  });
});

describe('MemoryEngine — memory module accessors', () => {
  it('exposes all 17 memory modules', () => {
    const engine = new MemoryEngine(nopBus);
    expect(engine.getShortTermMemory()).toBeDefined();
    expect(engine.getLongTermMemory()).toBeDefined();
    expect(engine.getSemanticMemory()).toBeDefined();
    expect(engine.getEpisodicMemory()).toBeDefined();
    expect(engine.getProceduralMemory()).toBeDefined();
    expect(engine.getWorkingMemory()).toBeDefined();
    expect(engine.getBusinessMemory()).toBeDefined();
    expect(engine.getUserMemory()).toBeDefined();
    expect(engine.getProjectMemory()).toBeDefined();
    expect(engine.getWorkflowMemory()).toBeDefined();
    expect(engine.getAgentMemory()).toBeDefined();
    expect(engine.getKnowledgeMemory()).toBeDefined();
    expect(engine.getConversationMemory()).toBeDefined();
    expect(engine.getDocumentMemory()).toBeDefined();
    expect(engine.getDecisionMemory()).toBeDefined();
    expect(engine.getTaskMemory()).toBeDefined();
    expect(engine.getRelationshipMemory()).toBeDefined();
  });
});
