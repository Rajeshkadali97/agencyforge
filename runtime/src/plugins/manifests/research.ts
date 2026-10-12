import { PluginManifest, PluginInstance, PluginConfig } from '../types';

interface ResearchPluginConfig extends PluginConfig {
  depth?: 'basic' | 'standard' | 'deep';
}

class ResearchPluginInstance implements PluginInstance {
  readonly pluginId = 'research';
  readonly capabilities = ['research.company', 'research.website', 'research.competitors'];
  // Lazily initialized to avoid top-level import failure if @agencyforge/research is missing
  private engine: { research(req: unknown): Promise<unknown> } | null = null;

  constructor(_config: ResearchPluginConfig) {
    this.initEngine().catch(() => { /* stays null — bridge handles gracefully */ });
  }

  private async initEngine(): Promise<void> {
    try {
      const { createResearchEngine } = await import('@agencyforge/research');
      this.engine = createResearchEngine();
    } catch {
      // @agencyforge/research unavailable — isConfigured() returns false, bridge handles it
    }
  }

  isConfigured(): boolean {
    return this.engine !== null;
  }

  async invoke(capability: string, input: unknown): Promise<unknown> {
    if (!this.engine) throw new Error('Research engine not initialized');
    switch (capability) {
      case 'research.company':
      case 'research.website':
      case 'research.competitors':
        return this.engine.research(input);
      default:
        throw new Error(`Research plugin: unknown capability "${capability}"`);
    }
  }
}

export const ResearchPluginManifest: PluginManifest = {
  id: 'research',
  name: 'AgencyForge Research',
  version: '1.0.0',
  description: 'Company discovery, website analysis, competitor analysis via @agencyforge/research',
  category: 'data',
  capabilities: [
    { id: 'research.company', description: 'Full company research report' },
    { id: 'research.website', description: 'Website analysis' },
    { id: 'research.competitors', description: 'Competitor analysis' },
  ],
  isAvailable(_config: PluginConfig): boolean {
    try {
      require.resolve('@agencyforge/research');
      return true;
    } catch {
      return false;
    }
  },
  create(config: PluginConfig): PluginInstance {
    return new ResearchPluginInstance(config as ResearchPluginConfig);
  },
};
