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

/** Bearer token for runtime API calls (used in Authorization header, never in URLs). */
export const RUNTIME_API_TOKEN = process.env['NEXT_PUBLIC_RUNTIME_API_TOKEN'];

export const RUNTIME_ENDPOINTS = {
  stream:      `${RUNTIME_BASE_URL}/api/runtime/stream`,
  streamToken: `${RUNTIME_BASE_URL}/api/runtime/stream-token`,
  snapshot:    `${RUNTIME_BASE_URL}/api/runtime/snapshot`,
  memory:      `${RUNTIME_BASE_URL}/api/runtime/memory`,
  search:      `${RUNTIME_BASE_URL}/api/runtime/search`,
  chat:        `${RUNTIME_BASE_URL}/api/runtime/chat`,
  approve:     `${RUNTIME_BASE_URL}/api/runtime/approve`,
  aiRouting:   `${RUNTIME_BASE_URL}/api/ai/routing`,
  missions:    `${RUNTIME_BASE_URL}/api/runtime/missions`,
  missionTemplates: `${RUNTIME_BASE_URL}/api/runtime/missions/templates`,
  apis:        `${RUNTIME_BASE_URL}/api/runtime/apis`,
  apiCategories: `${RUNTIME_BASE_URL}/api/runtime/apis/categories`,
  health:      `${RUNTIME_BASE_URL}/health`,
  metrics:     `${RUNTIME_BASE_URL}/metrics`,
} as const;
