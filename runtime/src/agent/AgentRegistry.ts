import { EventEmitter } from 'events';
import * as fs from 'fs';
import { ILogger, IEventBus } from '../interfaces';
import { EnhancedEventBus, EventHandler } from '../events/EnhancedEventBus';
import {
  AgentDefinition,
  AgentInstance,
  AgentRegistryConfig,
  AgentLoadResult,
  CapabilityGraph,
  CapabilityGraphNode,
  AgentCapability,
  ToolPermission,
  MemoryProfile,
  CharacterProfile,
  VoiceProfile,
  ProviderRoutingRule,
  WorkflowTag,
  AgentDependency,
  AgentPromptTemplate,
  DEFAULT_AGENT_REGISTRY_CONFIG,
  createDefaultMemoryProfile,
  createDefaultCostProfile,
  createDefaultCharacterProfile,
  createDefaultVoiceProfile,
  createDefaultProviderRoutingRules,
} from './AgentDefinition';
import { CapabilityGraphBuilder, CapabilityRouter } from './CapabilityGraph';
import { BaseAgent, IAgentRuntime, AgentMetadata, IAgentRegistry } from './AgentRuntime';
import { ExecutionContext } from '../context';
import { ConsoleLogger } from '../utils/ConsoleLogger';
import { Configuration } from '../config';

export interface AgentRegistryEvents {
  'agent:registered': { agentId: string; definition: AgentDefinition };
  'agent:unregistered': { agentId: string };
  'agent:loaded': { agentId: string; instance: AgentInstance };
  'agent:unloaded': { agentId: string };
  'agent:reloaded': { agentId: string; instance: AgentInstance };
  'agent:error': { agentId: string; error: Error };
  'agent:health-changed': { agentId: string; health: 'healthy' | 'degraded' | 'unavailable' };
  'agent:status-changed': { agentId: string; status: string };
  'capability:registered': { capability: string; agents: string[] };
  'capability:unregistered': { capability: string };
  'workflow:executed': { workflowId: string; agents: string[]; result: any };
  'cost:updated': { agentId: string; cost: number; totalCost: number };
}

export class AgentRegistry extends EventEmitter implements IAgentRegistry {
  private config: AgentRegistryConfig;
  private logger: ILogger;
  private eventBus: EnhancedEventBus;

  private definitions: Map<string, AgentDefinition> = new Map();
private definitionFiles: Map<string, string> = new Map();
  private instances: Map<string, AgentInstance> = new Map();
  private capabilityIndex: Map<string, Set<string>> = new Map();
  private workflowTagIndex: Map<string, Set<string>> = new Map();
  private divisionIndex: Map<string, Set<string>> = new Map();
  private capabilityGraph: CapabilityGraph | null = null;
  private capabilityRouter: CapabilityRouter | null = null;

  private hotReloadTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private fileWatchers: Map<string, fs.FSWatcher> = new Map();
  private isShuttingDown = false;
  private legacyAgents: Map<string, IAgentRuntime> = new Map();

  constructor(config?: Partial<AgentRegistryConfig>, logger?: ILogger, eventBus?: EnhancedEventBus) {
    super();
    const defaultLogger = logger ?? new ConsoleLogger(new Configuration());
    this.config = { ...DEFAULT_AGENT_REGISTRY_CONFIG, ...config };
    this.logger = defaultLogger;
    this.eventBus = eventBus ?? new EnhancedEventBus(defaultLogger);
  }

  async initialize(): Promise<void> {
    this.logger.info('AgentRegistry: Initializing...');

    if (this.config.autoDiscover) {
      await this.discoverAgents();
    }

    this.buildCapabilityGraph();

    if (this.config.hotReload) {
      this.startHotReload();
    }

    this.startHealthChecks();

    this.logger.info('AgentRegistry: Initialized', {
      agentsLoaded: this.instances.size,
      definitionsLoaded: this.definitions.size,
    });
  }

