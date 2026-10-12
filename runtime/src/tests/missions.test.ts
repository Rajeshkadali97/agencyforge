import { describe, it, expect, vi, afterEach } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import { MissionService } from '../missions/MissionService';
import { createMissionRoutes } from '../missions/routes';
import { extractPlace, extractTopic, planMission } from '../missions/planner';
import { getCatalog, listCategories, searchCatalog, suggestApis } from '../missions/catalog';
import { MISSION_TEMPLATES } from '../missions/templates';
import type { FetchLike } from '../missions/types';

/** Deterministic fake of every upstream API the tools call. */
function makeFetch(overrides: Record<string, unknown | null> = {}): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const routes: Array<[string, unknown | null]> = [
    ['en.wikipedia.org/api/rest_v1/page/summary/', {
      title: 'Dentistry',
      description: 'Branch of medicine',
      extract: 'Dentistry is the branch of medicine focused on teeth, gums and mouth. It covers diagnosis, prevention and treatment.',
      content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Dentistry' } },
    }],
    ['geocoding-api.open-meteo.com', { results: [{ name: 'Berlin', country: 'Germany', country_code: 'DE', latitude: 52.52, longitude: 13.41 }] }],
    ['api.open-meteo.com/v1/forecast', { current: { temperature_2m: 14.2, wind_speed_10m: 11, relative_humidity_2m: 70 } }],
    ['api.worldbank.org/v2/country/DE/indicator/SP.POP.TOTL', [{ page: 1 }, [{ value: 83491249, date: '2025' }]]],
    ['api.worldbank.org/v2/country/DE/indicator/NY.GDP.PCAP.CD', [{ page: 1 }, [{ value: 60496.4, date: '2025' }]]],
    ['api.worldbank.org/v2/country/DE?', [{ page: 1 }, [{ name: 'Germany', capitalCity: 'Berlin', region: { value: 'Europe & Central Asia' }, incomeLevel: { value: 'High income' } }]]],
    ['hacker-news.firebaseio.com/v0/topstories.json', [101, 102, 103]],
    ['hacker-news.firebaseio.com/v0/item/101.json', { title: 'Agents everywhere', score: 300, url: 'https://example.com/a' }],
    ['hacker-news.firebaseio.com/v0/item/102.json', { title: 'Rust 2.0 released', score: 200 }],
    ['hacker-news.firebaseio.com/v0/item/103.json', { title: 'Show HN: AgencyForge', score: 150, url: 'https://example.com/c' }],
  ];
  const fn = (async (url: string) => {
    calls.push(url);
    for (const [key, body] of Object.entries(overrides)) {
      if (url.includes(key)) {
        return body === null
          ? { ok: false, status: 404, json: async () => null }
          : { ok: true, status: 200, json: async () => body };
      }
    }
    for (const [key, body] of routes) {
      if (url.includes(key)) return { ok: true, status: 200, json: async () => body };
    }
    return { ok: false, status: 404, json: async () => null };
  }) as FetchLike & { calls: string[] };
  fn.calls = calls;
  return fn;
}

describe('planner', () => {
  it('extracts a capitalised place after a preposition', () => {
    expect(extractPlace('Plan a pop-up launch in Lisbon and check the weather')).toBe('Lisbon');
    expect(extractPlace('Find clients near New York for our studio')).toBe('New York');
    expect(extractPlace('research solar panels')).toBeUndefined();
  });

  it('extracts a topic without filler words or the place', () => {
    expect(extractTopic('Research the dental clinic market in Germany', 'Germany')).toBe('dental clinic');
    expect(extractTopic('Tell me about "Rust language" please')).toBe('Rust language');
  });

  it('always starts with research and adds tools that match the goal', () => {
    const plan = planMission('Plan an outdoor coffee pop-up launch in Lisbon and check the weather');
    expect(plan.tasks[0]?.tool).toBe('wikipedia');
    expect(plan.tasks.map((t) => t.tool)).toContain('weather');
    expect(plan.place).toBe('Lisbon');
    expect(plan.tasks.every((t) => t.status === 'pending')).toBe(true);
  });

  it('adds a trend scan when the goal has no place', () => {
    const plan = planMission('Scan the latest AI agents trends');
    expect(plan.tasks.map((t) => t.tool)).toEqual(['wikipedia', 'hackernews']);
  });

  it('assigns every task to a department agent', () => {
    const plan = planMission('Research the dental clinic market in Germany and brief me on the country and tech trends');
    for (const t of plan.tasks) expect(t.agent).toMatch(/^[a-z]+$/);
    expect(new Set(plan.tasks.map((t) => t.id)).size).toBe(plan.tasks.length);
  });
});

