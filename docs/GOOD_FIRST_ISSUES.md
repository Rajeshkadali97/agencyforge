# Good first issues

Ideas that are small, self-contained and well supported by tests. Open an issue (or comment on one) before you start so nobody duplicates work.

## New mission tools

Each is a single file in `runtime/src/missions/tools.ts` plus a planner rule and tests. See [Missions: add a tool](MISSIONS.md#add-a-tool).

| Idea | Free API | Notes |
|---|---|---|
| Currency conversion | [Frankfurter](https://www.frankfurter.app/) | Useful for market briefs; no key |
| Books on a topic | [Open Library](https://openlibrary.org/developers/api) | Reading list for the research agent |
| Public holidays | [Nager.Date](https://date.nager.at/Api) | Launch-timing checks for a country |
| Country neighbours and languages | [World Bank](https://data.worldbank.org/) or Wikidata | Extend the market profile |
| Air quality | [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) | Pairs with the weather tool |

## Product and UX

- Dark theme for the dashboard (`globals.css` already uses CSS variables).
- Show mission progress with Server-Sent Events instead of polling.
- Export a mission brief as PDF.
- Keyboard shortcuts overlay (`?`).
- Remember the last goal and the "write with an LLM" toggle in `localStorage`.

## Engineering

- Persist missions to SQLite and reload them on start.
- Playwright end-to-end test: type a goal on Headquarters, expect a completed brief (use a mocked upstream).
- Planner: handle lowercase and non-English place names.
- Add an `openapi.yaml` describing the runtime HTTP API.
- Publish multi-arch Docker images to GHCR from CI.

## Docs and community

- Translate the README (Spanish, Simplified Chinese, Hindi, Portuguese).
- A "build your own agent department" tutorial.
- A short screencast of the mission flow for the README.
