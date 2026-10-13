import { runtimeBaseUrl, upstreamHeaders } from "@/lib/server/runtime-upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Same-origin Server-Sent Events proxy.
 *
 * The browser connects here instead of to the runtime, so the runtime needs no CORS
 * setup for the dashboard and the long-lived RUNTIME_API_KEY never leaves the server.
 */
export async function GET(req: Request): Promise<Response> {
  const controller = new AbortController();
  req.signal.addEventListener("abort", () => controller.abort());

  try {
    const upstream = await fetch(`${runtimeBaseUrl()}/api/runtime/stream`, {
      headers: upstreamHeaders({ Accept: "text/event-stream" }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      return Response.json({ error: "Runtime stream unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return Response.json({ error: "Runtime unreachable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
