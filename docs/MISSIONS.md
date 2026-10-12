# Missions

A **mission** turns a plain-language goal into a four-stage pipeline you can watch and inspect. It is the fastest way to see AgencyForge work, and it needs no API keys.

The shape is inspired by the staged task-automation design popularised by Microsoft's HuggingGPT / JARVIS research (plan, select, execute, respond), adapted to an agency of department agents and free public data sources.

## The four stages

| Stage | What happens | Where it lives |
|---|---|---|
| **1 · Plan** | The goal is split into tasks. The built-in planner extracts a topic and a place and decides which tools are relevant. | `runtime/src/missions/planner.ts` |
| **2 · Assign** | Each task is given to a department agent and a tool. | `planner.ts`, `tools.ts` |
| **3 · Execute** | Tools run in parallel against live public APIs. A failed tool is reported, the mission continues. | `MissionService.ts` |
| **4 · Respond** | An executive brief is written. An LLM is used when one is reachable, otherwise a template writes it. The result says which one wrote it. | `MissionService.ts` |

Every intermediate result is stored on the mission, so nothing is a black box: you can read the plan, the assignment, each tool's output and the sources.

## Built-in tools

| Tool | Department | Data source | Key needed |
|---|---|---|---|
| `wikipedia` | research | [Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/) | no |
| `weather` | analytics | [Open-Meteo](https://open-meteo.com/) | no |
| `country` | marketing | [World Bank](https://data.worldbank.org/) + Open-Meteo geocoding | no |
| `hackernews` | content | [Hacker News API](https://github.com/HackerNews/API) | no |

Tools make outbound HTTPS requests to those hosts. See [Responsible use](RESPONSIBLE_USE.md).

## HTTP API

All routes live on the runtime bridge (default `http://localhost:3001`) and honour `RUNTIME_API_KEY` when set.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/runtime/missions/templates` | One-click starting goals |
| `POST` | `/api/runtime/missions` | Start a mission. Body: `{ "goal": string, "llm"?: boolean }`. Returns `202` with the mission |
| `GET` | `/api/runtime/missions` | Recent missions, newest first |
| `GET` | `/api/runtime/missions/:id` | One mission with stages, tasks and result |
| `GET` | `/api/runtime/apis` | Search the API catalog: `q`, `category`, `auth`, `https=1`, `limit`, `offset` |
| `GET` | `/api/runtime/apis/categories` | Catalog categories with counts |

```bash
curl -X POST http://localhost:3001/api/runtime/missions \
  -H 'Content-Type: application/json' \
  -d '{"goal":"Plan an outdoor coffee pop-up launch in Lisbon and check the weather"}'
```

The mission id in the response can be polled with `GET /api/runtime/missions/:id` until `status` is `completed` or `failed`.

### Events

Missions publish events on the runtime bus, so other modules can react without calling the mission code:

`mission.created` · `mission.stage` · `mission.task` · `mission.completed` · `mission.failed`

## Add a tool

1. Add an entry to the `ToolId` union in `runtime/src/missions/types.ts`.
2. Implement a `MissionToolDefinition` in `runtime/src/missions/tools.ts` and register it in `MISSION_TOOLS`. Use the injected `ctx.fetch` so tests never hit the network.
3. Teach `planner.ts` when to use it.
4. Add the API name to `FEATURED` in `catalog.ts` so it is flagged in the API Explorer.
5. Add tests next to `runtime/src/tests/missions-catalog-tools.test.ts`.

Pick candidates from the [API Explorer](API_CATALOG.md): filter by **Free, no key, HTTPS**.

## Limits

- The planner is rule-based, not an LLM planner. It handles a topic plus an optional place well and is deliberately simple.
- Missions are held in memory (the newest 50). They are published as events but not yet persisted to SQLite.
- Results are only as good as the upstream APIs. Public APIs change and rate-limit; failures are reported per task.
