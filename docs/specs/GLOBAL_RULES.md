# Global Rules for AgencyForge

## 1. Authority and Supremacy

This document defines the immutable foundational laws of AgencyForge. It supersedes all other operational documents and serves as the constitutional bedrock of the entire system.

These rules are non-negotiable and apply to ALL components, Agents, Tools, Human Operators, and integrations. The Kernel is the sole enforcer and the final arbiter of these rules.

No agent, process, or human may override these rules without an explicit, logged, and versioned amendment process.

## 2. Core Principles

The following principles are inviolable. They guide architectural decisions, agent behaviors, and human interactions.

### 2.1. Immutability of Rules
- Global Rules SHALL NEVER be modified retroactively.
- Amendments MUST be versioned and transparently logged in a `CHANGELOG.md`.
- The Kernel MUST reject any operation that attempts to bypass, override, or invalidate a Global Rule.

### 2.2. Human Sovereignty
- The Human Operator holds absolute authority over the system.
- Any Human Operator command that is unambiguous and does not violate physical or legal constraints MUST be treated as an override of all automated processes.
- The Kernel MUST provide a clear, immediate, and non-ignorable mechanism for the Human Operator to issue an emergency stop or override.

### 2.3. Least Privilege
- Every process, agent, and tool MUST operate with the minimum set of permissions required to fulfill its assigned task.
- Permissions are granted at task initiation and MUST be revoked upon task completion, unless explicitly required for a persistent role.
- The absence of a permission MUST be treated as a denial.

### 2.4. Default Deny
- All access to resources, memory, and tools is denied by default.
- Access MUST be explicitly granted through a policy, a token, or a human authorization.
- There is no implied or inherited access beyond the explicitly stated scope of the current task.

### 2.5. Explicit Over Implicit
- All behavior, configuration, and state transitions MUST be explicit.
- The system MUST NOT rely on side effects, global variables, or ambient state.
- Every action MUST be traceable to a specific cause and a specific agent.

## 3. Security Rules

### 3.1. Zero-Trust Architecture
- The Kernel is the sole trust boundary. No agent is inherently trusted.
- Agents MUST re-authenticate for every new task or session.
- All inter-agent and agent-Kernel communication MUST be authenticated and encrypted.

### 3.2. Secret Management
- No API key, password, token, or certificate MAY be hardcoded in any source code, prompt, or memory.
- All secrets MUST be stored in a dedicated secret manager (e.g., HashiCorp Vault, AWS Secrets Manager) and retrieved at runtime.
- Secrets MUST be rotated periodically. The rotation policy and schedule MUST be defined in a `SECURITY.md`.

### 3.3. Sandboxing
- Every agent MUST execute within an isolated sandbox.
- The sandbox MUST restrict filesystem access, network access, and system calls to those required by the task.
- Agents MUST NOT access files, memory, or network resources outside their assigned scope.
- Any attempt to break out of the sandbox MUST trigger immediate termination, logging, and human notification.

### 3.4. Input Sanitization
- ALL inputs to agents, tools, and the Kernel MUST be sanitized before processing.
- Inputs MUST NOT be executed or evaluated as code without explicit, Kernel-level authorization and sandboxing.
- The system MUST be hardened against injection attacks, including prompt injection, command injection, and SQL injection.

### 3.5. Audit and Non-Repudiation
- Every action taken by any agent or tool MUST be logged to an immutable, append-only audit trail.
- The audit trail MUST include the actor, the action, the timestamp, the resource, and the outcome.
- No agent or process, including the Kernel, can modify or delete an audit log entry.

## 4. Agent Behavior Rules

### 4.1. Scope Confinement
- An agent MUST perform ONLY the work defined in its active task directive.
- If an agent encounters a situation outside its scope, it MUST NOT proceed. It MUST escalate to the Kernel.
- An agent MUST NOT communicate with external humans or systems unless explicitly permitted by the task directive.

### 4.2. No Self-Modification
- Agents MUST NOT modify their own code, configuration, or core logic.
- An agent that detects a request to modify its own operating parameters MUST reject the request and alert the Kernel.
- Updates to an agent's logic MUST be deployed through the standard versioning pipeline (see `AGENT_CONTRACT.md`), not at runtime.

### 4.3. Deterministic Identity
- Each agent instance MUST have a single, non-transferable identity (`agent_id`).
- An agent MUST NOT use another agent's `agent_id` or credentials.
- An agent MUST NOT share its authentication tokens with any other process.

### 4.4. Heartbeat and Liveness
- Every running agent MUST emit a periodic heartbeat to the Kernel.
- If the Kernel does not receive a heartbeat within a configurable timeout, the agent is presumed failed.
- The Kernel MUST attempt to recover the task (e.g., re-assign to a healthy agent) and log the failure.

### 4.5. Graceful Degradation
- If an agent cannot fulfill a non-critical subtask, it MUST report the failure clearly.
- If the failure is recoverable, the agent MAY propose an alternative. It MUST NOT silently skip steps.

## 5. Memory Rules

### 5.1. Kernel as the Sole Memory Arbiter
- The Kernel is the exclusive interface for all memory operations.
- Agents MUST NOT access memory stores (databases, files, vector DBs) directly.
- All memory reads and writes MUST go through the Kernel's Memory Manager.

### 5.2. Scoping
- Memory is always scoped: Session, Project, User, or Global.
- An agent has read/write access only to the memory layers relevant to its active task.
- Cross-scope access (e.g., an agent reading User Memory without permission) is a security violation.

