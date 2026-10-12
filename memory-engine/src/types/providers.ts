import { MemoryType, MemoryItem, MemoryQuery, MemorySearchResult, MemoryStoreOptions, MemoryUpdateOptions, MemoryArchiveOptions, MemoryMergeOptions, MemoryStats, MemoryHealth, ProviderHealth } from './memory';
import { MemoryEventType } from './events';

export type ProviderType = 'cognee' | 'neo4j' | 'qdrant' | 'sqlite' | 'redis' | 'filesystem' | 'memory' | 'custom';

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
  factExtraction: boolean;
  summarization: boolean;
  classification: boolean;
  relationships: boolean;
  transactions: boolean;
  replication: boolean;
  encryption: boolean;
  compression: boolean;
}

export interface ProviderConfig {
  id: string;
  type: ProviderType;
  name: string;
  version: string;
  endpoint?: string;
  apiKey?: string;
  credentials?: Record<string, string>;
  options?: Record<string, unknown>;
  enabled: boolean;
  priority: number;
  capabilities: ProviderCapabilities;
  memoryTypes: MemoryType[];
  maxConnections?: number;
  timeoutMs?: number;
  retryPolicy?: {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
}

export interface ProviderMetadata {
  id: string;
  type: ProviderType;
  name: string;
  version: string;
  status: 'initialized' | 'connecting' | 'connected' | 'disconnected' | 'error' | 'shutting_down';
  connectedAt?: string;
  lastError?: string;
  stats: {
    operations: number;
    errors: number;
    avgLatencyMs: number;
    bytesStored: number;
    bytesRetrieved: number;
  };
}

export interface IMemoryProvider {
  readonly metadata: ProviderMetadata;
  readonly config: ProviderConfig;

  initialize(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  health(): Promise<ProviderHealth>;
  shutdown(): Promise<void>;

  store(item: MemoryItem, options?: MemoryStoreOptions): Promise<MemoryItem>;
  retrieve(id: string): Promise<MemoryItem | null>;
  update(id: string, updates: Partial<MemoryItem>, options?: MemoryUpdateOptions): Promise<MemoryItem>;
  delete(id: string, permanent?: boolean): Promise<boolean>;
  archive(id: string, options: MemoryArchiveOptions): Promise<void>;
  merge(sourceId: string, targetId: string, options: MemoryMergeOptions): Promise<MemoryItem>;

  search(query: MemoryQuery): Promise<MemorySearchResult[]>;
  retrieveByQuery(query: MemoryQuery, options?: {
    includeEmbeddings?: boolean;
    includeEntities?: boolean;
    includeRelationships?: boolean;
  }): Promise<MemorySearchResult[]>;

  summarize(ids: string[]): Promise<string>;
  relate(sourceId: string, targetId: string, relationshipType: string, properties?: Record<string, unknown>): Promise<void>;

  getStats(): Promise<MemoryStats>;
  listTypes(): MemoryType[];
  supportsType(type: MemoryType): boolean;

  onEvent(type: MemoryEventType, handler: (event: unknown) => void): string;
  offEvent(subscriptionId: string): boolean;
}

export interface IStorageProvider {
  readonly id: string;
  readonly type: string;

  initialize(config: Record<string, unknown>): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  health(): Promise<ProviderHealth>;
  shutdown(): Promise<void>;

  write(key: string, data: unknown, metadata?: Record<string, unknown>): Promise<void>;
  read(key: string): Promise<unknown | null>;
  update(key: string, data: unknown, metadata?: Record<string, unknown>): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  list(prefix?: string): Promise<string[]>;
  getSize(key: string): Promise<number>;
  getTotalSize(): Promise<number>;
}

export interface IEmbeddingProvider {
  readonly id: string;
  readonly model: string;
  readonly dimensions: number;

  initialize(config: Record<string, unknown>): Promise<void>;
  health(): Promise<ProviderHealth>;
  shutdown(): Promise<void>;

  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  similarity(vec1: number[], vec2: number[]): number;
}

export interface IVectorSearchProvider {
  readonly id: string;

