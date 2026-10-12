export interface IProvider<TInput, TOutput> {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly capabilities: string[];
  readonly priority: number;
  readonly requiresApiKey: boolean;
  
  isAvailable(): Promise<boolean>;
  execute(input: TInput): Promise<TOutput>;
  validateInput(input: TInput): boolean;
}

export interface ICompanyDiscoveryProvider extends IProvider<CompanyDiscoveryInput, CompanyDiscoveryOutput> {}
export interface IWebsiteAnalysisProvider extends IProvider<WebsiteAnalysisInput, WebsiteAnalysisOutput> {}
export interface ITechnologyDetectionProvider extends IProvider<TechnologyDetectionInput, TechnologyDetectionOutput> {}
export interface ISEOAnalysisProvider extends IProvider<SEOAnalysisInput, SEOAnalysisOutput> {}
export interface ICompetitorAnalysisProvider extends IProvider<CompetitorAnalysisInput, CompetitorAnalysisOutput> {}

export interface CompanyDiscoveryInput {
  companyName?: string;
  domain?: string;
  industry?: string;
  location?: string;
  depth: 'basic' | 'standard' | 'deep';
}

export interface CompanyDiscoveryOutput {
  name: string;
  domain?: string;
  industry?: string;
  location?: string;
  foundedYear?: number;
  employeeCount?: number;
  revenueRange?: string;
  fundingStage?: string;
  description?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  technologies?: string[];
  socialProfiles?: Record<string, string>;
  dataQuality: 'complete' | 'partial' | 'minimal';
  source: string;
  confidence: number;
}

export interface WebsiteAnalysisInput {
  url: string;
  depth: 'basic' | 'standard' | 'deep';
  maxPages?: number;
}

export interface WebsiteAnalysisOutput {
  url: string;
  title?: string;
  metaDescription?: string;
  headings?: { h1: string[]; h2: string[]; h3: string[] };
  wordCount?: number;
  loadTimeMs?: number;
  statusCode?: number;
  sslValid?: boolean;
  mobileFriendly?: boolean;
  hasAnalytics?: boolean;
  hasChat?: boolean;
  formsCount?: number;
  imagesCount?: number;
  brokenLinks?: string[];
  pages?: Array<{ url: string; title: string; wordCount: number }>;
  seoScore?: number;
  performanceScore?: number;
  accessibilityScore?: number;
  contentQualityScore?: number;
  dataQuality: 'complete' | 'partial' | 'minimal';
  source: string;
  confidence: number;
}

export interface TechnologyDetectionInput {
  url: string;
}

export interface TechnologyDetectionOutput {
  url: string;
  technologies: Array<{
    name: string;
    category: string;
    confidence: number;
    version?: string;
    website?: string;
  }>;
  cms?: string;
  hostingProvider?: string;
  cdn?: string;
  analyticsTools?: string[];
  marketingTools?: string[];
  paymentProcessors?: string[];
  dataQuality: 'complete' | 'partial' | 'minimal';
  source: string;
  confidence: number;
}

export interface SEOAnalysisInput {
  url: string;
  includeKeywords?: boolean;
}

export interface SEOAnalysisOutput {
  url: string;
  overallScore: number;
  technicalSeo: {
    score: number;
    issues: Array<{ severity: 'critical' | 'warning' | 'info'; message: string }>;
  };
  onPageSeo: {
    score: number;
    issues: Array<{ severity: 'critical' | 'warning' | 'info'; message: string }>;
  };
  contentQuality: {
    score: number;
    issues: Array<{ severity: 'critical' | 'warning' | 'info'; message: string }>;
  };
  backlinks?: {
    score: number;
    referringDomains?: number;
    totalBacklinks?: number;
  };
  keywords?: Array<{
    keyword: string;
    position: number;
    volume: number;
    difficulty: number;
  }>;
  recommendations: string[];
  dataQuality: 'complete' | 'partial' | 'minimal';
  source: string;
  confidence: number;
}

export interface CompetitorAnalysisInput {
  targetDomain: string;
  limit?: number;
}

export interface CompetitorAnalysisOutput {
  targetCompany: string;
  competitors: Array<{
    name: string;
    domain: string;
    similarityScore: number;
    trafficEstimate?: number;
    keywordsOverlap?: string[];
    strengths?: string[];
    weaknesses?: string[];
    marketPosition?: string;
  }>;
  marketGaps?: string[];
  opportunities?: string[];
  dataQuality: 'complete' | 'partial' | 'minimal';
  source: string;
  confidence: number;
}