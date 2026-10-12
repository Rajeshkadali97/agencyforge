import type { BusinessLead, ConsentState } from "../types/index.js";
import type { LeadScore } from "../lead-scoring/index.js";
import type { ProposalPackage } from "../proposal-generator/index.js";
import type { OutreachDeliveryResult, OutreachSequence } from "../outreach/index.js";
import type { RevenueServiceOffering } from "./service-offering.js";

export type LeadSourceId =
  | "google"
  | "google_maps"
  | "reddit"
  | "quora"
  | "instagram"
  | "facebook_ads"
  | "facebook"
  | "linkedin"
  | "apollo"
  | "instantly"
  | "auto_leads"
  | "messenger_flow";

export interface LeadSourcePolicy {
  readonly sourceId: LeadSourceId;
  readonly enabled: boolean;
  readonly allowedUse: "api_only" | "approved_scraper" | "manual_import" | "webhook";
  readonly minScanIntervalSeconds: number;
  readonly requiresTermsReview: boolean;
  readonly requiresConsentBeforeOutreach: boolean;
}

export interface ContinuousLeadScanPlan {
  readonly id: string;
  readonly sources: readonly LeadSourcePolicy[];
  readonly matchingRules: LeadMatchingRules;
  readonly cadence: LeadScanCadence;
  readonly deliveryPolicy: AutomatedDeliveryPolicy;
}

export interface LeadScanCadence {
  readonly requestedIntervalSeconds: number;
  readonly effectiveIntervalSeconds: number;
  readonly reason: string;
}

export interface LeadMatchingRules {
  readonly serviceKeywords: readonly string[];
  readonly serviceOfferings?: readonly RevenueServiceOffering[];
  readonly targetGeographies?: readonly string[];
  readonly targetIndustries?: readonly string[];
  readonly targetLocations?: readonly string[];
  readonly painSignals: readonly string[];
  readonly disqualifiers: readonly string[];
  readonly minimumScore: number;
}

export interface AutomatedDeliveryPolicy {
  readonly sendProposalOnMatch: boolean;
  readonly requireHumanApproval: boolean;
  readonly followUpAfterDays: number;
  readonly maxMessagesPerLead: number;
  readonly maxNewLeadsPerRun: number;
}

export interface ExtractedLeadProfile {
  readonly lead: BusinessLead;
  readonly sourceId: LeadSourceId;
  readonly extractedFields: readonly ExtractedLeadField[];
  readonly consent: ConsentState;
}

export interface ExtractedLeadField {
  readonly key: string;
  readonly value: string | number | boolean;
  readonly confidence: number;
  readonly sourceUrl?: string;
}

export interface LeadNeedsAnalysis {
  readonly leadId: string;
  readonly needs: readonly LeadNeed[];
  readonly urgency: "low" | "medium" | "high";
  readonly buyingSignals: readonly string[];
  readonly objections: readonly string[];
  readonly analyzedAt: Date;
}

export interface LeadNeed {
  readonly problem: string;
  readonly evidence: readonly string[];
  readonly businessImpact: string;
}

export interface OfferPitchStrategy {
  readonly leadId: string;
  readonly offerName: string;
  readonly problemWeSolve: readonly string[];
  readonly howWeSolveIt: readonly string[];
  readonly proofPoints: readonly string[];
  readonly forbiddenClaims: readonly string[];
}

export interface LeadPipelineRunRequest {
  readonly plan: ContinuousLeadScanPlan;
  readonly traceId?: string;
}

export interface LeadPipelineRunResult {
  readonly runId: string;
  readonly scannedAt: Date;
  readonly discoveredCount: number;
  readonly matchedCount: number;
  readonly processed: readonly ProcessedLeadOutcome[];
}

export interface ProcessedLeadOutcome {
  readonly leadId: string;
  readonly sourceId: LeadSourceId;
  readonly score?: LeadScore;
  readonly needs?: LeadNeedsAnalysis;
  readonly pitch?: OfferPitchStrategy;
  readonly proposal?: ProposalPackage;
  readonly outreachSequence?: OutreachSequence;
  readonly delivery?: OutreachDeliveryResult;
  readonly status: "matched" | "needs_review" | "proposal_ready" | "queued" | "sent" | "blocked";
  readonly blockers: readonly string[];
}
