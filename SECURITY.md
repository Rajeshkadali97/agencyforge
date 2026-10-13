# Security Policy

## Supported versions

AgencyForge is pre-1.0. Security fixes land on the latest `main` and the most recent tagged release.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Use GitHub's private vulnerability reporting: go to the **Security** tab of this repository and choose **Report a vulnerability**. Include:

- a description of the issue and its impact,
- steps or a proof of concept to reproduce it,
- affected versions or commits, if known.

You can expect an acknowledgement within 72 hours and a status update within 7 days.

## Handling secrets

- Secrets are read from environment variables only. Never commit `.env` files or API keys.
- `.env.example` documents every variable and must contain empty values only.
- CI runs a secret scan (gitleaks) on every push and pull request.
- If you believe a secret was committed, rotate it first, then report it.

## Hardening checklist for deployments

- Set `RUNTIME_API_KEY` so every non-public runtime endpoint requires a bearer token. Give the same value to the dashboard server (env `RUNTIME_API_KEY`, never `NEXT_PUBLIC_`): the dashboard proxies runtime calls and attaches the key server-side, so the browser never holds it.
- The dashboard talks to the runtime through same-origin server routes (including the event stream), so browsers never call the runtime directly. In production set `CORS_ORIGIN` to your dashboard origin, or leave it empty, instead of `*`.
- Keep the health server (`:3002`) on loopback or behind your network boundary.
- Back up and protect the SQLite file at `AGENCYFORGE_DB_PATH`; it can contain business data.
