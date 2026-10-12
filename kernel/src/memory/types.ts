export type MemoryPriority = "critical" | "high" | "medium" | "low";
export type MemoryTier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type MemoryType = "entity" | "relationship" | "fact" | "document" | "conversation" | "task" | "project";

export interface MemoryMetadata {
  readonly tier: MemoryTier;
  readonly priority: MemoryPriority;
  readonly type: MemoryType;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly accessedAt?: Date;
  readonly expiresAt?: Date;
  readonly archived: boolean;
  readonly tags?: readonly string[];
  readonly source?: string;
  readonly ownerId?: string;
}

export interface MemoryContent {
  readonly text?: string;
  readonly embedding?: readonly number[];
  readonly raw?: unknown;
}

export interface Memory {
  readonly id: string;
  readonly content: MemoryContent;
  readonly metadata: MemoryMetadata;
}

export interface Entity extends Memory {
  readonly entityType: "business" | "person" | "project" | "document" | "task" | "agent" | "workflow";
  readonly properties: Record<string, unknown>;
}

export interface Relationship extends Memory {
  readonly sourceId: string;
  readonly targetId: string;
  readonly relationshipType: string;
  readonly properties: Record<string, unknown>;
}

export interface Fact extends Memory {
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  readonly confidence: number;
}

export interface SearchOptions {
  readonly query: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly types?: readonly MemoryType[];
  readonly tags?: readonly string[];
  readonly ownerId?: string;
  readonly minConfidence?: number;
  readonly fromDate?: Date;
  readonly toDate?: Date;
  readonly includeArchived?: boolean;
}

export interface SearchResult {
  readonly memory: Memory;
  readonly score: number;
  readonly highlights?: readonly string[];
}

export interface RetrievalOptions {
  readonly memoryId: string;
  readonly includeArchived?: boolean;
}

export interface SummarizeOptions {
  readonly memoryIds: readonly string[];
  readonly maxLength?: number;
  readonly format?: "brief" | "detailed" | "bullet";
}

export interface RelateOptions {
  readonly sourceId: string;
  readonly targetId: string;
  readonly relationshipType: string;
  readonly properties?: Record<string, unknown>;
  readonly bidirectional?: boolean;
}

export interface ArchiveOptions {
  readonly memoryIds: readonly string[];
  readonly permanent?: boolean;
}

export interface HealthStatus {
  readonly status: "available" | "degraded" | "unavailable";
  readonly latencyMs?: number;
  readonly details?: string;
}

export interface MemoryStoreOptions {
  readonly content: MemoryContent;
  readonly metadata: Omit<MemoryMetadata, "createdAt" | "updatedAt" | "accessedAt">;
  readonly priority?: MemoryPriority;
}

export interface MemoryProviderInfo {
  readonly name: string;
  readonly displayName: string;
  readonly version: string;
  readonly category: "memory";
  readonly supports: readonly string[];
  readonly reliabilityScore: number;
  readonly requiresApiKey: boolean;
}

export interface CogneeConfig {
  readonly apiKey?: string;
  readonly endpoint?: string;
  readonly model?: string;
  readonly embeddingModel?: string;
  readonly maxRetries?: number;
  readonly timeout?: number;
  readonly defaultTier?: MemoryTier;
  readonly namespace?: string;
}