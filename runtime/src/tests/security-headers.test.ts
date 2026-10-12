import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import { RuntimeBridge } from '../bridge/RuntimeBridge';

const EXPECTED_SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'x-xss-protection': '1; mode=block',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'geolocation=(), camera=(), microphone=()',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
};

const makeLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() });

function makeBridge(opts: { rateLimitMax?: number; rateLimitWindowMs?: number } = {}) {
  const bus = { subscribe: vi.fn().mockReturnValue('sub_1'), unsubscribe: vi.fn(), publish: vi.fn() };
  const dashboardBinding = { getState: vi.fn().mockReturnValue({}), initialize: vi.fn(), shutdown: vi.fn() };
  const sharedContext = {
    getState: vi.fn().mockReturnValue({ agentStates: new Map(), executionHistory: [], currentProject: null, activeWorkflow: null, sharedMemory: new Map() }),
    getSharedMemory: vi.fn().mockReturnValue(null),
    setSharedMemory: vi.fn(),
  };
  const observability = { getSnapshot: vi.fn().mockReturnValue({}), initialize: vi.fn(), shutdown: vi.fn() };
  const kernelBinding = { getStatus: vi.fn().mockReturnValue('idle') };
  return new RuntimeBridge(bus, dashboardBinding, sharedContext, observability, kernelBinding, makeLogger() as any, { port: 0, ...opts });
}

function httpGet(port: number, path: string): Promise<{ status: number; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

function httpOptions(port: number, path: string): Promise<{ status: number; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'OPTIONS' }, (res) => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

function assertSecurityHeaders(headers: http.IncomingHttpHeaders, context = '') {
  for (const [name, value] of Object.entries(EXPECTED_SECURITY_HEADERS)) {
    expect(headers[name], `${context} — Missing header: ${name}`).toBe(value);
  }
}

describe('Security headers on all endpoints', () => {
  let bridge: RuntimeBridge;
  let port: number;

  beforeEach(async () => {
    bridge = makeBridge();
    await bridge.start();
    port = bridge.getListeningPort();
  });

  afterEach(async () => {
    delete process.env['RUNTIME_API_KEY'];
    await bridge.stop();
  });

  it('GET /health includes all 6 security headers', async () => {
    const { headers } = await httpGet(port, '/health');
    assertSecurityHeaders(headers, '/health');
  });

  it('GET /api/runtime/snapshot includes all security headers', async () => {
    const { headers } = await httpGet(port, '/api/runtime/snapshot');
    assertSecurityHeaders(headers, '/api/runtime/snapshot');
  });

  it('GET /metrics includes all security headers', async () => {
    const { headers } = await httpGet(port, '/metrics');
    assertSecurityHeaders(headers, '/metrics');
  });

  it('GET /nonexistent-path includes all security headers', async () => {
    const { headers } = await httpGet(port, '/not-a-real-route');
    assertSecurityHeaders(headers, '404 path');
  });

  it('OPTIONS preflight returns 204 with security headers', async () => {
    const { status, headers } = await httpOptions(port, '/api/runtime/snapshot');
    expect(status).toBe(204);
    assertSecurityHeaders(headers, 'OPTIONS preflight');
  });

  it('401 unauthorized response includes security headers', async () => {
    process.env['RUNTIME_API_KEY'] = 'secret-for-test';
    const { status, headers } = await httpGet(port, '/api/runtime/snapshot');
    expect(status).toBe(401);
    assertSecurityHeaders(headers, '401 response');
  });

  it('429 rate-limited response includes security headers', async () => {
    const tightBridge = makeBridge({ rateLimitMax: 1, rateLimitWindowMs: 60000 });
    await tightBridge.start();
    const tPort = tightBridge.getListeningPort();

    await httpGet(tPort, '/api/runtime/snapshot');
    const { status, headers } = await httpGet(tPort, '/api/runtime/snapshot');
    await tightBridge.stop();

    expect(status).toBe(429);
    assertSecurityHeaders(headers, '429 response');
  });

  it('X-Frame-Options is DENY (clickjacking protection)', async () => {
    const { headers } = await httpGet(port, '/health');
    expect(headers['x-frame-options']).toBe('DENY');
  });

  it('Content-Security-Policy blocks all origins by default', async () => {
    const { headers } = await httpGet(port, '/health');
    expect(headers['content-security-policy']).toContain("default-src 'none'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  it('X-Content-Type-Options prevents MIME sniffing', async () => {
    const { headers } = await httpGet(port, '/health');
    expect(headers['x-content-type-options']).toBe('nosniff');
  });
});
