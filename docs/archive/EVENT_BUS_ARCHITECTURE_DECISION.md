# Event Bus Architecture Decision Record

**Date:** 2026-07-05
**Status:** ✅ IMPLEMENTED

---

## Executive Summary

**`EnhancedEventBus` is the canonical system event bus.** `UnifiedEventBus` serves a narrow, internal purpose for `RuntimeIntegrator` state store logging only.

The bug: `executeGoal()` in `RuntimeBootstrap` publishes to `eventBus` (UnifiedEventBus) but all subsystems, bindings, services, and RuntimeBridge subscribe to `enhancedEventBus`. This breaks event flow from user goals to the rest of the system.

**Fix implemented:** Changed all 8 `this.eventBus.publish()` calls in `executeGoal()`, `executeResearchRevenueWorkflow()`, and `sendDashboardNotification()` to `this.enhancedEventBus.publish()`. Added a one-way bridge from EnhancedEventBus to UnifiedEventBus for RuntimeIntegrator diagnostics. Removed the duplicate persistence workaround.

---

## Architecture Discovery

### The Two Event Buses

| Aspect | `eventBus` (UnifiedEventBus) | `enhancedEventBus` (EnhancedEventBus) |
|--------|-----------------------------|--------------------------------------|
| **File** | `events/UnifiedEventBus.ts` | `events/EnhancedEventBus.ts` |
| **Capabilities** | Basic pub/sub, history, `once` option | Priority ordering, request/response, pause/resume, replay, dispatch logging, labeled subscriptions |
| **Used by** | RuntimeIntegrator ONLY | All subsystems, all bindings, all services, RuntimeBridge, RuntimeBootstrap subsystems |

### Dependency Graph (from RuntimeBootstrap constructor)

```
eventBus (UnifiedEventBus)
  └── RuntimeIntegrator (for stateStore logging only)
  └── setupEventHandlers() duplicate stateStore logging

enhancedEventBus (EnhancedEventBus)
  ├── SharedContextManager
  ├── DashboardBinding, CharacterBinding, VoiceBinding, MemoryBinding, KernelBinding
  ├── DataService
  ├── ToolExecutionEngine
  ├── Scheduler
  ├── ObservabilityService
  ├── RuntimeBridge (SSE for Dashboard)
  ├── KernelSubsystem
  ├── MemorySubsystem
  ├── ResearchSubsystem
  ├── RevenueSubsystem
  ├── DashboardSubsystem
  └── PersistenceService subscription (wildcard '*')
```

### Event Flow Analysis

**Current (Broken) Flow:**
```
User calls executeGoal()
       │
       ▼
RuntimeBootstrap.executeGoal() ──publishes to──► eventBus (UnifiedEventBus)
       │
       ├─► RuntimeIntegrator subscribes → stateStore.addEvent() ✓
       ├─► setupEventHandlers() subscribes → stateStore.addEvent() ✓ (DUPLICATE)
       │
       ✗ NO SUBSCRIBERS on eventBus for:
          - Subsystems (all on enhancedEventBus)
          - Bindings (all on enhancedEventBus)
          - RuntimeBridge/SSE (on enhancedEventBus)
          - Persistence (on enhancedEventBus)
```

**Intended (Correct) Flow:**
```
User calls executeGoal()
       │
       ▼
RuntimeBootstrap.executeGoal() ──should publish to──► enhancedEventBus
       │
       ├─► Subsystems receive events ✓
       ├─► Bindings receive events ✓
       ├─► RuntimeBridge broadcasts to Dashboard SSE ✓
       ├─► Persistence receives events ✓
       │
       ▼ (separate path for RuntimeIntegrator)
RuntimeIntegrator ──subscribes to enhancedEventBus? NO → needs bridge OR use enhancedEventBus
```

---

## Root Cause

**Line 732 in RuntimeBootstrap.executeGoal():**
```typescript
this.eventBus.publish(createRuntimeEvent(RuntimeEventTypes.GOAL_RECEIVED, ...));
```

And all subsequent workflow events (WORKFLOW_STARTED, LEAD_FOUND, LEAD_SCORED, PROPOSAL_GENERATED, etc.) are published to `eventBus` instead of `enhancedEventBus`.

---

## Why Both Exist

1. **EnhancedEventBus** was built as the feature-rich system bus with:
   - Priority-based dispatch (critical for ordering)
   - Request/response pattern (for future RPC-style communication)
   - Pause/resume subscriptions (for dynamic module loading)
   - Event replay (for debugging/recovery)
   - Dispatch logging (observability)

2. **UnifiedEventBus** was built as a lightweight internal bus for:
   - `RuntimeIntegrator` - a module registration/lifecycle manager
   - Its only purpose: log specific events to `stateStore` for module health tracking

3. **RuntimeIntegrator** explicitly types its dependency as `UnifiedEventBus` (line 18 in RuntimeIntegrator.ts), confirming this was intentional.

---

## RuntimeBridge Verification

**RuntimeBridge is intentionally designed to consume EnhancedEventBus.**

Evidence:
- Constructor signature: `private eventBus: EnhancedEventBus` (line 40)
- Subscribes to 17 specific event types including DASHBOARD_NOTIFICATION, LEAD_FOUND, LEAD_SCORED, PROPOSAL_GENERATED
- Uses priority ordering: `{ priority: 1 }` (line 87)
- Broadcasts events to SSE clients for real-time Dashboard updates

This is not an accident - the SSE bridge was built for the feature-rich bus.

