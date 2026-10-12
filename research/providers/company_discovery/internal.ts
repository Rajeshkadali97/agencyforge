import { IProvider, CompanyDiscoveryInput, CompanyDiscoveryOutput } from '../types';

export class InternalCompanyDiscoveryProvider implements IProvider<CompanyDiscoveryInput, CompanyDiscoveryOutput> {
  readonly id = 'internal-company-discovery';
  readonly name = 'Internal Company Discovery';
  readonly version = '1.0.0';
  readonly capabilities = ['basic', 'enrichment'];
  readonly priority = 10;
  readonly requiresApiKey = false;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  validateInput(input: CompanyDiscoveryInput): boolean {
    return !!(input.companyName || input.domain);
  }

  async execute(input: CompanyDiscoveryInput): Promise<CompanyDiscoveryOutput> {
    const domain = input.domain ?? this.guessDomain(input.companyName ?? '');
    const name = input.companyName ?? this.extractName(domain);
    
    let output: CompanyDiscoveryOutput = {
      name,
      domain,
      industry: input.industry,
      location: input.location,
      websiteUrl: `https://${domain}`,
      dataQuality: 'minimal',
      source: this.id,
      confidence: 0.3,
    };

    if (input.depth !== 'basic') {
      const enriched = await this.enrichProfile(domain, name);
      output = { ...output, ...enriched, dataQuality: 'partial', confidence: 0.6 };
    }

    return output;
  }

  private async enrichProfile(domain: string, name: string): Promise<Partial<CompanyDiscoveryOutput>> {
    try {
      const response = await fetch(`https://${domain}`, { method: 'HEAD' });
      const headers = response.headers;
      
      const server = headers.get('server') ?? undefined;
      const poweredBy = headers.get('x-powered-by') ?? undefined;
      
      const technologies: string[] = [];
      if (server) technologies.push(`Server: ${server}`);
      if (poweredBy) technologies.push(`Powered by: ${poweredBy}`);

      return {
        description: `${name} operates at ${domain}`,
        technologies: technologies.length > 0 ? technologies : undefined,
        employeeCount: undefined,
        revenueRange: undefined,
        fundingStage: undefined,
        foundedYear: undefined,
        linkedinUrl: `https://linkedin.com/company/${this.slugify(name)}`,
      };
    } catch {
      return {
        description: `${name} operates at ${domain}`,
        technologies: undefined,
        employeeCount: undefined,
        revenueRange: undefined,
        fundingStage: undefined,
        foundedYear: undefined,
        linkedinUrl: `https://linkedin.com/company/${this.slugify(name)}`,
      };
    }
  }

  private guessDomain(companyName: string): string {
    return companyName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  }

  private extractName(domain: string): string {
    return domain.replace('.com', '').replace('.io', '').split('.')[0];
  }

  private slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
}