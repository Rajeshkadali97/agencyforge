import type { Result } from "../../shared/result.js";
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
} from "../types.js";
import type {
  MemoryProvider,
  BusinessProfile,
  AgentProfile,
  ProjectProfile,
} from "./memory-provider.js";

export interface MemoryEngineConfig {
  readonly defaultProvider?: string;
  readonly providers?: readonly MemoryProvider[];
  readonly eventBus?: MemoryEventBus;
}

export interface MemoryEventBus {
  publish(event: MemoryEvent): void;
  subscribe(eventType: MemoryEventType, handler: (event: MemoryEvent) => void): () => void;
}

export type MemoryEventType =
  | "MemoryStored"
  | "MemoryUpdated"
  | "MemoryDeleted"
  | "MemoryArchived"
  | "EntityCreated"
  | "RelationshipCreated"
  | "FactAdded"
  | "BusinessProfileStored"
  | "ProjectProfileStored"
  | "AgentProfileStored"
  | "SearchCompleted";

export interface MemoryEvent {
  readonly type: MemoryEventType;
  readonly timestamp: Date;
  readonly providerId: string;
  readonly data: unknown;
}

export interface IMemoryEngine {
  readonly isInitialized: boolean;
  readonly defaultProvider: MemoryProvider | null;

  initialize(config: MemoryEngineConfig): Promise<Result<void>>;
  shutdown(): Promise<Result<void>>;
  health(): Promise<Result<Record<string, HealthStatus>>>;

  registerProvider(provider: MemoryProvider): Result<void>;
  unregisterProvider(providerId: string): Result<void>;
  getProvider(providerId: string): MemoryProvider | undefined;
  listProviders(): readonly MemoryProvider[];

  store(options: MemoryStoreOptions): Promise<Result<Memory>>;
  retrieve(options: RetrievalOptions): Promise<Result<Memory | null>>;
  search(options: SearchOptions): Promise<Result<SearchResult[]>>;
  summarize(options: SummarizeOptions): Promise<Result<string>>;
  delete(memoryId: string): Promise<Result<void>>;
  archive(options: ArchiveOptions): Promise<Result<void>>;

  createEntity(entity: Omit<Entity, "id" | "metadata">): Promise<Result<Entity>>;
  createRelationship(relate: {
    readonly sourceId: string;
    readonly targetId: string;
    readonly relationshipType: string;
    readonly properties?: Record<string, unknown>;
    readonly bidirectional?: boolean;
  }): Promise<Result<Relationship>>;
  getEntity(entityId: string): Promise<Result<Entity | null>>;
  getRelationships(entityId: string): Promise<Result<Relationship[]>>;
  getRelatedEntities(entityId: string, relationshipType?: string): Promise<Result<Entity[]>>;
  addFact(fact: Omit<Fact, "id" | "metadata">): Promise<Result<Fact>>;
  getFacts(subject?: string): Promise<Result<Fact[]>>;

  storeBusinessProfile(business: BusinessProfile): Promise<Result<Entity>>;
  storeAgentProfile(agent: AgentProfile): Promise<Result<Entity>>;
  storeProjectProfile(project: ProjectProfile): Promise<Result<Entity>>;
}

export interface ProviderDiagnostics {
  readonly providerId: string;
  readonly status: "available" | "degraded" | "unavailable";
  readonly responseTimeMs: number;
  readonly memoryCount: number;
  readonly storageUsageBytes: number;
  readonly connectionState: "connected" | "disconnected" | "connecting";
  readonly lastSyncTime: Date | null;
  readonly healthScore: number;
}

export interface IMemoryDiagnostics {
  getProviderDiagnostics(providerId: string): Promise<Result<ProviderDiagnostics>>;
  getAllDiagnostics(): Promise<Result<Record<string, ProviderDiagnostics>>>;
  getStorageStats(): Promise<Result<{
    totalMemoryCount: number;
    totalStorageBytes: number;
    providerCount: number;
    averageHealthScore: number;
  }>>;
}