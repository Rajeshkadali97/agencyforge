import {
  ProviderConfig,
  ProviderMetadata,
  ProviderHealth,
  ProviderCapabilities,
  MemoryType,
  MemoryItem,
  MemoryQuery,
  MemorySearchResult,
  MemoryStoreOptions,
  MemoryUpdateOptions,
  MemoryArchiveOptions,
  MemoryMergeOptions,
  MemoryStats,
  MemoryEventType,
} from '../../types';
import { IMemoryProvider } from '../../interfaces';

interface CogneeConfig {
  apiUrl: string;
  apiKey: string;
  organizationId?: string;
  projectId?: string;
  timeout: number;
  retryAttempts: number;
}

interface CogneeDocument {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
}

interface CogneeSearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
}

interface CogneeGraphNode {
  id: string;
  label: string;
  properties: Record<string, unknown>;
}

interface CogneeGraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, unknown>;
}

export class CogneeMemoryProvider implements IMemoryProvider {
  readonly config: ProviderConfig;
  readonly metadata: ProviderMetadata;
  private cogneeConfig: CogneeConfig;
  private client: CogneeClient;
  private eventHandlers: Map<MemoryEventType, Map<string, (event: unknown) => void>> = new Map();

  constructor(config: ProviderConfig) {
    this.config = config;
    this.cogneeConfig = this.parseConfig(config.options || {});
    this.client = new CogneeClient(this.cogneeConfig);

    this.metadata = {
      id: config.id,
      type: config.type,
      name: config.name,
      version: '1.0.0',
      status: 'initialized',
      connectedAt: undefined,
      stats: {
        operations: 0,
        errors: 0,
        avgLatencyMs: 0,
        bytesStored: 0,
        bytesRetrieved: 0,
      },
    };
  }

  private parseConfig(config: Record<string, unknown>): CogneeConfig {
    return {
      apiUrl: (config.apiUrl as string) || 'https://api.cognee.ai',
      apiKey: (config.apiKey as string) || '',
      organizationId: config.organizationId as string | undefined,
      projectId: config.projectId as string | undefined,
      timeout: (config.timeout as number) || 30000,
      retryAttempts: (config.retryAttempts as number) || 3,
    };
  }

