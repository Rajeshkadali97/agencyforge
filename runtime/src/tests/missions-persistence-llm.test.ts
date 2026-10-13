import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MissionService } from '../missions/MissionService';
import { SqliteMissionStore } from '../missions/MissionStore';
import { parseLlmPlan } from '../missions/llmPlanner';
import type { FetchLike, Mission } from '../missions/types';

function okFetch(): FetchLike {
  return (async (url: string) => {
    const body = url.includes('wikipedia.org/api/rest_v1')
      ? { title: 'Coffee', extract: 'Coffee is a brewed drink prepared from roasted beans.', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Coffee' } } }
      : url.includes('geocoding-api')
        ? { results: [{ name: 'Lisbon', country: 'Portugal', country_code: 'PT', latitude: 38.7, longitude: -9.1 }] }
        : url.includes('api.open-meteo.com')
          ? { current: { temperature_2m: 20, wind_speed_10m: 8, relative_humidity_2m: 60 } }
          : url.includes('topstories')
            ? [1]
            : url.includes('item/1')
              ? { title: 'A story', score: 10, url: 'https://e.com' }
              : null;
    return body === null ? { ok: false, status: 404, json: async () => null } : { ok: true, status: 200, json: async () => body };
  }) as FetchLike;
}

describe('SqliteMissionStore', () => {
  const dirs: string[] = [];
  const newDb = () => {
    const dir = mkdtempSync(join(tmpdir(), 'af-missions-'));
    dirs.push(dir);
    return join(dir, 'nested', 'runtime.db');
  };
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  const mission = (id: string, createdAt: string, status: Mission['status'] = 'completed'): Mission => ({
    id,
    goal: `goal ${id}`,
    status,
    createdAt,
    updatedAt: createdAt,
    stages: [],
    tasks: [],
    suggestedApis: [],
  });

  it('creates missing directories and returns newest first', () => {
    const store = new SqliteMissionStore(newDb());
    store.save(mission('a', '2026-01-01T00:00:00.000Z'));
    store.save(mission('b', '2026-01-03T00:00:00.000Z'));
    store.save(mission('c', '2026-01-02T00:00:00.000Z'));
    expect(store.load(10).map((m) => m.id)).toEqual(['b', 'c', 'a']);
    expect(store.load(2).map((m) => m.id)).toEqual(['b', 'c']);
    store.close();
  });

  it('upserts instead of duplicating', () => {
    const store = new SqliteMissionStore(newDb());
    const m = mission('a', '2026-01-01T00:00:00.000Z', 'planning');
    store.save(m);
    store.save({ ...m, status: 'completed', updatedAt: '2026-01-01T00:00:05.000Z' });
    const rows = store.load(10);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('completed');
    store.close();
  });
});

describe('MissionService persistence', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const dbPath = () => {
    const dir = mkdtempSync(join(tmpdir(), 'af-persist-'));
    dirs.push(dir);
    return join(dir, 'runtime.db');
  };

  it('keeps finished missions across a restart', async () => {
    const path = dbPath();
    const first = new MissionService({ fetch: okFetch(), store: new SqliteMissionStore(path) });
    const created = first.create('Research coffee in Lisbon and check the weather', { useAi: false });
    await first.waitFor(created.id);
    first.close();

    const second = new MissionService({ fetch: okFetch(), store: new SqliteMissionStore(path) });
    const restored = second.get(created.id);
    expect(restored?.status).toBe('completed');
    expect(restored?.result?.sources.length).toBeGreaterThan(0);
    expect(second.list().map((m) => m.id)).toContain(created.id);
    second.close();
  });

  it('marks missions that were running at shutdown as interrupted', () => {
    const path = dbPath();
    const store = new SqliteMissionStore(path);
    store.save({
      id: 'msn_stuck',
      goal: 'stuck mission',
      status: 'executing',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      stages: [{ name: 'execute', label: 'Execute', status: 'running' }],
      tasks: [
        { id: 't1', title: 'x', agent: 'research', tool: 'wikipedia', args: {}, status: 'running' },
        { id: 't2', title: 'y', agent: 'content', tool: 'hackernews', args: {}, status: 'done' },
      ] as Mission['tasks'],
      suggestedApis: [],
    });
    store.close();

    const service = new MissionService({ fetch: okFetch(), store: new SqliteMissionStore(path) });
    const m = service.get('msn_stuck');
    service.close();
    expect(m?.status).toBe('failed');
    expect(m?.error).toMatch(/restart/i);
    expect(m?.stages[0]?.status).toBe('failed');
    expect(m?.tasks.find((t) => t.id === 't1')?.status).toBe('failed');
    expect(m?.tasks.find((t) => t.id === 't2')?.status).toBe('done');
  });

  it('does not break missions when the store throws', async () => {
    const store = { load: () => [], save: () => { throw new Error('disk full'); } };
    const service = new MissionService({ fetch: okFetch(), store });
    const m = service.create('Scan the latest AI agents trends', { useAi: false });
    expect((await service.waitFor(m.id)).status).toBe('completed');
  });

  it('does not break startup when the store cannot load', () => {
    const store = { load: () => { throw new Error('corrupt'); }, save: () => undefined };
    expect(() => new MissionService({ fetch: okFetch(), store })).not.toThrow();
  });
});

