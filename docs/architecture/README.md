# AgencyForge Architecture Documentation

Version: v0.2 | Last updated: 2026-07-24

This directory contains complete architectural documentation for AgencyForge. It is grounded in the actual post-validation source code — not aspirational design. Where the code is ambiguous, that ambiguity is noted explicitly.

## How to read this

New to the codebase? Start with [01 System Overview](01-system-overview.md), then follow the numbered sequence. Each document stands alone if you need a specific subsystem.

## Document Index

| # | File | Covers |
|---|---|---|
| 01 | [System Overview](01-system-overview.md) | Monorepo structure, package dependency graph, core principles |
| 02 | [Runtime Lifecycle](02-runtime-lifecycle.md) | Bootstrap sequence, start/stop, subsystem wiring, shutdown order |
| 03 | [Event System](03-event-system.md) | EnhancedEventBus internals, full event catalog, pub/sub patterns |
| 04 | [AI Provider System](04-ai-providers.md) | Provider chain, BaseAIProvider, 9Router priority, timeout behavior, integration guide |
| 05 | [Workflow Engine](05-workflow-engine.md) | DAG execution, step types, retry/approval/cancellation |
| 06 | [Agent Lifecycle](06-agent-lifecycle.md) | AgentRuntime interface, registration, AgentOrchestrator, built-in agents |
| 07 | [Memory System](07-memory-system.md) | kernel memory-engine, MemoryBinding, CognitiveMemoryBridge, persistence |
| 08 | [RuntimeBridge & API](08-runtime-bridge.md) | All HTTP endpoints, SSE stream, auth, StreamTokenManager, sequence diagrams |
| 09 | [Database Schema](09-database-schema.md) | Both SQLite schemas with column types and index rationale |
| 10 | [Plugin System](10-plugin-system.md) | PluginManifest, PluginRegistry, capability model, writing a plugin |
| 11 | [Deployment Topology](11-deployment-topology.md) | Single-node layout, process supervision, Docker, network diagram |
| 12 | [Extension Points](12-extension-points.md) | Every place the system is designed to be extended |
| 13 | [Coding Standards](13-coding-standards.md) | TypeScript conventions, error handling patterns, testing rules |
| 14 | [Contribution Guide](14-contribution-guide.md) | Getting started, branch workflow, PR checklist, GateGuard hook |
| 15 | [Future Roadmap](15-roadmap.md) | Post-RC1 work, scaling path, known limitations resolution |

## Key invariants every contributor must know

1. **Single event bus.** All inter-subsystem communication goes through `EnhancedEventBus`. Never import a subsystem and call it directly from another subsystem — publish an event instead.

2. **9Router first.** All AI inference calls go through 9Router (localhost:20128). Direct provider calls are fallbacks only.

3. **No blocking the event loop.** All I/O is async. `better-sqlite3` is synchronous but calls are short-lived and wrapped in event handlers that catch errors.

4. **Persistence is optional.** The runtime starts and runs fully without `AGENCYFORGE_DB_PATH`. Persistence is a subscriber, not a dependency.

5. **Plugins fail safe.** Plugin activation errors are caught and warned. A broken plugin never prevents runtime startup.
