import { IMemoryEngine } from './interfaces/IMemoryEngine';
import { MemoryItem, MemoryQuery, MemorySearchResult, MemoryType, MemoryStoreOptions, MemoryUpdateOptions, MemoryArchiveOptions, MemoryMergeOptions, MemoryStats, MemoryHealth, MemoryEventType, ProviderHealth } from './types';
import { IEventBus } from './kernel-bridge';
import { IMemoryProvider } from './interfaces/IProvider';
import { ProviderRegistry } from './providers/ProviderRegistry';
import { ShortTermMemoryModule } from './modules/ShortTermMemory';
import { LongTermMemoryModule } from './modules/LongTermMemory';
import { SemanticMemoryModule } from './modules/SemanticMemory';
import { EpisodicMemoryModule } from './modules/EpisodicMemory';
import { ProceduralMemoryModule } from './modules/ProceduralMemory';
import { WorkingMemoryModule } from './modules/WorkingMemory';
import { BusinessMemoryModule } from './modules/BusinessMemory';
import { UserMemoryModule } from './modules/UserMemory';
import { ProjectMemoryModule } from './modules/ProjectMemory';
import { WorkflowMemoryModule } from './modules/WorkflowMemory';
import { AgentMemoryModule } from './modules/AgentMemory';
import { KnowledgeMemoryModule } from './modules/KnowledgeMemory';
import { ConversationMemoryModule } from './modules/ConversationMemory';
import { DocumentMemoryModule } from './modules/DocumentMemory';
import { DecisionMemoryModule } from './modules/DecisionMemory';
import { TaskMemoryModule } from './modules/TaskMemory';
import { RelationshipMemoryModule } from './modules/RelationshipMemory';
import { StorePipeline, ValidateStep, PersistStep } from './lifecycle/store';
import { RetrievePipeline, SelectProvidersStep, SearchStep, FilterStep } from './lifecycle/retrieve';
import { UpdatePipeline, ValidateUpdateStep, PersistUpdateStep } from './lifecycle/update';
import { DeletePipeline, RetrieveForDeleteStep, ArchiveBeforeDeleteStep, DeleteFromProviderStep } from './lifecycle/delete';
import { ArchivePipeline, RetrieveForArchiveStep, MoveToArchiveStorageStep } from './lifecycle/archive';
import { MergePipeline, RetrieveForMergeStep, DetectConflictsStep, ResolveConflictsStep, CreateMergedItemStep, PersistMergedItemStep } from './lifecycle/merge';
import { SummarizePipeline, RetrieveItemsStep, GenerateSummaryStep, SummarizeOptions } from './lifecycle/summarize';
import { RelatePipeline, RetrieveSourceTargetStep, ValidateRelationshipStep, CreateRelationshipStep, UpdateSourceItemStep, UpdateTargetItemStep } from './lifecycle/relate';
import { MemoryEventBus } from './events/MemoryEventBus';
import { MemorySecurityManager } from './security/MemorySecurityManager';
import { generateId, sanitizeForStorage, calculateImportance, calculateConfidence, extractTags } from './shared/utils';

export interface MemoryEngineConfig {
  id?: string;
  defaultProvider?: string;
  enableSecurity?: boolean;
  enableEvents?: boolean;
  maxHistorySize?: number;
}

export class MemoryEngine implements IMemoryEngine {
  readonly id: string;
  readonly eventBus: IEventBus;
  private config: MemoryEngineConfig;
  private providers: ProviderRegistry;
  private memoryEventBus: MemoryEventBus | null = null;
  private securityManager: MemorySecurityManager | null = null;
  private initialized = false;

  // Memory modules
  private shortTermMemory: ShortTermMemoryModule;
  private longTermMemory: LongTermMemoryModule;
  private semanticMemory: SemanticMemoryModule;
  private episodicMemory: EpisodicMemoryModule;
  private proceduralMemory: ProceduralMemoryModule;
  private workingMemory: WorkingMemoryModule;
  private businessMemory: BusinessMemoryModule;
  private userMemory: UserMemoryModule;
  private projectMemory: ProjectMemoryModule;
  private workflowMemory: WorkflowMemoryModule;
  private agentMemory: AgentMemoryModule;
  private knowledgeMemory: KnowledgeMemoryModule;
  private conversationMemory: ConversationMemoryModule;
  private documentMemory: DocumentMemoryModule;
  private decisionMemory: DecisionMemoryModule;
  private taskMemory: TaskMemoryModule;
  private relationshipMemory: RelationshipMemoryModule;

