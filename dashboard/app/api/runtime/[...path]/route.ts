import type { NextRequest } from "next/server";
import { forwardToRuntime } from "@/lib/server/runtime-upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only these runtime paths are reachable through the dashboard. */
const ALLOWED: Array<{ pattern: RegExp; methods: string[] }> = [
  { pattern: /^missions$/, methods: ["GET", "POST"] },
  { pattern: /^missions\/templates$/, methods: ["GET"] },
  { pattern: /^missions\/[A-Za-z0-9_-]{1,64}$/, methods: ["GET"] },
  { pattern: /^apis$/, methods: ["GET"] },
  { pattern: /^apis\/categories$/, methods: ["GET"] },
  { pattern: /^stream-token$/, methods: ["POST"] },
  { pattern: /^snapshot$/, methods: ["GET"] },
];

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params;
  const rel = path.join("/");
  const rule = ALLOWED.find((r) => r.pattern.test(rel));
  if (!rule) return Response.json({ error: "Not found" }, { status: 404 });
  if (!rule.methods.includes(req.method)) return Response.json({ error: "Method not allowed" }, { status: 405 });

  const body = req.method === "GET" ? undefined : await req.text();
  if (body && body.length > 65536) return Response.json({ error: "Request body too large" }, { status: 413 });

  return forwardToRuntime(`/api/runtime/${rel}`, { method: req.method, search: req.nextUrl.search, body: body || undefined });
}

export const GET = handle;
export const POST = handle;
