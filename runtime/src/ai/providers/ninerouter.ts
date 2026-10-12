import { BaseAIProvider } from './base-provider';
import { AIResponse, AIMessage, AIFunction, AIStreamChunk, ModelInfo, AIProviderConfig } from './base';

/**
 * Routes all AI requests through 9Router (local gateway at localhost:20128).
 * 9Router exposes an OpenAI-compatible /v1 API and handles provider selection internally.
 * Configure via NINE_ROUTER_URL env var; defaults to http://localhost:20128/v1.
 *
 * All AgencyForge AI calls MUST go through this provider first. Direct provider calls
 * are only fallbacks when 9Router is unreachable.
 */
export class NineRouterProvider extends BaseAIProvider {
  readonly id = 'ninerouter';
  readonly name = '9Router';
  readonly version = '1.0.0';
  readonly capabilities = ['chat', 'functions', 'streaming'];
  readonly supportsStreaming = true;
  readonly supportsFunctionCalling = true;

  constructor(config: AIProviderConfig = {}) {
    // Local loopback — fail fast so AIService reaches remote fallbacks quickly.
    super({
      timeoutMs: 10000,  // 10s vs 60s default — local service should respond instantly
      maxRetries: 1,     // 1 retry: 2 × 10s = 20s max before fallback
      ...config,
    });
  }

  protected getDefaultBaseUrl(): string {
    return process.env.NINE_ROUTER_URL ?? 'http://localhost:20128/v1';
  }

  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // 9Router is a local gateway — no API key required.
    // If a key is configured (e.g. for authenticated 9Router deployments), include it.
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  isConfigured(): boolean {
    // 9Router is a local service; no API key required.
    return true;
  }

  override async getHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unavailable'; latencyMs?: number }> {
    const start = Date.now();
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: this.getHeaders(),
        timeout: 3000,
      });
      const latencyMs = Date.now() - start;
      if (res.ok) {
        this.isAvailableFlag = true;
        return { status: 'healthy', latencyMs };
      }
      this.isAvailableFlag = false;
      return { status: 'degraded', latencyMs };
    } catch {
      this.isAvailableFlag = false;
      return { status: 'unavailable', latencyMs: Date.now() - start };
    }
  }

  protected async executeComplete(
    messages: AIMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      functions?: AIFunction[];
    }
  ): Promise<AIResponse> {
    // 9Router routes by model name; prefix kr/ signals routing through 9Router's model registry.
    const model = options?.model || process.env.NINE_ROUTER_DEFAULT_MODEL || 'kr/claude-haiku-4-5-20251001';

    const body: Record<string, unknown> = {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    };

    if (options?.temperature !== undefined) body.temperature = options.temperature;
    if (options?.maxTokens) body.max_tokens = options.maxTokens;
    if (options?.functions && options.functions.length > 0) {
      body.tools = options.functions.map(f => ({
        type: 'function',
        function: f,
      }));
    }

    const url = `${this.baseUrl}/chat/completions`;
    const startTime = Date.now();

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        timeout: this.timeoutMs,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`9Router API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as {
        choices: Array<{
          message: { content: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> };
          finish_reason: string;
        }>;
        usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        model: string;
      };

      const choice = data.choices[0];
      let content = choice.message.content || '';

      if (choice.message.tool_calls && options?.functions) {
        const toolCalls = choice.message.tool_calls.map(tc => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        }));
        content = JSON.stringify({ __tool_calls: toolCalls });
      }

      const latencyMs = Date.now() - startTime;
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      return {
        content,
        provider: this.id,
        model: data.model || model,
        tokensUsed: {
          input: usage.prompt_tokens,
          output: usage.completion_tokens,
        },
        cost: 0,
        latencyMs,
      };
    } catch (error) {
      this.isAvailableFlag = false;
      throw error;
    }
  }

  protected async executeStream(
    messages: AIMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      functions?: AIFunction[];
      onChunk: (chunk: AIStreamChunk) => void;
    }
  ): Promise<void> {
    const model = options?.model || process.env.NINE_ROUTER_DEFAULT_MODEL || 'kr/claude-haiku-4-5-20251001';

    const body: Record<string, unknown> = {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    };

    if (options?.temperature !== undefined) body.temperature = options.temperature;
    if (options?.maxTokens) body.max_tokens = options.maxTokens;
    if (options?.functions && options.functions.length > 0) {
      body.tools = options.functions.map(f => ({
        type: 'function',
        function: f,
      }));
    }

    const url = `${this.baseUrl}/chat/completions`;

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        timeout: this.timeoutMs,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`9Router streaming error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              options?.onChunk({ content: '', done: true });
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                options?.onChunk({ content, done: false });
              }
            } catch {
              // Skip malformed SSE chunks
            }
          }
        }
      }

      options?.onChunk({ content: '', done: true });
    } catch (error) {
      this.isAvailableFlag = false;
      throw error;
    }
  }

  getAvailableModels(): ModelInfo[] {
    return [
      {
        id: 'kr/claude-haiku-4-5-20251001',
        provider: this.id,
        name: 'Claude Haiku 4.5 (via 9Router)',
        capabilities: ['chat', 'streaming', 'functions'],
        costPer1kInputTokens: 0,
        costPer1kOutputTokens: 0,
        maxTokens: 200000,
        latencyMs: 500,
        qualityScore: 70,
        supportsStreaming: true,
        supportsFunctionCalling: true,
      },
      {
        id: 'kr/claude-sonnet-5',
        provider: this.id,
        name: 'Claude Sonnet 5 (via 9Router)',
        capabilities: ['chat', 'streaming', 'functions'],
        costPer1kInputTokens: 0,
        costPer1kOutputTokens: 0,
        maxTokens: 200000,
        latencyMs: 800,
        qualityScore: 90,
        supportsStreaming: true,
        supportsFunctionCalling: true,
      },
    ];
  }
}
