import { CompanyProfile, ResearchRequest, ResearchTask } from '../shared/types';

export interface ICompanyDiscovery {
  discover(request: ResearchRequest): Promise<CompanyProfile>;
  enrich(companyName: string, domain?: string): Promise<CompanyProfile>;
  search(query: string, filters?: Record<string, unknown>): Promise<CompanyProfile[]>;
}

export interface IWebsiteAnalysis {
  analyze(url: string, depth?: 'basic' | 'standard' | 'deep'): Promise<WebsiteAnalysisResult>;
  crawl(url: string, maxPages?: number): Promise<WebsiteAnalysisResult[]>;
}

export interface ICompetitorAnalysis {
  analyze(targetDomain: string): Promise<CompetitorAnalysisResult>;
  findCompetitors(domain: string, limit?: number): Promise<CompetitorAnalysisResult['competitors']>;
  compare(domains: string[]): Promise<CompetitorAnalysisResult>;
}

export interface ITechnologyDetection {
  detect(url: string): Promise<TechnologyDetectionResult>;
  detectCMS(url: string): Promise<string | null>;
  detectHosting(url: string): Promise<string | null>;
  detectAnalytics(url: string): Promise<string[]>;
}

export interface ISEOAnalysis {
  analyze(url: string): Promise<SEOAnalysisResult>;
  auditTechnical(url: string): Promise<SEOAnalysisResult['technical_seo']>;
  auditOnPage(url: string): Promise<SEOAnalysisResult['on_page_seo']>;
  analyzeKeywords(domain: string): Promise<SEOAnalysisResult['keywords']>;
}

import { WebsiteAnalysisResult, CompetitorAnalysisResult, TechnologyDetectionResult, SEOAnalysisResult } from '../shared/types';