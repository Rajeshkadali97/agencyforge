import { IProvider, CompetitorAnalysisInput, CompetitorAnalysisOutput } from '../types';

export class MockCompetitorAnalysisProvider implements IProvider<CompetitorAnalysisInput, CompetitorAnalysisOutput> {
  readonly id = 'mock-competitor-analysis';
  readonly name = 'Mock Competitor Analysis Provider';
  readonly version = '1.0.0';
  readonly capabilities = ['competitor-discovery', 'market-gaps', 'opportunities'];
  readonly priority = 10;
  readonly requiresApiKey = false;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  validateInput(input: CompetitorAnalysisInput): boolean {
    return !!input.targetDomain;
  }

  async execute(input: CompetitorAnalysisInput): Promise<CompetitorAnalysisOutput> {
    // Deterministic output based on domain
    const domainHash = this.hashString(input.targetDomain);
    const limit = input.limit ?? 5;
    
    const baseOutput: CompetitorAnalysisOutput = {
      targetCompany: this.extractDomainName(input.targetDomain),
      competitors: [],
      dataQuality: 'complete',
      source: this.id,
      confidence: 0.82,
    };

    // Deterministic competitor generation based on domain
    const competitors: CompetitorAnalysisOutput['competitors'] = [];
    const competitorCount = Math.min(3 + (domainHash % 3), limit); // 3-5 competitors
    
    // Predefined competitor templates based on industry types
    const competitorTemplates = [
      { name: 'AlphaCorp', domain: 'alphacorp.com', similarityBase: 0.85 },
      { name: 'BetaSystems', domain: 'betasystems.net', similarityBase: 0.78 },
      { name: 'GammaTech', domain: 'gammatech.io', similarityBase: 0.72 },
      { name: 'Delta Solutions', domain: 'deltasolutions.org', similarityBase: 0.68 },
      { name: 'Epsilon Innovations', domain: 'epsilontech.biz', similarityBase: 0.65 },
      { name: 'Zeta Dynamics', domain: 'zetadyne.co', similarityBase: 0.62 },
      { name: 'Eta Solutions', domain: 'etasolutions.info', similarityBase: 0.58 },
      { name: 'Theta Industries', domain: 'thetaindustries.com', similarityBase: 0.55 }
    ];
    
    for (let i = 0; i < competitorCount; i++) {
      const templateIndex = (domainHash + i * 7) % competitorTemplates.length;
      const template = competitorTemplates[templateIndex];
      
      // Calculate deterministic similarity score
      const similarityVariance = ((domainHash + i * 13) % 20) / 100; // 0.0-0.19
      const similarityScore = Math.max(0.3, Math.min(0.95, template.similarityBase - similarityVariance));
      
      // Generate deterministic attributes based on the hash
      const trafficEstimate = 1000 + ((domainHash + i * 17) % 9000); // 1000-9999
      
      const keywordCount = 2 + ((domainHash + i * 19) % 4); // 2-5 keywords
      const keywordsOverlap = this.generateKeywords(domainHash, i, keywordCount);
      
      const strengthCount = 2 + ((domainHash + i * 23) % 3); // 2-4 strengths
      const strengths = this.generateStrengths(domainHash, i, strengthCount);
      
      const weaknessCount = 1 + ((domainHash + i * 29) % 3); // 1-3 weaknesses
      const weaknesses = this.generateWeaknesses(domainHash, i, weaknessCount);
      
      competitors.push({
        name: template.name,
        domain: template.domain,
        similarityScore: Number((similarityScore + (domainHash % 10) / 100).toFixed(2)), // Add small deterministic variation
        trafficEstimate,
        keywordsOverlap,
        strengths,
        weaknesses,
        marketPosition: this.determineMarketPosition(similarityScore, i)
      });
    }
    
    // Sort by similarity score descending
    competitors.sort((a, b) => b.similarityScore - a.similarityScore);
    
    // Generate market gaps and opportunities
    const marketGaps = this.generateMarketGaps(domainHash, competitors);
    const opportunities = this.generateOpportunities(domainHash, competitors);
    
    const enhanced: Partial<CompetitorAnalysisOutput> = {
      competitors,
      marketGaps,
      opportunities
    };
    
    return { ...baseOutput, ...enhanced };
  }

  private extractDomainName(domain: string): string {
    return domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0];
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

