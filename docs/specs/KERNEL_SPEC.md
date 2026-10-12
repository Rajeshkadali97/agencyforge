# AgencyForge — Kernel Specification

> **Version:** 1.0-draft  
> **Status:** Specification  
> **Scope:** Define the architecture, responsibilities, and operational contracts of the AgencyForge Kernel. No implementation code is contained herein.

---

## 1. Purpose

The Kernel is the **central orchestrator** of AgencyForge. It does not generate websites, design assets, or sales copy itself. Its sole job is to **understand intent, decompose goals, select the right minds (agents and models), orchestrate execution, and manage quality**.

Think of the Kernel as the operating system's scheduler + memory manager + process supervisor, but for creative and business workflows.

---

## 2. Responsibilities

| # | Responsibility | Description |
|---|----------------|-------------|
| 1 | **Intent Resolution** | Parse and disambiguate user input (natural language, structured briefs, or system events) into a formal, unambiguous goal. |
| 2 | **Task Decomposition** | Break a high-level goal into a directed acyclic graph (DAG) of discrete, executable tasks. |
| 3 | **Agent Selection** | Match each task to the best available agent based on capability, availability, and cost. |
| 4 | **Model Routing** | Route each agentic step to the most appropriate underlying AI model (LLM, image model, code model, etc.). |
| 5 | **Memory Loading** | Inject the correct context — project history, user preferences, past outputs, and relevant external data — into each task before execution. |
| 6 | **Execution Orchestration** | Execute tasks in the correct order, handling parallelism where safe and dependencies where required. |
| 7 | **Output Review** | Evaluate outputs against expected quality and format. Flag for rework or human review. |
| 8 | **Stage Handoff** | When a stage completes, marshal outputs and hand them cleanly to the next stage's input. |
| 9 | **State & Persistence** | Maintain the ground-truth state of every running workflow — what happened, what is happening, and what is next. |
| 10 | **Observability** | Emit structured logs, metrics, and traces for every decision and action. |

---

## 3. Architectural Principles

1. **The Kernel is Dumb About Domains** — It knows nothing about websites, sales, or design. It only knows how to route tasks to things that do.
2. **Everything is a Task** — An agent invocation, a human approval, a model call, a memory fetch: all are tasks in the execution graph.
3. **Context is Capped, Not Infinite** — Memory loading always respects model context limits. Summarization and retrieval are first-class concerns.
4. **Fail Noisy, Retry Safe** — Errors are surfaced immediately; retries are bounded and instrumented.
5. **Humans Are Just Another Agent** — Human approval steps are modeled identically to agent steps in the DAG, just with a different execution backend.

---

## 4. Execution Lifecycle

Every goal that enters the Kernel follows this lifecycle:

### 4.1 Lifecycle Stages

```
┌─────────────────┐
│   1. INGEST     │  ← User input, system event, scheduled trigger
└────────┬────────┘
         │
┌────────▼────────┐
│   2. PARSE      │  ← Intent resolution, entity extraction, goal formalization
└────────┬────────┘
         │
┌────────▼────────┐
│   3. PLAN       │  ← Decompose into DAG of tasks; resolve dependencies
└────────┬────────┘
         │
┌────────▼──────────────────────────────────┐
│   4. PREPARE    │  ← Agent selection, model routing, memory loading
└────────┬────────────────────────────────────┘
         │
┌────────▼──────────────────────────────────┐
│   5. EXECUTE    │  ← Dispatch tasks; handle sync, async, parallel, sequential
└────────┬────────────────────────────────────┘
         │
┌────────▼────────┐
│   6. REVIEW     │  ← Quality gates, validation, human checkpoints
└────────┬────────┘
         │
┌────────▼────────┐
│   7. HANDOFF    │  ← Marshal outputs, emit events, trigger downstream
└─────────────────┘
```

### 4.2 Stage Details

