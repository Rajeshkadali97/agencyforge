import { ILogger } from '../interfaces';
import { EnhancedEventBus } from '../events/EnhancedEventBus';

export type AgentDivision =
  | 'academic'
  | 'design'
  | 'engineering'
  | 'finance'
  | 'game-development'
  | 'gis'
  | 'healthcare'
  | 'marketing'
  | 'paid-media'
  | 'product'
  | 'project-management'
  | 'sales'
  | 'security'
  | 'spatial-computing'
  | 'specialized'
  | 'support'
  | 'testing'
  | 'custom';

export type MemoryScopeType =
  | 'short-term'
  | 'long-term'
  | 'episodic'
  | 'semantic'
  | 'knowledge-graph'
  | 'project'
  | 'client'
  | 'workflow'
  | 'agent'
  | 'conversation'
  | 'learning';

export type ModelProvider =
  | 'ollama'
  | 'openrouter'
  | 'gemini'
  | 'nim'
  | 'claude'
  | 'gpt'
  | 'deepseek'
  | 'qwen';

export type ToolCategory =
  | 'filesystem'
  | 'browser'
  | 'terminal'
  | 'github'
  | 'database'
  | 'api'
  | 'figma'
  | 'photoshop'
  | 'canva'
  | 'vercel'
  | 'deployment'
  | 'email'
  | 'calendar'
  | 'slack'
  | 'notion'
  | 'mcp'
  | 'custom';

export interface AgentCapability {
  name: string;
  version: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  requiredTools?: string[];
  requiredModels?: string[];
  workflowTags?: string[];
  complexity?: 'low' | 'medium' | 'high' | 'critical';
  estimatedCost?: number;
  estimatedLatencyMs?: number;
}

export interface AgentSkill {
  id: string;
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  promptTemplate?: string;
  parameters?: Record<string, unknown>;
  examples?: Array<{ input: unknown; output: unknown }>;
  dependencies?: string[];
}

export interface ToolPermission {
  toolId: string;
  category: ToolCategory;
  allowed: boolean;
  scopes?: string[];
  rateLimit?: { requests: number; windowMs: number };
  requiresApproval?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ModelPreference {
  provider: ModelProvider;
  model?: string;
  priority: number;
  maxCostPer1kTokens?: number;
  maxLatencyMs?: number;
  requiredCapabilities?: string[];
  fallbackProviders?: ModelProvider[];
}

export interface CostProfile {
  estimatedCostPerExecution: number;
  costBreakdown: Record<string, number>;
  budgetLimit?: number;
  costOptimizationEnabled: boolean;
  preferredProviders: ModelProvider[];
}

export interface MemoryProfile {
  scopes: MemoryScopeType[];
  maxShortTermItems: number;
  maxLongTermItems: number;
  episodicRetentionDays: number;
  semanticIndexingEnabled: boolean;
  knowledgeGraphEnabled: boolean;
  projectMemoryEnabled: boolean;
  clientMemoryEnabled: boolean;
  workflowMemoryEnabled: boolean;
  learningEnabled: boolean;
  memorySharing: 'none' | 'read' | 'write' | 'full';
}

export interface CharacterProfile {
  name: string;
  displayName: string;
  avatar?: string;
  emoji?: string;
  vibe?: string;
  personalityTraits: string[];
  communicationStyle: string;
  emotionalRange: string[];
  animationStates: {
    thinking: string;
    working: string;
    completed: string;
    failed: string;
    idle: string;
  };
  color?: string;
  backgroundStory?: string;
}

export interface VoiceProfile {
  enabled: boolean;
  voiceId?: string;
  provider?: 'elevenlabs' | 'openai' | 'google' | 'azure' | 'local';
  language: string;
  speakingRate: number;
  pitch: number;
  volume: number;
  streamingEnabled: boolean;
  interruptionHandling: 'pause' | 'queue' | 'override' | 'none';
  contextAwareness: boolean;
  agentSwitchingEnabled: boolean;
  voiceRouting?: Record<string, string>;
}

export interface ProviderRoutingRule {
  capability?: string;
  toolRequirement?: string;
  costPriority: number;
  latencyPriority: number;
  qualityPriority: number;
  availabilityPriority: number;
  preferredProviders: ModelProvider[];
  excludedProviders?: ModelProvider[];
  maxCostPer1kTokens?: number;
  maxLatencyMs?: number;
  requiredCapabilities?: string[];
}

export interface WorkflowTag {
  tag: string;
  category: 'orchestration' | 'research' | 'design' | 'engineering' | 'testing' | 'deployment' | 'business' | 'custom';
  description: string;
  requiredCapabilities?: string[];
  compatibleTags?: string[];
  conflictingTags?: string[];
}

export interface AgentDependency {
  agentId: string;
  capability?: string;
  version?: string;
  required: boolean;
  relationship: 'sequential' | 'parallel' | 'conditional' | 'fallback';
}

export interface AgentPromptTemplate {
  id: string;
  name: string;
  version: string;
  systemPrompt: string;
  userPromptTemplate?: string;
  fewShotExamples?: Array<{ input: string; output: string }>;
  variables: Record<string, { type: string; description: string; required: boolean }>;
  tags: string[];
}

export interface AgentDefinition {
  id: string;
  name: string;
  displayName?: string;
  version: string;
  division: AgentDivision;
  description: string;
  capabilities: AgentCapability[];
  skills: AgentSkill[];
  toolPermissions: ToolPermission[];
  modelPreferences: ModelPreference[];
  costProfile: CostProfile;
  memoryProfile: MemoryProfile;
  characterProfile: CharacterProfile;
  voiceProfile: VoiceProfile;
  providerRoutingRules: ProviderRoutingRule[];
  workflowTags: WorkflowTag[];
  dependencies: AgentDependency[];
  promptTemplates: AgentPromptTemplate[];
  lifecycle: {
    autoInitialize: boolean;
    healthCheckIntervalMs: number;
    maxConcurrentExecutions: number;
    timeoutMs: number;
    retryPolicy: {
      maxRetries: number;
      backoffMs: number;
      retryableErrors: string[];
    };
    gracefulShutdownTimeoutMs: number;
  };
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  tags: string[];
}

export interface AgentInstance {
  definition: AgentDefinition;
  runtime: any;
  status: 'uninitialized' | 'initializing' | 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'disposed';
  health: 'healthy' | 'degraded' | 'unavailable';
  currentTaskId?: string;
  progress?: number;
  message?: string;
  metrics: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageLatencyMs: number;
    totalCost: number;
    lastExecutionAt?: string;
  };
  loadedAt: string;
  lastReloadAt?: string;
}

