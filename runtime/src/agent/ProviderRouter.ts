import { ILogger } from '../interfaces';
import { EnhancedEventBus } from '../events/EnhancedEventBus';
import {
  ModelProvider,
  ModelPreference,
  ProviderRoutingRule,
  AgentDefinition,
  AgentCapability,
  ToolPermission,
} from './AgentDefinition';
import { AIService, getAIService, initializeAIService } from '../ai/ai-service';
import { AIProvider, AIMessage, AIResponse } from '../ai/providers/base';

export interface ModelInfo {
  provider: ModelProvider;
  model: string;
  capabilities: string[];
  costPer1kInputTokens: number;
  costPer1kOutputTokens: number;
  maxTokens: number;
  latencyMs: number;
  qualityScore: number;
  availability: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
}

export interface RoutingDecision {
  provider: ModelProvider;
  model: string;
  reasoning: string;
  estimatedCost: number;
  estimatedLatencyMs: number;
  qualityScore: number;
  fallbacks: Array<{ provider: ModelProvider; model: string }>;
}

export interface RoutingContext {
  agentId: string;
  capability?: string;
  requiredTools?: string[];
  inputTokens?: number;
  outputTokens?: number;
  maxCost?: number;
  maxLatencyMs?: number;
  requiredQuality?: number;
  userTier?: 'free' | 'pro' | 'enterprise';
}

export class ProviderRouter {
  private logger: ILogger;
  private eventBus: EnhancedEventBus;
  private models: Map<string, ModelInfo> = new Map();
  private providerHealth: Map<ModelProvider, { healthy: boolean; lastCheck: Date; errorRate: number }> = new Map();
  private routingRules: ProviderRoutingRule[] = [];
  private usageStats: Map<string, { totalCost: number; totalRequests: number; totalLatencyMs: number; errors: number }> = new Map();
  private aiService: AIService;

  constructor(logger: ILogger, eventBus: EnhancedEventBus, aiService?: AIService) {
    this.logger = logger;
    this.eventBus = eventBus;
    this.aiService = aiService || getAIService();
    this.initializeDefaultModels();
    this.initializeProviderHealth();
  }

