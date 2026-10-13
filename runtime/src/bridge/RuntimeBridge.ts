import { EventEmitter } from 'events';
import * as http from 'http';
import { randomUUID } from 'crypto';
import { RuntimeEventTypes, RuntimeEvent, BaseEventPayload, createRuntimeEvent } from '../contracts';
import { getAIService } from '../ai/ai-service';
import type { AIMessage } from '../ai/providers/base';
import { generateStreamToken, validateStreamToken, cleanupExpiredJtis } from './StreamTokenManager';
import { MissionService } from '../missions/MissionService';
import { SqliteMissionStore, type MissionStore } from '../missions/MissionStore';
import { createMissionRoutes, MissionRoutes } from '../missions/routes';

/** Read a TCP port from the environment. Returns undefined when unset or invalid. */
function envPort(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 65535 ? n : undefined;
}

export interface RuntimeBridgeConfig {
  port?: number;
  path?: string;
  heartbeatIntervalMs?: number;
  maxConnections?: number;
  /** Allowed CORS origin. Defaults to CORS_ORIGIN env var, or '*' when NODE_ENV !== 'production'. */
  corsOrigin?: string;
  /** Max POST body bytes (default 256 KB). */
  maxBodyBytes?: number;
  /** Max requests per IP per window (default: RATE_LIMIT_MAX env or 100). */
  rateLimitMax?: number;
  /** Sliding window duration in ms (default: RATE_LIMIT_WINDOW_MS env or 60000). */
  rateLimitWindowMs?: number;
}

/**
 * RuntimeBridge provides a simple SSE endpoint and a snapshot HTTP endpoint
 * for external clients (e.g., dashboard) and forwards runtime events to the
 * connected clients. It is intentionally lightweight and does not expose the
 * underlying HTTP server directly.
 */
export class RuntimeBridge extends EventEmitter {
  private eventBus: any;
  private dashboardBinding: any;
  private sharedContext: any;
  private observability: any;
  private kernelBinding: any;
  private logger: any;
  private clients = new Map<string, http.ServerResponse>();
  private nextClientId = 0;
  private subscriptions: string[] = [];
  private heartbeatInterval?: NodeJS.Timeout;
  private running = false;
  private httpServer?: http.Server;
  private bridgePath: string;
  private port: number;
  private heartbeatIntervalMs: number;
  private maxConnections: number;
  private corsOrigin: string;
  private maxBodyBytes: number;
  private rateLimitMax: number;
  private rateLimitWindowMs: number;
  private rateLimitBuckets = new Map<string, { count: number; windowStart: number }>();
  private rateLimitCleanupInterval?: NodeJS.Timeout;
  private usedStreamTokens = new Map<string, number>(); // jti → exp; replay protection
  private tokenCleanupInterval?: NodeJS.Timeout;
  private missionRoutes: MissionRoutes;

