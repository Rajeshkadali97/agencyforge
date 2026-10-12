# AgencyForge Extension SDK

Task-oriented how-tos for extending AgencyForge. Each section answers one question with real production code from the codebase.

**Reference docs (read before extending):**
- `docs/architecture/04-ai-providers.md` — provider chain, BaseAIProvider API
- `docs/architecture/10-plugin-system.md` — plugin lifecycle, capability model
- `docs/architecture/12-extension-points.md` — all nine extension points, registration paths, failure impact

---

## How do I create a new agent?

Extend `BaseAgent`. Override the five lifecycle hooks. The base class handles state machine transitions, event publishing, and error wrapping.

**Real example: `ResearchAgent` (`runtime/src/agent/impl/ResearchAgent.ts`)**

```typescript
import { BaseAgent, AgentMetadata, AgentResult } from '../AgentRuntime';
import { ExecutionContext } from '../../context';
import { ILogger } from '../../interfaces';
import { EnhancedEventBus } from '../../events/EnhancedEventBus';
import { createRuntimeEvent, RuntimeEventTypes } from '../../contracts';
import { AIService } from '../../ai/ai-service';
import type { AIMessage } from '../../ai/providers/base';
import { randomUUID } from 'crypto';

export class MyAgent extends BaseAgent {
  private logger: ILogger;
  private eventBus: EnhancedEventBus;
  private aiService: AIService;

  constructor(logger: ILogger, eventBus: EnhancedEventBus, aiService: AIService) {
    const metadata: AgentMetadata = {
      id: 'agent.my-agent',
      name: 'My Agent',
      version: '1.0.0',
      capabilities: [
        { name: 'my-capability', version: '1.0.0', description: 'Does the thing' },
      ],
    };
    super(metadata);
    this.logger = logger;
    this.eventBus = eventBus;
    this.aiService = aiService;
  }

  protected async onInitialize(context: ExecutionContext): Promise<void> {
    this.logger.info('MyAgent: Initialized', { workflowId: context.workflowId });
  }

  protected async onExecute(context: ExecutionContext, input: unknown): Promise<AgentResult> {
    const params = input as { query: string };
    try {
      const messages: AIMessage[] = [
        { role: 'system', content: 'You are a helpful assistant. Return JSON.' },
        { role: 'user', content: params.query },
      ];
      const aiResponse = await this.aiService.complete(messages, { maxTokens: 1024 });

      const traceId = randomUUID();
      const spanId = randomUUID();
      this.eventBus.publish(
        createRuntimeEvent(RuntimeEventTypes.TASK_COMPLETED, {
          taskId: context.taskId ?? '',
          agentId: this.metadata.id,
          output: { result: aiResponse.content },
          durationMs: 0,
          workflowId: context.workflowId,
          timestamp: new Date().toISOString(),
          traceId, spanId,
        }, traceId, spanId)
      );

      return { success: true, output: { result: aiResponse.content } };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  protected async onPause(context: ExecutionContext): Promise<void> {
    this.logger.info('MyAgent: Paused', { workflowId: context.workflowId });
  }

  protected async onResume(context: ExecutionContext): Promise<void> {
    this.logger.info('MyAgent: Resumed', { workflowId: context.workflowId });
  }

  protected async onCancel(context: ExecutionContext): Promise<void> {
    this.logger.info('MyAgent: Cancelled', { workflowId: context.workflowId });
  }

  protected async onDispose(): Promise<void> {
    this.logger.info('MyAgent: Disposed');
  }
}
```

**Register in `RuntimeBootstrap.ts`:**

```typescript
const myAgent = new MyAgent(logger, eventBus, aiService);
agentRegistry.register(myAgent);
```

**Key rules:**
- Agent ID format: `agent.name` (dot notation)
- `onExecute` must return `AgentResult` — never throw out of it (wrap in try/catch and return `{ success: false, error }`)
- Publish events using `createRuntimeEvent()` + `RuntimeEventTypes` constants
- Full lifecycle docs: `docs/architecture/06-agent-lifecycle.md`