| Stage | Input | Output | Decision Authority |
|-------|-------|--------|---------------------|
| **Ingest** | Raw input (text, file, event) | Formalized `Goal` object | Kernel (parsing rules) |
| **Parse** | `Goal` | Decomposed `Intent` with entities and constraints | Kernel (intent engine) |
| **Plan** | `Intent` | `TaskGraph` (DAG of `Task` nodes) | Kernel (planning engine) |
| **Prepare** | `TaskGraph` | `ReadyTask` (task + agent + model + context) | Kernel (selection & routing) |
| **Execute** | `ReadyTask` | `TaskResult` (output + metadata + state changes) | Agent / Runtime |
| **Review** | `TaskResult` | `ValidatedResult` or `ReworkRequest` | Kernel + optional Human |
| **Handoff** | `ValidatedResult` | Event on bus; next `TaskGraph` scheduled | Kernel (orchestrator) |

### 4.3 Task Graph (DAG)

The `TaskGraph` is the canonical representation of a workflow plan. It is a directed acyclic graph where:
- **Nodes** = individual tasks
- **Edges** = dependencies (task B cannot start until task A succeeds)
- **Parallelism** = tasks with no shared dependencies may run concurrently
- **Branching** = conditional edges based on task output values

```
Example: Create a website
-------------------------
[Research] ──→ [Brand] ──→ [Design] ──→ [Build] ──→ [Deploy]
    │                             │
    └──→ [Content] ───────────────┘
```

---

## 5. Agent Selection Logic

### 5.1 Agent Registry
The Kernel maintains an **Agent Registry** — a live catalog of all registered agents, their capabilities, and their current health.

| Field | Description |
|-------|-------------|
| `agent_id` | Unique identifier (e.g., `studio.website.builder`) |
| `name` | Human-readable agent name |
| `version` | Semantic version of the agent's contract |
| `capabilities` | List of functions or tags the agent can perform (e.g., `generate-react-component`, `deploy-to-vercel`) |
| `input_schema` | JSON schema describing the structured input the agent expects |
| `output_schema` | JSON schema describing the structured output the agent produces |
| `cost_profile` | Estimated cost per invocation (tokens, compute, API spend) |
| `latency_profile` | Typical execution time (e.g., fast <2s, medium <10s, slow >30s) |
| `health` | Current status: `healthy`, `degraded`, `unavailable` |
| `dependencies` | Other `agent_id`s or modules required |

### 5.2 Selection Algorithm

For a given `Task`, the Kernel selects an agent using a **scored ranking**:

1. **Capability Filter** — Eliminate agents that do not declare the required capability.
2. **Schema Match** — Rank agents higher whose `input_schema` and `output_schema` align closely with the task's expected I/O.
3. **Health Gate** — Discard agents with `health != healthy`.
4. **Cost/Latency Heuristic** — For non-urgent tasks, prefer lower-cost or faster agents if multiple candidates remain.
5. **Tie-Break** — If multiple agents are equally viable, default to the one with the highest version number or the one historically associated with the current `project_id`.

### 5.3 Fallback Strategy
- If the primary selected agent fails, the Kernel attempts the next-ranked agent.
- If no agents are available, the task is suspended and a human is alerted.
- Agents may be marked as `default` for a capability, ensuring a predictable fallback.

---

## 6. Model Routing Strategy

The Kernel does not care what model an agent uses internally, but it **must** know the model's profile for cost, latency, and capability reasons.

### 6.1 Model Registry
Similar to the Agent Registry, the Kernel maintains a **Model Registry**:

| Field | Description |
|-------|-------------|
| `model_id` | Unique identifier (e.g., `gpt-4o`, `claude-3.5-sonnet`, `dalle-3`) |
| `provider` | Service provider (e.g., `openai`, `anthropic`, `google`) |
| `type` | Classification: `llm`, `image`, `audio`, `video`, `code`, `embedding` |
| `capabilities` | Tags describing strengths (e.g., `coding`, `reasoning`, `vision`, `long-context`) |
| `context_window` | Maximum tokens supported |
| `cost_per_1k_tokens` | Input/output pricing |
| `supports_tools` | Boolean: can this model invoke external tools? |
| `supports_structured_output` | Boolean: can this model reliably return JSON/schema? |

