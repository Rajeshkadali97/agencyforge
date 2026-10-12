import { ok, fail } from "../shared/result.js";
import type { Result } from "../shared/result.js";
import { MemoryEngineError as MemoryError } from "./errors.js";
import type { MemoryProvider } from "./interfaces/memory-provider.js";
import type {
  IMemoryEngine,
  IMemoryDiagnostics,
  MemoryEngineConfig,
  MemoryEventBus,
  MemoryEvent,
  MemoryEventType,
  ProviderDiagnostics,
} from "./interfaces/memory-engine.js";
import type {
  Memory,
  Entity,
  Relationship,
  Fact,
  SearchOptions,
  SearchResult,
  RetrievalOptions,
  SummarizeOptions,
  ArchiveOptions,
  HealthStatus,
  MemoryStoreOptions,
} from "./types.js";
import type {
  BusinessProfile,
  AgentProfile,
  ProjectProfile,
} from "./interfaces/memory-provider.js";
import { DefaultMemoryProviderRegistry } from "./interfaces/provider-registry.js";

export class MemoryEngineImpl implements IMemoryEngine {
  private _initialized = false;
  private _registry: DefaultMemoryProviderRegistry;
  private _eventBus: MemoryEventBus | null = null;
  private _operationCounts = new Map<string, number>();
  private _lastOperationTimes = new Map<string, Date>();

  public constructor() {
    this._registry = new DefaultMemoryProviderRegistry();
  }

  public get isInitialized(): boolean {
    return this._initialized;
  }

  public get defaultProvider(): MemoryProvider | null {
    return this._registry.defaultProvider;
  }

