import { PluginManifest, PluginInstance, PluginConfig } from '../types';

interface PaperclipPluginConfig extends PluginConfig {
  apiUrl?: string;
  apiKey?: string;
}

class PaperclipPluginInstance implements PluginInstance {
  readonly pluginId = 'paperclip';
  readonly capabilities = [
    'org.listTeams',
    'org.getTeam',
    'org.getHierarchy',
    'org.assignGoal',
    'org.getProjectsByOwner',
  ];
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: PaperclipPluginConfig) {
    this.baseUrl = (config.apiUrl as string) ?? process.env.PAPERCLIP_API_URL ?? 'http://localhost:4000';
    const key = (config.apiKey as string) ?? process.env.PAPERCLIP_API_KEY ?? '';
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
      case 'org.listTeams':
        return this.get('/api/v1/teams');
      case 'org.getTeam':
        return this.get(`/api/v1/teams/${params.teamId}`);
      case 'org.getHierarchy':
        return this.get('/api/v1/org/hierarchy');
      case 'org.assignGoal':
        return this.post('/api/v1/goals/assign', {
          goalId: params.goalId,
          ownerId: params.ownerId,
          ownerType: params.ownerType ?? 'team',
        });
      case 'org.getProjectsByOwner':
        return this.get(`/api/v1/projects?ownerId=${params.ownerId}&ownerType=${params.ownerType ?? 'team'}`);
      default:
        throw new Error(`Paperclip plugin: unknown capability "${capability}"`);
    }
  }

  private async get(path: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, { headers: this.headers });
    if (!res.ok) throw new Error(`Paperclip GET ${path} failed: ${res.status} ${res.statusText}`);
    return res.json();
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Paperclip POST ${path} failed: ${res.status} ${res.statusText}`);
    return res.json();
  }
}

export const PaperclipPluginManifest: PluginManifest = {
  id: 'paperclip',
  name: 'Paperclip',
  version: '1.0.0',
  description: 'Org intelligence layer — team hierarchy, goal assignment, and project ownership',
  category: 'org',
  capabilities: [
    { id: 'org.listTeams', description: 'List all teams in the organization' },
    { id: 'org.getTeam', description: 'Get details for a specific team' },
    { id: 'org.getHierarchy', description: 'Get full org hierarchy (departments, teams, members)' },
    { id: 'org.assignGoal', description: 'Assign a goal to a team or department' },
    { id: 'org.getProjectsByOwner', description: 'List projects owned by a team or department' },
  ],
  isAvailable(_config: PluginConfig): boolean {
    return (process.env.PAPERCLIP_API_URL ?? 'http://localhost:4000').length > 0;
  },
  create(config: PluginConfig): PluginInstance {
    return new PaperclipPluginInstance(config as PaperclipPluginConfig);
  },
};
