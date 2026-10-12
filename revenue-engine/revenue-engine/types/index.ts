/**
 * Core Domain Types
 * Pure data shapes shared across all revenue engine modules.
 * No implementations, no dependencies on external libs.
 */

import type { EntityId } from '../shared';

// ─── Base Audit Entity ───
export interface Auditable {
  id: EntityId;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: EntityId;
}

// ─── Business ───
export const BusinessStatus = {
  DISCOVERED: 'discovered',
  QUALIFIED: 'qualified',
  ENGAGED: 'engaged',
  CUSTOMER: 'customer',
  LOST: 'lost',
} as const;
export type BusinessStatus = (typeof BusinessStatus)[keyof typeof BusinessStatus];

export interface Business extends Auditable {
  name: string;
  domain: string;
  industry: string;
  size: BusinessSize;
  location: GeoLocation;
  contacts: Contact[];
  status: BusinessStatus;
  metadata: Record<string, unknown>;
}

export const BusinessSize = {
  SOLO: '1-10',
  SMALL: '11-50',
  MID: '51-200',
  LARGE: '201-1000',
  ENTERPRISE: '1000+',
} as const;
export type BusinessSize = (typeof BusinessSize)[keyof typeof BusinessSize];

export interface GeoLocation {
  city?: string;
  region?: string;
  country: string;
  postalCode?: string;
}

// ─── Contact ───
export interface Contact extends Auditable {
  businessId: EntityId;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role: string;
  isPrimary: boolean;
}

// ─── Lead Source (scraper-integrated) ───
export const LeadSource = {
  DISCOVERY: 'discovery',
  INBOUND: 'inbound',
  REFERRAL: 'referral',
  PARTNER: 'partner',
  MANUAL: 'manual',
  WEB_SCRAPER: 'web_scraper',
  LINKEDIN: 'linkedin',
  LINKEDIN_SALES_NAV: 'linkedin_sales_navigator',
  APOLLO: 'apollo',
  INSTANTLY: 'instantly',
  GOOGLE_MAPS: 'google_maps',
  CLUTCH: 'clutch',
  INSTAGRAM: 'instagram',
  FACEBOOK: 'facebook',
  MESSENGER: 'messenger',
  DIRECTORY: 'directory',
  AI_GENERATED: 'ai_generated',
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];

export const LeadStage = {
  NEW: 'new',
  CONTACTED: 'contacted',
  QUALIFIED: 'qualified',
  PROPOSAL: 'proposal',
  NEGOTIATION: 'negotiation',
  CLOSED_WON: 'closed_won',
  CLOSED_LOST: 'closed_lost',
} as const;
export type LeadStage = (typeof LeadStage)[keyof typeof LeadStage];

export interface Lead extends Auditable {
  businessId: EntityId;
  source: LeadSource;
  stage: LeadStage;
  score: number; // 0-100
  assignedTo?: EntityId;
  lastActivityAt?: Date;
  tags: string[];
}

// ─── Website Audit ───
export interface WebsiteAudit extends Auditable {
  businessId: EntityId;
  url: string;
  summary: AuditSummary;
  categories: AuditCategory[];
  recommendations: Recommendation[];
}

export interface AuditSummary {
  overallScore: number; // 0-100
  grade: AuditGrade;
  issuesCount: number;
  criticalIssues: number;
}

export const AuditGrade = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  F: 'F',
} as const;
export type AuditGrade = (typeof AuditGrade)[keyof typeof AuditGrade];

export interface AuditCategory {
  name: string;
  score: number;
  weight: number;
  checks: AuditCheck[];
}

export interface AuditCheck {
  name: string;
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
  details?: string;
}

export interface Recommendation {
  id: EntityId;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  category: string;
}

// ─── Proposal ───
export interface Proposal extends Auditable {
  leadId: EntityId;
  businessId: EntityId;
  title: string;
  status: ProposalStatus;
  sections: ProposalSection[];
  pricing: PricingTier[];
  totalValue: number;
  currency: string;
  validUntil: Date;
}

export const ProposalStatus = {
  DRAFT: 'draft',
  SENT: 'sent',
  VIEWED: 'viewed',
  NEGOTIATING: 'negotiating',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
} as const;
export type ProposalStatus = (typeof ProposalStatus)[keyof typeof ProposalStatus];

export interface ProposalSection {
  title: string;
  content: string;
  type: 'text' | 'audit_summary' | 'pricing' | 'timeline' | 'testimonials';
}

export interface PricingTier {
  name: string;
  description: string;
  monthlyPrice: number;
  setupFee?: number;
  features: string[];
  isRecommended: boolean;
}

// ─── CRM Record ───
export interface CRMRecord extends Auditable {
  businessId: EntityId;
  leadId?: EntityId;
  stage: LeadStage;
  interactions: Interaction[];
  notes: Note[];
  customFields: Record<string, unknown>;
}

export interface Interaction extends Auditable {
  type: InteractionType;
  direction: 'inbound' | 'outbound';
  content: string;
  metadata: Record<string, unknown>;
}

export const InteractionType = {
  EMAIL: 'email',
  CALL: 'call',
  MEETING: 'meeting',
  SMS: 'sms',
  SOCIAL: 'social',
  NOTE: 'note',
} as const;
export type InteractionType = (typeof InteractionType)[keyof typeof InteractionType];

export interface Note extends Auditable {
  authorId: EntityId;
  content: string;
  isPinned: boolean;
}

// ─── Outreach Campaign ───
export interface OutreachCampaign extends Auditable {
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  targetAudience: TargetFilter;
  steps: OutreachStep[];
  metrics: CampaignMetrics;
}

export const CampaignType = {
  EMAIL: 'email',
  LINKEDIN: 'linkedin',
  SMS: 'sms',
  MULTI_CHANNEL: 'multi_channel',
} as const;
export type CampaignType = (typeof CampaignType)[keyof typeof CampaignType];

export const CampaignStatus = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
} as const;
export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export interface OutreachStep {
  order: number;
  channel: InteractionType;
  delayDays: number;
  templateId: EntityId;
}

export interface CampaignMetrics {
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  optedOut: number;
  meetingsBooked: number;
}

// ─── Target Filter ───
export interface TargetFilter {
  industries?: string[];
  sizes?: BusinessSize[];
  locations?: string[];
  minScore?: number;
  maxScore?: number;
  tags?: string[];
}
