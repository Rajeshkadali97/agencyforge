// ============================================================
// Event & Logging Types
// ============================================================
export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export type EventType =
  | 'goal.ingested'
  | 'goal.parsed'
  | 'task.planned'
  | 'task.created'
  | 'agent.selected'
  | 'model.routed'
  | 'task.queued'
  | 'task.dequeued'
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'task.cancelled'
  | 'task.retrying'
  | 'task.assigned'
  | 'checkpoint.approved'
  | 'checkpoint.rejected'
  | 'workflow.created'
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.cancelled'
  | 'workflow.paused'
  | 'workflow.resumed'
  | 'runtime.started'
  | 'runtime.paused'
  | 'runtime.resumed'
  | 'runtime.shutdown'
  | 'system.error'
  | 'system.warning'
  | 'agent.registered'
  | 'agent.unregistered'
  | 'agent.activated'
  | 'agent.completed'
  | 'agent.heartbeat'
  | 'agent.health.changed'
  | 'memory.loaded'
  | 'memory.stored'
  | 'memory.retrieved'
  | 'business.discovered'
  | 'business.stored'
  | 'business.scored'
  | 'proposal.generated'
  | 'dashboard.updated'
  | 'voice.command_received'
  | 'character.state_changed';

export interface EventPayload {
  [key: string]: unknown;
}

export interface KernelEvent<TPayload extends EventPayload = EventPayload> {
  /** Unique event identifier */
  id: string;
  /** Event schema version (e.g., "1.0") */
  version: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Root trace for the goal lifecycle */
  trace_id: string;
  /** Current span/task identifier */
  span_id: string;
  /** Parent span for nested traces */
  parent_span_id?: string;
  /** Log severity */
  level: LogLevel;
  /** Canonical event type */
  event_type: EventType;
  /** Typed payload data */
  payload: TPayload;
}