  async shutdown(): Promise<void> {
    this.logger.info('AgentRegistry: Shutting down...');
    this.isShuttingDown = true;

    if (this.hotReloadTimer) {
      clearInterval(this.hotReloadTimer);
      this.hotReloadTimer = null;
    }

    this.stopFileWatchers();

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    const unloadPromises: Promise<void>[] = [];
    for (const [agentId, instance] of this.instances) {
      if (instance.runtime && typeof instance.runtime.dispose === 'function') {
        unloadPromises.push(instance.runtime.dispose());
      }
    }
    await Promise.all(unloadPromises);

    this.instances.clear();
    this.definitions.clear();
    this.capabilityIndex.clear();
    this.workflowTagIndex.clear();
    this.divisionIndex.clear();

    this.logger.info('AgentRegistry: Shutdown complete');
  }

  async discoverAgents(): Promise<void> {
    this.logger.info('AgentRegistry: Discovering agents...', { paths: this.config.discoveryPaths });

    const oldFiles = new Set(this.definitionFiles.values());

    for (const path of this.config.discoveryPaths) {
      try {
        await this.loadAgentsFromPath(path);
      } catch (error) {
        this.logger.warn('AgentRegistry: Failed to discover agents from path', { path, error: String(error) });
      }
    }

    // Detect removed files
    const newFiles = new Set(this.definitionFiles.values());
    const removedFiles = [...oldFiles].filter(f => !newFiles.has(f));

    for (const removedFile of removedFiles) {
      const entry = [...this.definitionFiles.entries()].find(([, fp]) => fp === removedFile);
      if (entry) {
        const [agentId] = entry;
        await this.unregisterDefinition(agentId);
        this.definitionFiles.delete(agentId);
      }
    }
  }

  private async loadAgentsFromPath(path: string): Promise<void> {
    const fs = await import('fs');
    const pathModule = await import('path');

    if (!fs.existsSync(path)) {
      this.logger.debug('AgentRegistry: Discovery path does not exist', { path });
      return;
    }

    const files = this.findDefinitionFiles(path);
    for (const file of files) {
      try {
        await this.loadDefinitionFromFile(file);
      } catch (error) {
        this.logger.warn('AgentRegistry: Failed to load agent definition', { file, error: String(error) });
      }
    }
  }

