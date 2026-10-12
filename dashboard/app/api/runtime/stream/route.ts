export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const bridgeUrl = process.env.RUNTIME_BRIDGE_URL ?? 'http://localhost:3001/api/runtime/stream';
  return new Response(null, {
    status: 307,
    headers: {
      Location: bridgeUrl,
    },
  });
}
