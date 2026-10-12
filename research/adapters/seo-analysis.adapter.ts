import { ISEOAnalysis } from '../shared/interfaces';
import { SEOAnalysisResult } from '../shared/types';
import { IProvider, SEOAnalysisInput, SEOAnalysisOutput } from '../providers/types';

export class SEOAnalysisAdapter implements ISEOAnalysis {
  constructor(private readonly provider: IProvider<SEOAnalysisInput, SEOAnalysisOutput>) {}

  async analyze(url: string): Promise<SEOAnalysisResult> {
    const providerInput: SEOAnalysisInput = {
      url,
      includeKeywords: true // Always include keywords for completeness
    };

    const providerOutput = await this.provider.execute(providerInput);
    
    // Convert from provider output to shared SEOAnalysisResult
    const result: SEOAnalysisResult = {
      url: providerOutput.url,
      overall_score: providerOutput.overallScore,
      technical_seo: {
        score: providerOutput.technicalSeo.score,
        issues: providerOutput.technicalSeo.issues
      },
      on_page_seo: {
        score: providerOutput.onPageSeo.score,
        issues: providerOutput.onPageSeo.issues
      },
      content_quality: {
        score: providerOutput.contentQuality.score,
        issues: providerOutput.contentQuality.issues
      },
      backlinks: providerOutput.backlinks ? {
        score: providerOutput.backlinks.score,
        referring_domains: providerOutput.backlinks.referringDomains,
        total_backlinks: providerOutput.backlinks.totalBacklinks
      } : undefined,
      keywords: providerOutput.keywords ? providerOutput.keywords.map(kw => ({
        keyword: kw.keyword,
        position: kw.position,
        volume: kw.volume,
        difficulty: kw.difficulty
      })) : undefined,
      recommendations: providerOutput.recommendations
    };

    return result;
  }

  async auditTechnical(url: string): Promise<SEOAnalysisResult['technical_seo']> {
    const result = await this.analyze(url);
    return result.technical_seo;
  }

  async auditOnPage(url: string): Promise<SEOAnalysisResult['on_page_seo']> {
    const result = await this.analyze(url);
    return result.on_page_seo;
  }

  async analyzeKeywords(domain: string): Promise<SEOAnalysisResult['keywords']> {
    const result = await this.analyze(`https://${domain}`);
    return result.keywords ?? [];
  }
}