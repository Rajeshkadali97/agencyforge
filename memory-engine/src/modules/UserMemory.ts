import { MemoryItem, MemoryQuery, MemorySearchResult, MemoryType, MemoryStoreOptions, MemoryUpdateOptions } from '../types';
import { IMemoryEngine } from '../interfaces';
import { BaseMemoryModule } from './BaseMemoryModule';

export interface IUserMemory {
  getUserProfile(userId: string): Promise<MemoryItem | null>;
  createUserProfile(data: {
    name: string;
    email?: string;
    preferences?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem>;
  updateUserProfile(userId: string, updates: Record<string, unknown>): Promise<MemoryItem>;
  getUserPreferences(userId: string): Promise<Record<string, unknown>>;
  setUserPreference(userId: string, key: string, value: unknown): Promise<void>;
  getUserHistory(userId: string, limit?: number): Promise<MemoryItem[]>;
  getUserProjects(userId: string): Promise<MemoryItem[]>;
  getUserAgents(userId: string): Promise<MemoryItem[]>;
  getUserWorkflows(userId: string): Promise<MemoryItem[]>;
}

export class UserMemoryModule extends BaseMemoryModule implements IUserMemory {
  readonly type: MemoryType = 'user';

  constructor(engine: IMemoryEngine) {
    super(engine);
  }

  async initialize(): Promise<void> {}

  async shutdown(): Promise<void> {}

  async health(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: Record<string, unknown> }> {
    return { status: 'healthy' };
  }

  async getUserProfile(userId: string): Promise<MemoryItem | null> {
    return this.retrieve(userId);
  }

  async createUserProfile(data: {
    name: string;
    email?: string;
    preferences?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryItem> {
    const item: MemoryItem = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'user',
      owner: data.email || data.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
      source: 'user_registration',
      entities: [],
      relationships: [],
      tags: ['user', 'profile'],
      importance: 1.0,
      visibility: 'private',
      security: 'confidential',
      summary: `User: ${data.name}`,
      rawContent: JSON.stringify(data, null, 2),
      metadata: { ...data.metadata, userProfile: true, preferences: data.preferences || {} },
    };

    return this.store(item);
  }

  async updateUserProfile(userId: string, updates: Record<string, unknown>): Promise<MemoryItem> {
    return this.update(userId, { metadata: updates, updatedAt: new Date().toISOString() });
  }

  async getUserPreferences(userId: string): Promise<Record<string, unknown>> {
    const profile = await this.getUserProfile(userId);
    return (profile?.metadata.preferences as Record<string, unknown>) || {};
  }

  async setUserPreference(userId: string, key: string, value: unknown): Promise<void> {
    const profile = await this.getUserProfile(userId);
    if (!profile) throw new Error(`User not found: ${userId}`);

    const preferences = { ...(profile.metadata.preferences as Record<string, unknown>), [key]: value };
    await this.update(userId, { metadata: { ...profile.metadata, preferences } });
  }

  async getUserHistory(userId: string, limit: number = 50): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      owner: userId,
      limit,
    };
    const results = await this.search(query);
    return results
      .map(r => r.item)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getUserProjects(userId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['project'],
      tags: [userId],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async getUserAgents(userId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['agent'],
      tags: [userId],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }

  async getUserWorkflows(userId: string): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      types: ['workflow'],
      tags: [userId],
    };
    const results = await this.search(query);
    return results.map(r => r.item);
  }
}