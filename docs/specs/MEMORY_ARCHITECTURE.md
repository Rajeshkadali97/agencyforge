# Memory Architecture for AgencyForge

## 1. Purpose and Philosophy

Memory is the substrate of intelligence in AgencyForge. It is not a passive storage layer but an active system that determines what an agent knows, what it can reason about, and how it adapts over time.

The AgencyForge memory system is guided by the following principles:

### 1.1. Contextual Relevance
Memory is not recalled by ID alone. It is retrieved based on semantic relevance, recency, importance, and the active task context. The goal is to surface the right information at the right time.

### 1.2. Hierarchical Integrity
AgencyForge organizes memory into a strict hierarchy. Higher layers are faster, smaller, and more ephemeral. Lower layers are slower, larger, and more persistent. The system must respect these boundaries when loading and unloading.

### 1.3. Multi-Tenant Isolation
Memory is scoped. An agent's private memories must not leak to other agents. Project memories must not leak across projects. User memories are sacred and user-owned.

### 1.4. Active Management
Memory is not infinite. AgencyForge must intelligently compress, prune, and age memories to prevent bloat while minimizing the loss of useful information.

## 2. Memory Hierarchy (L0–L7)

The AgencyForge memory hierarchy consists of eight layers. Each layer has defined load/unload triggers, latency characteristics, and persistence guarantees.

### 2.1. L0: Instant Register Memory
- **Scope**: The most volatile layer. Holds the active task ID, user ID, current tick count, and a pointer to the active context window.
- **Persistence**: Ephemeral. Lost on agent tick completion.
- **Latency**: ~1 nanosecond.
- **Loaded When**: Automatically on every agent tick. Always available.
- **Unloaded When**: Tick execution completes.

### 2.2. L1: Core Context Window
- **Scope**: The immediate semantic prompt. This is the active text block (words, tokens, images) given directly to the model for inference.
- **Persistence**: Ephemeral within the session. Constructed fresh for every inference call.
- **Latency**: ~1 millisecond to construct.
- **Loaded When**: Prior to every model inference.
- **Unloaded When**: Inference completes. The output is written to L2.
- **Optimization**: Optimized for 1M+ token models by loading large, coherent chunks. For smaller models, a compression pipeline (see Section 10) MUST run first.

### 2.3. L2: Conversation Trail
- **Scope**: The canonical, chronological history of a single conversation. Contains every user message, agent action, tool call, and reasoning step.
- **Persistence**: Persisted to Session Storage. Cleared only when the user explicitly closes the session.
- **Latency**: ~10 milliseconds to retrieve a standard session.
- **Loaded When**: On context reconstruction for the next inference step.
- **Unloaded When**: Session terminates. The full trail is summarized and moved to L4 (Project Memory).
- **Note**: This is the source of truth for "what happened in this chat." It must never be conflated with L3 summaries.

### 2.4. L3: Working Memory
- **Scope**: The agent's self-management scratchpad. Notes to self, intermediate deductions, active goals, reminders, and hypothesis tracking.
- **Persistence**: Session-scoped by default. Can be promoted to Project Memory if tagged.
- **Latency**: ~5 milliseconds.
- **Loaded When**: On agent initialization. Refreshed during execution loops.
- **Unloaded When**: Agent hibernates or session ends. If promoted, it is written to L4.

### 2.5. L4: Project Memory
- **Scope**: All facts, constraints, design decisions, and history relevant to a specific project or codebase.
- **Persistence**: Long-term. Stored in the project directory or the central Project Store.
- **Latency**: ~50 milliseconds for local I/O.
- **Loaded When**: An agent is assigned a task with a `project_id`.
- **Unloaded When**: The agent's last task for that project is completed. Stays in local cache until garbage collected.

### 2.6. L5: User Episodic Memory
- **Scope**: Long-term facts about the user. Preferences, habits, past interactions, corrections, and stated goals.
- **Persistence**: Indefinite. Tied to the `user_id`.
- **Latency**: ~100 milliseconds to fetch the active profile.
- **Loaded When**: On session start. The Kernel injects the user profile into the context.
- **Unloaded When**: Session ends.

