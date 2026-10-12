# 10 — Plugin System

## Overview

The plugin system lets external packages add capabilities without modifying core runtime code. Plugins are registered at bootstrap and activated during `createRuntime()`.

Files:
- `runtime/src/plugins/types.ts` — interfaces
- `runtime/src/plugins/PluginRegistry.ts` — global registry singleton
- `runtime/src/plugins/` — built-in manifests (firecrawl, flowise, paperclip, research)

---

## Interfaces

```typescript
interface PluginConfig {
  [key: string]: unknown;
}

interface PluginCapability {
  id: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

interface PluginInstance {
  readonly pluginId: string;
  readonly capabilities: string[];
  isConfigured(): boolean;
  invoke(capability: string, input: unknown): Promise<unknown>;
  dispose?(): Promise<void>;
}

interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly category: 'tool' | 'workflow' | 'org' | 'ai' | 'data' | 'scraping';
  readonly capabilities: PluginCapability[];
  create(config: PluginConfig): PluginInstance;
  isAvailable(config: PluginConfig): boolean;
}
```

---

## PluginRegistry

Global singleton (`getPluginRegistry()`). Two-phase: **register** (manifest) then **activate** (instantiate).

```typescript
class PluginRegistry {
  register(manifest): void
  activate(id, config): PluginInstance        // calls manifest.create(config)
  get(id): PluginInstance | undefined
  getManifest(id): PluginManifest | undefined
  getByCapability(cap): PluginInstance[]      // configured instances only
  listManifests(): PluginManifest[]
  listInstances(): PluginInstance[]
  async deactivate(id): Promise<void>         // calls instance.dispose()
  async disposeAll(): Promise<void>
}
```

`getByCapability(cap)` filters by `capabilities.includes(cap) && isConfigured()`.

---

## Bootstrap lifecycle

```typescript
// In createRuntime():
registry.register(firecrawlManifest);
registry.register(flowiseManifest);
registry.register(paperclipManifest);
registry.register(researchManifest);

for (const manifest of registry.listManifests()) {
  try {
    registry.activate(manifest.id, configFromEnv);
  } catch (err) {
    logger.warn('Plugin activation failed', { id: manifest.id, error: err.message });
    // runtime continues — broken plugin is skipped
  }
}
```

---

## Built-in plugins

| Plugin ID | Category | Capabilities | Requires |
|---|---|---|---|
| `firecrawl` | scraping | `web-scrape`, `url-to-markdown` | `FIRECRAWL_API_KEY` |
| `flowise` | workflow | `flow-execution`, `chatflow` | `FLOWISE_URL` |
| `paperclip` | org | `document-store`, `note-taking` | internal config |
| `research` | tool | `research`, `web-search` | none |

---

## Writing a new plugin

### 1. Implement PluginInstance

```typescript
class MyPluginInstance implements PluginInstance {
  readonly pluginId = 'my-plugin';
  readonly capabilities = ['my-capability'];

  constructor(private config: PluginConfig) {}

  isConfigured(): boolean {
    return !!this.config['MY_API_KEY'];
  }

  async invoke(capability: string, input: unknown): Promise<unknown> {
    if (capability !== 'my-capability') throw new Error(`Unknown: ${capability}`);
    // implementation
  }

  async dispose(): Promise<void> { /* cleanup */ }
}
```

### 2. Define PluginManifest

```typescript
export const myManifest: PluginManifest = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  description: 'Does something useful',
  category: 'tool',
  capabilities: [{ id: 'my-capability', description: 'Does X given Y' }],
  create: (config) => new MyPluginInstance(config),
  isAvailable: (config) => !!config['MY_API_KEY'],
};
```

### 3. Register in RuntimeBootstrap

In `runtime/src/bootstrap/RuntimeBootstrap.ts`:
```typescript
import { myManifest } from './plugins/my-plugin/manifest';
registry.register(myManifest);
```

### 4. Set env var

```
MY_API_KEY=your-key
```

Unconfigured plugins are registered but invisible to `getByCapability()` lookups.

---

## Capability model

Capability IDs are plain kebab-case strings. No central registry. Two plugins can claim the same capability — `getByCapability()` returns all configured matches; callers take the first or iterate. There is no versioning or conflict resolution.
