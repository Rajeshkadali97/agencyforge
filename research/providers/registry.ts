import { IProvider, CompanyDiscoveryInput, CompanyDiscoveryOutput, WebsiteAnalysisInput, WebsiteAnalysisOutput, TechnologyDetectionInput, TechnologyDetectionOutput, SEOAnalysisInput, SEOAnalysisOutput, CompetitorAnalysisInput, CompetitorAnalysisOutput } from './types';

export class ProviderRegistry {
  private companyDiscoveryProviders: IProvider<CompanyDiscoveryInput, CompanyDiscoveryOutput>[] = [];
  private websiteAnalysisProviders: IProvider<WebsiteAnalysisInput, WebsiteAnalysisOutput>[] = [];
  private technologyDetectionProviders: IProvider<TechnologyDetectionInput, TechnologyDetectionOutput>[] = [];
  private seoAnalysisProviders: IProvider<SEOAnalysisInput, SEOAnalysisOutput>[] = [];
  private competitorAnalysisProviders: IProvider<CompetitorAnalysisInput, CompetitorAnalysisOutput>[] = [];

  registerCompanyDiscovery(provider: IProvider<CompanyDiscoveryInput, CompanyDiscoveryOutput>): void {
    this.companyDiscoveryProviders.push(provider);
    this.sortByPriority(this.companyDiscoveryProviders);
  }

  registerWebsiteAnalysis(provider: IProvider<WebsiteAnalysisInput, WebsiteAnalysisOutput>): void {
    this.websiteAnalysisProviders.push(provider);
    this.sortByPriority(this.websiteAnalysisProviders);
  }

  registerTechnologyDetection(provider: IProvider<TechnologyDetectionInput, TechnologyDetectionOutput>): void {
    this.technologyDetectionProviders.push(provider);
    this.sortByPriority(this.technologyDetectionProviders);
  }

  registerSEOAnalysis(provider: IProvider<SEOAnalysisInput, SEOAnalysisOutput>): void {
    this.seoAnalysisProviders.push(provider);
    this.sortByPriority(this.seoAnalysisProviders);
  }

  registerCompetitorAnalysis(provider: IProvider<CompetitorAnalysisInput, CompetitorAnalysisOutput>): void {
    this.competitorAnalysisProviders.push(provider);
    this.sortByPriority(this.competitorAnalysisProviders);
  }

  async executeCompanyDiscovery(input: CompanyDiscoveryInput): Promise<CompanyDiscoveryOutput> {
    return this.executeWithFallback(this.companyDiscoveryProviders, input, 'Company Discovery');
  }

  async executeWebsiteAnalysis(input: WebsiteAnalysisInput): Promise<WebsiteAnalysisOutput> {
    return this.executeWithFallback(this.websiteAnalysisProviders, input, 'Website Analysis');
  }

  async executeTechnologyDetection(input: TechnologyDetectionInput): Promise<TechnologyDetectionOutput> {
    return this.executeWithFallback(this.technologyDetectionProviders, input, 'Technology Detection');
  }

  async executeSEOAnalysis(input: SEOAnalysisInput): Promise<SEOAnalysisOutput> {
    return this.executeWithFallback(this.seoAnalysisProviders, input, 'SEO Analysis');
  }

  async executeCompetitorAnalysis(input: CompetitorAnalysisInput): Promise<CompetitorAnalysisOutput> {
    return this.executeWithFallback(this.competitorAnalysisProviders, input, 'Competitor Analysis');
  }

  private sortByPriority<TInput, TOutput>(providers: IProvider<TInput, TOutput>[]): void {
    providers.sort((a, b) => b.priority - a.priority);
  }

  private async executeWithFallback<TInput, TOutput>(
    providers: IProvider<TInput, TOutput>[],
    input: TInput,
    operationName: string
  ): Promise<TOutput> {
    const availableProviders = providers.filter(p => p.validateInput(input));
    
    if (availableProviders.length === 0) {
      throw new Error(`No available providers for ${operationName}`);
    }

    let lastError: Error | null = null;

    for (const provider of availableProviders) {
      try {
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) continue;

        const result = await provider.execute(input);
        
        if (result && (result as unknown as { confidence: number }).confidence > 0) {
          return result;
        }
        
        lastError = new Error(`Provider ${provider.id} returned low confidence result`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }
    }

    throw lastError ?? new Error(`All providers failed for ${operationName}`);
  }

  getCompanyDiscoveryProviders(): IProvider<CompanyDiscoveryInput, CompanyDiscoveryOutput>[] {
    return [...this.companyDiscoveryProviders];
  }

  getWebsiteAnalysisProviders(): IProvider<WebsiteAnalysisInput, WebsiteAnalysisOutput>[] {
    return [...this.websiteAnalysisProviders];
  }

  getTechnologyDetectionProviders(): IProvider<TechnologyDetectionInput, TechnologyDetectionOutput>[] {
    return [...this.technologyDetectionProviders];
  }

  getSEOAnalysisProviders(): IProvider<SEOAnalysisInput, SEOAnalysisOutput>[] {
    return [...this.seoAnalysisProviders];
  }

  getCompetitorAnalysisProviders(): IProvider<CompetitorAnalysisInput, CompetitorAnalysisOutput>[] {
    return [...this.competitorAnalysisProviders];
  }
}

export const providerRegistry = new ProviderRegistry();