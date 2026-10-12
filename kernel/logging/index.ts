import { ILogger } from '../interfaces/ILogger';
import { LogLevel, KernelEvent, EventPayload } from '../types';

export class ConsoleLogger implements ILogger {
  private bindings: Record<string, unknown> = {};

  constructor(bindings: Record<string, unknown> = {}) {
    this.bindings = { ...bindings };
  }

  public debug(message: string, payload?: EventPayload): void {
    this.log('DEBUG', message, payload);
  }

  public info(message: string, payload?: EventPayload): void {
    this.log('INFO', message, payload);
  }

  public warning(message: string, payload?: EventPayload): void {
    this.log('WARNING', message, payload);
  }

  public error(message: string, payload?: EventPayload): void {
    this.log('ERROR', message, payload);
  }

  public critical(message: string, payload?: EventPayload): void {
    this.log('CRITICAL', message, payload);
  }

  public log(level: LogLevel, message: string, payload?: EventPayload): void {
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.bindings,
    };
    if (payload) {
      Object.assign(entry, payload);
    }
    console.log(JSON.stringify(entry));
  }

  public emitEvent(event: KernelEvent): void {
    this.log(event.level, event.event_type, event.payload as EventPayload);
  }

  public child(bindings: Record<string, unknown>): ILogger {
    return new ConsoleLogger({ ...this.bindings, ...bindings });
  }
}
