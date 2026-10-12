// Minimal kernel bridge to avoid importing from outside rootDir
// These types mirror the kernel interfaces needed by memory-engine

export type EventType =
  | 'memory.loaded'
  | 'system.warning'
  | 'system.error'
  | 'task.created'
  | 'task.completed'
  | 'task.failed'
  | 'agent.activated'
  | 'user.authenticated'
  | string;

export interface EventPayload {
  [key: string]: unknown;
}

export interface KernelEvent<TPayload extends EventPayload = EventPayload> {
  id: string;
  version: string;
  timestamp: string;
  trace_id: string;
  span_id: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  event_type: EventType;
  payload: TPayload;
}

export type EventHandler<TEvent extends KernelEvent = KernelEvent> = (event: TEvent) => void | Promise<void>;

export interface IEventBus {
  publish<TPayload extends EventPayload>(event: KernelEvent<TPayload>): void;
  subscribe<TPayload extends EventPayload>(eventType: EventType, handler: EventHandler<KernelEvent<TPayload>>): string;
  unsubscribe(subscriptionId: string): boolean;
  getEventHistory(eventType?: EventType, limit?: number): KernelEvent[];
}
