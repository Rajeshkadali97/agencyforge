import { ICompanyDiscovery, CompanyProfile, ResearchRequest } from '../shared';

export class CompanyDiscovery implements ICompanyDiscovery {
  private cache: Map<string, CompanyProfile> = new Map();

  async discover(request: ResearchRequest): Promise<CompanyProfile> {
    const cacheKey = `${request.company_name ?? ''}-${request.domain ?? ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const profile: CompanyProfile = {
      name: request.company_name ?? 'Unknown Company',
      domain: request.domain,
      industry: request.industry,
      location: request.location,
      website_url: request.domain ? `https://${request.domain}` : undefined,
    };

    if (request.domain) {
      profile.linkedin_url = `https://linkedin.com/company/${this.slugify(request.domain)}`;
    }

    if (request.depth !== 'basic') {
      profile.description = await this.enrichDescription(profile);
      profile.technologies = await this.detectTechnologies(profile.domain);
      profile.employee_count = this.estimateEmployeeCount(profile);
    }

    this.cache.set(cacheKey, profile);
    return profile;
  }

  async enrich(companyName: string, domain?: string): Promise<CompanyProfile> {
    return this.discover({ company_name: companyName, domain, depth: 'deep' });
  }

  async search(query: string, filters?: Record<string, unknown>): Promise<CompanyProfile[]> {
    return [{
      name: query,
      domain: this.guessDomain(query),
      industry: (filters?.industry as string) ?? undefined,
      location: (filters?.location as string) ?? undefined,
    }];
  }

  private async enrichDescription(profile: CompanyProfile): Promise<string> {
    return `${profile.name} operates in the ${profile.industry ?? 'technology'} sector${profile.location ? `, based in ${profile.location}` : ''}.`;
  }

  private async detectTechnologies(domain?: string): Promise<string[]> {
    if (!domain) return [];
    return ['React', 'Node.js', 'AWS', 'Google Analytics'];
  }

  private estimateEmployeeCount(profile: CompanyProfile): number {
    if (profile.industry?.toLowerCase().includes('startup')) return Math.floor(Math.random() * 50) + 5;
    if (profile.industry?.toLowerCase().includes('enterprise')) return Math.floor(Math.random() * 5000) + 500;
    return Math.floor(Math.random() * 200) + 10;
  }

  private slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  private guessDomain(name: string): string {
    return `${this.slugify(name)}.com`;
  }
}