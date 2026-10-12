# Lead Operating Pipeline

The Revenue Engine is capable of coordinating a full lead operating loop through provider adapters.

## Target

The target profile is international leads across all domains, industries, and business types. The engine is optimized to match demand against these services:

- Website development for cinematic websites, Awwwards-style websites, 3D websites, and all business website types.
- Mobile apps, web apps, custom software, internal tools, and SaaS-style products.
- Agents, business agents, and agentic ecosystems for business operations.
- Video editing and creative production.
- Social media marketing, management, and promotions.
- SEO, website SEO, local SEO, and GMB management.

The typed offer catalog lives in `src/lead-pipeline/service-offering.ts`.

## Sources

The lead pipeline supports typed source IDs for:

- Google
- Google Maps
- Reddit
- Quora
- Instagram
- Facebook Ads
- Facebook
- LinkedIn
- Apollo
- Instantly
- Auto Leads
- Messenger Flow

Each source must be provided by a `LeadExtractionProvider`. A provider may use an official API, adapter package, manual import, or webhook, depending on the source policy.

## Flow

1. Discover fresh leads from enabled sources.
2. Extract structured lead profiles, source references, contacts, signals, and consent state.
3. Score leads against the service match rules.
4. Analyze needs from observed pain signals and source evidence.
5. Create an offer pitch strategy explaining what we solve and how we solve it.
6. Generate a proposal package and creative email sequence.
7. Deliver only when channel policy and approval requirements allow it.
8. Track delivery status, replies, bounces, opens, and clicks through outreach providers.
9. Schedule a follow-up after one week by default.
10. Feed status back into CRM and future Revenue Engine decisions.

## Cadence

The user-facing goal can be "find new leads continuously." Real-time discovery should be handled by streaming or webhook providers where available. Polling cadence is controlled per source provider so international discovery can scale without duplicate processing or platform account damage.

## Operating Rules

- No proposal is sent without consent state and channel policy.
- Human approval is required by default for proposal delivery.
- Follow-ups are scheduled, not sent blindly.
- Every generated email must include source evidence, problem framing, and compliance notes.
