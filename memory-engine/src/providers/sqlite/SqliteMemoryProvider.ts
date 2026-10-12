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
  MemoryEmbedding,
  MemoryEntity,
  MemoryRelationship,
} from '../../types';
import { IMemoryProvider } from '../../interfaces';
import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

interface SqliteConfig {
  dbPath: string;
  enableVectorSearch: boolean;
  enableFTS: boolean;
  maxEmbeddingDimensions: number;
}

interface MemoryRow {
  id: string;
  type: string;
  owner: string;
  created_at: string;
  updated_at: string;
  confidence: number;
  source: string;
  importance: number;
  visibility: string;
  security: string;
  summary: string;
  raw_content: string;
  metadata_json: string;
  tags_json: string;
  archived: number;
  archived_at: string | null;
}

interface EmbeddingRow {
  id: string;
  memory_id: string;
  model: string;
  dimensions: number;
  vector_json: string;
  created_at: string;
}

interface EntityRow {
  id: string;
  memory_id: string;
  entity_type: string;
  entity_name: string;
  properties_json: string;
  confidence: number;
  created_at: string;
}

interface RelationshipRow {
  id: string;
  memory_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  properties_json: string;
  confidence: number;
  created_at: string;
}

interface ArchiveRow {
  id: string;
  original_id: string;
  type: string;
  owner: string;
  archived_at: string;
  reason: string;
  content_json: string;
}

export class SqliteMemoryProvider implements IMemoryProvider {
  readonly config: ProviderConfig;
  readonly metadata: ProviderMetadata;
  private sqliteConfig: SqliteConfig;
  private db: Database.Database;
  private eventHandlers: Map<MemoryEventType, Map<string, (event: unknown) => void>> = new Map();
  private initialized = false;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.sqliteConfig = this.parseConfig(config.options || {});
    this.db = this.initializeDatabase();
    
