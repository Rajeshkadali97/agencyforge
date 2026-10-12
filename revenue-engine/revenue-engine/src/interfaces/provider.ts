import type { Result } from "../shared/result.js";

export interface Provider {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: readonly ProviderCapability[];
  healthCheck(): Promise<Result<ProviderHealth>>;
}

export type ProviderCapability =
  | "business.discovery"
  | "lead.extraction"
  | "lead.enrichment"
  | "lead.scoring"
  | "needs.analysis"
  | "website.audit"
  | "offer.pitch"
  | "proposal.generation"
  | "crm.sync"
  | "outreach.sequence"
  | "outreach.delivery"
  | "outreach.tracking"
  | "followup.scheduling"
  | "pipeline.orchestration";

export interface ProviderHealth {
  readonly status: "available" | "degraded" | "unavailable";
  readonly checkedAt: Date;
  readonly details?: string;
}
