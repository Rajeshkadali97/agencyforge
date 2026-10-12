import { IProvider, WebsiteAnalysisInput, WebsiteAnalysisOutput } from '../types';

export class InternalWebsiteAnalysisProvider implements IProvider<WebsiteAnalysisInput, WebsiteAnalysisOutput> {
  readonly id = 'internal-website-analysis';
  readonly name = 'Internal Website Analysis';
  readonly version = '1.0.0';
  readonly capabilities = ['basic', 'seo', 'performance', 'tech-detection'];
  readonly priority = 10;
  readonly requiresApiKey = false;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  validateInput(input: WebsiteAnalysisInput): boolean {
    try {
      new URL(input.url);
      return true;
    } catch {
      return false;
    }
  }

  async execute(input: WebsiteAnalysisInput): Promise<WebsiteAnalysisOutput> {
    const url = input.url;
    const startTime = Date.now();
    let html = '';
    let statusCode = 200;
    let loadTime = 0;

    try {
      const response = await fetch(url);
      statusCode = response.status;
      html = await response.text();
      loadTime = Date.now() - startTime;
    } catch (error) {
      return this.errorResult(url, `Fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const title = this.extractTitle(html);
    const metaDescription = this.extractMetaDescription(html);
    const headings = this.extractHeadings(html);
    const wordCount = this.countWords(html);
    const technologies = this.detectTechnologies(html);
    const seoIssues = this.auditSEO(html, url);
    const performance = this.auditPerformance(loadTime);
    const accessibility = this.auditAccessibility(html);
    const mobileFriendly = this.checkMobileFriendly(html);
    const sslValid = url.startsWith('https://');
    const formsCount = (html.match(/<form/gi) ?? []).length;
    const imagesCount = (html.match(/<img/gi) ?? []).length;
    const hasAnalytics = this.detectAnalytics(html);
    const hasChat = this.detectChat(html);

    const overallScore = this.calculateOverallScore({
      seo: seoIssues,
      performance: performance.score,
      accessibility: accessibility.score,
      mobile: mobileFriendly,
    });

    return {
      url,
      title,
      metaDescription,
      headings,
      wordCount,
      loadTimeMs: loadTime,
      statusCode,
      sslValid,
      mobileFriendly,
      hasAnalytics,
      hasChat,
      formsCount,
      imagesCount,
      seoScore: 100 - seoIssues.length * 10,
      performanceScore: performance.score,
      accessibilityScore: accessibility.score,
      contentQualityScore: wordCount > 300 ? 80 : wordCount > 100 ? 50 : 20,
      brokenLinks: [],
      dataQuality: 'complete',
      source: this.id,
      confidence: 0.85,
    } as WebsiteAnalysisOutput;
  }

  private extractTitle(html: string): string | undefined {
    return html.match(/<title>(.*?)<\/title>/i)?.[1]?.trim();
  }

  private extractMetaDescription(html: string): string | undefined {
    return html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1]?.trim();
  }

  private extractHeadings(html: string): { h1: string[]; h2: string[]; h3: string[] } {
    const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/gi)?.map(h => h.replace(/<[^>]+>/g, '').trim()) ?? [];
    const h2 = html.match(/<h2[^>]*>(.*?)<\/h2>/gi)?.map(h => h.replace(/<[^>]+>/g, '').trim()) ?? [];
    const h3 = html.match(/<h3[^>]*>(.*?)<\/h3>/gi)?.map(h => h.replace(/<[^>]+>/g, '').trim()) ?? [];
    return { h1, h2, h3 };
  }

  private countWords(html: string): number {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.split(' ').filter(w => w.length > 0).length;
  }

  private detectTechnologies(html: string): string[] {
    const lower = html.toLowerCase();
    const tech: string[] = [];
    const signatures: Record<string, string[]> = {
      'React': ['react', 'react-dom', '_react'],
      'Vue.js': ['vue', 'vue-router', '__vue__'],
      'Next.js': ['next', '_next', 'next.js'],
      'Nuxt.js': ['nuxt'],
      'Svelte': ['svelte'],
      'Angular': ['angular', 'ng-'],
      'jQuery': ['jquery'],
      'Webpack': ['webpack'],
      'Vite': ['vite'],
      'TypeScript': ['typescript'],
      'Tailwind CSS': ['tailwind'],
      'Bootstrap': ['bootstrap'],
      'Styled Components': ['styled-components'],
      'Google Analytics': ['google-analytics', 'gtag', 'ga.js', 'analytics.js'],
      'Google Tag Manager': ['googletagmanager', 'gtm.js'],
      'Mixpanel': ['mixpanel'],
      'Amplitude': ['amplitude'],
      'Segment': ['segment'],
      'Hotjar': ['hotjar'],
      'Intercom': ['intercom'],
      'HubSpot': ['hubspot'],
      'Stripe': ['stripe', 'stripe.js'],
      'PayPal': ['paypal'],
      'Shopify': ['shopify', 'cdn.shopify.com'],
      'WooCommerce': ['woocommerce'],
      'WordPress': ['wordpress', 'wp-content', 'wp-includes'],
      'Drupal': ['drupal'],
      'Contentful': ['contentful'],
      'Sanity': ['sanity'],
      'Strapi': ['strapi'],
      'AWS': ['amazonaws', 'aws'],
      'Cloudflare': ['cloudflare'],
      'Vercel': ['vercel', 'vercel.app'],
      'Netlify': ['netlify', 'netlify.app'],
      'Firebase': ['firebase'],
      'Supabase': ['supabase'],
      'GraphQL': ['graphql'],
      'WebSocket': ['websocket', 'socket.io', 'ws://', 'wss://'],
      'PWA': ['serviceworker', 'manifest.json', 'workbox'],
    };

    for (const [name, patterns] of Object.entries(signatures)) {
      if (patterns.some(p => lower.includes(p.toLowerCase()))) {
        tech.push(name);
      }
    }

    return tech;
  }

  private auditSEO(html: string, url: string): string[] {
    const issues: string[] = [];
    const lower = html.toLowerCase();

    if (!html.match(/<title>/i)) issues.push('Missing page title');
    else {
      const title = html.match(/<title>(.*?)<\/title>/i)?.[1] ?? '';
      if (title.length > 60) issues.push(`Title too long (${title.length} chars)`);
      if (title.length < 30) issues.push('Title could be more descriptive');
    }

    if (!lower.includes('meta name="description"')) issues.push('Missing meta description');

    const h1Count = (lower.match(/<h1/gi) ?? []).length;
    if (h1Count === 0) issues.push('Missing H1 tag');
    else if (h1Count > 1) issues.push('Multiple H1 tags');

    const h2Count = (lower.match(/<h2/gi) ?? []).length;
    if (h2Count === 0) issues.push('No H2 tags for content structure');

    const imgTags = lower.match(/<img/gi) ?? [];
    const imgWithAlt = lower.match(/<img[^>]*alt=/gi) ?? [];
    if (imgTags.length > imgWithAlt.length) issues.push(`${imgTags.length - imgWithAlt.length} images missing alt text`);

    if (!lower.includes('viewport')) issues.push('Missing viewport meta tag');

    if (!lower.includes('rel="canonical"')) issues.push('Missing canonical tag');

    try {
      new URL('/sitemap.xml', url);
    } catch {
      // URL construction failed
    }

    return issues;
  }

  private auditPerformance(loadTime: number): { score: number; metrics: Record<string, number> } {
    let score = 100;
    if (loadTime > 3000) score = 30;
    else if (loadTime > 1000) score = 60;
    else if (loadTime > 500) score = 80;
    return { score, metrics: { load_time_ms: loadTime } };
  }

  private auditAccessibility(html: string): { score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;
    const lower = html.toLowerCase();

    if (!lower.includes('lang=')) { issues.push('Missing lang attribute'); score -= 10; }
    if (!lower.includes('alt=')) { issues.push('Images missing alt attributes'); score -= 15; }
    if (!lower.match(/<label/)) { issues.push('Missing form labels'); score -= 10; }
    if (!lower.includes('aria-')) { issues.push('No ARIA attributes detected'); score -= 5; }

    return { score: Math.max(0, score), issues };
  }

  private checkMobileFriendly(html: string): boolean {
    return html.toLowerCase().includes('viewport') && 
           html.toLowerCase().includes('width=device-width');
  }

  private detectAnalytics(html: string): boolean {
    const lower = html.toLowerCase();
    return lower.includes('google-analytics') || lower.includes('gtag') || 
           lower.includes('mixpanel') || lower.includes('amplitude') ||
           lower.includes('segment') || lower.includes('matomo');
  }

  private detectChat(html: string): boolean {
    const lower = html.toLowerCase();
    return lower.includes('intercom') || lower.includes('crisp') || 
           lower.includes('tawk') || lower.includes('zendesk') ||
           lower.includes('drift') || lower.includes('chat');
  }

  private calculateOverallScore(params: { seo: string[]; performance: number; accessibility: number; mobile: boolean }): number {
    let score = 100;
    score -= params.seo.length * 8;
    score += params.performance * 0.3;
    score += params.accessibility * 0.2;
    if (!params.mobile) score -= 15;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private errorResult(url: string, error: string): WebsiteAnalysisOutput {
    return {
      url,
      title: 'Error',
      metaDescription: undefined,
      headings: { h1: [], h2: [], h3: [] },
      wordCount: 0,
      loadTimeMs: 0,
      statusCode: 0,
      sslValid: false,
      mobileFriendly: false,
      hasAnalytics: false,
      hasChat: false,
      formsCount: 0,
      imagesCount: 0,
      seoScore: 0,
      performanceScore: 0,
      accessibilityScore: 0,
      contentQualityScore: 0,
      brokenLinks: [],
      dataQuality: 'partial',
      source: this.id,
      confidence: 0,
    } as WebsiteAnalysisOutput;
  }
}