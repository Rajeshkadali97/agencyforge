# Cognee Memory Provider

## Overview

The Cognee Memory Provider is the first implementation of the AgencyForge Memory Provider interface. It provides persistent memory storage, retrieval, and knowledge graph capabilities through Cognee's API.

Cognee is **not** the Memory Engine. It is one provider inside the Memory Engine architecture. AgencyForge never couples directly to Cognee—all interactions occur through the Memory Provider interface.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Memory Engine                         │
├─────────────────────────────────────────────────────────────┤
│                      Provider Interface                       │
├─────────────────┬─────────────────┬─────────────────────────┤
│  Cognee Provider│ Future Provider │ Future Provider         │
│       ↓         │       ↓         │         ↓               │
│     Cognee      │     Neo4j       │      Qdrant             │
│                 │     Qdrant      │      SQLite             │
│                 │     SQLite      │      Redis              │
│                 │     Redis       │      Filesystem         │
│                 │     Filesystem  │      Custom             │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### Provider Interface

All memory providers must implement the `MemoryProvider` interface:

```typescript
interface MemoryProvider extends MemoryProviderLifecycle {
  readonly info: MemoryProviderInfo;

  store(options: MemoryStoreOptions): Promise<Result<Memory>>;
  retrieve(options: RetrievalOptions): Promise<Result<Memory | null>>;
  search(options: SearchOptions): Promise<Result<SearchResult[]>>;
  summarize(options: SummarizeOptions): Promise<Result<string>>;
  delete(memoryId: string): Promise<Result<void>>;
  archive(options: ArchiveOptions): Promise<Result<void>>;

  createEntity(entity: Omit<Entity, "id" | "metadata">): Promise<Result<Entity>>;
  createRelationship(relate: RelateOptions): Promise<Result<Relationship>>;
  getEntity(entityId: string): Promise<Result<Entity | null>>;
  getRelationships(entityId: string): Promise<Result<Relationship[]>>;
  getRelatedEntities(entityId: string, relationshipType?: string): Promise<Result<Entity[]>>;

  addFact(fact: Omit<Fact, "id" | "metadata">): Promise<Result<Fact>>;
  getFacts(subject?: string): Promise<Result<Fact[]>>;

  storeBusinessProfile(business: BusinessProfile): Promise<Result<Entity>>;
  storeAgentProfile(agent: AgentProfile): Promise<Result<Entity>>;
  storeProjectProfile(project: ProjectProfile): Promise<Result<Entity>>;
}

interface MemoryProviderLifecycle {
  initialize(config: CogneeConfig): Promise<Result<void>>;
  shutdown(): Promise<Result<void>>;
  health(): Promise<Result<HealthStatus>>;
}
```

## Lifecycle

### Initialization

```typescript
import { CogneeMemoryProvider } from "./memory/cognee/cognee-memory-provider.js";

const provider = new CogneeMemoryProvider();

const initResult = await provider.initialize({
  apiKey: process.env.COGNEE_API_KEY,
  endpoint: "https://api.cognee.ai",
  model: "gpt-4",
  embeddingModel: "text-embedding-3-small",
  timeout: 30000,
  maxRetries: 3,
  namespace: "agencyforge",
});

if (!initResult.ok) {
  console.error("Failed to initialize:", initResult.error);
  process.exit(1);
}
```

### Health Check

```typescript
const health = await provider.health();

if (health.ok) {
  console.log(`Status: ${health.value.status}`);
  console.log(`Latency: ${health.value.latencyMs}ms`);
  console.log(`Details: ${health.value.details}`);
}
```

### Shutdown

```typescript
const shutdownResult = await provider.shutdown();

if (!shutdownResult.ok) {
  console.error("Shutdown failed:", shutdownResult.error);
}
```

## Core Methods

### Store

Store new memory with automatic tier assignment:

```typescript
const storeResult = await provider.store({
  content: {
    text: "Discovered a new lead at Acme Corp",
    embedding: await generateEmbedding("Discovered a new lead at Acme Corp"),
  },
  metadata: {
    tier: 4,
    priority: "high",
    type: "entity",
    archived: false,
    tags: ["lead", "acme-corp"],
    ownerId: "user-123",
  },
});

if (storeResult.ok) {
  const memory = storeResult.value;
  console.log(`Stored memory: ${memory.id}`);
}
```

