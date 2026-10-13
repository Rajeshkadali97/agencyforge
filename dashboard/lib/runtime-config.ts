/**
 * Single source of truth for runtime API configuration in the dashboard.
 * All fetch calls to the AgencyForge runtime must use these values, never hardcoded URLs.
 *
 * Environment variables (set in .env.local for local dev, env config for production):
 *   NEXT_PUBLIC_RUNTIME_URL  — base URL for the RuntimeBridge HTTP server
 *                              e.g. http://localhost:3001 (dev) or https://runtime.myapp.com (prod)
 */

export const RUNTIME_BASE_URL =
  process.env['NEXT_PUBLIC_RUNTIME_URL'] ??
  process.env['NEXT_PUBLIC_RUNTIME_BRIDGE_URL'] ??
  'http://localhost:3001';


export const RUNTIME_ENDPOINTS = {
  /** Same-origin SSE proxy: the dashboard server attaches the runtime key. */
  stream:      `/api/runtime/stream`,
  snapshot:    `${RUNTIME_BASE_URL}/api/runtime/snapshot`,
  memory:      `${RUNTIME_BASE_URL}/api/runtime/memory`,
  search:      `${RUNTIME_BASE_URL}/api/runtime/search`,
  chat:        `${RUNTIME_BASE_URL}/api/runtime/chat`,
  approve:     `${RUNTIME_BASE_URL}/api/runtime/approve`,
  aiRouting:   `/api/ai/routing`,
  missions:    `/api/runtime/missions`,
  missionTemplates: `/api/runtime/missions/templates`,
  apis:        `/api/runtime/apis`,
  apiCategories: `/api/runtime/apis/categories`,
  health:      `${RUNTIME_BASE_URL}/health`,
  metrics:     `${RUNTIME_BASE_URL}/metrics`,
} as const;
