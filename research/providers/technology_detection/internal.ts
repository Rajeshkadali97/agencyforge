import { IProvider, TechnologyDetectionInput, TechnologyDetectionOutput } from '../types';

export class InternalTechnologyDetectionProvider implements IProvider<TechnologyDetectionInput, TechnologyDetectionOutput> {
  readonly id = 'internal-technology-detection';
  readonly name = 'Internal Technology Detection';
  readonly version = '1.0.0';
  readonly capabilities = ['tech-stack', 'cms', 'hosting', 'analytics'];
  readonly priority = 10;
  readonly requiresApiKey = false;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  validateInput(input: TechnologyDetectionInput): boolean {
    try {
      new URL(input.url);
      return true;
    } catch {
      return false;
    }
  }

  async execute(input: TechnologyDetectionInput): Promise<TechnologyDetectionOutput> {
    let html = '';
    let headers: Headers | null = null;

    try {
      const response = await fetch(input.url);
      html = await response.text();
      headers = response.headers;
    } catch (error) {
      return this.errorResult(input.url, `Fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const technologies = this.detectTechnologies(html, headers);
    const categories = this.categorizeTechnologies(technologies);
    const cms = this.detectCMS(categories);
    const hostingProvider = this.detectHosting(categories, headers);
    const cdn = this.detectCDN(categories);
    const analyticsTools = this.detectCategory(categories, 'Analytics');
    const marketingTools = this.detectCategory(categories, 'Marketing');
    const paymentProcessors = this.detectCategory(categories, 'Payments');

    return {
      url: input.url,
      technologies,
      cms,
      hostingProvider,
      cdn,
      analyticsTools,
      marketingTools,
      paymentProcessors,
      dataQuality: 'complete',
      source: this.id,
      confidence: 0.85,
    };
  }

  private detectTechnologies(html: string, headers: Headers | null): TechnologyDetectionOutput['technologies'] {
    const lower = html.toLowerCase();
    const detected: TechnologyDetectionOutput['technologies'] = [];

    const signatures: Record<string, { category: string; patterns: string[]; website: string; versionPattern?: RegExp }> = {
      'React': { category: 'Frontend Framework', patterns: ['react', 'react-dom', '_react', '__react'], website: 'https://reactjs.org' },
      'Vue.js': { category: 'Frontend Framework', patterns: ['vue', 'vue-router', '__vue__'], website: 'https://vuejs.org' },
      'Next.js': { category: 'Full-stack Framework', patterns: ['next', '_next', 'next.js', '__next'], website: 'https://nextjs.org' },
      'Nuxt.js': { category: 'Full-stack Framework', patterns: ['nuxt', '__nuxt'], website: 'https://nuxtjs.org' },
      'Svelte': { category: 'Frontend Framework', patterns: ['svelte'], website: 'https://svelte.dev' },
      'Angular': { category: 'Frontend Framework', patterns: ['angular', 'ng-', 'ng_version'], website: 'https://angular.io' },
      'jQuery': { category: 'Library', patterns: ['jquery'], website: 'https://jquery.com' },
      'Alpine.js': { category: 'Library', patterns: ['alpine'], website: 'https://alpinejs.dev' },
      'Stimulus': { category: 'Library', patterns: ['stimulus'], website: 'https://stimulus.hotwired.dev' },
      'Webpack': { category: 'Build Tool', patterns: ['webpack'], website: 'https://webpack.js.org' },
      'Vite': { category: 'Build Tool', patterns: ['vite'], website: 'https://vitejs.dev' },
      'Rollup': { category: 'Build Tool', patterns: ['rollup'], website: 'https://rollupjs.org' },
      'esbuild': { category: 'Build Tool', patterns: ['esbuild'], website: 'https://esbuild.github.io' },
      'TypeScript': { category: 'Language', patterns: ['typescript'], website: 'https://typescriptlang.org' },
      'Tailwind CSS': { category: 'CSS Framework', patterns: ['tailwind'], website: 'https://tailwindcss.com' },
      'Bootstrap': { category: 'CSS Framework', patterns: ['bootstrap'], website: 'https://getbootstrap.com' },
      'Bulma': { category: 'CSS Framework', patterns: ['bulma'], website: 'https://bulma.io' },
      'Foundation': { category: 'CSS Framework', patterns: ['foundation'], website: 'https://get.foundation' },
      'Styled Components': { category: 'CSS-in-JS', patterns: ['styled-components'], website: 'https://styled-components.com' },
      'Emotion': { category: 'CSS-in-JS', patterns: ['emotion'], website: 'https://emotion.sh' },
      'PostCSS': { category: 'CSS Tool', patterns: ['postcss'], website: 'https://postcss.org' },
      'Sass': { category: 'CSS Preprocessor', patterns: ['sass', 'scss'], website: 'https://sass-lang.com' },
      'Less': { category: 'CSS Preprocessor', patterns: ['less'], website: 'http://lesscss.org' },
      'Google Analytics': { category: 'Analytics', patterns: ['google-analytics', 'gtag', 'ga.js', 'analytics.js', 'ga('], website: 'https://analytics.google.com' },
      'Google Tag Manager': { category: 'Analytics', patterns: ['googletagmanager', 'gtm.js'], website: 'https://tagmanager.google.com' },
      'Mixpanel': { category: 'Analytics', patterns: ['mixpanel'], website: 'https://mixpanel.com' },
      'Amplitude': { category: 'Analytics', patterns: ['amplitude'], website: 'https://amplitude.com' },
      'Segment': { category: 'Analytics', patterns: ['segment', 'analytics.js'], website: 'https://segment.com' },
      'Hotjar': { category: 'Analytics', patterns: ['hotjar'], website: 'https://hotjar.com' },
      'FullStory': { category: 'Analytics', patterns: ['fullstory'], website: 'https://fullstory.com' },
      'Heap': { category: 'Analytics', patterns: ['heap'], website: 'https://heapanalytics.com' },
      'Matomo': { category: 'Analytics', patterns: ['matomo', 'piwik'], website: 'https://matomo.org' },
      'Plausible': { category: 'Analytics', patterns: ['plausible'], website: 'https://plausible.io' },
      'Intercom': { category: 'Marketing', patterns: ['intercom'], website: 'https://intercom.com' },
      'HubSpot': { category: 'Marketing', patterns: ['hubspot', 'hs-'], website: 'https://hubspot.com' },
      'Salesforce': { category: 'Marketing', patterns: ['salesforce', 'sfdc'], website: 'https://salesforce.com' },
      'Marketo': { category: 'Marketing', patterns: ['marketo', 'munchkin'], website: 'https://marketo.com' },
      'Pardot': { category: 'Marketing', patterns: ['pardot'], website: 'https://pardot.com' },
      'Mailchimp': { category: 'Marketing', patterns: ['mailchimp', 'mc_embed'], website: 'https://mailchimp.com' },
      'Klaviyo': { category: 'Marketing', patterns: ['klaviyo'], website: 'https://klaviyo.com' },
      'Stripe': { category: 'Payments', patterns: ['stripe', 'stripe.js', 'stripe.com'], website: 'https://stripe.com' },
      'PayPal': { category: 'Payments', patterns: ['paypal', 'paypal.com'], website: 'https://paypal.com' },
      'Braintree': { category: 'Payments', patterns: ['braintree'], website: 'https://braintreepayments.com' },
      'Square': { category: 'Payments', patterns: ['square', 'sq.js'], website: 'https://squareup.com' },
      'Adyen': { category: 'Payments', patterns: ['adyen'], website: 'https://adyen.com' },
      'Shopify': { category: 'E-commerce', patterns: ['shopify', 'cdn.shopify.com', 'shopify.', 'myshopify'], website: 'https://shopify.com' },
      'WooCommerce': { category: 'E-commerce', patterns: ['woocommerce', 'wc-'], website: 'https://woocommerce.com' },
      'Magento': { category: 'E-commerce', patterns: ['magento'], website: 'https://magento.com' },
      'BigCommerce': { category: 'E-commerce', patterns: ['bigcommerce'], website: 'https://bigcommerce.com' },
      'WordPress': { category: 'CMS', patterns: ['wordpress', 'wp-content', 'wp-includes', 'wp-json', 'wp-embed'], website: 'https://wordpress.org', versionPattern: /wp-emoji-release\.min\.js\?ver=([\d.]+)/ },
      'Drupal': { category: 'CMS', patterns: ['drupal', 'drupal.'], website: 'https://drupal.org' },
      'Contentful': { category: 'CMS', patterns: ['contentful', 'ctfassets'], website: 'https://contentful.com' },
      'Sanity': { category: 'CMS', patterns: ['sanity', 'sanity.io'], website: 'https://sanity.io' },
      'Strapi': { category: 'CMS', patterns: ['strapi'], website: 'https://strapi.io' },
      'Ghost': { category: 'CMS', patterns: ['ghost'], website: 'https://ghost.org' },
      'Webflow': { category: 'CMS', patterns: ['webflow', 'webflow.js'], website: 'https://webflow.com' },
      'Squarespace': { category: 'CMS', patterns: ['squarespace', 'squarespace-cdn'], website: 'https://squarespace.com' },
      'Wix': { category: 'CMS', patterns: ['wix', 'wixstatic'], website: 'https://wix.com' },
      'AWS': { category: 'Hosting', patterns: ['amazonaws', 'aws.', 'cloudfront', 's3.'], website: 'https://aws.amazon.com' },
      'Google Cloud': { category: 'Hosting', patterns: ['googleapis', 'googlecloud', 'gcp.'], website: 'https://cloud.google.com' },
      'Azure': { category: 'Hosting', patterns: ['azure', 'azurewebsites', 'blob.core.windows'], website: 'https://azure.microsoft.com' },
      'Vercel': { category: 'Hosting', patterns: ['vercel', 'vercel.app', 'vercel-insights'], website: 'https://vercel.com' },
      'Netlify': { category: 'Hosting', patterns: ['netlify', 'netlify.app', 'netlify-cdn'], website: 'https://netlify.com' },
      'Firebase': { category: 'Hosting', patterns: ['firebase', 'firebaseapp', 'firebaseio'], website: 'https://firebase.google.com' },
      'Supabase': { category: 'Backend', patterns: ['supabase', 'supabase.co'], website: 'https://supabase.com' },
      'Heroku': { category: 'Hosting', patterns: ['heroku', 'herokuapp'], website: 'https://heroku.com' },
      'DigitalOcean': { category: 'Hosting', patterns: ['digitalocean', 'digitaloceanspaces'], website: 'https://digitalocean.com' },
      'Cloudflare': { category: 'CDN', patterns: ['cloudflare', 'cf-ray', '__cf_'], website: 'https://cloudflare.com' },
      'Akamai': { category: 'CDN', patterns: ['akamai', 'akamaihd'], website: 'https://akamai.com' },
      'Fastly': { category: 'CDN', patterns: ['fastly'], website: 'https://fastly.com' },
      'GraphQL': { category: 'API', patterns: ['graphql'], website: 'https://graphql.org' },
      'REST API': { category: 'API', patterns: ['/api/', '/rest/', '/v1/', '/v2/'], website: '' },
      'gRPC': { category: 'API', patterns: ['grpc'], website: 'https://grpc.io' },
      'WebSocket': { category: 'Real-time', patterns: ['websocket', 'socket.io', 'ws://', 'wss://', 'pusher'], website: '' },
      'Pusher': { category: 'Real-time', patterns: ['pusher'], website: 'https://pusher.com' },
      'Ably': { category: 'Real-time', patterns: ['ably'], website: 'https://ably.com' },
      'PWA': { category: 'PWA', patterns: ['serviceworker', 'manifest.json', 'workbox', 'sw.js'], website: 'https://web.dev/progressive-web-apps' },
      'AMP': { category: 'Performance', patterns: ['amp-', 'amphtml', 'amp.'], website: 'https://amp.dev' },
      'Lazy Load': { category: 'Performance', patterns: ['loading="lazy"', 'lazysizes', 'lozad'], website: '' },
      'reCAPTCHA': { category: 'Security', patterns: ['recaptcha', 'grecaptcha'], website: 'https://www.google.com/recaptcha' },
      'hCaptcha': { category: 'Security', patterns: ['hcaptcha'], website: 'https://hcaptcha.com' },
      'Cloudflare Turnstile': { category: 'Security', patterns: ['turnstile'], website: 'https://www.cloudflare.com/products/turnstile' },
    };

    for (const [name, sig] of Object.entries(signatures)) {
      let confidence = 0;
      let version: string | undefined;

      for (const pattern of sig.patterns) {
        if (lower.includes(pattern.toLowerCase())) {
          confidence += 1 / sig.patterns.length;
        }
      }

      if (headers) {
        const server = headers.get('server')?.toLowerCase() ?? '';
        const poweredBy = headers.get('x-powered-by')?.toLowerCase() ?? '';
        const allHeaders = `${server} ${poweredBy}`;
        
        for (const pattern of sig.patterns) {
          if (allHeaders.includes(pattern.toLowerCase())) {
            confidence = Math.max(confidence, 0.9);
          }
        }
      }

      if (confidence > 0) {
        if (sig.versionPattern) {
          const match = html.match(sig.versionPattern);
          if (match) version = match[1];
        }
        detected.push({
          name,
          category: sig.category,
          confidence: Math.min(1, confidence),
          version,
          website: sig.website,
        });
      }
    }

    return detected.sort((a, b) => b.confidence - a.confidence);
  }

  private categorizeTechnologies(technologies: TechnologyDetectionOutput['technologies']): Record<string, TechnologyDetectionOutput['technologies']> {
    const categories: Record<string, TechnologyDetectionOutput['technologies']> = {};
    for (const tech of technologies) {
      if (!categories[tech.category]) categories[tech.category] = [];
      categories[tech.category].push(tech);
    }
    return categories;
  }

  private detectCMS(categories: Record<string, TechnologyDetectionOutput['technologies']>): string | undefined {
    const cms = categories['CMS'];
    if (cms && cms.length > 0) return cms[0].name;
    return undefined;
  }

  private detectHosting(categories: Record<string, TechnologyDetectionOutput['technologies']>, headers: Headers | null): string | undefined {
    const hosting = categories['Hosting'];
    if (hosting && hosting.length > 0) return hosting[0].name;

    if (headers) {
      const server = headers.get('server')?.toLowerCase() ?? '';
      if (server.includes('vercel')) return 'Vercel';
      if (server.includes('netlify')) return 'Netlify';
      if (server.includes('cloudflare')) return 'Cloudflare';
      if (server.includes('nginx')) return 'Nginx (self-hosted)';
      if (server.includes('apache')) return 'Apache (self-hosted)';
    }
    return undefined;
  }

  private detectCDN(categories: Record<string, TechnologyDetectionOutput['technologies']>): string | undefined {
    const cdn = categories['CDN'];
    if (cdn && cdn.length > 0) return cdn[0].name;
    return undefined;
  }

  private detectCategory(categories: Record<string, TechnologyDetectionOutput['technologies']>, category: string): string[] {
    const cat = categories[category];
    return cat ? cat.map(t => t.name) : [];
  }

  private errorResult(url: string, error: string): TechnologyDetectionOutput {
    return {
      url,
      technologies: [],
      dataQuality: 'partial',
      source: this.id,
      confidence: 0,
    };
  }
}