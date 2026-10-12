import { BaseAIProvider } from './base-provider';
import { AIResponse, AIMessage, AIFunction, AIStreamChunk } from './base';

export class NIMProvider extends BaseAIProvider {
  readonly id = 'nim';
  readonly name = 'NVIDIA NIM';
  readonly version = '1.0.0';
  readonly capabilities = ['chat', 'functions', 'streaming'];
  readonly supportsStreaming = true;
  readonly supportsFunctionCalling = true;

  protected getDefaultBaseUrl(): string {
    return 'https://integrate.api.nvidia.com/v1';
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
    const model = options?.model || 'nvidia/llama-3.1-nemotron-70b-instruct';

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
      body.tools = options.functions;
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
        throw new Error(`NIM API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      const choice = data.choices[0];
      const latencyMs = Date.now() - startTime;
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      return {
        content: choice.message.content || '',
        provider: this.id,
        model,
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
    const model = options?.model || 'nvidia/llama-3.1-nemotron-70b-instruct';

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
      body.tools = options.functions;
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
        throw new Error(`NIM API error: ${response.status} - ${errorText}`);
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
}