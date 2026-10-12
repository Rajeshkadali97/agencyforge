# Scraping GitHub Repositories

These repositories are now part of the Revenue Engine integration map in the user's requested order. They are assigned to future adapter packages; core Revenue Engine contracts stay modular and provider-based.

| Repository | Adapter Candidate | Revenue Engine Use |
| --- | --- | --- |
| https://github.com/community-scripts/ProxmoxVE | `proxmox-community-scripts` | Infrastructure automation reference for adapter hosting |
| https://github.com/ScrapeGraphAI/Scrapegraph-ai | `scrapegraph-ai` | Business discovery, website audit |
| https://github.com/yhat/scrape | `yhat-scrape` | Business discovery, website audit |
| https://github.com/omkarcloud/google-maps-scraper | `google-maps-scraper` | Business discovery |
| https://github.com/eracle/OpenOutreach | `openoutreach` | Outreach planning, outreach delivery |
| https://github.com/zubair-trabzada/ai-sales-team-claude | `ai-sales-team-claude` | Discovery, scoring, proposal generation, outreach planning |
| https://github.com/firecrawl/firecrawl | `firecrawl` | Business discovery, website audit |
| https://github.com/dzhng/deep-research | `deep-research` | Business discovery, lead scoring |
| https://github.com/Panniantong/Agent-Reach | `agent-reach` | Discovery, scoring, outreach planning, outreach delivery |

## Boundary

Each repository must be wrapped by a provider adapter before it can affect leads, scores, audits, proposals, CRM records, outreach sequences, or dashboard outputs. Adapter packages must enforce terms review, rate limits, consent rules, source references, and data retention policy before producing Revenue Engine outputs.
