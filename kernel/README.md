# AgencyForge Kernel

The core runtime orchestrator for AgencyForge.

## Modules

- `types/` — Shared type definitions
- `interfaces/` — Module contracts (IoC)
- `config/` — Kernel configuration
- `event_bus/` — Publish / subscribe event architecture
- `agent_registry/` — Agent catalog and health tracking
- `planner/` — Goal-to-TaskGraph decomposition
- `task_queue/` — Priority task queue with retry and cancel
- `executor/` — Task execution pipeline
- `logging/` — Structured, observable logging

## Quick Start

```typescript
import { Kernel } from './kernel';

const kernel = new Kernel();
await kernel.initialize();
```