describe('public API catalog', () => {
  it('ships the generated public-apis catalog', () => {
    expect(getCatalog().length).toBeGreaterThan(1000);
    expect(listCategories().length).toBeGreaterThan(30);
  });

  it('filters by query, category, auth and https', () => {
    const weather = searchCatalog({ q: 'weather', auth: 'none', httpsOnly: true });
    expect(weather.total).toBeGreaterThan(0);
    for (const api of weather.items) {
      expect(api.auth).toBe('none');
      expect(api.https).toBe(true);
    }
    const animals = searchCatalog({ category: 'animals', limit: 5 });
    expect(animals.items.length).toBeLessThanOrEqual(5);
    expect(animals.items.every((a) => a.category === 'Animals')).toBe(true);
  });

  it('clamps limit and offset', () => {
    const page = searchCatalog({ limit: 100000, offset: -5 });
    expect(page.limit).toBe(100);
    expect(page.offset).toBe(0);
  });

  it('suggests only free HTTPS APIs', () => {
    const suggestions = suggestApis('weather forecast for Lisbon', 5);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((s) => s.auth === 'none')).toBe(true);
  });
});

describe('MissionService', () => {
  it('runs the four stages and writes a template brief', async () => {
    const fetch = makeFetch();
    const events: string[] = [];
    const service = new MissionService({ fetch, publish: (type) => events.push(type) });
    const mission = service.create('Research the dental clinic market in Germany and brief me on the country and tech trends');
    const done = await service.waitFor(mission.id);

    expect(done.status).toBe('completed');
    expect(done.stages.map((s) => s.status)).toEqual(['done', 'done', 'done', 'done']);
    expect(done.tasks.every((t) => t.status === 'done')).toBe(true);
    expect(done.result?.writtenBy).toBe('template');
    expect(done.result?.summary).toContain('Dentistry');
    expect(done.result?.sources.map((s) => s.name)).toContain('Wikipedia');
    expect(events[0]).toBe('mission.created');
    expect(events).toContain('mission.completed');
  });

  it('resolves a city to its country for the market profile', async () => {
    const fetch = makeFetch();
    const service = new MissionService({ fetch });
    const mission = service.create('Research the clinic market in Berlin and the country profile');
    const done = await service.waitFor(mission.id);
    const country = done.tasks.find((t) => t.tool === 'country');
    expect(country?.status).toBe('done');
    expect(country?.summary).toContain('Germany');
  });

  it('keeps going when one tool fails and reports the gap', async () => {
    const fetch = makeFetch({ 'hacker-news.firebaseio.com/v0/topstories.json': null });
    const service = new MissionService({ fetch });
    const mission = service.create('Scan the latest AI agents trends');
    const done = await service.waitFor(mission.id);
    expect(done.status).toBe('completed');
    expect(done.tasks.some((t) => t.status === 'failed')).toBe(true);
    expect(done.result?.sections.some((s) => s.title === 'Gaps')).toBe(true);
  });

  it('fails the mission when every tool fails', async () => {
    const fetch = vi.fn(async () => { throw new Error('offline'); }) as unknown as FetchLike;
    const service = new MissionService({ fetch });
    const mission = service.create('Scan the latest AI agents trends');
    const done = await service.waitFor(mission.id);
    expect(done.status).toBe('failed');
    expect(done.error).toMatch(/tool call failed/i);
    expect(done.stages.some((s) => s.status === 'failed')).toBe(true);
  });

  it('uses the LLM for the brief when one is available', async () => {
    const ai = vi.fn(async () => ({ content: 'The dental market in Germany is large, mature and well documented.', provider: 'test', model: 'tiny' }));
    const service = new MissionService({ fetch: makeFetch(), ai });
    const mission = service.create('Research the dental clinic market in Germany');
    const done = await service.waitFor(mission.id);
    expect(ai).toHaveBeenCalledOnce();
    expect(done.result?.writtenBy).toBe('llm');
    expect(done.result?.provider).toBe('test');
  });

  it('falls back to the template when the LLM fails or times out', async () => {
    const failing = new MissionService({ fetch: makeFetch(), ai: async () => { throw new Error('no key'); } });
    const a = failing.create('Research the dental clinic market in Germany');
    expect((await failing.waitFor(a.id)).result?.writtenBy).toBe('template');

    const slow = new MissionService({ fetch: makeFetch(), aiTimeoutMs: 20, ai: () => new Promise(() => undefined) });
    const b = slow.create('Research the dental clinic market in Germany');
    expect((await slow.waitFor(b.id)).result?.writtenBy).toBe('template');
  });

  it('skips the LLM when useAi is false', async () => {
    const ai = vi.fn(async () => ({ content: 'should not be called at all here' }));
    const service = new MissionService({ fetch: makeFetch(), ai });
    const mission = service.create('Research the dental clinic market in Germany', { useAi: false });
    await service.waitFor(mission.id);
    expect(ai).not.toHaveBeenCalled();
  });

  it('validates goal length', () => {
    const service = new MissionService({ fetch: makeFetch() });
    expect(() => service.create('hi')).toThrow(/at least 3/);
    expect(() => service.create('x'.repeat(501))).toThrow(/at most 500/);
  });

  it('never lets a throwing event publisher break a mission', async () => {
    const service = new MissionService({ fetch: makeFetch(), publish: () => { throw new Error('bus down'); } });
    const mission = service.create('Scan the latest AI agents trends');
    expect((await service.waitFor(mission.id)).status).toBe('completed');
  });

  it('evicts the oldest finished missions beyond the cap', async () => {
    const service = new MissionService({ fetch: makeFetch(), maxMissions: 2 });
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const m = service.create(`Scan the latest AI agents trends ${i}`);
      ids.push(m.id);
      await service.waitFor(m.id);
    }
    expect(service.list().length).toBeLessThanOrEqual(2);
    expect(service.get(ids[0] as string)).toBeUndefined();
  });
});

