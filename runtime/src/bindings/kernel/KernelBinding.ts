import { ILogger } from '../../interfaces';
import { EnhancedEventBus } from '../../events/EnhancedEventBus';
import { RuntimeEventTypes, RuntimeEvent, BaseEventPayload, GoalReceivedPayload, WorkflowStartedPayload, WorkflowCompletedPayload, WorkflowFailedPayload } from '../../contracts';

export interface KernelBindingConfig {
  maxCommandHistory?: number;
}

export interface KernelCommand {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
  result?: unknown;
  error?: string;
  durationMs?: number;
}

export interface KernelStatus {
  status: 'idle' | 'processing' | 'error';
  activeGoals: number;
  activeWorkflows: number;
  totalGoalsProcessed: number;
  totalWorkflowsCompleted: number;
  totalWorkflowsFailed: number;
  uptimeMs: number;
  startedAt: string;
  lastActivityAt: string;
}

export class KernelBinding {
  private status: KernelStatus;
  private commandHistory: KernelCommand[] = [];
  private subscriptions: string[] = [];
  private listeners: Map<string, (status: KernelStatus) => void> = new Map();
  private nextListenerId = 0;
  private maxCommandHistory: number;
  private startTime: number;

  constructor(
    private eventBus: EnhancedEventBus,
    private logger: ILogger,
    config: KernelBindingConfig = {}
  ) {
    this.maxCommandHistory = config.maxCommandHistory ?? 200;
    this.startTime = Date.now();
    this.status = {
      status: 'idle',
      activeGoals: 0,
      activeWorkflows: 0,
      totalGoalsProcessed: 0,
      totalWorkflowsCompleted: 0,
      totalWorkflowsFailed: 0,
      uptimeMs: 0,
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };
  }

  async initialize(): Promise<void> {
    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.GOAL_RECEIVED,
        (event: RuntimeEvent<GoalReceivedPayload>) => {
          this.status.activeGoals++;
          this.status.status = 'processing';
          this.status.lastActivityAt = event.payload.timestamp;
          this.recordCommand('goal.received', event.payload as unknown as Record<string, unknown>);
          this.notifyListeners();
        },
        { label: 'kernel-binding-goal' }
      )
    );

    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.WORKFLOW_STARTED,
        (event: RuntimeEvent<WorkflowStartedPayload>) => {
          this.status.activeWorkflows++;
          this.status.status = 'processing';
          this.status.lastActivityAt = event.payload.timestamp;
          this.recordCommand('workflow.started', event.payload as unknown as Record<string, unknown>);
          this.notifyListeners();
        },
        { label: 'kernel-binding-workflow-started' }
      )
    );

    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.WORKFLOW_COMPLETED,
        (event: RuntimeEvent<WorkflowCompletedPayload>) => {
          this.status.activeWorkflows = Math.max(0, this.status.activeWorkflows - 1);
          this.status.totalWorkflowsCompleted++;
          this.status.totalGoalsProcessed++;
          this.status.activeGoals = Math.max(0, this.status.activeGoals - 1);
          this.status.status = this.status.activeWorkflows > 0 ? 'processing' : 'idle';
          this.status.lastActivityAt = event.payload.timestamp;
          this.recordCommand('workflow.completed', event.payload as unknown as Record<string, unknown>);
          this.notifyListeners();
        },
        { label: 'kernel-binding-workflow-completed' }
      )
    );

    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.WORKFLOW_FAILED,
        (event: RuntimeEvent<WorkflowFailedPayload>) => {
          this.status.activeWorkflows = Math.max(0, this.status.activeWorkflows - 1);
          this.status.totalWorkflowsFailed++;
          this.status.totalGoalsProcessed++;
          this.status.activeGoals = Math.max(0, this.status.activeGoals - 1);
          this.status.status = this.status.activeWorkflows > 0 ? 'processing' : 'idle';
          this.status.lastActivityAt = event.payload.timestamp;
          this.recordCommand('workflow.failed', event.payload as unknown as Record<string, unknown>, event.payload.error);
          this.notifyListeners();
        },
        { label: 'kernel-binding-workflow-failed' }
      )
    );

    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.SYSTEM_ERROR,
        (event: RuntimeEvent<BaseEventPayload & { error: string; severity: string }>) => {
          if (event.payload.severity === 'CRITICAL') {
            this.status.status = 'error';
          }
          this.status.lastActivityAt = event.payload.timestamp;
          this.notifyListeners();
        },
        { label: 'kernel-binding-system-error' }
      )
    );

    this.logger.info('KernelBinding: Initialized');
  }

  async shutdown(): Promise<void> {
    for (const subId of this.subscriptions) {
      this.eventBus.unsubscribe(subId);
    }
    this.subscriptions = [];
    this.listeners.clear();
    this.logger.info('KernelBinding: Shutdown');
  }

  getStatus(): KernelStatus {
    return {
      ...this.status,
      uptimeMs: Date.now() - this.startTime,
    };
  }

  getCommandHistory(limit?: number): KernelCommand[] {
    return limit ? this.commandHistory.slice(-limit) : [...this.commandHistory];
  }

  subscribeToStatus(listener: (status: KernelStatus) => void): string {
    const id = `kbl_${++this.nextListenerId}`;
    this.listeners.set(id, listener);
    return id;
  }

  unsubscribeFromStatus(listenerId: string): boolean {
    return this.listeners.delete(listenerId);
  }

  private recordCommand(type: string, payload: Record<string, unknown>, error?: string): void {
    this.commandHistory.push({
      id: `kcmd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
      error,
    });
    if (this.commandHistory.length > this.maxCommandHistory) {
      this.commandHistory = this.commandHistory.slice(-this.maxCommandHistory);
    }
  }

  private notifyListeners(): void {
    const snapshot = this.getStatus();
    for (const [, listener] of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        this.logger.error('KernelBinding: Listener error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
