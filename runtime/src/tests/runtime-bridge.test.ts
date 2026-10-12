import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import { RuntimeBridge } from '../bridge/RuntimeBridge';

const makeLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

const makeBus = () => ({
  subscribe: vi.fn().mockReturnValue('sub_rate_1'),
  unsubscribe: vi.fn(),
  publish: vi.fn(),
});

const makeSharedContext = () => ({
  getState: vi.fn().mockReturnValue({
    agentStates: new Map(),
    executionHistory: [],
    currentProject: null,
    activeWorkflow: null,
    sharedMemory: new Map(),
  }),
  getSharedMemory: vi.fn().mockReturnValue(null),
  setSharedMemory: vi.fn(),
});

function httpGet(
  port: number,
  path: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'GET', headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString() }),
        );
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('RuntimeBridge — rate limiting', () => {
  let bridge: RuntimeBridge;
  let port: number;

  beforeEach(async () => {
    bridge = new RuntimeBridge(
      makeBus(),
      { getState: vi.fn().mockReturnValue({}), initialize: vi.fn(), shutdown: vi.fn() },
      makeSharedContext(),
      { getSnapshot: vi.fn().mockReturnValue({}), initialize: vi.fn(), shutdown: vi.fn() },
      { getStatus: vi.fn().mockReturnValue('idle') },
      makeLogger() as any,
      { port: 0, rateLimitMax: 3, rateLimitWindowMs: 5000 },
    );
    await bridge.start();
    port = bridge.getListeningPort();
  });

  afterEach(async () => {
    await bridge.stop();
  });

  it('allows requests within the rate limit', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await httpGet(port, '/api/runtime/snapshot');
      expect(res.status).not.toBe(429);
    }
  });

  it('returns 429 when rate limit is exceeded', async () => {
    for (let i = 0; i < 3; i++) {
      await httpGet(port, '/api/runtime/snapshot');
    }
    const res = await httpGet(port, '/api/runtime/snapshot');
    expect(res.status).toBe(429);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Too many requests');
    expect(body.retryAfterSec).toBeGreaterThanOrEqual(0);
  });

  it('includes Retry-After header on 429', async () => {
    for (let i = 0; i < 3; i++) {
      await httpGet(port, '/api/runtime/snapshot');
    }
    const res = await httpGet(port, '/api/runtime/snapshot');
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('health endpoint is never rate limited', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await httpGet(port, '/health');
      expect(res.status).toBe(200);
    }
  });

  it('getListeningPort returns the OS-assigned port', () => {
    expect(port).toBeGreaterThan(0);
  });
});