  private findDefinitionFiles(dir: string): string[] {
    const fs = require('fs');
    const path = require('path');
    const files: string[] = [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.findDefinitionFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.json') || entry.name.endsWith('.js'))) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private async loadDefinitionFromFile(filePath: string): Promise<void> {
    try {
      const module = await import(filePath);
      const definition = module.default || module.AgentDefinition || module.definition;

      if (definition && this.isValidDefinition(definition)) {
        await this.registerDefinition(definition, filePath);
      }
    } catch (error) {
      this.logger.debug('AgentRegistry: File is not a valid agent definition', { file: filePath, error: String(error) });
    }
  }

  private isValidDefinition(obj: any): obj is AgentDefinition {
    return (
      obj &&
      typeof obj.id === 'string' &&
      typeof obj.name === 'string' &&
      typeof obj.version === 'string' &&
      Array.isArray(obj.capabilities) &&
      Array.isArray(obj.skills) &&
      Array.isArray(obj.toolPermissions) &&
      Array.isArray(obj.modelPreferences)
    );
  }

  async registerDefinition(definition: AgentDefinition, filePath?: string): Promise<AgentLoadResult> {
    const existing = this.definitions.get(definition.id);
    if (existing) {
      return { success: false, error: `Agent ${definition.id} already registered` };
    }

    const validated = this.validateDefinition(definition);
    if (!validated.valid) {
      return { success: false, error: validated.error, warnings: validated.warnings };
    }

    this.definitions.set(definition.id, definition);
    this.updateIndexes(definition);

    if (this.config.enableCapabilityGraph) {
      this.buildCapabilityGraph();
    }

    this.emit('agent:registered', { agentId: definition.id, definition });

    this.logger.info('AgentRegistry: Agent definition registered', { agentId: definition.id, version: definition.version });

    return { success: true, agentId: definition.id, warnings: validated.warnings };
  }

  private validateDefinition(definition: AgentDefinition): { valid: boolean; error?: string; warnings?: string[] } {
    const warnings: string[] = [];

    if (!definition.id || !definition.name) {
      return { valid: false, error: 'Agent must have id and name' };
    }

    if (definition.capabilities.length === 0) {
      warnings.push('Agent has no capabilities');
    }

    if (definition.toolPermissions.length === 0) {
      warnings.push('Agent has no tool permissions');
    }

    if (definition.modelPreferences.length === 0) {
      warnings.push('Agent has no model preferences');
    }

    for (const dep of definition.dependencies) {
      if (dep.required && !this.definitions.has(dep.agentId)) {
        warnings.push(`Required dependency ${dep.agentId} not found`);
      }
    }

    if (this.config.enableCostTracking && definition.costProfile.estimatedCostPerExecution <= 0) {
      warnings.push('Cost profile has zero or negative estimated cost');
    }

    return { valid: true, warnings };
  }

  private updateIndexes(definition: AgentDefinition): void {
    for (const cap of definition.capabilities) {
      if (!this.capabilityIndex.has(cap.name)) {
        this.capabilityIndex.set(cap.name, new Set());
      }
      this.capabilityIndex.get(cap.name)!.add(definition.id);
    }

    for (const tag of definition.workflowTags) {
      if (!this.workflowTagIndex.has(tag.tag)) {
        this.workflowTagIndex.set(tag.tag, new Set());
      }
      this.workflowTagIndex.get(tag.tag)!.add(definition.id);
    }

    if (!this.divisionIndex.has(definition.division)) {
      this.divisionIndex.set(definition.division, new Set());
    }
    this.divisionIndex.get(definition.division)!.add(definition.id);
  }

  private removeIndexes(definition: AgentDefinition): void {
    for (const cap of definition.capabilities) {
      const set = this.capabilityIndex.get(cap.name);
      if (set) {
        set.delete(definition.id);
        if (set.size === 0) {
          this.capabilityIndex.delete(cap.name);
        }
      }
    }

    for (const tag of definition.workflowTags) {
      const set = this.workflowTagIndex.get(tag.tag);
      if (set) {
        set.delete(definition.id);
        if (set.size === 0) {
          this.workflowTagIndex.delete(tag.tag);
        }
      }
    }

    const divSet = this.divisionIndex.get(definition.division);
    if (divSet) {
      divSet.delete(definition.id);
      if (divSet.size === 0) {
        this.divisionIndex.delete(definition.division);
      }
    }
  }

  async unregisterDefinition(agentId: string): Promise<boolean> {
    const definition = this.definitions.get(agentId);
    if (!definition) {
      return false;
    }

    await this.unloadAgent(agentId);
    this.definitions.delete(agentId);
    this.removeIndexes(definition);
    this.buildCapabilityGraph();

    this.emit('agent:unregistered', { agentId });

    this.logger.info('AgentRegistry: Agent definition unregistered', { agentId });
    return true;
  }

  resolveDependencies(agentId: string): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const def = this.definitions.get(id);
      if (!def) return;

      for (const dep of def.dependencies) {
        if (dep.required) {
          visit(dep.agentId);
        }
      }

      result.push(id);
    };

