export interface ICompanyDiscovery {
  discover(request: ResearchRequest): Promise<CompanyProfile>;
  enrich(companyName: string, domain?: string): Promise<CompanyProfile>;
  search(query: string, filters?: Record<string, unknown>): Promise<CompanyProfile[]>;
}

export interface ICompetitorAnalysis {
  analyze(companyName: string, domain?: string): Promise<CompetitorReport>;
  findCompetitors(companyName: string, domain?: string, limit?: number): Promise<CompetitorProfile[]>;
}

export interface IMarketResearch {
  analyzeMarket(industry: string, location?: string): Promise<MarketAnalysis>;
  getTrends(industry: string, timeframe?: string): Promise<TrendData[]>;
}

export interface IWebsiteAnalysis {
  analyze(url: string): Promise<WebsiteAnalysis>;
  auditSEO(url: string): Promise<SEOAudit>;
  auditPerformance(url: string): Promise<PerformanceAudit>;
}

export interface ISocialAnalysis {
  analyze(companyName: string, platforms?: string[]): Promise<SocialProfile>;
  getEngagement(companyName: string, platform: string): Promise<EngagementMetrics>;
}

export type ResearchRequest = {
  company_name?: string;
  domain?: string;
  industry?: string;
  location?: string;
  depth?: 'basic' | 'standard' | 'deep';
};

export type CompanyProfile = {
  name: string;
  domain?: string;
  industry?: string;
  location?: string;
  website_url?: string;
  linkedin_url?: string;
  description?: string;
  technologies?: string[];
  employee_count?: number;
  founded_year?: number;
  revenue?: string;
  funding?: string;
};

export type CompetitorProfile = {
  name: string;
  domain: string;
  similarity_score: number;
  key_differences: string[];
};

export type CompetitorReport = {
  target_company: string;
  competitors: CompetitorProfile[];
  market_position: string;
  opportunities: string[];
  threats: string[];
};

export type MarketAnalysis = {
  industry: string;
  market_size: string;
  growth_rate: string;
  key_players: string[];
  trends: TrendData[];
  barriers_to_entry: string[];
};

export type TrendData = {
  name: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  timeframe: string;
};

export type WebsiteAnalysis = {
  url: string;
  title: string;
  description: string;
  technologies: string[];
  performance_score: number;
  seo_score: number;
  accessibility_score: number;
  mobile_friendly: boolean;
};

export type SEOAudit = {
  score: number;
  issues: SEOIssue[];
  recommendations: string[];
};

export type SEOIssue = {
  type: 'error' | 'warning' | 'info';
  message: string;
  element?: string;
};

export type PerformanceAudit = {
  score: number;
  metrics: Record<string, number>;
  opportunities: string[];
};

export type SocialProfile = {
  company_name: string;
  platforms: Record<string, PlatformMetrics>;
  total_followers: number;
  engagement_rate: number;
};

export type PlatformMetrics = {
  followers: number;
  following: number;
  posts: number;
  engagement_rate: number;
  last_post_date?: string;
};

export type EngagementMetrics = {
  avg_likes: number;
  avg_comments: number;
  avg_shares: number;
  engagement_rate: number;
};