  async initialize(): Promise<void> {
    this.metadata.status = 'connecting';
    try {
      await this.client.healthCheck();
      this.metadata.status = 'connected';
      this.metadata.connectedAt = new Date().toISOString();
      this.emitEvent('provider.connected', {
        providerId: this.config.id,
        providerType: this.config.type,
        capabilities: this.getCapabilities(),
      });
    } catch (error) {
      this.metadata.status = 'error';
      this.metadata.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  async connect(): Promise<void> {
    await this.initialize();
  }

  async disconnect(): Promise<void> {
    this.metadata.status = 'disconnected';
    this.emitEvent('provider.disconnected', {
      providerId: this.config.id,
      reason: 'Manual disconnect',
    });
  }

  async health(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      await this.client.healthCheck();
      const latencyMs = Date.now() - start;
      this.metadata.stats.avgLatencyMs =
        (this.metadata.stats.avgLatencyMs * this.metadata.stats.operations + latencyMs) /
        (this.metadata.stats.operations + 1);
      this.metadata.stats.operations++;

      return {
        status: 'healthy',
        latencyMs,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      this.metadata.stats.errors++;
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async shutdown(): Promise<void> {
    this.metadata.status = 'shutting_down';
    await this.disconnect();
    this.eventHandlers.clear();
  }

  async store(item: MemoryItem, _options?: MemoryStoreOptions): Promise<MemoryItem> {
    const start = Date.now();
    try {
      const document = this.itemToDocument(item);
      await this.client.addDocument(document);

      // Extract and store entities
      if (item.entities.length > 0) {
        await this.client.addEntities(item.entities);
      }

      // Extract and store relationships
      if (item.relationships.length > 0) {
        await this.client.addRelationships(item.relationships);
      }

      // Generate embedding if not present
      if (!item.embedding && item.rawContent) {
        const embedding = await this.client.generateEmbedding(item.rawContent);
        await this.client.updateEmbedding(item.id, embedding);
      }

      this.metadata.stats.operations++;
      this.metadata.stats.bytesStored += JSON.stringify(item).length;

      this.emitEvent('memory.created', { memoryId: item.id, memoryType: item.type, owner: item.owner });

      return item;
    } catch (error) {
      this.metadata.stats.errors++;
      this.emitEvent('provider.error', {
        providerId: this.config.id,
        error: error instanceof Error ? error.message : String(error),
        operation: 'store',
        recoverable: true,
      });
      throw error;
    }
  }

  async retrieve(id: string): Promise<MemoryItem | null> {
    const start = Date.now();
    try {
      const document = await this.client.getDocument(id);
      if (!document) return null;

      const entities = await this.client.getEntities(id);
      const relationships = await this.client.getRelationships(id);
      const embedding = await this.client.getEmbedding(id);

      const item = this.documentToItem(document, entities, relationships, embedding);
      this.metadata.stats.operations++;
      this.metadata.stats.bytesRetrieved += JSON.stringify(item).length;

      this.emitEvent('memory.retrieved', { memoryId: id, retrievalTimeMs: Date.now() - start });

      return item;
    } catch (error) {
      this.metadata.stats.errors++;
      throw error;
    }
  }

  async update(id: string, updates: Partial<MemoryItem>, _options?: MemoryUpdateOptions): Promise<MemoryItem> {
    const existing = await this.retrieve(id);
    if (!existing) throw new Error(`Memory item not found: ${id}`);

    const updated: MemoryItem = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Update document
    await this.client.updateDocument(id, this.itemToDocument(updated));

    // Update embedding if content changed
    if (updates.rawContent && updates.rawContent !== existing.rawContent) {
      const embedding = await this.client.generateEmbedding(updates.rawContent);
      await this.client.updateEmbedding(id, embedding);
    }

    // Update entities
    if (updates.entities) {
      await this.client.updateEntities(id, updates.entities);
    }

    // Update relationships
    if (updates.relationships) {
      await this.client.updateRelationships(id, updates.relationships);
    }

    this.emitEvent('memory.updated', { memoryId: id, changes: Object.keys(updates) });

    return updated;
  }

  async delete(id: string, permanent: boolean = false): Promise<boolean> {
    try {
      if (permanent) {
        await this.client.deleteDocument(id);
      } else {
        await this.client.archiveDocument(id);
      }
      this.emitEvent('memory.deleted', { memoryId: id, permanent });
      return true;
    } catch (error) {
      this.emitEvent('provider.error', {
        providerId: this.config.id,
        error: error instanceof Error ? error.message : String(error),
        operation: 'delete',
        recoverable: false,
      });
      return false;
    }
  }

  async archive(id: string, options: MemoryArchiveOptions): Promise<void> {
    try {
      await this.client.archiveDocument(id);
      this.emitEvent('memory.archived', {
        memoryId: id,
        archiveLocation: options.archiveLocation || 'cognee_archive',
        reason: options.reason,
      });
    } catch (error) {
      this.emitEvent('provider.error', {
        providerId: this.config.id,
        error: error instanceof Error ? error.message : String(error),
        operation: 'archive',
        recoverable: true,
      });
      throw error;
    }
  }

  async merge(sourceId: string, targetId: string, options: MemoryMergeOptions): Promise<MemoryItem> {
    const source = await this.retrieve(sourceId);
    const target = await this.retrieve(targetId);

    if (!source || !target) {
      throw new Error('One or both memory items not found');
    }

    // Use Cognee's merge capability or implement custom logic
    const merged = this.mergeItems(source, target, options);
    await this.store(merged);

    this.emitEvent('memory.merged', {
      sourceMemoryId: sourceId,
      targetMemoryId: targetId,
      strategy: options.strategy,
      resultMemoryId: merged.id,
    });

    return merged;
  }

  async search(query: MemoryQuery): Promise<MemorySearchResult[]> {
    const start = Date.now();
    try {
      let results: CogneeSearchResult[];

      if (query.query) {
        // Use hybrid search (vector + keyword)
        results = await this.client.hybridSearch(query.query, {
          limit: query.limit || 10,
          filter: this.buildFilter(query),
        });
      } else {
        // Use filter-only search
        results = await this.client.filterSearch(this.buildFilter(query), {
          limit: query.limit || 10,
        });
      }

      const searchResults: MemorySearchResult[] = results.map(r => ({
        item: this.documentToItem(r, [], [], undefined),
        score: r.score,
        matchType: 'hybrid' as const,
      }));

      this.emitEvent('search.performed', {
        query,
        resultsCount: searchResults.length,
        searchMode: 'hybrid',
        durationMs: Date.now() - start,
        provider: this.config.id,
      });

      return searchResults;
    } catch (error) {
      this.metadata.stats.errors++;
      throw error;
    }
  }

  async retrieveByQuery(query: MemoryQuery, options?: {
    includeEmbeddings?: boolean;
    includeEntities?: boolean;
    includeRelationships?: boolean;
  }): Promise<MemorySearchResult[]> {
    const results = await this.search(query);

    if (options?.includeEntities || options?.includeRelationships || options?.includeEmbeddings) {
      // Enrich results with additional data
      for (const result of results) {
        if (options.includeEntities) {
          const entities = await this.client.getEntities(result.item.id);
          result.item.entities = entities;
        }
        if (options.includeRelationships) {
          const relationships = await this.client.getRelationships(result.item.id);
          result.item.relationships = relationships;
        }
        if (options.includeEmbeddings) {
          const embedding = await this.client.getEmbedding(result.item.id);
          if (embedding) {
            result.item.embedding = { vector: embedding, model: 'cognee', dimensions: embedding.length, createdAt: new Date().toISOString() };
          }
        }
      }
    }

    this.emitEvent('retrieval.performed', {
      query,
      resultsCount: results.length,
      durationMs: 0, // Will be calculated by caller
      provider: this.config.id,
    });

    return results;
  }

  async summarize(ids: string[]): Promise<string> {
    const items = await Promise.all(ids.map(id => this.retrieve(id)));
    const validItems = items.filter((item): item is MemoryItem => item !== null);

    if (validItems.length === 0) return '';

    const combinedContent = validItems.map(item => item.rawContent).join('\n\n');
    return this.client.summarize(combinedContent);
  }

  async relate(sourceId: string, targetId: string, relationshipType: string, properties?: Record<string, unknown>): Promise<void> {
    await this.client.addRelationship({
      id: `rel_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      source: sourceId,
      target: targetId,
      type: relationshipType,
      properties: properties || {},
    });

    this.emitEvent('relationship.created', {
      relationshipId: '',
      sourceEntityId: sourceId,
      targetEntityId: targetId,
      type: relationshipType,
      confidence: 0.9,
    });
  }

  async getStats(): Promise<MemoryStats> {
    const stats = await this.client.getStats();
    return {
      totalItems: stats.documentCount,
      itemsByType: {} as Record<MemoryType, number>,
      totalEmbeddings: stats.embeddingCount,
      totalEntities: stats.entityCount,
      totalRelationships: stats.relationshipCount,
      storageSizeBytes: stats.storageSizeBytes,
      oldestItem: stats.oldestItem,
      newestItem: stats.newestItem,
    };
  }

  listTypes(): MemoryType[] {
    return this.config.memoryTypes;
  }

  supportsType(type: MemoryType): boolean {
    return this.config.memoryTypes.includes(type);
  }

  onEvent(type: MemoryEventType, handler: (event: unknown) => void): string {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, new Map());
    }
    const handlers = this.eventHandlers.get(type)!;
    const id = `handler_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    handlers.set(id, handler);
    return id;
  }

  offEvent(subscriptionId: string): boolean {
    for (const handlers of this.eventHandlers.values()) {
      if (handlers.delete(subscriptionId)) {
        return true;
      }
    }
    return false;
  }

  private getCapabilities(): ProviderCapabilities {
    return {
      vectorSearch: true,
      keywordSearch: true,
      graphSearch: true,
      hybridSearch: true,
      timelineSearch: true,
      entitySearch: true,
      semanticSearch: true,
      embeddings: true,
      knowledgeGraph: true,
      factExtraction: true,
      summarization: true,
      classification: true,
      relationships: true,
      transactions: false,
      replication: false,
      encryption: true,
      compression: false,
    };
  }

  private itemToDocument(item: MemoryItem): CogneeDocument {
    return {
      id: item.id,
      content: item.rawContent,
      metadata: {
        ...item.metadata,
        type: item.type,
        owner: item.owner,
        confidence: item.confidence,
        importance: item.importance,
        visibility: item.visibility,
        security: item.security,
        tags: item.tags,
        summary: item.summary,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
      embedding: item.embedding?.vector,
    };
  }

  private documentToItem(doc: CogneeDocument, entities: MemoryItem['entities'], relationships: MemoryItem['relationships'], embedding?: number[]): MemoryItem {
    const metadata = doc.metadata as Record<string, unknown>;
    return {
      id: doc.id,
      type: (metadata.type as MemoryType) || 'knowledge',
      owner: (metadata.owner as string) || 'unknown',
      createdAt: (metadata.createdAt as string) || new Date().toISOString(),
      updatedAt: (metadata.updatedAt as string) || new Date().toISOString(),
      confidence: (metadata.confidence as number) || 1.0,
      source: 'cognee',
      embedding: embedding ? { vector: embedding, model: 'cognee', dimensions: embedding.length, createdAt: new Date().toISOString() } : undefined,
      entities,
      relationships,
      tags: (metadata.tags as string[]) || [],
      importance: (metadata.importance as number) || 0.5,
      visibility: (metadata.visibility as MemoryItem['visibility']) || 'private',
      security: (metadata.security as MemoryItem['security']) || 'unclassified',
      summary: (metadata.summary as string) || doc.content.slice(0, 200),
      rawContent: doc.content,
      metadata: { ...metadata, type: undefined, owner: undefined, confidence: undefined, importance: undefined, visibility: undefined, security: undefined, tags: undefined, summary: undefined, createdAt: undefined, updatedAt: undefined },
    };
  }

  private mergeItems(source: MemoryItem, target: MemoryItem, options: MemoryMergeOptions): MemoryItem {
    // Simple merge strategy - in reality this would be more sophisticated
    return {
      ...target,
      rawContent: target.rawContent + '\n\n---\n\n' + source.rawContent,
      entities: [...new Map([...target.entities, ...source.entities].map(e => [e.id, e])).values()],
      relationships: [...new Map([...target.relationships, ...source.relationships].map(r => [r.id, r])).values()],
      tags: [...new Set([...target.tags, ...source.tags])],
      importance: Math.max(target.importance, source.importance),
      confidence: (target.confidence + source.confidence) / 2,
      updatedAt: new Date().toISOString(),
    };
  }

  private buildFilter(query: MemoryQuery): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (query.types && query.types.length > 0) {
      filter.type = query.types.length === 1 ? query.types[0] : { $in: query.types };
    }

    if (query.owner) {
      filter.owner = query.owner;
    }

    if (query.projectId) {
      filter.projectId = query.projectId;
    }

    if (query.tags && query.tags.length > 0) {
      filter.tags = { $in: query.tags };
    }

    if (query.dateRange) {
      filter.createdAt = {
        $gte: query.dateRange.start,
        $lte: query.dateRange.end,
      };
    }

    if (query.minImportance !== undefined) {
      filter.importance = { $gte: query.minImportance };
    }

    if (query.minConfidence !== undefined) {
      filter.confidence = { $gte: query.minConfidence };
    }

    return filter;
  }

  private emitEvent(type: MemoryEventType, payload: unknown): void {
    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      for (const handler of handlers.values()) {
        try {
          handler({ type, payload, timestamp: new Date().toISOString(), providerId: this.config.id });
        } catch (error) {
          console.error(`Error in event handler for ${type}:`, error);
        }
      }
    }
  }
}

class CogneeClient {
  private config: CogneeConfig;

  constructor(config: CogneeConfig) {
    this.config = config;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.apiUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Cognee API error: ${response.status} - ${error}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Cognee API request timeout');
      }
      throw error;
    }
  }

  async healthCheck(): Promise<void> {
    await this.request('/health');
  }

  async addDocument(document: CogneeDocument): Promise<void> {
    await this.request('/documents', {
      method: 'POST',
      body: JSON.stringify(document),
    });
  }

  async getDocument(id: string): Promise<CogneeDocument | null> {
    try {
      return await this.request<CogneeDocument>(`/documents/${id}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async updateDocument(id: string, document: CogneeDocument): Promise<void> {
    await this.request(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(document),
    });
  }

  async deleteDocument(id: string): Promise<void> {
    await this.request(`/documents/${id}`, { method: 'DELETE' });
  }

  async archiveDocument(id: string): Promise<void> {
    await this.request(`/documents/${id}/archive`, { method: 'POST' });
  }

  async addEntities(entities: MemoryItem['entities']): Promise<void> {
    await this.request('/entities/batch', {
      method: 'POST',
      body: JSON.stringify({ entities }),
    });
  }

  async getEntities(documentId: string): Promise<MemoryItem['entities']> {
    try {
      return await this.request<MemoryItem['entities']>(`/documents/${documentId}/entities`);
    } catch {
      return [];
    }
  }

  async updateEntities(documentId: string, entities: MemoryItem['entities']): Promise<void> {
    await this.request(`/documents/${documentId}/entities`, {
      method: 'PUT',
      body: JSON.stringify({ entities }),
    });
  }

  async addRelationships(relationships: MemoryItem['relationships']): Promise<void> {
    await this.request('/relationships/batch', {
      method: 'POST',
      body: JSON.stringify({ relationships }),
    });
  }

  async getRelationships(documentId: string): Promise<MemoryItem['relationships']> {
    try {
      return await this.request<MemoryItem['relationships']>(`/documents/${documentId}/relationships`);
    } catch {
      return [];
    }
  }

  async updateRelationships(documentId: string, relationships: MemoryItem['relationships']): Promise<void> {
    await this.request(`/documents/${documentId}/relationships`, {
      method: 'PUT',
      body: JSON.stringify({ relationships }),
    });
  }

  async addRelationship(relationship: { id: string; source: string; target: string; type: string; properties: Record<string, unknown> }): Promise<void> {
    await this.request('/relationships', {
      method: 'POST',
      body: JSON.stringify(relationship),
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const result = await this.request<{ embedding: number[] }>('/embeddings', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    return result.embedding;
  }

  async updateEmbedding(documentId: string, embedding: number[]): Promise<void> {
    await this.request(`/documents/${documentId}/embedding`, {
      method: 'PUT',
      body: JSON.stringify({ embedding }),
    });
  }

  async getEmbedding(documentId: string): Promise<number[] | undefined> {
    try {
      const result = await this.request<{ embedding: number[] }>(`/documents/${documentId}/embedding`);
      return result.embedding;
    } catch {
      return undefined;
    }
  }

  async hybridSearch(query: string, options: { limit: number; filter?: Record<string, unknown> }): Promise<CogneeSearchResult[]> {
    const result = await this.request<{ results: CogneeSearchResult[] }>('/search/hybrid', {
      method: 'POST',
      body: JSON.stringify({ query, ...options }),
    });
    return result.results;
  }

  async filterSearch(filter: Record<string, unknown>, options: { limit: number }): Promise<CogneeSearchResult[]> {
    const result = await this.request<{ results: CogneeSearchResult[] }>('/search/filter', {
      method: 'POST',
      body: JSON.stringify({ filter, ...options }),
    });
    return result.results;
  }

  async summarize(text: string): Promise<string> {
    const result = await this.request<{ summary: string }>('/summarize', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    return result.summary;
  }

  async getStats(): Promise<{
    documentCount: number;
    embeddingCount: number;
    entityCount: number;
    relationshipCount: number;
    storageSizeBytes: number;
    oldestItem?: string;
    newestItem?: string;
  }> {
    return this.request('/stats');
  }
}