    visit(agentId);
    return result;
  }

  async loadAgent(agentId: string, context?: ExecutionContext): Promise<AgentInstance | null> {
    const definition = this.definitions.get(agentId);
    if (!definition) {
      this.logger.warn('AgentRegistry: Cannot load agent - definition not found', { agentId });
      return null;
    }

    if (this.instances.has(agentId)) {
      return this.instances.get(agentId)!;
    }

    if (this.instances.size >= this.config.maxConcurrentAgents) {
      this.logger.warn('AgentRegistry: Max concurrent agents reached', { max: this.config.maxConcurrentAgents });
      return null;
    }

    const depIds = this.resolveDependencies(agentId);
    for (const depId of depIds) {
      if (!this.instances.has(depId)) {
        this.logger.debug('AgentRegistry: Loading dependency first', { agentId: depId });
        const depInstance = await this.loadAgent(depId, context);
        if (!depInstance) {
          this.logger.warn('AgentRegistry: Failed to load required dependency', { agentId: depId });
        }
      }
    }

    try {
      const runtime = await this.createAgentRuntime(definition);
      const instance: AgentInstance = {
        definition,
        runtime,
        status: 'uninitialized',
        health: 'healthy',
        metrics: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          averageLatencyMs: 0,
          totalCost: 0,
        },
        loadedAt: new Date().toISOString(),
      };

      this.instances.set(agentId, instance);

      if (context) {
        instance.status = 'initializing';
        await runtime.initialize(context);
        instance.status = 'idle';
      }

      this.emit('agent:loaded', { agentId, instance });

      this.logger.info('AgentRegistry: Agent loaded', { agentId });
      return instance;
    } catch (error) {
      this.logger.error('AgentRegistry: Failed to load agent', { agentId, error: String(error) });
      this.emit('agent:error', { agentId, error: error as Error });
      return null;
    }
  }

  private async createAgentRuntime(definition: AgentDefinition): Promise<IAgentRuntime> {
    const metadata: AgentMetadata = {
      id: definition.id,
      name: definition.name,
      version: definition.version,
      capabilities: definition.capabilities.map((c) => ({
        name: c.name,
        version: c.version,
        description: c.description,
      })),
      inputSchema: definition.capabilities[0]?.inputSchema,
      outputSchema: definition.capabilities[0]?.outputSchema,
      dependencies: definition.dependencies.map((d) => d.agentId),
    };

    const runtime = new DynamicAgentRuntime(metadata, definition, this.logger, this.eventBus);
    return runtime;
  }

  async unloadAgent(agentId: string): Promise<boolean> {
    const instance = this.instances.get(agentId);
    if (!instance) {
      return false;
    }

    if (instance.runtime && typeof instance.runtime.dispose === 'function') {
      await instance.runtime.dispose();
    }

    this.instances.delete(agentId);
    this.emit('agent:unloaded', { agentId });

    this.logger.info('AgentRegistry: Agent unloaded', { agentId });
    return true;
  }

  async reloadAgent(agentId: string, context?: ExecutionContext): Promise<AgentInstance | null> {
    const definition = this.definitions.get(agentId);
    if (!definition) {
      return null;
    }

    await this.unloadAgent(agentId);
    const instance = await this.loadAgent(agentId, context);

    if (instance) {
      instance.lastReloadAt = new Date().toISOString();
      this.emit('agent:reloaded', { agentId, instance });
    }

    return instance;
  }

  getDefinition(agentId: string): AgentDefinition | undefined {
    return this.definitions.get(agentId);
  }

  getInstance(agentId: string): AgentInstance | undefined {
    return this.instances.get(agentId);
  }

  get(agentId: string): IAgentRuntime | undefined {
    const instance = this.instances.get(agentId);
    if (instance) return instance.runtime;
    return this.legacyAgents.get(agentId);
  }

  list(): IAgentRuntime[] {
    const result = Array.from(this.instances.values()).map((i) => i.runtime);
    for (const agent of this.legacyAgents.values()) {
      result.push(agent);
    }
    return result;
  }

  register(agent: IAgentRuntime): void {
    this.legacyAgents.set(agent.metadata.id, agent);
    // Populate capabilityIndex so findByCapability() works for legacy agents
    for (const cap of agent.metadata.capabilities) {
      if (!this.capabilityIndex.has(cap.name)) {
        this.capabilityIndex.set(cap.name, new Set());
      }
      this.capabilityIndex.get(cap.name)!.add(`legacy:${agent.metadata.id}`);
    }
  }

  unregister(agentId: string): boolean {
    if (this.instances.has(agentId)) {
      return this.unloadAgent(agentId) as unknown as boolean;
    }
    return this.legacyAgents.delete(agentId);
  }

  listDefinitions(): AgentDefinition[] {
    return Array.from(this.definitions.values());
  }

  listInstances(): AgentInstance[] {
    return Array.from(this.instances.values());
  }

  findByCapability(capability: string): IAgentRuntime[] {
    const agentIds = this.capabilityIndex.get(capability);
    const result: IAgentRuntime[] = [];

    if (agentIds) {
      for (const id of agentIds) {
        if (id.startsWith('legacy:')) {
          const legacyId = id.slice('legacy:'.length);
          const agent = this.legacyAgents.get(legacyId);
          if (agent) result.push(agent);
        } else {
          const instance = this.instances.get(id);
          if (instance) result.push(instance.runtime);
        }
      }
    }

    return result;
  }

  findByWorkflowTag(tag: string): AgentDefinition[] {
    const agentIds = this.workflowTagIndex.get(tag);
    if (!agentIds) return [];

    const result: AgentDefinition[] = [];
    for (const id of agentIds) {
      const def = this.definitions.get(id);
      if (def) result.push(def);
    }
    return result;
  }

  findByDivision(division: string): AgentDefinition[] {
    const agentIds = this.divisionIndex.get(division);
    if (!agentIds) return [];

    const result: AgentDefinition[] = [];
    for (const id of agentIds) {
      const def = this.definitions.get(id);
      if (def) result.push(def);
    }
    return result;
  }

  findByModelProvider(provider: string): AgentDefinition[] {
    const result: AgentDefinition[] = [];
    for (const def of this.definitions.values()) {
      if (def.modelPreferences.some((p) => p.provider === provider)) {
        result.push(def);
      }
    }
    return result;
  }

  findByToolCategory(category: string): AgentDefinition[] {
    const result: AgentDefinition[] = [];
    for (const def of this.definitions.values()) {
      if (def.toolPermissions.some((p) => p.category === category && p.allowed)) {
        result.push(def);
      }
    }
    return result;
  }

  getCapabilityGraph(): CapabilityGraph | null {
    return this.capabilityGraph;
  }

  getCapabilityRouter(): CapabilityRouter | null {
    return this.capabilityRouter;
  }

  private buildCapabilityGraph(): void {
    const agents = Array.from(this.definitions.values());
    const builder = new CapabilityGraphBuilder();
    this.capabilityGraph = builder.buildFromAgents(agents);
    this.capabilityRouter = new CapabilityRouter(this.capabilityGraph);

    this.logger.debug('AgentRegistry: Capability graph rebuilt', {
      nodes: this.capabilityGraph.nodes.size,
      edges: this.capabilityGraph.edges.length,
    });
  }

  routeCapabilities(
    capabilities: string[],
    constraints?: {
      maxCost?: number;
      maxLatencyMs?: number;
      preferredProviders?: string[];
      requiredTools?: string[];
    }
  ): {
    executionPlan: Array<{ capability: string; agents: string[]; parallel: boolean }>;
    estimatedCost: number;
    estimatedLatencyMs: number;
    warnings: string[];
  } | null {
    if (!this.capabilityRouter) {
      return null;
    }
    return this.capabilityRouter.route(capabilities, constraints);
  }

  async executeWorkflow(
    workflowId: string,
    capabilities: string[],
    input: unknown,
    context: ExecutionContext,
    constraints?: {
      maxCost?: number;
      maxLatencyMs?: number;
      preferredProviders?: string[];
      requiredTools?: string[];
    }
  ): Promise<{
    success: boolean;
    results: Record<string, any>;
    totalCost: number;
    totalLatencyMs: number;
    warnings: string[];
  }> {
    const routing = this.routeCapabilities(capabilities, constraints);
    if (!routing) {
      return {
        success: false,
        results: {},
        totalCost: 0,
        totalLatencyMs: 0,
        warnings: ['Capability routing not available'],
      };
    }

    const results: Record<string, any> = {};
    let totalCost = 0;
    let totalLatency = 0;
    const warnings = [...routing.warnings];

    for (const step of routing.executionPlan) {
      if (step.parallel) {
        const parallelResults = await Promise.all(
          step.agents.map(async (agentId) => {
            const instance = this.instances.get(agentId);
            if (!instance) {
              await this.loadAgent(agentId, context);
            }
            const loaded = this.instances.get(agentId);
            if (!loaded) {
              return { agentId, error: 'Failed to load agent' };
            }

            const startTime = Date.now();
            try {
              const result = await loaded.runtime.execute(context, input);
              const latency = Date.now() - startTime;
              totalCost += loaded.definition.costProfile.estimatedCostPerExecution;
              totalLatency += latency;

              this.updateMetrics(agentId, result.success, latency, loaded.definition.costProfile.estimatedCostPerExecution);

              return { agentId, result, latency };
            } catch (error) {
              return { agentId, error: String(error) };
            }
          })
        );

        for (const r of parallelResults) {
          if ('result' in r && r.result) {
            results[r.agentId] = r.result;
          } else if ('error' in r) {
            warnings.push(`${r.agentId}: ${r.error}`);
          }
        }
      } else {
        for (const agentId of step.agents) {
          const instance = this.instances.get(agentId);
          if (!instance) {
            await this.loadAgent(agentId, context);
          }
          const loaded = this.instances.get(agentId);
          if (!loaded) {
            warnings.push(`${agentId}: Failed to load agent`);
            continue;
          }

          const startTime = Date.now();
          try {
            const result = await loaded.runtime.execute(context, input);
            const latency = Date.now() - startTime;
            totalCost += loaded.definition.costProfile.estimatedCostPerExecution;
            totalLatency += latency;

            this.updateMetrics(agentId, result.success, latency, loaded.definition.costProfile.estimatedCostPerExecution);

            if (result.success) {
              results[agentId] = result.output;
            } else {
              warnings.push(`${agentId}: ${result.error}`);
            }
          } catch (error) {
            warnings.push(`${agentId}: ${String(error)}`);
          }
        }
      }
    }

    this.emit('workflow:executed', { workflowId, agents: Array.from(this.instances.keys()), result: results });

    return {
      success: warnings.length === 0,
      results,
      totalCost,
      totalLatencyMs: totalLatency,
      warnings,
    };
  }

  private updateMetrics(agentId: string, success: boolean, latencyMs: number, cost: number): void {
    const instance = this.instances.get(agentId);
    if (!instance) return;

    instance.metrics.totalExecutions++;
    if (success) {
      instance.metrics.successfulExecutions++;
    } else {
      instance.metrics.failedExecutions++;
    }

    const n = instance.metrics.totalExecutions;
    instance.metrics.averageLatencyMs = (instance.metrics.averageLatencyMs * (n - 1) + latencyMs) / n;
    instance.metrics.totalCost += cost;
    instance.metrics.lastExecutionAt = new Date().toISOString();

    this.emit('cost:updated', { agentId, cost, totalCost: instance.metrics.totalCost });
  }

  private startHotReload(): void {
    this.logger.info('AgentRegistry: Starting file watchers for hot reload');

    for (const discoveryPath of this.config.discoveryPaths) {
      this.watchDirectory(discoveryPath);
    }
  }

  private watchDirectory(dirPath: string): void {
    if (this.fileWatchers.has(dirPath)) {
      return;
    }

    try {
      const fsWatcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        if (filename.endsWith('.ts') || filename.endsWith('.json') || filename.endsWith('.js')) {
          this.logger.debug('AgentRegistry: File change detected, triggering hot reload', { eventType, filename });
          setImmediate(() => this.discoverAgents());
        }
      });

      this.fileWatchers.set(dirPath, fsWatcher);
      this.logger.info('AgentRegistry: Watching directory for changes', { dirPath });
    } catch (error) {
      this.logger.warn('AgentRegistry: Failed to watch directory', { dirPath, error: String(error) });
    }
  }

  private stopFileWatchers(): void {
    for (const [path, watcher] of this.fileWatchers) {
      watcher.close();
      this.logger.debug('AgentRegistry: Stopped watching', { path });
    }
    this.fileWatchers.clear();
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      if (this.isShuttingDown) return;

      for (const [agentId, instance] of this.instances) {
        try {
          const health = await instance.runtime.health();
          if (health.status !== instance.health) {
            const oldHealth = instance.health;
            instance.health = health.status;
            this.emit('agent:health-changed', { agentId, health: health.status });
            this.logger.debug('AgentRegistry: Health changed', { agentId, oldHealth, newHealth: health.status });
          }
        } catch (error) {
          instance.health = 'unavailable';
          this.emit('agent:health-changed', { agentId, health: 'unavailable' });
        }
      }
    }, 30000);
  }

  getStats(): {
    totalDefinitions: number;
    loadedInstances: number;
    capabilities: number;
    workflowTags: number;
    divisions: number;
    capabilityGraphNodes: number;
    capabilityGraphEdges: number;
    totalExecutions: number;
    totalCost: number;
  } {
    let totalExecutions = 0;
    let totalCost = 0;
    for (const instance of this.instances.values()) {
      totalExecutions += instance.metrics.totalExecutions;
      totalCost += instance.metrics.totalCost;
    }

    return {
      totalDefinitions: this.definitions.size,
      loadedInstances: this.instances.size,
      capabilities: this.capabilityIndex.size,
      workflowTags: this.workflowTagIndex.size,
      divisions: this.divisionIndex.size,
      capabilityGraphNodes: this.capabilityGraph?.nodes.size || 0,
      capabilityGraphEdges: this.capabilityGraph?.edges.length || 0,
      totalExecutions,
      totalCost,
    };
  }
}

