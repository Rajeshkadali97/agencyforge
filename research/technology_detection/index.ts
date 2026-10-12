import { ITechnologyDetection } from '../shared/interfaces';
import { TechnologyDetectionResult } from '../shared/types';

const TECH_SIGNATURES: Record<string, { category: string; patterns: string[]; website: string }> = {
  'React': { category: 'Frontend Framework', patterns: ['react', 'react-dom', 'React'], website: 'https://reactjs.org' },
  'Vue.js': { category: 'Frontend Framework', patterns: ['vue', 'vue-router', 'Vue'], website: 'https://vuejs.org' },
  'Next.js': { category: 'Full-stack Framework', patterns: ['next', '_next', 'next.js'], website: 'https://nextjs.org' },
  'Nuxt.js': { category: 'Full-stack Framework', patterns: ['nuxt', 'Nuxt'], website: 'https://nuxtjs.org' },
  'Svelte': { category: 'Frontend Framework', patterns: ['svelte'], website: 'https://svelte.dev' },
  'Angular': { category: 'Frontend Framework', patterns: ['angular', 'ng-'], website: 'https://angular.io' },
  'jQuery': { category: 'Library', patterns: ['jquery'], website: 'https://jquery.com' },
  'Webpack': { category: 'Build Tool', patterns: ['webpack'], website: 'https://webpack.js.org' },
  'Vite': { category: 'Build Tool', patterns: ['vite'], website: 'https://vitejs.dev' },
  'TypeScript': { category: 'Language', patterns: ['typescript'], website: 'https://typescriptlang.org' },
  'Tailwind CSS': { category: 'CSS Framework', patterns: ['tailwind'], website: 'https://tailwindcss.com' },
  'Bootstrap': { category: 'CSS Framework', patterns: ['bootstrap'], website: 'https://getbootstrap.com' },
  'Styled Components': { category: 'CSS-in-JS', patterns: ['styled-components'], website: 'https://styled-components.com' },
  'Google Analytics': { category: 'Analytics', patterns: ['google-analytics', 'gtag', 'ga.js', 'analytics.js'], website: 'https://analytics.google.com' },
  'Google Tag Manager': { category: 'Analytics', patterns: ['googletagmanager', 'gtm.js'], website: 'https://tagmanager.google.com' },
  'Mixpanel': { category: 'Analytics', patterns: ['mixpanel'], website: 'https://mixpanel.com' },
  'Amplitude': { category: 'Analytics', patterns: ['amplitude'], website: 'https://amplitude.com' },
  'Segment': { category: 'Analytics', patterns: ['segment'], website: 'https://segment.com' },
  'Hotjar': { category: 'Analytics', patterns: ['hotjar'], website: 'https://hotjar.com' },
  'Intercom': { category: 'Marketing', patterns: ['intercom'], website: 'https://intercom.com' },
  'HubSpot': { category: 'Marketing', patterns: ['hubspot'], website: 'https://hubspot.com' },
  'Salesforce': { category: 'Marketing', patterns: ['salesforce'], website: 'https://salesforce.com' },
  'Marketo': { category: 'Marketing', patterns: ['marketo'], website: 'https://marketo.com' },
  'Stripe': { category: 'Payments', patterns: ['stripe', 'stripe.js'], website: 'https://stripe.com' },
  'PayPal': { category: 'Payments', patterns: ['paypal'], website: 'https://paypal.com' },
  'Braintree': { category: 'Payments', patterns: ['braintree'], website: 'https://braintreepayments.com' },
  'Shopify': { category: 'E-commerce', patterns: ['shopify', 'cdn.shopify.com'], website: 'https://shopify.com' },
  'WooCommerce': { category: 'E-commerce', patterns: ['woocommerce'], website: 'https://woocommerce.com' },
  'WordPress': { category: 'CMS', patterns: ['wordpress', 'wp-content', 'wp-includes'], website: 'https://wordpress.org' },
  'Drupal': { category: 'CMS', patterns: ['drupal'], website: 'https://drupal.org' },
  'Contentful': { category: 'CMS', patterns: ['contentful'], website: 'https://contentful.com' },
  'Sanity': { category: 'CMS', patterns: ['sanity'], website: 'https://sanity.io' },
  'Strapi': { category: 'CMS', patterns: ['strapi'], website: 'https://strapi.io' },
  'AWS': { category: 'Hosting', patterns: ['amazonaws', 'aws'], website: 'https://aws.amazon.com' },
  'Cloudflare': { category: 'CDN', patterns: ['cloudflare'], website: 'https://cloudflare.com' },
  'Vercel': { category: 'Hosting', patterns: ['vercel', 'vercel.app'], website: 'https://vercel.com' },
  'Netlify': { category: 'Hosting', patterns: ['netlify', 'netlify.app'], website: 'https://netlify.com' },
  'Firebase': { category: 'Backend', patterns: ['firebase'], website: 'https://firebase.google.com' },
  'Supabase': { category: 'Backend', patterns: ['supabase'], website: 'https://supabase.com' },
  'GraphQL': { category: 'API', patterns: ['graphql'], website: 'https://graphql.org' },
  'REST API': { category: 'API', patterns: ['api/', '/api/', 'rest'], website: '' },
  'WebSocket': { category: 'Real-time', patterns: ['websocket', 'socket.io', 'ws://', 'wss://'], website: '' },
  'PWA': { category: 'PWA', patterns: ['serviceworker', 'manifest.json', 'workbox'], website: 'https://web.dev/progressive-web-apps' },
};