  private initializeDefaultModels(): void {
    const defaultModels: ModelInfo[] = [
      {
        provider: 'ollama',
        model: 'llama3.2',
        capabilities: ['reasoning', 'coding', 'analysis', 'writing'],
        costPer1kInputTokens: 0,
        costPer1kOutputTokens: 0,
        maxTokens: 8192,
        latencyMs: 3000,
        qualityScore: 82,
        availability: 0.9,
        supportsTools: false,
        supportsStreaming: true,
        supportsVision: false,
        supportsFunctionCalling: false,
      },
      {
        provider: 'openrouter',
        model: 'openrouter/auto',
        capabilities: ['reasoning', 'coding', 'analysis', 'writing'],
        costPer1kInputTokens: 0,
        costPer1kOutputTokens: 0,
        maxTokens: 128000,
        latencyMs: 2000,
        qualityScore: 85,
        availability: 0.95,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: false,
        supportsFunctionCalling: true,
      },
      {
        provider: 'openrouter',
        model: 'google/gemini-2.0-flash-thinking-exp:free',
        capabilities: ['reasoning', 'coding', 'analysis', 'writing'],
        costPer1kInputTokens: 0,
        costPer1kOutputTokens: 0,
        maxTokens: 128000,
        latencyMs: 1500,
        qualityScore: 88,
        availability: 0.98,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
        supportsFunctionCalling: true,
      },
      {
        provider: 'openrouter',
        model: 'deepseek/deepseek-chat-v3-免费直通版',
        capabilities: ['reasoning', 'coding', 'analysis', 'writing'],
        costPer1kInputTokens: 0,
        costPer1kOutputTokens: 0,
        maxTokens: 128000,
        latencyMs: 2000,
        qualityScore: 85,
        availability: 0.95,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: false,
        supportsFunctionCalling: true,
      },
      {
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        capabilities: ['reasoning', 'coding', 'analysis', 'writing', 'vision', 'long-context'],
        costPer1kInputTokens: 0,
        costPer1kOutputTokens: 0,
        maxTokens: 1000000,
        latencyMs: 1000,
        qualityScore: 82,
        availability: 0.98,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
        supportsFunctionCalling: true,
      },
      {
        provider: 'nim',
        model: 'nvidia/llama-3.1-nemotron-70b-instruct',
        capabilities: ['reasoning', 'coding', 'analysis', 'writing'],
        costPer1kInputTokens: 0,
        costPer1kOutputTokens: 0,
        maxTokens: 128000,
        latencyMs: 2500,
        qualityScore: 88,
        availability: 0.95,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: false,
        supportsFunctionCalling: true,
      },
      {
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        capabilities: ['reasoning', 'coding', 'analysis', 'writing', 'vision'],
        costPer1kInputTokens: 0.003,
        costPer1kOutputTokens: 0.015,
        maxTokens: 200000,
        latencyMs: 2000,
        qualityScore: 95,
        availability: 0.99,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
        supportsFunctionCalling: true,
      },
      {
        provider: 'claude',
        model: 'claude-3-5-haiku-20241022',
        capabilities: ['reasoning', 'coding', 'analysis', 'writing'],
        costPer1kInputTokens: 0.001,
        costPer1kOutputTokens: 0.005,
        maxTokens: 200000,
        latencyMs: 1000,
        qualityScore: 85,
        availability: 0.99,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
        supportsFunctionCalling: true,
      },
      {
        provider: 'gpt',
        model: 'gpt-4o',
        capabilities: ['reasoning', 'coding', 'analysis', 'writing', 'vision'],
        costPer1kInputTokens: 0.005,
        costPer1kOutputTokens: 0.015,
        maxTokens: 128000,
        latencyMs: 1500,
        qualityScore: 93,
        availability: 0.98,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
        supportsFunctionCalling: true,
      },
      {
        provider: 'gpt',
        model: 'gpt-4o-mini',
        capabilities: ['reasoning', 'coding', 'analysis', 'writing', 'vision'],
        costPer1kInputTokens: 0.00015,
        costPer1kOutputTokens: 0.0006,
        maxTokens: 128000,
        latencyMs: 800,
        qualityScore: 82,
        availability: 0.99,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
        supportsFunctionCalling: true,
      },
      {
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        capabilities: ['reasoning', 'coding', 'analysis', 'writing', 'vision', 'long-context'],
        costPer1kInputTokens: 0.0035,
        costPer1kOutputTokens: 0.0105,
        maxTokens: 2000000,
        latencyMs: 2500,
        qualityScore: 90,
        availability: 0.97,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
        supportsFunctionCalling: true,
      },
      {
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        capabilities: ['reasoning', 'coding', 'analysis', 'writing', 'vision', 'long-context'],
        costPer1kInputTokens: 0.000075,
        costPer1kOutputTokens: 0.0003,
        maxTokens: 2000000,
        latencyMs: 1000,
        qualityScore: 80,
        availability: 0.98,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
        supportsFunctionCalling: true,
      },
      {
        provider: 'openrouter',
        model: 'qwen/qwen-2.5-72b-instruct:free',
        capabilities: ['coding', 'reasoning', 'analysis'],
        costPer1kInputTokens: 0,
        costPer1kOutputTokens: 0,
        maxTokens: 32000,
        latencyMs: 2000,
        qualityScore: 83,
        availability: 0.95,
        supportsTools: false,
        supportsStreaming: true,
        supportsVision: false,
        supportsFunctionCalling: false,
      },
      {
        provider: 'deepseek',
        model: 'deepseek-coder',
        capabilities: ['coding', 'reasoning'],
        costPer1kInputTokens: 0.00014,
        costPer1kOutputTokens: 0.00028,
        maxTokens: 128000,
        latencyMs: 1500,
        qualityScore: 88,
        availability: 0.95,
        supportsTools: false,
        supportsStreaming: true,
        supportsVision: false,
        supportsFunctionCalling: false,
      },
      {
        provider: 'qwen',
        model: 'qwen-2.5-coder-32b',
        capabilities: ['coding', 'reasoning'],
        costPer1kInputTokens: 0.0004,
        costPer1kOutputTokens: 0.0008,
        maxTokens: 32000,
        latencyMs: 1200,
        qualityScore: 85,
        availability: 0.96,
        supportsTools: false,
        supportsStreaming: true,
        supportsVision: false,
        supportsFunctionCalling: false,
      },
    ];

    for (const model of defaultModels) {
      const key = `${model.provider}/${model.model}`;
      this.models.set(key, model);
    }
  }

