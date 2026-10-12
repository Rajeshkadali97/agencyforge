# AgencyForge v1.0.0-rc1 Release Checklist

**Date:** 2026-07-24
**Release:** v1.0.0-rc1

---

## Build Status

| Package | TypeScript | Status |
|---|---|---|
| runtime | `pnpm typecheck` | PASS |
| kernel | `pnpm typecheck` | PASS |
| memory-engine | `pnpm typecheck` | PASS |
| dashboard | `next build` | PASS |

All packages compile clean with zero TypeScript errors.

---

## Test Status

| Package | Tests | Pass | Fail | Skip |
|---|---|---|---|---|
| runtime | 116 | 116 | 0 | 3 (integration, require live infra) |
| kernel | 59 | 59 | 0 | 0 |
| dashboard | 53 | 53 | 0 | 0 |
| memory-engine | 42 | 42 | 0 | 0 |
| **Total** | **270** | **270** | **0** | **3** |

3 skipped runtime tests require live 9Router or AI provider credentials.

---

## Security Status

| Check | Status | Notes |
|---|---|---|
| SSE token auth | PASS | HMAC-SHA256, 120s TTL, JTI replay protection |
| Raw API key in query param | PASS | Rejected with 401 |
| Security headers | PASS | 6 headers on all responses |
| Rate limiting | PASS | Per-IP sliding window |
| Health server exposure | PASS | Bound to 127.0.0.1 only |
| Request body limit | PASS | 256 KB enforced |
| Error message leakage | PASS | 500s return generic message only |
| OPTIONS bypass | PASS | Rate check runs before OPTIONS handler |

---

## Performance Status

| Metric | Value | Acceptable |
|---|---|---|
| Runtime startup time | < 2s | Yes |
| SSE token exchange latency | < 10ms (in-process HMAC) | Yes |
| Health endpoint response | < 5ms | Yes |
| AI request latency | Provider-dependent | N/A |

Single-instance deployment. No load test for RC1.

---

## Runtime Verification

- [x] `RuntimeBridge` starts on port 3001
- [x] `HealthServer` starts on 127.0.0.1:3002
- [x] `/health` returns `{"status":"ok"}`
- [x] Bearer auth enforced on all endpoints except `/health`
- [x] SSE stream returns heartbeat events
- [x] `POST /api/runtime/stream-token` issues signed tokens
- [x] Signed tokens accepted for SSE; unsigned tokens rejected
- [x] AI failover chain: 9Router → Ollama → OpenRouter → Gemini → NIM → Anthropic → OpenAI
- [x] `POST /api/runtime/chat` returns AI response
- [x] `POST /api/runtime/approve` accepts workflow approvals
- [x] `GET /api/ai/routing` returns provider health
- [x] `X-Request-Id` and `X-Trace-Id` headers on all responses

---

## Deployment Verification

- [x] Fresh `pnpm install --frozen-lockfile` succeeds
- [x] `pnpm build` succeeds (all packages)
- [x] `pnpm typecheck` succeeds (zero errors)
- [x] Runtime starts from `node runtime/dist/index.js`
- [x] Dashboard starts from `pnpm start` (in dashboard/)
- [x] Docker build documented in `DEPLOYMENT.md`
- [x] `.env.example` documents all required and optional variables
- [x] Health check verified post-start

---

## Documentation Verification

| Document | Status |
|---|---|
| `VERSION.md` | Done |
| `CHANGELOG.md` | Done |
| `RELEASE_NOTES.md` | Done |
| `UPGRADE.md` | Done |
| `KNOWN_LIMITATIONS.md` | Done |
| `DEPLOYMENT.md` | Done |
| `OPERATIONS.md` | Done |
| `docs/OBSERVABILITY.md` | Done |
| `PRODUCTION_REPORT.md` | Done |

---

## Known Open Items (Non-Blocking)

Documented in `KNOWN_LIMITATIONS.md`:

- No horizontal scaling / multi-instance coordination
- No PostgreSQL adapter (SQLite only)
- Integration stubs in `runtime/src/integrations/` are inactive
- `memory-engine` uses `console.log` internally
- OTLP span flush on SIGTERM not implemented
- No auth layer on dashboard UI (restrict port 3000 at network level)

---

## Release Decision

| Gate | Status |
|---|---|
| Build clean | PASS |
| Tests passing | PASS |
| Security hardened | PASS |
| Documentation complete | PASS |
| Known limitations documented | PASS |

**RC1 is ready for production deployment.**
