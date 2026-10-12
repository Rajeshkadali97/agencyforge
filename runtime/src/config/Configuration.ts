import { IConfiguration } from '../interfaces';

export type Environment = 'development' | 'production' | 'test';

export interface RuntimeConfig {
  environment: Environment;
  logging: {
    level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
    format: 'json' | 'pretty';
    output?: 'console' | 'file' | 'both';
    filePath?: string;
  };
  workflow: {
    defaultTimeoutMs: number;
    maxConcurrentWorkflows: number;
    maxRetries: number;
    retryBaseDelayMs: number;
    retryMaxDelayMs: number;
    retryBackoffMultiplier: number;
  };
  agents: {
    maxConcurrentAgents: number;
    defaultAgentTimeoutMs: number;
    healthCheckIntervalMs: number;
  };
  eventBus: {
    maxHistorySize: number;
    asyncDispatch: boolean;
  };
  state: {
    persistenceEnabled: boolean;
    persistenceIntervalMs: number;
    persistencePath?: string;
  };
  providers: {
    [key: string]: {
      enabled: boolean;
      apiKey?: string;
      baseUrl?: string;
      timeoutMs?: number;
      retries?: number;
    };
  };
  featureFlags: {
    [key: string]: boolean;
  };
  models: {
    defaultModel: string;
    fallbackModel?: string;
    maxTokens: number;
    temperature: number;
  };
  performance: {
    enableCaching: boolean;
    cacheTtlMs: number;
    enableMetrics: boolean;
    metricsIntervalMs: number;
  };
  secrets: {
    [key: string]: string;
  };
}

export const defaultConfig: RuntimeConfig = {
  environment: 'development',
  logging: {
    level: 'INFO',
    format: 'json',
  },
  workflow: {
    defaultTimeoutMs: 300000, // 5 minutes
    maxConcurrentWorkflows: 10,
    maxRetries: 3,
    retryBaseDelayMs: 1000,
    retryMaxDelayMs: 30000,
    retryBackoffMultiplier: 2,
  },
  agents: {
    maxConcurrentAgents: 20,
    defaultAgentTimeoutMs: 60000, // 1 minute
    healthCheckIntervalMs: 30000, // 30 seconds
  },
  eventBus: {
    maxHistorySize: 10000,
    asyncDispatch: true,
  },
  state: {
    persistenceEnabled: false,
    persistenceIntervalMs: 60000, // 1 minute
  },
  providers: {},
  featureFlags: {},
  models: {
    defaultModel: 'gpt-4',
    maxTokens: 4096,
    temperature: 0.7,
  },
  performance: {
    enableCaching: true,
    cacheTtlMs: 300000, // 5 minutes
    enableMetrics: false,
    metricsIntervalMs: 60000, // 1 minute
  },
  secrets: {},
};

export class Configuration implements IConfiguration {
  private config: RuntimeConfig;
  private listeners: Array<(config: RuntimeConfig) => void> = [];

  constructor(initialConfig: Partial<RuntimeConfig> = {}) {
    this.config = this.mergeConfig(defaultConfig, initialConfig);
  }

  get<T>(key: string, defaultValue?: T): T {
    const keys = key.split('.');
    let value: unknown = this.config;

    for (const k of keys) {
      if (typeof value === 'object' && value !== null && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        const envValue = process.env[key];
        if (envValue !== undefined) {
          if (typeof defaultValue === 'boolean') {
            return (envValue.toLowerCase() === 'true') as unknown as T;
          }
          if (typeof defaultValue === 'number') {
            return Number(envValue) as unknown as T;
          }
          return envValue as unknown as T;
        }
        return defaultValue as T;
      }
    }

    return value as T;
  }

  getAll(): Record<string, unknown> {
    return { ...this.config };
  }

  set(key: string, value: unknown): void {
    const keys = key.split('.');
    const lastKey = keys.pop()!;
    let obj: Record<string, unknown> = this.config as unknown as Record<string, unknown>;

    for (const k of keys) {
      if (!(k in obj) || typeof obj[k] !== 'object') {
        obj[k] = {};
      }
      obj = obj[k] as Record<string, unknown>;
    }

    obj[lastKey] = value;
    this.notifyListeners();
  }

  has(key: string): boolean {
    const keys = key.split('.');
    let value: unknown = this.config;

    for (const k of keys) {
      if (typeof value === 'object' && value !== null && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return false;
      }
    }

    return value !== undefined;
  }

  load(config: Record<string, unknown>): void {
    this.config = this.mergeConfig(this.config, config as Partial<RuntimeConfig>);
    this.notifyListeners();
  }

  subscribe(listener: (config: RuntimeConfig) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private mergeConfig(base: RuntimeConfig, override: Partial<RuntimeConfig>): RuntimeConfig {
    const result = { ...base };

    for (const key in override) {
      if (override.hasOwnProperty(key)) {
        const overrideValue = override[key as keyof Partial<RuntimeConfig>];
        const baseValue = base[key as keyof RuntimeConfig];

        if (
          typeof overrideValue === 'object' &&
          overrideValue !== null &&
          !Array.isArray(overrideValue) &&
          typeof baseValue === 'object' &&
          baseValue !== null &&
          !Array.isArray(baseValue)
        ) {
          result[key as keyof RuntimeConfig] = this.mergeConfig(
            baseValue as unknown as RuntimeConfig,
            overrideValue as Partial<RuntimeConfig>
          ) as never;
        } else {
          result[key as keyof RuntimeConfig] = overrideValue as never;
        }
      }
    }

    return result;
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.config));
  }
}

export function createConfig(initialConfig: Partial<RuntimeConfig> = {}): Configuration {
  return new Configuration(initialConfig);
}