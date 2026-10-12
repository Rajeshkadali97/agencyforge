import { AIProvider, AIProviderConfig, AIResponse, AIMessage, AIFunction, AIStreamChunk } from './base';

class StreamTimeoutError extends Error {
  constructor(ms: number) {
    super(`AI stream timed out after ${ms}ms`);
    this.name = 'StreamTimeoutError';
  }
}

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly capabilities: string[];
  abstract readonly supportsStreaming: boolean;
  abstract readonly supportsFunctionCalling: boolean;

protected apiKey?: string;
  protected baseUrl: string;
  protected maxRetries: number;
  protected retryDelayMs: number;
  protected timeoutMs: number;
  protected streamTimeoutMs: number;
  protected isAvailableFlag = true;
  protected latencyMs = 0;

  constructor(config: AIProviderConfig = {}) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || this.getDefaultBaseUrl();
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
    this.timeoutMs = config.timeoutMs ?? 60000;
    this.streamTimeoutMs = 300000; // 5 min max for any streaming response
  }

  protected abstract getDefaultBaseUrl(): string;

  isAvailable(): boolean {
    return this.isAvailableFlag;
  }

  isConfigured(): boolean {
    return !!this.apiKey || this.id === 'ollama';
  }

  getHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unavailable'; latencyMs?: number }> {
    return Promise.resolve({
      status: this.isAvailableFlag ? 'healthy' : 'unavailable',
      latencyMs: this.latencyMs
    });
  }

  async complete(
    messages: AIMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      functions?: AIFunction[];
    }
  ): Promise<AIResponse> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.executeComplete(messages, options);
        this.latencyMs = Date.now() - startTime;
        this.isAvailableFlag = true;
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    this.isAvailableFlag = false;
    throw lastError || new Error('AI request failed after retries');
  }

  async stream?(
    messages: AIMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      functions?: AIFunction[];
      onChunk: (chunk: AIStreamChunk) => void;
    }
  ): Promise<void> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        const streamPromise = this.executeStream(messages, options);
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new StreamTimeoutError(this.streamTimeoutMs)),
            this.streamTimeoutMs
          );
        });

        try {
          await Promise.race([streamPromise, timeoutPromise]);
        } finally {
          if (timeoutId !== null) clearTimeout(timeoutId);
        }

        this.latencyMs = Date.now() - startTime;
        this.isAvailableFlag = true;
        return;
      } catch (error) {
        if (error instanceof StreamTimeoutError) {
          this.isAvailableFlag = false;
          throw error;
        }
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    this.isAvailableFlag = false;
    throw lastError || new Error('AI streaming request failed after retries');
  }

  protected abstract executeComplete(
    messages: AIMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      functions?: AIFunction[];
    }
  ): Promise<AIResponse>;

  protected abstract executeStream(
    messages: AIMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      functions?: AIFunction[];
      onChunk: (chunk: AIStreamChunk) => void;
    }
  ): Promise<void>;

  protected async fetchWithTimeout(
    url: string,
    init: RequestInit & { timeout?: number } = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = init.timeout || this.timeoutMs;

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  destroy(): void {
    // Cleanup if needed
  }
}