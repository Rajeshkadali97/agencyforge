import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '../app/api/runtime/[...path]/route';
import { runtimeBaseUrl, upstreamHeaders } from '../lib/server/runtime-upstream';
import { deriveOverview } from '../lib/use-runtime-overview';
import type { Mission } from '../lib/missions';

type Handler = (req: never, ctx: { params: Promise<{ path: string[] }> }) => Promise<Response>;

function req(method: string, url: string, body?: string) {
  const u = new URL(url);
  return { method, nextUrl: u, text: async () => body ?? '' } as never;
}
const ctx = (...path: string[]) => ({ params: Promise.resolve({ path }) });

describe('runtime proxy route', () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];

  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url: String(url), init });
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      }),
    );
    delete process.env['RUNTIME_API_KEY'];
    delete process.env['RUNTIME_URL'];
    delete process.env['RUNTIME_BRIDGE_URL'];
    delete process.env['NEXT_PUBLIC_RUNTIME_URL'];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards an allowed GET with its query string', async () => {
    const res = await (GET as Handler)(req('GET', 'http://dash/api/runtime/apis?q=weather&limit=3'), ctx('apis'));
    expect(res.status).toBe(200);
    expect(calls[0]?.url).toBe('http://localhost:3001/api/runtime/apis?q=weather&limit=3');
  });

  it('injects the server-held bearer token and never reads it from the request', async () => {
    process.env['RUNTIME_API_KEY'] = 'server-side-secret';
    const r = new Request('http://dash/api/runtime/missions', { headers: { authorization: 'Bearer attacker' } });
    await (GET as Handler)(Object.assign(r, { nextUrl: new URL(r.url) }) as never, ctx('missions'));
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer server-side-secret');
  });

  it('forwards a POST body with a JSON content type', async () => {
    await (POST as Handler)(req('POST', 'http://dash/api/runtime/missions', '{"goal":"Scan trends"}'), ctx('missions'));
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.body).toBe('{"goal":"Scan trends"}');
    expect((calls[0]?.init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('rejects paths and methods outside the allowlist', async () => {
    expect((await (GET as Handler)(req('GET', 'http://dash/api/runtime/memory'), ctx('memory'))).status).toBe(404);
    expect((await (GET as Handler)(req('GET', 'http://dash/api/runtime/approve'), ctx('approve'))).status).toBe(404);
    expect((await (GET as Handler)(req('GET', 'http://dash/api/runtime/missions/../health'), ctx('missions', '..', 'health'))).status).toBe(404);
    expect((await (POST as Handler)(req('POST', 'http://dash/api/runtime/apis', '{}'), ctx('apis'))).status).toBe(405);
    expect(calls).toHaveLength(0);
  });

  it('returns 502 when the runtime is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const res = await (GET as Handler)(req('GET', 'http://dash/api/runtime/missions'), ctx('missions'));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Runtime unreachable' });
  });

  it('rejects oversized bodies', async () => {
    const res = await (POST as Handler)(req('POST', 'http://dash/api/runtime/missions', 'x'.repeat(70000)), ctx('missions'));
    expect(res.status).toBe(413);
  });
});

describe('runtime upstream helpers', () => {
  it('strips the SSE path and trailing slashes from the base URL', () => {
    process.env['RUNTIME_BRIDGE_URL'] = 'http://runtime:3001/api/runtime/stream';
    expect(runtimeBaseUrl()).toBe('http://runtime:3001');
    delete process.env['RUNTIME_BRIDGE_URL'];
    process.env['RUNTIME_URL'] = 'https://rt.example.com/';
    expect(runtimeBaseUrl()).toBe('https://rt.example.com');
    delete process.env['RUNTIME_URL'];
  });

  it('adds Authorization only when a key is configured', () => {
    delete process.env['RUNTIME_API_KEY'];
    expect(upstreamHeaders()['Authorization']).toBeUndefined();
    process.env['RUNTIME_API_KEY'] = 'k';
    expect(upstreamHeaders()['Authorization']).toBe('Bearer k');
    delete process.env['RUNTIME_API_KEY'];
  });
});

describe('deriveOverview', () => {
  const mission = (over: Partial<Mission>): Mission => ({
    id: 'm1',
    goal: 'g',
    status: 'completed',
    createdAt: '2026-01-01T00:00:00.000Z',
    stages: [],
    tasks: [],
    suggestedApis: [],
    ...over,
  });

  it('computes stats from real missions only', () => {
    const o = deriveOverview(
      [
        mission({
          id: 'a',
          tasks: [
            { id: 't1', title: 'Research', agent: 'research', tool: 'wikipedia', status: 'done', sourceName: 'Wikipedia' },
            { id: 't2', title: 'Weather', agent: 'analytics', tool: 'weather', status: 'failed', error: 'x' },
          ],
        }),
        mission({ id: 'b', status: 'failed' }),
        mission({ id: 'c', status: 'executing' }),
      ],
      true,
    );
    expect(o.stats).toMatchObject({ missions: 3, completed: 1, failed: 1, running: 1, tasksDone: 1, successRate: 50, sources: 1 });
  });

  it('reports no success rate before a mission finishes', () => {
    expect(deriveOverview([], null).stats.successRate).toBeNull();
    expect(deriveOverview([mission({ status: 'planning' })], true).stats.successRate).toBeNull();
  });
});
