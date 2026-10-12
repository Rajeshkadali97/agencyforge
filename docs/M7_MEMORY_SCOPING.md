# M7 — Memory Scoping Analysis

## Decision record (standing)

> "memory-engine owns: episodic memory, semantic memory, long-term memory.
> kernel/src/memory owns: BusinessProfile, AgentProfile, ProjectProfile.
> The Kernel should reference memory-engine through interfaces rather than duplicating cognitive memory."
> — CTO directive, Session 1

---

## Two memory systems, two responsibilities

| | `memory-engine/` | `kernel/src/memory/` |
|---|---|---|
| **Role** | Cognitive memory substrate | Structured domain-profile store |
| **Unit** | `MemoryItem` | `Memory`, `Entity`, `Relationship`, `Fact` |
| **API style** | Rich sub-modules (16 typed) | Flat provider-based + `Result<T>` |
| **Domain objects** | `IBusinessMemory`, `IAgentMemory`, `IProjectMemory` (modules) | `BusinessProfile`, `AgentProfile`, `ProjectProfile` (entity types) |
| **Primary consumers** | Runtime agents needing episodic/semantic recall | Kernel planner needing structured org data |
| **Provider mechanism** | `IMemoryProvider` (pluggable backend) | `MemoryProvider` + Cognee adapter |

---

## Overlap analysis

### Business data
- `memory-engine` exposes `IBusinessMemory` — rich cognitive record (website, industry, contacts, proposals, SEO, tech stack, timeline)
- `kernel/src/memory` stores `BusinessProfile` — thin entity for planning (name, industry, website)

**Resolution:** Not duplication — different fidelity. Kernel writes `BusinessProfile` INTO memory-engine via `storeBusinessProfile()`. Memory-engine stores the episodic record; kernel holds the planning ref.

### Agent data
- `memory-engine` exposes `IAgentMemory` — past work, preferences, mistakes, goals, workflows
- `kernel/src/memory` stores `AgentProfile` — registration record (capabilities, status, lastSeen)

**Resolution:** `AgentProfile` = kernel-side registration. `IAgentMemory` = cognitive history. Kernel writes profile on agent registration; memory-engine stores episodic record.

### Project data
- `memory-engine` exposes `IProjectMemory` — timeline, files, decisions, tasks, deliverables
- `kernel/src/memory` stores `ProjectProfile` — planning metadata (owner, status, goals)

**Resolution:** Same bridge pattern — kernel writes thin profile, memory-engine owns full context.

---

## Canonical ownership boundaries

```
memory-engine owns:
  EpisodicMemory     — what happened, when, in what sequence
  SemanticMemory     — concept graphs, embeddings, similarity
  LongTermMemory     — consolidated knowledge, archiving
  WorkingMemory      — current session scratch pad
  ProceduralMemory   — how-to knowledge, execution history
  KnowledgeMemory    — domain knowledge base
  ConversationMemory — message history, summaries
  DocumentMemory     — file/doc storage with versioning
  DecisionMemory     — rationale, alternatives, ADRs
  TaskMemory         — task context, assignment history
  RelationshipMemory — entity graph edges
  BusinessMemory     — full business history (cognitive)
  AgentMemory        — full agent history (cognitive)
  ProjectMemory      — full project history (cognitive)
  UserMemory         — full user history (cognitive)
  WorkflowMemory     — workflow execution context

kernel/src/memory owns:
  BusinessProfile    — thin planning record (name, industry, website)
  AgentProfile       — agent registration record (id, capabilities, status)
  ProjectProfile     — project planning record (owner, status, goals)
```

---

## Integration contract

The kernel `IMemoryEngine` (`kernel/src/memory/interfaces/memory-engine.ts`) is the **kernel's view** of memory — thin, planning-focused, provider-backed.

The `memory-engine` `IMemoryEngine` (`memory-engine/src/interfaces/IMemoryEngine.ts`) is the **runtime's cognitive substrate** — rich, module-based, full lifecycle.

**The two engines are NOT the same interface.** The kernel engine wraps the memory-engine as one of its providers.

```
kernel.MemoryProvider  ←implemented by→  memory-engine adapter
```

`memory-engine/src/kernel-bridge.ts` already exists as the integration point.

### Bootstrap wire-up (M8 dependency)
```typescript
const cognitiveMemory = new MemoryEngine(config);      // memory-engine
const kernelAdapter = new MemoryEngineKernelAdapter(cognitiveMemory);
kernelMemory.registerProvider(kernelAdapter);
```

---

## Anti-patterns

| Anti-pattern | Why prohibited |
|---|---|
| Kernel imports memory-engine modules directly | Tight coupling; violates layer boundary |
| Runtime stores profiles only in kernel memory | Misses cognitive history; no semantic search on leads |
| memory-engine and kernel store separate copies of BusinessProfile | Data divergence; two sources of truth |
| Runtime calls kernel memory for episodic/semantic ops | Wrong layer; kernel has no embedding/similarity support |

---

## Status

- `memory-engine/src/kernel-bridge.ts` — exists
- `kernel/src/memory/runtime-integration.ts` — exists
- Runtime bootstrap wire-up — NOT YET DONE (M8 scope)
- Cognee provider `kernel/src/memory/cognee/` — present
