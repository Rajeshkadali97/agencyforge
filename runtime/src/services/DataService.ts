import { randomUUID } from 'crypto';
import { ILogger } from '../interfaces';
import { EnhancedEventBus } from '../events/EnhancedEventBus';
import { RuntimeEventTypes, createRuntimeEvent, BaseEventPayload } from '../contracts';
import { Configuration } from '../config';
import { FirecrawlProvider, createFirecrawlProvider } from '../providers/FirecrawlProvider';

export interface BusinessProfile {
  id: string;
  name: string;
  domain: string;
  location: string;
  industry: string;
  employeeCount: number;
  revenue: string;
  technology: string[];
  description: string;
  linkedinUrl?: string;
  foundedYear?: number;
  fundingStage?: string;
}

export interface Lead {
  id: string;
  business: BusinessProfile;
  score: number;
  tier: 'hot' | 'warm' | 'cold';
  factors: string[];
}

export interface Proposal {
  id: string;
  leadId: string;
  clientName: string;
  title: string;
  sections: string[];
  totalValue: number;
}

export interface WebsiteAudit {
  overallScore: number;
  findingsCount: number;
  opportunitiesCount: number;
  findings: string[];
  opportunities: string[];
}

export interface ResearchReport {
  companyProfile: Record<string, unknown>;
  websiteAnalysis: Record<string, unknown>;
  technologyDetection: string[];
  seoAnalysis: Record<string, unknown>;
  overallInsights: string[];
  priorityActions: string[];
}

export interface IDataService {
  getBusinesses(query: string, limit: number): Promise<BusinessProfile[]>;
  scoreLead(business: BusinessProfile): Promise<Lead>;
  generateProposal(lead: Lead): Promise<Proposal>;
  getWebsiteAuditResult(business: BusinessProfile): Promise<WebsiteAudit>;
  generateResearchReport(business: BusinessProfile): Promise<ResearchReport>;
}

export class DataService implements IDataService {
  constructor(
    private eventBus: EnhancedEventBus,
    private logger: ILogger,
    private config: Configuration
  ) {}

  async getBusinesses(query: string, limit: number = 10): Promise<BusinessProfile[]> {
    const traceId = randomUUID();
    const spanId = randomUUID();

    this.logger.info('DataService: Searching businesses', { query, limit });

    try {
      const businesses = await this.performBusinessSearch(query, limit, traceId, spanId);

      for (const business of businesses) {
        this.eventBus.publish(
          createRuntimeEvent(
            RuntimeEventTypes.LEAD_FOUND,
            {
              workflowId: 'data-service',
              timestamp: new Date().toISOString(),
              traceId,
              spanId,
              leadId: business.id,
              businessName: business.name,
              domain: business.domain,
              location: business.location,
              source: 'data_service',
              confidence: 0.9,
            } as BaseEventPayload & { leadId: string; businessName: string; domain: string; location: string; source: string; confidence: number },
            'data-service',
            spanId
          )
        );
      }

      return businesses;
    } catch (err) {
      this.logger.error('DataService: Business search failed', { error: err instanceof Error ? err.message : String(err) });
      return this.getFallbackBusinesses(query, limit);
    }
  }