class DynamicAgentRuntime extends BaseAgent {
  private definition: AgentDefinition;
  private logger: ILogger;
  private eventBus: EnhancedEventBus;
  private toolPermissions: Map<string, ToolPermission> = new Map();

  constructor(
    metadata: AgentMetadata,
    definition: AgentDefinition,
    logger: ILogger,
    eventBus: EnhancedEventBus
  ) {
    super(metadata);
    this.definition = definition;
    this.logger = logger;
    this.eventBus = eventBus;

    for (const perm of definition.toolPermissions) {
      this.toolPermissions.set(perm.toolId, perm);
    }
  }

  protected async onInitialize(context: ExecutionContext): Promise<void> {
    this.logger.info('DynamicAgentRuntime: Initializing', { agentId: this.metadata.id, workflowId: context.workflowId });

    const instance = this.getInstanceFromContext(context);
    if (instance) {
      instance.status = 'initializing';
    }

    await this.initializeMemoryScopes(context);
    await this.initializeVoiceProfile(context);
    await this.initializeCharacterProfile(context);
    await this.setupProviderRouting(context);

    this.logger.info('DynamicAgentRuntime: Initialized', { agentId: this.metadata.id });
  }

  private getInstanceFromContext(context: ExecutionContext): AgentInstance | null {
    return (context as any).agentInstance || null;
  }

