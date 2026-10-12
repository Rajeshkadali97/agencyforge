import { PluginManifest, PluginInstance, PluginConfig } from './types';

export class PluginRegistry {
  private manifests = new Map<string, PluginManifest>();
  private instances = new Map<string, PluginInstance>();

  register(manifest: PluginManifest): void {
    this.manifests.set(manifest.id, manifest);
  }

  activate(id: string, config: PluginConfig): PluginInstance {
    const manifest = this.manifests.get(id);
    if (!manifest) throw new Error(`Plugin not registered: ${id}`);
    const instance = manifest.create(config);
    this.instances.set(id, instance);
    return instance;
  }

  get(id: string): PluginInstance | undefined {
    return this.instances.get(id);
  }

  getManifest(id: string): PluginManifest | undefined {
    return this.manifests.get(id);
  }

  getByCapability(capability: string): PluginInstance[] {
    return Array.from(this.instances.values()).filter(
      (p) => p.capabilities.includes(capability) && p.isConfigured()
    );
  }

  listManifests(): PluginManifest[] {
    return Array.from(this.manifests.values());
  }

  listInstances(): PluginInstance[] {
    return Array.from(this.instances.values());
  }

  async deactivate(id: string): Promise<void> {
    const instance = this.instances.get(id);
    if (instance?.dispose) await instance.dispose();
    this.instances.delete(id);
  }

  async disposeAll(): Promise<void> {
    for (const [id] of this.instances) {
      await this.deactivate(id);
    }
  }
}

let globalRegistry: PluginRegistry | null = null;

export function getPluginRegistry(): PluginRegistry {
  if (!globalRegistry) globalRegistry = new PluginRegistry();
  return globalRegistry;
}
