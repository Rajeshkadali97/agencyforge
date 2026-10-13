import { forwardToRuntime } from "@/lib/server/runtime-upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return forwardToRuntime("/api/ai/routing", { method: "GET" });
}