export interface CapabilityGraphNode {
  capability: string;
  agents: string[];
  dependencies: string[];
  dependents: string[];
  workflowTags: string[];
  complexity: number;
}

export interface CapabilityGraph {
  nodes: Map<string, CapabilityGraphNode>;
  edges: Array<{ from: string; to: string; type: 'depends_on' | 'enables' | 'conflicts_with' }>;
}

export interface AgentLoadResult {
  success: boolean;
  agentId?: string;
  error?: string;
  warnings?: string[];
}

export interface AgentRegistryConfig {
  autoDiscover: boolean;
  discoveryPaths: string[];
  hotReload: boolean;
  hotReloadIntervalMs: number;
  maxConcurrentAgents: number;
  defaultTimeoutMs: number;
  enableCapabilityGraph: boolean;
  enableProviderRouting: boolean;
  enableCostTracking: boolean;
  enableMemoryScopes: boolean;
  enableVoice: boolean;
  enableCharacter: boolean;
  persistDefinitions: boolean;
  definitionsStoragePath?: string;
}

export const DEFAULT_AGENT_REGISTRY_CONFIG: AgentRegistryConfig = {
  autoDiscover: true,
  discoveryPaths: ['./agents', './src/agent/definitions'],
  hotReload: true,
  hotReloadIntervalMs: 5000,
  maxConcurrentAgents: 100,
  defaultTimeoutMs: 30000,
  enableCapabilityGraph: true,
  enableProviderRouting: true,
  enableCostTracking: true,
  enableMemoryScopes: true,
  enableVoice: true,
  enableCharacter: true,
  persistDefinitions: true,
  definitionsStoragePath: './data/agent-definitions',
};

export function createDefaultMemoryProfile(): MemoryProfile {
  return {
    scopes: ['short-term', 'long-term', 'project', 'workflow', 'agent'],
    maxShortTermItems: 1000,
    maxLongTermItems: 10000,
    episodicRetentionDays: 30,
    semanticIndexingEnabled: true,
    knowledgeGraphEnabled: false,
    projectMemoryEnabled: true,
    clientMemoryEnabled: true,
    workflowMemoryEnabled: true,
    learningEnabled: true,
    memorySharing: 'read',
  };
}

export function createDefaultCostProfile(): CostProfile {
  return {
    estimatedCostPerExecution: 0.01,
    costBreakdown: {},
    budgetLimit: 10.0,
    costOptimizationEnabled: true,
    preferredProviders: ['claude', 'gpt', 'gemini'],
  };
}

export function createDefaultCharacterProfile(id: string, name: string): CharacterProfile {
  return {
    name: id,
    displayName: name,
    avatar: undefined,
    emoji: '🤖',
    vibe: 'Professional and capable AI agent',
    personalityTraits: ['professional', 'helpful', 'precise'],
    communicationStyle: 'Clear, concise, and actionable',
    emotionalRange: ['neutral', 'focused', 'satisfied', 'concerned'],
    animationStates: {
      thinking: '💭',
      working: '⚙️',
      completed: '✅',
      failed: '❌',
      idle: '💤',
    },
    color: '#3B82F6',
  };
}

export function createDefaultVoiceProfile(): VoiceProfile {
  return {
    enabled: false,
    language: 'en',
    speakingRate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    streamingEnabled: true,
    interruptionHandling: 'pause',
    contextAwareness: true,
    agentSwitchingEnabled: true,
  };
}

export function createDefaultProviderRoutingRules(): ProviderRoutingRule[] {
  return [
    {
      costPriority: 3,
      latencyPriority: 2,
      qualityPriority: 5,
      availabilityPriority: 4,
      preferredProviders: ['claude', 'gpt'],
    },
    {
      capability: 'research',
      costPriority: 2,
      latencyPriority: 3,
      qualityPriority: 5,
      availabilityPriority: 4,
      preferredProviders: ['claude', 'gpt', 'gemini'],
    },
    {
      capability: 'coding',
      costPriority: 2,
      latencyPriority: 3,
      qualityPriority: 5,
      availabilityPriority: 4,
      preferredProviders: ['claude', 'gpt', 'deepseek'],
    },
    {
      toolRequirement: 'browser',
      costPriority: 1,
      latencyPriority: 2,
      qualityPriority: 4,
      availabilityPriority: 5,
      preferredProviders: ['claude', 'gpt'],
    },
  ];
}