  private initializeProviderHealth(): void {
    for (const provider of ['ollama', 'openrouter', 'gemini', 'nim', 'claude', 'gpt', 'deepseek', 'qwen'] as ModelProvider[]) {
      this.providerHealth.set(provider, {
        healthy: true,
        lastCheck: new Date(),
        errorRate: 0,
      });
    }
  }

  setRoutingRules(rules: ProviderRoutingRule[]): void {
    this.routingRules = rules;
  }

  async route(context: RoutingContext): Promise<RoutingDecision> {
    const candidates = this.getCandidateModels(context);
    if (candidates.length === 0) {
      throw new Error('No suitable models available');
    }

    const scored = candidates.map((model) => ({
      model,
      score: this.calculateScore(model, context),
    }));

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    const fallbacks = scored.slice(1, 4).map((s) => ({ provider: s.model.provider, model: s.model.model }));

    const inputTokens = context.inputTokens || 1000;
    const outputTokens = context.outputTokens || 500;
    const estimatedCost = (best.model.costPer1kInputTokens * inputTokens + best.model.costPer1kOutputTokens * outputTokens) / 1000;

    this.logger.debug('ProviderRouter: Routing decision', {
      agentId: context.agentId,
      selectedProvider: best.model.provider,
      selectedModel: best.model.model,
      score: best.score,
      estimatedCost,
      candidates: candidates.length,
    });

    return {
      provider: best.model.provider,
      model: best.model.model,
      reasoning: this.generateReasoning(best.model, context, scored),
      estimatedCost,
      estimatedLatencyMs: best.model.latencyMs,
      qualityScore: best.model.qualityScore,
      fallbacks,
    };
  }

