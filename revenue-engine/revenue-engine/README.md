# Revenue Engine

Sprint 1 creates the architecture only. This module does not implement APIs, run scraping jobs, ship UI, or depend on fake business data.

The Revenue Engine is designed as a provider-based pipeline:

1. `business-discovery` accepts discovery criteria and delegates sourcing to compliant provider adapters.
2. `lead-scoring` scores discovered businesses using explicit scoring models and evidence.
3. `website-audit` describes audit inputs and outputs for future compliant crawl, performance, SEO, and conversion providers.
4. `proposal-generator` turns verified lead, score, and audit context into proposal briefs for Sales Agent and Creative Director workflows.
5. `crm` defines persistence and synchronization boundaries for CRM systems.
6. `outreach` defines campaign, sequence, and message delivery contracts without sending anything.
7. `lead-pipeline` coordinates continuous source discovery, extraction, needs analysis, proposal creation, outreach tracking, and follow-up scheduling through providers.

The target market is global: all industries, all domains, and businesses that need premium websites, 3D/cinematic web experiences, mobile apps, web apps, custom software, agents, agentic business ecosystems, video editing, social media growth, SEO, website SEO, and GMB management.

External sources such as Firecrawl, ScrapeGraphAI, Google Maps, Apollo, LinkedIn, Instantly, Clutch, D7 Lead Finder, HighLevel, and similar systems belong behind provider adapters. Scraping GitHub repositories are part of the Revenue Engine integration map as typed catalog entries, but they are not executed by the core module.

## Boundaries

- No UI.
- No AgencyForge kernel/dashboard changes.
- No live API implementation.
- Scraping repositories may be added as provider adapter candidates and GitHub manifests.
- No runtime scraping, crawling, browser automation, or vendor API calls in the core module.
- No seeded or fake business data.
- SOLID-first interfaces and services.

## Downstream Consumers

The output contracts are shaped so future services can feed:

- Sales Agent
- Creative Director
- Website Builder
- CRM
- Dashboard
