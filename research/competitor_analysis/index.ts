import { ICompetitorAnalysis, CompetitorReport, CompetitorProfile } from '../shared';
import type { CompetitorAnalysisResult } from '../shared/types';

export class CompetitorAnalysis implements ICompetitorAnalysis {
  private static readonly COMPETITOR_DB: Record<string, string[]> = {
    'stripe.com': ['adyen.com', 'braint', 'checkout.com', 'squareup.com', 'braintreepayments.com'],
    'shopify.com': ['bigcommerce.com', 'woothemes.com', 'magento.com', 'squarespace.com'],
    'slack.com': ['discord.com', 'teams.microsoft.com', 'mattermost.com', 'rocket.chat'],
    'notion.so': ['obsidian.md', 'roamresearch.com', 'coda.io', 'airtable.com'],
    'figma.com': ['sketch.com', 'adobexd.com', 'framer.com', 'penpot.app'],
  };

  async analyze(companyName: string, domain?: string): Promise<CompetitorReport> {
    const competitors = await this.findCompetitors(companyName, domain);
    const targetDomain = domain ?? this.guessDomain(companyName);
    
    return {
      target_company: companyName,
      competitors,
      market_position: this.assessPosition(competitors.length),
      opportunities: this.identifyOpportunities(competitors),
      threats: this.identifyThreats(competitors),
    };
  }

  async findCompetitors(companyName: string, domain?: string, limit = 5): Promise<CompetitorProfile[]> {
    const targetDomain = domain ?? this.guessDomain(companyName);
    const knownCompetitors = CompetitorAnalysis.COMPETITOR_DB[targetDomain] ?? [];
    
    const competitors = knownCompetitors
      .slice(0, limit)
      .map((compDomain, i) => ({
        name: this.extractName(compDomain),
        domain: compDomain,
        similarity_score: 0.9 - i * 0.1,
        key_differences: this.generateDifferences(targetDomain, compDomain),
      }));

    return competitors;
  }

  private assessPosition(competitorCount: number): string {
    if (competitorCount >= 4) return 'Highly competitive market';
    if (competitorCount >= 2) return 'Moderate competition';
    return 'Niche market with few competitors';
  }

  private identifyOpportunities(competitors: CompetitorProfile[]): string[] {
    const opps: string[] = [];
    if (competitors.some(c => c.domain.includes('shopify'))) {
      opps.push('Differentiate with custom checkout experience');
    }
    if (competitors.some(c => c.domain.includes('slack'))) {
      opps.push('Focus on async communication workflows');
    }
    opps.push('Build stronger developer experience');
    opps.push('Offer transparent pricing');
    return opps.slice(0, 3);
  }

  async compare(domains: string[]): Promise<CompetitorAnalysisResult> {
    const allCompetitors: CompetitorAnalysisResult['competitors'] = [];
    for (const domain of domains) {
      const competitors = await this.findCompetitors(domain, domain);
      allCompetitors.push(...competitors.map(c => ({
        name: c.name,
        domain: c.domain,
        similarity_score: c.similarity_score,
        weaknesses: [],
      })));
    }
    return {
      target_company: domains.join(', '),
      competitors: allCompetitors,
      opportunities: [],
    };
  }

  private identifyThreats(competitors: CompetitorProfile[]): string[] {
    const threats: string[] = [];
    if (competitors.length >= 3) {
      threats.push('Market saturation risk');
    }
    if (competitors.some(c => c.similarity_score > 0.8)) {
      threats.push('High feature parity with top competitor');
    }
    threats.push('Pricing pressure from well-funded competitors');
    return threats.slice(0, 3);
  }

  private guessDomain(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  }

  private extractName(domain: string): string {
    return domain.replace('.com', '').replace('.io', '').split('.')[0];
  }

  private generateDifferences(target: string, competitor: string): string[] {
    const diffs = ['Different pricing model', 'Different target audience', 'Different feature focus'];
    return diffs.slice(0, 2);
  }
}