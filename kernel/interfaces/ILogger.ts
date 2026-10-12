import { LogLevel, EventPayload, KernelEvent } from '../types';

export interface ILogger {
  debug(message: string, payload?: EventPayload): void;
  info(message: string, payload?: EventPayload): void;
  warning(message: string, payload?: EventPayload): void;
  error(message: string, payload?: EventPayload): void;
  critical(message: string, payload?: EventPayload): void;
  log(level: LogLevel, message: string, payload?: EventPayload): void;

  /** Persist a structured event */
  emitEvent(event: KernelEvent): void;

  /** Create a child logger with additional context bindings */
  child(bindings: Record<string, unknown>): ILogger;
}
