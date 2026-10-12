import { BaseAIProvider } from './base-provider';
import { AIResponse, AIMessage, AIFunction, AIStreamChunk } from './base';

export class GeminiProvider extends BaseAIProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  readonly version = '1.0.0';
  readonly capabilities = ['chat', 'functions', 'streaming', 'vision'];
  readonly supportsStreaming = true;
  readonly supportsFunctionCalling = true;

  protected getDefaultBaseUrl(): string {
    return 'https://generativelanguage.googleapis.com/v1beta';
  }

  protected getHeaders() {
    return {
      'Content-Type': 'application/json',
    };
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getModelName(model: string = 'gemini-2.0-flash'): string {
    if (!model.startsWith('models/')) {
      return `models/${model}`;
    }
    return model;
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
    const model = options?.model || 'gemini-2.0-flash';
    const modelName = this.getModelName(model);

    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = messages.find(m => m.role === 'system');
    const tools = options?.functions?.length ? {
      functionDeclarations: options.functions.map(f => ({
        name: f.name,
        description: f.description,
        parameters: f.parameters,
      })),
    } : undefined;

    const body: Record<string, unknown> = {
      contents,
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
    }
    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options?.maxTokens) {
      body.maxOutputTokens = options.maxTokens;
    }
    if (tools) {
      body.tools = [tools];
    }

    const url = `${this.baseUrl}/${modelName}:generateContent?key=${this.apiKey}`;
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
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }> };
          finishReason?: string;
        }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
      };

      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      let content = '';
      const functionCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

      for (const part of parts) {
        if (part.text) {
          content += part.text;
        }
        if (part.functionCall) {
          functionCalls.push({
            name: part.functionCall.name,
            arguments: part.functionCall.args,
          });
        }
      }

      if (functionCalls.length > 0) {
        content = JSON.stringify({ __tool_calls: functionCalls });
      }

      const latencyMs = Date.now() - startTime;
      const usage = data.usageMetadata || {};

      return {
        content,
        provider: this.id,
        model,
        tokensUsed: {
          input: usage.promptTokenCount || 0,
          output: usage.candidatesTokenCount || 0,
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
    const model = options?.model || 'gemini-2.0-flash';
    const modelName = this.getModelName(model);

    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = messages.find(m => m.role === 'system');
    const tools = options?.functions?.length ? {
      functionDeclarations: options.functions.map(f => ({
        name: f.name,
        description: f.description,
        parameters: f.parameters,
      })),
    } : undefined;

    const body: Record<string, unknown> = {
      contents,
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
    }
    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options?.maxTokens) {
      body.maxOutputTokens = options.maxTokens;
    }
    if (tools) {
      body.tools = [tools];
    }

    const url = `${this.baseUrl}/${modelName}:streamGenerateContent?key=${this.apiKey}&alt=sse`;
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
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
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
              const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
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