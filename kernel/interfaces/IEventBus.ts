import { KernelEvent, EventType, EventPayload } from '../types';

export type EventHandler<TPayload extends EventPayload = EventPayload> = (
  event: KernelEvent<TPayload>
) => void | Promise<void>;

export interface IEventBus {
  /** Publish a fully-formed event */
  publish<TPayload extends EventPayload>(
    event: KernelEvent<TPayload>
  ): void;

  /** Convenience: create and publish an event from raw parts */
  emit(eventType: EventType, payload: EventPayload): void;

  /** Subscribe to a specific event type. Returns subscription id */
  subscribe<TPayload extends EventPayload>(
    eventType: EventType,
    handler: EventHandler<TPayload>
  ): string;

  /** Unsubscribe by subscription id */
  unsubscribe(subscriptionId: string): boolean;

  /** Retrieve event history with optional filtering */
  getHistory(options?: {
    eventType?: EventType;
    limit?: number;
  }): KernelEvent[];

  /** Clear the event history buffer */
  clearHistory(): void;
}
