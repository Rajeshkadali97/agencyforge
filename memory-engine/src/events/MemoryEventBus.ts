import { IEventBus, EventHandler, KernelEvent, EventType, EventPayload } from '../kernel-bridge';
import { MemoryEventType, MemoryEvent } from '../types/events';

export interface IMemoryEventBus {
  publishMemoryEvent(event: MemoryEvent): void;
  subscribeToMemoryEvent<TPayload extends EventPayload>(
    eventType: MemoryEventType,
    handler: EventHandler<KernelEvent<TPayload>>
  ): string;
  unsubscribe(subscriptionId: string): boolean;
  getMemoryEventHistory(eventType?: MemoryEventType, limit?: number): MemoryEvent[];
}

export class MemoryEventBus implements IMemoryEventBus {
  private kernelEventBus: IEventBus;
  private memorySubscriptions: Map<string, { eventType: MemoryEventType; handler: EventHandler }> = new Map();
  private memoryHistory: MemoryEvent[] = [];
  private maxHistorySize = 10000;

  constructor(kernelEventBus: IEventBus) {
    this.kernelEventBus = kernelEventBus;
  }

  publishMemoryEvent(event: MemoryEvent): void {
    // Add to memory history
    this.memoryHistory.push(event);
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }

    // Map memory event type to kernel event type
    const kernelEventType = this.mapMemoryEventToKernelEvent(event.event_type as any);

    // Publish to kernel event bus
    this.kernelEventBus.publish({
      ...event,
      event_type: kernelEventType,
    } as KernelEvent<EventPayload>);
  }

  subscribeToMemoryEvent<TPayload extends EventPayload>(
    eventType: MemoryEventType,
    handler: EventHandler<KernelEvent<TPayload>>
  ): string {
    const kernelEventType = this.mapMemoryEventToKernelEvent(eventType);
    const subscriptionId = this.kernelEventBus.subscribe(kernelEventType, handler);

    this.memorySubscriptions.set(subscriptionId, {
      eventType,
      handler: handler as EventHandler,
    });

    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): boolean {
    const sub = this.memorySubscriptions.get(subscriptionId);
    if (sub) {
      this.memorySubscriptions.delete(subscriptionId);
      return this.kernelEventBus.unsubscribe(subscriptionId);
    }
    return false;
  }

  getMemoryEventHistory(eventType?: MemoryEventType, limit?: number): MemoryEvent[] {
    let result = [...this.memoryHistory];

    if (eventType) {
      result = result.filter(e => e.event_type === eventType);
    }

    if (limit) {
      result = result.slice(-limit);
    }

    return result;
  }

  private mapMemoryEventToKernelEvent(memoryEventType: MemoryEventType): EventType {
    const mapping: Record<MemoryEventType, EventType> = {
      'memory.created': 'memory.loaded',
      'memory.updated': 'memory.loaded',
      'memory.deleted': 'memory.loaded',
      'memory.archived': 'memory.loaded',
      'memory.retrieved': 'memory.loaded',
      'memory.merged': 'memory.loaded',
      'memory.expired': 'memory.loaded',
      'memory.forgotten': 'memory.loaded',
      'memory.pinned': 'memory.loaded',
      'memory.unpinned': 'memory.loaded',
      'knowledge.updated': 'memory.loaded',
      'knowledge.extracted': 'memory.loaded',
      'relationship.created': 'memory.loaded',
      'relationship.updated': 'memory.loaded',
      'relationship.deleted': 'memory.loaded',
      'entity.created': 'memory.loaded',
      'entity.updated': 'memory.loaded',
      'entity.deleted': 'memory.loaded',
      'fact.extracted': 'memory.loaded',
      'fact.verified': 'memory.loaded',
      'fact.deprecated': 'memory.loaded',
      'memory.indexed': 'memory.loaded',
      'memory.embedded': 'memory.loaded',
      'memory.summarized': 'memory.loaded',
      'memory.classified': 'memory.loaded',
      'search.performed': 'memory.loaded',
      'retrieval.performed': 'memory.loaded',
      'provider.connected': 'system.warning',
      'provider.disconnected': 'system.warning',
      'provider.error': 'system.error',
      'storage.quota.warning': 'system.warning',
      'storage.quota.exceeded': 'system.error',
      'archive.created': 'memory.loaded',
      'archive.restored': 'memory.loaded',
      'batch.processing.started': 'system.warning',
      'batch.processing.completed': 'memory.loaded',
      'batch.processing.failed': 'system.error',
    };

    return mapping[memoryEventType] || 'system.warning';
  }
}

export function createMemoryEventBus(kernelEventBus: IEventBus): IMemoryEventBus {
  return new MemoryEventBus(kernelEventBus);
}