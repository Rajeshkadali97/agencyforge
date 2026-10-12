import { BaseAIProvider } from '../base-provider';
import { AIResponse, AIMessage, AIFunction, AIStreamChunk } from '../base';

export class AnthropicProvider extends BaseAIProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic Claude';
  readonly version = '1.0.0';
  readonly capabilities = ['chat', 'functions', 'streaming', 'claude-3'];
  readonly supportsStreaming = true;
  readonly supportsFunctionCalling = true;

  protected getDefaultBaseUrl(): string {
    return 'https://api.anthropic.com/v1';
  }

  protected getHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey || '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
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
    const model = options?.model || 'claude-sonnet-4-20250514';

    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const body: Record<string, unknown> = {
      model,
      messages: conversationMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }
    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options?.maxTokens) {
      body.max_tokens = options.maxTokens;
    } else {
      body.max_tokens = 4096;
    }
    if (options?.functions && options.functions.length > 0) {
      body.tools = options.functions.map(f => ({
        name: f.name,
        description: f.description,
        input_schema: f.parameters,
      }));
    }

    const url = `${this.baseUrl}/messages`;
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
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as {
        content: Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }>;
        usage: { input_tokens: number; output_tokens: number };
      };

      let content = '';
      const functionCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

      for (const block of data.content) {
        if (block.type === 'text') {
          content += block.text || '';
        }
        if (block.type === 'tool_use') {
          functionCalls.push({
            name: block.name || '',
            arguments: block.input || {},
          });
        }
      }

      if (functionCalls.length > 0) {
        content = JSON.stringify({ __tool_calls: functionCalls });
      }

      const latencyMs = Date.now() - startTime;
      const usage = data.usage || { input_tokens: 0, output_tokens: 0 };

      return {
        content,
        provider: this.id,
        model,
        tokensUsed: {
          input: usage.input_tokens,
          output: usage.output_tokens,
        },
        cost: this.calculateCost(usage.input_tokens, usage.output_tokens, model),
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
    const model = options?.model || 'claude-sonnet-4-20250514';

    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const body: Record<string, unknown> = {
      model,
      messages: conversationMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }
    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options?.maxTokens) {
      body.max_tokens = options.maxTokens;
    } else {
      body.max_tokens = 4096;
    }
    if (options?.functions && options.functions.length > 0) {
      body.tools = options.functions.map(f => ({
        name: f.name,
        description: f.description,
        input_schema: f.parameters,
      }));
    }

    const url = `${this.baseUrl}/messages`;
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
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
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

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta') {
                const content = parsed.delta?.text;
                if (content) {
                  options?.onChunk({ content, done: false });
                }
              }
              if (parsed.type === 'message_stop') {
                options?.onChunk({ content: '', done: true });
                return;
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
      'claude-opus-4-20250514': { input: 0.015, output: 0.075 },
      'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
      'claude-3-5-haiku-20241022': { input: 0.0008, output: 0.004 },
    };
    const modelCosts = costs[model] || { input: 0.003, output: 0.015 };
    return (inputTokens / 1000) * modelCosts.input + (outputTokens / 1000) * modelCosts.output;
  }
}