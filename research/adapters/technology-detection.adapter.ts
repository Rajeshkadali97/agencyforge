import { ITechnologyDetection } from '../shared/interfaces';
import { TechnologyDetectionResult } from '../shared/types';
import { IProvider, TechnologyDetectionInput, TechnologyDetectionOutput } from '../providers/types';

export class TechnologyDetectionAdapter implements ITechnologyDetection {
  constructor(private readonly provider: IProvider<TechnologyDetectionInput, TechnologyDetectionOutput>) {}

  async detect(url: string): Promise<TechnologyDetectionResult> {
    const providerInput: TechnologyDetectionInput = {
      url
    };

    const providerOutput = await this.provider.execute(providerInput);
    
    // Convert from provider output to shared TechnologyDetectionResult
    const result: TechnologyDetectionResult = {
      url: providerOutput.url,
      technologies: providerOutput.technologies.map(tech => ({
        name: tech.name,
        category: tech.category,
        confidence: tech.confidence,
        version: tech.version,
        website: tech.website
      })),
      cms: providerOutput.cms,
      hosting_provider: providerOutput.hostingProvider,
      cdn: providerOutput.cdn,
      analytics_tools: providerOutput.analyticsTools,
      marketing_tools: providerOutput.marketingTools,
      payment_processors: providerOutput.paymentProcessors
    };

    return result;
  }

  async detectCMS(url: string): Promise<string | null> {
    const result = await this.detect(url);
    return result.cms ?? null;
  }

  async detectHosting(url: string): Promise<string | null> {
    const result = await this.detect(url);
    return result.hosting_provider ?? null;
  }

  async detectAnalytics(url: string): Promise<string[]> {
    const result = await this.detect(url);
    return result.analytics_tools ?? [];
  }
}