### Retrieve

Retrieve memory by ID with access tracking:

```typescript
const retrieveResult = await provider.retrieve({
  memoryId: "memory-uuid",
  includeArchived: false,
});

if (retrieveResult.ok && retrieveResult.value) {
  const memory = retrieveResult.value;
  console.log(`Retrieved: ${memory.content.text}`);
}
```

### Search

Full-text search with filters:

```typescript
const searchResult = await provider.search({
  query: "Acme Corp lead",
  limit: 20,
  types: ["entity", "document"],
  tags: ["lead", "sales"],
  fromDate: new Date("2024-01-01"),
  toDate: new Date("2024-12-31"),
});

if (searchResult.ok) {
  for (const { memory, score, highlights } of searchResult.value) {
    console.log(`[${score.toFixed(2)}] ${memory.id}`);
    if (highlights.length > 0) {
      console.log(`  Highlight: ${highlights[0]}`);
    }
  }
}
```

### Summarize

Generate summaries in multiple formats:

```typescript
const summarizeResult = await provider.summarize({
  memoryIds: ["id-1", "id-2", "id-3"],
  maxLength: 500,
  format: "detailed", // "brief" | "detailed" | "bullet"
});

if (summarizeResult.ok) {
  console.log(summarizeResult.value);
}
```

### Delete

Permanently remove memory:

```typescript
const deleteResult = await provider.delete("memory-uuid");

if (deleteResult.ok) {
  console.log("Memory deleted");
}
```

### Archive

Soft-delete with optional permanent removal:

```typescript
const archiveResult = await provider.archive({
  memoryIds: ["id-1", "id-2"],
  permanent: false, // true to permanently delete
});

if (archiveResult.ok) {
  console.log("Archived successfully");
}
```

## Knowledge Graph

### Entities

Entities represent business objects with typed properties:

```typescript
const entityResult = await provider.createEntity({
  content: { text: "Acme Corporation" },
  entityType: "business",
  properties: {
    founded: 2020,
    employees: 50,
    revenue: "$5M",
    industry: "Technology",
  },
});
```

Supported entity types:
- `business`
- `person`
- `project`
- `document`
- `task`
- `agent`
- `workflow`

### Relationships

Connect entities with typed relationships:

```typescript
const relResult = await provider.createRelationship({
  sourceId: "business-123",
  targetId: "contact-456",
  relationshipType: "has_contact",
  properties: {
    role: "CTO",
    since: "2024-01-15",
  },
  bidirectional: true, // Creates reverse relationship
});
```

### Facts

Store structured knowledge as subject-predicate-object triplets:

```typescript
const factResult = await provider.addFact({
  subject: "acme-corp",
  predicate: "specializes_in",
  object: "enterprise software",
  confidence: 0.95,
  content: { text: "Acme Corp specializes in enterprise software solutions" },
});
```

## Business Profiles

Automatically build comprehensive business knowledge profiles:

```typescript
const businessProfile: BusinessProfile = {
  name: "Acme Corporation",
  website: "https://acme-corp.com",
  socialProfiles: [
    { platform: "linkedin", url: "https://linkedin.com/company/acme" },
    { platform: "twitter", url: "https://twitter.com/acme", handle: "@acme" },
  ],
  contacts: [
    {
      name: "John Smith",
      email: "john@acme-corp.com",
      role: "CTO",
      linkedIn: "https://linkedin.com/in/johnsmith",
    },
  ],
  technology: ["React", "Node.js", "PostgreSQL", "AWS"],
  seoData: {
    domain: "acme-corp.com",
    authority: 65,
    keywords: ["enterprise software", "B2B solutions"],
  },
  projects: ["project-1", "project-2"],
  proposals: ["proposal-1"],
  emails: ["initial-contact", "follow-up"],
  meetings: [
    {
      date: new Date("2024-03-15"),
      summary: "Discovery call",
      participants: ["John Smith", "Jane Doe"],
      outcomes: ["Schedule technical deep-dive"],
    },
  ],
  history: [
    {
      date: new Date("2020-01-01"),
      event: "Company founded",
      details: "Started by John Smith and Jane Doe",
    },
  ],
  relationships: [
    {
      businessId: "partner-123",
      relationshipType: "partners_with",
      details: "Strategic technology partner",
    },
  ],
};

const result = await provider.storeBusinessProfile(businessProfile);
```

