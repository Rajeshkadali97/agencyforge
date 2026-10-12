import type { BusinessLead } from "../types/index.js";

export interface WebsiteAuditRequest {
  readonly lead: BusinessLead;
  readonly auditDepth: WebsiteAuditDepth;
  readonly providerId?: string;
  readonly traceId?: string;
}

export type WebsiteAuditDepth = "snapshot" | "standard" | "comprehensive";

export interface WebsiteAuditReport {
  readonly leadId: string;
  readonly auditedUrl: string;
  readonly auditedAt: Date;
  readonly summary: WebsiteAuditSummary;
  readonly findings: readonly WebsiteAuditFinding[];
  readonly opportunities: readonly WebsiteOpportunity[];
  readonly downstreamBrief: WebsiteBuilderBrief;
}

export interface WebsiteAuditSummary {
  readonly overallScore?: number;
  readonly positioning?: string;
  readonly primaryIssues: readonly string[];
}

export interface WebsiteAuditFinding {
  readonly category: "performance" | "seo" | "copy" | "conversion" | "accessibility" | "trust" | "technical";
  readonly severity: "info" | "low" | "medium" | "high" | "critical";
  readonly title: string;
  readonly description: string;
  readonly evidence: readonly string[];
}

export interface WebsiteOpportunity {
  readonly title: string;
  readonly businessImpact: string;
  readonly recommendedOwner: "sales_agent" | "creative_director" | "website_builder" | "crm";
}

export interface WebsiteBuilderBrief {
  readonly leadId: string;
  readonly currentWebsiteUrl?: string;
  readonly suggestedPages: readonly string[];
  readonly conversionGoals: readonly string[];
  readonly brandNotes: readonly string[];
}