---

## How do I create a new plugin?

Implement `PluginInstance` (runtime behavior) and `PluginManifest` (metadata + factory).

**Real example: Firecrawl plugin (`runtime/src/plugins/manifests/firecrawl.ts`)**

```typescript
import type { PluginInstance, PluginManifest, PluginConfig } from '../types';

class FirecrawlPluginInstance implements PluginInstance {
  constructor(private readonly apiKey: string) {}

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async invoke(capability: string, params: Record<string, unknown>): Promise<unknown> {
    switch (capability) {
      case 'web.scrape': {
        const response = await fetch('https://api.firecrawl.dev/v0/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: params['url'] }),
        });
        if (!response.ok) throw new Error(`Firecrawl error: ${response.status}`);
        return response.json();
      }
      case 'web.search': {
        const response = await fetch('https://api.firecrawl.dev/v0/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: params['query'] }),
        });
        if (!response.ok) throw new Error(`Firecrawl search error: ${response.status}`);
        return response.json();
      }
      case 'web.map': {
        const response = await fetch('https://api.firecrawl.dev/v0/map', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: params['url'] }),
        });
        if (!response.ok) throw new Error(`Firecrawl map error: ${response.status}`);
        return response.json();
      }
      default:
        throw new Error(`Unknown capability: ${capability}`);
    }
  }

  async dispose(): Promise<void> {
    // no-op for stateless HTTP plugin
  }
}

export const FirecrawlPluginManifest: PluginManifest = {
  id: 'plugin.firecrawl',
  name: 'Firecrawl',
  version: '1.0.0',
  description: 'Web scraping, search, and site mapping via Firecrawl API',
  capabilities: [
    { name: 'web.scrape', description: 'Scrape a URL', version: '1.0.0' },
    { name: 'web.search', description: 'Search the web', version: '1.0.0' },
    { name: 'web.map', description: 'Map all pages on a site', version: '1.0.0' },
  ],
  requiredConfig: ['apiKey'],
  create: (config: PluginConfig) => new FirecrawlPluginInstance(config['apiKey'] as string),
};
```

**Register in `RuntimeBootstrap.ts`:**

```typescript
pluginRegistry.register(FirecrawlPluginManifest);
await pluginRegistry.activate('plugin.firecrawl', {
  apiKey: process.env['FIRECRAWL_API_KEY'] ?? '',
});
```

**Use a capability from an agent:**

```typescript
const plugin = pluginRegistry.getByCapability('web.scrape')[0];
if (plugin?.isConfigured()) {
  const result = await plugin.invoke('web.scrape', { url: 'https://example.com' });
}
```

**Key rules:**
- Capability names: dot notation (`web.scrape`, not `web-scrape`)
- `isConfigured()` must return false when required env var is absent
- Broken plugins are caught and skipped at activation — runtime startup continues
- Full plugin docs: `docs/architecture/10-plugin-system.md`

---

## How do I add an AI provider?

Extend `BaseAIProvider`. Implement required members and override `executeComplete()`. Add `executeStream()` if streaming is supported.

**Real example: NineRouterProvider (`runtime/src/ai/providers/ninerouter.ts`)**

