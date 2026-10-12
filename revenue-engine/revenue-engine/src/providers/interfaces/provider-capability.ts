/**
 * ProviderCapability is a fine-grained capability token.
 * Providers expose the capabilities tokens they support;
 * the registry matches requests to compatible providers.
 */
export type ProviderCapability =
  // Discovery
  | "business.discovery"
  | "lead.extraction"
  | "lead.enrichment"
  | "lead.scoring"
  | "needs.analysis"
  // Website Analysis
  | "website.audit"
  | "website.scrape"
  // SEO
  | "seo.analysis"
  | "seo.report"
  // Technology Detection
  | "tech.detect"
  | "tech.stack"
  // Business Enrichment
  | "business.enrich"
  | "business.verify"
  // CRM
  | "crm.sync"
  | "crm.read"
  | "crm.write"
  // Outreach
  | "outreach.sequence"
  | "outreach.personalization"
  | "outreach.approval"
  | "outreach.delivery"
  | "outreach.tracking"
  | "followup.scheduling"
  // Proposal
  | "proposal.generation"
  | "proposal.template"
  // Analytics
  | "analytics.metrics"
  | "analytics.report"
  // Research
  | "research.company"
  | "research.market"
  // Content
  | "content.generate"
  | "content.script"
  | "content.storyboard"
  | "content.voice"
  | "content.image"
  | "content.video"
  | "content.thumbnail"
  // Publishing
  | "content.publish"
  // Growth
  | "growth.plan"
  | "growth.seo"
  | "growth.lead-magnet"
  | "growth.newsletter"
  | "growth.traffic"
  | "growth.analytics"
  // Pipeline
  | "pipeline.orchestration";

