import { MemoryItem, MemoryQuery, MemorySearchResult, MemoryType, MemoryStoreOptions, MemoryUpdateOptions } from '../types';
import { IMemoryEngine } from '../interfaces';
import { BaseMemoryModule } from './BaseMemoryModule';

export interface IEpisodicMemory {
  getTimeline(owner: string, dateRange: { start: string; end: string }): Promise<MemoryItem[]>;
  getEpisode(episodeId: string): Promise<MemoryItem | null>;
  linkEpisodes(sourceId: string, targetId: string, relationship: string): Promise<void>;
  getRelatedEpisodes(episodeId: string): Promise<MemoryItem[]>;
}

export class EpisodicMemoryModule extends BaseMemoryModule implements IEpisodicMemory {
  readonly type: MemoryType = 'episodic';

  constructor(engine: IMemoryEngine) {
    super(engine);
  }

  async initialize(): Promise<void> {}

  async shutdown(): Promise<void> {}

  async health(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: Record<string, unknown> }> {
    return { status: 'healthy' };
  }

  async getTimeline(owner: string, dateRange: { start: string; end: string }): Promise<MemoryItem[]> {
    const query: MemoryQuery = {
      query: '',
      owner,
      types: ['episodic', 'conversation'],
      dateRange,
    };
    const results = await this.search(query);
    return results
      .map(r => r.item)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async getEpisode(episodeId: string): Promise<MemoryItem | null> {
    return this.retrieve(episodeId);
  }

  async linkEpisodes(sourceId: string, targetId: string, relationship: string): Promise<void> {
    await this.engine.relate(sourceId, targetId, relationship);
  }

  async getRelatedEpisodes(episodeId: string): Promise<MemoryItem[]> {
    const item = await this.retrieve(episodeId);
    if (!item) return [];

    const relatedIds = item.relationships.map(r => r.targetEntityId);
    const episodes: MemoryItem[] = [];

    for (const id of relatedIds) {
      const episode = await this.retrieve(id);
      if (episode && episode.type === 'episodic') {
        episodes.push(episode);
      }
    }

    return episodes;
  }
}