  // Lifecycle pipelines
  private storePipeline: StorePipeline;
  private retrievePipeline: RetrievePipeline;
  private updatePipeline: UpdatePipeline;
  private deletePipeline: DeletePipeline;
  private archivePipeline: ArchivePipeline;
  private mergePipeline: MergePipeline;
  private summarizePipeline: SummarizePipeline;
  private relatePipeline: RelatePipeline;

  constructor(eventBus: IEventBus, config: MemoryEngineConfig = {}) {
    this.id = config.id || generateId('engine');
    this.eventBus = eventBus;
    this.config = {
      enableSecurity: true,
      enableEvents: true,
      maxHistorySize: 10000,
      ...config,
    };

    this.providers = new ProviderRegistry();

    // Initialize memory modules
    this.shortTermMemory = new ShortTermMemoryModule(this);
    this.longTermMemory = new LongTermMemoryModule(this);
    this.semanticMemory = new SemanticMemoryModule(this);
    this.episodicMemory = new EpisodicMemoryModule(this);
    this.proceduralMemory = new ProceduralMemoryModule(this);
    this.workingMemory = new WorkingMemoryModule(this);
    this.businessMemory = new BusinessMemoryModule(this);
    this.userMemory = new UserMemoryModule(this);
    this.projectMemory = new ProjectMemoryModule(this);
    this.workflowMemory = new WorkflowMemoryModule(this);
    this.agentMemory = new AgentMemoryModule(this);
    this.knowledgeMemory = new KnowledgeMemoryModule(this);
    this.conversationMemory = new ConversationMemoryModule(this);
    this.documentMemory = new DocumentMemoryModule(this);
    this.decisionMemory = new DecisionMemoryModule(this);
    this.taskMemory = new TaskMemoryModule(this);
    this.relationshipMemory = new RelationshipMemoryModule(this);

    // Initialize lifecycle pipelines
    this.storePipeline = new StorePipeline(this.providers);
    this.storePipeline.addStep(new ValidateStep());
    this.storePipeline.addStep(new PersistStep());

    this.retrievePipeline = new RetrievePipeline(this.providers);
    this.retrievePipeline.addStep(new SelectProvidersStep(this.providers));
    this.retrievePipeline.addStep(new SearchStep());
    this.retrievePipeline.addStep(new FilterStep());

    this.updatePipeline = new UpdatePipeline();
    this.updatePipeline.addStep(new ValidateUpdateStep());
    this.updatePipeline.addStep(new PersistUpdateStep());

    this.deletePipeline = new DeletePipeline();
    this.deletePipeline.addStep(new RetrieveForDeleteStep());
    this.deletePipeline.addStep(new ArchiveBeforeDeleteStep());
    this.deletePipeline.addStep(new DeleteFromProviderStep());

    this.archivePipeline = new ArchivePipeline();
    this.archivePipeline.addStep(new RetrieveForArchiveStep());
    this.archivePipeline.addStep(new MoveToArchiveStorageStep());

    this.mergePipeline = new MergePipeline();
    this.mergePipeline.addStep(new RetrieveForMergeStep());
    this.mergePipeline.addStep(new DetectConflictsStep());
    this.mergePipeline.addStep(new ResolveConflictsStep());
    this.mergePipeline.addStep(new CreateMergedItemStep());
    this.mergePipeline.addStep(new PersistMergedItemStep());

    this.summarizePipeline = new SummarizePipeline();
    this.summarizePipeline.addStep(new RetrieveItemsStep());
    this.summarizePipeline.addStep(new GenerateSummaryStep());

    this.relatePipeline = new RelatePipeline();
    this.relatePipeline.addStep(new RetrieveSourceTargetStep());
    this.relatePipeline.addStep(new ValidateRelationshipStep());
    this.relatePipeline.addStep(new CreateRelationshipStep());
    this.relatePipeline.addStep(new UpdateSourceItemStep());
    this.relatePipeline.addStep(new UpdateTargetItemStep());
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize security manager
    if (this.config.enableSecurity) {
      this.securityManager = new MemorySecurityManager();
    }

    // Initialize memory event bus
    if (this.config.enableEvents) {
      this.memoryEventBus = new MemoryEventBus(this.eventBus);
    }

    // Initialize all providers
    for (const provider of this.providers.list()) {
      await provider.initialize();
    }

    // Initialize all memory modules
    await Promise.all([
      this.shortTermMemory.initialize(),
      this.longTermMemory.initialize(),
      this.semanticMemory.initialize(),
      this.episodicMemory.initialize(),
      this.proceduralMemory.initialize(),
      this.workingMemory.initialize(),
      this.businessMemory.initialize(),
      this.userMemory.initialize(),
      this.projectMemory.initialize(),
      this.workflowMemory.initialize(),
      this.agentMemory.initialize(),
      this.knowledgeMemory.initialize(),
      this.conversationMemory.initialize(),
      this.documentMemory.initialize(),
      this.decisionMemory.initialize(),
      this.taskMemory.initialize(),
      this.relationshipMemory.initialize(),
    ]);

    this.initialized = true;
    this.emitEvent('system.initialized', { engineId: this.id });
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    // Shutdown all providers
    for (const provider of this.providers.list()) {
      await provider.shutdown();
    }

    // Shutdown all memory modules
    await Promise.all([
      this.shortTermMemory.shutdown(),
      this.longTermMemory.shutdown(),
      this.semanticMemory.shutdown(),
      this.episodicMemory.shutdown(),
      this.proceduralMemory.shutdown(),
      this.workingMemory.shutdown(),
      this.businessMemory.shutdown(),
      this.userMemory.shutdown(),
      this.projectMemory.shutdown(),
      this.workflowMemory.shutdown(),
      this.agentMemory.shutdown(),
      this.knowledgeMemory.shutdown(),
      this.conversationMemory.shutdown(),
      this.documentMemory.shutdown(),
      this.decisionMemory.shutdown(),
      this.taskMemory.shutdown(),
      this.relationshipMemory.shutdown(),
    ]);

    this.initialized = false;
    this.emitEvent('system.shutdown', { engineId: this.id });
  }

