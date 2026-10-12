export type MemoryType =
  | 'short-term'
  | 'long-term'
  | 'semantic'
  | 'episodic'
  | 'procedural'
  | 'working'
  | 'business'
  | 'user'
  | 'project'
  | 'workflow'
  | 'agent'
  | 'knowledge'
  | 'conversation'
  | 'document'
  | 'decision'
  | 'task'
  | 'relationship';

export type MemoryVisibility = 'private' | 'project' | 'organization' | 'public';

export type MemorySecurityLevel = 'unclassified' | 'internal' | 'confidential' | 'restricted';

export interface MemoryEmbedding {
  vector: number[];
  model: string;
  dimensions: number;
  createdAt: string;
}

export interface MemoryEntity {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  confidence: number;
  createdAt?: string;
}

export interface MemoryRelationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  properties: Record<string, unknown>;
  confidence: number;
  createdAt: string;
}

export interface MemoryItem {
  id: string;
  type: MemoryType;
  owner: string;
  createdAt: string;
  updatedAt: string;
  confidence: number;
  source: string;
  embedding?: MemoryEmbedding;
  entities: MemoryEntity[];
  relationships: MemoryRelationship[];
  tags: string[];
  importance: number;
  visibility: MemoryVisibility;
  security: MemorySecurityLevel;
  summary: string;
  rawContent: string;
  metadata: Record<string, unknown>;
}

export interface MemoryQuery {
  query: string;
  types?: MemoryType[];
  owner?: string;
  projectId?: string;
  userId?: string;
  agentId?: string;
  workflowId?: string;
  businessId?: string;
  tags?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  limit?: number;
  offset?: number;
  minImportance?: number;
  minConfidence?: number;
  visibility?: MemoryVisibility[];
  security?: MemorySecurityLevel[];
}

export interface MemorySearchResult {
  item: MemoryItem;
  score: number;
  matchType: 'semantic' | 'keyword' | 'vector' | 'graph' | 'hybrid' | 'timeline' | 'entity';
}

export interface MemoryRetrievalOptions {
  query: MemoryQuery;
  searchMode: 'semantic' | 'keyword' | 'vector' | 'graph' | 'hybrid' | 'timeline' | 'entity';
  includeEmbeddings?: boolean;
  includeEntities?: boolean;
  includeRelationships?: boolean;
  maxResults?: number;
  rerank?: boolean;
}

export interface MemoryStoreOptions {
  extractFacts?: boolean;
  classify?: boolean;
  index?: boolean;
  embed?: boolean;
  relate?: boolean;
  summarize?: boolean;
}

export interface MemoryUpdateOptions {
  updateEmbedding?: boolean;
  updateEntities?: boolean;
  updateRelationships?: boolean;
  updateSummary?: boolean;
  updateImportance?: boolean;
}

export interface MemoryArchiveOptions {
  reason: string;
  archiveLocation?: string;
}

export interface MemoryMergeOptions {
  strategy: 'replace' | 'merge' | 'append' | 'smart';
  conflictResolution?: 'source-wins' | 'target-wins' | 'manual' | 'ai';
}

export interface MemoryStats {
  totalItems: number;
  itemsByType: Record<MemoryType, number>;
  totalEmbeddings: number;
  totalEntities: number;
  totalRelationships: number;
  storageSizeBytes: number;
  oldestItem?: string;
  newestItem?: string;
}

export interface MemoryHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  providers: Record<string, ProviderHealth>;
  lastCheck: string;
  metrics: {
    latencyMs: number;
    errorRate: number;
    throughput: number;
  };
}

export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  lastCheck: string;
  error?: string;
}