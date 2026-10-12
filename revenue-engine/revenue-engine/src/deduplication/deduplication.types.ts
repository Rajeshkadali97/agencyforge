// Deduplication Types

export interface Lead {
  id: string;
  companyName: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  sources: string[];
  isDuplicate?: boolean;
  confidence?: number;
}

// Deduplication Config

export interface DeduplicationOptions {
  enableWebsiteMatching: boolean;
  enableAddressMatching: boolean;
  confidenceThreshold: number; // 0-100
}

// Deduplication Results

export interface DeduplicationEvent {
  type: string;
  data: Record<string, unknown>;
}

export interface DeduplicationResult {
  duplicates: Lead[];
  merged: Lead | null;
  confidence: number;
  events: DeduplicationEvent[];
}
