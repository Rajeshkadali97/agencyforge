import { PluginManifest, PluginInstance, PluginConfig } from '../types';

interface FlowisePluginConfig extends PluginConfig {
  apiUrl?: string;
  apiKey?: string;
}

interface ChatflowSummary {
  id: string;
  name: string;
  deployed: boolean;
}

interface PredictionResult {
  text: string;
  [key: string]: unknown;
}

class FlowisePluginInstance implements PluginInstance {
  readonly pluginId = 'flowise';
  readonly capabilities = ['workflow.list', 'workflow.execute', 'workflow.import'];
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: FlowisePluginConfig) {
    this.baseUrl = (config.apiUrl as string) ?? process.env.FLOWISE_API_URL ?? 'http://localhost:3000';
    const key = (config.apiKey as string) ?? process.env.FLOWISE_API_KEY ?? '';
    this.headers = {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    };
  }

  isConfigured(): boolean {
    return this.baseUrl.length > 0;
  }

  async invoke(capability: string, input: unknown): Promise<unknown> {
    const params = (input ?? {}) as Record<string, unknown>;
    switch (capability) {
      case 'workflow.list':
        return this.listChatflows();
      case 'workflow.execute':
        return this.executeChatflow(params.workflowId as string, params.question as string, params.overrides as Record<string, unknown> | undefined);
      case 'workflow.import':
        return this.importChatflow(params.workflowId as string);
      default:
        throw new Error(`Flowise plugin: unknown capability "${capability}"`);
    }
  }

  private async listChatflows(): Promise<ChatflowSummary[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/chatflows`, { headers: this.headers });
    if (!res.ok) throw new Error(`Flowise list failed: ${res.status} ${res.statusText}`);
    const data = (await res.json()) as ChatflowSummary[];
    return data.map(({ id, name, deployed }) => ({ id, name, deployed }));
  }

  private async executeChatflow(workflowId: string, question: string, overrides?: Record<string, unknown>): Promise<PredictionResult> {
    if (!workflowId) throw new Error('workflow.execute requires workflowId');
    if (!question) throw new Error('workflow.execute requires question');
    const body: Record<string, unknown> = { question };
    if (overrides) body.overrideConfig = overrides;
    const res = await fetch(`${this.baseUrl}/api/v1/prediction/${workflowId}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Flowise execute failed: ${res.status} ${res.statusText}`);
    return res.json() as Promise<PredictionResult>;
  }

  private async importChatflow(workflowId: string): Promise<unknown> {
    if (!workflowId) throw new Error('workflow.import requires workflowId');
    const res = await fetch(`${this.baseUrl}/api/v1/chatflows/${workflowId}`, { headers: this.headers });
    if (!res.ok) throw new Error(`Flowise import failed: ${res.status} ${res.statusText}`);
    return res.json();
  }
}

export const FlowisePluginManifest: PluginManifest = {
  id: 'flowise',
  name: 'Flowise',
  version: '1.0.0',
  description: 'Visual workflow designer bridge — list, execute, and import Flowise chatflows',
  category: 'workflow',
  capabilities: [
    { id: 'workflow.list', description: 'List all deployed Flowise chatflows' },
    { id: 'workflow.execute', description: 'Execute a Flowise chatflow with a question/input' },
    { id: 'workflow.import', description: 'Import a Flowise chatflow definition (DAG inspection)' },
  ],
  isAvailable(_config: PluginConfig): boolean {
    return (process.env.FLOWISE_API_URL ?? 'http://localhost:3000').length > 0;
  },
  create(config: PluginConfig): PluginInstance {
    return new FlowisePluginInstance(config as FlowisePluginConfig);
  },
};
