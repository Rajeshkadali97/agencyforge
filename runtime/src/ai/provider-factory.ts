import { AIProvider, AIFreeProvider, AIOptionalProvider, FREE_PROVIDERS, OPTIONAL_PROVIDERS } from './providers/base';
import { NineRouterProvider } from './providers/ninerouter';
import { OpenRouterProvider } from './providers/openrouter';
import { NIMProvider } from './providers/nim';
import { GeminiProvider } from './providers/gemini';
import { OllamaProvider } from './providers/ollama';
import { AnthropicProvider } from './providers/optional/anthropic';
import { OpenAIProvider } from './providers/optional/openai';

export interface ProviderStatus {
  id: string;
  name: string;
  isAvailable: boolean;
  isConfigured: boolean;
  health: 'healthy' | 'degraded' | 'unavailable';
  latencyMs?: number;
  reason?: string;
}

export interface FactoryConfig {
  nineRouterUrl?: string;
  openrouterApiKey?: string;
  nimApiKey?: string;
  geminiApiKey?: string;
  ollamaBaseUrl?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  defaultModel?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export class ProviderFactory {
  private providers: Map<string, AIProvider> = new Map();
  private config: FactoryConfig;

  constructor(config: FactoryConfig = {}) {
    this.config = config;
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const baseConfig = {
      maxRetries: this.config.maxRetries ?? 3,
      retryDelayMs: this.config.retryDelayMs ?? 1000,
      timeoutMs: this.config.timeoutMs ?? 60000,
    };

    // 9Router MUST be first — all AI calls route through it when running
    this.providers.set('ninerouter', new NineRouterProvider({
      baseUrl: this.config.nineRouterUrl,
      ...baseConfig,
    }));

    this.providers.set('openrouter', new OpenRouterProvider({
      apiKey: this.config.openrouterApiKey,
      ...baseConfig,
    }));

    this.providers.set('nim', new NIMProvider({
      apiKey: this.config.nimApiKey,
      ...baseConfig,
    }));

    this.providers.set('gemini', new GeminiProvider({
      apiKey: this.config.geminiApiKey,
      ...baseConfig,
    }));

    this.providers.set('ollama', new OllamaProvider({
      apiKey: this.config.ollamaBaseUrl,
      baseUrl: this.config.ollamaBaseUrl || 'http://localhost:11434',
      ...baseConfig,
    }));

    if (this.config.anthropicApiKey) {
      this.providers.set('anthropic', new AnthropicProvider({
        apiKey: this.config.anthropicApiKey,
        ...baseConfig,
      }));
    }

    if (this.config.openaiApiKey) {
      this.providers.set('openai', new OpenAIProvider({
        apiKey: this.config.openaiApiKey,
        ...baseConfig,
      }));
    }
  }

  getProvider(id: string): AIProvider | undefined {
    return this.providers.get(id);
  }

  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  getFreeProviders(): AIProvider[] {
    return FREE_PROVIDERS
      .map(id => this.providers.get(id))
      .filter((p): p is AIProvider => p !== undefined);
  }

  getOptionalProviders(): AIProvider[] {
    return OPTIONAL_PROVIDERS
      .map(id => this.providers.get(id))
      .filter((p): p is AIProvider => p !== undefined);
  }

  async checkProviderHealth(provider: AIProvider): Promise<ProviderStatus> {
    try {
      const health = await provider.getHealth();
      return {
        id: provider.id,
        name: provider.name,
        isAvailable: provider.isAvailable(),
        isConfigured: provider.isConfigured(),
        health: health.status,
        latencyMs: health.latencyMs,
      };
    } catch (error) {
      return {
        id: provider.id,
        name: provider.name,
        isAvailable: false,
        isConfigured: provider.isConfigured(),
        health: 'unavailable',
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async checkAllProvidersHealth(): Promise<ProviderStatus[]> {
    const results = await Promise.all(
      this.getAllProviders().map(p => this.checkProviderHealth(p))
    );
    return results;
  }

  getProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }

  hasProvider(id: string): boolean {
    return this.providers.has(id);
  }

  destroy(): void {
    for (const provider of this.providers.values()) {
      provider.destroy();
    }
    this.providers.clear();
  }
}

export function createProviderFactory(): ProviderFactory {
  return new ProviderFactory({
    nineRouterUrl: process.env.NINE_ROUTER_URL,
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    nimApiKey: process.env.NVIDIA_NIM_API_KEY || process.env.NIM_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    maxRetries: 3,
    retryDelayMs: 1000,
    timeoutMs: 60000,
  });
}