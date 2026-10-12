import type { Provider } from "../interfaces/provider.js";

export class ProviderRegistry<TProvider extends Provider> {
  private readonly providers = new Map<string, TProvider>();

  register(provider: TProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider already registered: ${provider.id}`);
    }

    this.providers.set(provider.id, provider);
  }

  get(providerId: string): TProvider | undefined {
    return this.providers.get(providerId);
  }

  list(): readonly TProvider[] {
    return Array.from(this.providers.values());
  }

  require(providerId: string): TProvider {
    const provider = this.get(providerId);

    if (!provider) {
      throw new Error(`Provider not registered: ${providerId}`);
    }

    return provider;
  }
}
