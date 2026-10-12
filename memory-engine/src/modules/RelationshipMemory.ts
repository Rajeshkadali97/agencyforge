import { MemoryItem, MemoryQuery, MemorySearchResult, MemoryType, MemoryStoreOptions, MemoryUpdateOptions } from '../types';
import { IMemoryEngine } from '../interfaces';
import { BaseMemoryModule } from './BaseMemoryModule';

export interface IRelationshipMemory {
  getRelationship(relationshipId: string): Promise<MemoryItem | null>;
  createRelationship(data: {
    sourceType: string;
    sourceId: string;
    targetType: string;
    targetId: string;
    relationshipType: string;
    properties?: Record<string, unknown>;
    confidence?: number;
  }): Promise<MemoryItem>;
  getRelationships(entityType: string, entityId: string, direction?: 'incoming' | 'outgoing' | 'both'): Promise<MemoryItem[]>;
  getRelatedEntities(entityType: string, entityId: string, relationshipType?: string): Promise<Array<{ entity: MemoryItem; relationship: MemoryItem }>>;
  deleteRelationship(relationshipId: string): Promise<boolean>;
  updateRelationship(relationshipId: string, updates: Record<string, unknown>): Promise<MemoryItem>;
}

export class RelationshipMemoryModule extends BaseMemoryModule implements IRelationshipMemory {
  readonly type: MemoryType = 'relationship';

  constructor(engine: IMemoryEngine) {
    super(engine);
  }

  async initialize(): Promise<void> {}

  async shutdown(): Promise<void> {}

  async health(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: Record<string, unknown> }> {
    return { status: 'healthy' };
  }

  async getRelationship(relationshipId: string): Promise<MemoryItem | null> {
    return this.retrieve(relationshipId);
  }

  async createRelationship(data: {
    sourceType: string;
    sourceId: string;
    targetType: string;
    targetId: string;
    relationshipType: string;
    properties?: Record<string, unknown>;
    confidence?: number;
  }): Promise<MemoryItem> {
    const item: MemoryItem = {
      id: `rel_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'relationship',
      owner: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confidence: data.confidence || 0.9,
      source: 'relationship_creation',
      entities: [],
      relationships: [],
      tags: ['relationship', data.sourceType, data.targetType, data.relationshipType],
      importance: 0.6,
      visibility: 'organization',
      security: 'internal',
      summary: `${data.sourceType}:${data.sourceId} --[${data.relationshipType}]--> ${data.targetType}:${data.targetId}`,
      rawContent: JSON.stringify(data, null, 2),
      metadata: { ...data.properties, relationship: true, sourceType: data.sourceType, targetType: data.targetType },
    };

    return this.store(item);
  }

  async getRelationships(entityType: string, entityId: string, direction: 'incoming' | 'outgoing' | 'both' = 'both'): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['relationship'],
      tags: [entityType, entityId],
    };
    const results = await this.search(query);

    return results.map(r => r.item).filter(item => {
      const metadata = item.metadata as Record<string, unknown>;
      if (direction === 'outgoing') {
        return metadata.sourceId === entityId && metadata.sourceType === entityType;
      }
      if (direction === 'incoming') {
        return metadata.targetId === entityId && metadata.targetType === entityType;
      }
      return (metadata.sourceId === entityId && metadata.sourceType === entityType) ||
             (metadata.targetId === entityId && metadata.targetType === entityType);
    });
  }

  async getRelatedEntities(entityType: string, entityId: string, relationshipType?: string): Promise<Array<{ entity: MemoryItem; relationship: MemoryItem }>> {
    const relationships = await this.getRelationships(entityType, entityId, 'both');
    const results: Array<{ entity: MemoryItem; relationship: MemoryItem }> = [];

    for (const rel of relationships) {
      const metadata = rel.metadata as Record<string, unknown>;
      const isOutgoing = metadata.sourceId === entityId && metadata.sourceType === entityType;
      const targetId = isOutgoing ? (metadata.targetId as string) : (metadata.sourceId as string);

      if (relationshipType && metadata.relationshipType !== relationshipType) {
        continue;
      }

      const entity = await this.retrieve(targetId);
      if (entity) {
        results.push({ entity, relationship: rel });
      }
    }

    return results;
  }

  async deleteRelationship(relationshipId: string): Promise<boolean> {
    return this.delete(relationshipId, true);
  }

  async updateRelationship(relationshipId: string, updates: Record<string, unknown>): Promise<MemoryItem> {
    return this.update(relationshipId, { metadata: updates, updatedAt: new Date().toISOString() });
  }
}