### 6.2 Routing Decision

When an agent requests a model, or when the Kernel itself needs a model for meta-reasoning (e.g., planning, summarization), it consults the Model Registry:

1. **Task-to-Model Mapping** — The task definition may specify a preferred model or model type.
2. **Capability Matching** — The Kernel selects the cheapest model that satisfies all required capabilities for the task.
3. **Context Window Check** — The estimated prompt size must fit within the model's `context_window`. If not, the Kernel either truncates/summarizes or upgrades to a larger model.
4. **Budget Guardrail** — If the projected cost exceeds the project's budget limit, the Kernel either escalates to a human or downgrades to a cheaper model with a warning.
5. **Latency Requirement** — Real-time or interactive tasks prefer low-latency models even if less capable.

### 6.3 Unified LLM Gateway
Direct model calls are forbidden. All model invocations go through a **gateway** that:
- Abstracts provider-specific APIs
- Handles retries, rate limits, and failover
- Logs all requests and responses
- Enforces budget and policy guardrails

---

## 7. Memory Loading Strategy

Memory in AgencyForge is not monolithic. The Kernel assembles **Context Bundles** from the memory tiers defined in `MEMORY_ARCHITECTURE.md`, loading only what is necessary to keep prompts lean and relevant. The canonical memory hierarchy spans eight tiers (L0–L7); for orchestration, the Kernel primarily concerns itself with the active tiers outlined below.

### 7.1 Active Memory Tiers

| Tier | Name | Description | Access Pattern |
|------|------|-------------|----------------|
| **L0** | **Instant Register Memory** | Active task ID, user ID, tick count, pointer to active context window. | Automatic on every agent tick. |
| **L1** | **Core Context Window** | The active semantic prompt constructed for the current inference call. | Always loaded. |
| **L2** | **Conversation Trail** | Canonical, chronological history of the current session (messages, actions, tool calls, reasoning steps). | Loaded for context reconstruction. |
| **L3** | **Working Memory** | Agent's self-management scratchpad: notes, deductions, goals, reminders, hypothesis tracking. | When agent is active. |
| **L4** | **Project Memory** | Persistent data for the active project (briefs, assets, outputs, design decisions). | Loaded when `project_id` is active. |
| **L5** | **User Episodic Memory** | Long-term user preferences, style guides, communication patterns, past corrections. | Loaded when `user_id` is identified. |
| **L6** | **Global Knowledge Base** | Company SOPs, brand rules, framework docs, world knowledge. | Retrieved on demand via RAG. |
| **L7** | **Deep Archive** | Immutable, write-once, read-rarely cold storage for pruned or aged memories. | Explicit recovery only. |

*For full persistence layer definitions, see `MEMORY_ARCHITECTURE.md`.*

### 7.2 Context Assembly

Before a task is dispatched, the Kernel assembles a **Context Bundle**:

```
Context Bundle =
  L0-L1 (Active context + current prompt)
+ L2 (Conversation Trail) [if session active]
+ L3 (Working Memory)   [if agent is active]
+ L4 (Project Data)     [if project_id present]
+ L5 (User Profile)     [if user_id present]
+ L6 (Global Knowledge) [if org_id present or rag_query is supplied]
```

**Assembly Rules:**
- The total token count of the bundle must not exceed the target model's `context_window` minus a safety margin (e.g., 10%).
- If the bundle is too large, tiers are compressed in reverse order of priority:
  - L6 is truncated or omitted first.
  - L5 and L4 are summarized via a fast summarization model.
  - L3 is never omitted but may be chunked and the most relevant chunks selected.
  - L1 and L2 are sacred and never touched.
  - L0 is always present by definition; it does not occupy prompt tokens.

### 7.3 Memory Storage (Future: *Memory* Module)
Currently specified as an interface; to be backed by a vector store in Phase 4.
- **Short-term**: In-memory KV store (Redis or similar).
- **Long-term**: Database for structured data; vector DB for semantic retrieval (future).
- **Retrieval**: The Kernel may run an embedding-based retrieval step to pull relevant L6 documents into the Context Bundle.

