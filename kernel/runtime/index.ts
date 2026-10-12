import { randomUUID } from 'crypto';
import { Workflow, WorkflowDefinition } from '../types';
import { IRuntime } from '../interfaces/IRuntime';
import { IWorkflowEngine } from '../interfaces/IWorkflowEngine';
import { IScheduler } from '../interfaces/IScheduler';
import { IDependencyInjectionContainer } from '../interfaces/IDependencyInjection';
import { IEventBus } from '../interfaces/IEventBus';
import { ILogger } from '../interfaces/ILogger';
import { DependencyInjectionContainer } from '../di_container';
import { WorkflowEngine } from '../workflow_engine';
import { DependencyAwareScheduler } from '../scheduler';
import { EventBus } from '../event_bus';
import { ConsoleLogger } from '../logging';

export interface RuntimeDeps {
  eventBus?: IEventBus;
  logger?: ILogger;
  workflowEngine?: IWorkflowEngine;
  scheduler?: IScheduler;
  container?: IDependencyInjectionContainer;
}

export class KernelRuntime implements IRuntime {
  public readonly id: string;
  public workflowEngine: IWorkflowEngine;
  public scheduler: IScheduler;
  public container: IDependencyInjectionContainer;
  public eventBus: IEventBus;
  public logger: ILogger;

  private running = false;
  private paused = false;

  constructor(deps: RuntimeDeps = {}) {
    this.id = `runtime_${randomUUID()}`;
    this.eventBus = deps.eventBus ?? new EventBus();
    this.logger = deps.logger ?? new ConsoleLogger();
    this.container = deps.container ?? new DependencyInjectionContainer();
    this.scheduler = deps.scheduler ?? new DependencyAwareScheduler();
    this.workflowEngine =
      deps.workflowEngine ??
      new WorkflowEngine(this.eventBus, this.logger);
  }

  public async initialize(): Promise<void> {
    this.container.registerValue('IEventBus', this.eventBus);
    this.container.registerValue('ILogger', this.logger);
    this.container.registerValue('IRuntime', this);
    this.container.registerValue('IWorkflowEngine', this.workflowEngine);
    this.container.registerValue('IScheduler', this.scheduler);

    this.logger.info('Runtime initialized', { runtimeId: this.id });
  }

  public async start(): Promise<void> {
    this.running = true;
    this.paused = false;
    this.eventBus.emit('runtime.started', { runtime_id: this.id });
    this.logger.info('Runtime started', { runtimeId: this.id });
  }

  public pause(): void {
    this.paused = true;
    this.eventBus.emit('runtime.paused', { runtime_id: this.id });
    this.logger.info('Runtime paused', { runtimeId: this.id });
  }

  public resume(): void {
    this.paused = false;
    this.eventBus.emit('runtime.resumed', { runtime_id: this.id });
    this.logger.info('Runtime resumed', { runtimeId: this.id });
  }

  public async submitWorkflow(
    definition: WorkflowDefinition
  ): Promise<Workflow> {
    if (this.paused) {
      throw new Error('Runtime is paused, cannot accept new workflows');
    }

    const workflow = this.workflowEngine.createWorkflow(definition);

    for (const task of workflow.taskGraph.tasks) {
      this.scheduler.schedule(task);
    }

    this.logger.info('Workflow submitted', {
      workflowId: workflow.id,
      name: workflow.name,
    });

    await this.workflowEngine.startWorkflow(workflow.id);

    while (true) {
      const nextTask = this.scheduler.next();
      if (!nextTask) break;
      this.scheduler.completeTask(nextTask.id);
    }

    return workflow;
  }

  public cancelWorkflow(workflowId: string): boolean {
    return this.workflowEngine.cancelWorkflow(workflowId);
  }

  public getWorkflowStatus(workflowId: string): string {
    return this.workflowEngine.getWorkflowStatus(workflowId);
  }

  public async shutdown(): Promise<void> {
    this.running = false;
    this.eventBus.emit('runtime.shutdown', { runtime_id: this.id });
    this.logger.info('Runtime shutdown', { runtimeId: this.id });
  }
}