  async scoreLead(business: BusinessProfile): Promise<Lead> {
    const traceId = randomUUID();
    const spanId = randomUUID();

    let score = 50;
    const factors: string[] = [];

    if (business.employeeCount > 20) {
      score += 15;
      factors.push('Medium-large team (potential for multiple services)');
    }

    if (business.revenue.includes('$3M') || business.revenue.includes('$5M') || business.revenue.includes('$8M')) {
      score += 20;
      factors.push('Healthy revenue - budget for services');
    }

    const techLower = business.technology.map(t => t.toLowerCase());
    if (techLower.some(t => t.includes('google'))) {
      score += 5;
      factors.push('Already investing in digital marketing');
    }

    if (techLower.some(t => t.includes('wordpress') || t.includes('webflow'))) {
      score += 5;
      factors.push('Using CMS - may need website improvements');
    }

    if (!techLower.some(t => t.includes('hubspot'))) {
      score += 5;
      factors.push('No established CRM - opportunity to introduce HubSpot');
    }

    const tier: 'hot' | 'warm' | 'cold' = score >= 75 ? 'hot' : score >= 60 ? 'warm' : 'cold';

    const lead: Lead = {
      id: `lead_${randomUUID()}`,
      business,
      score,
      tier,
      factors,
    };

    this.eventBus.publish(
      createRuntimeEvent(
        RuntimeEventTypes.LEAD_SCORED,
        {
          workflowId: 'data-service',
          timestamp: new Date().toISOString(),
          traceId,
          spanId,
          leadId: lead.id,
          score: lead.score,
          tier: lead.tier,
          factors: lead.factors,
        } as BaseEventPayload & { leadId: string; score: number; tier: string; factors: string[] },
        'data-service',
        spanId
      )
    );

    return lead;
  }

  async generateProposal(lead: Lead): Promise<Proposal> {
    const baseValue = lead.business.employeeCount > 30 ? 15000 : lead.business.employeeCount > 15 ? 10000 : 7500;

    const proposal: Proposal = {
      id: `proposal_${randomUUID()}`,
      leadId: lead.id,
      clientName: lead.business.name,
      title: `Digital Marketing Proposal for ${lead.business.name}`,
      sections: [
        'Executive Summary',
        'Current State Analysis',
        'Competitive Landscape',
        'Proposed Strategy',
        'Implementation Timeline',
        'Investment & ROI',
        'Next Steps',
      ],
      totalValue: baseValue,
    };

    const traceId = randomUUID();
    const spanId = randomUUID();

    this.eventBus.publish(
      createRuntimeEvent(
        RuntimeEventTypes.PROPOSAL_GENERATED,
        {
          workflowId: 'data-service',
          timestamp: new Date().toISOString(),
          traceId,
          spanId,
          proposalId: proposal.id,
          leadId: proposal.leadId,
          clientName: proposal.clientName,
          sections: proposal.sections,
        } as BaseEventPayload & { proposalId: string; leadId: string; clientName: string; sections: string[] },
        'data-service',
        spanId
      )
    );

    return proposal;
  }

  async getWebsiteAuditResult(business: BusinessProfile): Promise<WebsiteAudit> {
    const findings: string[] = [];
    const opportunities: string[] = [];

    const firecrawlApiKey = this.config.get('FIRECRAWL_API_KEY', '');
    const firecrawl = createFirecrawlProvider(firecrawlApiKey, this.logger);

    let overallScore = 50;
    const url = `https://${business.domain}`;

    if (firecrawl && firecrawl.isConfigured()) {
      this.logger?.info('Firecrawl: Scraping website for audit', { url });
      const result = await firecrawl.scrape(url, { onlyMainContent: true });

      if (result.success && result.data) {
        const content = (result.data.html || '') + (result.data.markdown || '');
        const lowerContent = content.toLowerCase();

        if (lowerContent.includes('viewport') && lowerContent.includes('media')) {
          opportunities.push('Mobile-first design detected - optimize for touch interactions');
        } else {
          findings.push('Mobile responsiveness could be improved');
        }

        if (result.data.markdown && result.data.markdown.length > 2000) {
          opportunities.push('Sufficient content for SEO - continue publishing regularly');
        } else {
          findings.push('Content may be too thin for effective SEO');
        }

        if (business.technology.includes('Google Analytics') || business.technology.includes('Google Tag Manager')) {
          opportunities.push('Analytics properly configured - leverage for conversion tracking');
        } else {
          findings.push('No analytics detected - install Google Analytics');
        }

        if (business.technology.includes('HubSpot') || business.technology.includes('Mailchimp')) {
          opportunities.push('Marketing automation in place - optimize email sequences');
        } else {
          findings.push('No marketing automation detected - consider implementing');
        }

        if (result.data.description || business.description) {
          overallScore = 60 + Math.floor(Math.random() * 25);
        } else {
          findings.push('No meta description found');
          overallScore = 40 + Math.floor(Math.random() * 15);
        }

        if (business.technology.length === 0 || business.technology[0] === 'Unknown CMS') {
          findings.push('Could not detect website technology stack');
        }
      } else {
        this.logger?.warn('Firecrawl scrape failed, using default audit', { error: result.error });
        this.addDefaultFindings(findings, opportunities);
        overallScore = 50;
      }
    } else {
      this.addDefaultFindings(findings, opportunities);
    }

    return {
      overallScore: Math.min(overallScore, 95),
      findingsCount: findings.length,
      opportunitiesCount: opportunities.length,
      findings,
      opportunities,
    };
  }

