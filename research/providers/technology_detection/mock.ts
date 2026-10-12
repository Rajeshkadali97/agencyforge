import { IProvider, TechnologyDetectionInput, TechnologyDetectionOutput } from '../types';

export class MockTechnologyDetectionProvider implements IProvider<TechnologyDetectionInput, TechnologyDetectionOutput> {
  readonly id = 'mock-technology-detection';
  readonly name = 'Mock Technology Detection Provider';
  readonly version = '1.0.0';
  readonly capabilities = ['tech-stack', 'cms', 'hosting', 'analytics'];
  readonly priority = 10;
  readonly requiresApiKey = false;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  validateInput(input: TechnologyDetectionInput): boolean {
    return !!input.url;
  }

  async execute(input: TechnologyDetectionInput): Promise<TechnologyDetectionOutput> {
    // Deterministic output based on URL
    const urlHash = this.hashString(input.url);
    
    const baseOutput: TechnologyDetectionOutput = {
      url: input.url,
      technologies: [],
      dataQuality: 'complete',
      source: this.id,
      confidence: 0.88,
    };

    // Deterministic technology selection
    const allTechnologies = [
      // Frontend Frameworks
      { name: 'React', category: 'Frontend Framework', website: 'https://reactjs.org' },
      { name: 'Vue.js', category: 'Frontend Framework', website: 'https://vuejs.org' },
      { name: 'Angular', category: 'Frontend Framework', website: 'https://angular.io' },
      { name: 'Svelte', category: 'Frontend Framework', website: 'https://svelte.dev' },
      
      // Backend Technologies
      { name: 'Node.js', category: 'Backend Runtime', website: 'https://nodejs.org' },
      { name: 'Python', category: 'Backend Language', website: 'https://python.org' },
      { name: 'Java', category: 'Backend Language', website: 'https://java.com' },
      { name: 'Go', category: 'Backend Language', website: 'https://golang.org' },
      
      // Databases
      { name: 'PostgreSQL', category: 'Database', website: 'https://postgresql.org' },
      { name: 'MySQL', category: 'Database', website: 'https://mysql.com' },
      { name: 'MongoDB', category: 'Database', website: 'https://mongodb.com' },
      
      // Cloud/Hoasting
      { name: 'AWS', category: 'Hosting', website: 'https://aws.amazon.com' },
      { name: 'Azure', category: 'Hosting', website: 'https://azure.microsoft.com' },
      { name: 'Google Cloud', category: 'Hosting', website: 'https://cloud.google.com' },
      { name: 'Vercel', category: 'Hosting', website: 'https://vercel.com' },
      { name: 'Netlify', category: 'Hosting', website: 'https://netlify.com' },
      
      // Analytics
      { name: 'Google Analytics', category: 'Analytics', website: 'https://analytics.google.com' },
      { name: 'Mixpanel', category: 'Analytics', website: 'https://mixpanel.com' },
      { name: 'Hotjar', category: 'Analytics', website: 'https://hotjar.com' },
      
      // CMS
      { name: 'WordPress', category: 'CMS', website: 'https://wordpress.org' },
      { name: 'Shopify', category: 'CMS/E-commerce', website: 'https://shopify.com' },
      
      // Payment Processing
      { name: 'Stripe', category: 'Payment Processing', website: 'https://stripe.com' },
      { name: 'PayPal', category: 'Payment Processing', website: 'https://paypal.com' },
      
      // Build Tools
      { name: 'Webpack', category: 'Build Tool', website: 'https://webpack.js.org' },
      { name: 'Vite', category: 'Build Tool', website: 'https://vitejs.dev' }
    ];
    
    // Select technologies deterministically based on hash
    const technologies: TechnologyDetectionOutput['technologies'] = [];
    const techCount = 3 + (urlHash % 8); // 3-10 technologies
    
    // Use a deterministic selection algorithm
    const selectedIndices = new Set<number>();
    let i = 0;
    while (selectedIndices.size < techCount && i < allTechnologies.length * 2) { // Prevent infinite loop
      const index = (urlHash + i * 17) % allTechnologies.length;
      selectedIndices.add(index);
      i++;
    }
    
    selectedIndices.forEach(index => {
      const tech = allTechnologies[index];
      // Generate deterministic confidence (0.7 - 0.98)
      const confidenceBase = 0.7 + ((urlHash + tech.name.length) % 25) / 100; // 0.7-0.94
      const confidence = Number((Math.min(0.98, confidenceBase)).toFixed(2));
      
      technologies.push({
        name: tech.name,
        category: tech.category,
        confidence,
        version: undefined, // Could add version detection logic if needed
        website: tech.website
      });
    });
    
    // Sort by confidence descending
    technologies.sort((a, b) => b.confidence - a.confidence);
    
    // Extract categorized arrays
    const cms = technologies.find(t => t.category === 'CMS')?.name;
    const hostingProvider = technologies.find(t => t.category === 'Hosting')?.name;
    const cdn = undefined; // Could detect CDN providers if needed
    const analyticsTools = technologies
      .filter(t => t.category === 'Analytics')
      .map(t => t.name);
    const marketingTools: string[] = []; // Could add marketing tools to the list
    const paymentProcessors = technologies
      .filter(t => t.category === 'Payment Processing')
      .map(t => t.name);
    
    const enhanced: Partial<TechnologyDetectionOutput> = {
      technologies,
      cms,
      hostingProvider,
      cdn,
      analyticsTools,
      marketingTools,
      paymentProcessors
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