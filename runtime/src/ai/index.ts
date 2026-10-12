export * from './providers/base';
export * from './providers/base-provider';
export * from './providers/openrouter';
export * from './providers/nim';
export * from './providers/gemini';
export * from './providers/ollama';
export * from './providers/optional/anthropic';
export * from './providers/optional/openai';
export * from './provider-factory';
export * from './ai-service';

import { AIService, getAIService, initializeAIService } from './ai-service';
import { ProviderFactory, createProviderFactory } from './provider-factory';

export { AIService, getAIService, initializeAIService, ProviderFactory, createProviderFactory };

export const version = '1.0.0';
export const name = '@agencyforge/ai-providers';