---

## Architecture Decision

### Decision: **Fix executeGoal() to publish to enhancedEventBus**

**Rationale:**
1. All subsystems, bindings, services, and RuntimeBridge are on enhancedEventBus
2. Persistence subscribes to enhancedEventBus with wildcard `'*'`
3. RuntimeBridge (Dashboard SSE) requires enhancedEventBus features (priority)
4. UnifiedEventBus serves ONLY RuntimeIntegrator's narrow logging need

### Changes Required

1. **RuntimeBootstrap.executeGoal()** - Change all `this.eventBus.publish()` to `this.enhancedEventBus.publish()`

2. **RuntimeIntegrator** - It currently subscribes to eventBus for stateStore logging. Since events will now flow through enhancedEventBus, either:
   - a) Change RuntimeIntegrator to subscribe to enhancedEventBus, OR
   - b) Keep RuntimeIntegrator on eventBus and add a one-way bridge from enhancedEventBus → eventBus for the specific events it logs

**Option 2b is preferred** - keeps RuntimeIntegrator's narrow purpose intact without coupling it to the enhanced bus.

---

## Implementation Plan

### Step 1: Fix executeGoal() in RuntimeBootstrap
```typescript
// Line 732: Change from
this.eventBus.publish(...)
// To
this.enhancedEventBus.publish(...)

// Apply to ALL event publishes in executeGoal() and executeResearchRevenueWorkflow()
```

### Step 2: Bridge enhancedEventBus → eventBus for RuntimeIntegrator
```typescript
// In RuntimeBootstrap.start(), after both buses created:
this.enhancedEventBus.subscribe(
  [
    RuntimeEventTypes.GOAL_RECEIVED,
    RuntimeEventTypes.WORKFLOW_STARTED,
    RuntimeEventTypes.WORKFLOW_COMPLETED,
    RuntimeEventTypes.RESEARCH_STARTED,
    RuntimeEventTypes.RESEARCH_COMPLETED,
    RuntimeEventTypes.LEAD_FOUND,
    RuntimeEventTypes.LEAD_SCORED,
    RuntimeEventTypes.PROPOSAL_GENERATED,
    RuntimeEventTypes.DASHBOARD_NOTIFICATION,
  ],
  (event) => {
    this.eventBus.publish(event);  // Forward to RuntimeIntegrator's bus
  },
  { priority: -2000, label: 'enhanced->unified bridge for RuntimeIntegrator' }
);
```

### Step 3: Remove duplicate stateStore logging in setupEventHandlers()
```typescript
// Remove the duplicate subscriptions (lines 932-936) since RuntimeIntegrator handles this
```

### Step 4: Remove the workaround persistence subscription on eventBus
```typescript
// Remove the eventBusPersistSubscription added earlier (lines 558-570)
// Persistence already subscribes to enhancedEventBus with wildcard '*'
```

---

## Verification Criteria

After fix:
1. `executeGoal('dental')` → events flow to all subsystems
2. Dashboard SSE receives events in real-time
3. Persistence stores events in `runtime_events` table
4. RuntimeIntegrator still logs to stateStore via bridge
5. No infinite loops (one-way bridge enhanced→unified, executeGoal publishes to enhanced)

---

## Files Modified

1. `runtime/src/bootstrap/RuntimeBootstrap.ts` - Primary fix

## Implementation Notes

### Actual Implementation vs Plan

**Implemented (lines in RuntimeBootstrap.ts):**

1. **Changed 8 publishes** (lines 715, 717, 737, 762, 804, 824, 845, 911):
   - `GOAL_RECEIVED`, `WORKFLOW_STARTED`, `WORKFLOW_COMPLETED`, `WORKFLOW_FAILED`
   - `LEAD_FOUND`, `LEAD_SCORED`, `PROPOSAL_GENERATED`
   - `DASHBOARD_NOTIFICATION`

2. **Added one-way bridge** (lines 557-559):
   ```typescript
   this.enhancedEventBus.subscribe('*', (event) => {
     this.eventBus.publish(event);
   }, { priority: -2000 });
   ```
   - Uses wildcard `'*'` (simpler than planned specific types)
   - Priority -2000 ensures it fires after PersistenceService (-1000)

3. **Removed workaround** (was lines 558-570):
   - Deleted `eventBusPersistSubscription` field
   - Deleted duplicate persistence subscription on UnifiedEventBus
   - Cleaned up shutdown code

4. **Preserved setupEventHandlers()** on UnifiedEventBus:
   - These subscriptions remain for RuntimeIntegrator stateStore logging
   - The bridge forwards EnhancedBus events to UnifiedBus for RuntimeIntegrator

### Event Flow After Fix

```
executeGoal() publishes to enhancedEventBus
        │
        ├─► PersistenceService (priority -1000) → persists to database ✓
        ├─► RuntimeBridge (priority 1) → broadcasts to Dashboard SSE ✓
        ├─► All subsystems, bindings, services ✓
        │
        └─► Bridge (priority -2000) → forwards to UnifiedEventBus
                  │
                  └─► RuntimeIntegrator → logs to stateStore ✓
                  └─► setupEventHandlers() → logs to stateStore ✓
```

### Verification

- `npx tsc --noEmit` passes with no errors
- All 8 publish calls verified changed to `this.enhancedEventBus.publish`
- Bridge verified at correct location with wildcard subscription
- Workaround fully removed (no remaining `eventBusPersistSubscription` references)