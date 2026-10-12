# Responsible use

AgencyForge automates research and outreach work. Automation raises the stakes of getting the basics wrong, so this page is short and direct.

## What the software does by default

- Missions call a small set of public, key-less APIs over HTTPS (Wikipedia, Open-Meteo, World Bank, Hacker News).
- No personal data is collected, and no outreach is sent. Nothing is emailed, posted or scraped by default.
- Requests identify themselves with an `AgencyForge` user agent.
- Secrets are read from environment variables only and are never written to disk by the project.

## Your responsibilities

- **Terms of service.** Using an API does not override its terms. Read them and respect rate limits. Do not use the lead-sourcing adapters (Apollo, LinkedIn, Google Maps) in ways their terms forbid.
- **Outreach law.** If you build outreach on top of the revenue engine, you are responsible for compliance with laws such as CAN-SPAM, GDPR/ePrivacy and CASL: lawful basis or consent, clear sender identity, a working opt-out, and honouring it.
- **Human approval.** Keep a person in the loop for anything sent to third parties. The runtime exposes approval gates (`POST /api/runtime/approve`) for exactly this reason.
- **Accuracy.** LLM-written briefs can be wrong. The default template writer only repeats tool output, and every brief lists its sources. Check facts before acting on them.
- **Security.** Set `RUNTIME_API_KEY` and `CORS_ORIGIN` before exposing the runtime beyond localhost.

## Reporting problems

Security issues: see [SECURITY.md](../SECURITY.md). Misuse concerns about the project itself can be raised through a private security advisory.
