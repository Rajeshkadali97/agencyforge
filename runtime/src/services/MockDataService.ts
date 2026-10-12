import { randomUUID } from 'crypto';

export interface MockBusiness {
  id: string;
  name: string;
  domain: string;
  location: string;
  industry: string;
  employeeCount: number;
  revenue: string;
  technology: string[];
  description: string;
}

export interface MockLead {
  id: string;
  business: MockBusiness;
  score: number;
  tier: 'hot' | 'warm' | 'cold';
  factors: string[];
}

export interface MockProposal {
  id: string;
  leadId: string;
  clientName: string;
  title: string;
  sections: string[];
  totalValue: number;
}

export class MockDataService {
  private static readonly DENTISTS_IN_DALLAS: MockBusiness[] = [
    {
      id: 'biz_001',
      name: 'Dallas Family Dental Care',
      domain: 'dallasfamilydental.com',
      location: 'Dallas, TX',
      industry: 'Healthcare - Dental',
      employeeCount: 25,
      revenue: '$3M - $5M',
      technology: [' Wix', 'Google Analytics', 'Microsoft 365'],
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
  ];

  private businessIndex = 0;

  getBusinesses(query: string, limit: number = 10): MockBusiness[] {
    const normalizedQuery = query.toLowerCase();
    const results = MockDataService.DENTISTS_IN_DALLAS.filter(
      (b) =>
        b.name.toLowerCase().includes(normalizedQuery) ||
        b.industry.toLowerCase().includes(normalizedQuery) ||
        b.location.toLowerCase().includes(normalizedQuery) ||
        b.description.toLowerCase().includes(normalizedQuery)
    ).slice(0, limit);

    return results.length > 0 ? results : [this.getNextBusiness()];
  }

  getNextBusiness(): MockBusiness {
    const business = MockDataService.DENTISTS_IN_DALLAS[this.businessIndex];
    this.businessIndex = (this.businessIndex + 1) % MockDataService.DENTISTS_IN_DALLAS.length;
    return business;
  }

  scoreLead(business: MockBusiness): MockLead {
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

    if (business.technology.some((t) => t.toLowerCase().includes('google'))) {
      score += 5;
      factors.push('Already investing in digital marketing');
    }

    if (business.technology.some((t) => t.toLowerCase().includes('wordpress') || t.toLowerCase().includes('webflow'))) {
      score += 5;
      factors.push('Using CMS - may need website improvements');
    }

    if (!business.technology.some((t) => t.toLowerCase().includes('hubspot'))) {
      score += 5;
      factors.push('No established CRM - opportunity to introduce HubSpot');
    }

    const tier: 'hot' | 'warm' | 'cold' = score >= 75 ? 'hot' : score >= 60 ? 'warm' : 'cold';

    return {
      id: `lead_${randomUUID()}`,
      business,
      score,
      tier,
      factors,
    };
  }

  generateProposal(lead: MockLead): MockProposal {
    const baseValue = lead.business.employeeCount > 30 ? 15000 : lead.business.employeeCount > 15 ? 10000 : 7500;

    return {
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
  }

  getWebsiteAuditResult(business: MockBusiness): {
    overallScore: number;
    findingsCount: number;
    opportunitiesCount: number;
    findings: string[];
    opportunities: string[];
  } {
    const score = 40 + Math.floor(Math.random() * 40);
    const findingsCount = 3 + Math.floor(Math.random() * 5);
    const opportunitiesCount = 2 + Math.floor(Math.random() * 4);

    const findings = [
      'Meta descriptions not optimized',
      'Mobile responsiveness issues detected',
      'Page load speed could be improved',
      'Missing structured data markup',
      'Contact form not functioning properly',
    ].slice(0, findingsCount);

    const opportunities = [
      'Add patient testimonials section',
      'Implement appointment booking integration',
      'Create service-specific landing pages',
      'Optimize for local SEO',
      'Add video content',
    ].slice(0, opportunitiesCount);

    return {
      overallScore: score,
      findingsCount,
      opportunitiesCount,
      findings,
      opportunities,
    };
  }

  generateResearchReport(business: MockBusiness): {
    companyProfile: Record<string, unknown>;
    websiteAnalysis: Record<string, unknown>;
    technologyDetection: string[];
    seoAnalysis: Record<string, unknown>;
    overallInsights: string[];
    priorityActions: string[];
  } {
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
        topKeywords: ['Dallas dentist', 'dental implants Dallas', `${business.name}`],
        competitorsRanking: 5 + Math.floor(Math.random() * 15),
      },
      overallInsights: [
        `${business.name} is a ${business.employeeCount > 20 ? 'well-established' : 'growing'} dental practice in ${business.location}.`,
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

  reset(): void {
    this.businessIndex = 0;
  }
}