## Agent Profiles

Store agent-specific memory including past work, preferences, and learned behaviors:

```typescript
const agentProfile: AgentProfile = {
  name: "sales-agent-1",
  type: "sales-intelligence",
  capabilities: ["lead-discovery", "contact-extraction", "email-outreach"],
  pastWork: [
    {
      projectId: "project-1",
      description: "Discovered 50 leads for Acme Corp",
      date: new Date("2024-03-01"),
      outcome: "3 meetings scheduled",
    },
  ],
  preferences: {
    preferredContactMethod: "email",
    workingHours: "9-5 EST",
    tone: "professional",
  },
  mistakes: [
    {
      description: "Sent cold email without personalization",
      date: new Date("2024-02-15"),
      lesson: "Always personalize first outreach",
    },
  ],
  successfulWorkflows: [
    {
      workflowId: "workflow-1",
      name: "Enterprise Lead Discovery",
      successRate: 0.85,
      useCount: 25,
    },
  ],
  currentContext: {
    activeProject: "acme-expansion",
    currentFocus: "mid-market leads",
  },
  currentGoals: ["Increase response rate", "Reduce CAC"],
};

const result = await provider.storeAgentProfile(agentProfile);
```

## Project Profiles

Maintain comprehensive project memory:

```typescript
const projectProfile: ProjectProfile = {
  name: "Acme CRM Integration",
  description: "Integration project connecting Acme's CRM with AgencyForge",
  timeline: [
    {
      date: new Date("2024-01-15"),
      event: "Project kickoff",
      type: "created",
    },
    {
      date: new Date("2024-02-01"),
      event: "API design complete",
      type: "milestone",
    },
    {
      date: new Date("2024-03-15"),
      event: "Decision to use webhook polling",
      type: "decision",
      details: "Chose webhook polling over streaming due to reliability",
    },
  ],
  files: ["src/index.ts", "src/api.ts", "tests/integration.test.ts"],
  versions: [
    {
      version: "1.0.0",
      date: new Date("2024-02-01"),
      changes: ["Initial API design", "Basic CRUD operations"],
      author: "dev-1",
    },
  ],
  decisions: [
    {
      date: new Date("2024-02-01"),
      decision: "Use REST API over GraphQL",
      rationale: "Simpler integration, wider tool support",
      decidedBy: "architecture-team",
    },
  ],
  tasks: ["task-1", "task-2", "task-3"],
  deliverables: ["API documentation", "Integration guide", "Test suite"],
  dependencies: ["dependency-1", "dependency-2"],
};

const result = await provider.storeProjectProfile(projectProfile);
```

## Provider Registry

Manage multiple providers with the registry:

```typescript
import { DefaultMemoryProviderRegistry } from "./memory/interfaces/provider-registry.js";
import { CogneeMemoryProvider } from "./memory/cognee/cognee-memory-provider.js";

const registry = new DefaultMemoryProviderRegistry();

// Register providers
const cognee = new CogneeMemoryProvider();
const regResult = registry.register(cognee);

// Get provider
const provider = registry.get("cognee");

// Require provider (throws if not found)
const required = registry.require("cognee");

// List all providers
const all = registry.list();

// Health check all providers
const healthResult = await registry.healthCheck();
if (healthResult.ok) {
  for (const [id, status] of Object.entries(healthResult.value)) {
    console.log(`${id}: ${status.status} (${status.latencyMs}ms)`);
  }
}
```

## Future Providers

The Memory Engine architecture supports multiple providers:

### Neo4j Provider
Knowledge graph storage with Cypher queries, optimal for:
- Complex relationship queries
- Graph traversal operations
- Connected data analysis

### Qdrant Provider
Vector database for semantic search, optimal for:
- High-dimensional embeddings
- ANN queries
- Similarity search at scale

### SQLite Provider
Local relational storage, optimal for:
- Single-node deployments
- Low-latency requirements
- Simple deployment

### Redis Provider
In-memory storage for caching, optimal for:
- L0-L1 memory tiers
- Session data
- High-throughput access

