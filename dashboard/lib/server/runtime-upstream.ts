/**
 * Server-only helpers for talking to the runtime bridge from Next.js route handlers.
 * The bearer token (RUNTIME_API_KEY) stays on the server and never reaches the browser.
 */

/** Base URL of the runtime bridge without a trailing slash or the SSE path. */
export function runtimeBaseUrl(): string {
  const raw =
    process.env['RUNTIME_URL'] ??
    process.env['RUNTIME_BRIDGE_URL'] ??
    process.env['NEXT_PUBLIC_RUNTIME_URL'] ??
    'http://localhost:3001';
  return raw.replace(/\/api\/runtime\/stream\/?$/, '').replace(/\/+$/, '');
}

export function upstreamHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json', ...extra };
  const key = process.env['RUNTIME_API_KEY'];
  if (key) headers['Authorization'] = `Bearer ${key}`;
  return headers;
}

export async function forwardToRuntime(
  path: string,
  init: { method: string; search?: string; body?: string },
): Promise<Response> {
  const url = `${runtimeBaseUrl()}${path}${init.search ?? ''}`;
  try {
    const upstream = await fetch(url, {
      method: init.method,
      headers: upstreamHeaders(init.body ? { 'Content-Type': 'application/json' } : {}),
      body: init.body,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ error: 'Runtime unreachable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
