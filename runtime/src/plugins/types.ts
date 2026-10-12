export interface PluginConfig {
  [key: string]: unknown;
}

export interface PluginCapability {
  id: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface PluginInstance {
  readonly pluginId: string;
  readonly capabilities: string[];
  isConfigured(): boolean;
  invoke(capability: string, input: unknown): Promise<unknown>;
  dispose?(): Promise<void>;
}

export interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly category: 'tool' | 'workflow' | 'org' | 'ai' | 'data' | 'scraping';
  readonly capabilities: PluginCapability[];
  create(config: PluginConfig): PluginInstance;
  isAvailable(config: PluginConfig): boolean;
}
