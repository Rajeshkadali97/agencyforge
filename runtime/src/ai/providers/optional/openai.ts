import { BaseAIProvider } from '../base-provider';
import { AIResponse, AIMessage, AIFunction, AIStreamChunk } from '../base';

export class OpenAIProvider extends BaseAIProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI GPT';
  readonly version = '1.0.0';
  readonly capabilities = ['chat', 'functions', 'streaming', 'vision'];
  readonly supportsStreaming = true;
  readonly supportsFunctionCalling = true;

  protected getDefaultBaseUrl(): string {
    return 'https://api.openai.com/v1';
  }

  protected getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey || ''}`,
    };
  }

  isConfigured(): boolean {
    return !!this.apiKey;
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
    const model = options?.model || 'gpt-4o-mini';

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
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> } }>;
        usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
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
    const model = options?.model || 'gpt-4o-mini';

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
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
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

  private calculateCost(inputTokens: number, outputTokens: number, model: string): number {
    const costs: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.0025, output: 0.01 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    };
    const modelCosts = costs[model] || { input: 0.00015, output: 0.0006 };
    return (inputTokens / 1000) * modelCosts.input + (outputTokens / 1000) * modelCosts.output;
  }
}