  async health(): Promise<MemoryHealth> {
    const providerHealths: Record<string, ProviderHealth> = {};

    for (const provider of this.providers.list()) {
      providerHealths[provider.metadata.id] = await provider.health();
    }

    const healthyCount = Object.values(providerHealths).filter(h => h.status === 'healthy').length;
    const totalCount = Object.keys(providerHealths).length;

    let status: MemoryHealth['status'] = 'healthy';
    if (totalCount > 0 && healthyCount === 0) status = 'unhealthy';
    else if (healthyCount < totalCount) status = 'degraded';

    return {
      status,
      providers: providerHealths,
      lastCheck: new Date().toISOString(),
      metrics: {
        latencyMs: Object.values(providerHealths).reduce((sum, h) => sum + h.latencyMs, 0) / totalCount || 0,
        errorRate: 0, // Would calculate from provider stats
        throughput: 0, // Would calculate from provider stats
      },
    };
  }

  async store(item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>, options?: MemoryStoreOptions): Promise<MemoryItem> {
    const now = new Date().toISOString();
    const memoryItem: MemoryItem = {
      ...item,
      id: generateId('mem'),
      createdAt: now,
      updatedAt: now,
      rawContent: sanitizeForStorage(item.rawContent) as string,
      summary: item.summary || item.rawContent.slice(0, 200),
      importance: item.importance ?? calculateImportance(item.rawContent, item.metadata),
      confidence: item.confidence ?? calculateConfidence(item.source, item.metadata),
      tags: [...new Set([...(item.tags || []), ...extractTags(item.rawContent, item.tags || [])])],
    };

    const result = await this.storePipeline.execute({
      item: memoryItem,
      options: options || {},
      provider: this.getBestProvider(memoryItem.type),
      startTime: Date.now(),
    });

    if (this.memoryEventBus) {
      this.memoryEventBus.publishMemoryEvent({
        id: generateId('evt'),
        version: '1.0',
        timestamp: new Date().toISOString(),
        trace_id: 'system',
        span_id: 'system',
        level: 'INFO',
        event_type: 'memory.created',
        payload: { memoryId: result.item.id, memoryType: result.item.type, owner: result.item.owner, memory: result.item, options },
      });
    }

    return result.item;
  }

