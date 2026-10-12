import { PluginManifest, PluginInstance, PluginConfig } from '../types';
import { FirecrawlProvider, createFirecrawlProvider } from '../../providers/FirecrawlProvider';

interface FirecrawlPluginConfig extends PluginConfig {
  apiKey?: string;
  baseUrl?: string;
}

class FirecrawlPluginInstance implements PluginInstance {
  readonly pluginId = 'firecrawl';
  readonly capabilities = ['web.scrape', 'web.search', 'web.map'];
  private provider: FirecrawlProvider | null;

  constructor(config: FirecrawlPluginConfig) {
    const key = (config.apiKey as string) ?? process.env.FIRECRAWL_API_KEY ?? '';
    const baseUrl = (config.baseUrl as string) ?? process.env.FIRECRAWL_API_URL ?? undefined;
    this.provider = key
      ? new FirecrawlProvider({ apiKey: key, baseUrl })
      : createFirecrawlProvider('');
  }

  isConfigured(): boolean {
    return this.provider?.isConfigured() ?? false;
  }

  async invoke(capability: string, input: unknown): Promise<unknown> {
    if (!this.provider?.isConfigured()) {
      throw new Error('Firecrawl not configured — set FIRECRAWL_API_KEY');
    }
    const params = input as Record<string, unknown>;
    switch (capability) {
      case 'web.scrape':
        return this.provider.scrape(params.url as string, {
          onlyMainContent: params.onlyMainContent as boolean | undefined,
        });
      case 'web.search':
        return this.provider.search(params.query as string, {
          limit: params.limit as number | undefined,
        });
      case 'web.map':
        return this.provider.map(params.url as string);
      default:
        throw new Error(`Firecrawl plugin: unknown capability "${capability}"`);
    }
  }
}

export const FirecrawlPluginManifest: PluginManifest = {
  id: 'firecrawl',
  name: 'Firecrawl',
  version: '1.0.0',
  description: 'Web scraping, search, and site mapping via Firecrawl API',
  category: 'scraping',
  capabilities: [
    { id: 'web.scrape', description: 'Scrape a URL and return markdown/HTML content' },
    { id: 'web.search', description: 'Search the web and return structured results' },
    { id: 'web.map', description: 'Map all links in a site' },
  ],
  isAvailable(config: PluginConfig): boolean {
    const key = (config.apiKey as string) ?? process.env.FIRECRAWL_API_KEY ?? '';
    return key.length > 0;
  },
  create(config: PluginConfig): PluginInstance {
    return new FirecrawlPluginInstance(config as FirecrawlPluginConfig);
  },
};
