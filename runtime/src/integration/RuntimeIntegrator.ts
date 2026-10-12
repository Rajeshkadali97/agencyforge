import { randomUUID } from 'crypto';
import { ILogger } from '../interfaces';
import { EnhancedEventBus } from '../events/EnhancedEventBus';
import { RuntimeEvent, RuntimeEventTypes, createRuntimeEvent, BaseEventPayload } from '../contracts';
import { HealthManager, SubsystemHealth, ISubsystem } from '../health/HealthManager';
import { Configuration } from '../config';
import { IRuntimeStateStore } from '../state';

export interface ModuleBinding {
  name: string;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  isInitialized(): boolean;
}

export interface RuntimeIntegratorConfig {
  logger: ILogger;
  eventBus: EnhancedEventBus;
  stateStore: IRuntimeStateStore;
  config: Configuration;
  healthManager: HealthManager;
}

export class RuntimeIntegrator {
  private logger: ILogger;
  private eventBus: EnhancedEventBus;
  private stateStore: IRuntimeStateStore;
  private config: Configuration;
  private healthManager: HealthManager;
  private modules: Map<string, ModuleBinding> = new Map();
  private isInitialized = false;

  constructor(config: RuntimeIntegratorConfig) {
    this.logger = config.logger;
    this.eventBus = config.eventBus;
    this.stateStore = config.stateStore;
    this.config = config.config;
    this.healthManager = config.healthManager;
  }

  async registerModule(module: ModuleBinding): Promise<void> {
    if (this.modules.has(module.name)) {
      throw new Error(`Module already registered: ${module.name}`);
    }
    this.modules.set(module.name, module);
    this.logger.info('RuntimeIntegrator: Module registered', { name: module.name });
  }

  async unregisterModule(name: string): Promise<void> {
    const module = this.modules.get(name);
    if (module) {
      await module.shutdown();
      this.modules.delete(name);
      this.logger.info('RuntimeIntegrator: Module unregistered', { name });
    }
  }

  async initializeAll(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('RuntimeIntegrator: Already initialized');
      return;
    }

    this.logger.info('RuntimeIntegrator: Initializing all modules', { count: this.modules.size });

    const results = await Promise.allSettled(
      Array.from(this.modules.values()).map(async (module) => {
        this.logger.info(`RuntimeIntegrator: Initializing ${module.name}...`);
        await module.initialize();
        this.logger.info(`RuntimeIntegrator: ${module.name} initialized`);
      })
    );

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      const errors = failures.map((f) =>
        f.status === 'rejected' ? (f.reason as Error).message : 'Unknown error'
      );
      this.logger.error('RuntimeIntegrator: Some modules failed to initialize', { errors });
      throw new Error(`Module initialization failed: ${errors.join(', ')}`);
    }

    this.setupEventRouting();
    this.isInitialized = true;
    this.logger.info('RuntimeIntegrator: All modules initialized');
  }

  async shutdownAll(): Promise<void> {
    this.logger.info('RuntimeIntegrator: Shutting down all modules', { count: this.modules.size });

    for (const [name, module] of this.modules) {
      try {
        await module.shutdown();
        this.logger.info(`RuntimeIntegrator: ${name} shut down`);
      } catch (error) {
        this.logger.error(`RuntimeIntegrator: Failed to shutdown ${name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.isInitialized = false;
    this.logger.info('RuntimeIntegrator: All modules shut down');
  }

  getModule(name: string): ModuleBinding | undefined {
    return this.modules.get(name);
  }

  listModules(): string[] {
    return Array.from(this.modules.keys());
  }

  getInitializationStatus(): Map<string, boolean> {
    const status = new Map<string, boolean>();
    for (const [name, module] of this.modules) {
      status.set(name, module.isInitialized());
    }
    return status;
  }

  private setupEventRouting(): void {
    this.eventBus.subscribe(RuntimeEventTypes.GOAL_RECEIVED, (event) => {
      this.stateStore.addEvent(event);
      this.logger.info('RuntimeIntegrator: Goal received', { goalId: (event.payload as { goalId: string }).goalId });
    });

    this.eventBus.subscribe(RuntimeEventTypes.WORKFLOW_STARTED, (event) => {
      this.stateStore.addEvent(event);
      this.logger.info('RuntimeIntegrator: Workflow started', { workflowId: (event.payload as { workflowId: string }).workflowId });
    });

    this.eventBus.subscribe(RuntimeEventTypes.WORKFLOW_COMPLETED, (event) => {
      this.stateStore.addEvent(event);
      this.logger.info('RuntimeIntegrator: Workflow completed', {
        workflowId: (event.payload as { workflowId: string }).workflowId,
        durationMs: (event.payload as { durationMs: number }).durationMs,
      });
    });

    this.eventBus.subscribe(RuntimeEventTypes.RESEARCH_STARTED, (event) => {
      this.stateStore.addEvent(event);
      this.logger.info('RuntimeIntegrator: Research started', { researchId: (event.payload as { researchId: string }).researchId });
    });

    this.eventBus.subscribe(RuntimeEventTypes.RESEARCH_COMPLETED, (event) => {
      this.stateStore.addEvent(event);
      this.logger.info('RuntimeIntegrator: Research completed', {
        researchId: (event.payload as { researchId: string }).researchId,
      });
    });

    this.eventBus.subscribe(RuntimeEventTypes.LEAD_FOUND, (event) => {
      this.stateStore.addEvent(event);
      const payload = event.payload as { leadId: string; businessName: string };
      this.logger.info('RuntimeIntegrator: Lead found', { leadId: payload.leadId, businessName: payload.businessName });
    });

    this.eventBus.subscribe(RuntimeEventTypes.LEAD_SCORED, (event) => {
      this.stateStore.addEvent(event);
      const payload = event.payload as { leadId: string; score: number; tier: string };
      this.logger.info('RuntimeIntegrator: Lead scored', { leadId: payload.leadId, score: payload.score, tier: payload.tier });
    });

    this.eventBus.subscribe(RuntimeEventTypes.PROPOSAL_GENERATED, (event) => {
      this.stateStore.addEvent(event);
      const payload = event.payload as { proposalId: string; clientName: string };
      this.logger.info('RuntimeIntegrator: Proposal generated', { proposalId: payload.proposalId, clientName: payload.clientName });
    });

    this.eventBus.subscribe(RuntimeEventTypes.DASHBOARD_NOTIFICATION, (event) => {
      this.stateStore.addEvent(event);
    });

    this.logger.info('RuntimeIntegrator: Event routing configured');
  }

  emitEvent<T extends Record<string, unknown>>(type: string, payload: T): void {
    const event = createRuntimeEvent(type, payload as unknown as BaseEventPayload, randomUUID(), randomUUID());
    this.eventBus.publish(event);
  }
}

export function createRuntimeIntegrator(config: RuntimeIntegratorConfig): RuntimeIntegrator {
  return new RuntimeIntegrator(config);
}