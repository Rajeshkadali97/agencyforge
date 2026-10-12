import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { RuntimeBridge } from '../bridge/RuntimeBridge';
import { generateStreamToken } from '../bridge/StreamTokenManager';

const makeLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() });

function makeBridge(port = 0) {
  const bus = { subscribe: vi.fn().mockReturnValue('sub_1'), unsubscribe: vi.fn(), publish: vi.fn() };
  const dashboardBinding = { getState: vi.fn().mockReturnValue({}), initialize: vi.fn(), shutdown: vi.fn() };
  const sharedContext = {
    getState: vi.fn().mockReturnValue({ agentStates: new Map(), executionHistory: [], currentProject: null, activeWorkflow: null, sharedMemory: new Map() }),
    getSharedMemory: vi.fn().mockReturnValue(null),
    setSharedMemory: vi.fn(),
  };
  const observability = { getSnapshot: vi.fn().mockReturnValue({}), initialize: vi.fn(), shutdown: vi.fn() };
  const kernelBinding = { getStatus: vi.fn().mockReturnValue('idle') };
  return new RuntimeBridge(bus, dashboardBinding, sharedContext, observability, kernelBinding, makeLogger() as any, { port });
}

function httpGet(
  port: number,
  path: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'GET', headers }, (res) => {
      resolve({ status: res.statusCode ?? 0, headers: res.headers });
      res.destroy();
    });
    req.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ECONNRESET') return;
      reject(err);
    });
    req.end();
  });
}

function httpPost(
  port: number,
  path: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'POST', headers }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('SSE stream — authentication', () => {
  let bridge: RuntimeBridge;
  let port: number;
  const API_KEY = 'test-secret-key-xyz';

  beforeEach(async () => {
    bridge = makeBridge(0);
    await bridge.start();
    port = bridge.getListeningPort();
    process.env['RUNTIME_API_KEY'] = API_KEY;
  });

  afterEach(async () => {
    await bridge.stop();
    delete process.env['RUNTIME_API_KEY'];
  });

  it('returns 401 when no token and key is set', async () => {
    const res = await httpGet(port, '/api/runtime/stream');
    expect(res.status).toBe(401);
  });

  it('returns 401 when bearer token is wrong', async () => {
    const res = await httpGet(port, '/api/runtime/stream', { authorization: 'Bearer wrong-token' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when raw API key used as ?token= (long-lived keys rejected)', async () => {
    const res = await httpGet(port, `/api/runtime/stream?token=${encodeURIComponent(API_KEY)}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 when malformed signed token in ?token=', async () => {
    const res = await httpGet(port, '/api/runtime/stream?token=bad.token.value');
    expect(res.status).toBe(401);
  });

  it('accepts valid Bearer token in Authorization header', async () => {
    const res = await httpGet(port, '/api/runtime/stream', { authorization: `Bearer ${API_KEY}` });
    expect(res.status).toBe(200);
  });

  it('accepts valid short-lived signed token in ?token= (EventSource compat)', async () => {
    const { token } = generateStreamToken(API_KEY);
    const res = await httpGet(port, `/api/runtime/stream?token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(200);
  });

  it('SSE response has text/event-stream content-type', async () => {
    const { token } = generateStreamToken(API_KEY);
    const res = await httpGet(port, `/api/runtime/stream?token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
  });
});

describe('/api/runtime/stream-token — token exchange endpoint', () => {
  let bridge: RuntimeBridge;
  let port: number;
  const API_KEY = 'test-secret-key-xyz';

  beforeEach(async () => {
    bridge = makeBridge(0);
    await bridge.start();
    port = bridge.getListeningPort();
    process.env['RUNTIME_API_KEY'] = API_KEY;
  });

  afterEach(async () => {
    await bridge.stop();
    delete process.env['RUNTIME_API_KEY'];
  });

  it('returns 401 without auth', async () => {
    const res = await httpPost(port, '/api/runtime/stream-token');
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong bearer token', async () => {
    const res = await httpPost(port, '/api/runtime/stream-token', { authorization: 'Bearer wrong' });
    expect(res.status).toBe(401);
  });

  it('returns signed token with valid bearer', async () => {
    const res = await httpPost(port, '/api/runtime/stream-token', { authorization: `Bearer ${API_KEY}` });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body) as { token: string; expiresAt: string };
    expect(typeof body.token).toBe('string');
    expect(body.token.split('.').length).toBe(3);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('issued token works for SSE stream', async () => {
    const tokenRes = await httpPost(port, '/api/runtime/stream-token', { authorization: `Bearer ${API_KEY}` });
    const { token } = JSON.parse(tokenRes.body) as { token: string };
    const sseRes = await httpGet(port, `/api/runtime/stream?token=${encodeURIComponent(token)}`);
    expect(sseRes.status).toBe(200);
  });
});

describe('SSE stream — open mode (no RUNTIME_API_KEY)', () => {
  let bridge: RuntimeBridge;
  let port: number;

  beforeEach(async () => {
    delete process.env['RUNTIME_API_KEY'];
    bridge = makeBridge(0);
    await bridge.start();
    port = bridge.getListeningPort();
  });

  afterEach(async () => {
    await bridge.stop();
  });

  it('allows unauthenticated access when no key configured', async () => {
    const res = await httpGet(port, '/api/runtime/stream');
    expect(res.status).toBe(200);
  });

  it('stream-token returns open-mode response without auth', async () => {
    const res = await httpPost(port, '/api/runtime/stream-token');
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body) as { token: null; mode: string };
    expect(body.token).toBeNull();
    expect(body.mode).toBe('open');
  });
});

describe('/health — always public', () => {
  let bridge: RuntimeBridge;
  let port: number;
  const API_KEY = 'test-secret-key-xyz';

  beforeEach(async () => {
    bridge = makeBridge(0);
    await bridge.start();
    port = bridge.getListeningPort();
    process.env['RUNTIME_API_KEY'] = API_KEY;
  });

  afterEach(async () => {
    await bridge.stop();
    delete process.env['RUNTIME_API_KEY'];
  });

  it('/health returns 200 without any auth', async () => {
    const res = await httpGet(port, '/health');
    expect(res.status).toBe(200);
  });
});