  public async initialize(config: MemoryEngineConfig): Promise<Result<void>> {
    if (this._initialized) {
      return fail(new MemoryError("Memory engine already initialized", "ALREADY_INITIALIZED"));
    }

    try {
      if (config.providers) {
        for (const provider of config.providers) {
          const regResult = this._registry.register(provider);
          if (!regResult.ok) {
            return fail(new MemoryError(`Failed to register provider: ${regResult.error.message}`, "PROVIDER_REGISTRATION_FAILED"));
          }
        }
      }

      if (config.eventBus) {
        this._eventBus = config.eventBus;
      }

      for (const provider of this._registry.list()) {
        const initResult = await provider.initialize({} as Record<string, unknown>);
        if (!initResult.ok) {
          return fail(new MemoryError(`Failed to initialize provider: ${initResult.error.message}`, "PROVIDER_INIT_FAILED"));
        }
      }

      this._initialized = true;
      return ok(undefined);
    } catch (error) {
      return fail(
        new MemoryError(
          "Failed to initialize memory engine",
          "INIT_FAILED",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  }

  public async shutdown(): Promise<Result<void>> {
    if (!this._initialized) {
      return fail(new MemoryError("Memory engine not initialized", "NOT_INITIALIZED"));
    }

    try {
      for (const provider of this._registry.list()) {
        await provider.shutdown();
      }

      this._registry = new DefaultMemoryProviderRegistry();
      this._eventBus = null;
      this._initialized = false;

      return ok(undefined);
    } catch (error) {
      return fail(
        new MemoryError(
          "Failed to shutdown memory engine",
          "SHUTDOWN_FAILED",
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  }

  public async health(): Promise<Result<Record<string, HealthStatus>>> {
    if (!this._initialized) {
      return fail(new MemoryError("Memory engine not initialized", "NOT_INITIALIZED"));
    }

    const healthResult = await this._registry.healthCheck();
    if (!healthResult.ok) {
      return fail(new MemoryError("Health check failed", "HEALTH_CHECK_FAILED"));
    }

    const statuses: Record<string, HealthStatus> = {};
    for (const [id, status] of Object.entries(healthResult.value)) {
      statuses[id] = {
        status: status.status as "available" | "degraded" | "unavailable",
        latencyMs: status.latencyMs,
      };
    }

    return ok(statuses);
  }

  public registerProvider(provider: MemoryProvider): Result<void> {
    return this._registry.register(provider);
  }

  public unregisterProvider(providerId: string): Result<void> {
    return this._registry.unregister(providerId);
  }

  public getProvider(providerId: string): MemoryProvider | undefined {
    return this._registry.get(providerId);
  }

  public listProviders(): readonly MemoryProvider[] {
    return this._registry.list();
  }

  public async store(options: MemoryStoreOptions): Promise<Result<Memory>> {
    const provider = this.requireDefaultProvider();
    this.trackOperation("store");

    const result = await provider.store(options);

    if (result.ok) {
      this.publishEvent("MemoryStored", { memory: result.value });
    }

    return result;
  }

  public async retrieve(options: RetrievalOptions): Promise<Result<Memory | null>> {
    const provider = this.requireDefaultProvider();
    this.trackOperation("retrieve");
    return provider.retrieve(options);
  }

  public async search(options: SearchOptions): Promise<Result<SearchResult[]>> {
    const provider = this.requireDefaultProvider();
    this.trackOperation("search");

    const result = await provider.search(options);

    if (result.ok) {
      this.publishEvent("SearchCompleted", {
        query: options.query,
        resultCount: result.value.length,
      });
    }

    return result;
  }

  public async summarize(options: SummarizeOptions): Promise<Result<string>> {
    const provider = this.requireDefaultProvider();
    this.trackOperation("summarize");
    return provider.summarize(options);
  }

  public async delete(memoryId: string): Promise<Result<void>> {
    const provider = this.requireDefaultProvider();
    this.trackOperation("delete");

    const result = await provider.delete(memoryId);

    if (result.ok) {
      this.publishEvent("MemoryDeleted", { memoryId });
    }

    return result;
  }

  public async archive(options: ArchiveOptions): Promise<Result<void>> {
    const provider = this.requireDefaultProvider();
    this.trackOperation("archive");

    const result = await provider.archive(options);

    if (result.ok) {
      this.publishEvent("MemoryArchived", {
        memoryIds: options.memoryIds,
        permanent: options.permanent,
      });
    }

    return result;
  }

  public async createEntity(entity: Omit<Entity, "id" | "metadata">): Promise<Result<Entity>> {
    const provider = this.requireDefaultProvider();
    this.trackOperation("createEntity");

    const result = await provider.createEntity(entity);

    if (result.ok) {
      this.publishEvent("EntityCreated", { entity: result.value });
    }

    return result;
  }

  public async createRelationship(relate: {
    readonly sourceId: string;
    readonly targetId: string;
    readonly relationshipType: string;
    readonly properties?: Record<string, unknown>;
    readonly bidirectional?: boolean;
  }): Promise<Result<Relationship>> {
    const provider = this.requireDefaultProvider();
    this.trackOperation("createRelationship");

    const result = await provider.createRelationship(relate);

    if (result.ok) {
      this.publishEvent("RelationshipCreated", { relationship: result.value });
    }

    return result;
  }

  public async getEntity(entityId: string): Promise<Result<Entity | null>> {
    const provider = this.requireDefaultProvider();
    return provider.getEntity(entityId);
  }

  public async getRelationships(entityId: string): Promise<Result<Relationship[]>> {
    const provider = this.requireDefaultProvider();
    return provider.getRelationships(entityId);
  }

  public async getRelatedEntities(entityId: string, relationshipType?: string): Promise<Result<Entity[]>> {
    const provider = this.requireDefaultProvider();
    return provider.getRelatedEntities(entityId, relationshipType);
  }

  public async addFact(fact: Omit<Fact, "id" | "metadata">): Promise<Result<Fact>> {
    const provider = this.requireDefaultProvider();
    this.trackOperation("addFact");

    const result = await provider.addFact(fact);

    if (result.ok) {
      this.publishEvent("FactAdded", { fact: result.value });
    }

    return result;
  }

  public async getFacts(subject?: string): Promise<Result<Fact[]>> {
    const provider = this.requireDefaultProvider();
    return provider.getFacts(subject);
  }

  public async storeBusinessProfile(business: BusinessProfile): Promise<Result<Entity>> {
    const provider = this.requireDefaultProvider();
    this.trackOperation("storeBusinessProfile");

    const result = await provider.storeBusinessProfile(business);

    if (result.ok) {
      this.publishEvent("BusinessProfileStored", {
        business,
        entity: result.value,
      });
    }

    return result;
  }

  public async storeAgentProfile(agent: AgentProfile): Promise<Result<Entity>> {
    const provider = this.requireDefaultProvider();
    this.trackOperation("storeAgentProfile");

    const result = await provider.storeAgentProfile(agent);

    if (result.ok) {
      this.publishEvent("AgentProfileStored", {
        agent,
        entity: result.value,
      });
    }

    return result;
  }

  public async storeProjectProfile(project: ProjectProfile): Promise<Result<Entity>> {
    const provider = this.requireDefaultProvider();
    this.trackOperation("storeProjectProfile");

    const result = await provider.storeProjectProfile(project);

    if (result.ok) {
      this.publishEvent("ProjectProfileStored", {
        project,
        entity: result.value,
      });
    }

    return result;
  }

  private requireDefaultProvider(): MemoryProvider {
    const provider = this.defaultProvider;
    if (!provider) {
      throw new MemoryError("No default provider registered", "NO_DEFAULT_PROVIDER");
    }
    return provider;
  }

  private trackOperation(operation: string): void {
    const count = this._operationCounts.get(operation) ?? 0;
    this._operationCounts.set(operation, count + 1);
    this._lastOperationTimes.set(operation, new Date());
  }

  private publishEvent(type: MemoryEventType, data: unknown): void {
    if (!this._eventBus) {
      return;
    }

    const event: MemoryEvent = {
      type,
      timestamp: new Date(),
      providerId: this.defaultProvider?.info.name ?? "unknown",
      data,
    };

    this._eventBus.publish(event);
  }

  public getOperationStats(): ReadonlyMap<string, number> {
    return this._operationCounts;
  }
}

export class Diagnostics implements IMemoryDiagnostics {
  private readonly engine: IMemoryEngine;

  public constructor(engine: IMemoryEngine) {
    this.engine = engine;
  }

  public async getProviderDiagnostics(providerId: string): Promise<Result<ProviderDiagnostics>> {
    const provider = this.engine.getProvider(providerId);

    if (!provider) {
      return fail(new MemoryError(`Provider not found: ${providerId}`, "PROVIDER_NOT_FOUND"));
    }

    const healthResult = await provider.health();

    const status = healthResult.ok ? healthResult.value.status : "unavailable";
    const responseTimeMs = healthResult.ok ? (healthResult.value.latencyMs ?? 0) : 0;
    const healthScore = healthResult.ok
      ? status === "available" ? 1.0
        : status === "degraded" ? 0.5
        : 0.0
      : 0.0;

    return ok({
      providerId,
      status,
      responseTimeMs,
      memoryCount: 0,
      storageUsageBytes: 0,
      connectionState: healthResult.ok ? "connected" : "disconnected",
      lastSyncTime: null,
      healthScore,
    });
  }

  public async getAllDiagnostics(): Promise<Result<Record<string, ProviderDiagnostics>>> {
    const providers = this.engine.listProviders();
    const results: Record<string, ProviderDiagnostics> = {};

    for (const provider of providers) {
      const diagResult = await this.getProviderDiagnostics(provider.info.name);
      if (diagResult.ok) {
        results[provider.info.name] = diagResult.value;
      }
    }

    return ok(results);
  }

  public async getStorageStats(): Promise<Result<{
    totalMemoryCount: number;
    totalStorageBytes: number;
    providerCount: number;
    averageHealthScore: number;
  }>> {
    const diagnostics = await this.getAllDiagnostics();

    if (!diagnostics.ok) {
      return fail(new MemoryError("Failed to get diagnostics", "DIAGNOSTICS_FAILED"));
    }

    const diags = diagnostics.value;
    const providerCount = Object.keys(diags).length;

    let totalMemoryCount = 0;
    let totalStorageBytes = 0;
    let totalHealthScore = 0;

    for (const diag of Object.values(diags)) {
      totalMemoryCount += diag.memoryCount;
      totalStorageBytes += diag.storageUsageBytes;
      totalHealthScore += diag.healthScore;
    }

    return ok({
      totalMemoryCount,
      totalStorageBytes,
      providerCount,
      averageHealthScore: providerCount > 0 ? totalHealthScore / providerCount : 0,
    });
  }
}