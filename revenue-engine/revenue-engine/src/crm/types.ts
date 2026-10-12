import type { BusinessLead, CrmActivity, CrmContact, CrmDeal } from "../types/index.js";
import type { LeadScore } from "../lead-scoring/index.js";
import type { ProposalPackage } from "../proposal-generator/index.js";
import type { WebsiteAuditReport } from "../website-audit/index.js";

export interface CrmSyncRequest {
  readonly lead: BusinessLead;
  readonly score?: LeadScore;
  readonly websiteAudit?: WebsiteAuditReport;
  readonly proposal?: ProposalPackage;
  readonly providerId?: string;
  readonly traceId?: string;
}

export interface CrmSyncResult {
  readonly leadId: string;
  readonly syncedAt: Date;
  readonly contact?: CrmContact;
  readonly deal?: CrmDeal;
  readonly activities: readonly CrmActivity[];
  readonly externalRefs: readonly CrmExternalReference[];
}

export interface CrmExternalReference {
  readonly providerId: string;
  readonly objectType: "contact" | "company" | "deal" | "activity";
  readonly externalId: string;
  readonly externalUrl?: string;
}
