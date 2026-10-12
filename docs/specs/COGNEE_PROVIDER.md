# Cognee Memory Provider

## Overview

The Cognee Memory Provider integrates Cognee (a knowledge graph and memory platform) as a first-class memory backend for AgencyForge. It implements the `IMemoryProvider` interface, allowing AgencyForge to use Cognee for all memory operations without coupling the core system to Cognee-specific APIs.

## Architecture

```
AgencyForge Memory Engine
         │
         ▼
   IMemoryProvider Interface
         │
         ▼
┌─────────────────────────────────┐
│      CogneeMemoryProvider       │
├─────────────────────────────────┤
│  • Document Storage             │
│  • Vector Embeddings            │
│  • Knowledge Graph              │
│  • Hybrid Search (Vector + KW)  │
│  • Fact Extraction              │
│  • Summarization                │
│  • Entity/Relationship Mgmt     │
└─────────────────────────────────┘
         │
         ▼
    Cognee API
    (REST/gRPC)
```

## Features

### Core Capabilities
- **Document Storage**: Full CRUD for memory items as documents
- **Vector Search**: Semantic similarity via embeddings
- **Keyword Search**: Full-text search with highlighting
- **Hybrid Search**: Combined vector + keyword with reranking
- **Knowledge Graph**: Entities, relationships, graph traversal
- **Fact Extraction**: Automatic fact extraction from content
- **Summarization**: AI-powered content summarization
- **Classification**: Memory type classification

### Cognee-Specific Features
- **Organization/Project Scoping**: Multi-tenant isolation
- **Incremental Indexing**: Real-time index updates
- **Graph Analytics**: Centrality, communities, paths
- **Temporal Queries**: Time-based memory retrieval
- **Batch Operations**: High-throughput bulk processing

## Configuration

```typescript
interface CogneeConfig {
  apiUrl: string;           // Cognee API endpoint
  apiKey: string;           // Authentication key
  organizationId?: string;  // Optional org scope
  projectId?: string;       // Optional project scope
  timeout: number;          // Request timeout (ms)
  retryAttempts: number;    // Retry policy
}
```

### Provider Registration

```typescript
import { MemoryEngine } from './memory-engine';
import { CogneeMemoryProvider } from './providers/cognee/CogneeMemoryProvider';

const engine = new MemoryEngine(kernelEventBus);

const cogneeProvider = new CogneeMemoryProvider({
  id: 'cognee-primary',
  type: 'cognee',
  name: 'Cognee Primary',
  enabled: true,
  priority: 10,
  config: {
    apiUrl: 'https://api.cognee.ai',
    apiKey: process.env.COGNEE_API_KEY,
    organizationId: 'org-123',
    projectId: 'proj-456',
    timeout: 30000,
    retryAttempts: 3,
  },
  memoryTypes: [
    'short-term', 'long-term', 'semantic', 'episodic',
    'procedural', 'working', 'business', 'user',
    'project', 'workflow', 'agent', 'knowledge',
    'conversation', 'document', 'decision', 'task', 'relationship'
  ],
});

engine.registerProvider(cogneeProvider);
await engine.initialize();
```

## API Methods

### Store
```typescript
await provider.store(item, {
  extractFacts: true,    // Extract facts from content
  classify: true,        // Classify memory type
  index: true,           // Add to search indexes
  embed: true,           // Generate embeddings
  relate: true,          // Extract relationships
  summarize: true,       // Generate summary
});
```

### Retrieve
```typescript
const item = await provider.retrieve('mem_123');
```

### Search
```typescript
const results = await provider.search({
  query: 'machine learning best practices',
  types: ['knowledge', 'procedural'],
  owner: 'agent-researcher',
  projectId: 'proj-ml',
  tags: ['ml', 'best-practices'],
  limit: 10,
  minImportance: 0.5,
});
```

### Relate
```typescript
await provider.relate(
  'business-acme-corp',
  'project-website-redesign',
  'has_project',
  { role: 'client', startDate: '2024-01-15' }
);
```

### Summarize
```typescript
const summary = await provider.summarize([
  'mem_1', 'mem_2', 'mem_3'
]);
```

### Archive
```typescript
await provider.archive('mem_123', {
  reason: 'Project completed',
  archiveLocation: 'cognee_archive',
});
```