---

## 8. Tool Invocation Strategy

### 8.1 Tool Registry
Tools are distinct from agents. An agent may use zero or more tools.

| Field | Description |
|-------|-------------|
| `tool_id` | Unique identifier |
| `schema` | Tool description and parameter schema (OpenAI function-calling format or equivalent) |
| `execution_mode` | `local` (in-process), `remote` (HTTP API), `agent` (delegates to another agent) |
| `permissions` | Required capabilities or roles to invoke |
| `rate_limits` | Per-minute/hour/day quotas |

### 8.2 Tool Use Flow
1. **Declaration** — The agent's prompt declares available tools to the model.
2. **Invocation** — The model decides to call a tool, outputting a JSON blob with parameters.
3. **Routing** — The Kernel validates the request, checks permissions, and routes to the tool's `execution_mode`.
4. **Execution** — The tool runs. The Kernel handles timeouts and retries.
5. **Observation** — The tool's return value is injected back into the model's context as an observation.
6. **Continuation** — The model resumes, using the observation to form its next thought or final answer.

### 8.3 Tool Guardrails
- **Parameter Validation**: All tool arguments are validated against the declared `schema` before execution.
- **Sandboxing**: Local tools run in isolated, sandboxed processes with restricted filesystem and network access.
- **Timeout**: All tool executions have a configurable timeout (default: 30s).
- **Logging**: Every tool call and its result are logged immutably for audit.

---

## 9. Human Approval Checkpoints

### 9.1 Checkpoint Types

| Type | Description | Example |
|------|-------------|---------|
| **Gate** | Task cannot proceed until a human approves. | "Approve this brand concept before we generate the website." |
| **Audit** | Task proceeds, but a human is notified for async review. | "The proposal was sent. Review the draft here." |
| **Escalation** | Automatic trigger when confidence or quality is low. | "Model output is inconsistent. Human review required." |

### 9.2 Insertion Rules
- Checkpoints can be **automatic** (system-defined per task type) or **manual** (user-defined in the workflow config).
- A task can have zero or more checkpoints. If multiple, they are additive.
- If a Gate is rejected, the workflow rolls back to the previous valid state and may re-plan.

### 9.3 Human-as-Agent
From the Kernel's perspective, a human approval step is simply a task with a very slow, external execution backend. The Task Graph waits for a callback (approval/rejection + optional feedback) before continuing.

---

## 10. Failure Recovery

### 10.1 Failure Tiers

| Tier | Scenario | Kernel Action |
|------|----------|---------------|
| **Task Failure** | A single task errors or returns invalid output. | Retry (max 3 attempts with backoff). If persistent, escalate to Tier 2. |
| **Agent Failure** | All retries of a task fail. | Attempt fallback agent (if configured). If no fallback, Tier 3. |
| **Stage Failure** | A critical path task fails and no fallback exists. | Suspend workflow. Alert human. Offer: retry, skip with warning, or abort. |
| **System Failure** | Kernel or infrastructure error. | Log state to durable storage. Alert ops. Attempt graceful degradation. |

### 10.2 Dead Letter Queue
Tasks that fail permanently are moved to a **Dead Letter Queue (DLQ)** with full context. A human or a recovery agent can inspect the DLQ and:
- Fix the input and re-submit
- Mark as resolved and skip
- Clone the task for debugging

### 10.3 Rollback & Compensation
- The Kernel supports **compensating actions**: if a task had side effects (e.g., deployed a site, sent an email), the failure of a downstream task can trigger a cleanup task to undo the side effect.
- Rollback is not automatic for all workflows; it is defined in the workflow's `failure_policy` config.

---

## 11. Logging & Observability

### 11.1 Event Log
Every significant action in the Kernel emits a structured event:

