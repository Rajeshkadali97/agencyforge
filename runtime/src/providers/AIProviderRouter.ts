import { randomUUID } from 'crypto';
import { ILogger } from '../interfaces';

export type ProviderId = 'gemini' | 'openai' | 'claude' | 'openrouter';

export interface AIProviderConfig {
  id: ProviderId;
  displayName: string;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  fallbackModel?: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
  enabled: boolean;
  priority: number;
  costPerToken?: number;
}

export interface AIRequest {
  id: string;
  model?: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AIResponse {
  id: string;
  requestId: string;
  providerId: ProviderId;
  model: string;
  content: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_call' | 'error';
  latencyMs: number;
  cost?: number;
  error?: string;
}

export interface AIStreamChunk {
  requestId: string;
  content: string;
  done: boolean;
  error?: string;
}

export interface ProviderHealth {
  providerId: ProviderId;
  isAvailable: boolean;
  latencyMs: number;
  errorRate: number;
  lastSuccess: Date | null;
  lastFailure: Date | null;
  consecutiveFailures: number;
  lastCheck: Date;
}

export abstract class AIProvider {
  abstract readonly id: ProviderId;
  abstract readonly displayName: string;
  protected config: AIProviderConfig;
  protected logger: ILogger;
  protected healthStatus: ProviderHealth;

  constructor(config: AIProviderConfig, logger: ILogger) {
    this.config = config;
    this.logger = logger;
    this.healthStatus = {
      providerId: config.id,
      isAvailable: config.enabled,
      latencyMs: 0,
      errorRate: 0,
      lastSuccess: null,
      lastFailure: null,
      consecutiveFailures: 0,
      lastCheck: new Date(),
    };
  }

  abstract complete(request: AIRequest): Promise<AIResponse>;
  abstract completeStream(request: AIRequest, onChunk: (chunk: AIStreamChunk) => void): Promise<AIResponse>;

  getHealth(): ProviderHealth {
    return { ...this.healthStatus };
  }

  getConfig(): AIProviderConfig {
    return { ...this.config };
  }

  protected recordSuccess(latencyMs: number): void {
    this.healthStatus.isAvailable = true;
    this.healthStatus.latencyMs = latencyMs;
    this.healthStatus.lastSuccess = new Date();
    this.healthStatus.consecutiveFailures = 0;
    this.healthStatus.lastCheck = new Date();

    const total = this.healthStatus.errorRate + 1;
    this.healthStatus.errorRate = Math.max(0, this.healthStatus.errorRate - (1 / total));
  }

  protected recordFailure(error: string, latencyMs?: number): void {
    this.healthStatus.lastFailure = new Date();
    this.healthStatus.consecutiveFailures++;
    this.healthStatus.lastCheck = new Date();

    if (latencyMs) {
      this.healthStatus.latencyMs = latencyMs;
    }

    if (this.healthStatus.consecutiveFailures >= 3) {
      this.healthStatus.isAvailable = false;
    }

    this.logger.error('AIProvider failure', {
      providerId: this.id,
      error,
      consecutiveFailures: this.healthStatus.consecutiveFailures,
    });
  }

