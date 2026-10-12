import { IProvider, WebsiteAnalysisInput, WebsiteAnalysisOutput } from '../types';

export class MockWebsiteAnalysisProvider implements IProvider<WebsiteAnalysisInput, WebsiteAnalysisOutput> {
  readonly id = 'mock-website-analysis';
  readonly name = 'Mock Website Analysis Provider';
  readonly version = '1.0.0';
  readonly capabilities = ['basic', 'standard', 'deep'];
  readonly priority = 10;
  readonly requiresApiKey = false;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  validateInput(input: WebsiteAnalysisInput): boolean {
    return !!input.url;
  }

  async execute(input: WebsiteAnalysisInput): Promise<WebsiteAnalysisOutput> {
    // Determinative output based on URL
    const urlHash = this.hashString(input.url);
    
    const baseOutput: WebsiteAnalysisOutput = {
      url: input.url,
      dataQuality: 'complete',
      source: this.id,
      confidence: 0.9,
    };

    // Generate deterministic values based on URL hash
    const titleLength = 10 + (urlHash % 50); // 10-60 chars
    const title = Array.from({ length: titleLength }, (_, i) => 
      String.fromCharCode(65 + (urlHash + i) % 26)
    ).join('');
    
    const metaDescriptionLength = 50 + (urlHash % 100); // 50-150 chars
    const metaDescription = Array.from({ length: metaDescriptionLength }, (_, i) => 
      String.fromCharCode(65 + (urlHash + i + 1) % 26)
    ).join('');

    const wordCount = 100 + (urlHash % 900); // 100-999 words
    
    const loadTime = 50 + (urlHash % 450); // 50-500ms
    
    const statusCode = 200;
    const sslValid = input.url.startsWith('https://');
    
    // Deterministic boolean values
    const mobileFriendly = (urlHash % 3) !== 0; // ~66% true
    const hasAnalytics = (urlHash % 2) === 0;   // 50% true
    const hasChat = (urlHash % 5) === 0;       // 20% true
    
    const formsCount = urlHash % 5; // 0-4 forms
    const imagesCount = 10 + (urlHash % 90); // 10-99 images
    
    // SEO score based on various factors
    let seoScore = 80; // Base score
    if (titleLength < 30 || titleLength > 60) seoScore -= 10;
    if (metaDescriptionLength < 50 || metaDescriptionLength > 160) seoScore -= 10;
    if (!sslValid) seoScore -= 15;
    if (!mobileFriendly) seoScore -= 10;
    seoScore = Math.max(0, Math.min(100, seoScore));
    
    // Performance score based on load time
    let performanceScore = 100;
    if (loadTime > 3000) performanceScore = 30;
    else if (loadTime > 1000) performanceScore = 60;
    else if (loadTime > 500) performanceScore = 80;
    
    // Accessibility score (deterministic)
    const accessibilityScore = 60 + (urlHash % 40); // 60-99
    
    // Content quality score based on word count
    let contentQualityScore = 50;
    if (wordCount >= 300) contentQualityScore = 80;
    if (wordCount >= 600) contentQualityScore = 90;
    
    const enhanced: Partial<WebsiteAnalysisOutput> = {
      title,
      metaDescription: metaDescription.length > 0 ? metaDescription : undefined,
      headings: {
        h1: [`Main Heading`],
        h2: [`Subheading 1`, `Subheading 2`],
        h3: [`Point 1`, `Point 2`, `Point 3`]
      },
      wordCount,
      loadTimeMs: loadTime,
      statusCode,
      sslValid,
      mobileFriendly,
      hasAnalytics,
      hasChat,
      formsCount,
      imagesCount,
      seoScore,
      performanceScore,
      accessibilityScore,
      contentQualityScore,
      brokenLinks: []
    };
    
    return { ...baseOutput, ...enhanced };
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