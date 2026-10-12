# 04 — AI Provider System

## Two stacks — choose correctly

| Stack | Location | Purpose |
|---|---|---|
| **Primary** | `runtime/src/ai/` | All real inference (chat, streaming, agent execution) |
| **Legacy** | `runtime/src/providers/AIProviderRouter.ts` | Dashboard health display only; `/api/ai/routing` endpoint |

**Rule:** Never add inference logic to the legacy stack. Add AI features only to the primary stack.

---

## Primary stack architecture

```
AIService (singleton: getAIService())
  └── ProviderFactory
        └── AIProvider[] (ordered fallback chain)
              ├── NineRouterProvider   (local gateway :20128)
              ├── OllamaProvider       (local inference :11434)
              ├── OpenRouterProvider   (cloud aggregate)
              ├── GeminiProvider       (Google)
              ├── NIMProvider          (NVIDIA)
              ├── AnthropicProvider    (optional; requires ANTHROPIC_API_KEY)
              └── OpenAIProvider       (optional; requires OPENAI_API_KEY)
```

---

## Provider priority order

Hard-coded in `AIService` constructor:

```typescript
preferOrderedProviders: ['ninerouter', 'ollama', 'openrouter', 'gemini', 'nim', 'anthropic', 'openai']
```

`complete()` and `stream()` iterate this list. First configured+available provider wins. Any throw increments `failoverCount` and tries the next provider.

`forceProvider` short-circuits to a single provider (no fallback). `preferredProvider` is tried first but falls back normally if it fails.

---

## BaseAIProvider

File: `runtime/src/ai/providers/base-provider.ts`

All providers extend `BaseAIProvider`. Key members:

```typescript
abstract class BaseAIProvider {
  readonly id: string;                     // 'ninerouter', 'ollama', etc.
  protected timeoutMs: number;             // Default: 60000 (60s)
  protected maxRetries: number;            // Default: 3
  protected streamTimeoutMs: number;       // Default: 300000 (5 min)
  protected isAvailableFlag: boolean;

  abstract complete(messages, options): Promise<AIResponse>
  stream(messages, options): Promise<void>   // Wraps executeStream with Promise.race timeout
  isConfigured(): boolean                    // Returns true if API key/URL env var is set
  supportsStreaming: boolean                 // Set true in subclass to advertise streaming
}
```

### fetchWithTimeout

Makes HTTP requests with an `AbortController`. Clears the abort timer once response headers arrive, not after body. Slow response bodies do not trigger the initial connection timeout.

### stream() timeout (V-07 fix)

All streaming sessions are bounded by `streamTimeoutMs` via `Promise.race`:

```typescript
const streamPromise = this.executeStream(messages, options);
const timeoutPromise = new Promise<never>((_, reject) => {
  timeoutId = setTimeout(() => reject(new StreamTimeoutError(this.streamTimeoutMs)), this.streamTimeoutMs);
});
await Promise.race([streamPromise, timeoutPromise]);
```

`StreamTimeoutError` is **not retried** — sets `isAvailableFlag = false` and re-throws, preventing a stalled provider from blocking the chain for 3 × 5 minutes.

### retry loop

```
attempt 0:  execute
  StreamTimeoutError → throw immediately (no retry)
  other error        → wait 2^attempt × 1000ms, then retry
attempt 1..maxRetries: same
last attempt fails   → throw last error
```

---

## NineRouterProvider specifics

File: `runtime/src/ai/providers/ninerouter.ts`

9Router is a local AI gateway on `localhost:20128`. It routes to cloud providers internally and is the single point of contact for all AI inference in normal operation.

Constructor overrides base defaults for fast local-failover:

```typescript
constructor(config = {}) {
  super({
    timeoutMs: 10000,   // 10s (base: 60s) — local service must respond fast
    maxRetries: 1,      // 1 retry (base: 3) → 2 × 10s = 20s max before fallback
    ...config,
  });
}
```

URL: `process.env.NINE_ROUTER_URL ?? 'http://localhost:20128/v1'`

---

## ProviderFactory

File: `runtime/src/ai/provider-factory.ts`

Creates all 7 provider instances from environment variables.

```typescript
interface FactoryConfig {
  nineRouterUrl?: string;      // NINE_ROUTER_URL
  ollamaUrl?: string;          // OLLAMA_BASE_URL
  openRouterApiKey?: string;   // OPENROUTER_API_KEY
  geminiApiKey?: string;       // GEMINI_API_KEY
  nimApiKey?: string;          // NIM_API_KEY
  anthropicApiKey?: string;    // ANTHROPIC_API_KEY
  openaiApiKey?: string;       // OPENAI_API_KEY
}
```

Providers with no API key return `isConfigured() === false` and are skipped by `AIService`.

---

## AIService metrics

```typescript
interface AIServiceMetrics {
  requestsTotal: number;
  requestsByProvider: Record<string, number>;
  errorsByProvider: Record<string, number>;
  averageLatencyMs: Record<string, number>;
  failoverCount: number;
}
```

Accessible via `GET /api/ai/routing` → `{ health, metrics, timestamp }`.

---

## Adding a new AI provider

1. Create `runtime/src/ai/providers/myprovider.ts` extending `BaseAIProvider`.
2. Implement `complete()`. Optionally implement `executeStream()` and set `supportsStreaming = true`.
3. Set `isConfigured()` to return `false` when the required env var is absent.
4. Add instance construction to `ProviderFactory` in `provider-factory.ts`.
5. Add the provider ID to `AIService.preferOrderedProviders` at the desired priority.
6. Add the env var key to `FactoryConfig`.

No other changes needed. Retry and fallback apply automatically.

---

## Sequence: chat request with fallback

```mermaid
sequenceDiagram
    participant C as Client
    participant RB as RuntimeBridge
    participant AS as AIService
    participant NR as NineRouterProvider
    participant OR as OpenRouterProvider

    C->>RB: POST /api/runtime/chat { messages }
    RB->>AS: complete(messages, { preferredProvider: 'ninerouter' })
    AS->>NR: complete(messages)
    NR-->>AS: StreamTimeoutError (stalled)
    AS->>AS: isAvailableFlag=false; failoverCount++
    AS->>OR: complete(messages)
    OR-->>AS: AIResponse { content, provider, model, latencyMs }
    AS-->>RB: AIResponse
    RB-->>C: 200 { response, provider, model, latencyMs }
```
