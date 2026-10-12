# Agent Contract for AgencyForge

> **Version:** 1.0-draft
> **Status:** Specification
> **Scope:** Defines the canonical contract between the AgencyForge Kernel and all agents, including registration, quality, lifecycle, and memory obligations.

---

## 1. Purpose and Scope

This document is the canonical contract (`AGENT_CONTRACT`) that all agents must adhere to. It is referenced by the Kernel Spec (`KERNEL_SPEC.md`), Task Graph (`TASK_GRAPH.md`), Memory Architecture (`MEMORY_ARCHITECTURE.md`), Model Routing (`MODEL_ROUTING.md`), and Global Rules (`GLOBAL_RULES.md`).

All references to `AGENT_CONTRACT.md` across the AgencyForge codebase resolve to this document.

---

## 2. Agent Registry

The Kernel maintains an **Agent Registry** cataloging every registered agent.

### 2.1 Registry Fields

| Field | Description |
|-------|-------------|
| `agent_id` | Unique identifier (e.g., `studio.website.builder`) |
| `name` | Human-readable agent name |
| `version` | Semantic version of the agent's contract |
| `capabilities` | List of functions or tags the agent can perform |
| `input_schema` | JSON schema for structured input |
| `output_schema` | JSON schema for structured output |
| `cost_profile` | Estimated cost per invocation (tokens, compute, API) |
| `latency_profile` | Typical execution time (e.g., fast <2s, medium <10s, slow >30s) |
| `health` | `healthy`, `degraded`, `unavailable` |
| `dependencies` | Other `agent_id`s or modules required |

### 2.2 Registration
- New agents register via the Kernel's plugin interface.
- A valid agent MUST implement the interface defined in this contract.

---

## 3. Agent Lifecycle

Every agent progresses through a set of states managed by the Kernel.

### 3.1 Lifecycle States
- `registered`: The agent has been validated and added to the Agent Registry.
- `idle`: The agent is healthy and awaiting a task.
- `assigned`: The agent has been assigned a task but has not yet started execution.
- `running`: The agent is actively executing a task.
- `paused`: The agent's task has been paused (e.g., awaiting human approval).
- `completed`: The agent successfully finished its task.
- `failed`: The agent encountered an unrecoverable error.
- `shut_down`: The agent has been gracefully decommissioned.

### 3.3 Approval Gates
Some state transitions require explicit human approval. When a task hits a Human Approval Node, the agent's task (and thus the agent's state) transitions to `paused` until the human provides a `PROCEED` or `ABORT` signal. Rejection rolls back the agent to `idle` and may trigger a rework request.

### 3.2 State Transitions
Transitions between states MUST be emitted as events to the Event Bus (see `TASK_GRAPH.md`).

---

## 4. Handoff Protocol

When a task is split across multiple agents, the **Handoff Packet** defines how state and artifacts are transferred.

### 4.1 Handoff Packet Schema
```jsonc
{
  "handoff_id": "uuid",
  "from_agent_id": "...",
  "to_agent_id": "...",
  "task_id": "...",
  "stage": "...",
  "payload": {
    "outputs": [],
    "metadata": {},
    "status": "COMPLETED"
  },
  "context_bundle_hash": "sha256(...)"
}
```

### 4.2 Rules
- A handoff MUST only occur after the `from_agent` reaches the `completed` state and the task reaches `COMPLETED`.
- The Kernel validates the `context_bundle_hash` before dispatching to the `to_agent`.
- Handoffs are logged immutably.

---

## 5. Quality Scoring

Every agent output is subject to a standard quality scoring rubric.

### 5.1 Dimensions
| Dimension | Definition |
|-----------|------------|
| **Completeness** | Does the output satisfy all explicit requirements of the task directive? |
| **Correctness** | Is the output accurate, valid, and free of errors? |
| **Efficiency** | Was the output produced with an acceptable cost/latency profile? |
| **Clarity** | Is the output structured, readable, and unambiguous for downstream consumers? |

### 5.2 Scoring
- Each dimension is scored on a 0-10 scale.
- A total score < 7 in any dimension triggers a review or rework request.
- Scores are persisted in the Audit Trail.

---

## 6. Deployment Pipeline

Agents MUST NOT modify their own runtime logic. All updates follow this pipeline.

### 6.1 Versioning
- Changes are versioned in the Agent Registry.
- Breaking changes require a major version bump.

### 6.2 Deployment Rules
```
1. Update source code / configuration in a staging environment.
2. Submit a `Deployment Request` to the Kernel.
3. Kernel validates the new contract against `AGENT_CONTRACT.md`.
4. If valid, the Kernel swaps the active version atomically.
5. Rollback to the previous version is automatic if health checks fail.
```

---

## 7. Memory Permissions

Memory access is strictly controlled by the Kernel. Agents MUST NOT access memory stores directly.

### 7.1 Scope
- An agent can only READ/WRITE to its assigned project scope (see `MEMORY_ARCHITECTURE.md`).
- No agent can access User Episodic Memory (L5) without an explicit, logged user or Kernel grant.
- Global Knowledge (L6) is read-only for agents.

### 7.2 Enforcement
- The Kernel validates every memory operation against this contract.
- Violations trigger an immediate audit event and may result in agent termination.

---

## 8. Glossary

| Term | Definition |
|------|------------|
| **Agent** | A specialized worker that performs a task with a defined capability set. |
| **Agent Registry** | The Kernel's live catalog of all registered agents. |
| **Handoff Packet** | The structured message that marshals state between agents. |
| **Quality Score** | The 4-dimensional metric for evaluating agent output. |
