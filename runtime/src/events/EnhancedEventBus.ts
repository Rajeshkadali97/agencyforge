import { randomUUID } from 'crypto';
import { ILogger } from '../interfaces';
import { RuntimeEvent, RuntimeEventPayload, RuntimeEventTypes, BaseEventPayload, CharacterEmotionChangedPayload, DashboardNotificationPayload } from '../contracts';

export type EventHandler<T extends RuntimeEventPayload = RuntimeEventPayload> = (
  event: RuntimeEvent<T>
) => void | Promise<void>;

export interface EventSubscription {
  id: string;
  eventType: string | string[];
  handler: EventHandler;
  once?: boolean;
  priority: number;
  label?: string;
  active: boolean;
  createdAt: Date;
}

export interface EventLogEntry {
  event: RuntimeEvent;
  dispatchedAt: Date;
  handlerCount: number;
  errors: Array<{ subscriptionId: string; error: string }>;
  durationMs: number;
}

export interface IRequestResponse {
  resolve: (response: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class EnhancedEventBus {
  private subscriptions: Map<string, EventSubscription> = new Map();
  private history: RuntimeEvent[] = [];
  private log: EventLogEntry[] = [];
  private pendingRequests: Map<string, IRequestResponse> = new Map();
  private nextSubId = 0;
  private nextEventId = 0;
  private logger: ILogger;
  private maxHistorySize: number;
  private maxLogSize = 1000;

  constructor(logger: ILogger, maxHistorySize = 10000) {
    this.logger = logger;
    this.maxHistorySize = maxHistorySize;
  }

  publish<TPayload extends RuntimeEventPayload>(event: RuntimeEvent<TPayload>): void {
    this.history.push(event as RuntimeEvent);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    const startTime = Date.now();
    const errors: Array<{ subscriptionId: string; error: string }> = [];
    let handlerCount = 0;

    const sortedSubs = this.getMatchingSubscriptions(event.type);

    for (const sub of sortedSubs) {
      if (!sub.active) continue;
      handlerCount++;

      try {
        Promise.resolve(sub.handler(event as RuntimeEvent<TPayload>)).catch((err) => {
          errors.push({
            subscriptionId: sub.id,
            error: err instanceof Error ? err.message : String(err),
          });
          this.logger.error('Event handler error', {
            subscriptionId: sub.id,
            eventType: event.type,
            error: err instanceof Error ? err.message : String(err),
          });
        });

        if (sub.once) {
          sub.active = false;
          this.subscriptions.delete(sub.id);
        }
      } catch (err) {
        errors.push({
          subscriptionId: sub.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const logEntry: EventLogEntry = {
      event: event as RuntimeEvent,
      dispatchedAt: new Date(),
      handlerCount,
      errors,
      durationMs: Date.now() - startTime,
    };
    this.log.push(logEntry);
    if (this.log.length > this.maxLogSize) {
      this.log.shift();
    }

    this.checkPendingRequests(event as RuntimeEvent);
  }

  subscribe<TPayload extends RuntimeEventPayload>(
    eventType: string | string[],
    handler: EventHandler<TPayload>,
    options?: { once?: boolean; priority?: number; label?: string }
  ): string {
    const id = `sub_${++this.nextSubId}`;
    this.subscriptions.set(id, {
      id,
      eventType,
      handler: handler as EventHandler,
      once: options?.once,
      priority: options?.priority ?? 0,
      label: options?.label,
      active: true,
      createdAt: new Date(),
    });
    return id;
  }

  unsubscribe(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub.active = false;
      return this.subscriptions.delete(subscriptionId);
    }
    return false;
  }

  pauseSubscription(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub.active = false;
      return true;
    }
    return false;
  }

  resumeSubscription(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub.active = true;
      return true;
    }
    return false;
  }

  async request<TPayload extends RuntimeEventPayload, TResponse>(
    eventType: string,
    event: RuntimeEvent<TPayload>,
    timeoutMs = 30000
  ): Promise<TResponse> {
    const requestId = event.id;
    const responseEventType = `${eventType}.response`;

    return new Promise<TResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${eventType}`));
      }, timeoutMs);

      this.pendingRequests.set(requestId, {
        resolve: resolve as (r: unknown) => void,
        reject,
        timeout,
      });

      const responseSubId = this.subscribe(
        responseEventType,
        (responseEvent: RuntimeEvent) => {
          const payload = responseEvent.payload as { requestId?: string; response?: unknown; error?: string };
          if (payload.requestId === requestId) {
            this.unsubscribe(responseSubId);
            if (payload.error) {
              reject(new Error(payload.error));
            } else {
              resolve(payload.response as TResponse);
            }
          }
        },
        { priority: 100 }
      );

      this.publish(event);
    });
  }

  respond(requestEvent: RuntimeEvent, requestEventType: string, response: unknown, error?: string): void {
    const responseEventType = `${requestEventType}.response`;
    const responsePayload = {
      workflowId: requestEvent.payload.workflowId ?? requestEvent.traceId,
      timestamp: new Date().toISOString(),
      traceId: requestEvent.traceId,
      spanId: requestEvent.spanId,
      requestId: requestEvent.id,
      response,
      error,
    };

    const responseEvent: RuntimeEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: responseEventType,
      version: '1.0',
      timestamp: new Date().toISOString(),
      traceId: requestEvent.traceId,
      spanId: requestEvent.spanId,
      payload: responsePayload as unknown as BaseEventPayload,
    };

    this.publish(responseEvent);
  }

  broadcast<TPayload extends RuntimeEventPayload>(event: RuntimeEvent<TPayload>): void {
    this.publish(event);
  }

  getHistory(eventType?: string, limit?: number): RuntimeEvent[] {
    let result = [...this.history];
    if (eventType) {
      result = result.filter((e) => e.type === eventType);
    }
    if (limit) {
      result = result.slice(-limit);
    }
    return result;
  }

  getEventLog(limit?: number): EventLogEntry[] {
    return limit ? this.log.slice(-limit) : [...this.log];
  }

  getSubscriptions(): Array<{ id: string; eventType: string | string[]; label?: string; priority: number; active: boolean; createdAt: Date }> {
    return Array.from(this.subscriptions.values()).map((s) => ({
      id: s.id,
      eventType: s.eventType,
      label: s.label,
      priority: s.priority,
      active: s.active,
      createdAt: s.createdAt,
    }));
  }

  getStats(): { totalSubscriptions: number; activeSubscriptions: number; totalEvents: number; recentErrors: number } {
    return {
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions: Array.from(this.subscriptions.values()).filter((s) => s.active).length,
      totalEvents: this.history.length,
      recentErrors: this.log.slice(-100).reduce((sum, entry) => sum + entry.errors.length, 0),
    };
  }

  replayEvents(eventType: string, handler: EventHandler, fromTimestamp?: Date): void {
    const events = this.history.filter((e) => {
      if (e.type !== eventType) return false;
      if (fromTimestamp) {
        return new Date(e.timestamp) >= fromTimestamp;
      }
      return true;
    });

    for (const event of events) {
      try {
        handler(event);
      } catch (err) {
        this.logger.error('Replay handler error', {
          eventType: event.type,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  clearHistory(): void {
    this.history = [];
  }

  clearLog(): void {
    this.log = [];
  }

  private getMatchingSubscriptions(eventType: string): EventSubscription[] {
    const matching: EventSubscription[] = [];

    for (const [, sub] of this.subscriptions) {
      if (!sub.active) continue;

      let matches = false;
      if (sub.eventType === '*') {
        matches = true;
      } else if (Array.isArray(sub.eventType)) {
        matches = sub.eventType.includes(eventType);
      } else {
        matches = sub.eventType === eventType;
      }

      if (matches) {
        matching.push(sub);
      }
    }

    return matching.sort((a, b) => b.priority - a.priority);
  }

  private checkPendingRequests(event: RuntimeEvent): void {
    const payload = event.payload as { requestId?: string; response?: unknown; error?: string };
    if (!payload.requestId) return;

    const pending = this.pendingRequests.get(payload.requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(payload.requestId);

      if (payload.error) {
        pending.reject(new Error(payload.error));
      } else {
        pending.resolve(payload.response);
      }
    }
  }
}