  initialize(config: Record<string, unknown>): Promise<void>;
  health(): Promise<ProviderHealth>;
  shutdown(): Promise<void>;

  upsert(vectors: Array<{ id: string; vector: number[]; metadata: Record<string, unknown> }>): Promise<void>;
  search(vector: number[], options: { limit: number; filter?: Record<string, unknown>; includeMetadata?: boolean }): Promise<Array<{ id: string; score: number; metadata: Record<string, unknown> }>>;
  delete(ids: string[]): Promise<void>;
  getIndexStats(): Promise<{ vectorCount: number; indexSize: number; dimensions: number }>;
}

export interface IKeywordSearchProvider {
  readonly id: string;

  initialize(config: Record<string, unknown>): Promise<void>;
  health(): Promise<ProviderHealth>;
  shutdown(): Promise<void>;

  index(document: { id: string; content: string; metadata: Record<string, unknown> }): Promise<void>;
  search(query: string, options: { limit: number; filter?: Record<string, unknown> }): Promise<Array<{ id: string; score: number; highlights: string[]; metadata: Record<string, unknown> }>>;
  delete(ids: string[]): Promise<void>;
}

export interface IGraphProvider {
  readonly id: string;

  initialize(config: Record<string, unknown>): Promise<void>;
  health(): Promise<ProviderHealth>;
  shutdown(): Promise<void>;

  createNode(label: string, properties: Record<string, unknown>): Promise<string>;
  createRelationship(sourceId: string, targetId: string, type: string, properties: Record<string, unknown>): Promise<string>;
  getNode(id: string): Promise<Record<string, unknown> | null>;
  getRelationships(nodeId: string, direction?: 'incoming' | 'outgoing' | 'both', types?: string[]): Promise<Array<{ id: string; type: string; source: string; target: string; properties: Record<string, unknown> }>>;
  query(cypher: string, params?: Record<string, unknown>): Promise<unknown[]>;
  deleteNode(id: string): Promise<boolean>;
  deleteRelationship(id: string): Promise<boolean>;
}

export interface IFactExtractionProvider {
  readonly id: string;

  initialize(config: Record<string, unknown>): Promise<void>;
  health(): Promise<ProviderHealth>;
  shutdown(): Promise<void>;

  extractFacts(text: string, context?: Record<string, unknown>): Promise<Array<{
    subject: string;
    predicate: string;
    object: string;
    confidence: number;
    metadata: Record<string, unknown>;
  }>>;
  verifyFact(subject: string, predicate: string, object: string): Promise<{ verified: boolean; confidence: number; sources: string[] }>;
}

export interface ISummarizationProvider {
  readonly id: string;

  initialize(config: Record<string, unknown>): Promise<void>;
  health(): Promise<ProviderHealth>;
  shutdown(): Promise<void>;

  summarize(text: string, options?: { maxLength?: number; style?: 'concise' | 'detailed' | 'bullet' | 'narrative' }): Promise<string>;
  summarizeBatch(texts: string[], options?: { maxLength?: number; style?: 'concise' | 'detailed' | 'bullet' | 'narrative' }): Promise<string[]>;
}

export interface IClassificationProvider {
  readonly id: string;

  initialize(config: Record<string, unknown>): Promise<void>;
  health(): Promise<ProviderHealth>;
  shutdown(): Promise<void>;

  classify(text: string, candidateTypes: MemoryType[]): Promise<{ type: MemoryType; confidence: number }>;
  classifyBatch(texts: string[], candidateTypes: MemoryType[]): Promise<Array<{ type: MemoryType; confidence: number }>>;
}

export { ProviderHealth } from './memory';
export type { MemoryType, MemoryItem, MemoryQuery, MemorySearchResult, MemoryStoreOptions, MemoryUpdateOptions, MemoryArchiveOptions, MemoryMergeOptions, MemoryStats, MemoryHealth } from './memory';
export type { MemoryEventType, MemoryEvent, MemoryEventPayload } from './events';