describe('parseLlmPlan', () => {
  const goal = 'Plan a coffee pop-up in Lisbon';

  it('accepts a valid plan, including fenced JSON', () => {
    const text = '```json\n{"topic":"coffee pop-up","tasks":[{"tool":"wikipedia","args":{"topic":"Coffee"}},{"tool":"weather","args":{"place":"Lisbon"}}]}\n```';
    const plan = parseLlmPlan(text, goal);
    expect(plan?.tasks.map((t) => t.tool)).toEqual(['wikipedia', 'weather']);
    expect(plan?.tasks[1]?.title).toBe('Check current weather in Lisbon');
    expect(plan?.places).toEqual(['Lisbon']);
    expect(plan?.topic).toBe('coffee pop-up');
  });

  it('drops unknown tools, missing or unsafe arguments', () => {
    const text = JSON.stringify({
      tasks: [
        { tool: 'shell', args: { cmd: 'rm -rf /' } },
        { tool: 'wikipedia', args: { topic: 'http://evil.example/x' } },
        { tool: 'weather', args: {} },
        { tool: 'country', args: { place: '<script>' } },
        { tool: 'wikipedia', args: { topic: 'Coffee' } },
      ],
    });
    const plan = parseLlmPlan(text, goal);
    expect(plan?.tasks).toHaveLength(1);
    expect(plan?.tasks[0]?.args).toEqual({ topic: 'Coffee' });
  });

  it('caps the task count and removes duplicates', () => {
    const tasks = Array.from({ length: 12 }, (_, i) => ({ tool: 'wikipedia', args: { topic: `Topic ${i % 3}` } }));
    const plan = parseLlmPlan(JSON.stringify({ tasks }), goal);
    expect(plan?.tasks.length).toBeLessThanOrEqual(3);
  });

  it('allows an empty hackernews keyword', () => {
    const plan = parseLlmPlan('{"tasks":[{"tool":"hackernews","args":{}}]}', goal);
    expect(plan?.tasks[0]?.tool).toBe('hackernews');
  });

  it('returns null for prose, empty or malformed answers', () => {
    expect(parseLlmPlan('Sure! Here is a plan.', goal)).toBeNull();
    expect(parseLlmPlan('{"tasks":[]}', goal)).toBeNull();
    expect(parseLlmPlan('{"tasks": [', goal)).toBeNull();
    expect(parseLlmPlan('{"tasks":[{"tool":"nope","args":{}}]}', goal)).toBeNull();
  });
});

describe('MissionService with an LLM planner', () => {
  it('uses a valid LLM plan, then writes the brief with the model', async () => {
    const ai = vi
      .fn()
      .mockResolvedValueOnce({ content: '{"topic":"coffee","tasks":[{"tool":"wikipedia","args":{"topic":"Coffee"}},{"tool":"weather","args":{"place":"Lisbon"}}]}', provider: 'test' })
      .mockResolvedValueOnce({ content: 'Coffee is popular and Lisbon is mild today, so a pop-up looks viable.', provider: 'test', model: 'tiny' });
    const service = new MissionService({ fetch: okFetch(), ai });
    const m = service.create('Plan a coffee pop-up in Lisbon');
    const done = await service.waitFor(m.id);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(done.plannedBy).toBe('llm');
    expect(done.tasks.map((t) => t.tool)).toEqual(['wikipedia', 'weather']);
    expect(done.result?.writtenBy).toBe('llm');
  });

  it('falls back to rules when the plan is invalid', async () => {
    const ai = vi.fn().mockResolvedValue({ content: 'I cannot do that.', provider: 'test' });
    const service = new MissionService({ fetch: okFetch(), ai });
    const m = service.create('Plan a coffee pop-up in Lisbon and check the weather');
    const done = await service.waitFor(m.id);
    expect(done.plannedBy).toBe('rules');
    expect(done.tasks.some((t) => t.tool === 'weather')).toBe(true);
    expect(done.status).toBe('completed');
  });

  it('plans with rules when the LLM is skipped', async () => {
    const ai = vi.fn();
    const service = new MissionService({ fetch: okFetch(), ai });
    const m = service.create('Plan a coffee pop-up in Lisbon', { useAi: false });
    const done = await service.waitFor(m.id);
    expect(ai).not.toHaveBeenCalled();
    expect(done.plannedBy).toBe('rules');
  });
});
