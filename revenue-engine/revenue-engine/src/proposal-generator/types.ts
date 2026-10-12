import type { BusinessLead } from "../types/index.js";
import type { LeadScore } from "../lead-scoring/index.js";
import type { WebsiteAuditReport } from "../website-audit/index.js";

export interface ProposalGenerationRequest {
  readonly lead: BusinessLead;
  readonly score?: LeadScore;
  readonly websiteAudit?: WebsiteAuditReport;
  readonly offerCatalogId?: string;
  readonly providerId?: string;
  readonly traceId?: string;
}

export interface ProposalPackage {
  readonly leadId: string;
  readonly generatedAt: Date;
  readonly salesBrief: SalesAgentBrief;
  readonly creativeBrief: CreativeDirectorBrief;
  readonly proposalOutline: ProposalOutline;
}

export interface SalesAgentBrief {
  readonly openingAngle: string;
  readonly painPoints: readonly string[];
  readonly qualificationNotes: readonly string[];
  readonly suggestedNextStep: string;
}

export interface CreativeDirectorBrief {
  readonly brandObservations: readonly string[];
  readonly creativeOpportunities: readonly string[];
  readonly websiteRecommendations: readonly string[];
}

export interface ProposalOutline {
  readonly title: string;
  readonly sections: readonly ProposalSection[];
  readonly assumptions: readonly string[];
  readonly missingInputs: readonly string[];
}

export interface ProposalSection {
  readonly heading: string;
  readonly intent: string;
  readonly sourceEvidence: readonly string[];
}