### 5.3. Versioning
- All modifications to persistent memory (Project, User, Global) MUST be versioned.
- The previous state MUST be preserved and recoverable.
- Deletion is logical, not physical. All deletions are soft-deletes to maintain the audit trail.

### 5.4. Data Sanitization
- Before any data is written to memory or transmitted, it MUST be scanned for sensitive information.
- If sensitive data is found, it MUST be encrypted or redacted according to the `sensitivity_level` defined in the task context.

## 6. Tool Usage Rules

### 6.1. Explicit Permission
- Tools are not available by default.
- An agent MUST request and be granted explicit permission (`tool_manifest`) for a tool before invocation.
- The Kernel presents the tool's `schema` to the agent and validates all arguments before execution.

### 6.2. Rate Limiting
- All tool usage is subject to rate limits defined in the `tool_manifest`.
- Agents MUST respect rate limits. Circumventing a rate limit is a contract violation.
- The Kernel MAY queue a tool request if the rate limit is currently exhausted.

### 6.3. Input and Output Logging
- Every tool invocation and its corresponding output MUST be logged to the audit trail.
- The log MUST include the tool name, the sanitized input hash, and the execution status.
- Tool outputs MUST be validated by the Kernel against the expected schema before being passed to the agent.

## 7. Human Override Rules

### 7.1. Unambiguous Command Authority
- A clear, unambiguous command from a Human Operator overrides any automated decision, policy, or agent action.
- The system MUST prioritize human directives over its own internal logic.

### 7.2. Emergency Stop
- The system MUST provide an always-accessible mechanism for a Human Operator to halt all active processes.
- An emergency stop MUST be immediate and non-ignorable.

### 7.3. Review Requirement for Destructive Actions
- Any action that is destructive, irreversible, or has a high impact MUST be paused for human approval.
- This includes, but is not limited to: deleting data, modifying critical configuration, and deploying to production.

## 8. Communication Standards

### 8.1. Structured Formats
- All inter-component communication MUST use structured, machine-readable formats (e.g., JSON, Protocol Buffers).
- The schema for all messages MUST be versioned and documented in a `contracts/` directory.

### 8.2. Event-Driven Architecture
- The system MUST use an Event Bus for all significant state changes and inter-agent communication.
- Events MUST be well-defined, with a canonical `event_type` and a versioned `payload` schema.
- A registry of all `event_type` values MUST be maintained in a central document.

### 8.3. Idempotency
- All message handlers and tool invocations SHOULD be idempotent where possible.
- Non-idempotent operations MUST be wrapped in a transaction or a compensating action.

## 9. File and Naming Conventions

### 9.1. Naming
- All file and directory names MUST use `snake_case`.
- Module directories follow `kebab-case` convention (see `MASTER_PLAN.md` §10.1).
- Acronyms MUST be treated as regular words (e.g., `http_client.py`, not `HTTP_client.py`).
- No spaces, special characters, or emojis are permitted in file or directory names.

### 9.2. Documentation
- Every directory that contains operational code or configuration MUST contain a `README.md`.
- The top-level of the project MUST contain `AGENTS.md`, which is the developer guide for human contributors.

## 10. Logging, Error, and Quality Rules

### 10.1. Logging
- All logs MUST be structured, timestamped, and tagged with the originating `agent_id` and `task_id`.
- Log levels MUST be used consistently: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`.
- The system MUST support log forwarding to external aggregation services (e.g., ELK, Splunk, Datadog).

### 10.2. Error Reporting
- All errors MUST be reported through a standard `Error Event` structure.
- The `Error Event` MUST include a classification (`INPUT`, `TOOL`, `MODEL`, `MEMORY`, `SYSTEM`, `AGENT`, `SECURITY`), a severity, and a clear message.
- Errors MUST NOT be silently swallowed. An unhandled error MUST always be escalated.

### 10.3. Quality Requirements
- All agents MUST self-assess their output quality before submission.
- The `AGENT_CONTRACT.md` defines the dimensions of quality scoring (Completeness, Correctness, Efficiency, Clarity).
- A user or the Kernel can challenge an agent's self-assessment, triggering a review.

## 11. Coding and Documentation Standards

### 11.1. Code Quality
- All code MUST be testable. Core logic MUST be decoupled from I/O and framework specifics.
- A strict separation of concerns is maintained between the Kernel, Agents, and Tools.
- Dead code, commented-out code, and unreachable branches MUST be removed.

### 11.2. Documentation
- All public-facing functions, classes, and modules MUST be documented.
- Documentation MUST be kept in sync with the code. Stale documentation is a bug.
- The `README.md` in every directory MUST accurately describe its contents and any relevant setup/execution instructions.

## 12. Future Compatibility

### 12.1. Backward Compatibility
- All public interfaces (APIs, message schemas, and file formats) MUST be backward compatible.
- Breaking changes MUST be introduced through a formal deprecation process, including a timeline and a migration guide.
- Deprecated features MUST remain functional for at least one full minor version cycle.

### 12.2. Plugin Contracts
- All extensions, including plugins, agents, and tools, MUST conform to a standard, versioned plugin contract.
- The Kernel MUST validate every extension against its declared contract before activation.
- A plugin MUST NOT be able to access or modify the core Kernel state.

### 12.3. Graceful Degradation
- If an optional subsystem (e.g., a non-critical plugin, an observability backend) is unavailable, the system MUST continue to operate.
- The system MUST log the unavailability and, if appropriate, alert a human operator.
- Core functionality MUST NOT depend on any 3rd-party service that does not have a defined fallback or local alternative.
