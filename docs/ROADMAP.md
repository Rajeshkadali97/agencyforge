# Roadmap

AgencyForge is **v0.2 alpha**. This roadmap is deliberately short and honest. Items link to the problem they solve; none of them are promises with dates.

The detailed RC1-era engineering backlog (graceful shutdown, OTLP flush, SQLite adapters and more) is preserved in [archive/ROADMAP_RC1.md](archive/ROADMAP_RC1.md).

## Shipped in 0.2

- [x] Visible four-stage missions (plan, assign, execute, respond) with HTTP API and events
- [x] Four built-in agent tools on key-less public APIs
- [x] Searchable catalog of 1,700+ public APIs and the API Explorer screen
- [x] Headquarters built on real mission data; command palette; copy briefs as Markdown
- [x] 3D-style vector avatars with state-driven expressions
- [x] `pnpm doctor`, CI with secret scanning and CodeQL, community health files

## Next (0.3)

- [ ] **LLM planner** option: let a model produce the task list, validated against the tool registry
- [ ] **Persist missions** to SQLite and expose history after restarts
- [ ] **Tool SDK**: declare a tool with a schema and drop it into `runtime/src/missions/tools/`, no planner edits
- [ ] **More built-in tools** from the catalog (geocoding, currency, news, books, open data)
- [ ] **Streaming progress** over SSE instead of polling
- [ ] End-to-end browser tests (Playwright) for the mission flow
- [ ] Publish multi-arch Docker images to GHCR (the images already build in CI)

## Later

- [ ] Human approval step inside missions for tools with side effects
- [ ] Agent-to-agent hand-offs that use the memory engine for shared context
- [ ] PostgreSQL persistence adapter and multi-instance event bus
- [ ] Voice interface
- [ ] Plugin packaging and a public agent/tool registry

## How to influence this

Open an issue with the problem you are trying to solve, or pick up something marked above. Small, well-tested tools are the easiest first contribution: see [Missions: add a tool](MISSIONS.md#add-a-tool).
