import {
  ProviderConfig,
  ProviderMetadata,
  ProviderHealth,
  ProviderCapabilities,
  ProviderType,
  MemoryType,
  IMemoryProvider,
} from '../types';

export { IMemoryProvider } from '../types';

export interface IProviderFactory {
  createProvider(config: ProviderConfig): IMemoryProvider;
  getSupportedTypes(): ProviderType[];
  getDefaultCapabilities(type: ProviderType): ProviderCapabilities;
}

export interface IProviderRegistry {
  register(provider: IMemoryProvider): void;
  unregister(providerId: string): boolean;
  get(providerId: string): IMemoryProvider | undefined;
  list(): IMemoryProvider[];
  listByType(type: ProviderType): IMemoryProvider[];
  listByMemoryType(memoryType: MemoryType): IMemoryProvider[];
  getBestProvider(memoryType: MemoryType, operation: string): IMemoryProvider | undefined;
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