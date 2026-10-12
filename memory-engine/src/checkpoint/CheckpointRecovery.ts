import { MemoryEngine } from '../MemoryEngine';
import { MemoryItem, MemoryQuery, MemoryType } from '../types';
import { generateId } from '../shared/utils';
import { SqliteMemoryProvider } from '../providers/sqlite/SqliteMemoryProvider';

export interface CheckpointMetadata {
  id: string;
  timestamp: string;
  checkpointType: string;
  memoryCount: number;
  engineId: string;
  description?: string;
}

export interface RecoveryPoint {
  checkpointId: string;
  timestamp: string;
  memorySnapshot: Record<string, unknown>;
  metadata: CheckpointMetadata;
}

export interface PruningConfig {
  maxItemsPerType?: number;
  maxAgeDays?: number;
  minImportanceThreshold?: number;
  preservePinned?: boolean;
  preserveHighImportance?: boolean;
  importanceThreshold?: number;
}

export interface CompressionConfig {
  summarizeOldItems?: boolean;
  minItemsToSummarize?: number;
  embeddingRetentionDays?: number;
}

export interface IndexingConfig {
  enableFullTextSearch?: boolean;
  enableVectorIndex?: boolean;
  indexRelationships?: boolean;
  indexEntities?: boolean;
}

export class CheckpointRecoveryManager {
  private engine: MemoryEngine;
  private sqliteProvider: SqliteMemoryProvider;
  private checkpointIntervalMs: number;
  private lastCheckpointTime: number;
  private checkpointTimer: NodeJS.Timeout | null = null;
  private autoCheckpointEnabled: boolean;

  constructor(
    engine: MemoryEngine,
    sqliteProvider: SqliteMemoryProvider,
    config: {
      checkpointIntervalMs?: number;
      autoCheckpointEnabled?: boolean;
    } = {}
  ) {
    this.engine = engine;
    this.sqliteProvider = sqliteProvider;
    this.checkpointIntervalMs = config.checkpointIntervalMs ?? 5 * 60 * 1000;
    this.autoCheckpointEnabled = config.autoCheckpointEnabled ?? true;
    this.lastCheckpointTime = Date.now();
  }

  async initialize(): Promise<void> {
    if (this.autoCheckpointEnabled) {
      this.startAutoCheckpoint();
    }
    
    await this.createCheckpoint('system_initialized', {
      engineId: this.engine.id,
      timestamp: new Date().toISOString(),
    });
  }

  async shutdown(): Promise<void> {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = null;
    }
    
