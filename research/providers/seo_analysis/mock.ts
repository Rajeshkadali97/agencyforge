import { IProvider, SEOAnalysisInput, SEOAnalysisOutput } from '../types';

export class MockSEOAnalysisProvider implements IProvider<SEOAnalysisInput, SEOAnalysisOutput> {
  readonly id = 'mock-seo-analysis';
  readonly name = 'Mock SEO Analysis Provider';
  readonly version = '1.0.0';
  readonly capabilities = ['technical', 'on-page', 'content', 'keywords'];
  readonly priority = 10;
  readonly requiresApiKey = false;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  validateInput(input: SEOAnalysisInput): boolean {
    return !!input.url;
  }

  async execute(input: SEOAnalysisInput): Promise<SEOAnalysisOutput> {
    // Deterministic output based on URL
    const urlHash = this.hashString(input.url);
    
    const baseOutput: SEOAnalysisOutput = {
      url: input.url,
      overallScore: 0,
      technicalSeo: { score: 0, issues: [] },
      onPageSeo: { score: 0, issues: [] },
      contentQuality: { score: 0, issues: [] },
      recommendations: [],
      dataQuality: 'complete',
      source: this.id,
      confidence: 0.88,
    };

    // Technical SEO score (0-100)
    const technicalScore = 60 + (urlHash % 40); // 60-99
    const technicalIssues = this.generateTechnicalIssues(urlHash, technicalScore);
    
    // On-page SEO score (0-100)
    const onPageScore = 55 + (urlHash % 45); // 55-99
    const onPageIssues = this.generateOnPageIssues(urlHash, onPageScore);
    
    // Content quality score (0-100)
    const contentScore = 50 + (urlHash % 50); // 50-99
    const contentIssues = this.generateContentIssues(urlHash, contentScore);
    
    // Overall score
    const overallScore = Math.round(
      technicalScore * 0.35 + onPageScore * 0.35 + contentScore * 0.3
    );
    
    // Backlinks (simplified)
    const backlinks = {
      score: 40 + (urlHash % 60), // 40-99
      referringDomains: 10 + (urlHash % 90), // 10-99
      totalBacklinks: 50 + (urlHash % 450) // 50-499
    };
    
    // Keywords (if requested)
    const keywords: SEOAnalysisOutput['keywords'] = input.includeKeywords ? 
      this.generateKeywords(urlHash) : [];
    
    // Recommendations
    const recommendations = this.generateRecommendations(
      { score: technicalScore, issues: technicalIssues },
      { score: onPageScore, issues: onPageIssues },
      { score: contentScore, issues: contentIssues }
    );
    
    const enhanced: Partial<SEOAnalysisOutput> = {
      overallScore,
      technicalSeo: {
        score: technicalScore,
        issues: technicalIssues
      },
      onPageSeo: {
        score: onPageScore,
        issues: onPageIssues
      },
      contentQuality: {
        score: contentScore,
        issues: contentIssues
      },
      backlinks,
      keywords,
      recommendations
    };
    
    return { ...baseOutput, ...enhanced };
  }

  private generateTechnicalIssues(seed: number, score: number): SEOAnalysisOutput['technicalSeo']['issues'] {
    const issues: SEOAnalysisOutput['technicalSeo']['issues'] = [];
    
    if (score < 70) {
      issues.push({ severity: 'critical' as const, message: 'Critical technical SEO issues found' });
    }
    if (score < 80) {
      issues.push({ severity: 'warning' as const, message: 'Some technical improvements needed' });
    }
    
    // Add some deterministic issues based on seed
    if ((seed % 3) === 0) {
      issues.push({ severity: 'warning' as const, message: 'Missing XML sitemap' });
    }
    if ((seed % 5) === 1) {
      issues.push({ severity: 'info' as const, message: 'Consider implementing structured data' });
    }
    if ((seed % 7) === 2) {
      issues.push({ severity: 'info' as const, message: 'Could improve page load speed' });
    }
    
    return issues;
  }