### 2.7. L6: Global Knowledge Base
- **Scope**: Static, curated knowledge. Coding standards, framework documentation, legal templates, historical project data, and domain-specific ontologies.
- **Persistence**: Indefinite.
- **Latency**: Depends on storage backend. The Vector DB (see Section 8) is the primary interface.
- **Loaded When**: On demand. Retrieved via semantic search when the agent queries for it.
- **Unloaded When**: Immediately after use, unless cached.

### 2.8. L7: Deep Archive (Cold Storage)
- **Scope**: Final resting place for old memories that have been pruned or aged out of higher layers.
- **Persistence**: Immutable. Write-once, read-rarely.
- **Latency**: Seconds to minutes.
- **Loaded When**: Explicitly requested via a Deep Archive recovery process.
- **Unloaded When**: Recovery process completes.

## 3. Memory Categories

### 3.1. Session Memory
- **Definition**: All state associated with an active user session.
- **Scope**: Single session. Ephemeral.
- **Contents**: The Conversation Trail (L2) and temporary Working Memory (L3).
- **Lifecycle**: Born when the user starts an interaction. Dies when the session is explicitly closed or times out. On death, it is summarized and written to Project Memory (L4).

### 3.2. Conversation Memory
- **Definition**: The detailed, unaltered log of a conversation, as distinct from its summary.
- **Scope**: A single session.
- **Role**: Source material for summaries, audits, and debugging. It is NOT the primary context for reasoning. Summaries are.

### 3.3. Working Memory
- **Definition**: The agent's active mental scratchpad.
- **Scope**: Per-agent instance. Can be promoted to Project Memory.
- **Role**: Holds partially formed ideas, sub-goals, and "to-do" items for the current task. It is the primary surface that the agent manipulates directly via tools.

### 3.4. Project Memory
- **Definition**: The persistent record of a specific project.
- **Scope**: All sessions and agents working on a `project_id`.
- **Role**: Ensures continuity across sessions. Contains the "what are we building and why" context.

### 3.5. User Memory
- **Definition**: The long-term profile of a user.
- **Scope**: Global to the user.
- **Role**: Personalizes agent behavior. Contains style preferences, technical stack preferences, and a history of past corrections.

### 3.6. Global Knowledge
- **Definition**: Static or semi-static reference material.
- **Scope**: Organization-wide.
- **Role**: Provides a source of truth for standard operating procedures, coding practices, and documentation.

## 4. Vector Database (Semantic Memory)

The Vector DB is the heart of the AgencyForge retrieval system. It allows the system to find information based on meaning rather than simple keyword matching.

### 4.1. Role
It is the primary interface between the raw text inputs and the structured memory hierarchy. All long-term memories (L4, L5, L6) are decomposed into chunks and stored in the Vector DB.

### 4.2. Chunking Strategy
- Documents are split into chunks of a configurable size (e.g., 512 tokens) with configurable overlap (e.g., 128 tokens).
- Code is parsed and split by function, class, or module boundaries where possible (AST-based chunking).
- Chunks are tagged with their source layer (L4, L5, L6), `project_id`, `user_id`, and creation timestamp.

### 4.3. Embedding Model
- A dedicated, language-optimized embedding model MUST be used for generating vector representations.
- The model choice is configurable but defaults to a high-quality, general-purpose model to avoid quality drift.

## 5. Obsidian Vault Integration

AgencyForge supports bidirectional integration with an Obsidian vault for human-in-the-loop knowledge management.

### 5.1. Agent to Obsidian
- Agents can write Markdown summaries of completed tasks, new findings, or architectural decisions to a designated Obsidian vault directory.
- Links between notes are automatically generated based on shared `project_id` or semantic similarity.
- This serves as a human-readable audit trail of the agent's work.

### 5.2. Obsidian to Agent
- The content of the Obsidian vault is periodically indexed and embedded into the Global Knowledge (L6) or Project Memory (L4).
- When a user references a note by name or topic, the agent should search the vectorized Vault contents for context.

### 5.3. Metadata Handling
- Standard Obsidian YAML front-matter (tags, aliases, creation date) MUST be parsed and stored as metadata in the Vector DB to improve retrieval.

