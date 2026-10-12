import { Result } from "../../shared/result.js";
import type {
  Memory,
  Entity,
  Relationship,
  Fact,
  SearchOptions,
  SearchResult,
  RetrievalOptions,
  SummarizeOptions,
  RelateOptions,
  ArchiveOptions,
  HealthStatus,
  MemoryStoreOptions,
  CogneeConfig,
  MemoryProviderInfo,
} from "../types.js";

export interface MemoryProviderLifecycle {
  initialize(config: CogneeConfig): Promise<Result<void>>;
  shutdown(): Promise<Result<void>>;
  health(): Promise<Result<HealthStatus>>;
}

export interface MemoryProvider extends MemoryProviderLifecycle {
  readonly info: MemoryProviderInfo;

  store(options: MemoryStoreOptions): Promise<Result<Memory>>;
  retrieve(options: RetrievalOptions): Promise<Result<Memory | null>>;
  search(options: SearchOptions): Promise<Result<SearchResult[]>>;
  summarize(options: SummarizeOptions): Promise<Result<string>>;
  delete(memoryId: string): Promise<Result<void>>;
  archive(options: ArchiveOptions): Promise<Result<void>>;

  createEntity(entity: Omit<Entity, "id" | "metadata">): Promise<Result<Entity>>;
  createRelationship(relate: RelateOptions): Promise<Result<Relationship>>;
  getEntity(entityId: string): Promise<Result<Entity | null>>;
  getRelationships(entityId: string): Promise<Result<Relationship[]>>;
  getRelatedEntities(entityId: string, relationshipType?: string): Promise<Result<Entity[]>>;

  addFact(fact: Omit<Fact, "id" | "metadata">): Promise<Result<Fact>>;
  getFacts(subject?: string): Promise<Result<Fact[]>>;

  storeBusinessProfile(business: BusinessProfile): Promise<Result<Entity>>;
  storeAgentProfile(agent: AgentProfile): Promise<Result<Entity>>;
  storeProjectProfile(project: ProjectProfile): Promise<Result<Entity>>;
}

export interface BusinessProfile {
  readonly id?: string;
  readonly name: string;
  readonly website?: string;
  readonly socialProfiles?: readonly SocialProfile[];
  readonly contacts?: readonly Contact[];
  readonly technology?: readonly string[];
  readonly seoData?: SeoData;
  readonly projects?: readonly string[];
  readonly proposals?: readonly string[];
  readonly emails?: readonly string[];
  readonly meetings?: readonly Meeting[];
  readonly history?: readonly HistoryEntry[];
  readonly relationships?: readonly BusinessRelationship[];
}

export interface SocialProfile {
  readonly platform: string;
  readonly url: string;
  readonly handle?: string;
}

export interface Contact {
  readonly name: string;
  readonly email?: string;
  readonly phone?: string;
  readonly role?: string;
  readonly linkedIn?: string;
}

export interface SeoData {
  readonly domain?: string;
  readonly authority?: number;
  readonly keywords?: readonly string[];
  readonly topPages?: readonly string[];
}

export interface Meeting {
  readonly date: Date;
  readonly summary?: string;
  readonly participants?: readonly string[];
  readonly outcomes?: readonly string[];
}

export interface HistoryEntry {
  readonly date: Date;
  readonly event: string;
  readonly details?: string;
}

export interface BusinessRelationship {
  readonly businessId: string;
  readonly relationshipType: string;
  readonly details?: string;
}

export interface AgentProfile {
  readonly id?: string;
  readonly name: string;
  readonly type: string;
  readonly capabilities?: readonly string[];
  readonly pastWork?: readonly WorkEntry[];
  readonly preferences?: Record<string, unknown>;
  readonly mistakes?: readonly MistakeEntry[];
  readonly successfulWorkflows?: readonly WorkflowRecord[];
  readonly currentContext?: Record<string, unknown>;
  readonly currentGoals?: readonly string[];
}

export interface WorkEntry {
  readonly projectId: string;
  readonly description: string;
  readonly date: Date;
  readonly outcome?: string;
}

export interface MistakeEntry {
  readonly description: string;
  readonly date: Date;
  readonly lesson?: string;
}

export interface WorkflowRecord {
  readonly workflowId: string;
  readonly name: string;
  readonly successRate: number;
  readonly useCount: number;
}

export interface ProjectProfile {
  readonly id?: string;
  readonly name: string;
  readonly description?: string;
  readonly timeline?: readonly TimelineEntry[];
  readonly files?: readonly string[];
  readonly versions?: readonly VersionRecord[];
  readonly conversations?: readonly string[];
  readonly decisions?: readonly DecisionEntry[];
  readonly tasks?: readonly string[];
  readonly deliverables?: readonly string[];
  readonly dependencies?: readonly string[];
}

export interface TimelineEntry {
  readonly date: Date;
  readonly event: string;
  readonly type: "created" | "updated" | "milestone" | "decision" | "delivery";
}

export interface VersionRecord {
  readonly version: string;
  readonly date: Date;
  readonly changes?: readonly string[];
  readonly author?: string;
}

export interface DecisionEntry {
  readonly date: Date;
  readonly decision: string;
  readonly rationale?: string;
  readonly decidedBy?: string;
}

export type { MemoryProviderInfo, CogneeConfig };