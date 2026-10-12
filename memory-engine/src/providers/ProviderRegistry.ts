import { ProviderConfig, ProviderMetadata, ProviderHealth, ProviderCapabilities, ProviderType, MemoryType, MemoryItem, MemoryQuery, MemorySearchResult, MemoryStoreOptions, MemoryUpdateOptions, MemoryArchiveOptions, MemoryMergeOptions, MemoryStats, MemoryEventType } from '../types';
import { IMemoryProvider } from '../interfaces';

export interface IProviderRegistry {
  register(provider: IMemoryProvider): void;
  unregister(providerId: string): boolean;
  get(providerId: string): IMemoryProvider | undefined;
  list(): IMemoryProvider[];
  listByType(type: ProviderType): IMemoryProvider[];
  listByMemoryType(memoryType: MemoryType): IMemoryProvider[];
  getBestProvider(memoryType: MemoryType, operation: string): IMemoryProvider | undefined;
}

export class ProviderRegistry implements IProviderRegistry {
  private providers: Map<string, IMemoryProvider> = new Map();

  register(provider: IMemoryProvider): void {
    this.providers.set(provider.metadata.id, provider);
  }

  unregister(providerId: string): boolean {
    return this.providers.delete(providerId);
  }

  get(providerId: string): IMemoryProvider | undefined {
    return this.providers.get(providerId);
  }

  list(): IMemoryProvider[] {
    return Array.from(this.providers.values());
  }

  listByType(type: ProviderType): IMemoryProvider[] {
    return this.list().filter(p => p.config.type === type);
  }

  listByMemoryType(memoryType: MemoryType): IMemoryProvider[] {
    return this.list().filter(p => p.config.memoryTypes.includes(memoryType));
  }

  getBestProvider(memoryType: MemoryType, _operation: string): IMemoryProvider | undefined {
    const candidates = this.listByMemoryType(memoryType);
    if (candidates.length === 0) return undefined;

    // Sort by priority (higher first) and health
    return candidates
      .filter(p => p.metadata.status === 'connected')
      .sort((a, b) => b.config.priority - a.config.priority)[0];
  }
}

export interface IProviderFactory {
  createProvider(config: ProviderConfig): Promise<IMemoryProvider>;
  getSupportedTypes(): ProviderType[];
  getDefaultCapabilities(type: ProviderType): ProviderCapabilities;
}

export class ProviderFactory implements IProviderFactory {
  getSupportedTypes(): ProviderType[] {
    return ['cognee', 'neo4j', 'qdrant', 'sqlite', 'redis', 'filesystem', 'memory'];
  }

  getDefaultCapabilities(type: ProviderType): ProviderCapabilities {
    const base: ProviderCapabilities = {
      vectorSearch: false,
      keywordSearch: false,
      graphSearch: false,
      hybridSearch: false,
      timelineSearch: false,
      entitySearch: false,
      semanticSearch: false,
      embeddings: false,
      knowledgeGraph: false,
      factExtraction: false,
      summarization: false,
      classification: false,
      relationships: false,
      transactions: false,
      replication: false,
      encryption: false,
      compression: false,
    };

    switch (type) {
      case 'cognee':
        return {
          ...base,
          vectorSearch: true,
          keywordSearch: true,
          graphSearch: true,
          hybridSearch: true,
          semanticSearch: true,
          embeddings: true,
          knowledgeGraph: true,
          factExtraction: true,
          summarization: true,
          classification: true,
          relationships: true,
          encryption: true,
        };
      case 'neo4j':
        return {
          ...base,
          graphSearch: true,
          knowledgeGraph: true,
          relationships: true,
          transactions: true,
        };
      case 'qdrant':
        return {
          ...base,
          vectorSearch: true,
          keywordSearch: true,
          hybridSearch: true,
          semanticSearch: true,
          embeddings: true,
        };
      case 'sqlite':
        return {
          ...base,
          keywordSearch: true,
          transactions: true,
        };
      case 'redis':
        return {
          ...base,
          keywordSearch: true,
          replication: true,
        };
      case 'filesystem':
        return {
          ...base,
          keywordSearch: true,
        };
      case 'memory':
        return {
          ...base,
          vectorSearch: true,
          keywordSearch: true,
        };
      default:
        return base;
    }
  }

  async createProvider(config: ProviderConfig): Promise<IMemoryProvider> {
    switch (config.type) {
      case 'cognee':
        const { CogneeMemoryProvider } = await import('./cognee/CogneeMemoryProvider');
        return new CogneeMemoryProvider(config);
      default:
        throw new Error(`Provider type not implemented: ${config.type}`);
    }
  }
}

export interface IProviderManager {
  readonly registry: IProviderRegistry;

  initializeProvider(config: ProviderConfig): Promise<IMemoryProvider>;
  shutdownProvider(providerId: string): Promise<void>;
  healthCheck(providerId: string): Promise<ProviderHealth>;
  healthCheckAll(): Promise<Record<string, ProviderHealth>>;
  routeOperation(memoryType: MemoryType, operation: string): IMemoryProvider | undefined;
  getProviderCapabilities(providerId: string): ProviderCapabilities | undefined;
}