## 6. Claude Mem Integration

Where applicable, AgencyForge provides a structure to interact with or emulate the behavior of extended context systems, respecting their specific constraints.

### 6.1. Historical Context Preservation
AgencyForge should preserve the chronological context of long projects in a way that is compatible with extended reasoning models, using summaries to bridge large gaps in time.

### 6.2. Structured Memories
Memories that need to be referenced as absolute facts (like a configuration, a user preference, or a core project rule) should be stored in a structured, easily parsable format (like JSON) rather than free text, to reduce ambiguity during retrieval.

## 7. Knowledge Graph

### 7.1. Purpose
A Knowledge Graph is used to capture and query explicit relationships between entities (files, people, concepts, projects) that are difficult to represent in a flat vector space.

### 7.2. Construction
- Extracted from structured data in `code`, `PBTXT` (prototypical data), and `json` files.
- Populated by agents when they perform actions like "create file A" or "link module B to C."

### 7.3. Querying
Agents use the graph to answer questions like "What files depend on this function?" or "Which agents worked on this module?" This is a supplement to, not a replacement for, semantic search.

## 8. Memory Indexing

### 8.1. Events to Index
Any event that changes system state or generates new knowledge MUST be indexed. This includes, but is not limited to: file creation, tool execution, completed tasks, error events, and human corrections.

### 8.2. Indexing Pipeline
- **Ingest**: Raw text is collected.
- **Clean**: Redundant whitespace, system noise, and sensitive data are removed.
- **Chunk**: Text is broken into semantically meaningful chunks.
- **Embed**: Each chunk is converted to a vector.
- **Store**: The vector, the raw text, and the metadata are written to the Vector DB.

## 9. Semantic Search

### 9.1. Query Flow
- The agent formulates a query.
- The query is embedded using the same model as the index (Section 4.3).
- A vector similarity search is performed against the chosen scope (Session, Project, User, Global).

### 9.2. Result Ranking
- Results are ranked by cosine similarity or equivalent distance metric.
- Re-ranking can be applied by a cross-encoder model to improve precision.

### 9.3. Post-Processing
- Retrieved chunks are de-duplicated.
- Gaps are filled. If two chunks are retrieved but their neighbors are missing, the system may opt to retrieve the entire intervening block for better coherence.

## 10. Context Compression

To optimize for both 1M+ token models and smaller ones, AgencyForge employs a context compression pipeline.

### 10.1. When to Compress
- The context window exceeds the model's safe limit (e.g., 90% of `context_window`).
- The user has explicitly set a `context_budget` constraint.
- The cost of the full context is estimated to exceed the `cost_per_task` threshold.

### 10.2. How to Compress
- **Summarization**: Iteratively replace older conversation turns with summaries.
- **Selective Dropping**: Drop low-importance or outdated Working Memory notes.
- **Elite Pruning**: Summarize the tail of the conversation and move it to Project Memory, replacing the detailed log.

### 10.3. Reversibility
- Compression MUST be non-destructive. The full conversation trail is preserved in L2 or L4.
- Only the active context window (L1) is compressed.

## 11. Context Expansion

When a model with a very large context window (e.g., Gemini 1.5 Pro) is used, AgencyForge must ensure the context is rich enough.

### 11.1. Strategies
- **Full Codebase Loading**: For coding tasks, load the most relevant files in full rather than chunking.
- **Deep History**: Include a much longer conversation trail without summarizing.
- **Multi-Document Synthesis**: Include several full reference documents (e.g., 5 different project RAG documents) in a single prompt.

## 12. Memory Pruning

Pruning is the deletion of low-value memories to free resources.

### 12.1. Automatic Pruning
- Old Session Memories (L2) are pruned after a configurable time (e.g., 30 days of inactivity).
- The pruned data is summarized and moved to L4 or L7.

### 12.2. Manual Pruning
- Users or agents with appropriate permissions can trigger a manual prune of Project or User memory.
- This is a soft delete; the memory is moved to L7 and marked for eventual purging.

## 13. Memory Aging

### 13.1. Relevance Decay
Memories lose relevance over time. The retrieval system applies a decay function to the initial similarity score. A memory from two years ago is less valuable than an identical memory from yesterday.

