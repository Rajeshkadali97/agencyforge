import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CognitiveMemoryBridge } from '../bindings/memory/CognitiveMemoryBridge';
import { ConsoleLogger } from '../utils/ConsoleLogger';
import { Configuration } from '../config';

function makeLogger() {
  const config = new Configuration({ logging: { level: 'ERROR' } });
  return new ConsoleLogger(config);
}

function makeMockEngine() {
  return {
    store: vi.fn().mockResolvedValue({ id: 'mem_abc', type: 'business', rawContent: 'x', metadata: {} }),
    retrieve: vi.fn().mockResolvedValue(null),
    search: vi.fn().mockResolvedValue([]),
    summarize: vi.fn().mockResolvedValue('summary'),
    delete: vi.fn().mockResolvedValue(true),
    health: vi.fn().mockResolvedValue({ status: 'healthy' }),
  };
}

function injectEngine(bridge: CognitiveMemoryBridge, engine: ReturnType<typeof makeMockEngine>) {
  // Access private field to inject a mock engine without hitting ESM import
  (bridge as unknown as { instance: unknown }).instance = engine;
}

describe('CognitiveMemoryBridge — construction', () => {
  it('creates without throwing', () => {
    expect(() => new CognitiveMemoryBridge(makeLogger())).not.toThrow();
  });

  it('isAvailable() is false before initialize()', () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    expect(bridge.isAvailable()).toBe(false);
  });

  it('getEngine() returns null before initialize()', () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    expect(bridge.getEngine()).toBeNull();
  });
});

describe('CognitiveMemoryBridge — initialize (no engine available)', () => {
  beforeEach(() => {
    vi.doMock('@agencyforge/memory-engine', () => {
      throw new Error('memory-engine unavailable (simulated)');
    });
  });
  afterEach(() => {
    vi.doUnmock('@agencyforge/memory-engine');
  });

  it('initialize() resolves even when @agencyforge/memory-engine is unavailable', async () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    await expect(bridge.initialize()).resolves.toBeUndefined();
  });

  it('isAvailable() is false after initialize() with no engine', async () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    await bridge.initialize();
    expect(bridge.isAvailable()).toBe(false);
  });

  it('getEngine() returns null after initialize() with no engine', async () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    await bridge.initialize();
    expect(bridge.getEngine()).toBeNull();
  });

  it('initialize() is idempotent — second call resolves immediately', async () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    await bridge.initialize();
    await expect(bridge.initialize()).resolves.toBeUndefined();
  });
});

describe('CognitiveMemoryBridge — with injected engine', () => {
  it('isAvailable() true after engine injected', () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    injectEngine(bridge, makeMockEngine());
    expect(bridge.isAvailable()).toBe(true);
  });

  it('getEngine() returns injected engine', () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    const eng = makeMockEngine();
    injectEngine(bridge, eng);
    expect(bridge.getEngine()).toBe(eng);
  });

  it('engine.store() round-trip delegates correctly', async () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    const eng = makeMockEngine();
    injectEngine(bridge, eng);
    const engine = bridge.getEngine()!;
    const result = await engine.store({
      type: 'business', owner: 'test', rawContent: 'ACME Corp, $10M ARR',
      summary: 'ACME summary', tags: ['company'], importance: 0.8,
      visibility: 'private', security: 'internal', source: 'test',
      confidence: 0.9, entities: [], relationships: [], metadata: {},
    });
    expect(result.id).toBe('mem_abc');
    expect(eng.store).toHaveBeenCalledOnce();
  });

  it('engine.retrieve() returns null when item not found', async () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    injectEngine(bridge, makeMockEngine());
    const engine = bridge.getEngine()!;
    expect(await engine.retrieve('mem_missing')).toBeNull();
  });

  it('engine.retrieve() returns stored item', async () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    const eng = makeMockEngine();
    const mockItem = { id: 'mem_1', type: 'business', rawContent: 'data', metadata: {} };
    eng.retrieve.mockResolvedValue(mockItem);
    injectEngine(bridge, eng);
    const result = await bridge.getEngine()!.retrieve('mem_1');
    expect(result).toEqual(mockItem);
  });

  it('engine.search() returns results from engine', async () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    const eng = makeMockEngine();
    const mockResults = [{ item: { id: 'mem_1', type: 'business', rawContent: 'hit', metadata: {} }, score: 0.95 }];
    eng.search.mockResolvedValue(mockResults);
    injectEngine(bridge, eng);
    const results = await bridge.getEngine()!.search({ query: 'ACME', types: ['business'] });
    expect(results).toHaveLength(1);
    expect(eng.search).toHaveBeenCalledWith({ query: 'ACME', types: ['business'] });
  });

  it('engine.search() returns empty array when no results', async () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    injectEngine(bridge, makeMockEngine());
    const results = await bridge.getEngine()!.search({ query: 'nothing matches' });
    expect(results).toEqual([]);
  });

  it('engine.delete() delegates with permanent=false', async () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    const eng = makeMockEngine();
    injectEngine(bridge, eng);
    const result = await bridge.getEngine()!.delete('mem_1');
    expect(result).toBe(true);
  });

  it('engine.delete() delegates with permanent=true', async () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    const eng = makeMockEngine();
    injectEngine(bridge, eng);
    await bridge.getEngine()!.delete('mem_1', true);
    expect(eng.delete).toHaveBeenCalledWith('mem_1', true);
  });

  it('engine.health() returns healthy status', async () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    injectEngine(bridge, makeMockEngine());
    const h = await bridge.getEngine()!.health();
    expect(h.status).toBe('healthy');
  });

  it('engine.summarize() delegates ids', async () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    const eng = makeMockEngine();
    injectEngine(bridge, eng);
    const result = await bridge.getEngine()!.summarize(['mem_1', 'mem_2']);
    expect(result).toBe('summary');
    expect(eng.summarize).toHaveBeenCalledWith(['mem_1', 'mem_2']);
  });
});

describe('CognitiveMemoryBridge — null-safety patterns', () => {
  beforeEach(() => {
    vi.doMock('@agencyforge/memory-engine', () => {
      throw new Error('memory-engine unavailable (simulated)');
    });
  });
  afterEach(() => {
    vi.doUnmock('@agencyforge/memory-engine');
  });

  it('getEngine()?.store() does not throw when engine null', async () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    await bridge.initialize();
    const result = await bridge.getEngine()?.store({
      type: 'business', owner: 'test', rawContent: 'test',
      summary: '', tags: [], importance: 0.5, visibility: 'private',
      security: 'internal', source: 'test', confidence: 0.9,
      entities: [], relationships: [], metadata: {},
    });
    expect(result).toBeUndefined();
  });

  it('getEngine()?.search() returns undefined when engine null', async () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    await bridge.initialize();
    const result = await bridge.getEngine()?.search({ query: 'test' });
    expect(result).toBeUndefined();
  });
});

describe('CognitiveMemoryBridge — real engine', () => {
  it('loads the real @agencyforge/memory-engine package', async () => {
    const bridge = new CognitiveMemoryBridge(makeLogger());
    await bridge.initialize();
    expect(bridge.isAvailable()).toBe(true);
    expect(bridge.getEngine()).not.toBeNull();
  });
});
