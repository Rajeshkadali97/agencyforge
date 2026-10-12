# Event Bus Architecture Analysis

**Date:** 2026-07-05
**Purpose:** Document the dual event bus architecture, identify the canonical bus, and recommend the correct architectural fix for the persistence issue.

---

## Executive Summary

AgencyForge Runtime has **two event bus implementations** that are not properly connected. This document identifies which bus is canonical, how events flow (and don't flow), and the correct architectural fix.

**Root Cause:** Persistence and RuntimeBridge subscribe to `EnhancedEventBus`, but ALL event publishing goes through `UnifiedEventBus`. The two buses are completely disconnected.

---

## 1. The Two Event Buses

### 1.1 UnifiedEventBus (`eventBus`)

**File:** `runtime/src/events/UnifiedEventBus.ts`

**Purpose:** Simple pub/sub event bus

**Capabilities:**
- Publish/subscribe
- History with max size (10000 events)
- `once` option for one-time subscriptions
- No priority ordering

**Usage in codebase:** 98 publish/subscribe occurrences

**Used by:**
- All Subsystems (KernelSubsystem, MemorySubsystem, ResearchSubsystem, RevenueSubsystem, DashboardSubsystem)
- All Bindings (DashboardBinding, CharacterBinding, VoiceBinding, MemoryBinding, KernelBinding)
- All Agents (ResearchAgent, etc.)
- All Services (DataService, etc.)
- WorkflowEngineImpl
- RuntimeCoordinator
- RuntimeIntegrator
- SharedContextManager
- ToolExecutionEngine
- ErrorRecovery
- ObservabilityService

**Conclusion:** `UnifiedEventBus` is the **primary event bus** used throughout the system for ALL event operations.

---

### 1.2 EnhancedEventBus (`enhancedEventBus`)

**File:** `runtime/src/events/EnhancedEventBus.ts`

**Purpose:** Advanced event bus with extended capabilities

**Capabilities:**
- Priority-based subscription ordering (higher priority executes first)
- Event dispatch logging with timing and error tracking
- Request/response pattern (request() + respond())
- Pause/resume subscriptions
- Subscription labeling
- Event replay capability
- Maximum history size (10000, configurable)
- Separate event log (max 1000 entries)

**Usage in codebase:** Only 2 subscriptions
- RuntimeBootstrap line 542: Persistence subscription
- RuntimeBridge line 60: Dashboard event subscription

**Used by:**
- RuntimeBridge (constructor expects `EnhancedEventBus`)
- PersistenceService subscription (via RuntimeBootstrap)

**Conclusion:** `EnhancedEventBus` was designed as an "enhanced" alternative with advanced features but is **barely used** in the system.

---

## 2. Event Flow Analysis

### 2.1 Current (Broken) Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EVENT PUBLICATION                                 │
│                                                                             │
│  executeGoal()           │  dataService.scoreLead()   │  Agents, Tools    │
│  Workflow events         │  LEAD_FOUND, LEAD_SCORED   │  All event types  │
│  GOAL_RECEIVED           │  PROPOSAL_GENERATED          │                    │
│  WORKFLOW_STARTED        │  RESEARCH_COMPLETED          │                    │
│  WORKFLOW_COMPLETED      │                              │                    │
│  ...                     │                              │                    │
└──────────────────────────┴──────────────────────────────┴────────────────────┘
                                    │
                                    │ publishes to
                                    ▼
                    ┌───────────────────────────────┐
                    │      UnifiedEventBus           │
                    │       (eventBus)               │
                    │                               │
                    │  • 98 publish/subscribe calls  │
                    │  • ALL subsystems subscribe    │
                    │  • ALL agents publish          │
                    │  • ALL services publish        │
                    │  • NO forwarding configured     │
                    └───────────────────────────────┘
                                    │
                                    │ ONLY events that happen to be
                                    │ published to this bus are received
                                    │ (all of them, since everything uses this)
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
    ┌───────────────────────────┐   ┌───────────────────────────┐
    │   EnhancedEventBus         │   │   (other subscribers)       │
    │  (enhancedEventBus)        │   │                           │
    │                           │   │  • KernelSubsystem         │
    │  • Persistence subscribed │   │  • MemorySubsystem         │
    │  • RuntimeBridge subs.   │   │  • ResearchSubsystem       │
    │  • BUT nothing publishes │   │  • RevenueSubsystem         │
    │    to this bus!          │   │  • DashboardSubsystem       │
    │                           │   │  • ALL bindings             │
    └───────────────────────────┘   └───────────────────────────┘
            │                                       │
            │ NO EVENTS RECEIVED                   │ EVENTS RECEIVED
            │ (nothing publishes here)             │ (all event bus events)
            ▼                                       ▼
    ┌───────────────────┐               ┌─────────────────────────┐
    │   PERSISTENCE      │               │   SUBSYSTEMS/BINDINGS   │
    │   (BROKEN)         │               │   (WORKING)              │
    │   runtime_events   │               │                         │
    │   table is EMPTY   │               │   State updates         │
    └───────────────────┘               │   UI notifications      │
                                        └─────────────────────────┘
```

### 2.2 Evidence: Events Published to eventBus, Not enhancedEventBus

**From grep results:**
- `this.eventBus.publish` - 20 occurrences in RuntimeBootstrap.ts alone
- `this.enhancedEventBus.publish` - 0 occurrences in the entire codebase

No code ANYWHERE publishes to `enhancedEventBus`. The EnhancedEventBus exists but is completely disconnected from the event flow.

---

## 3. RuntimeBridge Analysis

**File:** `runtime/src/bridge/RuntimeBridge.ts`

```typescript
constructor(
  private eventBus: EnhancedEventBus,  // <-- Expects EnhancedEventBus
  ...
)
```

**Problem:** RuntimeBridge expects `EnhancedEventBus` and subscribes to it for dashboard events, but ALL events are published to `UnifiedEventBus`.

**Result:** Dashboard SSE receives **NO EVENTS** from the runtime.

---

## 4. PersistenceService Analysis

**File:** `runtime/src/persistence/PersistenceService.ts`

Persistence subscribes via RuntimeBootstrap:

```typescript
this.eventPersistSubscription = this.enhancedEventBus.subscribe(
  '*',  // Wildcard for all events
  (event) => {
    this.persistence.persistEvent(event.type, event.payload, ...);
  },
  { priority: -1000 }
);
```

**Problem:** Subscribes to `enhancedEventBus` but all events are published to `eventBus`.

**Result:** `runtime_events` table remains EMPTY even when events are published.

**Evidence from database:**
```json
{"runtime_events":0,"shared_context_snapshots":486}
```

486 snapshots exist (periodic timer working) but 0 events persisted (event flow broken).

---

## 5. Which Bus is Canonical?

Based on the codebase analysis:

| Criterion | UnifiedEventBus | EnhancedEventBus |
|-----------|-----------------|------------------|
| Publish calls | 20+ in Bootstrap alone | 0 (NONE) |
| Subscribe calls | 98 total | 2 |
| Used by Subsystems | ALL | NONE |
| Used by Bindings | ALL | NONE |
| Used by Agents | ALL | NONE |
| Used by Services | ALL | NONE |
| Used by Coordinator | YES | NO |
| Used by WorkflowEngine | YES | NO |

**Conclusion: `UnifiedEventBus` is the CANONICAL event bus.**

`EnhancedEventBus` was either:
1. Designed as a future "enhanced" replacement but never fully adopted
2. Intended as a secondary bus for specific subsystems (persistence, SSE) but without proper forwarding
3. A premature abstraction that wasn't integrated

---

## 6. Correct Architectural Fix

### Option A: Make EnhancedEventBus Forward from UnifiedEventBus (Recommended)

Create a proper bridge where `UnifiedEventBus` forwards all events to `EnhancedEventBus`:

```typescript
// In RuntimeBootstrap constructor:
this.eventBus.subscribe('*', (event) => {
  this.enhancedEventBus.publish(event);
}, { priority: -2000 }); // Low priority so enhancedEventBus handlers run after
```

**Pros:**
- Preserves EnhancedEventBus features for subscribers that need them
- Minimal code change
- All existing publishers continue to work
- RuntimeBridge and Persistence work without modification

**Cons:**
- Potential for infinite loops if a handler on enhancedEventBus publishes back to eventBus
- Additional indirection in event flow

**Mitigation:**
- The forwarding subscription should use low priority to ensure it runs last
- Need to prevent handlers from publishing that could create loops

### Option B: Change EnhancedEventBus Subscribers to Use UnifiedEventBus (Simpler)

Change RuntimeBridge and PersistenceService subscriptions to use `UnifiedEventBus` directly:

```typescript
// Persistence subscription in start():
this.eventBus.subscribe('*', (event) => { ... });

// RuntimeBridge constructor change:
constructor(
  private eventBus: IUnifiedEventBus,  // Instead of EnhancedEventBus
  ...
)
```

**Pros:**
- Direct, no forwarding layer
- Eliminates confusion about which bus to use
- Simpler architecture

**Cons:**
- Loses EnhancedEventBus features (priority, logging, request/response)
- RuntimeBridge would need interface change
- If EnhancedEventBus features are needed later, requires refactoring

### Option C: Full Unification - Replace UnifiedEventBus with EnhancedEventBus

Make `EnhancedEventBus` the only event bus by:
1. Changing all publishers to use enhancedEventBus
2. Updating RuntimeBridge to accept EnhancedEventBus

**Pros:**
- Single event bus
- All advanced features available everywhere

**Cons:**
- 98+ changes required
- High risk of breaking existing functionality

---

## 7. Recommended Fix

**Option A (Forwarding Bridge)** is recommended because:

1. **Minimal change** - Only one forwarding subscription needed
2. **Preserves existing behavior** - All current subscribers continue working
3. **Future-proof** - If EnhancedEventBus features are needed, they're available
4. **Safe** - Low priority ensures no race conditions

**Implementation:**
```typescript
// In RuntimeBootstrap constructor, after both buses are created:
this.eventBus.subscribe('*', (event) => {
  this.enhancedEventBus.publish(event);
}, { priority: -2000, label: 'eventBus->enhancedEventBus-forwarder' });
```

**Additionally:**
- Remove my earlier fix (eventBusPersistSubscription) since the forwarder will handle it
- Keep the enhancedEventBus subscription for persistence (it will now receive events)

---

## 8. Infinite Loop Prevention

The earlier test showed an infinite loop when `enhancedEventBus` received events. This happened because:

1. Forwarding was from `enhancedEventBus` to `enhancedEventBus` (creating a loop)
2. OR `ResearchSubsystem` handler called `getBusinesses()` which published `LEAD_FOUND` which triggered the handler again

With **Option A** (forward from `eventBus` to `enhancedEventBus`):
- Events published to `eventBus` flow to `enhancedEventBus`
- `ResearchSubsystem` is subscribed to `eventBus` and triggers `DataService.getBusinesses()`
- `DataService.getBusinesses()` publishes `LEAD_FOUND` to `eventBus`
- This flows to `enhancedEventBus` but NOT back to `eventBus` (no circular forwarding)

The forwarding subscription is ONE-WAY: `eventBus` → `enhancedEventBus`, preventing loops.

---

## 9. Files Affected

| File | Change Required |
|------|-----------------|
| `runtime/src/bootstrap/RuntimeBootstrap.ts` | Add forwarding subscription, remove eventBusPersistSubscription |
| `runtime/src/bridge/RuntimeBridge.ts` | No change (receives via enhancedEventBus) |
| `runtime/src/persistence/PersistenceService.ts` | No change (subscribes to enhancedEventBus) |

---

## 10. Summary

| Item | Current State | Correct State |
|------|--------------|---------------|
| Canonical event bus | `UnifiedEventBus` | `UnifiedEventBus` |
| Enhanced features bus | `EnhancedEventBus` (unused) | `EnhancedEventBus` (receives forwarded events) |
| Persistence subscription | `enhancedEventBus` (broken) | `enhancedEventBus` (will work after forward) |
| RuntimeBridge subscription | `enhancedEventBus` (broken) | `enhancedEventBus` (will work after forward) |
| Event flow | Publish to eventBus → No delivery to enhancedEventBus | Publish to eventBus → Forwarded to enhancedEventBus |

**Next Step:** Implement Option A - single forwarding subscription from `eventBus` to `enhancedEventBus`.