/**
 * Interfaces / Ports
 * Defines contracts that each module implements or depends on.
 * Separates the domain (types) from infrastructure (implementations).
 */

import type {
  Business,
  BusinessSize,
  CampaignMetrics,
  CampaignType,
  GeoLocation,
  Interaction,
  Lead,
  LeadStage,
  OutreachCampaign,
  PricingTier,
  Proposal,
  TargetFilter,
} from '../types';
import type { EntityId, Result } from '../shared';

// ─── Repository Pattern (Read/Write Port) ───
export interface Repository<T, CreateInput, UpdateInput> {
  findById(id: EntityId): Promise<Result<T>>;
  findMany(filter: Partial<T>): Promise<Result<T[]>>;
  create(input: CreateInput): Promise<Result<T>>;
  update(id: EntityId, input: UpdateInput): Promise<Result<T>>;
  delete(id: EntityId): Promise<Result<void>>;
}

// ─── Scraping Provider Types ───
export type ScraperCategory =
  | 'web_crawler'
  | 'ai_scraper'
  | 'maps'
  | 'social'
  | 'professional_network'
  | 'directory'
  | 'outreach'
  | 'sales_intelligence'
  | 'multi_channel';

export type ScraperCapability =
  | 'lead_search'
  | 'contact_extraction'
  | 'email_finding'
  | 'phone_finding'
  | 'social_profile'
  | 'company_data'
  | 'reviews'
  | 'hiring_info'
  | 'funding_info'
  | 'tech_stack'
  | 'competitors'
  | 'website_audit'
  | 'outreach_automation'
  | 'sequences'
  | 'ai_personalization'
  | 'meeting_booking';

export interface ScraperProviderInfo {
  name: string;
  displayName: string;
  category: ScraperCategory;
  supports: ScraperCapability[];
  rateLimitRpm: number;
  requiresApiKey: boolean;
  supportsBatch: boolean;
  batchSize?: number;
  maxConcurrentJobs: number;
  reliabilityScore: number;
}

export interface ScraperConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  proxy?: string;
  customHeaders?: Record<string, string>;
  retryPolicy?: RetryPolicy;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  retryableStatusCodes: number[];
}

export interface RateLimitStatus {
  remaining: number;
  resetAt: Date;
  limit: number;
  used: number;
}

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  message?: string;
  lastCheckedAt: Date;
}

export interface ScrapingQuery {
  keywords?: string[];
  location?: string;
  industry?: string;
  businessType?: string;
  minRating?: number;
  limit?: number;
  filters?: Record<string, unknown>;
}

export interface RawLead {
  id: EntityId;
  source: string;
  sourceId: string;
  businessName: string;
  domain?: string;
  industry?: string;
  size?: string;
  location?: string;
  phone?: string;
  email?: string;
  contacts: RawContact[];
  rawData: Record<string, unknown>;
  scrapedAt: Date;
  confidenceScore: number;
}

export interface RawContact {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedIn?: string;
  isDecisionMaker?: boolean;
}

// ─── Scraping Provider Contract (Anti-Corruption Layer) ───
export interface ScraperProvider {
  readonly info: ScraperProviderInfo;
  connect(config: ScraperConfig): Promise<Result<void>>;
  disconnect?(): Promise<void>;
  search(query: ScrapingQuery): Promise<Result<RawLead[]>>;
  getById(id: string): Promise<Result<RawLead>>;
  getRateLimitStatus(): Promise<RateLimitStatus>;
  healthCheck(): Promise<HealthCheckResult>;
}

export interface ScraperProviderRegistry {
  register(provider: ScraperProvider): void;
  unregister(name: string): void;
  get(name: string): ScraperProvider | undefined;
  getByCategory(category: ScraperCategory): ScraperProvider[];
  getByCapability(capability: ScraperCapability): ScraperProvider[];
  getAll(): ScraperProvider[];
}

// ─── Unified Lead Scraper Service ───
export interface AggregatedLeadResult {
  lead: RawLead;
  provider: string;
  confidenceScore: number;
  duplicateOf?: EntityId;
}

export interface DeduplicatedLead {
  primary: RawLead;
  duplicates: RawLead[];
  mergeConfidence: number;
}

export interface EnrichedLead {
  lead: RawLead;
  enrichedFields: Record<string, unknown>;
  enrichmentSources: string[];
  enrichmentScore: number;
  enrichmentTimestamp: Date;
}

export interface UnifiedLeadScraperService {
  searchAcrossProviders(
    query: ScrapingQuery,
    providers: string[]
  ): Promise<Result<AggregatedLeadResult[]>>;
  searchAllProviders(query: ScrapingQuery): Promise<Result<AggregatedLeadResult[]>>;
  deduplicateAndMerge(leads: RawLead[]): Result<DeduplicatedLead[]>;
  enrichLead(leadId: EntityId, depth: 'basic' | 'standard' | 'deep'): Promise<Result<EnrichedLead>>;
}