  private generateKeywords(seed: number, index: number, count: number): string[] {
    const keywords: string[] = [];
    const keywordPool = [
      'business solutions', 'enterprise software', 'cloud services',
      'digital transformation', 'IT consulting', 'software development',
      'tech consulting', 'innovation services', 'technology solutions'
    ];
    
    for (let i = 0; i < count; i++) {
      const keywordIndex = (seed + i * 11 + index * 13) % keywordPool.length;
      if (!keywords.includes(keywordPool[keywordIndex])) {
        keywords.push(keywordPool[keywordIndex]);
      }
    }
    
    return keywords;
  }

  private generateStrengths(seed: number, index: number, count: number): string[] {
    const strengths: string[] = [];
    const strengthPool = [
      'Strong brand recognition', 'Innovative product features',
      'Excellent customer support', 'Competitive pricing',
      'Robust security measures', 'Fast performance',
      'User-friendly interface', 'Comprehensive documentation',
      'Active development community', 'Regular updates'
    ];
    
    for (let i = 0; i < count; i++) {
      const strengthIndex = (seed + i * 17 + index * 19) % strengthPool.length;
      if (!strengths.includes(strengthPool[strengthIndex])) {
        strengths.push(strengthPool[strengthIndex]);
      }
    }
    
    return strengths;
  }

  private generateWeaknesses(seed: number, index: number, count: number): string[] {
    const weaknesses: string[] = [];
    const weaknessPool = [
      'Limited market reach', 'Higher pricing than competitors',
      'Complex user interface', 'Limited integrations',
      'Slow feature releases', 'Poor mobile experience',
      'Inadequate documentation', 'Limited customization',
      'Steep learning curve', 'Inconsistent uptime'
    ];
    
    for (let i = 0; i < count; i++) {
      const weaknessIndex = (seed + i * 23 + index * 29) % weaknessPool.length;
      if (!weaknesses.includes(weaknessPool[weaknessIndex])) {
        weaknesses.push(weaknessPool[weaknessIndex]);
      }
    }
    
    return weaknesses;
  }

  private determineMarketPosition(similarityScore: number, index: number): string {
    if (index === 0) {
      return similarityScore > 0.8 ? 'Market Leader' : 'Strong Contender';
    }
    if (index === 1) {
      return similarityScore > 0.7 ? 'Established Player' : 'Growing Competitor';
    }
    return 'Niche Player';
  }

  private generateMarketGaps(seed: number, competitors: any[]): string[] {
    const gaps: string[] = [];
    const gapPool = [
      'Lack of affordable pricing tiers', 'Poor mobile experience',
      'Limited third-party integrations', 'Inadequate customer support',
      'Complex setup process', 'Missing advanced analytics',
      'Limited customization options', 'No free trial option',
      'Poor documentation', 'Slow loading times'
    ];
    
    // Collect weaknesses from all competitors to find common gaps
    const allWeaknesses = competitors.flatMap(c => 
      c.weaknesses || []
    );
    
    // Count occurrences of each weakness
    const weaknessCount: Record<string, number> = {};
    allWeaknesses.forEach(weakness => {
      weaknessCount[weakness] = (weaknessCount[weakness] || 0) + 1;
    });
    
    // Find weaknesses that appear in multiple competitors (market gaps)
    Object.entries(weaknessCount)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .forEach(([weakness]) => gaps.push(`Address common weakness: ${weakness}`));
    
    // Add some generic gaps if needed
    if (gaps.length < 2) {
      gaps.push('Offer more transparent pricing');
      gaps.push('Provide better developer experience');
    }
    
    return gaps.slice(0, 3);
  }

  private generateOpportunities(seed: number, competitors: any[]): string[] {
    const opportunities: string[] = [];
    const oppPool = [
      'Focus on underserved market segments',
      'Develop superior mobile applications',
      'Create more flexible pricing plans',
      'Build stronger integration ecosystem',
      'Provide exceptional customer support',
      'Offer comprehensive training resources',
      'Implement advanced AI-powered features',
      'Create industry-specific solutions',
      'Develop strategic partnerships',
      'Invest in cutting-edge research'
    ];
    
    // Select opportunities based on seed
    const oppCount = 2 + (seed % 3); // 2-4 opportunities
    for (let i = 0; i < oppCount; i++) {
      const index = (seed + i * 7) % oppPool.length;
      if (!opportunities.includes(oppPool[index])) {
        opportunities.push(oppPool[index]);
      }
    }
    
    return opportunities;
  }
}