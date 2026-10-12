import { 
  ResearchRequest, 
  ResearchReport, 
  CompanyProfile, 
  WebsiteAnalysisResult, 
  CompetitorAnalysisResult, 
  TechnologyDetectionResult, 
  SEOAnalysisResult 
} from './shared/types';
import { 
  ICompanyDiscovery, 
  IWebsiteAnalysis, 
  ICompetitorAnalysis, 
  ITechnologyDetection, 
  ISEOAnalysis 
} from './shared/interfaces';

export class ResearchEngine {
  constructor(
    private readonly companyDiscovery: ICompanyDiscovery,
    private readonly websiteAnalysis: IWebsiteAnalysis,
    private readonly competitorAnalysis: ICompetitorAnalysis,
    private readonly technologyDetection: ITechnologyDetection,
    private readonly seoAnalysis: ISEOAnalysis
  ) {}

  async research(request: ResearchRequest): Promise<ResearchReport> {
    const report: ResearchReport = {
      request,
      generated_at: new Date().toISOString(),
      overall_insights: [],
      priority_actions: [],
    };

    const domain = request.domain ?? this.extractDomain(request.website_url);
    
    if (request.company_name || domain) {
      report.company_profile = await this.companyDiscovery.discover({
        company_name: request.company_name,
        domain,
        industry: request.industry,
        location: request.location,
        depth: request.depth,
      });
    }

    if (request.website_url || domain) {
      const url = request.website_url ?? `https://${domain}`;
      
      report.website_analysis = await this.websiteAnalysis.analyze(url, request.depth);

      if (request.include_tech_stack) {
        report.technology_detection = await this.technologyDetection.detect(url);
      }

      if (request.include_seo) {
        report.seo_analysis = await this.seoAnalysis.analyze(url);
      }
    }

    if (request.include_competitors && domain) {
      report.competitor_analysis = await this.competitorAnalysis.analyze(domain);
    }

    report.overall_insights = this.generateInsights(report);
    report.priority_actions = this.generatePriorityActions(report);

    return report;
  }

  private extractDomain(url?: string): string | undefined {
    if (!url) return undefined;
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  private generateInsights(report: ResearchReport): string[] {
    const insights: string[] = [];

    if (report.company_profile) {
      insights.push(`Company: ${report.company_profile.name} (${report.company_profile.industry ?? 'Unknown industry'})`);
      if (report.company_profile.employee_count) {
        insights.push(`${report.company_profile.employee_count} employees`);
      }
    }

    if (report.website_analysis) {
      insights.push(`Website loads in ${report.website_analysis.load_time_ms ?? 'unknown'}ms`);
      if (report.website_analysis.seo_score) {
        insights.push(`SEO Score: ${report.website_analysis.seo_score}/100`);
      }
    }

    if (report.technology_detection) {
      const techCount = report.technology_detection.technologies.length;
      insights.push(`Detected ${techCount} technologies`);
      if (report.technology_detection.cms) {
        insights.push(`CMS: ${report.technology_detection.cms}`);
      }
    }

    if (report.seo_analysis) {
      insights.push(`Overall SEO Score: ${report.seo_analysis.overall_score}/100`);
    }

    if (report.competitor_analysis) {
      insights.push(`Found ${report.competitor_analysis.competitors.length} competitors`);
    }

    return insights;
  }

  private generatePriorityActions(report: ResearchReport): string[] {
    const actions: string[] = [];

    if (report.seo_analysis && report.seo_analysis.overall_score < 60) {
      actions.push('Fix critical SEO issues');
    }

    if (report.website_analysis && (report.website_analysis.load_time_ms ?? 0) > 3000) {
      actions.push('Improve page load performance');
    }

    if (report.website_analysis && !report.website_analysis.mobile_friendly) {
      actions.push('Fix mobile usability issues');
    }

    if (report.technology_detection && !report.technology_detection.analytics_tools?.length) {
      actions.push('Add analytics tracking');
    }

    if (report.competitor_analysis && report.competitor_analysis.competitors.length > 0) {
      actions.push('Analyze top competitor strategies');
    }

    if (actions.length === 0) {
      actions.push('Monitor and maintain current performance');
    }

    return actions;
  }
}