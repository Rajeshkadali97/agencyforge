import type { ProviderCapability } from "../interfaces/index.js";

export interface ProviderAdapterDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly category: ProviderAdapterCategory;
  readonly homepageUrl?: string;
  readonly capabilities: readonly ProviderCapability[];
  readonly complianceRequirements: readonly ComplianceRequirement[];
  readonly implementationStatus: "candidate" | "planned" | "implemented";
}

export interface ScrapingGithubRepositoryDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly repositoryUrl: string;
  readonly adapterCandidateId: string;
  readonly intendedUse: readonly ProviderCapability[];
  readonly executionBoundary: "catalog_only" | "adapter_package";
  readonly notes: string;
}

export type ProviderAdapterCategory =
  | "open_source_repo"
  | "search_engine"
  | "social_media"
  | "ads"
  | "lead_database"
  | "crm"
  | "outreach"
  | "website_intelligence"
  | "research"
  | "meeting_intelligence"
  | "infrastructure";

export type ComplianceRequirement =
  | "terms_review_required"
  | "api_key_required"
  | "rate_limits_required"
  | "consent_required"
  | "anti_spam_policy_required"
  | "robots_policy_review_required"
  | "data_retention_policy_required"
  | "human_approval_required";

export const providerAdapterCandidates: readonly ProviderAdapterDefinition[] = [
  {
    id: "google-search",
    displayName: "Google Search",
    category: "search_engine",
    homepageUrl: "https://www.google.com/search",
    capabilities: ["business.discovery", "lead.extraction", "lead.enrichment", "needs.analysis"],
    complianceRequirements: ["terms_review_required", "api_key_required", "rate_limits_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "google-maps",
    displayName: "Google Maps",
    category: "lead_database",
    homepageUrl: "https://www.google.com/maps",
    capabilities: ["business.discovery", "lead.extraction", "lead.enrichment"],
    complianceRequirements: ["terms_review_required", "api_key_required", "rate_limits_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "reddit",
    displayName: "Reddit",
    category: "social_media",
    homepageUrl: "https://www.reddit.com",
    capabilities: ["business.discovery", "lead.extraction", "needs.analysis"],
    complianceRequirements: ["terms_review_required", "api_key_required", "rate_limits_required", "consent_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "quora",
    displayName: "Quora",
    category: "social_media",
    homepageUrl: "https://www.quora.com",
    capabilities: ["business.discovery", "lead.extraction", "needs.analysis"],
    complianceRequirements: ["terms_review_required", "rate_limits_required", "consent_required", "robots_policy_review_required"],
    implementationStatus: "candidate"
  },
  {
    id: "instagram",
    displayName: "Instagram",
    category: "social_media",
    homepageUrl: "https://www.instagram.com",
    capabilities: ["business.discovery", "lead.extraction", "lead.enrichment", "outreach.sequence"],
    complianceRequirements: ["terms_review_required", "api_key_required", "consent_required", "anti_spam_policy_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "facebook-ads",
    displayName: "Facebook Ads",
    category: "ads",
    homepageUrl: "https://www.facebook.com/business/ads",
    capabilities: ["business.discovery", "lead.extraction", "lead.scoring", "needs.analysis"],
    complianceRequirements: ["terms_review_required", "api_key_required", "consent_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "facebook",
    displayName: "Facebook",
    category: "social_media",
    homepageUrl: "https://www.facebook.com",
    capabilities: ["business.discovery", "lead.extraction", "lead.enrichment", "outreach.sequence"],
    complianceRequirements: ["terms_review_required", "api_key_required", "consent_required", "anti_spam_policy_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "scrapegraph-ai",
    displayName: "ScrapeGraphAI",
    category: "open_source_repo",
    homepageUrl: "https://github.com/ScrapeGraphAI/Scrapegraph-ai",
    capabilities: ["website.audit", "business.discovery"],
    complianceRequirements: ["terms_review_required", "rate_limits_required", "robots_policy_review_required"],
    implementationStatus: "candidate"
  },
  {
    id: "yhat-scrape",
    displayName: "yhat Scrape",
    category: "open_source_repo",
    homepageUrl: "https://github.com/yhat/scrape",
    capabilities: ["business.discovery", "website.audit"],
    complianceRequirements: ["terms_review_required", "rate_limits_required", "robots_policy_review_required"],
    implementationStatus: "candidate"
  },
  {
    id: "google-maps-scraper",
    displayName: "Google Maps Scraper",
    category: "open_source_repo",
    homepageUrl: "https://github.com/omkarcloud/google-maps-scraper",
    capabilities: ["business.discovery"],
    complianceRequirements: ["terms_review_required", "rate_limits_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "openoutreach",
    displayName: "OpenOutreach",
    category: "outreach",
    homepageUrl: "https://github.com/eracle/OpenOutreach",
    capabilities: ["outreach.sequence", "outreach.delivery"],
    complianceRequirements: ["consent_required", "human_approval_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "ai-sales-team-claude",
    displayName: "AI Sales Team Claude",
    category: "open_source_repo",
    homepageUrl: "https://github.com/zubair-trabzada/ai-sales-team-claude",
    capabilities: ["business.discovery", "lead.scoring", "proposal.generation", "outreach.sequence"],
    complianceRequirements: ["terms_review_required", "consent_required", "human_approval_required"],
    implementationStatus: "candidate"
  },
  {
    id: "firecrawl",
    displayName: "Firecrawl",
    category: "website_intelligence",
    homepageUrl: "https://github.com/firecrawl/firecrawl",
    capabilities: ["website.audit", "business.discovery"],
    complianceRequirements: ["api_key_required", "terms_review_required", "robots_policy_review_required"],
    implementationStatus: "candidate"
  },
  {
    id: "deep-research",
    displayName: "Deep Research",
    category: "research",
    homepageUrl: "https://github.com/dzhng/deep-research",
    capabilities: ["business.discovery", "lead.scoring"],
    complianceRequirements: ["terms_review_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "agent-reach",
    displayName: "Agent Reach",
    category: "outreach",
    homepageUrl: "https://github.com/Panniantong/Agent-Reach",
    capabilities: ["business.discovery", "lead.scoring", "outreach.sequence", "outreach.delivery"],
    complianceRequirements: ["terms_review_required", "consent_required", "human_approval_required"],
    implementationStatus: "candidate"
  },
  {
    id: "linkedin",
    displayName: "LinkedIn",
    category: "social_media",
    homepageUrl: "https://www.linkedin.com",
    capabilities: ["business.discovery", "lead.extraction", "lead.enrichment", "needs.analysis", "outreach.sequence"],
    complianceRequirements: ["terms_review_required", "api_key_required", "consent_required", "anti_spam_policy_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "linkedin-sales-navigator",
    displayName: "LinkedIn Sales Navigator",
    category: "lead_database",
    homepageUrl: "https://business.linkedin.com/sales-solutions/sales-navigator",
    capabilities: ["business.discovery", "lead.extraction", "lead.enrichment", "lead.scoring", "needs.analysis", "outreach.sequence"],
    complianceRequirements: ["terms_review_required", "api_key_required", "consent_required", "anti_spam_policy_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "apollo",
    displayName: "Apollo",
    category: "lead_database",
    homepageUrl: "https://www.apollo.io",
    capabilities: ["business.discovery", "lead.extraction", "lead.enrichment", "lead.scoring", "needs.analysis", "outreach.sequence", "outreach.tracking"],
    complianceRequirements: ["terms_review_required", "api_key_required", "consent_required", "anti_spam_policy_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "instantly",
    displayName: "Instantly",
    category: "outreach",
    homepageUrl: "https://instantly.ai",
    capabilities: ["outreach.sequence", "outreach.delivery", "outreach.tracking", "followup.scheduling"],
    complianceRequirements: ["terms_review_required", "api_key_required", "consent_required", "anti_spam_policy_required", "human_approval_required"],
    implementationStatus: "candidate"
  },
  {
    id: "auto-leads",
    displayName: "Auto Leads",
    category: "lead_database",
    capabilities: ["business.discovery", "lead.extraction", "lead.enrichment", "lead.scoring", "needs.analysis"],
    complianceRequirements: ["terms_review_required", "api_key_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "messenger-flow",
    displayName: "Messenger Flow",
    category: "outreach",
    capabilities: ["outreach.sequence", "outreach.delivery", "outreach.tracking", "followup.scheduling"],
    complianceRequirements: ["terms_review_required", "consent_required", "anti_spam_policy_required", "human_approval_required"],
    implementationStatus: "candidate"
  },
  {
    id: "highlevel",
    displayName: "HighLevel",
    category: "crm",
    homepageUrl: "https://www.gohighlevel.com",
    capabilities: ["crm.sync", "outreach.sequence", "outreach.delivery"],
    complianceRequirements: ["terms_review_required", "api_key_required", "consent_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "fathom",
    displayName: "Fathom",
    category: "meeting_intelligence",
    homepageUrl: "https://fathom.video",
    capabilities: ["crm.sync", "lead.scoring"],
    complianceRequirements: ["terms_review_required", "api_key_required", "consent_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "igleads",
    displayName: "IGLeads.io",
    category: "lead_database",
    homepageUrl: "https://igleads.io",
    capabilities: ["business.discovery", "lead.scoring"],
    complianceRequirements: ["terms_review_required", "api_key_required", "consent_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "growmeorganic",
    displayName: "GrowMeOrganic",
    category: "lead_database",
    homepageUrl: "https://www.growmeorganic.com",
    capabilities: ["business.discovery", "lead.scoring", "outreach.sequence"],
    complianceRequirements: ["terms_review_required", "api_key_required", "consent_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "d7-lead-finder",
    displayName: "D7 Lead Finder",
    category: "lead_database",
    homepageUrl: "https://d7leadfinder.com",
    capabilities: ["business.discovery", "lead.scoring"],
    complianceRequirements: ["terms_review_required", "api_key_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "clutch",
    displayName: "Clutch",
    category: "lead_database",
    homepageUrl: "https://clutch.co",
    capabilities: ["business.discovery", "lead.scoring"],
    complianceRequirements: ["terms_review_required", "rate_limits_required", "robots_policy_review_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "gojiberry",
    displayName: "Gojiberry",
    category: "lead_database",
    capabilities: ["business.discovery", "lead.scoring"],
    complianceRequirements: ["terms_review_required", "api_key_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "vibe-prospecting",
    displayName: "Vibe Prospecting",
    category: "lead_database",
    capabilities: ["business.discovery", "lead.scoring", "outreach.sequence"],
    complianceRequirements: ["terms_review_required", "api_key_required", "consent_required", "data_retention_policy_required"],
    implementationStatus: "candidate"
  },
  {
    id: "proxmox-community-scripts",
    displayName: "Proxmox VE Community Scripts",
    category: "infrastructure",
    homepageUrl: "https://github.com/community-scripts/ProxmoxVE",
    capabilities: [],
    complianceRequirements: ["terms_review_required"],
    implementationStatus: "candidate"
  }
];

export const scrapingGithubRepositories: readonly ScrapingGithubRepositoryDefinition[] = [
  {
    id: "proxmox-community-scripts",
    displayName: "Proxmox VE Community Scripts",
    repositoryUrl: "https://github.com/community-scripts/ProxmoxVE",
    adapterCandidateId: "proxmox-community-scripts",
    intendedUse: [],
    executionBoundary: "adapter_package",
    notes: "Infrastructure automation reference for hosting and operating adapter packages; not a lead source, scraper, CRM, or outreach provider."
  },
  {
    id: "scrapegraph-ai",
    displayName: "ScrapeGraphAI",
    repositoryUrl: "https://github.com/ScrapeGraphAI/Scrapegraph-ai",
    adapterCandidateId: "scrapegraph-ai",
    intendedUse: ["business.discovery", "website.audit"],
    executionBoundary: "adapter_package",
    notes: "Candidate adapter for graph-based website extraction and structured discovery workflows."
  },
  {
    id: "yhat-scrape",
    displayName: "yhat Scrape",
    repositoryUrl: "https://github.com/yhat/scrape",
    adapterCandidateId: "yhat-scrape",
    intendedUse: ["business.discovery", "website.audit"],
    executionBoundary: "adapter_package",
    notes: "Candidate adapter reference for scraping pipeline patterns."
  },
  {
    id: "google-maps-scraper",
    displayName: "Google Maps Scraper",
    repositoryUrl: "https://github.com/omkarcloud/google-maps-scraper",
    adapterCandidateId: "google-maps-scraper",
    intendedUse: ["business.discovery"],
    executionBoundary: "adapter_package",
    notes: "Candidate local business discovery source after terms, consent, and retention review."
  },
  {
    id: "openoutreach",
    displayName: "OpenOutreach",
    repositoryUrl: "https://github.com/eracle/OpenOutreach",
    adapterCandidateId: "openoutreach",
    intendedUse: ["outreach.sequence", "outreach.delivery"],
    executionBoundary: "adapter_package",
    notes: "Candidate outreach workflow reference for sequence planning and delivery adapters."
  },
  {
    id: "ai-sales-team-claude",
    displayName: "AI Sales Team Claude",
    repositoryUrl: "https://github.com/zubair-trabzada/ai-sales-team-claude",
    adapterCandidateId: "ai-sales-team-claude",
    intendedUse: ["business.discovery", "lead.scoring", "proposal.generation", "outreach.sequence"],
    executionBoundary: "adapter_package",
    notes: "Candidate sales-agent workflow reference for provider orchestration patterns."
  },
  {
    id: "firecrawl",
    displayName: "Firecrawl",
    repositoryUrl: "https://github.com/firecrawl/firecrawl",
    adapterCandidateId: "firecrawl",
    intendedUse: ["business.discovery", "website.audit"],
    executionBoundary: "adapter_package",
    notes: "Candidate website crawl and extraction provider for compliant website intelligence."
  },
  {
    id: "deep-research",
    displayName: "Deep Research",
    repositoryUrl: "https://github.com/dzhng/deep-research",
    adapterCandidateId: "deep-research",
    intendedUse: ["business.discovery", "lead.scoring"],
    executionBoundary: "adapter_package",
    notes: "Candidate research orchestration reference for discovery enrichment and scoring evidence."
  },
  {
    id: "agent-reach",
    displayName: "Agent Reach",
    repositoryUrl: "https://github.com/Panniantong/Agent-Reach",
    adapterCandidateId: "agent-reach",
    intendedUse: ["business.discovery", "lead.scoring", "outreach.sequence", "outreach.delivery"],
    executionBoundary: "adapter_package",
    notes: "Candidate reach and outbound workflow reference for discovery-to-outreach adapters."
  }
];
