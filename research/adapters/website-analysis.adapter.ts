import { IWebsiteAnalysis } from '../shared/interfaces';
import { WebsiteAnalysisResult } from '../shared/types';
import { IProvider, WebsiteAnalysisInput, WebsiteAnalysisOutput } from '../providers/types';

export class WebsiteAnalysisAdapter implements IWebsiteAnalysis {
  constructor(private readonly provider: IProvider<WebsiteAnalysisInput, WebsiteAnalysisOutput>) {}

  async analyze(url: string, depth?: 'basic' | 'standard' | 'deep'): Promise<WebsiteAnalysisResult> {
    const providerInput: WebsiteAnalysisInput = {
      url,
      depth: depth ?? 'basic',
      maxPages: 1 // We're only analyzing the main page
    };

    const providerOutput = await this.provider.execute(providerInput);
    
    // Convert from provider output to shared WebsiteAnalysisResult
    const result: WebsiteAnalysisResult = {
      url: providerOutput.url,
      title: providerOutput.title,
      meta_description: providerOutput.metaDescription,
      headings: providerOutput.headings,
      word_count: providerOutput.wordCount,
      load_time_ms: providerOutput.loadTimeMs,
      status_code: providerOutput.statusCode,
      ssl_valid: providerOutput.sslValid,
      mobile_friendly: providerOutput.mobileFriendly,
      has_analytics: providerOutput.hasAnalytics,
      has_chat: providerOutput.hasChat,
      forms_count: providerOutput.formsCount,
      images_count: providerOutput.imagesCount,
      broken_links: providerOutput.brokenLinks || [],
      seo_score: providerOutput.seoScore,
      performance_score: providerOutput.performanceScore,
      accessibility_score: providerOutput.accessibilityScore,
      content_quality_score: providerOutput.contentQualityScore
    };

    return result;
  }

  async crawl(url: string, maxPages?: number): Promise<WebsiteAnalysisResult[]> {
    // For simplicity, we'll just analyze the single URL
    // A real implementation would crawl multiple pages
    const result = await this.analyze(url, 'basic');
    return [result];
  }
}