  async executeAI(
    messages: AIMessage[],
    context: RoutingContext,
    options?: {
      temperature?: number;
      maxTokens?: number;
      forceProvider?: string;
    }
  ): Promise<AIResponse> {
    const decision = await this.route(context);

    const messagesForAI: AIMessage[] = messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content as string,
    }));

    try {
      const response = await this.aiService.complete(messagesForAI, {
        model: decision.model,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        // All requests must try 9Router first — never bypass via forceProvider.
        preferredProvider: 'ninerouter',
      });

      this.recordUsage(decision.provider, decision.model, response.cost || 0, response.latencyMs, false);
      return response;
    } catch (error) {
      this.recordUsage(decision.provider, decision.model, 0, 0, true);
      throw error;
    }
  }

  async executeAIStream(
    messages: AIMessage[],
    context: RoutingContext,
    onChunk: (content: string, done: boolean) => void,
    options?: {
      temperature?: number;
      maxTokens?: number;
      forceProvider?: string;
    }
  ): Promise<void> {
    const decision = await this.route(context);

    const messagesForAI: AIMessage[] = messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content as string,
    }));

    try {
      await this.aiService.stream(messagesForAI, {
        model: decision.model,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        // All requests must try 9Router first — never bypass via forceProvider.
        preferredProvider: 'ninerouter',
        onChunk: (chunk) => onChunk(chunk.content, chunk.done),
      });

      this.recordUsage(decision.provider, decision.model, 0, 0, false);
    } catch (error) {
      this.recordUsage(decision.provider, decision.model, 0, 0, true);
      throw error;
    }
  }

  getAIService(): AIService {
    return this.aiService;
  }

  private getCandidateModels(context: RoutingContext): ModelInfo[] {
    const candidates: ModelInfo[] = [];

    for (const model of this.models.values()) {
      const health = this.providerHealth.get(model.provider);
      if (health && !health.healthy) {
        continue;
      }

      if (context.requiredTools && context.requiredTools.length > 0 && !model.supportsTools) {
        continue;
      }

      if (context.maxCost) {
        const estimatedCost = (model.costPer1kInputTokens * (context.inputTokens || 1000) +
          model.costPer1kOutputTokens * (context.outputTokens || 500)) / 1000;
        if (estimatedCost > context.maxCost) {
          continue;
        }
      }

      if (context.maxLatencyMs && model.latencyMs > context.maxLatencyMs) {
        continue;
      }

      if (context.requiredQuality && model.qualityScore < context.requiredQuality) {
        continue;
      }

      if (context.capability && !model.capabilities.includes(context.capability)) {
        const hasRelated = model.capabilities.some((c) => this.isRelatedCapability(c, context.capability!));
        if (!hasRelated) continue;
      }

      candidates.push(model);
    }

    return candidates;
  }

  private isRelatedCapability(modelCap: string, requiredCap: string): boolean {
    const related: Record<string, string[]> = {
      'coding': ['reasoning', 'analysis'],
      'reasoning': ['coding', 'analysis'],
      'analysis': ['reasoning', 'coding'],
      'writing': ['analysis', 'reasoning'],
      'vision': ['analysis'],
      'long-context': ['analysis', 'writing'],
    };
    return related[requiredCap]?.includes(modelCap) || false;
  }

  private calculateScore(model: ModelInfo, context: RoutingContext): number {
    let score = 0;

    const rules = this.routingRules.filter((r) => this.ruleMatches(r, context));
    const effectiveRules = rules.length > 0 ? rules : this.getDefaultRules();

    for (const rule of effectiveRules) {
      const weights = {
        cost: rule.costPriority,
        latency: rule.latencyPriority,
        quality: rule.qualityPriority,
        availability: rule.availabilityPriority,
      };

      const totalWeight = weights.cost + weights.latency + weights.quality + weights.availability;

      if (weights.cost > 0) {
        const costScore = this.normalizeCost(model, context);
        score += (costScore * weights.cost) / totalWeight;
      }
      if (weights.latency > 0) {
        const latencyScore = this.normalizeLatency(model, context);
        score += (latencyScore * weights.latency) / totalWeight;
      }
      if (weights.quality > 0) {
        score += (model.qualityScore / 100 * weights.quality) / totalWeight;
      }
      if (weights.availability > 0) {
        score += (model.availability * weights.availability) / totalWeight;
      }

      if (rule.preferredProviders.includes(model.provider)) {
        score *= 1.2;
      }
      if (rule.excludedProviders?.includes(model.provider)) {
        score *= 0.1;
      }
    }

    const stats = this.usageStats.get(`${model.provider}/${model.model}`);
    if (stats && stats.totalRequests > 10) {
      const errorRate = stats.errors / stats.totalRequests;
      if (errorRate > 0.1) {
        score *= 0.5;
      }
      const avgLatency = stats.totalLatencyMs / stats.totalRequests;
      if (avgLatency > model.latencyMs * 2) {
        score *= 0.8;
      }
    }

    return score;
  }

  private ruleMatches(rule: ProviderRoutingRule, context: RoutingContext): boolean {
    if (rule.capability && rule.capability !== context.capability) return false;
    if (rule.toolRequirement && !context.requiredTools?.includes(rule.toolRequirement)) return false;
    return true;
  }

  private getDefaultRules(): ProviderRoutingRule[] {
    return [
      { costPriority: 5, latencyPriority: 3, qualityPriority: 4, availabilityPriority: 5, preferredProviders: ['ollama', 'openrouter', 'gemini', 'nim'] },
      { costPriority: 3, latencyPriority: 2, qualityPriority: 5, availabilityPriority: 4, preferredProviders: ['claude', 'gpt'] },
    ];
  }

  private normalizeCost(model: ModelInfo, context: RoutingContext): number {
    const inputTokens = context.inputTokens || 1000;
    const outputTokens = context.outputTokens || 500;
    const cost = (model.costPer1kInputTokens * inputTokens + model.costPer1kOutputTokens * outputTokens) / 1000;
    const maxCost = context.maxCost || 1.0;
    return Math.max(0, 1 - cost / maxCost);
  }

  private normalizeLatency(model: ModelInfo, context: RoutingContext): number {
    const maxLatency = context.maxLatencyMs || 5000;
    return Math.max(0, 1 - model.latencyMs / maxLatency);
  }

  private generateReasoning(model: ModelInfo, context: RoutingContext, scored: Array<{ model: ModelInfo; score: number }>): string {
    const reasons: string[] = [];

    if (context.capability && model.capabilities.includes(context.capability)) {
      reasons.push(`Specialized in ${context.capability}`);
    }

    if (context.requiredTools && context.requiredTools.length > 0 && model.supportsTools) {
      reasons.push('Supports required tools');
    }

    if (model.provider === 'ollama' && model.costPer1kInputTokens === 0) {
      reasons.push('Zero cost (local model)');
    } else if (model.costPer1kInputTokens < 0.001) {
      reasons.push('Very low cost');
    }

    if (model.qualityScore >= 90) {
      reasons.push('High quality score');
    }

    if (model.latencyMs < 1500) {
      reasons.push('Low latency');
    }

    const stats = this.usageStats.get(`${model.provider}/${model.model}`);
    if (stats && stats.totalRequests > 100 && stats.errors / stats.totalRequests < 0.01) {
      reasons.push('Proven reliability');
    }

    return reasons.join('; ') || 'Best overall match';
  }

  recordUsage(provider: ModelProvider, model: string, cost: number, latencyMs: number, error: boolean): void {
    const key = `${provider}/${model}`;
    const stats = this.usageStats.get(key) || { totalCost: 0, totalRequests: 0, totalLatencyMs: 0, errors: 0 };

    stats.totalCost += cost;
    stats.totalRequests++;
    stats.totalLatencyMs += latencyMs;
    if (error) stats.errors++;

    this.usageStats.set(key, stats);
  }

  updateProviderHealth(provider: ModelProvider, healthy: boolean, errorRate?: number): void {
    const health = this.providerHealth.get(provider);
    if (health) {
      health.healthy = healthy;
      health.lastCheck = new Date();
      if (errorRate !== undefined) {
        health.errorRate = errorRate;
      }
    }
  }

  getModels(): ModelInfo[] {
    return Array.from(this.models.values());
  }

  getModel(provider: ModelProvider, model: string): ModelInfo | undefined {
    return this.models.get(`${provider}/${model}`);
  }

  getStats(): {
    totalModels: number;
    healthyProviders: number;
    totalUsage: { requests: number; cost: number; avgLatencyMs: number; errorRate: number };
    providerStats: Record<string, { requests: number; cost: number; avgLatencyMs: number; errorRate: number }>;
  } {
    let totalRequests = 0;
    let totalCost = 0;
    let totalLatency = 0;
    let totalErrors = 0;
    const providerStats: Record<string, any> = {};

    for (const [key, stats] of this.usageStats) {
      const [provider] = key.split('/');
      totalRequests += stats.totalRequests;
      totalCost += stats.totalCost;
      totalLatency += stats.totalLatencyMs;
      totalErrors += stats.errors;

      if (!providerStats[provider]) {
        providerStats[provider] = { requests: 0, cost: 0, totalLatencyMs: 0, errors: 0 };
      }
      providerStats[provider].requests += stats.totalRequests;
      providerStats[provider].cost += stats.totalCost;
      providerStats[provider].totalLatencyMs += stats.totalLatencyMs;
      providerStats[provider].errors += stats.errors;
    }

    for (const provider of Object.keys(providerStats)) {
      const s = providerStats[provider];
      s.avgLatencyMs = s.requests > 0 ? s.totalLatencyMs / s.requests : 0;
      s.errorRate = s.requests > 0 ? s.errors / s.requests : 0;
    }

    const healthyProviders = Array.from(this.providerHealth.values()).filter((h) => h.healthy).length;

    return {
      totalModels: this.models.size,
      healthyProviders,
      totalUsage: {
        requests: totalRequests,
        cost: totalCost,
        avgLatencyMs: totalRequests > 0 ? totalLatency / totalRequests : 0,
        errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      },
      providerStats,
    };
  }
}