describe('mission HTTP routes', () => {
  let server: http.Server | undefined;

  afterEach(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    server = undefined;
  });

  async function start() {
    const service = new MissionService({ fetch: makeFetch() });
    const routes = createMissionRoutes(service, 4096);
    server = http.createServer(async (req, res) => {
      if (!(await routes.handle(req, res, {}))) {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    return { port: (server.address() as AddressInfo).port, service };
  }

  async function call(port: number, path: string, init?: { method?: string; body?: unknown; raw?: string }) {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: init?.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: init?.raw ?? (init?.body === undefined ? undefined : JSON.stringify(init.body)),
    });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  }

  it('lists templates and catalog categories', async () => {
    const { port } = await start();
    const templates = await call(port, '/api/runtime/missions/templates');
    expect(templates.status).toBe(200);
    expect(templates.json.templates).toHaveLength(MISSION_TEMPLATES.length);

    const cats = await call(port, '/api/runtime/apis/categories');
    expect(cats.json.categories.length).toBeGreaterThan(30);
  });

  it('searches the catalog', async () => {
    const { port } = await start();
    const res = await call(port, '/api/runtime/apis?q=weather&auth=none&https=1&limit=3');
    expect(res.status).toBe(200);
    expect(res.json.items.length).toBeLessThanOrEqual(3);
    expect(res.json.total).toBeGreaterThan(0);
  });

  it('creates a mission, then returns it by id', async () => {
    const { port, service } = await start();
    const created = await call(port, '/api/runtime/missions', { method: 'POST', body: { goal: 'Scan the latest AI agents trends' } });
    expect(created.status).toBe(202);
    expect(created.json.id).toMatch(/^msn_/);

    await service.waitFor(created.json.id);
    const fetched = await call(port, `/api/runtime/missions/${created.json.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.json.status).toBe('completed');

    const list = await call(port, '/api/runtime/missions');
    expect(list.json.missions.some((m: { id: string }) => m.id === created.json.id)).toBe(true);
  });

  it('rejects bad input', async () => {
    const { port } = await start();
    expect((await call(port, '/api/runtime/missions', { method: 'POST', body: {} })).status).toBe(400);
    expect((await call(port, '/api/runtime/missions', { method: 'POST', body: { goal: 'ab' } })).status).toBe(400);
    expect((await call(port, '/api/runtime/missions', { method: 'POST', raw: '{not json' })).status).toBe(400);
    expect((await call(port, '/api/runtime/missions/does_not_exist')).status).toBe(404);
  });

  it('ignores unrelated paths', async () => {
    const { port } = await start();
    expect((await call(port, '/health')).status).toBe(404);
  });
});
