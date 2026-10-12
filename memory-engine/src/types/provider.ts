import { MemoryType, MemoryItem, MemoryQuery, MemorySearchResult, MemoryStats } from './memory';
import { MemoryEventType } from './events';

export type ProviderType =
  | 'cognee'
  | 'neo4j'
  | 'qdrant'
  | 'sqlite'
  | 'redis'
  | 'filesystem'
  | 'memory'
  | 'custom';

export type ProviderStatus = 'initializing' | 'connected' | 'disconnected' | 'error' | 'shutting_down';

export interface ProviderConfig {
  id: string;
  type: ProviderType;
  name: string;
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
  memoryTypes: MemoryType[];
  capabilities: string[];
  limits?: {
    maxItems?: number;
    maxStorageBytes?: number;
    maxQuerySize?: number;
    maxEmbeddingDimensions?: number;
    rateLimit?: {
      requestsPerSecond: number;
      burst: number;
    };
  };
  credentials?: {
    apiKey?: string;
    endpoint?: string;
    username?: string;
    password?: string;
    certificate?: string;
    privateKey?: string;
  };
  connection?: {
    host?: string;
    port?: number;
    database?: string;
    ssl?: boolean;
    timeout?: number;
    poolSize?: number;
  };
}

export interface ProviderMetadata {
  id: string;
  type: ProviderType;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  license: string;
  supportedMemoryTypes: MemoryType[];
  supportedOperations: ProviderOperation[];
  minVersion?: string;
  maxVersion?: string;
}

export type ProviderOperation =
  | 'store'
  | 'retrieve'
  | 'update'
  | 'delete'
  | 'archive'
  | 'merge'
  | 'search'
  | 'summarize'
  | 'relate'
  | 'embed'
  | 'index'
  | 'extract'
  | 'classify'
  | 'stats'
  | 'health';

export interface ProviderCapabilities {
  vectorSearch: boolean;
  keywordSearch: boolean;
  graphSearch: boolean;
  hybridSearch: boolean;
  timelineSearch: boolean;
  entitySearch: boolean;
  semanticSearch: boolean;
  embeddings: boolean;
  knowledgeGraph: boolean;
  fullTextSearch: boolean;
  fuzzySearch: boolean;
  geoSearch: boolean;
  timeSeries: boolean;
  transactions: boolean;
  replication: boolean;
  clustering: boolean;
  compression: boolean;
  encryption: boolean;
  backup: boolean;
  restore: boolean;
  import: boolean;
  export: boolean;
  streaming: boolean;
  batching: boolean;
  caching: boolean;
  indexing: boolean;
  customAnalyzers: boolean;
  customTokenizers: boolean;
  customScorers: boolean;
  explain: boolean;
  profiling: boolean;
  monitoring: boolean;
  alerting: boolean;
}

export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  lastCheck: string;
  error?: string;
  details?: {
    connected?: boolean;
    diskUsage?: {
      used: number;
      total: number;
    };
    memoryUsage?: {
      used: number;
      total: number;
    };
    cpuUsage?: number;
    activeConnections?: number;
    queueLength?: number;
    errorRate?: number;
    throughput?: number;
  };
}

export interface ProviderStats {
  totalItems: number;
  itemsByType: Record<MemoryType, number>;
  storageSizeBytes: number;
  indexSizeBytes: number;
  embeddingCount: number;
  entityCount: number;
  relationshipCount: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  throughput: number;
  uptime: number;
  lastBackup?: string;
  oldestItem?: string;
  newestItem?: string;
}

export interface ProviderEvent {
  type: MemoryEventType;
  providerId: string;
  timestamp: string;
  payload: unknown;
}

export interface ProviderError extends Error {
  providerId: string;
  operation: ProviderOperation;
  code?: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

export interface IEmbeddingProvider {
  generateEmbedding(text: string, model?: string): Promise<number[]>;
  generateEmbeddings(texts: string[], model?: string): Promise<number[][]>;
  getDimensions(model?: string): number;
  getModels(): string[];
  getDefaultModel(): string;
}

export interface IVectorStoreProvider {
  upsertVectors(vectors: Array<{
    id: string;
    vector: number[];
    metadata: Record<string, unknown>;
  }>): Promise<void>;
  queryVectors(vector: number[], topK: number, filter?: Record<string, unknown>): Promise<Array<{
    id: string;
    score: number;
    metadata: Record<string, unknown>;
  }>>;
  deleteVectors(ids: string[]): Promise<void>;
  getVectorCount(): Promise<number>;
}

export interface IGraphStoreProvider {
  upsertNodes(nodes: Array<{
    id: string;
    labels: string[];
    properties: Record<string, unknown>;
  }>): Promise<void>;
  upsertRelationships(relationships: Array<{
    id: string;
    type: string;
    sourceId: string;
    targetId: string;
    properties: Record<string, unknown>;
  }>): Promise<void>;
  queryGraph(cypher: string, params?: Record<string, unknown>): Promise<unknown[]>;
  getSubgraph(nodeIds: string[], depth?: number): Promise<{ nodes: unknown[]; relationships: unknown[] }>;
  deleteNodes(ids: string[]): Promise<void>;
  deleteRelationships(ids: string[]): Promise<void>;
}

export interface IKeywordSearchProvider {
  indexDocuments(documents: Array<{
    id: string;
    text: string;
    metadata: Record<string, unknown>;
  }>): Promise<void>;
  search(query: string, options?: {
    limit?: number;
    offset?: number;
    filter?: Record<string, unknown>;
    highlight?: boolean;
  }): Promise<Array<{
    id: string;
    score: number;
    highlights?: string[];
    metadata: Record<string, unknown>;
  }>>;
  deleteDocuments(ids: string[]): Promise<void>;
}

export interface IFullTextSearchProvider extends IKeywordSearchProvider {
  analyze(text: string, analyzer?: string): string[];
  suggest(prefix: string, options?: {
    limit?: number;
    field?: string;
  }): Promise<string[]>;
}

export interface IStorageProvider {
  write(key: string, data: Uint8Array, metadata?: Record<string, unknown>): Promise<void>;
  read(key: string): Promise<{ data: Uint8Array; metadata: Record<string, unknown> } | null>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  list(prefix: string, limit?: number): Promise<Array<{ key: string; size: number; metadata: Record<string, unknown> }>>;
  getSize(key: string): Promise<number>;
  getTotalSize(): Promise<number>;
}

export interface ICacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  getKeys(pattern: string): Promise<string[]>;
}