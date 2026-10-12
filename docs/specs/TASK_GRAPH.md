# Task Graph for AgencyForge

## 1. Purpose and Scope

This document defines the complete execution model, orchestration framework, and communication protocol for how tasks are planned, executed, and managed within AgencyForge. The Task Graph is the central nervous system that translates a user's intent into coordinated action across one or more agents, tools, and external systems.

This is a binding specification. All Kernel modules and agents that participate in work execution must conform to the protocols described herein.

## 2. Task Lifecycle

Every unit of work in AgencyForge is represented as a Task. Each Task moves through a strict lifecycle enforced by the Kernel.

### 2.1. States

- **`CREATED`**: The task has been instantiated but not yet queued for planning. It contains a raw objective and optional constraints.
- **`PENDING`**: The task is in the queue awaiting assignment. It has a computed priority and estimated cost.
- **`PLANNING`**: The Orchestrator is decomposing the task into subtasks (a Task Graph). This may involve a specialist planning agent.
- **`SCHEDULED`**: The task has a plan, dependencies have been mapped, and it is awaiting execution based on resource availability.
- **`RUNNING`**: The task is actively being executed by an assigned agent or an external process. Heartbeats are expected.
- **`WAITING_FOR_APPROVAL`**: The task has hit a Human Approval Node. Execution is frozen.
- **`PAUSED`**: Execution was temporarily halted by the Kernel or the user. Distinct from approval in that it is not a decision gate.
- **`COMPLETED`**: The task finished successfully. Outputs and artifacts are committed to memory.
- **`FAILED`**: The task could not be completed. A failure report is generated and routed according to the failure recovery policy.
- **`ROLLED_BACK`**: The task and its downstream effects have been reverted due to a failure upstream or a user abort command.
- **`ARCHIVED`**: The task and its full execution trace are moved to cold storage after a configurable retention period.

## 3. Execution Pipeline

Every user request flows through a standardized pipeline, from inception to memory materialization.

### 3.1. Stage 1: Request Ingestion
- A user or external system submits a request to the Kernel.
- The Request Router tags the request with a `request_id`, timestamps it, and performs an initial classification (e.g., coding, research, creative, system admin).
- The request is encapsulated as a root Task.

### 3.2. Stage 2: Context Loading
- The Kernel loads the user's profile (L5), the active project state (L4), and any global constraints (L6).
- This context is attached to the root Task as its initial environment.

### 3.3. Stage 3: Planning
- The root Task enters the `PLANNING` state.
- A Planning Agent decomposes the objective into a Task Graph (see Section 4).
- The plan includes a DAG of subtasks, estimated costs, and required capabilities.

### 3.4. Stage 4: Orchestration and Scheduling
- The Orchestrator validates the plan against the current system state.
- Tasks with no unresolved dependencies are moved to `SCHEDULED`.
- The Scheduler places them in a Task Queue (see Section 10).

### 3.5. Stage 5: Execution
- Tasks are dispatched to agents based on capability matching and availability.
- Agents report progress via the Event Bus (see Section 13).

### 3.6. Stage 6: Review and Quality Gate
- When a parent task's children are all `COMPLETED`, a Review Agent may be invoked.
- This agent checks the outputs against the original objective, the `AGENT_CONTRACT.md` quality scoring, and any constraints.

### 3.7. Stage 7: Memory Update
- Once the Review Gate is passed, the results are persisted.
- Project Memory (L4) and User Memory (L5) are updated. The conversation is logged.
- Key findings are embedded into the Vector DB.

### 3.8. Stage 8: Handoff or Termination
- If the task was a subtask, a Handoff Packet is generated and sent to its parent (see `AGENT_CONTRACT.md`).
- If it was the root task, the final result is presented to the user, and the task transitions to `ARCHIVED`.

## 4. DAG Execution Model

AgencyForge represents all plans as a Directed Acyclic Graph (DAG). This ensures that no circular dependencies can block or deadlock the system.

### 4.1. Nodes
A node in the DAG represents a single unit of work: a Task. A Task has:
- A unique `task_id`.
- An objective string.
- A list of input artifacts.
- A list of output artifact types.

### 4.2. Edges
An edge from Task A to Task B means `B depends on A`. Task B cannot begin until Task A is `COMPLETED`.
Cycles are detected and rejected during the `PLANNING` stage.

### 4.3. The Graph Manager
The Graph Manager is a Kernel service responsible for:
- Validating the DAG (checking for cycles).
- Tracking the state of every node.
- Triggering downstream tasks when all their dependencies are satisfied.

## 5. Agent Orchestration

Orchestration is the active management of agents and tasks by the Kernel.

### 5.1. The Orchestrator
The Orchestrator is the central service that manages the flow of tasks. Its responsibilities include:
- Taking a root task and producing a DAG.
- Assigning tasks to agents based on the `AGENT_CONTRACT.md` and `MODEL_ROUTING.md`.
- Monitoring the health of running agents and re-assigning failed tasks.

