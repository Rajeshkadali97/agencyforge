import { CharacterAssetVariant, CharacterRenderPlan } from "./types";

type CacheRecord = {
  asset: CharacterAssetVariant;
  status: "pending" | "loaded" | "failed";
  promise?: Promise<CharacterAssetVariant>;
};

export class CharacterAssetLoader {
  private readonly cache = new Map<string, CacheRecord>();

  getCacheKey(asset: CharacterAssetVariant): string {
    return `${asset.renderer ?? "png"}:${asset.image}`;
  }

  preload(plan: CharacterRenderPlan): Promise<CharacterAssetVariant[]> {
    return Promise.all([this.load(plan.asset), ...plan.preloadKeys.map((key) => this.loadByKey(key))]);
  }

  load(asset: CharacterAssetVariant): Promise<CharacterAssetVariant> {
    const key = this.getCacheKey(asset);
    const cached = this.cache.get(key);

    if (cached?.status === "loaded") {
      return Promise.resolve(cached.asset);
    }

    if (cached?.promise) {
      return cached.promise;
    }

    const promise = this.decodeImage(asset)
      .then(() => {
        this.cache.set(key, { asset, status: "loaded" });
        return asset;
      })
      .catch((error) => {
        this.cache.set(key, { asset, status: "failed" });
        throw error;
      });

    this.cache.set(key, { asset, status: "pending", promise });
    return promise;
  }

  has(asset: CharacterAssetVariant): boolean {
    return this.cache.get(this.getCacheKey(asset))?.status === "loaded";
  }

  clear(): void {
    this.cache.clear();
  }

  private loadByKey(key: string): Promise<CharacterAssetVariant> {
    const cached = this.cache.get(key);

    if (cached?.promise) {
      return cached.promise;
    }

    if (cached?.status === "loaded") {
      return Promise.resolve(cached.asset);
    }

    return Promise.resolve({ image: key, renderer: "png", source: "placeholder" });
  }

  private decodeImage(asset: CharacterAssetVariant): Promise<void> {
    if (typeof Image === "undefined") {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Failed to decode character asset: ${asset.image}`));
      image.src = asset.image;
    });
  }
}

