import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../app/api/runtime/stream/route';

function sseBody(text: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(text));
      controller.close();
    },
  });
}

describe('SSE stream proxy', () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];

  beforeEach(() => {
    calls.length = 0;
    delete process.env['RUNTIME_API_KEY'];
    delete process.env['RUNTIME_URL'];
    delete process.env['RUNTIME_BRIDGE_URL'];
    delete process.env['NEXT_PUBLIC_RUNTIME_URL'];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('streams the runtime body as text/event-stream and attaches the server key', async () => {
    process.env['RUNTIME_API_KEY'] = 'server-held-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url: String(url), init });
        return new Response(sseBody('event: connected\ndata: {}\n\n'), { status: 200 });
      }),
    );

    const res = await GET(new Request('http://dash/api/runtime/stream'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('cache-control')).toContain('no-cache');
    expect(await res.text()).toContain('event: connected');

    expect(calls[0]?.url).toBe('http://localhost:3001/api/runtime/stream');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer server-held-key');
    expect(headers['Accept']).toBe('text/event-stream');
  });

  it('does not forward any client token or cookie', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url: String(url), init });
        return new Response(sseBody(''), { status: 200 });
      }),
    );
    await GET(new Request('http://dash/api/runtime/stream?token=stolen', { headers: { cookie: 'a=b', authorization: 'Bearer x' } }));
    expect(calls[0]?.url).not.toContain('token=');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
    expect(headers['cookie']).toBeUndefined();
  });

  it('returns 502 when the runtime refuses or is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })));
    expect((await GET(new Request('http://dash/api/runtime/stream'))).status).toBe(502);

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    expect((await GET(new Request('http://dash/api/runtime/stream'))).status).toBe(502);
  });
});