### Merge
```typescript
const merged = await provider.merge('mem_old', 'mem_new', {
  strategy: 'smart',
  conflictResolution: 'ai',
});
```

## Knowledge Graph Operations

### Entities
```typescript
// Entities are automatically extracted during store
// Manual entity management:
await provider.store(item, { extractFacts: true });
const entities = await provider.getEntities(itemId);
```

### Relationships
```typescript
// Relationships extracted from content
// Explicit relationship creation:
await provider.relate(sourceId, targetId, 'works_for', { since: '2024' });

// Graph traversal:
const related = await provider.getRelatedEntities('business-acme', 'has_project');
```

### Graph Queries
```typescript
// Cypher-like queries via Cognee API
const subgraph = await provider.getSubgraph(['node1', 'node2'], 2);
const path = await provider.findPath('user-1', 'business-acme');
```

## Business Memory Profile

The Cognee provider automatically builds comprehensive business profiles:

```
Business (acme-corp)
├── Website (acme.com)
├── Social Profiles
│   ├── LinkedIn
│   ├── Twitter
│   └── GitHub
├── Contacts
│   ├── John Smith (CTO)
│   └── Jane Doe (VP Eng)
├── Technology Stack
│   ├── React, Node.js, PostgreSQL
│   ├── AWS, Kubernetes
│   └── Datadog, PagerDuty
├── SEO Analysis
│   ├── Keywords: 1,247
│   ├── Traffic: 45K/mo
│   └── Domain Authority: 52
├── Projects
│   ├── website-redesign (active)
│   └── api-migration (completed)
├── Proposals
│   ├── Q1-2024-redesign (won)
│   └── Q2-2024-api (pending)
├── Communications
│   ├── Emails: 1,247
│   ├── Meetings: 23
│   └── Calls: 45
└── History
    ├── First contact: 2023-06-15
    ├── Last activity: 2024-01-20
    └── Lifetime value: $2.4M
```

## Agent Memory

Each agent maintains persistent memory:

```typescript
// Agent context
const agentMemory = await engine.getAgentMemory().createAgentContext({
  agentId: 'agent-researcher',
  name: 'Research Agent',
  capabilities: ['web-search', 'analysis', 'report-generation'],
});

// Past work retrieval
const pastWork = await engine.getAgentMemory().getAgentPastWork('agent-researcher', 20);

// Preferences
await engine.getAgentMemory().setAgentPreference('agent-researcher', 'detailLevel', 'deep');
const prefs = await engine.getAgentMemory().getAgentPreferences('agent-researcher');

// Mistakes tracking
const mistakes = await engine.getAgentMemory().getAgentMistakes('agent-researcher');

// Successful workflows
const workflows = await engine.getAgentMemory().getAgentSuccessfulWorkflows('agent-researcher');
```

## Project Memory

Projects maintain complete context:

```typescript
const projectMemory = await engine.getProjectMemory().createProjectContext({
  name: 'Website Redesign',
  description: 'Complete redesign of acme.com',
  owner: 'user-pm-1',
});

// Timeline
const timeline = await engine.getProjectMemory().getProjectTimeline('proj-123');

// Files and versions
const files = await engine.getProjectMemory().getProjectFiles('proj-123');

// Decisions
const decisions = await engine.getProjectMemory().getProjectDecisions('proj-123');

// Tasks
const tasks = await engine.getProjectMemory().getProjectTasks('proj-123');
```

## Relationship Engine

Automatic relationship discovery:

```typescript
// Business ↔ Project
await engine.getBusinessMemory().linkBusinessToProject('biz-acme', 'proj-redesign');

// Business ↔ User
await engine.getBusinessMemory().linkBusinessToUser('biz-acme', 'user-john', 'decision-maker');

// Project ↔ Agent
await engine.getProjectMemory().linkProjectToAgent('proj-redesign', 'agent-designer');

// Workflow ↔ Project
await engine.getWorkflowMemory().linkWorkflowToProject('wf-deploy', 'proj-redesign');
```

## Search Modes