    this.metadata = {
      id: config.id,
      type: config.type,
      name: config.name,
      version: config.version || '1.0.0',
      status: 'initialized',
      connectedAt: undefined,
      lastError: undefined,
      stats: {
        operations: 0,
        errors: 0,
        avgLatencyMs: 0,
        bytesStored: 0,
        bytesRetrieved: 0,
      },
    };
  }

  private parseConfig(config: Record<string, unknown>): SqliteConfig {
    return {
      dbPath: (config.dbPath as string) || './data/memory-engine.db',
      enableVectorSearch: (config.enableVectorSearch as boolean) ?? true,
      enableFTS: (config.enableFTS as boolean) ?? true,
      maxEmbeddingDimensions: (config.maxEmbeddingDimensions as number) ?? 1536,
    };
  }

  private initializeDatabase(): Database.Database {
    const dbDir = path.dirname(this.sqliteConfig.dbPath);
    if (dbDir && dbDir !== '.' && !fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const db = new Database(this.sqliteConfig.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('synchronous = NORMAL');

    this.createTables(db);
    
    if (this.sqliteConfig.enableFTS) {
      this.createFTSIndexes(db);
    }

    return db;
  }

  private getCapabilities(): ProviderCapabilities {
    return {
      vectorSearch: this.sqliteConfig.enableVectorSearch,
      keywordSearch: true,
      graphSearch: true,
      hybridSearch: true,
      timelineSearch: true,
      entitySearch: true,
      semanticSearch: this.sqliteConfig.enableVectorSearch,
      embeddings: true,
      knowledgeGraph: true,
      factExtraction: false,
      summarization: false,
      classification: false,
      relationships: true,
      transactions: true,
      replication: false,
      encryption: false,
      compression: false,
    };
  }

  private createTables(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        owner TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 1.0,
        source TEXT NOT NULL,
        importance REAL NOT NULL DEFAULT 0.5,
        visibility TEXT NOT NULL DEFAULT 'private',
        security TEXT NOT NULL DEFAULT 'unclassified',
        summary TEXT NOT NULL,
        raw_content TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        tags_json TEXT NOT NULL DEFAULT '[]',
        archived INTEGER NOT NULL DEFAULT 0,
        archived_at TEXT
      );

      CREATE TABLE IF NOT EXISTS memory_embeddings (
        id TEXT PRIMARY KEY,
        memory_id TEXT NOT NULL UNIQUE,
        model TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        vector_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS memory_entities (
        id TEXT PRIMARY KEY,
        memory_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_name TEXT NOT NULL,
        properties_json TEXT NOT NULL DEFAULT '{}',
        confidence REAL NOT NULL DEFAULT 1.0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS memory_relationships (
        id TEXT PRIMARY KEY,
        memory_id TEXT NOT NULL,
        source_entity_id TEXT NOT NULL,
        target_entity_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        properties_json TEXT NOT NULL DEFAULT '{}',
        confidence REAL NOT NULL DEFAULT 1.0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS memory_archives (
        id TEXT PRIMARY KEY,
        original_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        owner TEXT NOT NULL,
        archived_at TEXT NOT NULL,
        reason TEXT NOT NULL,
        content_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS checkpoints (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        checkpoint_type TEXT NOT NULL,
        content_json TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_owner ON memories(owner);
      CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_archived ON memories(archived, archived_at);
      CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories(tags_json) WHERE json_type(tags_json, '$') = 'array';
      
      CREATE INDEX IF NOT EXISTS idx_embeddings_memory_id ON memory_embeddings(memory_id);
      CREATE INDEX IF NOT EXISTS idx_embeddings_model ON memory_embeddings(model);
      
      CREATE INDEX IF NOT EXISTS idx_entities_memory_id ON memory_entities(memory_id);
      CREATE INDEX IF NOT EXISTS idx_entities_type ON memory_entities(entity_type);
      CREATE INDEX IF NOT EXISTS idx_entities_name ON memory_entities(entity_name);
      
      CREATE INDEX IF NOT EXISTS idx_relationships_memory_id ON memory_relationships(memory_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_source ON memory_relationships(source_entity_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_target ON memory_relationships(target_entity_id);
      
      CREATE INDEX IF NOT EXISTS idx_archives_original_id ON memory_archives(original_id);
      CREATE INDEX IF NOT EXISTS idx_archives_archived_at ON memory_archives(archived_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_checkpoints_timestamp ON checkpoints(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_checkpoints_type ON checkpoints(checkpoint_type);
    `);

    if (this.sqliteConfig.enableFTS) {
      try {
        db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
            raw_content,
            summary,
            content='memories',
            content_rowid='rowid'
          );
          
          CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
            INSERT INTO memories_fts(rowid, raw_content, summary)
            VALUES (new.rowid, new.raw_content, new.summary);
          END;
          
          CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
            INSERT INTO memories_fts(memories_fts, rowid, raw_content, summary)
            VALUES('delete', old.rowid, old.raw_content, old.summary);
          END;
          
          CREATE TRIGGER IF NOT EXISTS memories_aiu AFTER UPDATE ON memories BEGIN
            INSERT INTO memories_fts(memories_fts, rowid, raw_content, summary)
            VALUES('delete', old.rowid, old.raw_content, old.summary);
            INSERT INTO memories_fts(rowid, raw_content, summary)
            VALUES (new.rowid, new.raw_content, new.summary);
          END;
        `);
      } catch (error) {
        console.warn('FTS5 not available, skipping full-text search setup');
      }
    }
  }

  private createFTSIndexes(db: Database.Database): void {
    try {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
          entity_name,
          content='memory_entities',
          content_rowid='rowid'
        );
      `);
    } catch (error) {
      console.warn('FTS5 not available for entities');
    }
  }

  async initialize(): Promise<void> {
    this.metadata.status = 'connecting';
    try {
      const result = this.db.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number };
      this.metadata.status = 'connected';
      this.metadata.connectedAt = new Date().toISOString();
      this.initialized = true;
      this.emitEvent('provider.connected', {
        providerId: this.config.id,
        providerType: this.config.type,
        capabilities: this.getCapabilities(),
        memoryCount: result.count,
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
      const result = this.db.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number };
      const latencyMs = Date.now() - start;
      this.metadata.stats.operations++;
      this.metadata.stats.avgLatencyMs = 
        (this.metadata.stats.avgLatencyMs * (this.metadata.stats.operations - 1) + latencyMs) / 
        this.metadata.stats.operations;

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
    this.db.close();
    this.eventHandlers.clear();
  }

  async store(item: MemoryItem, _options?: MemoryStoreOptions): Promise<MemoryItem> {
    const start = Date.now();
    try {
      const insertStmt = this.db.prepare(`
        INSERT OR REPLACE INTO memories (
          id, type, owner, created_at, updated_at, confidence, source,
          importance, visibility, security, summary, raw_content,
          metadata_json, tags_json, archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `);

      insertStmt.run(
        item.id,
        item.type,
        item.owner,
        item.createdAt,
        item.updatedAt,
        item.confidence,
        item.source,
        item.importance,
        item.visibility,
        item.security,
        item.summary,
        item.rawContent,
        JSON.stringify(item.metadata),
        JSON.stringify(item.tags)
      );

      if (item.embedding) {
        const embeddingStmt = this.db.prepare(`
          INSERT OR REPLACE INTO memory_embeddings (
            id, memory_id, model, dimensions, vector_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);
        embeddingStmt.run(
          `${item.id}_embedding`,
          item.id,
          item.embedding.model,
          item.embedding.dimensions,
          JSON.stringify(item.embedding.vector),
          item.embedding.createdAt
        );
      }

      for (const entity of item.entities) {
        const entityStmt = this.db.prepare(`
          INSERT OR REPLACE INTO memory_entities (
            id, memory_id, entity_type, entity_name, properties_json, confidence, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        entityStmt.run(
          entity.id,
          item.id,
          entity.type,
          entity.name,
          JSON.stringify(entity.properties),
          entity.confidence,
          entity.createdAt || new Date().toISOString()
        );
      }

      for (const relationship of item.relationships) {
        const relStmt = this.db.prepare(`
          INSERT OR REPLACE INTO memory_relationships (
            id, memory_id, source_entity_id, target_entity_id, relationship_type,
            properties_json, confidence, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        relStmt.run(
          relationship.id,
          item.id,
          relationship.sourceEntityId,
          relationship.targetEntityId,
          relationship.type,
          JSON.stringify(relationship.properties),
          relationship.confidence,
          relationship.createdAt
        );
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
      const row = this.db.prepare('SELECT * FROM memories WHERE id = ? AND archived = 0').get(id) as MemoryRow | undefined;
      if (!row) return null;

      const embeddingRow = this.db.prepare('SELECT * FROM memory_embeddings WHERE memory_id = ?').get(`${id}_embedding`) as EmbeddingRow | undefined;
      const entityRows = this.db.prepare('SELECT * FROM memory_entities WHERE memory_id = ?').all(id) as EntityRow[];
      const relationshipRows = this.db.prepare('SELECT * FROM memory_relationships WHERE memory_id = ?').all(id) as RelationshipRow[];

      const item = this.rowToItem(row, embeddingRow, entityRows, relationshipRows);
      
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
      metadata: { ...existing.metadata, ...updates.metadata },
      tags: updates.tags ? [...new Set([...existing.tags, ...updates.tags])] : existing.tags,
    };

    await this.store(updated);

    this.emitEvent('memory.updated', { memoryId: id, changes: Object.keys(updates) });

    return updated;
  }

  async delete(id: string, permanent: boolean = false): Promise<boolean> {
    try {
      if (permanent) {
        this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
      } else {
        const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as MemoryRow | undefined;
        if (row) {
          const content = this.rowToItem(row, undefined, [], []);
          this.archiveInternal(id, content, 'Manual archive');
        }
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
      const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as MemoryRow | undefined;
      if (!row) throw new Error(`Memory item not found: ${id}`);

      const content = this.rowToItem(row, undefined, [], []);
      this.archiveInternal(id, content, options.reason);

      this.emitEvent('memory.archived', {
        memoryId: id,
        archiveLocation: options.archiveLocation || 'sqlite_archive',
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

  private archiveInternal(originalId: string, content: MemoryItem, reason: string): void {
    const archiveId = `archive_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO memory_archives (
          id, original_id, type, owner, archived_at, reason, content_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        archiveId,
        originalId,
        content.type,
        content.owner,
        new Date().toISOString(),
        reason,
        JSON.stringify(content)
      );

      this.db.prepare(`
        UPDATE memories SET archived = 1, archived_at = ? WHERE id = ?
      `).run(new Date().toISOString(), originalId);
    })();
  }

  async merge(sourceId: string, targetId: string, options: MemoryMergeOptions): Promise<MemoryItem> {
    const source = await this.retrieve(sourceId);
    const target = await this.retrieve(targetId);

    if (!source || !target) {
      throw new Error('One or both memory items not found');
    }

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
      let sql = 'SELECT * FROM memories WHERE archived = 0';
      const params: unknown[] = [];

      if (query.types && query.types.length > 0) {
        if (query.types.length === 1) {
          sql += ' AND type = ?';
          params.push(query.types[0]);
        } else {
          sql += ` AND type IN (${query.types.map(() => '?').join(',')})`;
          params.push(...query.types);
        }
      }

      if (query.owner) {
        sql += ' AND owner = ?';
        params.push(query.owner);
      }

      if (query.minImportance !== undefined) {
        sql += ' AND importance >= ?';
        params.push(query.minImportance);
      }

      if (query.minConfidence !== undefined) {
        sql += ' AND confidence >= ?';
        params.push(query.minConfidence);
      }

      if (query.dateRange) {
        sql += ' AND created_at >= ? AND created_at <= ?';
        params.push(query.dateRange.start, query.dateRange.end);
      }

      if (query.tags && query.tags.length > 0) {
        for (const tag of query.tags) {
          sql += ` AND json_extract(tags_json, '$[*]') LIKE ?`;
          params.push(`%${tag}%`);
        }
      }

      sql += ' ORDER BY importance DESC, created_at DESC';
      
      if (query.limit) {
        sql += ' LIMIT ?';
        params.push(query.limit);
      }

      if (query.offset) {
        sql += ' OFFSET ?';
        params.push(query.offset);
      }

      const rows = this.db.prepare(sql).all(...params) as MemoryRow[];
      
      const results: MemorySearchResult[] = [];
      for (const row of rows) {
        const embeddingRow = this.db.prepare('SELECT * FROM memory_embeddings WHERE memory_id = ?').get(`${row.id}_embedding`) as EmbeddingRow | undefined;
        const entityRows = this.db.prepare('SELECT * FROM memory_entities WHERE memory_id = ?').all(row.id) as EntityRow[];
        const relationshipRows = this.db.prepare('SELECT * FROM memory_relationships WHERE memory_id = ?').all(row.id) as RelationshipRow[];
        
        const item = this.rowToItem(row, embeddingRow, entityRows, relationshipRows);
        results.push({
          item,
          score: row.importance,
          matchType: query.query ? 'hybrid' : 'keyword',
        });
      }

      this.emitEvent('search.performed', {
        query,
        resultsCount: results.length,
        searchMode: 'hybrid',
        durationMs: Date.now() - start,
        provider: this.config.id,
      });

      return results;
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
    return this.search(query);
  }

  async summarize(ids: string[]): Promise<string> {
    const items: MemoryItem[] = [];
    for (const id of ids) {
      const item = await this.retrieve(id);
      if (item) items.push(item);
    }

    if (items.length === 0) return '';

    const combinedContent = items.map(item => item.rawContent).join('\n\n');
    return `Summary of ${items.length} items:\n\n${combinedContent.slice(0, 2000)}`;
  }

  async relate(sourceId: string, targetId: string, relationshipType: string, properties?: Record<string, unknown>): Promise<void> {
    const relationshipId = `rel_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    this.db.prepare(`
      INSERT INTO memory_relationships (
        id, memory_id, source_entity_id, target_entity_id, relationship_type,
        properties_json, confidence, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      relationshipId,
      sourceId,
      sourceId,
      targetId,
      relationshipType,
      JSON.stringify(properties || {}),
      0.9,
      new Date().toISOString()
    );

    this.emitEvent('relationship.created', {
      relationshipId,
      sourceEntityId: sourceId,
      targetEntityId: targetId,
      type: relationshipType,
      confidence: 0.9,
    });
  }

  async getStats(): Promise<MemoryStats> {
    const memoryCount = this.db.prepare('SELECT COUNT(*) as count FROM memories WHERE archived = 0').get() as { count: number };
    const embeddingCount = this.db.prepare('SELECT COUNT(*) as count FROM memory_embeddings').get() as { count: number };
    const entityCount = this.db.prepare('SELECT COUNT(*) as count FROM memory_entities').get() as { count: number };
    const relationshipCount = this.db.prepare('SELECT COUNT(*) as count FROM memory_relationships').get() as { count: number };
    
    const typeCounts = this.db.prepare('SELECT type, COUNT(*) as count FROM memories WHERE archived = 0 GROUP BY type').all() as Array<{ type: string; count: number }>;
    
    const itemsByType: Record<MemoryType, number> = {} as Record<MemoryType, number>;
    for (const row of typeCounts) {
      itemsByType[row.type as MemoryType] = row.count;
    }

    const sizeResult = this.db.prepare('SELECT SUM(LENGTH(raw_content) + LENGTH(summary) + LENGTH(metadata_json) + LENGTH(tags_json)) as size FROM memories').get() as { size: number | null } | undefined;
    const storageSizeBytes = sizeResult?.size ?? 0;

    return {
      totalItems: memoryCount.count,
      itemsByType,
      totalEmbeddings: embeddingCount.count,
      totalEntities: entityCount.count,
      totalRelationships: relationshipCount.count,
      storageSizeBytes,
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

  async createCheckpoint(checkpointType: string, data: Record<string, unknown>): Promise<string> {
    const checkpointId = `ckpt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    this.db.prepare(`
      INSERT INTO checkpoints (id, timestamp, checkpoint_type, content_json, metadata_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      checkpointId,
      new Date().toISOString(),
      checkpointType,
      JSON.stringify(data),
      JSON.stringify({ createdAt: new Date().toISOString() })
    );

    return checkpointId;
  }

  async restoreCheckpoint(checkpointId: string): Promise<Record<string, unknown> | null> {
    const row = this.db.prepare('SELECT content_json FROM checkpoints WHERE id = ?').get(checkpointId) as { content_json: string } | undefined;
    if (!row) return null;
    
    return JSON.parse(row.content_json);
  }

  async listCheckpoints(checkpointType?: string, limit: number = 100): Promise<Array<{ id: string; timestamp: string; type: string }>> {
    let sql = 'SELECT id, timestamp, checkpoint_type as type FROM checkpoints';
    const params: unknown[] = [];

    if (checkpointType) {
      sql += ' WHERE checkpoint_type = ?';
      params.push(checkpointType);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    return this.db.prepare(sql).all(...params) as Array<{ id: string; timestamp: string; type: string }>;
  }

  async pruneOldCheckpoints(keepCount: number = 10, checkpointType?: string): Promise<number> {
    let sql = `
      DELETE FROM checkpoints
      WHERE id NOT IN (
        SELECT id FROM checkpoints
    `;
    const params: unknown[] = [];

    if (checkpointType) {
      sql += ' WHERE checkpoint_type = ?';
      params.push(checkpointType);
    }

    sql += ` ORDER BY timestamp DESC LIMIT ?)`;
    params.push(keepCount);

    const result = this.db.prepare(sql).run(...params);
    return result.changes;
  }

  async compact(): Promise<number> {
    const archivedCount = this.db.prepare('SELECT COUNT(*) as count FROM memories WHERE archived = 1').get() as { count: number };
    
    this.db.exec('VACUUM');
    
    return archivedCount.count;
  }

  private rowToItem(row: MemoryRow, embeddingRow?: EmbeddingRow, entityRows?: EntityRow[], relationshipRows?: RelationshipRow[]): MemoryItem {
    return {
      id: row.id,
      type: row.type as MemoryType,
      owner: row.owner,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      confidence: row.confidence,
      source: row.source,
      embedding: embeddingRow ? {
        vector: JSON.parse(embeddingRow.vector_json),
        model: embeddingRow.model,
        dimensions: embeddingRow.dimensions,
        createdAt: embeddingRow.created_at,
      } : undefined,
      entities: entityRows?.map(r => ({
        id: r.id,
        type: r.entity_type,
        name: r.entity_name,
        properties: JSON.parse(r.properties_json),
        confidence: r.confidence,
        createdAt: r.created_at,
      })) || [],
      relationships: relationshipRows?.map(r => ({
        id: r.id,
        sourceEntityId: r.source_entity_id,
        targetEntityId: r.target_entity_id,
        type: r.relationship_type,
        properties: JSON.parse(r.properties_json),
        confidence: r.confidence,
        createdAt: r.created_at,
      })) || [],
      tags: JSON.parse(row.tags_json),
      importance: row.importance,
      visibility: row.visibility as 'private' | 'project' | 'organization' | 'public',
      security: row.security as 'unclassified' | 'internal' | 'confidential' | 'restricted',
      summary: row.summary,
      rawContent: row.raw_content,
      metadata: JSON.parse(row.metadata_json),
    };
  }

  private mergeItems(source: MemoryItem, target: MemoryItem, options: MemoryMergeOptions): MemoryItem {
    let mergedContent: string;
    switch (options.strategy) {
      case 'replace':
        mergedContent = source.rawContent;
        break;
      case 'append':
        mergedContent = target.rawContent + '\n\n---\n\n' + source.rawContent;
        break;
      case 'smart':
      case 'merge':
      default:
        mergedContent = target.rawContent + '\n\n---\n\n' + source.rawContent;
        break;
    }

    return {
      ...target,
      rawContent: mergedContent,
      entities: [...new Map([...target.entities, ...source.entities].map(e => [e.id, e])).values()],
      relationships: [...new Map([...target.relationships, ...source.relationships].map(r => [r.id, r])).values()],
      tags: [...new Set([...target.tags, ...source.tags])],
      importance: Math.max(target.importance, source.importance),
      confidence: (target.confidence + source.confidence) / 2,
      updatedAt: new Date().toISOString(),
    };
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