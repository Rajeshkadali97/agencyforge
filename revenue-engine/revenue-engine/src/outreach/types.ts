import type { BusinessLead } from "../types/index.js";
import type { LeadScore } from "../lead-scoring/index.js";
import type { ProposalPackage } from "../proposal-generator/index.js";

export interface OutreachPlanRequest {
  readonly lead: BusinessLead;
  readonly score?: LeadScore;
  readonly proposal?: ProposalPackage;
  readonly channelPolicy: OutreachChannelPolicy;
  readonly providerId?: string;
  readonly traceId?: string;
}

export interface OutreachChannelPolicy {
  readonly allowedChannels: readonly OutreachChannel[];
  readonly maxTouches: number;
  readonly requireHumanApproval: boolean;
}

export type OutreachChannel = "email" | "phone" | "linkedin" | "instagram" | "sms" | "messenger";

export interface OutreachSequence {
  readonly leadId: string;
  readonly createdAt: Date;
  readonly steps: readonly OutreachStep[];
  readonly approvalRequired: boolean;
}

export interface OutreachStep {
  readonly id: string;
  readonly channel: OutreachChannel;
  readonly delayDays: number;
  readonly intent: string;
  readonly messageDraft?: MessageDraft;
}

export interface MessageDraft {
  readonly subject?: string;
  readonly body: string;
  readonly personalizationTokens: readonly string[];
  readonly complianceNotes: readonly string[];
}

export interface OutreachDeliveryRequest {
  readonly sequence: OutreachSequence;
  readonly approvedBy?: string;
  readonly providerId?: string;
  readonly traceId?: string;
}

export interface OutreachDeliveryResult {
  readonly leadId: string;
  readonly queuedAt: Date;
  readonly deliveryRefs: readonly OutreachDeliveryReference[];
}

export interface OutreachDeliveryReference {
  readonly providerId: string;
  readonly stepId: string;
  readonly externalId?: string;
  readonly status: OutreachDeliveryStatus;
}

export type OutreachDeliveryStatus =
  | "queued"
  | "blocked"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "replied"
  | "bounced"
  | "unsubscribed";

export interface OutreachTrackingRequest {
  readonly leadId: string;
  readonly providerId?: string;
  readonly externalIds?: readonly string[];
  readonly traceId?: string;
}

export interface OutreachTrackingResult {
  readonly leadId: string;
  readonly checkedAt: Date;
  readonly events: readonly OutreachTrackingEvent[];
  readonly nextFollowUpAt?: Date;
}

export interface OutreachTrackingEvent {
  readonly providerId: string;
  readonly externalId?: string;
  readonly stepId?: string;
  readonly status: OutreachDeliveryStatus;
  readonly occurredAt: Date;
  readonly metadata?: Record<string, string | number | boolean>;
}
