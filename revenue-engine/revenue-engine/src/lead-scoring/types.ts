import type { BusinessLead } from "../types/index.js";

export interface LeadScoringRequest {
  readonly lead: BusinessLead;
  readonly modelId?: string;
  readonly context?: LeadScoringContext;
  readonly traceId?: string;
}

export interface LeadScoringContext {
  readonly targetIndustries?: readonly string[];
  readonly targetLocations?: readonly string[];
  readonly idealSignals?: readonly string[];
  readonly disqualifyingSignals?: readonly string[];
}

export interface LeadScore {
  readonly leadId: string;
  readonly score: number;
  readonly grade: LeadGrade;
  readonly confidence: number;
  readonly factors: readonly LeadScoreFactor[];
  readonly recommendedNextAction: LeadNextAction;
  readonly scoredAt: Date;
}

export type LeadGrade = "A" | "B" | "C" | "D" | "unqualified";

export interface LeadScoreFactor {
  readonly key: string;
  readonly label: string;
  readonly impact: "positive" | "neutral" | "negative";
  readonly weight: number;
  readonly evidence: readonly string[];
}

export type LeadNextAction =
  | "audit_website"
  | "prepare_proposal"
  | "enrich_contact"
  | "send_to_crm"
  | "discard";
