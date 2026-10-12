import { CancellationToken } from '../utils/cancellation';

export interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): ILogger;
}

export interface IConfiguration {
  get<T>(key: string, defaultValue?: T): T;
  getAll(): Record<string, unknown>;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  load(config: Record<string, unknown>): void;
}

export interface IEventBus {
  publish<TPayload extends Record<string, unknown>>(event: { type: string; payload: TPayload; traceId: string; spanId: string }): void;
  subscribe<TPayload extends Record<string, unknown>>(
    eventType: string,
    handler: (event: { type: string; payload: TPayload; traceId: string; spanId: string }) => void | Promise<void>
  ): string;
  unsubscribe(subscriptionId: string): boolean;
}

export interface ICancellationToken extends CancellationToken {}