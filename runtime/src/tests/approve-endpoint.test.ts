import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import { RuntimeBridge } from '../bridge/RuntimeBridge';

const makeLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

function makeDeps(publishSpy = vi.fn()) {
  return {
    bus: {
      subscribe: vi.fn().mockReturnValue('sub_1'),
      unsubscribe: vi.fn(),
      publish: publishSpy,
    },
    dashboardBinding: { getState: vi.fn().mockReturnValue({}), initialize: vi.fn(), shutdown: vi.fn() },
    sharedContext: {
      getState: vi.fn().mockReturnValue({ agentStates: new Map(), executionHistory: [], currentProject: null, activeWorkflow: null, sharedMemory: new Map() }),
      getSharedMemory: vi.fn().mockReturnValue(null),
      setSharedMemory: vi.fn(),
    },
    observability: { getSnapshot: vi.fn().mockReturnValue({}), initialize: vi.fn(), shutdown: vi.fn() },
    kernelBinding: { getStatus: vi.fn().mockReturnValue('idle') },
  };
}

function httpPost(
  port: number,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString(), headers: res.headers }),
        );
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function httpPostRaw(
  port: number,
  path: string,
  rawBody: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(rawBody) } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() }));
      },
    );
    req.on('error', reject);
    req.write(rawBody);
    req.end();
  });
}

describe('POST /api/runtime/approve', () => {
  let bridge: RuntimeBridge;
  let port: number;
  let publishSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    publishSpy = vi.fn();
    const deps = makeDeps(publishSpy);
    bridge = new RuntimeBridge(
      deps.bus,
      deps.dashboardBinding,
      deps.sharedContext,
      deps.observability,
      deps.kernelBinding,
      makeLogger() as any,
      { port: 0 },
    );
    await bridge.start();
    port = bridge.getListeningPort();
  });

  afterEach(async () => {
    delete process.env['RUNTIME_API_KEY'];
    await bridge.stop();
  });

  it('returns 200 and publishes event for valid approve', async () => {
    const res = await httpPost(port, '/api/runtime/approve', {
      workflowId: 'wf_test_1',
      stepId: 'step_review',
      approved: true,
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.workflowId).toBe('wf_test_1');
    expect(body.approved).toBe(true);
    expect(publishSpy).toHaveBeenCalledOnce();
    const event = publishSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(event['type']).toBe('checkpoint.approved');
    expect((event['payload'] as Record<string, unknown>)['workflowId']).toBe('wf_test_1');
    expect((event['payload'] as Record<string, unknown>)['approved']).toBe(true);
  });

  it('publishes approved=false for rejection', async () => {
    await httpPost(port, '/api/runtime/approve', {
      workflowId: 'wf_test_1',
      stepId: 'step_review',
      approved: false,
    });
    expect(publishSpy).toHaveBeenCalledOnce();
    const event = publishSpy.mock.calls[0][0] as Record<string, unknown>;
    expect((event['payload'] as Record<string, unknown>)['approved']).toBe(false);
  });

  it('published event has proper RuntimeEvent structure', async () => {
    await httpPost(port, '/api/runtime/approve', {
      workflowId: 'wf_1',
      stepId: 'step_1',
      approved: true,
    });
    const event = publishSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(event['id']).toBeDefined();
    expect(event['type']).toBe('checkpoint.approved');
    expect(event['version']).toBe('1.0');
    expect(event['timestamp']).toBeDefined();
    expect(event['traceId']).toBe('wf_1');
    expect(event['spanId']).toBe('step_1');
    expect(event['payload']).toBeDefined();
  });

  it('returns 400 when workflowId is missing', async () => {
    const res = await httpPost(port, '/api/runtime/approve', { stepId: 'step_1', approved: true });
    expect(res.status).toBe(400);
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it('returns 400 when stepId is missing', async () => {
    const res = await httpPost(port, '/api/runtime/approve', { workflowId: 'wf_1', approved: true });
    expect(res.status).toBe(400);
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it('returns 400 when approved is string instead of boolean', async () => {
    const res = await httpPost(port, '/api/runtime/approve', { workflowId: 'wf_1', stepId: 'step_1', approved: 'yes' });
    expect(res.status).toBe(400);
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it('returns 400 when approved is missing', async () => {
    const res = await httpPost(port, '/api/runtime/approve', { workflowId: 'wf_1', stepId: 'step_1' });
    expect(res.status).toBe(400);
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it('returns 400 when body is not valid JSON', async () => {
    const res = await httpPostRaw(port, '/api/runtime/approve', '{not valid json}');
    expect(res.status).toBe(400);
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it('returns 401 when RUNTIME_API_KEY is set and Authorization header is absent', async () => {
    process.env['RUNTIME_API_KEY'] = 'test-secret-key';
    const res = await httpPost(port, '/api/runtime/approve', {
      workflowId: 'wf_1',
      stepId: 'step_1',
      approved: true,
    });
    expect(res.status).toBe(401);
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it('returns 200 when correct Bearer token is supplied', async () => {
    process.env['RUNTIME_API_KEY'] = 'test-secret-key';
    const res = await httpPost(
      port,
      '/api/runtime/approve',
      { workflowId: 'wf_1', stepId: 'step_1', approved: true },
      { Authorization: 'Bearer test-secret-key' },
    );
    expect(res.status).toBe(200);
    expect(publishSpy).toHaveBeenCalledOnce();
  });
});
