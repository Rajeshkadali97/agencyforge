import { ILogger } from '../interfaces';

export type SubsystemStatus = 'healthy' | 'initializing' | 'degraded' | 'offline';

export interface SubsystemHealth {
  name: string;
  status: SubsystemStatus;
  lastCheck: Date;
  message?: string;
  details?: Record<string, unknown>;
  dependencies: string[];
}

export interface HealthCheckResult {
  healthy: SubsystemHealth[];
  degraded: SubsystemHealth[];
  offline: SubsystemHealth[];
  initializing: SubsystemHealth[];
  overall: SubsystemStatus;
  message: string;
}

export interface ISubsystem {
  name: string;
  checkHealth(): Promise<SubsystemHealth>;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export class HealthManager {
  private subsystems: Map<string, ISubsystem> = new Map();
  private logger: ILogger;
  private checkIntervalMs: number;
  private intervalHandle: NodeJS.Timeout | null = null;
  private lastHealthCheck: HealthCheckResult | null = null;

  constructor(logger: ILogger, checkIntervalMs = 30000) {
    this.logger = logger;
    this.checkIntervalMs = checkIntervalMs;
  }

  register(subsystem: ISubsystem): void {
    this.subsystems.set(subsystem.name, subsystem);
    this.logger.info('HealthManager: Registered subsystem', { name: subsystem.name });
  }

  /**
   * Register a simple health check as a virtual subsystem.
   * The check function should resolve to an object `{ healthy: boolean, message?: string }`.
   */
  registerHealthCheck(name: string, check: () => Promise<{ healthy: boolean; message?: string }>) {
    const subsystem: ISubsystem = {
      name,
      async initialize() {},
      async shutdown() {},
      async checkHealth() {
        try {
          const result = await check();
          return {
            name,
            status: result.healthy ? 'healthy' : 'degraded',
            lastCheck: new Date(),
            message: result.message,
            details: undefined,
            dependencies: [],
          };
        } catch (error) {
          return {
            name,
            status: 'offline',
            lastCheck: new Date(),
            message: error instanceof Error ? error.message : String(error),
            dependencies: [],
          };
        }
      },
    };
    this.register(subsystem);
  }


  unregister(name: string): boolean {
    const result = this.subsystems.delete(name);
    if (result) {
      this.logger.info('HealthManager: Unregistered subsystem', { name });
    }
    return result;
  }

  async checkAll(): Promise<HealthCheckResult> {
    const results = await Promise.allSettled(
      Array.from(this.subsystems.values()).map(async (subsystem) => {
        try {
          return await subsystem.checkHealth();
        } catch (error) {
          return {
            name: subsystem.name,
            status: 'offline' as SubsystemStatus,
            lastCheck: new Date(),
            message: error instanceof Error ? error.message : String(error),
            dependencies: [],
          };
        }
      })
    );

    const healthResults: SubsystemHealth[] = results
      .filter((r): r is PromiseFulfilledResult<SubsystemHealth> => r.status === 'fulfilled')
      .map((r) => r.value);

    const healthy = healthResults.filter((h) => h.status === 'healthy');
    const degraded = healthResults.filter((h) => h.status === 'degraded');
    const offline = healthResults.filter((h) => h.status === 'offline');
    const initializing = healthResults.filter((h) => h.status === 'initializing');

    let overall: SubsystemStatus = 'healthy';
    let message = 'All subsystems healthy';

    if (offline.length > 0) {
      overall = 'offline';
      message = `${offline.length} subsystem(s) offline: ${offline.map((h) => h.name).join(', ')}`;
    } else if (degraded.length > 0) {
      overall = 'degraded';
      message = `${degraded.length} subsystem(s) degraded: ${degraded.map((h) => h.name).join(', ')}`;
    } else if (initializing.length > 0) {
      overall = 'initializing';
      message = `${initializing.length} subsystem(s) initializing: ${initializing.map((h) => h.name).join(', ')}`;
    }

    this.lastHealthCheck = { healthy, degraded, offline, initializing, overall, message };
    return this.lastHealthCheck;
  }

  async checkSubsystem(name: string): Promise<SubsystemHealth | null> {
    const subsystem = this.subsystems.get(name);
    if (!subsystem) {
      return null;
    }

    try {
      return await subsystem.checkHealth();
    } catch (error) {
      return {
        name: subsystem.name,
        status: 'offline',
        lastCheck: new Date(),
        message: error instanceof Error ? error.message : String(error),
        dependencies: [],
      };
    }
  }

  getLastHealthCheck(): HealthCheckResult | null {
    return this.lastHealthCheck;
  }

  startPeriodicChecks(): void {
    if (this.intervalHandle) {
      return;
    }

    this.intervalHandle = setInterval(() => {
      this.checkAll().catch((err) => {
        this.logger.error('HealthManager: Periodic check failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, this.checkIntervalMs);

    this.logger.info('HealthManager: Started periodic checks', { intervalMs: this.checkIntervalMs });
  }

  stopPeriodicChecks(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      this.logger.info('HealthManager: Stopped periodic checks');
    }
  }

  listSubsystems(): string[] {
    return Array.from(this.subsystems.keys());
  }
}

export abstract class BaseSubsystem implements ISubsystem {
  abstract name: string;
  protected healthStatus: SubsystemStatus = 'initializing';
  protected healthMessage?: string;
  protected healthDetails: Record<string, unknown> = {};
  protected healthDependencies: string[] = [];

  abstract initialize(): Promise<void>;
  abstract shutdown(): Promise<void>;
  abstract checkOperational(): Promise<boolean>;

  async checkHealth(): Promise<SubsystemHealth> {
    try {
      const operational = await this.checkOperational();
      this.healthStatus = operational ? 'healthy' : 'degraded';
      if (!operational) {
        this.healthMessage = 'Operational check failed';
      }
    } catch (error) {
      this.healthStatus = 'offline';
      this.healthMessage = error instanceof Error ? error.message : String(error);
    }

    return {
      name: this.name,
      status: this.healthStatus,
      lastCheck: new Date(),
      message: this.healthMessage,
      details: this.healthDetails,
      dependencies: this.healthDependencies,
    };
  }
}