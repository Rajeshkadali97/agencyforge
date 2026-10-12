import { AIProvider, AIResponse, AIMessage, AIFunction, AIStreamChunk } from './providers/base';
import { ProviderFactory, ProviderStatus, createProviderFactory } from './provider-factory';
import type { ILogger } from '../interfaces';

export interface AIServiceConfig {
  defaultModel?: string;
  preferOrderedProviders?: string[];
  fallbackDelayMs?: number;
}

export interface AIServiceMetrics {
  requestsTotal: number;
  requestsByProvider: Record<string, number>;
  errorsByProvider: Record<string, number>;
  averageLatencyMs: Record<string, number>;
  failoverCount: number;
}

export class AIService {
  private factory: ProviderFactory;
  private config: AIServiceConfig;
  private metrics: AIServiceMetrics;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private logger?: ILogger;

  constructor(factory: ProviderFactory, config: AIServiceConfig = {}, logger?: ILogger) {
    this.logger = logger;
    this.factory = factory;
    this.config = {
      defaultModel: config.defaultModel || 'auto',
      preferOrderedProviders: config.preferOrderedProviders || [
        'ninerouter',   // ALL calls go through 9Router first
        'ollama',       // direct fallbacks only when 9Router unreachable
        'openrouter',
        'gemini',
        'nim',
        'anthropic',
        'openai',
      ],
      fallbackDelayMs: config.fallbackDelayMs ?? 2000,
    };
    this.metrics = {
      requestsTotal: 0,
      requestsByProvider: {},
      errorsByProvider: {},
      averageLatencyMs: {},
      failoverCount: 0,
    };
  }

  async complete(
    messages: AIMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      functions?: AIFunction[];
      preferredProvider?: string;
      forceProvider?: string;
    }
  ): Promise<AIResponse> {
    const providers = this.getProviderChain(options?.forceProvider, options?.preferredProvider);
    let lastError: Error | null = null;

    for (const provider of providers) {
      if (!provider.isConfigured()) {
        continue;
      }

      try {
        const response = await provider.complete(messages, {
          model: options?.model || this.config.defaultModel,
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
          functions: options?.functions,
        });

        this.recordSuccess(provider.id, response.latencyMs);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.recordError(provider.id);
        this.metrics.failoverCount++;
        this.logger?.warn('AIService: Provider failed, trying next', { provider: provider.id, error: lastError.message });
      }
    }

    throw lastError || new Error('All AI providers failed');
  }

  async stream(
    messages: AIMessage[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      functions?: AIFunction[];
      onChunk: (chunk: AIStreamChunk) => void;
      preferredProvider?: string;
      forceProvider?: string;
    }
  ): Promise<void> {
    const providers = this.getProviderChain(options.forceProvider, options.preferredProvider);
    let lastError: Error | null = null;

    for (const provider of providers) {
      if (!provider.isConfigured()) {
        continue;
      }

      if (!provider.supportsStreaming) {
        continue;
      }

      try {
        if (provider.stream) {
          await provider.stream(messages, {
            model: options.model || this.config.defaultModel,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            functions: options.functions,
            onChunk: options.onChunk,
          });
          return;
        } else {
          const response = await provider.complete(messages, {
            model: options.model || this.config.defaultModel,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            functions: options.functions,
          });
          options.onChunk({ content: response.content, done: true });
          return;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.recordError(provider.id);
        this.metrics.failoverCount++;
        this.logger?.warn('AIService: Provider streaming failed, trying next', { provider: provider.id, error: lastError.message });
      }
    }

    throw lastError || new Error('All AI providers failed');
  }

  private getProviderChain(forceProvider?: string, preferredProvider?: string): AIProvider[] {
    const chain: AIProvider[] = [];

    if (forceProvider) {
      const provider = this.factory.getProvider(forceProvider);
      if (provider) {
        chain.push(provider);
      }
    }

    if (preferredProvider && !forceProvider) {
      const provider = this.factory.getProvider(preferredProvider);
      if (provider) {
        chain.push(provider);
      }
    }

    for (const id of this.config.preferOrderedProviders!) {
      if (id === forceProvider || id === preferredProvider) {
        continue;
      }
      const provider = this.factory.getProvider(id);
      if (provider) {
        chain.push(provider);
      }
    }

    return chain;
  }

  async getBestAvailableProvider(): Promise<AIProvider | null> {
    const statuses = await this.factory.checkAllProvidersHealth();

    for (const id of this.config.preferOrderedProviders!) {
      const status = statuses.find(s => s.id === id);
      if (status?.isAvailable && status?.health === 'healthy') {
        const provider = this.factory.getProvider(id);
        if (provider) {
          return provider;
        }
      }
    }

    return null;
  }

  async healthCheck(): Promise<Record<string, ProviderStatus>> {
    const statuses = await this.factory.checkAllProvidersHealth();
    const statusMap: Record<string, ProviderStatus> = {};
    for (const status of statuses) {
      statusMap[status.id] = status;
    }
    return statusMap;
  }

  getMetrics(): AIServiceMetrics {
    return { ...this.metrics };
  }

  private recordSuccess(providerId: string, latencyMs: number): void {
    this.metrics.requestsTotal++;
    this.metrics.requestsByProvider[providerId] = (this.metrics.requestsByProvider[providerId] || 0) + 1;

    const currentAvg = this.metrics.averageLatencyMs[providerId] || 0;
    const currentCount = this.metrics.requestsByProvider[providerId] || 1;
    this.metrics.averageLatencyMs[providerId] = (currentAvg * (currentCount - 1) + latencyMs) / currentCount;
  }

  private recordError(providerId: string): void {
    this.metrics.errorsByProvider[providerId] = (this.metrics.errorsByProvider[providerId] || 0) + 1;
  }

  startHealthChecks(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.healthCheckInterval = setInterval(async () => {
      await this.healthCheck();
    }, intervalMs);
  }

  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  destroy(): void {
    this.stopHealthChecks();
  }
}

let globalAIService: AIService | null = null;

export function getAIService(): AIService {
  if (!globalAIService) {
    globalAIService = new AIService(createProviderFactory());
  }
  return globalAIService;
}

export function initializeAIService(config?: AIServiceConfig): AIService {
  if (globalAIService) {
    globalAIService.destroy();
  }
  globalAIService = new AIService(createProviderFactory(), config);
  return globalAIService;
}