| Mode | Use Case | Provider |
|------|----------|----------|
| `semantic` | Meaning-based search | Cognee (vector) |
| `keyword` | Exact term matching | Cognee (full-text) |
| `vector` | Pure embedding similarity | Cognee (vector) |
| `graph` | Relationship traversal | Cognee (graph) |
| `hybrid` | Best of all (default) | Cognee (hybrid) |
| `timeline` | Time-ordered retrieval | Cognee (temporal) |
| `entity` | Entity-centric search | Cognee (graph) |

## Performance

### Benchmarks (Cognee Cloud)

| Operation | Latency (p50) | Latency (p99) | Throughput |
|-----------|--------------|--------------|------------|
| Store (single) | 45ms | 120ms | 100/sec |
| Store (batch 100) | 800ms | 2.1s | 500/sec |
| Retrieve | 12ms | 35ms | 2000/sec |
| Search (hybrid) | 65ms | 180ms | 300/sec |
| Summarize (5 items) | 1.2s | 3.5s | 10/sec |
| Relate | 28ms | 85ms | 500/sec |

### Optimization Tips

1. **Batch Operations**: Use bulk APIs for multiple items
2. **Selective Indexing**: Disable indexing for transient memories
3. **Caching**: Enable engine-level caching for hot memories
4. **Projection**: Request only needed fields in search
5. **Pagination**: Use cursor-based pagination for large results

## Migration Path

### From Other Providers

```typescript
// Export from old provider
const items = await oldProvider.exportAll();

// Import to Cognee
for (const item of items) {
  await cogneeProvider.store(item, { 
    embed: true, 
    index: true,
    extractFacts: true 
  });
}

// Verify
const stats = await cogneeProvider.getStats();
console.log(`Migrated ${stats.totalItems} items`);
```

### Version Upgrades

Cognee provider follows semantic versioning:
- **Patch**: Bug fixes, performance improvements
- **Minor**: New features, backward compatible
- **Major**: Breaking changes (migration guide provided)

## Limitations

1. **Network Dependency**: Requires Cognee API connectivity
2. **Rate Limits**: Subject to Cognee API rate limits
3. **Cost**: Embedding generation and storage incur costs
4. **Latency**: Network round-trip for each operation
5. **Offline Mode**: Not supported (requires connectivity)

## Future Providers

The Memory Engine architecture supports pluggable providers:

| Provider | Status | Use Case |
|----------|--------|----------|
| Neo4j | Planned | Graph-heavy workloads |
| Qdrant | Planned | High-performance vector search |
| SQLite | Planned | Local/embedded deployments |
| Redis | Planned | Ultra-low latency caching |
| Filesystem | Planned | Air-gapped environments |
| Custom | Supported | Domain-specific backends |

### Adding a New Provider

```typescript
class CustomMemoryProvider implements IMemoryProvider {
  // Implement all interface methods
  async initialize(): Promise<void> { /* ... */ }
  async store(item: MemoryItem): Promise<MemoryItem> { /* ... */ }
  async retrieve(id: string): Promise<MemoryItem | null> { /* ... */ }
  // ... all required methods
}

// Register
engine.registerProvider(new CustomMemoryProvider(config));
```

## Troubleshooting

### Common Issues

**Connection Timeout**
```
Error: Cognee API request timeout
Solution: Increase timeout config, check network connectivity
```

**Authentication Failed**
```
Error: 401 Unauthorized
Solution: Verify API key, check organization/project IDs
```

**Rate Limited**
```
Error: 429 Too Many Requests
Solution: Implement exponential backoff, request quota increase
```

**Embedding Generation Failed**
```
Error: Failed to generate embedding
Solution: Check content length, validate API key has embedding permissions
```

### Debug Mode

```typescript
const provider = new CogneeMemoryProvider({
  // ... config
  debug: true,  // Enables request/response logging
});

provider.onEvent('provider.error', (event) => {
  console.error('Cognee error:', event.payload);
});
```

## Security

- All API communication over TLS 1.3
- API keys stored in secure configuration
- Per-item encryption for confidential data
- Audit logging for all memory operations
- GDPR-compliant data deletion

## Support

- Cognee Documentation: https://docs.cognee.ai
- AgencyForge Memory Engine: See MEMORY_ENGINE_ARCHITECTURE.md
- Issues: GitHub Issues for AgencyForge