| Field | Description |
|-------|-------------|
| `timestamp` | ISO 8601 timestamp |
| `trace_id` | Root identifier for a goal's entire lifecycle |
| `span_id` | Identifier for the current task/step |
| `parent_span_id` | Identifier for the calling/parent step |
| `level` | `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `event_type` | `goal.ingested`, `task.planned`, `agent.selected`, `model.routed`, `task.executed`, `checkpoint.approved`, etc. |
| `payload` | JSON representation of the event data |

### 11.2 Metrics
Continuous metrics are collected for operational insight:
- **Pipeline metrics**: Throughput (goals/hour), latency (end-to-end time), success rate.
- **Agent metrics**: Invocation count, success rate, average latency per agent.
- **Model metrics**: Token consumption, cost per model, error rate per provider.
- **Human metrics**: Time spent in checkpoints, approval/rejection rates, average review time.

### 11.3 Tracing
- OpenTelemetry-compatible distributed tracing is supported out of the box.
- Every task, model call, and tool invocation is a span in a trace.
- Traces are linked by `trace_id` and `span_id` for end-to-end debugging.

---

## 12. Future Extensibility

The Kernel is designed to evolve without breaking existing contracts.

### 12.1 Extension Points

| Extension | Description | Future Work |
|-----------|-------------|-------------|
| **MCP Server** | Standardized interface for external tool exposure. | The `Tool Registry` will implement the Model Context Protocol, allowing external tools to self-register. |
| **Claude Mem** | Persistent, long-horizon memory for Claude models. | The `Memory Loading Strategy` will integrate with Claude's memory API, with a local fallback for other models. |
| **OpenClaw** | General-purpose multi-agent framework. | The `Agent Registry` and `TaskGraph` will support OpenClaw's agent abstraction, allowing plug-in of complex agent teams. |
| **Hermes** | Real-time notifications and comms. | The `Execution Lifecycle` will emit events to Hermes for real-time human alerting via Slack, email, or SMS. |
| **Memory Module** | Dedicated vector store and long-term knowledge base. | The `L5` retrieval and context assembly will delegate to this module. |
| **Dashboard** | Real-time operational view. | The `Metrics` and `Event Log` will feed a WebSocket-backed dashboard for live monitoring. |
| **GitHub Integration** | Repo and CI/CD triggering. | The `Handoff` stage will be able to trigger GitHub Actions or commit artifacts to a repository. |
| **Playwright** | Browser automation and testing. | The `Tool Registry` will include a Playwright-based browser tool for the `Review` stage. |

### 12.2 Contract Stability
- All registries (Agent, Model, Tool) expose a versioned API.
- The Kernel's orchestration logic is decoupled from the contents of the registries.
- Adding a new agent, model, or tool requires zero changes to the Kernel's core logic — only registration.

---

## 13. Glossary

| Term | Definition |
|------|------------|
| **Agent** | A specialized worker that performs a task. Has a capability set and an execution backend. |
| **Capability** | A declarative tag describing what an agent or tool can do. |
| **Context Bundle** | The assembled memory and context injected into a task before execution. |
| **DAG** | Directed Acyclic Graph. The structure of a TaskGraph, ensuring no circular dependencies. |
| **DLQ** | Dead Letter Queue. A holding area for permanently failed tasks.
| **Goal** | A high-level objective that the user or system wants to achieve. |
| **Kernel** | The central orchestrator. It schedules, routes, and supervises. It does not generate creative outputs. |
| **L0–L7 Memory** | The eight tiers of memory, from instant registers to deep archive. |
| **Orchestrator** | The core scheduling component of the Kernel that manages the lifecycle of a TaskGraph. |
| **Review Gate** | A checkpoint where a human must explicitly approve or reject a task's output before the workflow continues. |
| **Task** | A single unit of work in the execution graph. |
| **TaskGraph** | The DAG of tasks generated during the Plan stage. |
| **Unified LLM Gateway** | The abstraction layer through which all model calls are routed. |

---

> **The Kernel is the brainstem, not the brain.**
> It keeps the body running, routes signals, and manages state — but the creative and business intelligence lives in the modules it orchestrates.