  async retrieve(id: string): Promise<MemoryItem | null> {
    const provider = this.getProviderForItem(id);
    if (!provider) return null;

    const item = await provider.retrieve(id);

    if (item && this.securityManager) {
      // Would check security context here
    }

    if (this.memoryEventBus && item) {
      this.memoryEventBus.publishMemoryEvent({
        id: generateId('evt'),
        version: '1.0',
        timestamp: new Date().toISOString(),
        trace_id: 'system',
        span_id: 'system',
        level: 'INFO',
        event_type: 'memory.retrieved',
        payload: { memoryId: id, retrievalTimeMs: 0 },
      });
    }

    return item;
  }

  async update(id: string, updates: Partial<MemoryItem>, options?: MemoryUpdateOptions): Promise<MemoryItem> {
    const provider = this.getProviderForItem(id);
    if (!provider) throw new Error(`No provider found for item: ${id}`);

    const result = await this.updatePipeline.execute({
      id,
      updates,
      options: options || {},
      provider,
      originalItem: null,
      startTime: Date.now(),
    });

    if (this.memoryEventBus) {
      this.memoryEventBus.publishMemoryEvent({
        id: generateId('evt'),
        version: '1.0',
        timestamp: new Date().toISOString(),
        trace_id: 'system',
        span_id: 'system',
        level: 'INFO',
        event_type: 'memory.updated',
        payload: { memoryId: id, changes: updates },
      });
    }

    return result.item;
  }

  async delete(id: string, permanent: boolean = false): Promise<boolean> {
    const provider = this.getProviderForItem(id);
    if (!provider) return false;

    const result = await this.deletePipeline.execute({
      id,
      permanent,
      provider,
      item: null,
      startTime: Date.now(),
    });

    if (this.memoryEventBus) {
      this.memoryEventBus.publishMemoryEvent({
        id: generateId('evt'),
        version: '1.0',
        timestamp: new Date().toISOString(),
        trace_id: 'system',
        span_id: 'system',
        level: 'INFO',
        event_type: permanent ? 'memory.deleted' : 'memory.archived',
        payload: { memoryId: id, permanent },
      });
    }

    return result.success;
  }

  async archive(id: string, options: MemoryArchiveOptions): Promise<void> {
    const provider = this.getProviderForItem(id);
    if (!provider) throw new Error(`No provider found for item: ${id}`);

    await this.archivePipeline.execute({
      id,
      options,
      provider,
      item: null,
      archiveId: generateId('archive'),
      startTime: Date.now(),
    });

    if (this.memoryEventBus) {
      this.memoryEventBus.publishMemoryEvent({
        id: generateId('evt'),
        version: '1.0',
        timestamp: new Date().toISOString(),
        trace_id: 'system',
        span_id: 'system',
        level: 'INFO',
        event_type: 'memory.archived',
        payload: { memoryId: id, archiveLocation: options.archiveLocation, reason: options.reason },
      });
    }
  }

  async merge(sourceId: string, targetId: string, options: MemoryMergeOptions): Promise<MemoryItem> {
    const sourceProvider = this.getProviderForItem(sourceId);
    const targetProvider = this.getProviderForItem(targetId);

    if (!sourceProvider || !targetProvider) {
      throw new Error('One or both items not found');
    }

    if (sourceProvider !== targetProvider) {
      throw new Error('Cannot merge items from different providers');
    }

    const result = await this.mergePipeline.execute({
      sourceId,
      targetId,
      options,
      provider: sourceProvider,
      sourceItem: null,
      targetItem: null,
      mergedItem: null,
      startTime: Date.now(),
    });

    if (this.memoryEventBus) {
      this.memoryEventBus.publishMemoryEvent({
        id: generateId('evt'),
        version: '1.0',
        timestamp: new Date().toISOString(),
        trace_id: 'system',
        span_id: 'system',
        level: 'INFO',
        event_type: 'memory.merged',
        payload: { sourceMemoryId: sourceId, targetMemoryId: targetId, strategy: options.strategy, resultMemoryId: result.mergedItem.id },
      });
    }

    return result.mergedItem;
  }

  async forget(id: string, reason: string): Promise<boolean> {
    // Forget is a permanent delete with cleanup
    return this.delete(id, true);
  }

  async pin(id: string): Promise<void> {
    await this.update(id, { metadata: { pinned: true, pinnedAt: new Date().toISOString() } });
  }

  async unpin(id: string): Promise<void> {
    await this.update(id, { metadata: { pinned: false } });
  }

