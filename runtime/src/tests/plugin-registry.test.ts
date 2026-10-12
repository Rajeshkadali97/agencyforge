import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginRegistry, getPluginRegistry } from '../plugins/PluginRegistry';
import type { PluginManifest, PluginInstance, PluginConfig } from '../plugins/types';

function makeInstance(id: string, caps: string[], configured = true): PluginInstance {
  return {
    pluginId: id,
    capabilities: caps,
    isConfigured: vi.fn().mockReturnValue(configured),
    invoke: vi.fn().mockResolvedValue({ result: 'ok' }),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
}

function makeManifest(id: string, caps: string[], available = true): PluginManifest {
  const inst = makeInstance(id, caps);
  return {
    id,
    name: `Plugin ${id}`,
    version: '1.0.0',
    description: `Test plugin ${id}`,
    category: 'tool',
    capabilities: caps.map(c => ({ id: c, description: c })),
    create: vi.fn().mockReturnValue(inst),
    isAvailable: vi.fn().mockReturnValue(available),
  };
}

describe('PluginRegistry — registration', () => {
  let registry: PluginRegistry;
  beforeEach(() => { registry = new PluginRegistry(); });

  it('listManifests() empty on fresh registry', () => {
    expect(registry.listManifests()).toHaveLength(0);
  });

  it('register() adds manifest', () => {
    registry.register(makeManifest('m1', ['cap.a']));
    expect(registry.listManifests()).toHaveLength(1);
  });

  it('getManifest() returns registered manifest', () => {
    const m = makeManifest('m1', ['cap.a']);
    registry.register(m);
    expect(registry.getManifest('m1')).toBe(m);
  });

  it('getManifest() returns undefined for unknown id', () => {
    expect(registry.getManifest('nonexistent')).toBeUndefined();
  });

  it('multiple manifests stack independently', () => {
    registry.register(makeManifest('m1', ['cap.a']));
    registry.register(makeManifest('m2', ['cap.b']));
    expect(registry.listManifests()).toHaveLength(2);
  });
});

describe('PluginRegistry — activation', () => {
  let registry: PluginRegistry;
  beforeEach(() => { registry = new PluginRegistry(); });

  it('activate() creates and stores instance', () => {
    registry.register(makeManifest('m1', ['cap.a']));
    const inst = registry.activate('m1', {});
    expect(inst).toBeDefined();
    expect(inst.pluginId).toBe('m1');
  });

  it('activate() throws for unregistered plugin', () => {
    expect(() => registry.activate('missing', {})).toThrow('Plugin not registered: missing');
  });

  it('get() returns activated instance', () => {
    registry.register(makeManifest('m1', ['cap.a']));
    const inst = registry.activate('m1', {});
    expect(registry.get('m1')).toBe(inst);
  });

  it('get() returns undefined before activation', () => {
    registry.register(makeManifest('m1', ['cap.a']));
    expect(registry.get('m1')).toBeUndefined();
  });

  it('listInstances() returns all activated plugins', () => {
    registry.register(makeManifest('m1', ['cap.a']));
    registry.register(makeManifest('m2', ['cap.b']));
    registry.activate('m1', {});
    registry.activate('m2', {});
    expect(registry.listInstances()).toHaveLength(2);
  });

  it('activate() passes config to manifest.create()', () => {
    const m = makeManifest('m1', ['cap.a']);
    registry.register(m);
    const cfg: PluginConfig = { apiKey: 'test-key' };
    registry.activate('m1', cfg);
    expect(m.create).toHaveBeenCalledWith(cfg);
  });
});

describe('PluginRegistry — capability lookup', () => {
  let registry: PluginRegistry;
  beforeEach(() => { registry = new PluginRegistry(); });

  it('getByCapability() returns empty when no instances', () => {
    expect(registry.getByCapability('cap.a')).toHaveLength(0);
  });

  it('getByCapability() returns configured plugins with matching capability', () => {
    registry.register(makeManifest('m1', ['cap.a', 'cap.b']));
    registry.activate('m1', {});
    const hits = registry.getByCapability('cap.a');
    expect(hits).toHaveLength(1);
    expect(hits[0].pluginId).toBe('m1');
  });

  it('getByCapability() excludes non-configured plugins', () => {
    const m = makeManifest('m1', ['cap.a']);
    const inst = makeInstance('m1', ['cap.a'], false);
    (m.create as ReturnType<typeof vi.fn>).mockReturnValue(inst);
    registry.register(m);
    registry.activate('m1', {});
    expect(registry.getByCapability('cap.a')).toHaveLength(0);
  });

  it('getByCapability() excludes plugins with different capabilities', () => {
    registry.register(makeManifest('m1', ['cap.b']));
    registry.activate('m1', {});
    expect(registry.getByCapability('cap.a')).toHaveLength(0);
  });

  it('getByCapability() returns multiple matching plugins', () => {
    registry.register(makeManifest('m1', ['web.scrape']));
    registry.register(makeManifest('m2', ['web.scrape']));
    registry.activate('m1', {});
    registry.activate('m2', {});
    expect(registry.getByCapability('web.scrape')).toHaveLength(2);
  });
});

describe('PluginRegistry — invocation', () => {
  let registry: PluginRegistry;
  beforeEach(() => { registry = new PluginRegistry(); });

  it('instance.invoke() delegates to plugin implementation', async () => {
    registry.register(makeManifest('m1', ['web.scrape']));
    const inst = registry.activate('m1', {});
    const result = await inst.invoke('web.scrape', { url: 'https://example.com' });
    expect(result).toEqual({ result: 'ok' });
    expect(inst.invoke).toHaveBeenCalledWith('web.scrape', { url: 'https://example.com' });
  });

  it('invoke via getByCapability() chain', async () => {
    registry.register(makeManifest('m1', ['web.scrape']));
    registry.activate('m1', {});
    const [plugin] = registry.getByCapability('web.scrape');
    const result = await plugin.invoke('web.scrape', { url: 'test' });
    expect(result).toEqual({ result: 'ok' });
  });
});

describe('PluginRegistry — deactivation', () => {
  let registry: PluginRegistry;
  beforeEach(() => { registry = new PluginRegistry(); });

  it('deactivate() removes instance', async () => {
    registry.register(makeManifest('m1', ['cap.a']));
    registry.activate('m1', {});
    expect(registry.get('m1')).toBeDefined();
    await registry.deactivate('m1');
    expect(registry.get('m1')).toBeUndefined();
  });

  it('deactivate() calls dispose on instance', async () => {
    registry.register(makeManifest('m1', ['cap.a']));
    const inst = registry.activate('m1', {});
    await registry.deactivate('m1');
    expect(inst.dispose).toHaveBeenCalledOnce();
  });

  it('deactivate() is no-op for unknown id', async () => {
    await expect(registry.deactivate('nonexistent')).resolves.toBeUndefined();
  });

  it('disposeAll() deactivates all instances', async () => {
    registry.register(makeManifest('m1', ['cap.a']));
    registry.register(makeManifest('m2', ['cap.b']));
    const i1 = registry.activate('m1', {});
    const i2 = registry.activate('m2', {});
    await registry.disposeAll();
    expect(registry.listInstances()).toHaveLength(0);
    expect(i1.dispose).toHaveBeenCalledOnce();
    expect(i2.dispose).toHaveBeenCalledOnce();
  });
});

describe('PluginRegistry — getPluginRegistry singleton', () => {
  it('returns same instance on repeated calls', () => {
    const a = getPluginRegistry();
    const b = getPluginRegistry();
    expect(a).toBe(b);
  });
});