### 5.2. Orchestrator Decision Loop
The Orchestrator operates in a continuous loop:
1.  Identify all `SCHEDULED` tasks that have all their dependencies met.
2.  For each such task, find the best available agent (see Section 8).
3.  Dispatch the task to the agent.
4.  Collect events from the Event Bus.
5.  Update the Task Graph and agent states accordingly.
6.  Handle failures, retries, or human checkpoints.

## 6. Parent and Child Tasks

Decomposition is a fundamental strategy for solving complex problems.

### 6.1. Creation
During the `PLANNING` phase, a parent task is decomposed into children. The parent task's state becomes a composite of its children's states.

### 6.2. Context Inheritance
- A child task inherits the base context of its parent.
- The parent can inject additional, subtask-specific variables into the child's context.

### 6.3. Result Aggregation
The parent task is responsible for aggregating the outputs of its children. This aggregation logic is part of the plan.

## 7. Execution Patterns

The Task Graph supports multiple execution patterns natively.

### 7.1. Parallel Execution
When two or more tasks have no dependencies between them and their parent dependencies are met, the Orchestrator dispatches them concurrently. This is the default for sibling tasks in a plan.

### 7.2. Sequential Execution
When Task B depends on Task A, they form a sequential chain. The Orchestrator guarantees that Task B will not be dispatched until Task A reaches `COMPLETED`.

### 7.3. Conditional Branching
A task can have conditional edges. Based on the output of the parent task (e.g., a boolean or an enum), the Orchestrator selects which downstream path to activate. Unselected paths are marked as `SKIPPED`.

### 7.4. Dynamic Task Creation
An agent can, in rare and justified circumstances, request the creation of new subtasks. This is called dynamic expansion. The agent must provide a clear objective for the new task, which is then enqueued and planned by the Orchestrator.

## 8. Agent Discovery and Selection

### 8.1. Agent Registry
The Kernel maintains an Agent Registry (as defined in `AGENT_CONTRACT.md`). It is a real-time catalog of all registered agents, their versions, capabilities, and current statuses (`PENDING`, `RUNNING`, etc.).

### 8.2. Discovery
When a task needs an agent, the Orchestrator queries the Agent Registry for agents whose declared `capabilities` are a superset of the task's `required_capabilities`.

### 8.3. Selection
If multiple agents are capable, the Orchestrator selects the one with:
1.  The highest `capability_match_score`.
2.  The lowest current `workload`.
3.  A bonus for agents that have historically succeeded on similar tasks for this `user_id` or `project_id`.

## 9. Task Priorities

The Kernel calculates a Base Priority from the task directive. Human-initiated tasks generally have a higher base priority than automated background tasks.

### 9.1. Dynamic Priority Boosts
- **Deadline Proximity**: As a task's deadline approaches, its priority is increased exponentially.
- **Blocking**: A task that is a dependency for many other high-priority tasks gets a transitive priority boost.

### 9.2. Priority Ceiling and Floor
- A task's effective priority cannot be adjusted infinitely. There is a ceiling to prevent a runaway feedback loop in the queue.
- A priority floor ensures that low-priority tasks are not starved. Over time, a low-priority task will accumulate a positive aging boost.

## 10. Task Queues

The system uses a tiered queue structure.

### 10.1. Priority Queues
Tasks are placed into one of several priority queues (e.g., `CRITICAL`, `HIGH`, `NORMAL`, `LOW`). The Scheduler always pulls tasks from the highest-priority non-empty queue.

### 10.2. Fairness Unit (FU)
Each queue is associated with a Fairness Unit. The system allocates execution slots proportionally to the FU weighting. This ensures that a burst of `HIGH` priority tasks does not completely starve `NORMAL` tasks.

## 11. Scheduling Strategy

The Scheduler is the component that selects which task to execute next.

### 11.1. Backfilling
When a high-priority, long-running task is dispatched to an agent, the Scheduler can `backfill` by dispatching a short, low-priority task to a temporarily idle agent, provided the low-priority task can complete before the high-priority task requires the agent's full attention.

### 11.2. Resource-Aware
The Scheduler is aware of system resources (CPU, memory, GPU). It will not dispatch a GPU-intensive task if all GPU resources are currently allocated.

## 12. Event Bus and Messaging

### 12.1. Event Bus
The Event Bus is the backbone of AgencyForge communication. It is a high-throughput, persistent, and ordered message stream.

All significant state changes in the system—task status updates, agent heartbeats, tool completions, and human approvals—are published as events to the Event Bus.

### 12.2. Publish/Subscribe Architecture
- **Publishers**: Agents, the Kernel, tools, and external systems.
- **Topics**: Events are organized by topic (e.g., `task.lifecycle`, `agent.heartbeat`, `memory.update`).
- **Subscribers**: Other agents, the Orchestrator, and observability services can subscribe to specific topics or use wildcards.