export class CostOptimizer {
  private router: ProviderRouter;
  private logger: ILogger;

  constructor(router: ProviderRouter, logger: ILogger) {
    this.router = router;
    this.logger = logger;
  }

  async optimizeForAgent(
    agent: AgentDefinition,
    context: RoutingContext
  ): Promise<{ original: RoutingDecision; optimized: RoutingDecision; savings: number }> {
    const original = await this.router.route(context);

    const costOptimizedContext: RoutingContext = {
      ...context,
      maxCost: agent.costProfile.budgetLimit,
    };

    const optimized = await this.router.route(costOptimizedContext);

    const savings = original.estimatedCost - optimized.estimatedCost;

    if (savings > 0) {
      this.logger.info('CostOptimizer: Found cheaper alternative', {
        agentId: agent.id,
        originalProvider: original.provider,
        originalModel: original.model,
        originalCost: original.estimatedCost,
        optimizedProvider: optimized.provider,
        optimizedModel: optimized.model,
        optimizedCost: optimized.estimatedCost,
        savings,
      });
    }

    return { original, optimized, savings };
  }

  async batchOptimize(
    agents: AgentDefinition[],
    contexts: RoutingContext[]
  ): Promise<Array<{ agentId: string; original: RoutingDecision; optimized: RoutingDecision; savings: number }>> {
    const results = [];

    for (let i = 0; i < agents.length; i++) {
      const result = await this.optimizeForAgent(agents[i], contexts[i]);
      results.push({ agentId: agents[i].id, ...result });
    }

    return results;
  }
}