### Filesystem Provider
File-based storage, optimal for:
- Archival (L7)
- Large binary data
- Debugging and inspection

### Custom Providers
Implement the `MemoryProvider` interface to create custom providers:
```typescript
class CustomMemoryProvider implements MemoryProvider {
  readonly info = { name: "custom", displayName: "...", ... };
  // Implement all required methods
}
```

## Migration Path

### Adding a New Provider

1. Implement `MemoryProvider` interface:
```typescript
export class Neo4jMemoryProvider implements MemoryProvider {
  readonly info = {
    name: "neo4j",
    displayName: "Neo4j Memory Provider",
    version: "1.0.0",
    category: "memory",
    supports: [...],
    reliabilityScore: 0.95,
    requiresApiKey: false,
  };
  // Implement all interface methods
}
```

2. Register in registry:
```typescript
registry.register(new Neo4jMemoryProvider());
```

3. Use by capability:
```typescript
const graphProvider = registry.get("neo4j");
await graphProvider.createRelationship({ ... });
```

### Switching Providers

```typescript
// Sequential migration
const source = registry.get("cognee");
const target = registry.get("neo4j");

// Export from source
const allMemories = [];
let cursor = null;
do {
  const searchResult = await source.search({ query: "*", limit: 100 });
  if (searchResult.ok) {
    allMemories.push(...searchResult.value);
    cursor = searchResult.value[searchResult.value.length - 1]?.memory.id;
  }
} while (cursor);

// Import to target
for (const { memory } of allMemories) {
  await target.store({
    content: memory.content,
    metadata: memory.metadata,
  });
}
```

## Performance

### Latency Targets

| Operation | Target | P95 |
|-----------|--------|-----|
| Store | 50ms | 100ms |
| Retrieve | 10ms | 25ms |
| Search | 100ms | 250ms |
| Summarize | 500ms | 2000ms |
| Health Check | 5ms | 20ms |

### Optimization Strategies

1. **Batch Operations**: Group multiple stores/deletes
2. **Connection Pooling**: Maintain persistent connections
3. **Caching**: Implement L0-L1 caching layer
4. **Async Persistence**: Write-through cache with async backend sync
5. **Index Optimization**: Use appropriate indexes for search

## Limitations

### Current Limitations

1. **No Native Vector Search**: Search uses full-text matching; vector operations require embedding generation external to Cognee
2. **No Transaction Support**: Individual operations are not atomic across multiple stores
3. **No Real-time Sync**: No WebSocket or streaming support for real-time updates
4. **No Query Language**: Complex queries require client-side filtering
5. **No Built-in Analytics**: Usage metrics and insights require external tooling

### Known Constraints

1. Memory IDs are UUIDs; ensure adequate storage for large deployments
2. Archived memories remain in storage until explicitly purged
3. Relationship traversal depth is unlimited but may impact performance
4. Embeddings must be generated externally and passed with content

### API Rate Limits

Cognee API rate limits apply based on your plan. Configure `maxRetries` and implement exponential backoff for production use.

## Error Handling

All methods return `Result<T>` for explicit error handling:

```typescript
const result = await provider.store({ ... });

if (!result.ok) {
  switch (result.error.code) {
    case "CONNECTION_ERROR":
      // Retry with backoff
      break;
    case "VALIDATION_ERROR":
      // Fix input data
      break;
    case "NOT_FOUND_ERROR":
      // Handle missing data
      break;
    default:
      // Log and escalate
      console.error(`Unexpected error: ${result.error}`);
  }
}
```

## TypeScript Configuration

Requires strict mode enabled:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "esModuleInterop": true,
    "moduleResolution": "NodeNext",
    "target": "ES2022"
  }
}
```

## Security

- API keys should be stored in environment variables
- Never log sensitive memory content
- Implement access controls at the Memory Engine level
- Validate all inputs before passing to Cognee API

## Dependencies

```json
{
  "dependencies": {
    "uuid": "^9.0.0"
  }
}
```

## Version History

### 1.0.0
- Initial implementation
- Core memory operations (store, retrieve, search, delete, archive)
- Knowledge graph support (entities, relationships, facts)
- Profile management (business, agent, project)
- Provider registry with health checks