  constructor(
    eventBus: any,
    dashboardBinding: any,
    sharedContext: any,
    observability: any,
    kernelBinding: any,
    logger: any,
    config: RuntimeBridgeConfig = {}
  ) {
    super();
    this.eventBus = eventBus;
    this.dashboardBinding = dashboardBinding;
    this.sharedContext = sharedContext;
    this.observability = observability;
    this.kernelBinding = kernelBinding;
    this.logger = logger;
    this.port = config.port ?? envPort('RUNTIME_PORT') ?? 3001;
    this.bridgePath = config.path ?? '/api/runtime/stream';
    this.heartbeatIntervalMs = config.heartbeatIntervalMs ?? 15000;
    this.maxConnections = config.maxConnections ?? 50;
    this.maxBodyBytes = config.maxBodyBytes ?? 262144; // 256 KB
    this.rateLimitMax = config.rateLimitMax ?? parseInt(process.env['RATE_LIMIT_MAX'] ?? '100', 10);
    this.rateLimitWindowMs = config.rateLimitWindowMs ?? parseInt(process.env['RATE_LIMIT_WINDOW_MS'] ?? '60000', 10);
    // CORS: explicit config > env var > '*' in dev, locked-down in production
    const envCors = process.env['CORS_ORIGIN'];
    const isProd = process.env['NODE_ENV'] === 'production';
    this.corsOrigin = config.corsOrigin ?? envCors ?? (isProd ? '' : '*');
    // Persist missions next to the other runtime data when a database path is configured.
    let missionStore: MissionStore | undefined;
    const dbPath = process.env['AGENCYFORGE_DB_PATH'];
    if (dbPath) {
      try {
        missionStore = new SqliteMissionStore(dbPath);
      } catch (err) {
        this.logger.warn('RuntimeBridge: mission persistence unavailable, using memory only', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    const missionService = new MissionService({
      store: missionStore,
      publish: (type, payload, missionId) => {
        this.eventBus.publish(
          createRuntimeEvent(
            type,
            { workflowId: missionId, timestamp: new Date().toISOString(), traceId: missionId, spanId: missionId, ...payload },
            missionId,
            missionId,
          ),
        );
      },
      ai: async (messages) => {
        const service = getAIService();
        // Skip the LLM when no provider is configured and reachable, so a fresh install answers instantly.
        const health = await service.healthCheck();
        const usable = Object.values(health).some((p) => p.isConfigured && p.health !== 'unavailable');
        if (!usable) throw new Error('No LLM provider is configured');
        const response = await service.complete(messages as AIMessage[], { preferredProvider: 'ninerouter' });
        return { content: response.content, provider: response.provider, model: response.model };
      },
    });
    this.missionRoutes = createMissionRoutes(missionService, this.maxBodyBytes);
    this.httpServer = http.createServer(this.requestHandler.bind(this));
  }

  /** Starts the HTTP server and registers event listeners. */
  async start(): Promise<void> {
    if (this.running) return;
    // Set running before await to prevent concurrent double-start (EADDRINUSE race)
    this.running = true;
    try {
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.once('error', reject);
        this.httpServer!.listen(this.port, () => {
          this.httpServer!.removeListener('error', reject);
          this.logger.info(`RuntimeBridge: HTTP server listening on port ${this.port}`);
          resolve();
        });
      });
    } catch (err) {
      this.running = false;
      throw err;
    }
    // Prune expired rate-limit buckets once per window to prevent unbounded Map growth
    this.rateLimitCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [ip, bucket] of this.rateLimitBuckets) {
        if (now - bucket.windowStart >= this.rateLimitWindowMs) {
          this.rateLimitBuckets.delete(ip);
        }
      }
    }, this.rateLimitWindowMs);
    // Prune expired one-time SSE token JTIs every 60s
    this.tokenCleanupInterval = setInterval(() => {
      cleanupExpiredJtis(this.usedStreamTokens);
    }, 60_000);
    // Subscribe to all runtime events and forward to SSE clients
    this.subscriptions.push(
      this.eventBus.subscribe(Object.values(RuntimeEventTypes) as any, (event: RuntimeEvent) => {
        this.broadcastToClients({
          type: 'event',
          id: event.id,
          timestamp: event.timestamp,
          payload: event,
        });
      })
    );
    // Heartbeat interval
    this.heartbeatInterval = setInterval(() => {
      this.broadcastToClients({
        type: 'heartbeat',
        id: `hb_${Date.now()}`,
        timestamp: new Date().toISOString(),
        payload: {
          connectedClients: this.clients.size,
          kernel: this.kernelBinding.getStatus?.(),
          uptimeMs: Math.round(process.uptime() * 1000),
        },
      });
    }, this.heartbeatIntervalMs);
  }

  /** Stops the HTTP server and cleans up subscriptions. */
  async stop(): Promise<void> {
    if (!this.running) return;
    if (this.rateLimitCleanupInterval) {
      clearInterval(this.rateLimitCleanupInterval);
      this.rateLimitCleanupInterval = undefined;
    }
    if (this.tokenCleanupInterval) {
      clearInterval(this.tokenCleanupInterval);
      this.tokenCleanupInterval = undefined;
    }
    // Unsubscribe from events
    for (const subId of this.subscriptions) {
      this.eventBus.unsubscribe(subId);
    }
    this.subscriptions = [];
    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    // Close client connections
    for (const [, res] of this.clients) {
      try { res.end(); } catch {}
    }
    this.clients.clear();
    // Close HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
      this.httpServer = undefined;
    }
    this.running = false;
    this.logger.info('RuntimeBridge: Stopped');
  }

  private corsHeaders(req: http.IncomingMessage): Record<string, string> {
    const headers: Record<string, string> = {};
    if (!this.corsOrigin) return headers;
    const origin = req.headers['origin'] ?? '';
    if (this.corsOrigin === '*' || this.corsOrigin === origin) {
      headers['Access-Control-Allow-Origin'] = this.corsOrigin === '*' ? '*' : origin;
      headers['Vary'] = 'Origin';
    }
    return headers;
  }

  private securityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    };
  }

  private isAuthenticated(req: http.IncomingMessage): boolean {
    const apiKey = process.env['RUNTIME_API_KEY'];
    if (!apiKey) return true; // auth disabled when env var not set
    const auth = req.headers['authorization'] ?? '';
    if (auth === `Bearer ${apiKey}`) return true;
    // EventSource cannot send custom headers — accept short-lived signed ?token= query param only
    try {
      const urlObj = new URL(req.url ?? '/', 'http://localhost');
      const token = urlObj.searchParams.get('token');
      if (!token) return false;
      return validateStreamToken(token, apiKey, this.usedStreamTokens);
    } catch {
      return false;
    }
  }

  /** Handles incoming HTTP requests. */
  private async requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      await this._handleRequest(req, res);
    } catch (err) {
      this.logger.error('RuntimeBridge: Unhandled request error', { error: err instanceof Error ? err.message : String(err) });
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
  }

  private async _handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // Assign request ID and resolve/generate trace ID for correlation
    const requestId = randomUUID();
    const traceparent = req.headers['traceparent'];
    let traceId: string;
    if (typeof traceparent === 'string') {
      // W3C traceparent: 00-{traceId}-{parentId}-{flags}
      traceId = traceparent.split('-')[1] ?? randomUUID().replace(/-/g, '');
    } else {
      traceId = randomUUID().replace(/-/g, '');
    }

    // Apply security headers to every response
    for (const [k, v] of Object.entries(this.securityHeaders())) {
      res.setHeader(k, v);
    }
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Trace-Id', traceId);
    const cors = this.corsHeaders(req);

    // Rate limiting — /health is exempt so monitoring probes always succeed
    if (req.url !== '/health') {
      const ip = req.socket.remoteAddress ?? 'unknown';
      const now = Date.now();
      const bucket = this.rateLimitBuckets.get(ip);
      if (!bucket || now - bucket.windowStart >= this.rateLimitWindowMs) {
        this.rateLimitBuckets.set(ip, { count: 1, windowStart: now });
      } else {
        bucket.count++;
        if (bucket.count > this.rateLimitMax) {
          const retryAfterSec = Math.ceil((this.rateLimitWindowMs - (now - bucket.windowStart)) / 1000);
          res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(retryAfterSec), ...cors });
          res.end(JSON.stringify({ error: 'Too many requests', retryAfterSec }));
          return;
        }
      }
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        ...cors,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end();
      return;
    }

    // Public endpoints — no auth required
    // Note: SSE stream (/stream) is no longer public; auth via Bearer token or ?token= query param
    const isPublic = req.url === '/health';
    if (!isPublic && !this.isAuthenticated(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json', ...cors });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    if (await this.missionRoutes.handle(req, res, cors as Record<string, string>)) return;

    if (req.url?.split('?')[0] === this.bridgePath && req.method === 'GET') {
      this.handleSSEConnection(req, res, cors);
    } else if (req.url?.startsWith('/api/runtime/search') && req.method === 'GET') {
      const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const q = urlObj.searchParams.get('q') || '';
      res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
      res.end(JSON.stringify(this.performGlobalSearch(q)));
    } else if (req.url?.startsWith('/api/runtime/memory') && req.method === 'GET') {
      const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const key = urlObj.searchParams.get('key') || '';
      const value = this.sharedContext.getSharedMemory(key);
      res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
      res.end(JSON.stringify({ key, value }));
    } else if (req.url === '/api/runtime/memory' && req.method === 'POST') {
      let bodyBytes = 0;
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => {
        bodyBytes += chunk.length;
        if (bodyBytes > this.maxBodyBytes) {
          res.writeHead(413, { 'Content-Type': 'application/json', ...cors });
          res.end(JSON.stringify({ error: 'Request body too large' }));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (res.headersSent) return;
        try {
          const { key, value } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (key) {
            this.sharedContext.setSharedMemory(key, value);
            res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
            res.end(JSON.stringify({ success: true }));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json', ...cors });
            res.end(JSON.stringify({ error: 'Missing key' }));
          }
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json', ...cors });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    } else if (req.url === '/api/runtime/snapshot' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
      res.end(JSON.stringify(this.getRuntimeSnapshot()));
    } else if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    } else if (req.url === '/metrics' && req.method === 'GET') {
      const uptime = process.uptime();
      const cpuUsage = process.cpuUsage();
      const cpuPercent = uptime > 0
        ? Math.round(((cpuUsage.user + cpuUsage.system) / (uptime * 1e6)) * 10000) / 100
        : 0;
      res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
      res.end(JSON.stringify({
        uptime,
        cpuPercent,
        memory: process.memoryUsage(),
        connections: this.clients.size,
        snapshot: this.getRuntimeSnapshot()
      }));
    } else if (req.url === '/api/runtime/chat' && req.method === 'POST') {
      let bodyBytes = 0;
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => {
        bodyBytes += chunk.length;
        if (bodyBytes > this.maxBodyBytes) {
          res.writeHead(413, { 'Content-Type': 'application/json', ...cors });
          res.end(JSON.stringify({ error: 'Request body too large' }));
          req.destroy();
        } else {
          chunks.push(chunk);
        }
      });
      req.on('end', () => {
        if (res.headersSent) return;
        (async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const rawMessages: Array<{ role: string; content: string }> = body.messages;
            if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
              res.writeHead(400, { 'Content-Type': 'application/json', ...cors });
              res.end(JSON.stringify({ error: 'messages array required' }));
              return;
            }
            const aiMessages: AIMessage[] = body.system
              ? [{ role: 'system' as const, content: String(body.system) }, ...rawMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))]
              : rawMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
            const aiService = getAIService();
            const response = await aiService.complete(aiMessages, { preferredProvider: 'ninerouter' });
            res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
            res.end(JSON.stringify({
              response: response.content,
              provider: response.provider,
              model: response.model,
              latencyMs: response.latencyMs,
            }));
          } catch (err) {
            this.logger.error('RuntimeBridge: chat error', { error: err instanceof Error ? err.message : String(err) });
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json', ...cors });
              res.end(JSON.stringify({ error: 'Internal server error' }));
            }
          }
        })();
      });
    } else if (req.url === '/api/ai/routing' && req.method === 'GET') {
      try {
        const aiService = getAIService();
        const health = await aiService.healthCheck();
        const metrics = aiService.getMetrics();
        res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
        res.end(JSON.stringify({ health, metrics, timestamp: new Date().toISOString() }));
      } catch (err) {
        this.logger.error('RuntimeBridge: ai routing error', { error: err instanceof Error ? err.message : String(err) });
        res.writeHead(500, { 'Content-Type': 'application/json', ...cors });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    } else if (req.url === '/api/runtime/stream-token' && req.method === 'POST') {
      const apiKey = process.env['RUNTIME_API_KEY'];
      if (!apiKey) {
        // Open mode — no token needed; return a placeholder so callers can connect without ?token=
        res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
        res.end(JSON.stringify({ token: null, expiresAt: null, mode: 'open' }));
        return;
      }
      const issued = generateStreamToken(apiKey);
      res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
      res.end(JSON.stringify({ token: issued.token, expiresAt: new Date(issued.expiresAt).toISOString() }));
    } else if (req.url === '/api/runtime/approve' && req.method === 'POST') {
      let bodyBytes = 0;
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => {
        bodyBytes += chunk.length;
        if (bodyBytes > this.maxBodyBytes) {
          res.writeHead(413, { 'Content-Type': 'application/json', ...cors });
          res.end(JSON.stringify({ error: 'Request body too large' }));
          req.destroy();
        } else {
          chunks.push(chunk);
        }
      });
      req.on('end', () => {
        if (res.headersSent) return;
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          const { workflowId, stepId, approved } = body;
          if (!workflowId || !stepId || typeof approved !== 'boolean') {
            res.writeHead(400, { 'Content-Type': 'application/json', ...cors });
            res.end(JSON.stringify({ error: 'workflowId, stepId, and approved (boolean) are required' }));
            return;
          }
          this.eventBus.publish(createRuntimeEvent(
            RuntimeEventTypes.CHECKPOINT_APPROVED,
            { workflowId, stepId, approved, timestamp: new Date().toISOString(), traceId: workflowId, spanId: stepId },
            workflowId,
            stepId,
          ));
          res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
          res.end(JSON.stringify({ success: true, workflowId, stepId, approved }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json', ...cors });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    } else {
      res.writeHead(404, { ...cors });
      res.end();
    }
  }

  private handleSSEConnection(_req: http.IncomingMessage, res: http.ServerResponse, cors: Record<string, string> = {}) {
    if (this.clients.size >= this.maxConnections) {
      res.writeHead(429, { 'Content-Type': 'application/json', ...cors });
      res.end(JSON.stringify({ error: 'Too many connections' }));
      return;
    }
    const clientId = `client_${++this.nextClientId}`;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...cors,
    });
    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: new Date().toISOString() })}\n\n`);
    // Send initial snapshot
    const snapshot = this.getRuntimeSnapshot();
    res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
    this.clients.set(clientId, res);
    // Cleanup on close
    res.on('close', () => {
      this.clients.delete(clientId);
      this.logger.debug('RuntimeBridge: Client disconnected', { clientId });
    });
    this.logger.debug('RuntimeBridge: Client connected', { clientId });
  }

  /** Returns a snapshot of the current runtime state for the dashboard. */
  private getRuntimeSnapshot() {
    return {
      dashboard: this.dashboardBinding.getState?.(),
      context: this.sharedContext.getState?.(),
      kernel: this.kernelBinding.getStatus?.(),
      observability: this.observability.getSnapshot?.(),
    };
  }

  getConnectedClientCount(): number {
    return this.clients.size;
  }

  getPort(): number {
    return this.port;
  }

  getListeningPort(): number {
    const addr = this.httpServer?.address();
    return (addr && typeof addr === 'object') ? addr.port : this.port;
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Broadcast a message to all connected SSE clients. */
  private broadcastToClients(message: any) {
    if (this.clients.size === 0) return;
    const data = JSON.stringify(message);
    const dead: string[] = [];
    for (const [clientId, res] of this.clients) {
      try {
        res.write(`event: ${message.type}\ndata: ${data}\n\n`);
      } catch {
        dead.push(clientId);
      }
    }
    for (const id of dead) {
      this.clients.delete(id);
    }
  }

  private performGlobalSearch(q: string): Array<{ category: string; label: string; subtitle: string }> {
    if (!q || q.trim() === '') {
      return [];
    }

    const query = q.toLowerCase();
    const results: Array<{ category: string; label: string; subtitle: string }> = [];

    try {
      const state = this.sharedContext.getState?.();
      if (!state) return results;

      // Search registered agents
      const agentStates: Map<string, any> = state.agentStates instanceof Map
        ? state.agentStates
        : new Map(Object.entries(state.agentStates ?? {}));

      for (const [agentId, agentState] of agentStates) {
        const label = agentState?.name ?? agentId;
        const subtitle = `Agent — ${agentState?.status ?? 'unknown'}`;
        if (label.toLowerCase().includes(query) || agentId.toLowerCase().includes(query)) {
          results.push({ category: 'Agents', label, subtitle });
        }
      }

      // Search execution history (tasks/workflows)
      const history: any[] = Array.isArray(state.executionHistory) ? state.executionHistory : [];
      for (const record of history.slice(-50)) {
        const label = record?.objective ?? record?.workflowId ?? record?.id ?? '';
        const subtitle = `Task — ${record?.status ?? 'unknown'} · ${record?.agentId ?? ''}`;
        if (label.toLowerCase().includes(query)) {
          results.push({ category: 'Tasks', label, subtitle });
        }
      }

      // Search active project
      if (state.currentProject) {
        const p = state.currentProject;
        if (
          p.name?.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
        ) {
          results.push({ category: 'Projects', label: p.name, subtitle: `Project — ${p.status}` });
        }
      }

      // Search active workflow
      if (state.activeWorkflow) {
        const w = state.activeWorkflow as any;
        const label = w?.name ?? w?.id ?? 'Active Workflow';
        if (label.toLowerCase().includes(query)) {
          results.push({ category: 'Workflows', label, subtitle: `Workflow — ${w?.status ?? 'running'}` });
        }
      }

      // Search shared memory keys
      const mem: Map<string, unknown> = state.sharedMemory instanceof Map
        ? state.sharedMemory
        : new Map(Object.entries(state.sharedMemory ?? {}));

      for (const [key] of mem) {
        if (key.toLowerCase().includes(query)) {
          results.push({ category: 'Memory', label: key, subtitle: 'Shared context entry' });
        }
      }
    } catch (err) {
      this.logger.warn('RuntimeBridge: search error', { error: String(err) });
    }

    return results;
  }
}
