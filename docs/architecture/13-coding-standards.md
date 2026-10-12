# 13 — Coding Standards

Observed patterns from the RC1 codebase. Descriptive, not aspirational.

---

## TypeScript

**Strict mode.** tsc strict enabled. Never use `// @ts-ignore` or `// @ts-nocheck`.

**Type imports.** Use `import type` for type-only imports.

**`any` usage.** `any` appears in `RuntimeBridge` constructor params for cross-boundary bindings. New code must avoid `any` — use interfaces or generics.

**Interfaces for public contracts.** Use `interface` for public shapes; `type` for unions and computed types only.

**Readonly identifiers.** Agent/plugin IDs, names, and capability arrays are `readonly` class properties.

**Env var reads.** Always use bracket notation: `process.env['KEY']`, not `process.env.KEY`.

---

## Error handling

**No silent swallowing.** Every `catch` must re-throw, log, or return a typed error result. Empty catch blocks are forbidden.

**Error message extraction:**
```typescript
const message = err instanceof Error ? err.message : String(err);
```

**Custom error classes** for domain errors needing special catch handling:
```typescript
class StreamTimeoutError extends Error {
  constructor(ms: number) {
    super(`AI stream timed out after ${ms}ms`);
    this.name = 'StreamTimeoutError';
  }
}
```

**Async HTTP handlers.** Never pass `async` to `http.createServer`. Use sync outer + async inner with `.catch()` guard. See `HealthServer.ts` and `RuntimeBridge.ts` for the canonical pattern.

---

## Async patterns

**No fire-and-forget without catch:**
```typescript
// Forbidden
someAsyncFn();
// Required
someAsyncFn().catch(err => this.logger.error('Context', { error: err.message }));
```

**Store all timer handles** and clear in `stop()`/`dispose()`:
```typescript
private interval?: NodeJS.Timeout;
start() { this.interval = setInterval(...); }
stop()  { clearInterval(this.interval); this.interval = undefined; }
```

**Stream timeouts via Promise.race:**
```typescript
await Promise.race([streamOperation(), rejectAfterMs(timeoutMs)]);
```

---

## Logging

Use structured logging via `ILogger`:
```typescript
this.logger.info('ClassName: Short description', { key: value });
this.logger.error('ClassName: Failure context', { error: err.message });
```

- Log `.message` only, never full Error objects
- `error`: failures; `warn`: degraded state; `info`: lifecycle events; `debug`: high-frequency trace

---

## Events

Use `createRuntimeEvent()` factory and `RuntimeEventTypes` constants — never construct `RuntimeEvent` inline or use raw event type strings:
```typescript
this.eventBus.publish(createRuntimeEvent(
  RuntimeEventTypes.TASK_COMPLETED,
  { taskId, agentId, output, durationMs },
  traceId, spanId,
));
```

---

## Comments

Default: no comments. Add only when the WHY is non-obvious — hidden constraint, subtle invariant, known bug workaround. Never explain WHAT the code does.

---

## Testing

**Runner:** Vitest. Run: `pnpm test` from the `runtime/` package.

**Naming:** `describe('ComponentName')` → `it('does X when Y')`. No `it('should ...')`.

**No external service calls** in unit tests. Providers requiring API keys are intentionally skipped in CI (3 skips in RC1).

**File naming:** `{component-name}.test.ts` in `runtime/src/tests/`.

---

## Module organization

- One class per file; file name is kebab-case of class name
- `index.ts` re-exports public API; internal files are not imported from outside the directory
- Circular imports forbidden — extract shared types to a third file
- Required env vars are checked lazily at first use, not at startup