### 13.2. Refresh Triggers
When a user actively references an old memory, its "last accessed" timestamp is updated, resetting its age and boosting its relevance, effectively "refreshing" it.

## 14. Memory Importance Scoring

Every memory chunk is assigned an score between 0.0 and 1.0.

### 14.1. Factors
- **Human Feedback**: The user explicitly starring, correcting, or emphasizing a memory raises its score.
- **Usage Frequency**: Frequently retrieved memories get a small positive boost.
- **Source Layer**: Agent actions might have a higher base score than auto-generated summaries.
- **Sentiment/Negativity**: Error logs and failed task reports might have their importance capped or weighted differently to prevent them from overwhelming positive context.

## 15. Retrieval Pipeline

The standard process for retrieving context is:

1.  **Scope Selection**: Kernel identifies the relevant layers (L2, L3, L4, etc.).
2.  **Query Expansion**: The raw task is expanded into multiple semantic queries.
3.  **Vector Search**: Queries are run against the L4-L6 Vector DB (or L2 if the task requires conversation history).
4.  **Graph Traversal**: Relevant nodes are found in the Knowledge Graph.
5.  **Ranking & Re-ranking**: Results are sorted.
6.  **Context Assembly**: The top N results are assembled into a coherent block.
7.  **Compression**: The block is compressed if necessary (Section 10).
8.  **Injection**: The final block is injected into L1.

## 16. Cache Strategy

### 16.1. L1 Cache (Hot Memory)
- The most recently accessed L4 and L6 chunks are kept in an in-memory LRU (Least Recently Used) cache.
- Access time: ~1 millisecond.

### 16.2. L2 Cache (Warm Memory)
- Recently closed sessions and their summaries.
- Access time: ~10 milliseconds.

## 17. Cross-Agent Shared Memory

Agents working on the same `project_id` share L4 (Project) memory. Changes made by one agent MUST be visible to another in near real-time (within the Vector DB's eventual consistency window).

## 18. Private Agent Memory

A specific instance or version of an agent may have an L3 (Working Memory) that is NOT shared. This is used for the agent's own "thoughts" and internal state that would not be useful to others.

## 19. Memory Permissions

The following rules are enforced by the Kernel, as referenced in `AGENT_CONTRACT.md`:
- An agent can only READ/WRITE to its assigned project scope.
- No agent can access User Episodic Memory (L5) without an explicit, logged user or Kernel grant.
- Global Knowledge (L6) is read-only for agents.

## 20. Memory Encryption

### 20.1. At Rest
- User Episodic Memory (L5) MUST be encrypted at rest using a user-provided or system-generated key.
- Project Memory (L4) containing sensitive IP MUST also be encrypted.

### 20.2. In Transit
- All memory transfers between agents, the Kernel, and storage backends MUST use TLS 1.3 or higher.

## 21. Backup Strategy

- Project Memories (L4) and User Memories (L5) MUST be backed up incrementally every 24 hours.
- Session Memories (L2) are not backed up; they are ephemeral.
- The Vector DB's index must be periodically snapshotted for disaster recovery.

## 22. Import / Export

- Users MUST be able to export their User Memory (L5) and Project Memory (L4) as standard, structured data formats (e.g., JSON, Markdown).
- Imports MUST be validated and sanitized before being written to the main store.

## 23. Recovery Strategy

- If the Vector DB is corrupted or lost, it can be rebuilt by re-indexing the contents of L4, L5, and L6 from their primary storage.
- The Knowledge Graph can be rebuilt by re-parsing the relevant source files.

## 24. Future Memory Providers

The AgencyForge memory architecture is designed to be backend-agnostic.

### 24.1. Extensibility
- New vector DBs, graph databases, or raw storage systems can be added by conforming to the standard `MemoryInterface`.
- The core routing and agent logic MUST NOT change when the underlying provider is swapped.

### 24.2. Supported Backends
While the architecture is generic, tested primary implementations are expected for tier-1 backends like Chroma, Pinecone, and Weaviate for the Vector DB, and Neo4j or similar for the Knowledge Graph.
