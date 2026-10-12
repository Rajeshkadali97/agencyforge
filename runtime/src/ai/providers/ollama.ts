import { BaseAIProvider } from './base-provider';
import { AIResponse, AIMessage, AIFunction, AIStreamChunk } from './base';

export class OllamaProvider extends BaseAIProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama (Local)';
  readonly version = '1.0.0';
  readonly capabilities = ['chat', 'functions', 'streaming'];
  readonly supportsStreaming = true;
  readonly supportsFunctionCalling = false;

  protected getDefaultBaseUrl(): string {
    return 'http://localhost:11434';
  }

  protected getHeaders() {
    return {
      'Content-Type': 'application/json',
    };
  }

  isConfigured(): boolean {
    return true;
  }

  async checkOllamaHealth(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        timeout: 5000,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unavailable'; latencyMs?: number }> {
    const start = Date.now();
    const isHealthy = await this.checkOllamaHealth();
    const latencyMs = Date.now() - start;

    if (isHealthy) {
      this.latencyMs = latencyMs;
      return { status: 'healthy', latencyMs };
    }
    this.isAvailableFlag = false;
    return { status: 'unavailable', latencyMs };
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
    const model = options?.model || 'llama3.2';

    const body: Record<string, unknown> = {
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream: false,
    };

    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options?.maxTokens) {
      body.options = { num_predict: options.maxTokens };
    }

    const url = `${this.baseUrl}/api/chat`;
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
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as {
        message: { content: string };
        total_duration?: number;
        prompt_eval_count?: number;
        eval_count?: number;
      };

      const latencyMs = Date.now() - startTime;

      return {
        content: data.message?.content || '',
        provider: this.id,
        model,
        tokensUsed: {
          input: data.prompt_eval_count || 0,
          output: data.eval_count || 0,
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
    const model = options?.model || 'llama3.2';

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
      body.options = { num_predict: options.maxTokens };
    }

    const url = `${this.baseUrl}/api/chat`;

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        timeout: this.timeoutMs,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
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
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              const content = parsed.message?.content;
              if (content) {
                options?.onChunk({ content, done: false });
              }
              if (parsed.done) {
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
}