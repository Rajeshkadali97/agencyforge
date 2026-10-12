import { ILogger } from '../interfaces';

export interface FirecrawlConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    title?: string;
    description?: string;
    language?: string;
    html?: string;
    markdown?: string;
    links?: string[];
    images?: string[];
    metadata?: Record<string, string>;
  };
  error?: string;
}

export interface FirecrawlSearchResponse {
  success: boolean;
  data?: {
    items: Array<{
      url: string;
      title: string;
      description: string;
      rawHtml?: string;
    }>;
  };
  error?: string;
}

export interface FirecrawlMapResponse {
  success: boolean;
  data?: {
    links: string[];
  };
  error?: string;
}

export class FirecrawlProvider {
  private apiKey: string;
  private baseUrl: string;
  private logger: ILogger | undefined;

  constructor(config: FirecrawlConfig, logger?: ILogger) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.firecrawl.dev';
    this.logger = logger;
  }

  async scrape(url: string, options?: { onlyMainContent?: boolean }): Promise<FirecrawlScrapeResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v0/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url,
          onlyMainContent: options?.onlyMainContent ?? true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger?.error('Firecrawl scrape error', { status: response.status, error: errorText });
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json() as FirecrawlScrapeResponse;
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger?.error('Firecrawl scrape exception', { error: message });
      return { success: false, error: message };
    }
  }

  async search(query: string, options?: { limit?: number }): Promise<FirecrawlSearchResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v0/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query,
          limit: options?.limit ?? 10,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger?.error('Firecrawl search error', { status: response.status, error: errorText });
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json() as FirecrawlSearchResponse;
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger?.error('Firecrawl search exception', { error: message });
      return { success: false, error: message };
    }
  }

  async map(url: string): Promise<FirecrawlMapResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v0/map`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger?.error('Firecrawl map error', { status: response.status, error: errorText });
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json() as FirecrawlMapResponse;
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger?.error('Firecrawl map exception', { error: message });
      return { success: false, error: message };
    }
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }
}

export function createFirecrawlProvider(apiKey: string, logger?: ILogger): FirecrawlProvider | null {
  if (!apiKey || apiKey.trim().length === 0) {
    logger?.info('FirecrawlProvider: No API key provided, using mock mode');
    return null;
  }
  return new FirecrawlProvider({ apiKey }, logger);
}