import { IProvider, CompanyDiscoveryInput, CompanyDiscoveryOutput } from '../types';

export class MockCompanyDiscoveryProvider implements IProvider<CompanyDiscoveryInput, CompanyDiscoveryOutput> {
  readonly id = 'mock-company-discovery';
  readonly name = 'Mock Company Discovery Provider';
  readonly version = '1.0.0';
  readonly capabilities = ['basic', 'standard', 'deep'];
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
    
    // Deterministic output based on input
    const baseOutput: CompanyDiscoveryOutput = {
      name,
      domain,
      industry: input.industry ?? 'Technology',
      location: input.location ?? 'Unknown',
      websiteUrl: `https://${domain}`,
      dataQuality: 'complete',
      source: this.id,
      confidence: 0.95,
    };

    // Add deterministic values based on depth
    if (input.depth !== 'basic') {
      // Generate deterministic values based on the company name/domain
      const nameHash = this.hashString(name);
      const domainHash = this.hashString(domain);
      
      const enhanced: Partial<CompanyDiscoveryOutput> = {
        description: `${name} is a leading ${input.industry ?? 'technology'} company ${input.location ? `based in ${input.location}` : ''}.`,
        foundedYear: 2000 + (nameHash % 24), // 2000-2023
        employeeCount: 10 + (nameHash % 490), // 10-499
        revenueRange: ['$0-1M', '$1-10M', '$10-50M', '$50M-100M', '$100M+'][nameHash % 5],
        fundingStage: ['Bootstrapped', 'Seed', 'Series A', 'Series B', 'Series C', 'IPO'][nameHash % 6],
        linkedinUrl: `https://linkedin.com/company/${this.slugify(name)}`,
        technologies: this.getDeterministicTechnologies(nameHash, domainHash),
        socialProfiles: {
          linkedin: `https://linkedin.com/company/${this.slugify(name)}`,
          twitter: `https://twitter.com/${this.slugify(name)}`,
          facebook: `https://facebook.com/${this.slugify(name)}`
        }
      };
      
      return { ...baseOutput, ...enhanced };
    }
    
    return baseOutput;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  private guessDomain(companyName: string): string {
    return `${this.slugify(companyName)}.com`;
  }

  private extractName(domain: string): string {
    return domain.replace('.com', '').replace('.io', '').split('.')[0];
  }

  private getDeterministicTechnologies(nameHash: number, domainHash: number): string[] {
    const techOptions = [
      'React', 'Vue.js', 'Angular', 'Svelte', 
      'Node.js', 'Python', 'Java', 'Go', 'Ruby',
      'AWS', 'Azure', 'Google Cloud', 'Heroku',
      'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
      'GraphQL', 'REST API', 'Docker', 'Kubernetes',
      'WordPress', 'Shopify', 'Stripe', 'PayPal',
      'Google Analytics', 'Mixpanel', 'HubSpot', 'Salesforce'
    ];
    
    // Select 3-6 technologies deterministically based on hash
    const techCount = 3 + (nameHash % 4); // 3-6 technologies
    const selected: string[] = [];
    
    for (let i = 0; i < techCount; i++) {
      const index = (nameHash + i * domainHash) % techOptions.length;
      if (!selected.includes(techOptions[index])) {
        selected.push(techOptions[index]);
      }
    }
    
    return selected;
  }
}