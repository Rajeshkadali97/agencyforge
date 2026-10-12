import { RUNTIME_API_TOKEN } from "./runtime-config";

/** Thin JSON client for the runtime bridge. Adds the bearer token when one is configured. */
export async function runtimeJson<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (RUNTIME_API_TOKEN) headers["Authorization"] = `Bearer ${RUNTIME_API_TOKEN}`;

  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Runtime returned ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // keep the status-based message
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}
