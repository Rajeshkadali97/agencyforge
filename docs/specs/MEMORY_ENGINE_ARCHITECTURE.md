# Memory Engine Architecture

## Overview

The Memory Engine is a core subsystem of AgencyForge that provides persistent, structured, and queryable memory for all agents and modules. It transforms AgencyForge from a stateless system into a persistent AI Operating System that never forgets.

## Core Principles

1. **Provider-Based Architecture**: The Memory Engine never depends on a single storage backend. It uses a provider interface that supports multiple backends (Cognee, Neo4j, Qdrant, SQLite, Redis, Filesystem, etc.)

2. **Strong Typing**: Every memory item, query, and operation is strongly typed with TypeScript interfaces

3. **Event-Driven**: All memory operations emit events to the Kernel Event Bus for observability and integration

4. **Security First**: Built-in encryption, access control, and audit logging

5. **Lifecycle Management**: Complete memory lifecycle from store → extract → classify → index → embed → relate → summarize → retrieve → update → archive → expire

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Memory Engine                            │
├─────────────────────────────────────────────────────────────┤
│  Memory Modules (Type-Specific)                             │
│  ├── ShortTermMemory    ├── BusinessMemory                  │
│  ├── LongTermMemory     ├── UserMemory                      │
│  ├── SemanticMemory     ├── ProjectMemory                   │
│  ├── EpisodicMemory     ├── WorkflowMemory                  │
│  ├── ProceduralMemory   ├── AgentMemory                     │
│  ├── WorkingMemory      ├── KnowledgeMemory                 │
│  ├── ConversationMemory ├── DocumentMemory                  │
│  ├── DecisionMemory     ├── TaskMemory                      │
│  └── RelationshipMemory                                 │
├─────────────────────────────────────────────────────────────┤
│  Lifecycle Pipelines                                        │
│  ├── StorePipeline     ├── RetrievePipeline                 │
│  ├── UpdatePipeline    ├── DeletePipeline                   │
│  ├── ArchivePipeline   ├── MergePipeline                    │
│  ├── SummarizePipeline ├── RelatePipeline                   │
│  └── ExpirePipeline                                       │
├─────────────────────────────────────────────────────────────┤
│  Provider Registry & Manager                                │
├─────────────────────────────────────────────────────────────┤
│  Memory Providers (Pluggable)                               │
│  ├── CogneeProvider      ├── Neo4jProvider                  │
│  ├── QdrantProvider      ├── SQLiteProvider                 │
│  ├── RedisProvider       ├── FilesystemProvider             │
│  └── CustomProvider                                        │
├─────────────────────────────────────────────────────────────┤
│  Cross-Cutting Concerns                                     │
│  ├── Event Bus Integration    ├── Security Manager          │
│  ├── Shared Utilities         └── Type Definitions          │
└─────────────────────────────────────────────────────────────┘
```

## Memory Types

The Memory Engine supports 17 memory types, each with specialized modules:

| Type | Description | Use Case |
|------|-------------|----------|
| `short-term` | Ephemeral context window | Active conversation context |
| `long-term` | Persistent important memories | Consolidated knowledge |
| `semantic` | Concepts and facts | Knowledge base, concepts |
| `episodic` | Time-ordered experiences | Conversation history, timelines |
| `procedural` | Skills and procedures | Best practices, workflows |
| `working` | Agent scratchpad | Temporary notes, hypotheses |
| `business` | Business profiles | Companies, contacts, deals |
| `user` | User preferences & history | Personalization |
| `project` | Project context | Codebases, decisions, files |
| `workflow` | Workflow executions | Automation history |
| `agent` | Agent state & learning | Past work, preferences |
| `knowledge` | Curated knowledge | Documentation, standards |
| `conversation` | Chat history | Message threads |
| `document` | File contents | Code, docs, artifacts |
| `decision` | Recorded decisions | Architecture choices |
| `task` | Task context | Work items, progress |
| `relationship` | Entity connections | Graph relationships |

## Memory Item Structure

Every memory item contains:

```typescript
interface MemoryItem {
  id: string;                    // Unique identifier
  type: MemoryType;              // One of 17 types
  owner: string;                 // Owner (user, agent, system)
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  confidence: number;            // 0.0 - 1.0
  source: string;                // Origin (user_input, agent_output, etc.)
  embedding?: MemoryEmbedding;   // Vector embedding
  entities: MemoryEntity[];      // Extracted entities
  relationships: MemoryRelationship[]; // Graph relationships
  tags: string[];                // Searchable tags
  importance: number;            // 0.0 - 1.0
  visibility: MemoryVisibility;  // private | project | organization | public
  security: MemorySecurityLevel; // unclassified | internal | confidential | restricted
  summary: string;               // Human-readable summary
  rawContent: string;            // Full content
  metadata: Record<string, unknown>; // Extensible metadata
}
```

## Memory Lifecycle

### Store Pipeline
1. **Validate** - Type, required fields, confidence range
2. **Extract Facts** - Optional fact extraction via provider
3. **Classify** - Optional type classification
4. **Index** - Add to search indexes
5. **Embed** - Generate vector embeddings
6. **Relate** - Extract and store relationships
7. **Summarize** - Generate summary
8. **Persist** - Store via provider

### Retrieve Pipeline
1. **Select Providers** - Choose best providers for memory types
2. **Search** - Execute semantic/keyword/vector/graph search
3. **Retrieve by Query** - Fetch full items
4. **Rerank** - Optional cross-encoder reranking
5. **Filter** - Apply tags, importance, visibility, security
6. **Enrich** - Include embeddings, entities, relationships

### Update Pipeline
1. **Validate** - Check field constraints
2. **Update Embedding** - Regenerate if content changed
3. **Update Entities** - Re-extract entities
4. **Update Relationships** - Refresh relationships
5. **Update Summary** - Regenerate summary
6. **Update Importance** - Recalculate importance
7. **Persist** - Save changes

### Delete Pipeline
1. **Retrieve** - Get item for verification
2. **Archive** - Soft delete (move to archive)
3. **Delete from Provider** - Remove from storage
4. **Cleanup Relationships** - Remove reverse references
5. **Cleanup Index** - Remove from search indexes

### Archive Pipeline
1. **Retrieve** - Get item
2. **Create Archive Record** - Metadata for restoration
3. **Move to Archive Storage** - Provider-specific archive
4. **Remove from Active Index** - Exclude from normal search
5. **Update Archive Index** - Add to archive catalog

### Merge Pipeline
1. **Retrieve Both Items** - Get source and target
2. **Detect Conflicts** - Field-level comparison
3. **Resolve Conflicts** - Apply strategy (replace/merge/append/smart)
4. **Create Merged Item** - Combine with conflict resolution
5. **Persist Merged Item** - Store result
6. **Cleanup Source** - Archive or delete source

## Provider Interface

All providers implement `IMemoryProvider`:

```typescript
interface IMemoryProvider {
  // Lifecycle
  initialize(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  health(): Promise<ProviderHealth>;
  shutdown(): Promise<void>;

  // CRUD
  store(item: MemoryItem, options?: MemoryStoreOptions): Promise<MemoryItem>;
  retrieve(id: string): Promise<MemoryItem | null>;
  update(id: string, updates: Partial<MemoryItem>, options?: MemoryUpdateOptions): Promise<MemoryItem>;
  delete(id: string, permanent?: boolean): Promise<boolean>;
  archive(id: string, options: MemoryArchiveOptions): Promise<void>;
  merge(sourceId: string, targetId: string, options: MemoryMergeOptions): Promise<MemoryItem>;

  // Search & Retrieval
  search(query: MemoryQuery): Promise<MemorySearchResult[]>;
  retrieveByQuery(query: MemoryQuery, options?: RetrieveOptions): Promise<MemorySearchResult[]>;

  // AI Operations
  summarize(ids: string[]): Promise<string>;
  relate(sourceId: string, targetId: string, relationshipType: string, properties?: Record<string, unknown>): Promise<void>;

  // Admin
  getStats(): Promise<MemoryStats>;
  listTypes(): MemoryType[];
  supportsType(type: MemoryType): boolean;

  // Events
  onEvent(type: MemoryEventType, handler: (event: unknown) => void): string;
  offEvent(subscriptionId: string): boolean;
}
```

## Provider Capabilities Matrix

| Capability | Cognee | Neo4j | Qdrant | SQLite | Redis | Filesystem |
|------------|--------|-------|--------|--------|-------|------------|
| Vector Search | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Keyword Search | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Graph Search | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Hybrid Search | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Timeline Search | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Entity Search | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Embeddings | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Knowledge Graph | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Fact Extraction | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Summarization | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Classification | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Relationships | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Transactions | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Encryption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Event Integration

All memory operations emit events to the Kernel Event Bus:

```typescript
// Memory Events
'memory.created'      // New memory stored
'memory.updated'      // Memory modified
'memory.deleted'      // Memory removed
'memory.archived'     // Memory archived
'memory.retrieved'    // Memory accessed
'memory.merged'       // Memories combined
'memory.expired'      // Memory auto-expired
'memory.forgotten'    // Memory permanently forgotten
'memory.pinned'       // Memory pinned
'memory.unpinned'     // Memory unpinned

// Knowledge Events
'knowledge.updated'   // Knowledge base changed
'knowledge.extracted' // Facts extracted

// Relationship Events
'relationship.created' // New connection
'relationship.updated' // Connection modified
'relationship.deleted' // Connection removed

// Entity Events
'entity.created'      // New entity
'entity.updated'      // Entity modified
'entity.deleted'      // Entity removed

// Fact Events
'fact.extracted'      // Fact from content
'fact.verified'       // Fact confirmed
'fact.deprecated'     // Fact outdated

// Provider Events
'provider.connected'  // Provider online
'provider.disconnected' // Provider offline
'provider.error'      // Provider error

// System Events
'storage.quota.warning'   // Storage warning
'storage.quota.exceeded'  // Storage full
```

## Security Model

### Visibility Levels
- `private` - Owner only
- `project` - Project members
- `organization` - Organization members
- `public` - Anyone

### Security Levels
- `unclassified` - No restrictions
- `internal` - Internal use only
- `confidential` - Encrypted at rest
- `restricted` - Encrypted + access logged

### Encryption
- AES-GCM 256-bit for confidential/restricted items
- Per-item encryption keys
- Automatic key rotation (configurable)

### Access Control
- Owner always has full access
- Role-based permissions (admin, member, viewer)
- Explicit ACL entries per item
- Project/organization scoping

## Integration Points

### Kernel
- Event Bus for all memory operations
- Configuration management
- Logging infrastructure

### Research Engine
- Business memory for company profiles
- Knowledge memory for research findings
- Semantic search for competitive intelligence

### Revenue Engine
- Business memory for leads and deals
- Conversation memory for communications
- Decision memory for proposals

### Dashboard
- Retrieval for briefings and notifications
- Search for activity feeds
- Timeline for project views

### Voice
- Short-term memory for context
- Conversation memory for history
- User memory for preferences

### Character System
- Episodic memory for personality
- Agent memory for agent state
- Relationship memory for social graph

### Planner
- Procedural memory for best practices
- Project memory for constraints
- Decision memory for past choices

### Workflow Engine
- Workflow memory for execution history
- Task memory for progress tracking
- Decision memory for approvals

## Performance Considerations

1. **Caching**: Hot memories cached in-memory (LRU)
2. **Batching**: Batch operations for bulk inserts
3. **Async Pipelines**: Non-blocking lifecycle operations
4. **Connection Pooling**: Provider connection management
5. **Index Optimization**: Provider-specific index tuning

## Future Extensions

1. **Reasoning Engine Integration** - Memory as context for LLM reasoning
2. **Multi-Modal Memory** - Images, audio, video support
3. **Federated Memory** - Cross-organization memory sharing
4. **Memory Compression** - Automatic summarization of old memories
5. **Predictive Retrieval** - Pre-fetch based on agent goals
6. **Memory Versioning** - Full history with branching