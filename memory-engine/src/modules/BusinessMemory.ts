import { MemoryItem, MemoryQuery, MemorySearchResult, MemoryType, MemoryStoreOptions, MemoryUpdateOptions } from '../types';
import { IMemoryEngine } from '../interfaces';
import { BaseMemoryModule } from './BaseMemoryModule';

export interface IBusinessMemory {
  getBusinessProfile(businessId: string): Promise<MemoryItem | null>;
  createBusinessProfile(data: {
    name: string;
    website?: string;
    industry?: string;
    size?: string;
    location?: string;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  updateBusinessProfile(businessId: string, updates: Record<string, unknown>): Promise<MemoryItem>;
  getBusinessContacts(businessId: string): Promise<MemoryItem[]>;
  getBusinessProjects(businessId: string): Promise<MemoryItem[]>;
  getBusinessProposals(businessId: string): Promise<MemoryItem[]>;
  getBusinessCommunications(businessId: string): Promise<MemoryItem[]>;
  getBusinessTechnology(businessId: string): Promise<MemoryItem[]>;
  getBusinessSEO(businessId: string): Promise<MemoryItem[]>;
  linkBusinessToProject(businessId: string, projectId: string): Promise<void>;
  linkBusinessToUser(businessId: string, userId: string, role: string): Promise<void>;
}

export class BusinessMemoryModule extends BaseMemoryModule implements IBusinessMemory {
  readonly type: MemoryType = 'business';

  constructor(engine: IMemoryEngine) {
    super(engine);
  }

  async initialize(): Promise<void> {}

  async shutdown(): Promise<void> {}

  async health(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: Record<string, unknown> }> {
    return { status: 'healthy' };
  }

  async getBusinessProfile(businessId: string): Promise<MemoryItem | null> {
    return this.retrieve(businessId);
  }

  async createBusinessProfile(data: {
    name: string;
    website?: string;
    industry?: string;
    size?: string;
    location?: string;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem> {
    const item: MemoryItem = {
      id: `business_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'business',
      owner: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
      source: 'business_discovery',
      entities: [],
      relationships: [],
      tags: ['business', data.industry || 'unknown'].filter(Boolean),
      importance: 0.8,
      visibility: 'organization',
      security: 'internal',
      summary: `${data.name} - ${data.industry || 'Business'}`,
      rawContent: JSON.stringify(data, null, 2),
      metadata: { ...data.metadata, businessProfile: true },
    };

    return this.store(item);
  }

  async updateBusinessProfile(businessId: string, updates: Record<string, unknown>): Promise<MemoryItem> {
    return this.update(businessId, { metadata: updates, updatedAt: new Date().toISOString() });
  }

  async getBusinessContacts(businessId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['knowledge', 'document'],
      tags: ['contact', businessId],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async getBusinessProjects(businessId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['project'],
      tags: [businessId],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async getBusinessProposals(businessId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['document'],
      tags: ['proposal', businessId],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async getBusinessCommunications(businessId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['conversation', 'document'],
      tags: ['communication', businessId],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async getBusinessTechnology(businessId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['knowledge'],
      tags: ['technology', 'tech-stack', businessId],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async getBusinessSEO(businessId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['knowledge', 'document'],
      tags: ['seo', businessId],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async linkBusinessToProject(businessId: string, projectId: string): Promise<void> {
    await this.engine.relate(businessId, projectId, 'has_project');
  }

  async linkBusinessToUser(businessId: string, userId: string, role: string): Promise<void> {
    await this.engine.relate(businessId, userId, 'has_contact', { role });
  }
}