  public async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export class GeminiProvider extends AIProvider {
  readonly id: ProviderId = 'gemini';
  readonly displayName = 'Google Gemini';

  async complete(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const model = request.model ?? this.config.model;

    try {
      const response = await this.callGeminiAPI(request, model);
      this.recordSuccess(Date.now() - startTime);
      return response;
    } catch (error) {
      this.recordFailure(error instanceof Error ? error.message : String(error), Date.now() - startTime);
      throw error;
    }
  }

  async completeStream(request: AIRequest, onChunk: (chunk: AIStreamChunk) => void): Promise<AIResponse> {
    const startTime = Date.now();
    const model = request.model ?? this.config.model;
    let fullContent = '';

    try {
      const response = await this.callGeminiAPI(request, model);
      fullContent = response.content;
      onChunk({ requestId: request.id, content: fullContent, done: true });

      this.recordSuccess(Date.now() - startTime);
      return { ...response, content: fullContent };
    } catch (error) {
      this.recordFailure(error instanceof Error ? error.message : String(error), Date.now() - startTime);
      throw error;
    }
  }

  private async callGeminiAPI(request: AIRequest, model: string): Promise<AIResponse> {
    if (!this.config.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const url = `${this.config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta'}/models/${model}:generateContent?key=${this.config.apiKey}`;

    const body = {
      contents: [
        ...(request.systemPrompt ? [{ role: 'user', parts: [{ text: request.systemPrompt }] }] : []),
        { role: 'user', parts: [{ text: request.prompt }] },
      ],
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? this.config.maxTokens,
        temperature: request.temperature ?? this.config.temperature,
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'Unknown error');
        throw new Error(`Gemini API error: ${res.status} - ${errorBody}`);
      }

      const data = await res.json() as Record<string, unknown>;
      const candidates = data.candidates as Array<{ content: { parts: Array<{ text: string }> }; finishReason: string }> | undefined;
      const content = candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const finishReason = candidates?.[0]?.finishReason ?? 'stop';

      const usage = data.usageMetadata as { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number } | undefined;

      return {
        id: `ai_${randomUUID()}`,
        requestId: request.id,
        providerId: this.id,
        model,
        content,
        usage: {
          promptTokens: usage?.promptTokenCount ?? 0,
          completionTokens: usage?.candidatesTokenCount ?? 0,
          totalTokens: usage?.totalTokenCount ?? 0,
        },
        finishReason: finishReason === 'STOP' ? 'stop' : finishReason === 'MAX_TOKENS' ? 'length' : 'stop',
        latencyMs: 0,
        cost: this.calculateCost(usage?.promptTokenCount ?? 0, usage?.candidatesTokenCount ?? 0),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private calculateCost(promptTokens: number, completionTokens: number): number {
    if (!this.config.costPerToken) return 0;
    return (promptTokens + completionTokens) * this.config.costPerToken;
  }
}

export class OpenAIProvider extends AIProvider {
  readonly id: ProviderId = 'openai';
  readonly displayName = 'OpenAI';

  async complete(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const model = request.model ?? this.config.model;

    try {
      const response = await this.callOpenAIAPI(request, model);
      this.recordSuccess(Date.now() - startTime);
      return response;
    } catch (error) {
      this.recordFailure(error instanceof Error ? error.message : String(error), Date.now() - startTime);
      throw error;
    }
  }

  async completeStream(request: AIRequest, onChunk: (chunk: AIStreamChunk) => void): Promise<AIResponse> {
    const startTime = Date.now();
    const model = request.model ?? this.config.model;

    try {
      const response = await this.callOpenAIAPIStream(request, model, onChunk);
      this.recordSuccess(Date.now() - startTime);
      return response;
    } catch (error) {
      this.recordFailure(error instanceof Error ? error.message : String(error), Date.now() - startTime);
      throw error;
    }
  }

  private async callOpenAIAPI(request: AIRequest, model: string): Promise<AIResponse> {
    if (!this.config.apiKey) throw new Error('OpenAI API key not configured');

    const url = `${this.config.baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`;
    const messages: Array<{ role: string; content: string }> = [];

    if (request.systemPrompt) messages.push({ role: 'system', content: request.systemPrompt });
    messages.push({ role: 'user', content: request.prompt });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: request.maxTokens ?? this.config.maxTokens,
          temperature: request.temperature ?? this.config.temperature,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'Unknown error');
        throw new Error(`OpenAI API error: ${res.status} - ${errorBody}`);
      }

      const data = await res.json() as Record<string, unknown>;
      const choices = data.choices as Array<{ message: { content: string }; finish_reason: string }> | undefined;
      const usage = data.usage as { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;

      return {
        id: `ai_${randomUUID()}`,
        requestId: request.id,
        providerId: this.id,
        model,
        content: choices?.[0]?.message?.content ?? '',
        usage: {
          promptTokens: usage?.prompt_tokens ?? 0,
          completionTokens: usage?.completion_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
        },
        finishReason: (choices?.[0]?.finish_reason ?? 'stop') as AIResponse['finishReason'],
        latencyMs: 0,
        cost: this.calculateCost(usage?.prompt_tokens ?? 0, usage?.completion_tokens ?? 0),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callOpenAIAPIStream(
    request: AIRequest,
    model: string,
    onChunk: (chunk: AIStreamChunk) => void
  ): Promise<AIResponse> {
    if (!this.config.apiKey) throw new Error('OpenAI API key not configured');

    const url = `${this.config.baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`;
    const messages: Array<{ role: string; content: string }> = [];

    if (request.systemPrompt) messages.push({ role: 'system', content: request.systemPrompt });
    messages.push({ role: 'user', content: request.prompt });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: request.maxTokens ?? this.config.maxTokens,
          temperature: request.temperature ?? this.config.temperature,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`OpenAI stream error: ${res.status}`);
      }

      let fullContent = '';
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

          for (const line of lines) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data) as { choices: Array<{ delta: { content?: string } }> };
              const content = parsed.choices?.[0]?.delta?.content ?? '';
              if (content) {
                fullContent += content;
                onChunk({ requestId: request.id, content, done: false });
              }
            } catch {}
          }
        }
      }

      onChunk({ requestId: request.id, content: '', done: true });

      return {
        id: `ai_${randomUUID()}`,
        requestId: request.id,
        providerId: this.id,
        model,
        content: fullContent,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
        latencyMs: 0,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private calculateCost(promptTokens: number, completionTokens: number): number {
    if (!this.config.costPerToken) return 0;
    return (promptTokens + completionTokens) * this.config.costPerToken;
  }
}

