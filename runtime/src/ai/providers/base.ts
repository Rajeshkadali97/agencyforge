export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  provider: string;
  model: string;
  tokensUsed?: {
    input: number;
    output: number;
  };
  cost?: number;
  latencyMs: number;
}

export interface AIStreamChunk {
  content: string;
  done: boolean;
}

export interface AIProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly capabilities: string[];
  readonly supportsStreaming: boolean;
  readonly supportsFunctionCalling: boolean;

  isAvailable(): boolean;
  isConfigured(): boolean;
  getHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unavailable'; latencyMs?: number }>;

  complete(messages: AIMessage[], options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    functions?: AIFunction[];
  }): Promise<AIResponse>;

  stream?(messages: AIMessage[], options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    functions?: AIFunction[];
    onChunk: (chunk: AIStreamChunk) => void;
  }): Promise<void>;

  destroy(): void;
}

export interface AIFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ModelInfo {
  id: string;
  provider: string;
  name: string;
  capabilities: string[];
  costPer1kInputTokens: number;
  costPer1kOutputTokens: number;
  maxTokens: number;
  latencyMs: number;
  qualityScore: number;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
}

export interface RoutingDecision {
  provider: AIProvider;
  model: string;
  reasoning: string;
  estimatedCost: number;
  estimatedLatencyMs: number;
}

export type AIFreeProvider = 'ninerouter' | 'nim' | 'openrouter' | 'gemini' | 'ollama';
export type AIOptionalProvider = 'anthropic' | 'openai';

export const FREE_PROVIDERS: AIFreeProvider[] = ['ninerouter', 'nim', 'openrouter', 'gemini', 'ollama'];
export const OPTIONAL_PROVIDERS: AIOptionalProvider[] = ['anthropic', 'openai'];