export class TechnologyDetection implements ITechnologyDetection {
  async detect(url: string): Promise<TechnologyDetectionResult> {
    try {
      const html = await fetch(url).then(r => r.text());
      const detected = this.analyzeHTML(html);
      const cms = this.extractCMS(detected);
      const hosting = this.extractHosting(detected, html);
      const cdn = this.detectCDN(detected);
      const analytics = this.detectCategory(detected, 'Analytics');
      const marketing = this.detectCategory(detected, 'Marketing');
      const payments = this.detectCategory(detected, 'Payments');

      return {
        url,
        technologies: detected,
        cms,
        hosting_provider: hosting,
        cdn,
        analytics_tools: analytics,
        marketing_tools: marketing,
        payment_processors: payments,
      };
    } catch (error) {
      return {
        url,
        technologies: [],
        cms: undefined,
        hosting_provider: undefined,
        cdn: undefined,
        analytics_tools: [],
        marketing_tools: [],
        payment_processors: [],
      };
    }
  }

  async detectCMS(url: string): Promise<string | null> {
    const result = await this.detect(url);
    return result.cms ?? null;
  }

  async detectHosting(url: string): Promise<string | null> {
    const result = await this.detect(url);
    return result.hosting_provider ?? null;
  }

  async detectAnalytics(url: string): Promise<string[]> {
    const result = await this.detect(url);
    return result.analytics_tools ?? [];
  }

  private analyzeHTML(html: string): TechnologyDetectionResult['technologies'] {
    const lower = html.toLowerCase();
    const detected: TechnologyDetectionResult['technologies'] = [];

    for (const [name, sig] of Object.entries(TECH_SIGNATURES)) {
      const confidence = sig.patterns.reduce((score, pattern) => {
        if (lower.includes(pattern.toLowerCase())) return score + 1;
        return score;
      }, 0);

      if (confidence > 0) {
        detected.push({
          name,
          category: sig.category,
          confidence: Math.min(1, confidence / sig.patterns.length),
          version: undefined,
          website: sig.website,
        });
      }
    }

    return detected.sort((a, b) => b.confidence - a.confidence);
  }

  private extractCMS(detected: TechnologyDetectionResult['technologies']): string | undefined {
    const cms = detected.find(t => t.category === 'CMS');
    return cms?.name;
  }

  private extractHosting(detected: TechnologyDetectionResult['technologies'], html: string): string | undefined {
    const hosting = detected.find(t => t.category === 'Hosting');
    if (hosting) return hosting.name;
    
    const lower = html.toLowerCase();
    if (lower.includes('vercel')) return 'Vercel';
    if (lower.includes('netlify')) return 'Netlify';
    if (lower.includes('aws') || lower.includes('amazonaws')) return 'AWS';
    if (lower.includes('firebase')) return 'Firebase';
    return undefined;
  }

  private detectCDN(detected: TechnologyDetectionResult['technologies']): string | undefined {
    const cdn = detected.find(t => t.category === 'CDN');
    return cdn?.name;
  }

  private detectCategory(detected: TechnologyDetectionResult['technologies'], category: string): string[] {
    return detected
      .filter(t => t.category === category)
      .map(t => t.name);
  }
}