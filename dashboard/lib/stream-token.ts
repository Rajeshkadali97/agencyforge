"use client";

import { RUNTIME_ENDPOINTS } from './runtime-config';

/**
 * Ask the dashboard server for a short-lived (120 s) signed SSE access token.
 * The server holds RUNTIME_API_KEY, so the long-lived key never reaches the browser
 * and is never placed in a URL or an access log.
 *
 * Returns null when runtime auth is disabled: callers connect without ?token=.
 */
export async function fetchStreamToken(): Promise<string | null> {
  try {
    const res = await fetch(RUNTIME_ENDPOINTS.streamToken, { method: 'POST', cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { token: string | null };
    return body.token ?? null;
  } catch {
    return null;
  }
}

/**
 * Build the authenticated EventSource URL for the runtime SSE stream.
 * Fetches a fresh short-lived token on every call. Use before each connect() attempt.
 */
export async function buildStreamUrl(): Promise<string> {
  const token = await fetchStreamToken();
  if (!token) return RUNTIME_ENDPOINTS.stream;
  return `${RUNTIME_ENDPOINTS.stream}?token=${encodeURIComponent(token)}`;
}
