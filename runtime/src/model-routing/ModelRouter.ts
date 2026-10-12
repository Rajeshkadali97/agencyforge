import { ILogger } from '../interfaces';
import { Configuration } from '../config';

export interface ProviderConfig {
  name: string;
  priority: number; // lower number = higher priority
  models: string[]; // list of model identifiers supported by this provider
  enabled?: boolean;
}

/**
 * Simple model routing implementation.
 * Reads provider configurations from RuntimeConfig (under `providers` key) and selects the best provider
 * that supports the requested model based on priority.
 */
export class ModelRouter {
  private providers: ProviderConfig[] = [];
  private logger: ILogger;

  constructor(logger: ILogger, config: Configuration) {
    this.logger = logger;
    this.loadProviders(config);
  }

  private loadProviders(config: Configuration): void {
    const raw = config.get('providers') as Record<string, any>;
    if (raw) {
      for (const key of Object.keys(raw)) {
        const p = raw[key];
        if (p && typeof p.enabled !== 'undefined' && !p.enabled) continue;
        const cfg: ProviderConfig = {
          name: key,
          priority: p.priority ?? 100,
          models: p.models ?? [],
          enabled: p.enabled ?? true,
        };
        this.providers.push(cfg);
      }
    }
    // sort by priority (ascending)
    this.providers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Returns the provider name that should be used for the given model.
   * Throws if no provider matches.
   */
  getProviderForModel(modelId: string): string {
    for (const provider of this.providers) {
      if (provider.models.includes(modelId) && provider.enabled) {
        this.logger.debug('ModelRouter: selected provider', { modelId, provider: provider.name });
        return provider.name;
      }
    }
    throw new Error(`No provider configured for model ${modelId}`);
  }
}
