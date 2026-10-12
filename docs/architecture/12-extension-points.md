# 12 — Extension Points

Every place the system is designed to be extended, ordered by how frequently contributors will need them.

---

## 1. AI Providers — `runtime/src/ai/providers/`

Add a new AI provider by extending `BaseAIProvider`.

- Implement `id`, `complete()`, optionally `executeStream()` + `supportsStreaming = true`
- `isConfigured()` returns false when required env var is absent
- Wire into `ProviderFactory` and `AIService.preferOrderedProviders`

Zero impact on other providers. Fallback chain picks it up automatically. See `04-ai-providers.md`.

---

## 2. Plugins — `runtime/src/plugins/`

Add capabilities (tools, scrapers, data sources, workflow connectors) without modifying core.

- Implement `PluginInstance` (`isConfigured`, `invoke`, optional `dispose`)
- Define `PluginManifest` with `create()` factory
- Register with `registry.register(manifest)` in `RuntimeBootstrap.ts`

Broken plugins are caught and skipped at activation. Zero impact on runtime startup. See `10-plugin-system.md`.

---

## 3. Agents — `runtime/src/agent/`

Add a new agent type that can execute tasks.

- Implement `IAgentRuntime` (`id`, `name`, `capabilities`, `execute(task)`, optional `cancel`)
- Register with `AgentRegistry.register(instance)` in bootstrap or plugin `activate()`

New agents share the global `maxConcurrentTasks = 10` cap. See `06-agent-lifecycle.md`.

---

## 4. Event Subscribers — `EnhancedEventBus`

React to any runtime event without touching the publisher.

- `eventBus.subscribe(eventType, handler, { priority?, label?, once? })`
- Wire in a binding's `initialize()` or in `RuntimeBootstrap._wireMemorySubscriptions()`

Priority guidance: `> 0` runs before default handlers; `< 0` runs after (e.g., `-10` for persistence). Use `*` wildcard only when you genuinely need every event.

---

## 5. Health Checks — `HealthManager`

Add a new check that appears in `GET /health` response.

- Implement `() => Promise<{ status: 'healthy'|'degraded'|'unhealthy', details?: Record<string, unknown> }>`
- Register with `healthManager.register(name, checkFn)` at bootstrap

A failing check does not affect others. Overall status is worst-of-all.

---

## 6. Bindings — `runtime/src/bindings/`

Add a new subsystem binding initialized alongside existing bindings.

- Implement `{ initialize(): Promise<void>, shutdown(): Promise<void> }`
- Add to `RuntimeBootstrap.start()` `Promise.all([...])` parallel init phase

**Constraint:** Bindings init in parallel — they cannot depend on each other at init time. A binding failure throws in `bootstrap.start()` and aborts startup.

---

## 7. Workflow Steps — `runtime/src/workflow/`

Add a custom step handler to any `WorkflowDefinition`.

- Pass `handler: (context: WorkflowContext) => Promise<StepResult>` in `WorkflowStep.handler`
- New `StepType` values require a new case in `WorkflowEngineImpl.executeStep()`

No registration needed for custom handlers — they're passed inline in the workflow definition.

---

## 8. Observability Exporters — `runtime/src/observability/`

Add a new trace or metrics destination.

- Implement an exporter compatible with `ObservabilityService`
- Configure via `OTEL_EXPORTER_OTLP_ENDPOINT` env var

Current implementation: zero-dependency OTLP HTTP/JSON. No OpenTelemetry SDK required.

---

## 9. Scheduled Jobs — `runtime/src/scheduler/`

Add a recurring background task.

- `scheduler.schedule(cronExpression, asyncHandler)` at bootstrap
- Thin wrapper around `node-cron`; jobs run in-process

---

## Summary

| Extension | Interface | Registration | Failure impact |
|---|---|---|---|
| AI Provider | `BaseAIProvider` | `ProviderFactory` | Skipped in fallback chain |
| Plugin | `PluginManifest` | `PluginRegistry` | Warned + skipped at bootstrap |
| Agent | `IAgentRuntime` | `AgentRegistry` | Unavailable for dispatch |
| Event subscriber | `EventHandler` | `EnhancedEventBus` | Error isolated per handler |
| Health check | `() => Promise<Result>` | `HealthManager` | Shows 'unhealthy' |
| Binding | `{ initialize, shutdown }` | Bootstrap `Promise.all` | Aborts bootstrap |
| Workflow step | `handler` function | `WorkflowDefinition` | Step + workflow fail |
| Scheduled job | Cron handler | `Scheduler` | Job skips that tick |