  private generateOnPageIssues(seed: number, score: number): SEOAnalysisOutput['onPageSeo']['issues'] {
    const issues: SEOAnalysisOutput['onPageSeo']['issues'] = [];
    
    if (score < 70) {
      issues.push({ severity: 'critical' as const, message: 'Critical on-page SEO issues found' });
    }
    if (score < 80) {
      issues.push({ severity: 'warning' as const, message: 'Some on-page optimization opportunities' });
    }
    
    // Add some deterministic issues based on seed
    if ((seed % 4) === 0) {
      issues.push({ severity: 'info' as const, message: 'Some on-page improvements needed' });
    }
    
    // Add some deterministic issues based on seed
    if ((seed % 3) === 0) {
      issues.push({ severity: 'warning' as const, message: 'Title tag too long' });
    }
    if ((seed % 4) === 1) {
      issues.push({ severity: 'info' as const, message: 'Meta description could be improved' });
    }
    if ((seed % 5) === 2) {
      issues.push({ severity: 'warning' as const, message: 'Missing alt text on some images' });
    }
    
    return issues;
  }

  private generateContentIssues(seed: number, score: number): SEOAnalysisOutput['contentQuality']['issues'] {
    const issues: SEOAnalysisOutput['contentQuality']['issues'] = [];
    
    if (score < 70) {
      issues.push({ severity: 'warning' as const, message: 'Content quality could be improved' });
    }
    if (score < 80) {
      issues.push({ severity: 'info' as const, message: 'Consider adding more detailed content' });
    }
    
    // Add some deterministic issues based on seed
    if ((seed % 6) === 0) {
      issues.push({ severity: 'info' as const, message: 'Low word count for target keywords' });
    }
    if ((seed % 8) === 1) {
      issues.push({ severity: 'info' as const, message: 'Could improve readability' });
    }
    
    return issues;
  }

  private generateKeywords(seed: number): SEOAnalysisOutput['keywords'] {
    const keywords: SEOAnalysisOutput['keywords'] = [];
    const keywordCount = 3 + (seed % 3); // 3-5 keywords
    
    const baseKeywords = [
      'business services', 'company solutions', 'professional consulting',
      'enterprise solutions', 'digital transformation', 'cloud services',
      'software development', 'IT consulting', 'business consulting'
    ];
    
    for (let i = 0; i < keywordCount; i++) {
      const index = (seed + i * 13) % baseKeywords.length;
      keywords.push({
        keyword: baseKeywords[index],
        position: 1 + (seed % 50), // 1-50
        volume: 100 + (seed % 9900), // 100-9999
        difficulty: 20 + (seed % 80) // 20-99
      });
    }
    
    return keywords;
  }

  private generateRecommendations(
    technical: SEOAnalysisOutput['technicalSeo'],
    onPage: SEOAnalysisOutput['onPageSeo'],
    content: SEOAnalysisOutput['contentQuality']
  ): string[] {
    const recs: string[] = [];
    
    if (technical.score < 70) {
      recs.push('Fix critical technical SEO issues');
    }
    if (onPage.score < 70) {
      recs.push('Optimize on-page SEO elements');
    }
    if (content.score < 70) {
      recs.push('Improve content quality and depth');
    }
    
    // Add specific recommendations based on issues
    if (technical.issues.some(i => i.message.includes('sitemap'))) {
      recs.push('Create and submit XML sitemap');
    }
    if (technical.issues.some(i => i.message.includes('structured'))) {
      recs.push('Add Schema.org structured data');
    }
    if (onPage.issues.some(i => i.message.includes('title'))) {
      recs.push('Optimize page titles for target keywords');
    }
    if (onPage.issues.some(i => i.message.includes('alt'))) {
      recs.push('Add descriptive alt text to all images');
    }
    if (content.issues.some(i => i.message.includes('word count'))) {
      recs.push('Expand content to cover topics comprehensively');
    }
    
    return recs.length > 0 ? recs : ['SEO is well optimized - maintain current practices'];
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
}