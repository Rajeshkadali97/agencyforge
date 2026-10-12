import type { IWebsiteAnalysis } from '../shared/interfaces';
import type { SEOAudit, PerformanceAudit } from '../shared';
import type { WebsiteAnalysisResult } from '../shared/types';

export class WebsiteAnalysis implements IWebsiteAnalysis {
  async analyze(url: string, _depth?: 'basic' | 'standard' | 'deep'): Promise<WebsiteAnalysisResult> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const title = await this.extractTitle(url);
      
      return {
        url,
        title: title ?? 'Unknown',
        meta_description: await this.extractDescription(url),
        performance_score: await this.measurePerformance(url),
        seo_score: await this.auditSEO(url).then(a => a.score),
        accessibility_score: await this.checkAccessibility(url),
        mobile_friendly: await this.checkMobileFriendly(url),
      } as WebsiteAnalysisResult;
    } catch (error) {
      return {
        url,
        title: 'Error',
        meta_description: `Failed to analyze: ${error instanceof Error ? error.message : 'Unknown error'}`,
        mobile_friendly: false,
      } as WebsiteAnalysisResult;
    }
  }

  async crawl(url: string, _maxPages?: number): Promise<WebsiteAnalysisResult[]> {
    return [await this.analyze(url)];
  }

  async auditSEO(url: string): Promise<SEOAudit> {
    const issues: SEOIssue[] = [];
    
    try {
      const html = await fetch(url).then(r => r.text());
      
      if (!html.includes('<title>')) {
        issues.push({ type: 'error', message: 'Missing page title' });
      } else if ((html.match(/<title>(.*?)<\/title>/i)?.[1]?.length ?? 0) > 60) {
        issues.push({ type: 'warning', message: 'Title tag too long (>60 chars)' });
      }

      if (!html.includes('<meta name="description"')) {
        issues.push({ type: 'error', message: 'Missing meta description' });
      }

      const h1Count = (html.match(/<h1>/gi) ?? []).length;
      if (h1Count === 0) {
        issues.push({ type: 'error', message: 'Missing H1 tag' });
      } else if (h1Count > 1) {
        issues.push({ type: 'warning', message: 'Multiple H1 tags found' });
      }

      if (!html.includes('alt=')) {
        issues.push({ type: 'warning', message: 'Images missing alt attributes' });
      }

      const score = Math.max(0, 100 - issues.filter(i => i.type === 'error').length * 15 - issues.filter(i => i.type === 'warning').length * 5);

      return {
        score,
        issues,
        recommendations: this.generateRecommendations(issues),
      };
    } catch {
      return { score: 0, issues: [{ type: 'error', message: 'Could not fetch page' }], recommendations: [] };
    }
  }

  async auditPerformance(url: string): Promise<PerformanceAudit> {
    const start = Date.now();
    try {
      await fetch(url);
      const loadTime = Date.now() - start;
      
      return {
        score: loadTime < 1000 ? 90 : loadTime < 3000 ? 60 : 30,
        metrics: { load_time_ms: loadTime },
        opportunities: loadTime > 3000 ? ['Optimize images', 'Enable caching', 'Use CDN'] : [],
      };
    } catch {
      return { score: 0, metrics: {}, opportunities: ['Fix server errors'] };
    }
  }

  private async extractTitle(url: string): Promise<string | null> {
    try {
      const html = await fetch(url).then(r => r.text());
      return html.match(/<title>(.*?)<\/title>/i)?.[1] ?? null;
    } catch {
      return null;
    }
  }

  private async extractDescription(url: string): Promise<string> {
    try {
      const html = await fetch(url).then(r => r.text());
      return html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? '';
    } catch {
      return '';
    }
  }

  private async detectTechnologies(url: string): Promise<string[]> {
    try {
      const html = await fetch(url).then(r => r.text());
      const tech: string[] = [];
      
      if (html.includes('react') || html.includes('React')) tech.push('React');
      if (html.includes('vue') || html.includes('Vue')) tech.push('Vue.js');
      if (html.includes('next') || html.includes('Next.js')) tech.push('Next.js');
      if (html.includes('webpack')) tech.push('Webpack');
      if (html.includes('google-analytics') || html.includes('gtag')) tech.push('Google Analytics');
      if (html.includes('shopify')) tech.push('Shopify');
      if (html.includes('wordpress') || html.includes('wp-content')) tech.push('WordPress');
      
      return tech;
    } catch {
      return [];
    }
  }

  private async measurePerformance(url: string): Promise<number> {
    const start = Date.now();
    try {
      await fetch(url);
      return Math.max(0, 100 - Math.floor((Date.now() - start) / 50));
    } catch {
      return 0;
    }
  }

  private async checkAccessibility(url: string): Promise<number> {
    try {
      const html = await fetch(url).then(r => r.text());
      let score = 100;
      if (!html.includes('lang=')) score -= 10;
      if (!html.includes('alt=')) score -= 15;
      if (!html.match(/<label/)) score -= 10;
      return Math.max(0, score);
    } catch {
      return 0;
    }
  }

  private async checkMobileFriendly(url: string): Promise<boolean> {
    try {
      const html = await fetch(url).then(r => r.text());
      return html.includes('viewport') && html.includes('width=device-width');
    } catch {
      return false;
    }
  }

  private generateRecommendations(issues: SEOIssue[]): string[] {
    const recs: string[] = [];
    if (issues.some(i => i.message.includes('title'))) recs.push('Add optimized page titles');
    if (issues.some(i => i.message.includes('description'))) recs.push('Write compelling meta descriptions');
    if (issues.some(i => i.message.includes('H1'))) recs.push('Ensure single, descriptive H1 per page');
    if (issues.some(i => i.message.includes('alt'))) recs.push('Add alt text to all images');
    return recs;
  }
}

import { SEOIssue } from '../shared';