export class ClaudeProvider extends AIProvider {
  readonly id: ProviderId = 'claude';
  readonly displayName = 'Anthropic Claude';

  async complete(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const model = request.model ?? this.config.model;

    try {
      const response = await this.callClaudeAPI(request, model);
      this.recordSuccess(Date.now() - startTime);
      return response;
    } catch (error) {
      this.recordFailure(error instanceof Error ? error.message : String(error), Date.now() - startTime);
      throw error;
    }
  }

  async completeStream(request: AIRequest, onChunk: (chunk: AIStreamChunk) => void): Promise<AIResponse> {
    const startTime = Date.now();
    const model = request.model ?? this.config.model;
    let fullContent = '';

    try {
      const response = await this.callClaudeAPI(request, model);
      fullContent = response.content;
      onChunk({ requestId: request.id, content: fullContent, done: true });

      this.recordSuccess(Date.now() - startTime);
      return { ...response, content: fullContent };
    } catch (error) {
      this.recordFailure(error instanceof Error ? error.message : String(error), Date.now() - startTime);
      throw error;
    }
  }

  private async callClaudeAPI(request: AIRequest, model: string): Promise<AIResponse> {
    if (!this.config.apiKey) throw new Error('Claude API key not configured');

    const url = `${this.config.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens ?? this.config.maxTokens,
          ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
          messages: [{ role: 'user', content: request.prompt }],
          temperature: request.temperature ?? this.config.temperature,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'Unknown error');
        throw new Error(`Claude API error: ${res.status} - ${errorBody}`);
      }

      const data = await res.json() as Record<string, unknown>;
      const content = data.content as Array<{ type: string; text: string }> | undefined;
      const usage = data.usage as { input_tokens: number; output_tokens: number } | undefined;
      const stopReason = data.stop_reason as string | undefined;

      return {
        id: `ai_${randomUUID()}`,
        requestId: request.id,
        providerId: this.id,
        model,
        content: content?.filter((c) => c.type === 'text').map((c) => c.text).join('') ?? '',
        usage: {
          promptTokens: usage?.input_tokens ?? 0,
          completionTokens: usage?.output_tokens ?? 0,
          totalTokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
        },
        finishReason: stopReason === 'end_turn' ? 'stop' : stopReason === 'max_tokens' ? 'length' : 'stop',
        latencyMs: 0,
        cost: this.calculateCost(usage?.input_tokens ?? 0, usage?.output_tokens ?? 0),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    if (!this.config.costPerToken) return 0;
    return (inputTokens + outputTokens) * this.config.costPerToken;
  }
}

export class OpenRouterProvider extends AIProvider {
  readonly id: ProviderId = 'openrouter';
  readonly displayName = 'OpenRouter';

  async complete(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const model = request.model ?? this.config.model;

    try {
      const response = await this.callOpenRouterAPI(request, model);
      this.recordSuccess(Date.now() - startTime);
      return response;
    } catch (error) {
      this.recordFailure(error instanceof Error ? error.message : String(error), Date.now() - startTime);
      throw error;
    }
  }

  async completeStream(request: AIRequest, onChunk: (chunk: AIStreamChunk) => void): Promise<AIResponse> {
    const startTime = Date.now();
    let fullContent = '';

    try {
      const response = await this.callOpenRouterAPIStream(request, onChunk);
      fullContent = response.content;
      this.recordSuccess(Date.now() - startTime);
      return response;
    } catch (error) {
      this.recordFailure(error instanceof Error ? error.message : String(error), Date.now() - startTime);
      throw error;
    }
  }

  private async callOpenRouterAPI(request: AIRequest, model: string): Promise<AIResponse> {
    if (!this.config.apiKey) throw new Error('OpenRouter API key not configured');

    const url = `${this.config.baseUrl ?? 'https://openrouter.ai/api/v1'}/chat/completions`;
    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) messages.push({ role: 'system', content: request.systemPrompt });
    messages.push({ role: 'user', content: request.prompt });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': 'https://agencyforge.ai',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: request.maxTokens ?? this.config.maxTokens,
          temperature: request.temperature ?? this.config.temperature,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'Unknown error');
        throw new Error(`OpenRouter API error: ${res.status} - ${errorBody}`);
      }

      const data = await res.json() as Record<string, unknown>;
      const choices = data.choices as Array<{ message: { content: string }; finish_reason: string }> | undefined;
      const usage = data.usage as { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;

      return {
        id: `ai_${randomUUID()}`,
        requestId: request.id,
        providerId: this.id,
        model,
        content: choices?.[0]?.message?.content ?? '',
        usage: {
          promptTokens: usage?.prompt_tokens ?? 0,
          completionTokens: usage?.completion_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
        },
        finishReason: (choices?.[0]?.finish_reason ?? 'stop') as AIResponse['finishReason'],
        latencyMs: 0,
        cost: this.calculateCost(usage?.prompt_tokens ?? 0, usage?.completion_tokens ?? 0),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callOpenRouterAPIStream(
    request: AIRequest,
    onChunk: (chunk: AIStreamChunk) => void
  ): Promise<AIResponse> {
    if (!this.config.apiKey) throw new Error('OpenRouter API key not configured');

    const url = `${this.config.baseUrl ?? 'https://openrouter.ai/api/v1'}/chat/completions`;
    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) messages.push({ role: 'system', content: request.systemPrompt });
    messages.push({ role: 'user', content: request.prompt });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model ?? this.config.model,
        messages,
        stream: true,
        max_tokens: request.maxTokens ?? this.config.maxTokens,
      }),
    });

    let fullContent = '';
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));
        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data) as { choices: Array<{ delta: { content?: string } }> };
            const content = parsed.choices?.[0]?.delta?.content ?? '';
            if (content) {
              fullContent += content;
              onChunk({ requestId: request.id, content, done: false });
            }
          } catch {}
        }
      }
    }

    onChunk({ requestId: request.id, content: '', done: true });

    return {
      id: `ai_${randomUUID()}`,
      requestId: request.id,
      providerId: this.id,
      model: request.model ?? this.config.model,
      content: fullContent,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: 'stop',
      latencyMs: 0,
    };
  }

  private calculateCost(promptTokens: number, completionTokens: number): number {
    if (!this.config.costPerToken) return 0;
    return (promptTokens + completionTokens) * this.config.costPerToken;
  }
}

export class AIProviderRouter {
  private providers: Map<ProviderId, AIProvider> = new Map();
  private providerOrder: ProviderId[] = [];
  private logger: ILogger;
  private totalRequests = 0;
  private totalErrors = 0;
  private costTracking: Map<ProviderId, number> = new Map();

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
    this.costTracking.set(provider.id, 0);
    this.recalculateOrder();
    this.logger.info('AIProviderRouter: Provider registered', {
      providerId: provider.id,
      displayName: provider.displayName,
    });
  }

  unregisterProvider(providerId: ProviderId): boolean {
    const result = this.providers.delete(providerId);
    if (result) this.recalculateOrder();
    return result;
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    this.totalRequests++;

    for (const providerId of this.providerOrder) {
      const provider = this.providers.get(providerId);
      if (!provider) continue;

      const health = provider.getHealth();
      if (!health.isAvailable) continue;

      try {
        const response = await this.executeWithRetry(provider, request);
        if (response.cost) {
          this.costTracking.set(providerId, (this.costTracking.get(providerId) ?? 0) + response.cost);
        }
        return response;
      } catch (error) {
        this.totalErrors++;
        this.logger.warn('AIProviderRouter: Provider failed, trying next', {
          providerId,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    throw new Error('All AI providers unavailable');
  }

  async completeStream(request: AIRequest, onChunk: (chunk: AIStreamChunk) => void): Promise<AIResponse> {
    this.totalRequests++;

    for (const providerId of this.providerOrder) {
      const provider = this.providers.get(providerId);
      if (!provider) continue;

      const health = provider.getHealth();
      if (!health.isAvailable) continue;

      try {
        return await provider.completeStream(request, onChunk);
      } catch (error) {
        this.totalErrors++;
        this.logger.warn('AIProviderRouter: Stream provider failed, trying next', {
          providerId,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    throw new Error('All AI providers unavailable for streaming');
  }

  getProvider(providerId: ProviderId): AIProvider | undefined {
    return this.providers.get(providerId);
  }

  listProviders(): Array<{ id: ProviderId; displayName: string; health: ProviderHealth }> {
    return Array.from(this.providers.entries()).map(([id, provider]) => ({
      id,
      displayName: provider.displayName,
      health: provider.getHealth(),
    }));
  }

  getStats(): { totalRequests: number; totalErrors: number; errorRate: number; costsByProvider: Record<string, number> } {
    return {
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      errorRate: this.totalRequests > 0 ? this.totalErrors / this.totalRequests : 0,
      costsByProvider: Object.fromEntries(this.costTracking),
    };
  }

  private async executeWithRetry(provider: AIProvider, request: AIRequest): Promise<AIResponse> {
    const config = provider.getConfig();
    const maxRetries = config.maxRetries;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await provider.complete(request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error('Unknown error');
  }

  private recalculateOrder(): void {
    const providers = Array.from(this.providers.entries());
    providers.sort(([, a], [, b]) => {
      const healthA = a.getHealth();
      const healthB = b.getHealth();

      if (healthA.isAvailable && !healthB.isAvailable) return -1;
      if (!healthA.isAvailable && healthB.isAvailable) return 1;

      const configA = a.getConfig();
      const configB = b.getConfig();
      return configA.priority - configB.priority;
    });

    this.providerOrder = providers.map(([id]) => id);
  }
}

export function createAIRequest(prompt: string, systemPrompt?: string, options?: Partial<AIRequest>): AIRequest {
  return {
    id: `req_${Date.now()}_${randomUUID().slice(0, 8)}`,
    prompt,
    systemPrompt,
    maxTokens: options?.maxTokens,
    temperature: options?.temperature,
    model: options?.model,
    stream: options?.stream,
    metadata: options?.metadata,
  };
}
