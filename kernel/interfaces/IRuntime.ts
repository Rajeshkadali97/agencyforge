import { Workflow, WorkflowDefinition, Task, TaskResult } from '../types';
import { IWorkflowEngine } from './IWorkflowEngine';
import { IScheduler } from './IScheduler';
import { IDependencyInjectionContainer } from './IDependencyInjection';
import { IEventBus } from './IEventBus';
import { ILogger } from './ILogger';

export interface IRuntime {
  /** Unique runtime identifier */
  id: string;

  /** Workflow engine instance */
  workflowEngine: IWorkflowEngine;

  /** Task scheduler instance */
  scheduler: IScheduler;

  /** Dependency injection container */
  container: IDependencyInjectionContainer;

  /** Event bus for cross-component communication */
  eventBus: IEventBus;

  /** Logger instance */
  logger: ILogger;

  /** Initialize the runtime */
  initialize(): Promise<void>;

  /** Start accepting and processing workflows */
  start(): Promise<void>;

  /** Pause the runtime (stop processing new workflows) */
  pause(): void;

  /** Resume the runtime */
  resume(): void;

  /** Submit a workflow definition for execution */
  submitWorkflow(definition: WorkflowDefinition): Promise<Workflow>;

  /** Cancel an active workflow */
  cancelWorkflow(workflowId: string): boolean;

  /** Get the status of a workflow */
  getWorkflowStatus(workflowId: string): string;

  /** Gracefully shut down the runtime */
  shutdown(): Promise<void>;
}