```typescript
import { BaseAIProvider } from './base-provider';
import type { AIResponse, AIMessage, AIFunction, AIProviderConfig } from './base';

export class MyProvider extends BaseAIProvider {
  readonly id = 'my-provider';
  readonly name = 'My Provider';
  readonly version = '1.0.0';
  readonly capabilities = ['chat'];
  readonly supportsStreaming = false;
  readonly supportsFunctionCalling = false;

  constructor(config: AIProviderConfig = {}) {
    super({
      timeoutMs: 30000,  // tune for your provider's expected latency
      maxRetries: 3,
      ...config,
    });
  }

  protected getDefaultBaseUrl(): string {
    return process.env['MY_PROVIDER_BASE_URL'] ?? 'https://api.myprovider.com/v1';
  }

  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }

  isConfigured(): boolean {
    return !!process.env['MY_PROVIDER_API_KEY'];
  }

  protected async executeComplete(
    messages: AIMessage[],
    options?: { model?: string; temperature?: number; maxTokens?: number }
  ): Promise<AIResponse> {
    const startTime = Date.now();
    const response = await this.fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: options?.model ?? 'my-model',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: options?.maxTokens,
        temperature: options?.temperature,
      }),
      timeout: this.timeoutMs,
    });

    if (!response.ok) {
      throw new Error(`My Provider error: ${response.status}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number };
      model: string;
    };

    return {
      content: data.choices[0].message.content,
      provider: this.id,
      model: data.model,
      tokensUsed: { input: data.usage.prompt_tokens, output: data.usage.completion_tokens },
      cost: 0,
      latencyMs: Date.now() - startTime,
    };
  }
}
```

**Wire into AIService (`runtime/src/ai/ai-service.ts`):**

```typescript
// Add to preferOrderedProviders at the desired fallback position:
private readonly preferOrderedProviders = [
  'ninerouter', 'ollama', 'my-provider', 'openrouter', 'gemini', 'nim', 'anthropic', 'openai',
];

// Add to ProviderFactory:
'my-provider': () => new MyProvider({ apiKey: process.env['MY_PROVIDER_API_KEY'] })
```

**Key rules:**
- NineRouterProvider uses `timeoutMs: 10000, maxRetries: 1` — fail fast for local services so remote fallbacks activate in ≤20s
- `isConfigured()` returns false when env var absent — provider is excluded from the chain
- `executeComplete()` throws on error — `BaseAIProvider.complete()` handles retries automatically
- `StreamTimeoutError` thrown from `executeStream()` is NOT retried
- Full provider docs: `docs/architecture/04-ai-providers.md`

---

## How do I subscribe to events?

```typescript
// Exact match
eventBus.subscribe('task.completed', async (event) => {
  const payload = event.payload as { taskId: string; agentId: string; output: unknown };
  this.logger.info('Task done', { taskId: payload.taskId });
}, { label: 'MyBinding:task.completed' });

// Wildcard — all task events
eventBus.subscribe('task.*', async (event) => {
  // fires for task.created, task.completed, task.failed, etc.
}, { label: 'MyBinding:task.*', priority: -10 });

// One-shot
eventBus.subscribe('agent.initialized', async (event) => {
  // fires once, auto-unsubscribes
}, { once: true, label: 'MyBinding:agent.initialized:once' });
```

**Priority guidance:**
- `priority > 0` — runs before default handlers
- `priority = 0` (default) — registration order
- `priority < 0` — runs after default handlers (use `-10` for persistence)

Full event catalog (40+ events): `docs/architecture/03-event-system.md`

---

## How do I add a health check?

```typescript
healthManager.register('my-service', async () => {
  try {
    const resp = await fetch('http://localhost:8080/ping', {
      signal: AbortSignal.timeout(2000),
    });
    return {
      status: resp.ok ? 'healthy' : 'degraded',
      details: { statusCode: resp.status },
    };
  } catch {
    return { status: 'unhealthy', details: { error: 'unreachable' } };
  }
});
```

Appears in `GET http://localhost:3002/health`. A failing check does not affect others. Overall status is worst-of-all.

---

## How do I define a workflow?

```typescript
import type { WorkflowDefinition } from '../workflow/WorkflowEngineImpl';

const pipeline: WorkflowDefinition = {
  id: 'workflow.research-pipeline',
  name: 'Research Pipeline',
  version: '1.0.0',
  steps: [
    {
      id: 'step.scrape',
      name: 'Scrape Target',
      type: 'sequential',
      agentId: 'agent.research',
      input: { query: '{{input.company}}' },
    },
    {
      id: 'step.analyze',
      name: 'Analyze',
      type: 'sequential',
      dependencies: ['step.scrape'],
      agentId: 'agent.research',
      input: { query: '{{steps.step.scrape.output.result}}' },
    },
    {
      id: 'step.review',
      name: 'Human Review',
      type: 'approval',
      dependencies: ['step.analyze'],
      timeoutMs: 3600000,
    },
    {
      id: 'step.retry-example',
      name: 'Flaky Step',
      type: 'retry',
      agentId: 'agent.research',
      retryPolicy: { maxAttempts: 3, delayMs: 1000, backoffMultiplier: 2 },
      input: { query: 'retry me' },
    },
  ],
};

const execution = await workflowEngine.startWorkflow(pipeline, { company: 'Acme' });
await workflowEngine.approveStep(execution.id, 'step.review');
```

