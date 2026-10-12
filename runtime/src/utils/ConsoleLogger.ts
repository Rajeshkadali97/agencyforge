import { ILogger } from '../interfaces';
import { Configuration } from '../config';

export class ConsoleLogger implements ILogger {
  private bindings: Record<string, unknown> = {};
  private config?: Configuration;

  constructor(config?: Configuration) {
    this.config = config;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('DEBUG')) {
      this.log('DEBUG', message, meta);
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('INFO')) {
      this.log('INFO', message, meta);
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('WARNING')) {
      this.log('WARNING', message, meta);
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('ERROR')) {
      this.log('ERROR', message, meta);
    }
  }

  child(bindings: Record<string, unknown>): ILogger {
    const logger = new ConsoleLogger(this.config);
    logger.bindings = { ...this.bindings, ...bindings };
    return logger;
  }

  private shouldLog(level: string): boolean {
    if (!this.config) return true;

    const logLevel = this.config.get('logging.level', 'INFO');
    const levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];
    const currentLevelIndex = levels.indexOf(logLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  private log(level: string, message: string, meta?: Record<string, unknown>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.bindings,
      ...meta,
    };

    const format = this.config?.get('logging.format', 'json');
    if (format === 'json') {
      console.log(JSON.stringify(entry));
    } else {
      console.log(`[${entry.timestamp}] ${level}: ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }
}