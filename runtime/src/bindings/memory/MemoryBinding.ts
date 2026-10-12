import { ILogger } from '../../interfaces';
import { EnhancedEventBus } from '../../events/EnhancedEventBus';
import { RuntimeEventTypes, RuntimeEvent, BaseEventPayload } from '../../contracts';
import { SharedContextManager, SharedContextState } from '../../shared-context';

export interface MemoryBindingConfig {
  maxMemoryEntries?: number;
  maxHistoryEntries?: number;
}

export interface MemoryBindingPersistence {
  memory: MemoryEntry[];
  executionHistory: Array<{ taskId: string; agentId: string; timestamp: string; result: string }>;
}

export interface MemoryEntry {
  id: string;
  key: string;
  value: unknown;
  scope: string;
  createdAt: string;
  updatedAt: string;
  accessCount: number;
}

export class MemoryBinding {
  private memory: Map<string, MemoryEntry> = new Map();
  private executionHistory: Array<{ taskId: string; agentId: string; timestamp: string; result: string }> = [];
  private subscriptions: string[] = [];
  private listeners: Map<string, () => void> = new Map();
  private nextListenerId = 0;
  private maxMemoryEntries: number;
  private maxHistoryEntries: number;
  private sharedContext?: SharedContextManager;

  constructor(
    private eventBus: EnhancedEventBus,
    private logger: ILogger,
    config: MemoryBindingConfig = {}
  ) {
    this.maxMemoryEntries = config.maxMemoryEntries ?? 1000;
    this.maxHistoryEntries = config.maxHistoryEntries ?? 500;
  }

  setSharedContext(sharedContext: SharedContextManager): void {
    this.sharedContext = sharedContext;
  }

  async initialize(): Promise<void> {
    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.TASK_COMPLETED,
        (event: RuntimeEvent<BaseEventPayload & { taskId: string; agentId: string; output: unknown; durationMs: number }>) => {
          this.executionHistory.push({
            taskId: event.payload.taskId,
            agentId: event.payload.agentId,
            timestamp: event.payload.timestamp,
            result: typeof event.payload.output === 'string' ? event.payload.output : JSON.stringify(event.payload.output),
          });
          if (this.executionHistory.length > this.maxHistoryEntries) {
            this.executionHistory = this.executionHistory.slice(-this.maxHistoryEntries);
          }
        },
        { label: 'memory-binding-task-completed' }
      )
    );

    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.TASK_FAILED,
        (event: RuntimeEvent<BaseEventPayload & { taskId: string; agentId?: string; error: string }>) => {
          this.executionHistory.push({
            taskId: event.payload.taskId,
            agentId: event.payload.agentId ?? 'unknown',
            timestamp: event.payload.timestamp,
            result: `FAILED: ${event.payload.error}`,
          });
          if (this.executionHistory.length > this.maxHistoryEntries) {
            this.executionHistory = this.executionHistory.slice(-this.maxHistoryEntries);
          }
        },
        { label: 'memory-binding-task-failed' }
      )
    );

    this.logger.info('MemoryBinding: Initialized');
  }

  async shutdown(): Promise<void> {
    for (const subId of this.subscriptions) {
      this.eventBus.unsubscribe(subId);
    }
    this.subscriptions = [];
    this.memory.clear();
    this.executionHistory = [];
    this.listeners.clear();
    this.logger.info('MemoryBinding: Shutdown');
  }

  store(key: string, value: unknown, scope = 'global'): string {
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const existing = Array.from(this.memory.values()).find((e) => e.key === key && e.scope === scope);

    if (existing) {
      existing.value = value;
      existing.updatedAt = now;
      existing.accessCount++;
      this.notifyListeners();
      return existing.id;
    }

    const entry: MemoryEntry = {
      id,
      key,
      value,
      scope,
      createdAt: now,
      updatedAt: now,
      accessCount: 1,
    };
    this.memory.set(id, entry);

    if (this.memory.size > this.maxMemoryEntries) {
      const oldest = Array.from(this.memory.values()).sort(
        (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      );
      this.memory.delete(oldest[0].id);
    }

    this.notifyListeners();
    return id;
  }

  retrieve(key: string, scope?: string): unknown {
    for (const entry of this.memory.values()) {
      if (entry.key === key && (scope === undefined || entry.scope === scope)) {
        entry.accessCount++;
        entry.updatedAt = new Date().toISOString();
        return entry.value;
      }
    }
    return undefined;
  }

  delete(key: string, scope?: string): boolean {
    for (const [id, entry] of this.memory) {
      if (entry.key === key && (scope === undefined || entry.scope === scope)) {
        this.memory.delete(id as string);
        this.notifyListeners();
        return true;
      }
    }
    return false;
  }

  getExecutionHistory(limit?: number): Array<{ taskId: string; agentId: string; timestamp: string; result: string }> {
    return limit ? this.executionHistory.slice(-limit) : [...this.executionHistory];
  }

  getMemorySnapshot(): MemoryEntry[] {
    return Array.from(this.memory.values());
  }

  subscribeToChanges(listener: () => void): string {
    const id = `mbl_${++this.nextListenerId}`;
    this.listeners.set(id, listener);
    return id;
  }

  unsubscribeFromChanges(listenerId: string): boolean {
    return this.listeners.delete(listenerId);
  }

  getFullState(): MemoryBindingPersistence {
    return {
      memory: Array.from(this.memory.values()),
      executionHistory: [...this.executionHistory],
    };
  }

  restoreState(state: MemoryBindingPersistence): void {
    if (state.memory && Array.isArray(state.memory)) {
      this.memory.clear();
      for (const entry of state.memory) {
        this.memory.set(entry.id, entry);
      }
    }
    if (state.executionHistory && Array.isArray(state.executionHistory)) {
      this.executionHistory = state.executionHistory.slice(-this.maxHistoryEntries);
    }
    this.logger.info('MemoryBinding: State restored', {
      memoryEntries: this.memory.size,
      historyEntries: this.executionHistory.length,
    });
  }

  clearAll(): void {
    this.memory.clear();
    this.executionHistory = [];
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const [, listener] of this.listeners) {
      try {
        listener();
      } catch (err) {
        this.logger.error('MemoryBinding: Listener error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