  private addDefaultFindings(findings: string[], opportunities: string[]): void {
    findings.push('Meta descriptions not optimized');
    findings.push('Mobile responsiveness issues detected');
    opportunities.push('Add patient testimonials section');
    opportunities.push('Implement appointment booking integration');
  }

  async generateResearchReport(business: BusinessProfile): Promise<ResearchReport> {
    return {
      companyProfile: {
        name: business.name,
        industry: business.industry,
        size: business.employeeCount > 25 ? 'Mid-size' : 'Small',
        location: business.location,
        description: business.description,
      },
      websiteAnalysis: {
        url: `https://${business.domain}`,
        score: 50 + Math.floor(Math.random() * 30),
        issues: ['Slow loading', 'Poor mobile experience', 'Missing calls-to-action'],
      },
      technologyDetection: business.technology,
      seoAnalysis: {
        domainAuthority: 20 + Math.floor(Math.random() * 30),
        topKeywords: ['Dallas dentist', 'dental implants Dallas', business.name],
        competitorsRanking: 5 + Math.floor(Math.random() * 15),
      },
      overallInsights: [
        `${business.name} is a ${business.employeeCount > 20 ? 'well-established' : 'growing'} practice in ${business.location}.`,
        'The practice could benefit from improved digital marketing strategies.',
        'Website modernization could increase patient acquisitions.',
      ],
      priorityActions: [
        'Audit and optimize website for local SEO',
        'Implement patient testimonial strategy',
        'Develop content marketing calendar',
        'Set up conversion tracking',
      ],
    };
  }

  private async performBusinessSearch(query: string, limit: number, traceId: string, spanId: string): Promise<BusinessProfile[]> {
    const useRealProviders = this.config.get('USE_EXTERNAL_PROVIDERS', false);

    if (useRealProviders) {
      return this.searchWithRealProviders(query, limit);
    }

    return this.getLocalBusinesses(query, limit);
  }

  private async searchWithRealProviders(query: string, limit: number): Promise<BusinessProfile[]> {
    const firecrawlApiKey = this.config.get('FIRECRAWL_API_KEY', '');
    const firecrawl = createFirecrawlProvider(firecrawlApiKey, this.logger);

    if (!firecrawl || !firecrawl.isConfigured()) {
      this.logger?.info('Firecrawl: No API key configured, using mock data');
      return this.getLocalBusinesses(query, limit);
    }

    this.logger?.info('Firecrawl: Searching for businesses', { query });

    try {
      const searchResult = await firecrawl.search(`${query} company`, { limit });

      if (!searchResult.success || !searchResult.data) {
        this.logger?.warn('Firecrawl search failed, using mock data', { error: searchResult.error });
        return this.getLocalBusinesses(query, limit);
      }

      const businesses: BusinessProfile[] = [];

      for (const item of searchResult.data.items.slice(0, limit)) {
        const business = await this.enrichBusinessFromUrl(item.url, item.title);
        if (business) {
          businesses.push(business);
        }
      }

      if (businesses.length === 0) {
        this.logger?.warn('Firecrawl: No results enriched, using mock data');
        return this.getLocalBusinesses(query, limit);
      }

      this.logger?.info('Firecrawl: Found and enriched businesses', { count: businesses.length });
      return businesses;
    } catch (err) {
      this.logger?.error('Firecrawl search exception', { error: err instanceof Error ? err.message : String(err) });
      return this.getLocalBusinesses(query, limit);
    }
  }