  async search(query: MemoryQuery): Promise<MemorySearchResult[]> {
    const context = {
      query,
      providers: this.providers.listByMemoryType(query.types?.[0] || 'knowledge'),
      options: {
        searchMode: 'hybrid' as const,
        maxResults: query.limit || 10,
        rerank: false,
        minScore: 0,
      },
      startTime: Date.now(),
      results: [] as MemorySearchResult[],
    };

    const result = await this.retrievePipeline.execute(context);

    if (this.memoryEventBus) {
      this.memoryEventBus.publishMemoryEvent({
        id: generateId('evt'),
        version: '1.0',
        timestamp: new Date().toISOString(),
        trace_id: 'system',
        span_id: 'system',
        level: 'INFO',
        event_type: 'search.performed',
        payload: { query, resultsCount: result.results.length, searchMode: 'hybrid', durationMs: result.durationMs, provider: result.providerId },
      });
    }

    return result.results;
  }

  async retrieveByQuery(query: MemoryQuery): Promise<MemorySearchResult[]> {
    // Similar to search but with more options
    return this.search(query);
  }

  async summarize(ids: string[]): Promise<string> {
    const provider = this.getBestProvider('knowledge');
    if (!provider) throw new Error('No provider available for summarization');

    const result = await this.summarizePipeline.execute({
      ids,
      provider,
      options: {},
      items: [],
      summary: '',
      startTime: Date.now(),
    });

    if (this.memoryEventBus) {
      this.memoryEventBus.publishMemoryEvent({
        id: generateId('evt'),
        version: '1.0',
        timestamp: new Date().toISOString(),
        trace_id: 'system',
        span_id: 'system',
        level: 'INFO',
        event_type: 'memory.summarized',
        payload: { memoryIds: ids, summary: result.summary, itemCount: result.itemCount },
      } as any);
    }

    return result.summary;
  }

  async relate(sourceId: string, targetId: string, relationshipType: string, properties?: Record<string, unknown>): Promise<void> {
    const sourceProvider = this.getProviderForItem(sourceId);
    const targetProvider = this.getProviderForItem(targetId);

    if (!sourceProvider || !targetProvider) {
      throw new Error('One or both items not found');
    }

    if (sourceProvider !== targetProvider) {
      throw new Error('Cannot relate items from different providers');
    }

    await this.relatePipeline.execute({
      sourceId,
      targetId,
      relationshipType,
      properties: properties || {},
      provider: sourceProvider,
      sourceItem: null,
      targetItem: null,
      relationship: null,
      startTime: Date.now(),
    });

    if (this.memoryEventBus) {
      this.memoryEventBus.publishMemoryEvent({
        id: generateId('evt'),
        version: '1.0',
        timestamp: new Date().toISOString(),
        trace_id: 'system',
        span_id: 'system',
        level: 'INFO',
        event_type: 'relationship.created',
        payload: { sourceEntityId: sourceId, targetEntityId: targetId, type: relationshipType, confidence: 0.9 },
      } as any);
    }
  }

  async getStats(): Promise<MemoryStats> {
    let totalItems = 0;
    const itemsByType: Record<MemoryType, number> = {} as Record<MemoryType, number>;
    let totalEmbeddings = 0;
    let totalEntities = 0;
    let totalRelationships = 0;
    let storageSizeBytes = 0;

    for (const provider of this.providers.list()) {
      const stats = await provider.getStats();
      totalItems += stats.totalItems;
      totalEmbeddings += stats.totalEmbeddings;
      totalEntities += stats.totalEntities;
      totalRelationships += stats.totalRelationships;
      storageSizeBytes += stats.storageSizeBytes;

      for (const [type, count] of Object.entries(stats.itemsByType)) {
        itemsByType[type as MemoryType] = (itemsByType[type as MemoryType] || 0) + count;
      }
    }

    return {
      totalItems,
      itemsByType,
      totalEmbeddings,
      totalEntities,
      totalRelationships,
      storageSizeBytes,
    };
  }

  getMemoryTypes(): MemoryType[] {
    const types = new Set<MemoryType>();
    for (const provider of this.providers.list()) {
      for (const type of provider.config.memoryTypes) {
        types.add(type);
      }
    }
    return Array.from(types);
  }