**Step types:** `sequential`, `parallel`, `conditional`, `approval`, `retry`

Full workflow docs: `docs/architecture/05-workflow-engine.md`

---

## How do I add a binding?

```typescript
class MyBinding {
  private interval?: NodeJS.Timeout;

  constructor(
    private readonly eventBus: EnhancedEventBus,
    private readonly logger: ILogger,
  ) {}

  async initialize(): Promise<void> {
    this.eventBus.subscribe('task.completed', async (event) => {
      // react to tasks completing
    }, { label: 'MyBinding:task.completed' });

    // Store timer handles — clear in shutdown()
    this.interval = setInterval(() => { /* periodic work */ }, 30000);
    this.logger.info('MyBinding: Initialized');
  }

  async shutdown(): Promise<void> {
    clearInterval(this.interval);
    this.interval = undefined;
  }
}

// Add to RuntimeBootstrap.start() Promise.all:
await Promise.all([
  memoryBinding.initialize(),
  myBinding.initialize(),
]);
```

**Constraint:** Bindings init in parallel — they cannot depend on each other at init time. A binding that throws aborts all of startup.

---

## How do I use the AI service directly?

```typescript
import { getAIService } from '../../ai/ai-service';
import type { AIMessage } from '../../ai/providers/base';

const aiService = getAIService(); // module-level singleton

// Non-streaming
const response = await aiService.complete([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Summarize in three bullets.' },
], { maxTokens: 512, temperature: 0.3 });

// response.content — string
// response.provider — 'ninerouter' | 'ollama' | 'openrouter' | ...

// Streaming
await aiService.stream(
  [{ role: 'user', content: 'Tell me a story.' }],
  { onChunk: (chunk) => process.stdout.write(chunk.content) }
);
```

Provider chain: ninerouter → ollama → openrouter → gemini → nim → anthropic → openai. First success wins. `StreamTimeoutError` is not retried (hard 5-minute limit).

---

## How do I publish a custom event?

```typescript
import { createRuntimeEvent, RuntimeEventTypes } from '../../contracts';
import { randomUUID } from 'crypto';

const traceId = randomUUID();
const spanId = randomUUID();

eventBus.publish(
  createRuntimeEvent(
    RuntimeEventTypes.TASK_COMPLETED,
    {
      taskId: 'task-123',
      agentId: 'agent.my-agent',
      output: { result: 'done' },
      durationMs: 1500,
      workflowId: context.workflowId,
      timestamp: new Date().toISOString(),
      traceId,
      spanId,
    },
    traceId,
    spanId,
  )
);
```

To add a new event type: add a constant to `RuntimeEventTypes`, define the payload interface in `contracts/`, then publish with the factory. Never construct `RuntimeEvent` inline.

---

## Common pitfalls

| Pitfall | Correct pattern |
|---|---|
| `async requestHandler` in `http.createServer` | Sync outer + `async _handle()` inner |
| Constructing `RuntimeEvent` inline | `createRuntimeEvent()` + `RuntimeEventTypes` |
| `someAsyncFn()` without `.catch()` | Always `await` or attach `.catch()` |
| Timer without clearing in `stop()` | Store handle, clear in `stop()`/`dispose()` |
| `process.env.KEY` dot notation | `process.env['KEY']` bracket notation |
| `any` in new code | Use interfaces or generics |
| Empty catch block | Re-throw, log, or return typed error |
| Adding inference to `runtime/src/providers/` | Add only to `runtime/src/ai/providers/` |