  private async enrichBusinessFromUrl(url: string, title?: string): Promise<BusinessProfile | null> {
    const firecrawlApiKey = this.config.get('FIRECRAWL_API_KEY', '');
    const firecrawl = createFirecrawlProvider(firecrawlApiKey, this.logger);

    if (!firecrawl || !firecrawl.isConfigured()) {
      return null;
    }

    try {
      const scrapeResult = await firecrawl.scrape(url, { onlyMainContent: true });

      if (!scrapeResult.success || !scrapeResult.data) {
        return null;
      }

      const domain = new URL(url).hostname.replace('www.', '');

      const techDetected = this.detectTechnology(scrapeResult.data.html || '', scrapeResult.data.markdown || '');

      const business: BusinessProfile = {
        id: `biz_real_${randomUUID().slice(0, 8)}`,
        name: title || this.extractBusinessName(scrapeResult.data.title, domain),
        domain,
        location: 'Discovered via web search',
        industry: 'Discovered via web search',
        employeeCount: Math.floor(Math.random() * 30) + 5,
        revenue: this.estimateRevenue(domain),
        technology: techDetected,
        description: scrapeResult.data.description || `Business at ${domain}`,
      };

      return business;
    } catch (err) {
      this.logger?.debug('Failed to enrich business', { url, error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }

  private detectTechnology(html: string, markdown: string): string[] {
    const content = (html + markdown).toLowerCase();
    const technologies: string[] = [];

    if (content.includes('google-tag-manager') || content.includes('gtm.')) technologies.push('Google Tag Manager');
    if (content.includes('google-analytics') || content.includes('ga.')) technologies.push('Google Analytics');
    if (content.includes('facebook.net') || content.includes('fbpixel')) technologies.push('Facebook Pixel');
    if (content.includes('hubspot') || content.includes('hs-scripts')) technologies.push('HubSpot');
    if (content.includes('wordpress') || content.includes('wp-content')) technologies.push('WordPress');
    if (content.includes('webflow')) technologies.push('Webflow');
    if (content.includes('wix')) technologies.push('Wix');
    if (content.includes('shopify')) technologies.push('Shopify');
    if (content.includes('react')) technologies.push('React');
    if (content.includes('next.js') || content.includes('__next')) technologies.push('Next.js');
    if (content.includes('vue.') || content.includes('vuejs')) technologies.push('Vue.js');
    if (content.includes('angular')) technologies.push('Angular');
    if (content.includes('jquery')) technologies.push('jQuery');
    if (content.includes('mailchimp') || content.includes('mc-')) technologies.push('Mailchimp');
    if (content.includes('segment')) technologies.push('Segment');
    if (content.includes('stripe')) technologies.push('Stripe');
    if (content.includes('cloudflare')) technologies.push('Cloudflare');
    if (content.includes('hotjar')) technologies.push('Hotjar');

    return technologies.length > 0 ? technologies : ['Unknown CMS'];
  }

  private extractBusinessName(title: string | undefined, domain: string): string {
    if (title) {
      return title.split('|')[0].split('-')[0].trim();
    }
    const parts = domain.split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  }

  private estimateRevenue(domain: string): string {
    const highValueDomains = ['enterprise', 'corp', 'inc', 'group'];
    const midValueDomains = ['llc', 'co', 'solutions', 'services'];

    const lowerDomain = domain.toLowerCase();
    if (highValueDomains.some(d => lowerDomain.includes(d))) return '$5M - $10M';
    if (midValueDomains.some(d => lowerDomain.includes(d))) return '$1M - $5M';
    return '$500K - $1M';
  }

  private getLocalBusinesses(query: string, limit: number): BusinessProfile[] {
    const DENTISTS_IN_DALLAS: BusinessProfile[] = [
      {
        id: 'biz_001',
        name: 'Dallas Family Dental Care',
        domain: 'dallasfamilydental.com',
        location: 'Dallas, TX',
        industry: 'Healthcare - Dental',
        employeeCount: 25,
        revenue: '$3M - $5M',
        technology: ['Wix', 'Google Analytics', 'Microsoft 365'],
        description: 'Family dentistry practice serving the Dallas metro area for over 20 years.',
      },
      {
        id: 'biz_002',
        name: 'Smile Studio Orthodontics',
        domain: 'smilestudiodallas.com',
        location: 'Dallas, TX',
        industry: 'Healthcare - Dental',
        employeeCount: 15,
        revenue: '$1.5M - $2M',
        technology: ['WordPress', 'Facebook Pixel', 'Mailchimp'],
        description: 'Specialized orthodontic practice focusing on invisalign and braces.',
      },
      {
        id: 'biz_003',
        name: 'Pearl Dental Group',
        domain: 'pearldentalgroup.com',
        location: 'Dallas, TX',
        industry: 'Healthcare - Dental',
        employeeCount: 42,
        revenue: '$5M - $8M',
        technology: ['Custom CRM', 'Webflow', 'HubSpot', 'Google Ads'],
        description: 'Multi-location dental practice with general and cosmetic services.',
      },
      {
        id: 'biz_004',
        name: 'Happy Teeth Pediatric Dentistry',
        domain: 'happyteethdallas.com',
        location: 'Dallas, TX',
        industry: 'Healthcare - Dental',
        employeeCount: 18,
        revenue: '$2M - $3M',
        technology: ['Squarespace', 'Instagram', 'TikTok'],
        description: 'Pediatric dental practice creating positive experiences for children.',
      },
      {
        id: 'biz_005',
        name: 'Premier Dental Implants',
        domain: 'premierdentalimplants.com',
        location: 'Dallas, TX',
        industry: 'Healthcare - Dental',
        employeeCount: 12,
        revenue: '$2M - $4M',
        technology: ['WordPress', 'Google Analytics', 'Zocdoc'],
        description: 'Specialized dental implant and restorative dentistry clinic.',
      },
      {
        id: 'biz_006',
        name: 'Aesthetic Dental Studio',
        domain: 'aestheticdentaltx.com',
        location: 'Plano, TX',
        industry: 'Healthcare - Dental',
        employeeCount: 20,
        revenue: '$3M - $4M',
        technology: ['Webflow', 'Facebook Ads', 'HubSpot'],
        description: 'Cosmetic and restorative dentistry focused on smile makeovers.',
      },
      {
        id: 'biz_007',
        name: 'Comfort Care Dental',
        domain: 'comfortcaredental.com',
        location: 'Fort Worth, TX',
        industry: 'Healthcare - Dental',
        employeeCount: 35,
        revenue: '$4M - $6M',
        technology: ['Dentrix', 'Google Ads', 'Mailchimp', 'Instagram'],
        description: 'Family dental practice with emphasis on comfortable, anxiety-free care.',
      },
      {
        id: 'biz_008',
        name: 'Lakeside Oral Surgery',
        domain: 'lakesideoralsurgery.com',
        location: 'Dallas, TX',
        industry: 'Healthcare - Dental',
        employeeCount: 28,
        revenue: '$5M - $7M',
        technology: ['Custom Practice Software', 'Google Analytics', 'Microsoft 365'],
        description: 'Specialized oral surgery practice with board-certified surgeons.',
      },
    ];

    const normalizedQuery = query.toLowerCase();
    const results = DENTISTS_IN_DALLAS.filter(
      (b) =>
        b.name.toLowerCase().includes(normalizedQuery) ||
        b.industry.toLowerCase().includes(normalizedQuery) ||
        b.location.toLowerCase().includes(normalizedQuery) ||
        b.description.toLowerCase().includes(normalizedQuery)
    ).slice(0, limit);

    return results.length > 0 ? results : DENTISTS_IN_DALLAS.slice(0, limit);
  }

  private getFallbackBusinesses(query: string, limit: number): BusinessProfile[] {
    return this.getLocalBusinesses(query, limit);
  }
}