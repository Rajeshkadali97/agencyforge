# 14 — Contribution Guide

---

## Getting started

```bash
git clone <repo> && cd AgencyForge
pnpm install
pnpm build                                    # build all packages
pnpm --filter @agencyforge/runtime tsc --noEmit  # type check
pnpm --filter @agencyforge/runtime test           # run tests (116+ passing)
pnpm --filter @agencyforge/runtime dev            # start runtime
pnpm --filter agencyforge-dashboard dev           # start dashboard
```

Prerequisites: Node.js 20 LTS, pnpm 9.

---

## Before writing code

1. Read the relevant doc in `docs/architecture/` for the subsystem you're modifying.
2. Check `12-extension-points.md` — prefer extending over modifying core.
3. Check existing tests in `runtime/src/tests/` to understand coverage.

---

## Making changes

### Code changes

1. Make the change.
2. `pnpm --filter @agencyforge/runtime tsc --noEmit` — must be clean.
3. `pnpm --filter @agencyforge/runtime test` — must pass.
4. Add a test for new behavior.

### Adding AI providers, plugins, or agents

See `04-ai-providers.md`, `10-plugin-system.md`, `06-agent-lifecycle.md` respectively.

---

## GateGuard hook

This repo has a `pre:edit-write:gateguard-fact-force` hook that fires before every file edit or creation. Before each write, state four facts in the **same response turn**:

1. **callers/referencing files** — what imports or links to this file
2. **no duplicate exists** — confirm no other copy of this file exists
3. **data schemas if any** — data structures this file reads/writes
4. **verbatim user instruction** — the exact instruction requiring this change

No leading text before the facts. Violations cause a denial requiring retry.

---

## PR checklist

- [ ] `tsc --noEmit` clean
- [ ] `pnpm test` passes (116+, 3 intentional skips allowed)
- [ ] No new `any` types or `// @ts-ignore`
- [ ] No empty catch blocks
- [ ] New timer handles stored and cleared in `stop()`/`dispose()`
- [ ] New HTTP handlers: sync outer wrapper + async `_handle()` inner (not `async requestHandler`)
- [ ] New events via `createRuntimeEvent()` + `RuntimeEventTypes` constants
- [ ] New env vars added to table in `02-runtime-lifecycle.md`
- [ ] `IMPLEMENTATION_LOG.md` updated

---

## What not to do

- No new features during a production sprint — stability only
- Do not modify `docs/archive/PRODUCTION_CERTIFICATION.md` — it is a sealed audit record
- Do not add Express, Fastify, or any web framework — runtime uses Node.js built-in `http`
- Do not call one subsystem directly from another — publish an event instead
- Do not break the 116 passing tests without explicit justification

---

## Known ambiguities in the codebase

Three things read as bugs but are intentional:

1. **Two `EnhancedEventBus` instances** — `RuntimeCoordinator` creates its own bus, separate from the bootstrap bus. Coordinator events never reach the bootstrap bus. This is intentional isolation, not a bug.
2. **`handleRetry()` always returns false** — retries live in `executeWithRetry()` for `type:'retry'` steps. `handleRetry()` is a no-op hook, not a bug.
3. **`SQLiteRuntimeStateStore` activation path** — construction path is unclear in RC1; it may not be wired by default. Verify before using.
