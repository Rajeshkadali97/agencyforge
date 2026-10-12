import { BaseAIProvider } from './base-provider';
import { AIResponse, AIMessage, AIFunction, AIStreamChunk, ModelInfo } from './base';

export class OpenRouterProvider extends BaseAIProvider {
  readonly id = 'openrouter';
  readonly name = 'OpenRouter';
  readonly version = '1.0.0';
  readonly capabilities = ['chat', 'functions', 'streaming'];
  readonly supportsStreaming = true;
  readonly supportsFunctionCalling = true;

  private freeModels = [
    'openrouter/auto',
    'google/gemini-2.0-flash-thinking-exp:free',
    'deepseek/deepseek-chat-v3-免费直通版',
    'qwen/qwen-2.5-72b-instruct:free',
    'mistralai/mistral-7b-instruct:free',
  ];

  protected getDefaultBaseUrl(): string {
    return 'https://openrouter.ai/api/v1';
  }

  protected getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  isConfigured(): boolean {
    // OpenRouter works without API key for some free models
    return true;
  }

  async executeComplete(
    messages: AIMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      functions?: AIFunction[];
    }
  ): Promise<AIResponse> {
    const model = options?.model || 'openrouter/auto';

    const body: Record<string, unknown> = {
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options?.maxTokens) {
      body.max_tokens = options.maxTokens;
    }
    if (options?.functions && options.functions.length > 0) {
      body.tools = {
        type: 'function',
        function: options.functions,
      };
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
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> }; finish_reason: string }>;
        usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      const choice = data.choices[0];
      let content = choice.message.content || '';

      // Handle function calls
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
        model,
        tokensUsed: {
          input: usage.prompt_tokens,
          output: usage.completion_tokens,
        },
        cost: this.calculateCost(usage.prompt_tokens, usage.completion_tokens, model),
        latencyMs,
      };
    } catch (error) {
      this.isAvailableFlag = false;
      throw error;
    }
  }

  async executeStream(
    messages: AIMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      functions?: AIFunction[];
      onChunk: (chunk: AIStreamChunk) => void;
    }
  ): Promise<void> {
    const model = options?.model || 'openrouter/auto';

    const body: Record<string, unknown> = {
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    };

    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options?.maxTokens) {
      body.max_tokens = options.maxTokens;
    }
    if (options?.functions && options.functions.length > 0) {
      body.tools = {
        type: 'function',
        function: options.functions,
      };
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
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
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
              // Skip malformed JSON
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

  getAvailableFreeModels(): ModelInfo[] {
    return this.freeModels.map(m => ({
      id: m,
      provider: this.id,
      name: m.split('/')[1],
      capabilities: ['chat', 'streaming'],
      costPer1kInputTokens: 0,
      costPer1kOutputTokens: 0,
      maxTokens: 128000,
      latencyMs: 2000,
      qualityScore: 75,
      supportsStreaming: true,
      supportsFunctionCalling: true,
    }));
  }

  private calculateCost(inputTokens: number, outputTokens: number, model: string): number {
    // OpenRouter free models have no cost
    return 0;
  }
}