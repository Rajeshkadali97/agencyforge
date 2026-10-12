# AgencyForge v1.0.0-rc1 Release Notes

**Release Date:** 2026-07-24
**Status:** Release Candidate

---

## Overview

AgencyForge v1.0.0-rc1 is the first production-ready release of the AgencyForge runtime. This release completes a full production hardening sprint covering security, observability, testing, and code quality.

---

## What's New

### Production Security

SSE streaming now uses short-lived HMAC-SHA256 signed tokens instead of long-lived API keys in query parameters. The dashboard calls `POST /api/runtime/stream-token` to exchange a Bearer token for a 120-second signed stream token with replay protection (JTI tracking). Raw API keys in `?token=` query params are rejected with 401.

### Distributed Tracing

Every HTTP response now carries `X-Request-Id` and `X-Trace-Id` headers for correlation across logs. W3C `traceparent` headers are propagated when provided by callers. Optional OTLP trace export is available for Jaeger and Grafana Tempo via `OTEL_EXPORTER_OTLP_ENDPOINT`.

### AI Provider Failover

7-provider chain: 9Router (local gateway) → Ollama → OpenRouter → Gemini → NIM → Anthropic → OpenAI. Automatic failover with per-provider health tracking and metrics. 9Router is the preferred primary gateway; direct cloud providers are fallbacks only.

### Memory Engine

17 typed memory modules with SQLite persistence, FTS5 full-text search, vector embeddings, and a relationship graph. Checkpoint/recovery system for restart resilience.

### Dashboard

Real-time SSE-driven Next.js 14 dashboard with agent status, event timeline, AI routing health, and voice assistant. Token exchange integrated before each EventSource connection.

---

## Test Coverage

| Package | Tests | Status |
|---|---|---|
| runtime | 116 | Pass |
| kernel | 59 | Pass |
| dashboard | 53 | Pass |
| memory-engine | 42 | Pass |
| **Total** | **270** | **Pass** |

---

## Breaking Changes

None. This is the initial production release.

---

## Known Limitations

See `KNOWN_LIMITATIONS.md` for the complete list. Key items:

- No horizontal scaling / multi-instance coordination
- No PostgreSQL adapter (SQLite only)
- Integration stubs in `runtime/src/integrations/` require external SDK installation
- `memory-engine` uses console logging internally (no structured log injection)

---

## Upgrade

See `UPGRADE.md` for installation and configuration steps.

---

## Documentation

- `docs/OBSERVABILITY.md` — tracing, OTLP export, Jaeger/Grafana Tempo setup
- `DEPLOYMENT.md` — production deployment guide
- `OPERATIONS.md` — operational runbook
- `KNOWN_LIMITATIONS.md` — known gaps and workarounds