// ─── Business Discovery Ports ───
export interface BusinessDiscoveryProvider {
  search(query: BusinessDiscoveryQuery): Promise<Result<Business[]>>;
  enrich(businessId: EntityId): Promise<Result<Business>>;
}

export interface BusinessDiscoveryQuery {
  industry?: string;
  size?: BusinessSize;
  location?: GeoLocation;
  keywords?: string[];
  limit?: number;
  offset?: number;
}

// ─── Lead Scoring Ports ───
export interface LeadScoringEngine {
  scoreLead(lead: Lead): Promise<Result<ScoringResult>>;
  scoreBusiness(business: Business): Promise<Result<ScoringResult>>;
}

export interface ScoringResult {
  score: number; // 0-100
  factors: ScoringFactor[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface ScoringFactor {
  name: string;
  weight: number;
  contribution: number;
}

// ─── Website Audit Ports ───
export interface WebsiteAuditProvider {
  audit(url: string): Promise<Result<WebsiteAudit>>;
  reaudit(auditId: EntityId): Promise<Result<WebsiteAudit>>;
}

export interface WebsiteAudit {
  businessId: EntityId;
  url: string;
  summary: AuditSummary;
  categories: AuditCategory[];
  recommendations: Recommendation[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditSummary {
  overallScore: number;
  grade: string;
  issuesCount: number;
  criticalIssues: number;
}

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

export interface AuditReportRenderer {
  render(audit: WebsiteAudit): Promise<Result<string>>;
  renderSummary(audit: WebsiteAudit): Promise<Result<string>>;
}

// ─── Proposal Generator Ports ───
export interface ProposalTemplateEngine {
  generateForLead(leadId: EntityId): Promise<Result<Proposal>>;
  generateForAudit(auditId: EntityId, leadId: EntityId): Promise<Result<Proposal>>;
  customizeTemplate(templateId: EntityId, variables: Record<string, string>): Promise<Result<Proposal>>;
}

export interface PricingEngine {
  calculatePricing(tier: string, audit?: WebsiteAudit): Promise<Result<PricingTier[]>>;
  applyDiscount(pricing: PricingTier[], code: string): Promise<Result<PricingTier[]>>;
}

// ─── CRM Ports ───
export interface CRMProvider {
  syncRecord(record: CRMRecordInput): Promise<Result<void>>;
  getRecord(businessId: EntityId): Promise<Result<CRMRecordOutput>>;
  logInteraction(businessId: EntityId, interaction: Interaction): Promise<Result<void>>;
}

export interface CRMRecordInput {
  businessId: EntityId;
  leadId?: EntityId;
  stage: LeadStage;
  customFields?: Record<string, unknown>;
}

export interface CRMRecordOutput {
  businessId: EntityId;
  leadId?: EntityId;
  stage: LeadStage;
  interactions: Interaction[];
  lastSyncAt: Date;
}

// ─── Outreach Ports ───
export interface OutreachProvider {
  createCampaign(campaign: CreateCampaignInput): Promise<Result<OutreachCampaign>>;
  launchCampaign(campaignId: EntityId): Promise<Result<void>>;
  pauseCampaign(campaignId: EntityId): Promise<Result<void>>;
  getMetrics(campaignId: EntityId): Promise<Result<CampaignMetrics>>;
}

export interface CreateCampaignInput {
  name: string;
  type: CampaignType;
  targetFilter: TargetFilter;
  steps: OutreachStepInput[];
}

export interface OutreachStepInput {
  order: number;
  channel: Interaction['type'];
  delayDays: number;
  templateBody: string;
  subject?: string;
}

// ─── Pipeline / Orchestration Ports ───
export interface PipelineEngine {
  moveToStage(leadId: EntityId, stage: LeadStage): Promise<Result<Lead>>;
  getPipeline(filter: LeadStage[]): Promise<Result<Lead[]>>;
  getStageMetrics(stage: LeadStage): Promise<Result<StageMetrics>>;
}

export interface StageMetrics {
  count: number;
  totalValue: number;
  averageDaysInStage: number;
  conversionRate: number;
}

// ─── Event Bus (Output feed to external consumers) ───
export interface DomainEvent {
  id: EntityId;
  type: string;
  payload: unknown;
  occurredAt: Date;
  aggregateId: EntityId;
}

export interface EventPublisher {
  publish(event: DomainEvent): Promise<Result<void>>;
  subscribe(eventType: string, handler: (event: DomainEvent) => void): void;
}
