import { KernelEvent, EventType, EventPayload } from '../types';
import { IEventBus, EventHandler } from '../interfaces/IEventBus';

export class EventBus implements IEventBus {
  private subscriptions: Map<
    string,
    { eventType: EventType; handler: EventHandler<EventPayload> }
  > = new Map();
  private history: KernelEvent[] = [];
  private nextSubId = 0;
  private nextEventId = 0;

  public publish<TPayload extends EventPayload>(
    event: KernelEvent<TPayload>
  ): void {
    this.history.push(event as KernelEvent<EventPayload>);
    for (const [, sub] of this.subscriptions) {
      if (sub.eventType === event.event_type) {
        Promise.resolve(sub.handler(event as KernelEvent<EventPayload>)).catch(
          (err) => {
            console.error('EventBus async handler error:', err);
          }
        );
      }
    }
  }

  public emit(eventType: EventType, payload: EventPayload): void {
    const event: KernelEvent = {
      id: `ev_${++this.nextEventId}`,
      version: '1.0',
      timestamp: new Date().toISOString(),
      trace_id: 'system',
      span_id: 'system',
      level: 'INFO',
      event_type: eventType,
      payload,
    };
    this.publish(event);
  }

  public subscribe<TPayload extends EventPayload>(
    eventType: EventType,
    handler: EventHandler<TPayload>
  ): string {
    const id = `sub_${++this.nextSubId}`;
    this.subscriptions.set(id, {
      eventType,
      handler: handler as EventHandler<EventPayload>,
    });
    return id;
  }

  public unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  public getHistory(options?: {
    eventType?: EventType;
    limit?: number;
  }): KernelEvent[] {
    let result = [...this.history];
    if (options?.eventType) {
      result = result.filter((e) => e.event_type === options.eventType);
    }
    if (options?.limit) {
      result = result.slice(-options.limit);
    }
    return result;
  }

  public clearHistory(): void {
    this.history = [];
  }
}