### 12.3. Inter-Agent Messaging
While agents typically communicate through the Task Graph, they can send direct messages to one another via the Event Bus. This should be used sparingly and only for coordination, not for transferring task ownership (which is handled via the Handoff Protocol).

## 13. Context Propagation and Dependency Management

### 13.1. Context Flow
As execution moves from one node to another in the DAG, the relevant context (L1–L6) flows with it. The Orchestrator is responsible for hydrating the agent's context window with the correct upstream outputs and relevant memory.

### 13.2. Artifact Passing
The primary output of a task (the Result Artifact) is passed directly to its dependent tasks as an input artifact.

## 14. Human Approval Nodes

AgencyForge enforces human oversight on sensitive tasks.

### 14.1. Insertion
A Human Approval Node can be inserted into the DAG during the `PLANNING phase` or dynamically triggered by an agent encountering a policy boundary.

### 14.2. Execution
When a running task hits an Approval Node, its state transitions to `WAITING_FOR_APPROVAL`. A notification is sent to the human operator via the most appropriate channel (e.g., in-app notification, email, Slack). The human provides a `PROCEED` or `ABORT` signal.

## 15. Failure, Rollback, and Recovery

### 15.1. Failure Detection
If a task transitions to `FAILED`, the Orchestrator is immediately notified.

### 15.2. Retry Policy
The Orchestrator consults the retry policy for the specific task type:
- **Agent Failure**: Try to re-assign the task to a different agent.
- **Tool Failure**: Retry up to the tool's `max_retries`.
- **Input Failure**: Halt and escalate.

### 15.3. Rollback Strategy
For tasks that modify external state (e.g., writing to a database, committing code), a Rollback Plan must be defined by the planning phase. If the task fails, the rollback plan is automatically executed to restore the system to its previous state.

### 15.4. Checkpointing
For long-running tasks, the executing agent MUST create regular checkpoints (snapshots of its state) to the Memory system. If the agent or its host fails, the Orchestrator can spawn a new agent, restore from the latest checkpoint, and resume execution.

## 16. Execution Modes

### 16.1. Local Execution
Tasks are executed on the same physical or virtual machine where the Kernel is running. This is the default for most user-facing tasks.

### 16.2. Remote Execution
Tasks can be dispatched to remote agent workers via a secure RPC or message queue (e.g., Celery, Ray, or a custom agent protocol). The Orchestrator remains the source of truth.

## 17. Integration Points

AgencyForge is designed to interface with external platforms via a standardized plugin architecture.

### 17.1. MCP (Model Context Protocol) Integration
AgencyForge exposes a compliant MCP endpoint. This allows external agents or IDEs (like Cursor or Claude Desktop) to connect to the AgencyForge Kernel, submit tasks, and retrieve results through a standardized protocol.

### 17.2. GitHub Integration
Tasks can be triggered by GitHub webhooks (e.g., pull requests, issues). The Orchestrator can dispatch agents to handle code reviews, generate summaries, or create follow-up tasks automatically.

### 17.3. Playwright Integration
For tasks involving web interaction, the system can dispatch work to Playwright-driven agents. The agent can navigate, scrape, or interact with web UIs on behalf of the user.

### 17.4. Firecrawl Integration
For high-scale web scraping and data ingestion, AgencyForge can integrate with Firecrawl to turn websites into structured data for archival or analysis by other agents.

### 17.5. OpenClaw Integration
The system supports integration with the OpenClaw framework for specialized, low-level hardware or security-related tasks.

### 17.6. Hermes Integration
Integration with Hermes provides real-time alerting, metric collection, and system health monitoring, feeding data directly back into the Orchestrator's scheduling decisions.

## 18. Future Plugin Architecture

### 18.1. Plugin Contract
Third-party integrations must conform to a standard Plugin Contract. This contract defines how to register with the Kernel, how to receive tasks, and how to report results.

### 18.2. Dynamic Loading
Plugins can be loaded into the Kernel at runtime without a restart. The Kernel validates the plugin's signature and permissions before activation.

## 19. Performance Metrics and Observability

### 19.1. Key Metrics
- **Throughput**: Tasks completed per minute.
- **Latency**: Time from `CREATED` to `COMPLETED`.
- **Agent Utilization**: Percentage of time an agent is in a `RUNNING` state.
- **Queue Depth**: Number of `SCHEDULED` tasks, per queue.

### 19.2. Observability
All metrics are published to the Event Bus and consumed by the observability backend. Dashboards provide real-time visualization of the health of the Task Graph, including which tasks are waiting, running, and failing.

## 20. Audit Trail

Every transition of a task's state, every agent assignment, every tool invocation, and every human approval is recorded in the Audit Trail. This trail is:
- **Immutable**: Append-only. No agent or human can modify it.
- **Comprehensive**: Links the `task_id` to the `agent_id`, `model_id`, `timestamp`, and full context hash.
- **Searchable**: Indexed for debugging, compliance, and historical analysis.
