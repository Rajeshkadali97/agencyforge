import type { BusinessLead, BusinessLocation } from "../types/index.js";

export interface BusinessDiscoveryCriteria {
  readonly industries?: readonly string[];
  readonly locations?: readonly BusinessLocation[];
  readonly companySize?: CompanySizeRange;
  readonly keywords?: readonly string[];
  readonly requiredSignals?: readonly string[];
  readonly excludedDomains?: readonly string[];
  readonly limit?: number;
}

export interface CompanySizeRange {
  readonly minEmployees?: number;
  readonly maxEmployees?: number;
}

export interface BusinessDiscoveryRequest {
  readonly criteria: BusinessDiscoveryCriteria;
  readonly providerIds?: readonly string[];
  readonly requestedBy: string;
  readonly traceId?: string;
}

export interface BusinessDiscoveryBatch {
  readonly leads: readonly BusinessLead[];
  readonly providerSummaries: readonly DiscoveryProviderSummary[];
}

export interface DiscoveryProviderSummary {
  readonly providerId: string;
  readonly returnedCount: number;
  readonly skippedCount: number;
  readonly notes?: readonly string[];
}
