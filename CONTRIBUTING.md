# Contributing to AgencyForge

Thanks for helping build the operating system for AI agencies. This guide gets you from clone to pull request.

## Setup

Requirements: Node.js 20+ and pnpm 10 (`corepack enable`).

```bash
git clone https://github.com/Rajeshkadali97/agencyforge.git
cd agencyforge
pnpm install
pnpm build
pnpm test
```

Run the stack locally:

```bash
cp .env.example .env
pnpm start:runtime      # http://localhost:3001
pnpm start:dashboard    # http://localhost:3000
```

## Repository layout

| Path | Purpose |
|---|---|
| `kernel/` | Event bus, task graph, agent registry |
| `runtime/` | Bootstrap, workflow engine, bridge, AI routing, persistence |
| `memory-engine/` | Tiered memory |
| `research/`, `revenue-engine/`, `website-builder/` | Domain engines |
| `dashboard/` | Next.js dashboard |
| `docs/` | Architecture, specs, guides |

## Architecture rules

1. **Modules never call each other directly.** Communicate through the event bus.
2. **The kernel stays domain-agnostic.** No agency-specific logic in `kernel/`.
3. **Secrets live in the environment.** Never hard-code keys, tokens or personal paths.
4. **Retrieval is capped.** Summarise or truncate memory to fit model budgets.

## Coding standards

- TypeScript, strict where the package allows it.
- `camelCase` for values, `PascalCase` for types and components, `kebab-case` for files, `UPPER_SNAKE_CASE` for event types and constants.
- Prefer `async`/`await` with explicit error handling and early returns.
- Add or update tests for behavior changes. Run `pnpm typecheck && pnpm test` before pushing.

## Pull requests

1. Fork and create a branch: `feat/short-name` or `fix/short-name`.
2. Keep PRs focused; describe the *why*.
3. Use [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:`, `chore:`).
4. Make sure CI is green, including the secret scan.

## Reporting bugs and ideas

Use the issue templates. For security issues, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