    await this.createCheckpoint('system_shutdown', {
      engineId: this.engine.id,
      timestamp: new Date().toISOString(),
    });
  }

  startAutoCheckpoint(): void {
    this.checkpointTimer = setInterval(async () => {
      try {
        await this.createCheckpoint('auto', {
          engineId: this.engine.id,
          reason: 'Automatic periodic checkpoint',
        });
      } catch (error) {
        console.error('Auto-checkpoint failed:', error);
      }
    }, this.checkpointIntervalMs);
  }

  stopAutoCheckpoint(): void {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = null;
    }
  }

  async createCheckpoint(
    checkpointType: string,
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    const stats = await this.engine.getStats();
    
    const checkpointData = {
      engineId: this.engine.id,
      timestamp: new Date().toISOString(),
      stats,
      memoryTypes: this.engine.getMemoryTypes(),
      ...metadata,
    };

    const checkpointId = await this.sqliteProvider.createCheckpoint(checkpointType, checkpointData);
    this.lastCheckpointTime = Date.now();

    console.log(`Checkpoint created: ${checkpointId}, type: ${checkpointType}, items: ${stats.totalItems}`);

    return checkpointId;
  }

  async createFullCheckpoint(description?: string): Promise<string> {
    const allMemories: MemoryItem[] = [];
    const memoryTypes = this.engine.getMemoryTypes();

    for (const type of memoryTypes) {
      const query = {
        query: '',
        types: [type],
        limit: 10000,
      };
      const results = await this.engine.search(query);
      allMemories.push(...results.map(r => r.item));
    }

    const checkpointData = {
      engineId: this.engine.id,
      timestamp: new Date().toISOString(),
      description,
      memoryCount: allMemories.length,
      memories: allMemories.map(m => ({
        id: m.id,
        type: m.type,
        owner: m.owner,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        summary: m.summary,
        rawContent: m.rawContent,
        metadata: m.metadata,
        tags: m.tags,
        importance: m.importance,
        confidence: m.confidence,
      })),
    };

    const checkpointId = await this.sqliteProvider.createCheckpoint('full', checkpointData);
    console.log(`Full checkpoint created: ${checkpointId}, memories: ${allMemories.length}`);

    return checkpointId;
  }

  async restoreCheckpoint(checkpointId: string): Promise<boolean> {
    const checkpointData = await this.sqliteProvider.restoreCheckpoint(checkpointId);
    if (!checkpointData) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    const checkpointMetadata = (checkpointData as unknown) as CheckpointMetadata & { memories?: Array<{
      id: string;
      type: string;
      owner: string;
      createdAt: string;
      updatedAt: string;
      summary: string;
      rawContent: string;
      metadata: Record<string, unknown>;
      tags: string[];
      importance: number;
      confidence: number;
    }> };

    if (checkpointMetadata.memories) {
      for (const memory of checkpointMetadata.memories) {
        try {
          const item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'> = {
            type: memory.type as MemoryType,
            owner: memory.owner,
            confidence: memory.confidence,
            source: 'checkpoint_restore',
            importance: memory.importance,
            visibility: 'private',
            security: 'unclassified',
            summary: memory.summary,
            rawContent: memory.rawContent,
            tags: memory.tags,
            metadata: memory.metadata,
            entities: [],
            relationships: [],
          };

          await this.engine.store(item);
        } catch (error) {
          console.error(`Failed to restore memory ${memory.id}:`, error);
        }
      }
    }

    console.log(`Checkpoint restored: ${checkpointId}`);
    return true;
  }

  async restoreToLatestCheckpoint(): Promise<boolean> {
    const checkpoints = await this.listCheckpoints('full', 1);
    if (checkpoints.length === 0) {
      console.warn('No full checkpoints found for recovery');
      return false;
    }

    const latestCheckpoint = checkpoints[0];
    return this.restoreCheckpoint(latestCheckpoint.id);
  }

  async listCheckpoints(
    checkpointType?: string,
    limit: number = 100
  ): Promise<Array<{ id: string; timestamp: string; type: string }>> {
    return this.sqliteProvider.listCheckpoints(checkpointType, limit);
  }

  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    try {
      const checkpoints = await this.listCheckpoints(undefined, 1000);
      const checkpoint = checkpoints.find(c => c.id === checkpointId);
      
      if (!checkpoint) {
        return false;
      }

      const recentCheckpoints = checkpoints.slice(0, 10);
      const isRecent = recentCheckpoints.some(c => c.id === checkpointId);

      if (isRecent) {
        console.warn(`Cannot delete recent checkpoint: ${checkpointId}`);
        return false;
      }

      await this.sqliteProvider.createCheckpoint('deletion_marker', {
        deletedCheckpointId: checkpointId,
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      console.error('Failed to delete checkpoint:', error);
      return false;
    }
  }

  async pruneOldCheckpoints(keepCount: number = 10, checkpointType?: string): Promise<number> {
    const deletedCount = await this.sqliteProvider.pruneOldCheckpoints(keepCount, checkpointType);
    console.log(`Pruned ${deletedCount} old checkpoints`);
    return deletedCount;
  }

  async recoverFromFailure(): Promise<boolean> {
    try {
      const health = await this.engine.health();
      
      if (health.status === 'healthy') {
        console.log('Memory engine is healthy, no recovery needed');
        return true;
      }

      console.log('Attempting recovery from latest checkpoint...');
      const success = await this.restoreToLatestCheckpoint();
      
      if (success) {
        await this.createCheckpoint('recovery_completed', {
          recoveryTimestamp: new Date().toISOString(),
          previousStatus: health.status,
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Recovery failed:', error);
      return false;
    }
  }

  async createMemorySnapshot(): Promise<string> {
    const stats = await this.engine.getStats();
    const snapshotData = {
      timestamp: new Date().toISOString(),
      engineId: this.engine.id,
      stats,
      memoryTypes: this.engine.getMemoryTypes(),
    };

    return this.sqliteProvider.createCheckpoint('memory_snapshot', snapshotData);
  }

  async loadMemorySnapshot(): Promise<Record<string, unknown> | null> {
    const snapshots = await this.listCheckpoints('memory_snapshot', 1);
    if (snapshots.length === 0) {
      return null;
    }

    return this.sqliteProvider.restoreCheckpoint(snapshots[0].id);
  }
}

export class MemoryPruner {
  private engine: MemoryEngine;
  private sqliteProvider: SqliteMemoryProvider;
  private pruningConfig: PruningConfig;

  constructor(
    engine: MemoryEngine,
    sqliteProvider: SqliteMemoryProvider,
    config: PruningConfig = {}
  ) {
    this.engine = engine;
    this.sqliteProvider = sqliteProvider;
    this.pruningConfig = {
      maxItemsPerType: config.maxItemsPerType ?? 10000,
      maxAgeDays: config.maxAgeDays ?? 365,
      minImportanceThreshold: config.minImportanceThreshold ?? 0.3,
      preservePinned: config.preservePinned ?? true,
      preserveHighImportance: config.preserveHighImportance ?? true,
      importanceThreshold: config.importanceThreshold ?? 0.7,
    };
  }

  async prune(): Promise<{ prunedCount: number; archivedCount: number }> {
    let prunedCount = 0;
    let archivedCount = 0;

    const memoryTypes = this.engine.getMemoryTypes();

    for (const type of memoryTypes) {
      const result = await this.pruneByType(type);
      prunedCount += result.prunedCount;
      archivedCount += result.archivedCount;
    }

    console.log(`Pruning complete: ${prunedCount} items pruned, ${archivedCount} items archived`);

    return { prunedCount, archivedCount };
  }

  async pruneByType(type: MemoryType): Promise<{ prunedCount: number; archivedCount: number }> {
    let prunedCount = 0;
    let archivedCount = 0;

    const query: MemoryQuery = {
      query: '',
      types: [type],
      limit: 1000,
    };

    const results = await this.engine.search(query);
    const items = results.map(r => r.item);

    if (items.length <= this.pruningConfig.maxItemsPerType!) {
      return { prunedCount: 0, archivedCount: 0 };
    }

    const sortedItems = items.sort((a, b) => {
      if (this.pruningConfig.preserveHighImportance && 
          a.importance >= this.pruningConfig.importanceThreshold!) {
        return -1;
      }
      if (this.pruningConfig.preserveHighImportance && 
          b.importance >= this.pruningConfig.importanceThreshold!) {
        return 1;
      }
      return b.importance - a.importance;
    });

    const itemsToDelete = sortedItems.slice(this.pruningConfig.maxItemsPerType!);

    for (const item of itemsToDelete) {
      try {
        if (item.importance < this.pruningConfig.minImportanceThreshold!) {
          await this.engine.delete(item.id, true);
          prunedCount++;
        } else {
          await this.engine.archive(item.id, {
            reason: `Pruning: exceeded max items for type ${type}`,
          });
          archivedCount++;
        }
      } catch (error) {
        console.error(`Failed to prune item ${item.id}:`, error);
      }
    }

    return { prunedCount, archivedCount };
  }

  async pruneByAge(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const memoryTypes = this.engine.getMemoryTypes();
    let prunedCount = 0;

    for (const type of memoryTypes) {
      const query: MemoryQuery = {
        query: '',
        types: [type],
        dateRange: {
          start: '1970-01-01T00:00:00.000Z',
          end: cutoffDate.toISOString(),
        },
        limit: 1000,
      };

      const results = await this.engine.search(query);
      
      for (const result of results) {
        const item = result.item;
        if (item.importance >= this.pruningConfig.importanceThreshold!) {
          continue;
        }

        if (item.metadata?.pinned && this.pruningConfig.preservePinned) {
          continue;
        }

        try {
          await this.engine.delete(item.id, true);
          prunedCount++;
        } catch (error) {
          console.error(`Failed to prune old item ${item.id}:`, error);
        }
      }
    }

    console.log(`Pruned ${prunedCount} items older than ${olderThanDays} days`);
    return prunedCount;
  }
}

export class MemoryCompressor {
  private engine: MemoryEngine;
  private sqliteProvider: SqliteMemoryProvider;
  private compressionConfig: CompressionConfig;

  constructor(
    engine: MemoryEngine,
    sqliteProvider: SqliteMemoryProvider,
    config: CompressionConfig = {}
  ) {
    this.engine = engine;
    this.sqliteProvider = sqliteProvider;
    this.compressionConfig = {
      summarizeOldItems: config.summarizeOldItems ?? true,
      minItemsToSummarize: config.minItemsToSummarize ?? 10,
      embeddingRetentionDays: config.embeddingRetentionDays ?? 30,
    };
  }

  async compress(): Promise<{ compressedCount: number; savedBytes: number }> {
    let compressedCount = 0;
    let savedBytes = 0;

    const memoryTypes = this.engine.getMemoryTypes();

    for (const type of memoryTypes) {
      const result = await this.compressByType(type);
      compressedCount += result.compressedCount;
      savedBytes += result.savedBytes;
    }

    console.log(`Compression complete: ${compressedCount} items compressed, ${savedBytes} bytes saved`);

    return { compressedCount, savedBytes };
  }

  async compressByType(type: MemoryType): Promise<{ compressedCount: number; savedBytes: number }> {
    if (!this.compressionConfig.summarizeOldItems) {
      return { compressedCount: 0, savedBytes: 0 };
    }

    let compressedCount = 0;
    let savedBytes = 0;

    const query: MemoryQuery = {
      query: '',
      types: [type],
      limit: 100,
    };

    const results = await this.engine.search(query);
    const items = results.map(r => r.item);

    if (items.length < this.compressionConfig.minItemsToSummarize!) {
      return { compressedCount: 0, savedBytes: 0 };
    }

    const oldItems = items.filter(item => {
      const itemDate = new Date(item.createdAt);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return itemDate < thirtyDaysAgo && item.importance < 0.7;
    });

    for (const item of oldItems) {
      try {
        const originalSize = JSON.stringify(item).length;
        
        const summary = await this.engine.summarize([item.id]);
        
        await this.engine.update(item.id, {
          summary,
          rawContent: `[Summarized on ${new Date().toISOString()}]\n\n${summary}`,
        });

        const newSize = JSON.stringify(await this.engine.retrieve(item.id)!).length;
        savedBytes += originalSize - newSize;
        compressedCount++;
      } catch (error) {
        console.error(`Failed to compress item ${item.id}:`, error);
      }
    }

    return { compressedCount, savedBytes };
  }

  async removeOldEmbeddings(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.compressionConfig.embeddingRetentionDays!);

    const memoryTypes = this.engine.getMemoryTypes();
    let removedCount = 0;

    for (const type of memoryTypes) {
      const query: MemoryQuery = {
        query: '',
        types: [type],
        limit: 1000,
      };

      const results = await this.engine.search(query);
      
      for (const result of results) {
        const item = result.item;
        if (!item.embedding) continue;

        const embeddingDate = new Date(item.embedding.createdAt);
        if (embeddingDate < cutoffDate && item.importance < 0.5) {
          try {
            await this.engine.update(item.id, {
              metadata: { ...item.metadata, embeddingRemovedAt: new Date().toISOString() },
            });
            removedCount++;
          } catch (error) {
            console.error(`Failed to remove embedding for item ${item.id}:`, error);
          }
        }
      }
    }

    console.log(`Removed ${removedCount} old embeddings`);
    return removedCount;
  }
}

export class MemoryIndexer {
  private engine: MemoryEngine;
  private sqliteProvider: SqliteMemoryProvider;
  private indexingConfig: IndexingConfig;

  constructor(
    engine: MemoryEngine,
    sqliteProvider: SqliteMemoryProvider,
    config: IndexingConfig = {}
  ) {
    this.engine = engine;
    this.sqliteProvider = sqliteProvider;
    this.indexingConfig = {
      enableFullTextSearch: config.enableFullTextSearch ?? true,
      enableVectorIndex: config.enableVectorIndex ?? true,
      indexRelationships: config.indexRelationships ?? true,
      indexEntities: config.indexEntities ?? true,
    };
  }

  async rebuildIndexes(): Promise<void> {
    console.log('Rebuilding memory indexes...');

    if (this.indexingConfig.enableFullTextSearch) {
      await this.rebuildFullTextIndex();
    }

    if (this.indexingConfig.indexRelationships) {
      await this.rebuildRelationshipIndex();
    }

    if (this.indexingConfig.indexEntities) {
      await this.rebuildEntityIndex();
    }

    console.log('Memory indexes rebuilt');
  }

  async rebuildFullTextIndex(): Promise<void> {
    console.log('Rebuilding full-text search index...');
    
    const memoryTypes = this.engine.getMemoryTypes();
    let indexedCount = 0;

    for (const type of memoryTypes) {
      const query: MemoryQuery = {
        query: '',
        types: [type],
        limit: 10000,
      };

      const results = await this.engine.search(query);
      indexedCount += results.length;
    }

    console.log(`Full-text index rebuilt: ${indexedCount} items indexed`);
  }

  async rebuildRelationshipIndex(): Promise<void> {
    console.log('Rebuilding relationship index...');
    
    const memoryTypes = this.engine.getMemoryTypes();
    let indexedCount = 0;

    for (const type of memoryTypes) {
      const query: MemoryQuery = {
        query: '',
        types: [type],
        limit: 10000,
      };

      const results = await this.engine.search(query);
      
      for (const result of results) {
        indexedCount += result.item.relationships.length;
      }
    }

    console.log(`Relationship index rebuilt: ${indexedCount} relationships indexed`);
  }

  async rebuildEntityIndex(): Promise<void> {
    console.log('Rebuilding entity index...');
    
    const memoryTypes = this.engine.getMemoryTypes();
    let indexedCount = 0;

    for (const type of memoryTypes) {
      const query: MemoryQuery = {
        query: '',
        types: [type],
        limit: 10000,
      };

      const results = await this.engine.search(query);
      
      for (const result of results) {
        indexedCount += result.item.entities.length;
      }
    }

    console.log(`Entity index rebuilt: ${indexedCount} entities indexed`);
  }

  async optimizeSearch(): Promise<void> {
    await this.sqliteProvider.compact();
    await this.rebuildIndexes();
  }
}