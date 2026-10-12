"use client";

import { RUNTIME_ENDPOINTS, RUNTIME_API_TOKEN } from './runtime-config';

/**
 * Exchange the long-lived Bearer token for a short-lived (120s) signed SSE access token.
 * The short-lived token is used as ?token= in the EventSource URL so the permanent key
 * is never embedded in URLs (and therefore never in access logs).
 *
 * Returns null when auth is disabled (RUNTIME_API_TOKEN not set) — callers connect without ?token=.
 */
export async function fetchStreamToken(): Promise<string | null> {
  if (!RUNTIME_API_TOKEN) return null;
  try {
    const res = await fetch(RUNTIME_ENDPOINTS.streamToken, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RUNTIME_API_TOKEN}` },
    });
    if (!res.ok) return null;
    const body = await res.json() as { token: string | null };
    return body.token ?? null;
  } catch {
    return null;
  }
}

/**
 * Build the authenticated EventSource URL for the runtime SSE stream.
 * Fetches a fresh short-lived token on every call — use before each connect() attempt.
 */
export async function buildStreamUrl(): Promise<string> {
  const token = await fetchStreamToken();
  if (!token) return RUNTIME_ENDPOINTS.stream;
  return `${RUNTIME_ENDPOINTS.stream}?token=${encodeURIComponent(token)}`;
}