  private async initializeMemoryScopes(context: ExecutionContext): Promise<void> {
    const profile = this.definition.memoryProfile;
    this.logger.debug('DynamicAgentRuntime: Initializing memory scopes', {
      agentId: this.metadata.id,
      scopes: profile.scopes,
    });
  }

  private async initializeVoiceProfile(context: ExecutionContext): Promise<void> {
    const profile = this.definition.voiceProfile;
    if (profile.enabled) {
      this.logger.debug('DynamicAgentRuntime: Voice profile enabled', {
        agentId: this.metadata.id,
        provider: profile.provider,
      });
    }
  }

  private async initializeCharacterProfile(context: ExecutionContext): Promise<void> {
    const profile = this.definition.characterProfile;
    this.logger.debug('DynamicAgentRuntime: Character profile loaded', {
      agentId: this.metadata.id,
      displayName: profile.displayName,
      emoji: profile.emoji,
    });
  }

  private async setupProviderRouting(context: ExecutionContext): Promise<void> {
    this.logger.debug('DynamicAgentRuntime: Provider routing configured', {
      agentId: this.metadata.id,
      rules: this.definition.providerRoutingRules.length,
    });
  }

  protected async onExecute(context: ExecutionContext, input: unknown): Promise<any> {
    this.logger.info('DynamicAgentRuntime: Executing', { agentId: this.metadata.id, workflowId: context.workflowId });

    const instance = this.getInstanceFromContext(context);
    if (instance) {
      instance.status = 'running';
      instance.currentTaskId = context.taskId;
      instance.progress = 0;
    }

    const promptTemplate = this.selectPromptTemplate(input);
    const systemPrompt = this.buildSystemPrompt(promptTemplate);
    const userPrompt = this.buildUserPrompt(promptTemplate, input);

    try {
      const result = await this.executeWithModel(systemPrompt, userPrompt, input);

      if (instance) {
        instance.status = 'completed';
        instance.progress = 100;
      }

      return {
        success: true,
        output: result,
        metadata: {
          agentId: this.metadata.id,
          timestamp: new Date().toISOString(),
          promptTemplate: promptTemplate?.id,
        },
      };
    } catch (error) {
      if (instance) {
        instance.status = 'failed';
        instance.message = String(error);
      }

      return {
        success: false,
        error: String(error),
        metadata: {
          agentId: this.metadata.id,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private selectPromptTemplate(input: unknown): AgentPromptTemplate | undefined {
    const inputObj = input as Record<string, unknown>;
    const action = inputObj?.action as string;

    for (const template of this.definition.promptTemplates) {
      if (template.tags.includes(action || 'default')) {
        return template;
      }
    }

    return this.definition.promptTemplates[0];
  }

  private buildSystemPrompt(template?: AgentPromptTemplate): string {
    const char = this.definition.characterProfile;
    const basePrompt = template?.systemPrompt || `You are ${char.displayName}, ${char.vibe}. ${char.communicationStyle}`;

    const capabilityList = this.definition.capabilities.map((c) => `- ${c.name}: ${c.description}`).join('\n');
    const toolList = this.definition.toolPermissions.filter((p) => p.allowed).map((p) => `- ${p.toolId} (${p.category})`).join('\n');

    return `${basePrompt}

## Your Capabilities
${capabilityList}

## Available Tools
${toolList}

## Personality
- Traits: ${char.personalityTraits.join(', ')}
- Emotional Range: ${char.emotionalRange.join(', ')}
- Communication: ${char.communicationStyle}

## Guidelines
${this.definition.capabilities.flatMap((c) => c.description ? [c.description] : []).join('\n')}`;
  }

  private buildUserPrompt(template?: AgentPromptTemplate, input?: unknown): string {
    if (template?.userPromptTemplate) {
      let prompt = template.userPromptTemplate;
      const inputObj = input as Record<string, unknown>;
      for (const [key, value] of Object.entries(inputObj || {})) {
        prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }
      return prompt;
    }

    return JSON.stringify(input, null, 2);
  }

  private async executeWithModel(systemPrompt: string, userPrompt: string, input: unknown): Promise<unknown> {
    this.logger.debug('DynamicAgentRuntime: Would execute with model', {
      agentId: this.metadata.id,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
    });

    return {
      agentId: this.metadata.id,
      capabilities: this.definition.capabilities.map((c) => c.name),
      processed: true,
      input,
    };
  }

  protected async onPause(context: ExecutionContext): Promise<void> {
    this.logger.info('DynamicAgentRuntime: Paused', { agentId: this.metadata.id });
    const instance = this.getInstanceFromContext(context);
    if (instance) {
      instance.status = 'paused';
    }
  }

  protected async onResume(context: ExecutionContext): Promise<void> {
    this.logger.info('DynamicAgentRuntime: Resumed', { agentId: this.metadata.id });
    const instance = this.getInstanceFromContext(context);
    if (instance) {
      instance.status = 'running';
    }
  }

  protected async onCancel(context: ExecutionContext): Promise<void> {
    this.logger.info('DynamicAgentRuntime: Cancelled', { agentId: this.metadata.id });
    const instance = this.getInstanceFromContext(context);
    if (instance) {
      instance.status = 'failed';
      instance.message = 'Cancelled';
    }
  }

  protected async onDispose(): Promise<void> {
    this.logger.info('DynamicAgentRuntime: Disposed', { agentId: this.metadata.id });
  }

  canUseTool(toolId: string): boolean {
    const perm = this.toolPermissions.get(toolId);
    return perm?.allowed ?? false;
  }

  getToolPermissions(): ToolPermission[] {
    return Array.from(this.toolPermissions.values());
  }

  getDefinition(): AgentDefinition {
    return this.definition;
  }
}