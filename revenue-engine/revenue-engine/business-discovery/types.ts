/**
 * Business Discovery Types
 * Domain types for lead discovery, scraping, and enrichment pipelines.
 */

import type { EntityId } from '../shared';

// ─── Raw Lead (before enrichment) ───
export interface RawLead {
  id: EntityId;
  source: string; // scraper name, e.g. 'google-maps-scraper'
  sourceId: string; // id in the source system
  businessName: string;
  domain?: string;
  industry?: string;
  size?: string;
  location?: string;
  phone?: string;
  email?: string;
  contacts: RawContact[];
  rawData: Record<string, unknown>; // orginal scraper payload
  scrapedAt: Date;
  confidenceScore: number; // 0-1, how reliable the data is
}

export interface RawContact {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedIn?: string;
  isDecisionMaker?: boolean;
}

// ─── Scraping Job ───
export interface ScrapingJob {
  id: EntityId;
  provider: string;
  query: ScrapingQuery;
  status: ScrapingJobStatus;
  totalRecords?: number;
  processedRecords: number;
  errorCount: number;
  startedAt?: Date;
  completedAt?: Date;
  config: Record<string, unknown>;
}

export const ScrapingJobStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
export type ScrapingJobStatus = (typeof ScrapingJobStatus)[keyof typeof ScrapingJobStatus];

export interface ScrapingQuery {
  keywords?: string[];
  location?: string;
  industry?: string;
  businessType?: string;
  minRating?: number;
  limit?: number;
  filters?: Record<string, unknown>;
}

// ─── Discovery Sources ───
export interface DiscoverySourceConfig {
  name: string;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  rateLimit: number; // requests per second
  priority: number; // 1 = highest
  filters?: Record<string, unknown>;
}

// ─── Enrichment Result ───
export interface EnrichmentResult {
  leadId: EntityId;
  fieldsEnriched: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  confidenceScore: number;
  enrichedAt: Date;
}

// ─── Lead Enrichment Profile ───
export interface LeadEnrichmentProfile {
  businessId: EntityId;
  industryDetails?: IndustryDetails;
  techStack?: string[];
  competitors?: string[];
  signals?: BusinessSignal[];
  socialPresence?: SocialPresence;
  enrichmentLevel: 'basic' | 'standard' | 'deep';
}

export interface IndustryDetails {
  primary: string;
  secondary: string[];
  naicsCode?: string;
  marketSegment: 'local' | 'regional' | 'national' | 'international';
}

export interface BusinessSignal {
  type: 'hiring' | 'funding' | 'expansion' | 'new_product' | 'rebranding' | 'acquisition';
  description: string;
  confidence: number;
  sourceUrl?: string;
  detectedAt: Date;
}

export interface SocialPresence {
  linkedInFollowers?: number;
  twitterFollowers?: number;
  instagramFollowers?: number;
  facebookLikes?: number;
  hasWebsite: boolean;
  websiteAge?: number; // in years
  lastPostActivity?: Date;
}

// ─── Aggregation Strategy ───
export interface AggregationStrategy {
  deduplicationMethod: 'domain' | 'phone' | 'name+location';
  mergeRules: Record<string, MergeRule>;
  conflictResolution: 'highest_confidence' | 'most_recent' | 'manual_review';
}

export interface MergeRule {
  field: string;
  strategy: 'source_priority' | 'concatenate' | 'highest_confidence' | 'union';
  prioritySource?: string;
}

// ─── Scraping Provider Metadata ───
export interface ScraperProviderInfo {
  name: string;
  displayName: string;
  category: ScraperCategory;
  supports: ScraperCapability[];
  rateLimitRpm: number; // requests per minute
  requiresApiKey: boolean;
  supportsBatch: boolean;
  batchSize?: number;
  maxConcurrentJobs: number;
  reliabilityScore: number; // 0-1
}

export const ScraperCategory = {
  WEB_CRAWLER: 'web_crawler',
  AI_SCRAPER: 'ai_scraper',
  MAPS: 'maps',
  SOCIAL: 'social',
  PROFESSIONAL_NETWORK: 'professional_network',
  DIRECTORY: 'directory',
  OUTREACH: 'outreach',
  SALES_INTELLIGENCE: 'sales_intelligence',
  MULTI_CHANNEL: 'multi_channel',
} as const;
export type ScraperCategory = (typeof ScraperCategory)[keyof typeof ScraperCategory];

export const ScraperCapability = {
  LEAD_SEARCH: 'lead_search',
  CONTACT_EXTRACTION: 'contact_extraction',
  EMAIL_FINDING: 'email_finding',
  PHONE_FINDING: 'phone_finding',
  SOCIAL_PROFILE: 'social_profile',
  COMPANY_DATA: 'company_data',
  REVIEWS: 'reviews',
  HIRING_INFO: 'hiring_info',
  FUNDING_INFO: 'funding_info',
  TECH_STACK: 'tech_stack',
  COMPETITORS: 'competitors',
  WEBSITE_AUDIT: 'website_audit',
  OUTREACH_AUTOMATION: 'outreach_automation',
  SEQUENCES: 'sequences',
  AI_PERSONALIZATION: 'ai_personalization',
  MEETING_BOOKING: 'meeting_booking',
} as const;
export type ScraperCapability = (typeof ScraperCapability)[keyof typeof ScraperCapability];
