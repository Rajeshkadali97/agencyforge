# Provider Adapter Plan

This module includes scraping GitHub repositories as typed integration candidates. The core package does not execute them, scrape websites, call vendor APIs, or create leads directly from them during Sprint 1.

Future provider adapters may wrap approved tools only after legal, security, and product review. Each adapter must implement one of the interfaces in `src/*/interfaces.ts`, expose health checks, respect rate limits, and attach `SourceReference` evidence to every output.

## Candidate Sources

- ScrapeGraphAI: possible website intelligence and discovery adapter.
- yhat Scrape: possible website intelligence and discovery adapter.
- Google Maps Scraper: possible local business discovery adapter.
- AI Sales Team Claude: possible sales workflow reference adapter for discovery, scoring, proposal, and sequence planning.
- Agent Reach: possible discovery, scoring, outreach planning, and delivery adapter.
- Firecrawl: possible website audit and website intelligence adapter.
- OpenOutreach: possible outreach planning or delivery adapter.
- Deep Research: possible research and scoring adapter.
- LinkedIn and LinkedIn Sales Navigator: possible lead discovery and sequence planning adapters if API and terms permit the planned use.
- Apollo: possible lead discovery, enrichment, scoring, and sequence planning adapter.
- Instantly: possible outreach planning and delivery adapter.
- Auto Leads: possible lead discovery and scoring adapter.
- Messenger Flow: possible messaging sequence and delivery adapter.
- HighLevel: possible CRM sync, outreach planning, and delivery adapter.
- Fathom: possible meeting intelligence adapter for CRM sync and lead scoring signals.
- IGLeads.io: possible lead discovery and scoring adapter.
- GrowMeOrganic: possible lead discovery, scoring, and sequence planning adapter.
- D7 Lead Finder: possible lead discovery and scoring adapter.
- Clutch: possible lead discovery and scoring adapter.
- Gojiberry: possible lead discovery and scoring adapter.
- Vibe Prospecting: possible lead discovery, scoring, and sequence planning adapter.
- Proxmox VE Community Scripts: possible infrastructure automation reference, not a revenue data provider.
- Similar systems may be added as provider adapter definitions if their terms and APIs permit the planned use.

## Current Catalog Location

All candidate sources are listed in `src/shared/provider-catalog.ts` as `providerAdapterCandidates`. A candidate entry is not an implementation. It is a typed integration slot that records capability fit and compliance requirements.

All requested scraping GitHub repositories are also listed in `src/shared/provider-catalog.ts` as `scrapingGithubRepositories`.

## Adapter Rules

- Never expose vendor-specific records directly to downstream modules.
- Never create leads without source references and confidence.
- Never send outreach without channel policy and approval checks.
- Keep credentials outside this package.
- Put all API, scraping, crawling, and browser automation in adapter packages, not in the Revenue Engine core.
