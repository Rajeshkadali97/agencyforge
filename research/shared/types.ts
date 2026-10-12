export interface CompanyProfile {
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  location?: string;
  founded?: number;
  description?: string;
  linkedin_url?: string;
  website_url?: string;
  funding_stage?: string;
  employee_count?: number;
  revenue_range?: string;
  technologies?: string[];
  social_profiles?: Record<string, string>;
}

export interface WebsiteAnalysisResult {
  url: string;
  title?: string;
  meta_description?: string;
  headings?: { h1: string[]; h2: string[]; h3: string[] };
  word_count?: number;
  load_time_ms?: number;
  status_code?: number;
  ssl_valid?: boolean;
  mobile_friendly?: boolean;
  has_analytics?: boolean;
  has_chat?: boolean;
  forms_count?: number;
  images_count?: number;
  broken_links?: string[];
  seo_score?: number;
  performance_score?: number;
  accessibility_score?: number;
  content_quality_score?: number;
}

export interface CompetitorAnalysisResult {
  target_company: string;
  competitors: Array<{
    name: string;
    domain: string;
    similarity_score: number;
    traffic_estimate?: number;
    keywords_overlap?: string[];
    strengths?: string[];
    weaknesses?: string[];
    market_position?: string;
  }>;
  market_gaps?: string[];
  opportunities?: string[];
}

export interface TechnologyDetectionResult {
  url: string;
  technologies: Array<{
    name: string;
    category: string;
    confidence: number;
    version?: string;
    website?: string;
  }>;
  cms?: string;
  hosting_provider?: string;
  cdn?: string;
  analytics_tools?: string[];
  marketing_tools?: string[];
  payment_processors?: string[];
}

export interface SEOAnalysisResult {
  url: string;
  overall_score: number;
  technical_seo: {
    score: number;
    issues: Array<{ severity: 'critical' | 'warning' | 'info'; message: string }>;
  };
  on_page_seo: {
    score: number;
    issues: Array<{ severity: 'critical' | 'warning' | 'info'; message: string }>;
  };
  content_quality: {
    score: number;
    issues: Array<{ severity: 'critical' | 'warning' | 'info'; message: string }>;
  };
  backlinks?: {
    score: number;
    referring_domains?: number;
    total_backlinks?: number;
  };
  keywords?: Array<{
    keyword: string;
    position: number;
    volume: number;
    difficulty: number;
  }>;
  recommendations: string[];
}

export type ResearchTaskType = 
  | 'company_discovery'
  | 'website_analysis'
  | 'competitor_analysis'
  | 'technology_detection'
  | 'seo_analysis';

export interface ResearchTask {
  id: string;
  type: ResearchTaskType;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: CompanyProfile | WebsiteAnalysisResult | CompetitorAnalysisResult | TechnologyDetectionResult | SEOAnalysisResult;
  error?: string;
  created_at: string;
  completed_at?: string;
}

export interface ResearchRequest {
  company_name?: string;
  domain?: string;
  website_url?: string;
  industry?: string;
  location?: string;
  depth: 'basic' | 'standard' | 'deep';
  include_competitors?: boolean;
  include_tech_stack?: boolean;
  include_seo?: boolean;
}

export interface ResearchReport {
  request: ResearchRequest;
  company_profile?: CompanyProfile;
  website_analysis?: WebsiteAnalysisResult;
  competitor_analysis?: CompetitorAnalysisResult;
  technology_detection?: TechnologyDetectionResult;
  seo_analysis?: SEOAnalysisResult;
  generated_at: string;
  overall_insights: string[];
  priority_actions: string[];
}