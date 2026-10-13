"use client";

import { RUNTIME_ENDPOINTS } from './runtime-config';

/**
 * URL of the runtime event stream.
 *
 * The dashboard server proxies the stream (see app/api/runtime/stream/route.ts) and
 * attaches RUNTIME_API_KEY itself, so the browser needs no token and no CORS setup.
 */
export async function buildStreamUrl(): Promise<string> {
  return RUNTIME_ENDPOINTS.stream;
}
