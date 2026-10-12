import type http from 'http';
import type { MissionService } from './MissionService';
import { MISSION_TEMPLATES } from './templates';
import { listCategories, searchCatalog, getCatalog } from './catalog';

type Cors = Record<string, string>;

function send(res: http.ServerResponse, status: number, body: unknown, cors: Cors): void {
  res.writeHead(status, { 'Content-Type': 'application/json', ...cors });
  res.end(JSON.stringify(body));
}

function readJsonBody(req: http.IncomingMessage, maxBytes: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/**
 * HTTP routes for the mission pipeline and the public API catalog.
 *
 *   GET  /api/runtime/missions/templates
 *   GET  /api/runtime/missions
 *   POST /api/runtime/missions          { goal, template?, llm? }
 *   GET  /api/runtime/missions/:id
 *   GET  /api/runtime/apis              ?q=&category=&auth=&https=1&limit=&offset=
 *   GET  /api/runtime/apis/categories
 */
export function createMissionRoutes(service: MissionService, maxBodyBytes: number) {
  return {
    /** Returns true when the request was handled. */
    async handle(req: http.IncomingMessage, res: http.ServerResponse, cors: Cors): Promise<boolean> {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = url.pathname.replace(/\/+$/, '');
      const method = req.method ?? 'GET';

      if (!path.startsWith('/api/runtime/missions') && !path.startsWith('/api/runtime/apis')) return false;

      // ── public API catalog ────────────────────────────────────────────────
      if (path === '/api/runtime/apis/categories' && method === 'GET') {
        send(res, 200, { total: getCatalog().length, categories: listCategories() }, cors);
        return true;
      }
      if (path === '/api/runtime/apis' && method === 'GET') {
        const p = url.searchParams;
        const page = searchCatalog({
          q: p.get('q') ?? undefined,
          category: p.get('category') ?? undefined,
          auth: p.get('auth') ?? undefined,
          httpsOnly: p.get('https') === '1' || p.get('https') === 'true',
          limit: p.has('limit') ? Number(p.get('limit')) : undefined,
          offset: p.has('offset') ? Number(p.get('offset')) : undefined,
        });
        send(res, 200, page, cors);
        return true;
      }

      // ── missions ──────────────────────────────────────────────────────────
      if (path === '/api/runtime/missions/templates' && method === 'GET') {
        send(res, 200, { templates: MISSION_TEMPLATES }, cors);
        return true;
      }
      if (path === '/api/runtime/missions' && method === 'GET') {
        send(res, 200, { missions: service.list() }, cors);
        return true;
      }
      if (path === '/api/runtime/missions' && method === 'POST') {
        try {
          const body = (await readJsonBody(req, maxBodyBytes)) as { goal?: unknown; template?: unknown; llm?: unknown };
          if (typeof body.goal !== 'string') {
            send(res, 400, { error: 'goal (string) is required' }, cors);
            return true;
          }
          const mission = service.create(body.goal, {
            template: typeof body.template === 'string' ? body.template : undefined,
            useAi: body.llm === false ? false : true,
          });
          send(res, 202, mission, cors);
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode ?? 400;
          send(res, status, { error: err instanceof Error ? err.message : 'Bad request' }, cors);
        }
        return true;
      }

      const single = /^\/api\/runtime\/missions\/([A-Za-z0-9_-]{1,64})$/.exec(path);
      if (single && method === 'GET') {
        const mission = service.get(single[1] as string);
        if (!mission) send(res, 404, { error: 'Mission not found' }, cors);
        else send(res, 200, mission, cors);
        return true;
      }

      return false;
    },
  };
}

export type MissionRoutes = ReturnType<typeof createMissionRoutes>;
