# Getting started

From zero to a finished mission in about five minutes. No API keys, no accounts.

## 1. Install the prerequisites

| Tool | Version | Check | Install |
|---|---|---|---|
| Node.js | 20 or newer | `node -v` | <https://nodejs.org> or `nvm install 20` |
| pnpm | 10 | `pnpm -v` | `corepack enable` (ships with Node) |
| Git | any | `git --version` | <https://git-scm.com> |

Windows, macOS and Linux are supported. On Windows use PowerShell or Git Bash.

## 2. Get the code and build it

```bash
git clone https://github.com/Rajeshkadali97/agencyforge.git
cd agencyforge
pnpm install
pnpm build
```

`pnpm install` downloads dependencies and a prebuilt SQLite binding. `pnpm build` compiles every package and the dashboard (about two minutes the first time).

## 3. Check your machine

```bash
pnpm doctor
```

You should see a green tick for Node, pnpm, dependencies, both builds, the SQLite binding and the network. Notes about ports, `.env` and the optional 9Router gateway are fine to ignore.

## 4. Start the stack

Open two terminals in the repository folder.

```bash
pnpm start:runtime
```

Wait for `RuntimeBridge: HTTP server listening on port 3001`. In the second terminal:

```bash
pnpm start:dashboard
```

Open <http://localhost:3000>.

## 5. Run your first mission

1. On **Headquarters** type a goal, for example: `Plan an outdoor coffee pop-up launch in Lisbon and check the weather`.
2. Press **Launch**. You land on **Missions** and watch the four stages complete.
3. Read the brief. Press **Copy as Markdown** to paste it anywhere.

Prefer the command line?

```bash
curl -X POST http://localhost:3001/api/runtime/missions \
  -H "Content-Type: application/json" \
  -d '{"goal":"Research the dental clinic market in Germany and brief me on tech trends"}'
```

## 6. Optional: let an LLM plan and write

Without a model, rules plan the mission and a template writes the brief. Both are labelled in the UI. To use a model, pick one:

- **Free gateway:** run `npx 9router` (listens on `localhost:20128`). No change to AgencyForge is needed.
- **Local model:** run [Ollama](https://ollama.ai) on its default port.
- **Cloud key:** copy `.env.example` to `.env` and set `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `NIM_API_KEY`, `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`, then restart the runtime.

Open **AI Routing** in the dashboard to see which provider answers.

## 7. Where things are saved

Set `AGENCYFORGE_DB_PATH` (for example `./data/agencyforge.db`) and the runtime keeps events, memory and **missions** in that SQLite file across restarts. Without it everything lives in memory.

## Run with Docker instead

```bash
docker compose up --build
```

Then open <http://localhost:3000>. The compose file builds both images from the repository root and keeps the database in a named volume.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `pnpm: command not found` | Run `corepack enable`, then reopen the terminal |
| `Could not locate the bindings file` (better-sqlite3) | Run `pnpm rebuild better-sqlite3`. Make sure Node is 20 or newer |
| `EADDRINUSE` on port 3000, 3001 or 3002 | Something else uses the port. Stop it, or change ports: `RUNTIME_PORT` and `HEALTH_PORT` for the runtime, `PORT` for the dashboard (and point `RUNTIME_URL` at the new runtime port) |
| Dashboard shows "Runtime offline" | Start `pnpm start:runtime`. Check `curl http://localhost:3001/health` |
| Missions fail with "Every tool call failed" | The machine has no internet access to the public APIs. Check your proxy or firewall |
| Dashboard shows 401 or 502 on missions | `RUNTIME_API_KEY` is set on the runtime but not in the dashboard server environment. Set the same value in both |
| `pnpm build` fails on `next build` | Delete `dashboard/.next` and rebuild. Confirm Node 20 or newer |

Still stuck? Run `pnpm doctor` and open an issue with its output (it contains no secrets).

## Next steps

- [How missions work](MISSIONS.md) and how to add your own tool
- [API Explorer and catalog](API_CATALOG.md)
- [Architecture](architecture/README.md)
- [Responsible use](RESPONSIBLE_USE.md)
- [Contributing](../CONTRIBUTING.md)