  registerProvider(provider: IMemoryProvider): void {
    this.providers.register(provider);
    if (this.memoryEventBus) {
      this.memoryEventBus.publishMemoryEvent({
        id: generateId('evt'),
        version: '1.0',
        timestamp: new Date().toISOString(),
        trace_id: 'system',
        span_id: 'system',
        level: 'INFO',
        event_type: 'provider.connected',
        payload: { providerId: provider.metadata.id, providerType: provider.config.type, capabilities: Object.keys(provider.config.capabilities) },
      });
    }
  }

  unregisterProvider(providerId: string): boolean {
    const provider = this.providers.get(providerId);
    const result = this.providers.unregister(providerId);
    if (result && this.memoryEventBus && provider) {
      this.memoryEventBus.publishMemoryEvent({
        id: generateId('evt'),
        version: '1.0',
        timestamp: new Date().toISOString(),
        trace_id: 'system',
        span_id: 'system',
        level: 'INFO',
        event_type: 'provider.disconnected',
        payload: { providerId, reason: 'Unregistered' },
      });
    }
    return result;
  }

  getProvider(providerId: string): IMemoryProvider | undefined {
    return this.providers.get(providerId);
  }

  listProviders(): IMemoryProvider[] {
    return this.providers.list();
  }

  // Memory module accessors
  getShortTermMemory(): ShortTermMemoryModule { return this.shortTermMemory; }
  getLongTermMemory(): LongTermMemoryModule { return this.longTermMemory; }
  getSemanticMemory(): SemanticMemoryModule { return this.semanticMemory; }
  getEpisodicMemory(): EpisodicMemoryModule { return this.episodicMemory; }
  getProceduralMemory(): ProceduralMemoryModule { return this.proceduralMemory; }
  getWorkingMemory(): WorkingMemoryModule { return this.workingMemory; }
  getBusinessMemory(): BusinessMemoryModule { return this.businessMemory; }
  getUserMemory(): UserMemoryModule { return this.userMemory; }
  getProjectMemory(): ProjectMemoryModule { return this.projectMemory; }
  getWorkflowMemory(): WorkflowMemoryModule { return this.workflowMemory; }
  getAgentMemory(): AgentMemoryModule { return this.agentMemory; }
  getKnowledgeMemory(): KnowledgeMemoryModule { return this.knowledgeMemory; }
  getConversationMemory(): ConversationMemoryModule { return this.conversationMemory; }
  getDocumentMemory(): DocumentMemoryModule { return this.documentMemory; }
  getDecisionMemory(): DecisionMemoryModule { return this.decisionMemory; }
  getTaskMemory(): TaskMemoryModule { return this.taskMemory; }
  getRelationshipMemory(): RelationshipMemoryModule { return this.relationshipMemory; }

  private getBestProvider(memoryType: MemoryType): IMemoryProvider {
    const providers = this.providers.listByMemoryType(memoryType);
    if (providers.length === 0) {
      throw new Error(`No provider available for memory type: ${memoryType}`);
    }
    // Return highest priority connected provider
    return providers
      .filter(p => p.metadata.status === 'connected')
      .sort((a, b) => b.config.priority - a.config.priority)[0] || providers[0];
  }

  private getProviderForItem(itemId: string): IMemoryProvider | undefined {
    // In a real implementation, this would track which provider owns which item
    // For now, return the first available provider
    return this.providers.list()[0];
  }

  private getMemoryType(moduleName: string): MemoryType {
    const typeMap: Record<string, MemoryType> = {
      shortTermMemory: 'short-term',
      longTermMemory: 'long-term',
      semanticMemory: 'semantic',
      episodicMemory: 'episodic',
      proceduralMemory: 'procedural',
      workingMemory: 'working',
      businessMemory: 'business',
      userMemory: 'user',
      projectMemory: 'project',
      workflowMemory: 'workflow',
      agentMemory: 'agent',
      knowledgeMemory: 'knowledge',
      conversationMemory: 'conversation',
      documentMemory: 'document',
      decisionMemory: 'decision',
      taskMemory: 'task',
      relationshipMemory: 'relationship',
    };
    return typeMap[moduleName] || 'knowledge';
  }

  private emitEvent(eventType: string, payload: unknown): void {
    if (this.memoryEventBus) {
      this.memoryEventBus.publishMemoryEvent({
        id: generateId('evt'),
        version: '1.0',
        timestamp: new Date().toISOString(),
        trace_id: 'system',
        span_id: 'system',
        level: 'INFO',
        event_type: eventType as any,
        payload: payload as any,
      });
    }
  }
}