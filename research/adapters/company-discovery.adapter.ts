import { ICompanyDiscovery } from '../shared/interfaces';
import { CompanyProfile, ResearchRequest } from '../shared/types';
import { IProvider } from '../providers/types';
import { CompanyDiscoveryInput, CompanyDiscoveryOutput } from '../providers/types';

// Adapter that converts between ICompanyDiscovery (shared interface) and IProvider<CompanyDiscoveryInput, CompanyDiscoveryOutput>
export class CompanyDiscoveryAdapter implements ICompanyDiscovery {
  constructor(private provider: IProvider<CompanyDiscoveryInput, CompanyDiscoveryOutput>) {}

  async discover(request: ResearchRequest): Promise<CompanyProfile> {
    const providerInput: CompanyDiscoveryInput = {
      companyName: request.company_name,
      domain: request.domain,
      industry: request.industry,
      location: request.location,
      depth: request.depth
    };

    const providerOutput = await this.provider.execute(providerInput);
    
    // Convert from provider output to shared CompanyProfile
    const profile: CompanyProfile = {
      name: providerOutput.name,
      domain: providerOutput.domain,
      industry: providerOutput.industry,
      location: providerOutput.location,
      website_url: providerOutput.websiteUrl,
      description: providerOutput.description,
      founded: providerOutput.foundedYear,
      employee_count: providerOutput.employeeCount,
      revenue_range: providerOutput.revenueRange,
      funding_stage: providerOutput.fundingStage,
      linkedin_url: providerOutput.linkedinUrl,
      technologies: providerOutput.technologies,
      social_profiles: providerOutput.socialProfiles
    };

    return profile;
  }

  async enrich(companyName: string, domain?: string): Promise<CompanyProfile> {
    const providerInput: CompanyDiscoveryInput = {
      companyName: companyName,
      domain: domain,
      depth: 'deep' // Enrich implies deep depth
    };

    const providerOutput = await this.provider.execute(providerInput);
    
    // Convert from provider output to shared CompanyProfile
    const profile: CompanyProfile = {
      name: providerOutput.name,
      domain: providerOutput.domain,
      industry: providerOutput.industry,
      location: providerOutput.location,
      website_url: providerOutput.websiteUrl,
      description: providerOutput.description,
      founded: providerOutput.foundedYear,
      employee_count: providerOutput.employeeCount,
      revenue_range: providerOutput.revenueRange,
      funding_stage: providerOutput.fundingStage,
      linkedin_url: providerOutput.linkedinUrl,
      technologies: providerOutput.technologies,
      social_profiles: providerOutput.socialProfiles
    };

    return profile;
  }

  async search(query: string, filters?: Record<string, unknown>): Promise<CompanyProfile[]> {
    // The provider interface doesn't have a search method, so we'll implement a basic version
    // that uses discover with the query as company name
    const providerInput: CompanyDiscoveryInput = {
      companyName: query,
      industry: (filters?.industry as string) ?? undefined,
      location: (filters?.location as string) ?? undefined,
      depth: 'basic'
    };

    const providerOutput = await this.provider.execute(providerInput);
    
    // Convert from provider output to shared CompanyProfile
    const profile: CompanyProfile = {
      name: providerOutput.name,
      domain: providerOutput.domain,
      industry: providerOutput.industry,
      location: providerOutput.location,
      website_url: providerOutput.websiteUrl,
      description: providerOutput.description,
      founded: providerOutput.foundedYear,
      employee_count: providerOutput.employeeCount,
      revenue_range: providerOutput.revenueRange,
      funding_stage: providerOutput.fundingStage,
      linkedin_url: providerOutput.linkedinUrl,
      technologies: providerOutput.technologies,
      social_profiles: providerOutput.socialProfiles
    };

    return [profile];
  }
}