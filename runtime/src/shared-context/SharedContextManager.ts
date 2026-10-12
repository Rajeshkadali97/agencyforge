import { ILogger } from '../interfaces';
import { RuntimeEvent, RuntimeEventTypes, createRuntimeEvent, BaseEventPayload } from '../contracts';
import { EnhancedEventBus } from '../events/EnhancedEventBus';

export interface SharedContextState {
  currentProject: ProjectContext | null;
  activeTask: TaskContext | null;
  conversation: ConversationContext | null;
  runtimeState: RuntimeRunState;
  userPreferences: UserPreferences;
  sharedMemory: Map<string, unknown>;
  executionHistory: ExecutionRecord[];
  activeWorkflow: WorkflowContext | null;
  agentStates: Map<string, AgentContextState>;
  lastUpdated: Date;
}

export interface ProjectContext {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export interface TaskContext {
  id: string;
  projectId: string;
  workflowId: string;
  objective: string;
  assignedAgentId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  createdAt: Date;
  result?: unknown;
  error?: string;
}

export interface ConversationContext {
  id: string;
  userId: string;
  agentId?: string;
  messages: Array<{ role: 'user' | 'agent' | 'system'; content: string; timestamp: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RuntimeRunState {
  isRunning: boolean;
  uptimeMs: number;
  startedAt: Date | null;
  subsystemHealth: Map<string, { status: string; lastCheck: Date }>;
  activeWorkflowCount: number;
  activeAgentCount: number;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: { enabled: boolean; sound: boolean; desktop: boolean };
  dashboard: { layout: string; panels: string[] };
  defaults: Record<string, unknown>;
}

export interface WorkflowContext {
  id: string;
  name: string;
  status: string;
  currentStepId?: string;
  completedSteps: string[];
  failedSteps: string[];
  startTime: Date;
  metadata: Record<string, unknown>;
}

export interface AgentContextState {
  agentId: string;
  status: string;
  emotion: string;
  currentTask?: string;
  lastActivity: Date;
  message?: string;
}

export interface ExecutionRecord {
  id: string;
  workflowId: string;
  taskId: string;
  agentId?: string;
  objective: string;
  success: boolean;
  result?: unknown;
  error?: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
}

export type ContextChangeListener = (state: SharedContextState) => void;

export class SharedContextManager {
  private state: SharedContextState;
  private logger: ILogger;
  private eventBus: EnhancedEventBus;
  private listeners: Set<ContextChangeListener> = new Set();
  private maxHistorySize = 100;

  constructor(logger: ILogger, eventBus: EnhancedEventBus) {
    this.logger = logger;
    this.eventBus = eventBus;

    this.state = {
      currentProject: null,
      activeTask: null,
      conversation: null,
      runtimeState: {
        isRunning: false,
        uptimeMs: 0,
        startedAt: null,
        subsystemHealth: new Map(),
        activeWorkflowCount: 0,
        activeAgentCount: 0,
      },
      userPreferences: {
        theme: 'system',
        language: 'en',
        notifications: { enabled: true, sound: true, desktop: true },
        dashboard: { layout: 'default', panels: [] },
        defaults: {},
      },
      sharedMemory: new Map(),
      executionHistory: [],
      activeWorkflow: null,
      agentStates: new Map(),
      lastUpdated: new Date(),
    };

    this.setupEventSubscriptions();
  }

  getState(): SharedContextState {
    return this.state;
  }

  getSnapshot(): Record<string, unknown> {
    return {
      currentProject: this.state.currentProject,
      activeTask: this.state.activeTask,
      conversation: this.state.conversation
        ? {
            ...this.state.conversation,
            messages: this.state.conversation.messages.slice(-10),
          }
        : null,
      runtimeState: {
        ...this.state.runtimeState,
        subsystemHealth: Object.fromEntries(this.state.runtimeState.subsystemHealth),
      },
      userPreferences: this.state.userPreferences,
      sharedMemory: Object.fromEntries(this.state.sharedMemory),
      activeWorkflow: this.state.activeWorkflow,
      agentStates: Object.fromEntries(this.state.agentStates),
      lastUpdated: this.state.lastUpdated,
    };
  }

  setCurrentProject(project: ProjectContext | null): void {
    this.state.currentProject = project;
    this.notify();
    this.logger.info('SharedContext: Project set', { projectId: project?.id });
  }

  setActiveTask(task: TaskContext | null): void {
    this.state.activeTask = task;
    this.notify();
  }

  setConversation(conversation: ConversationContext | null): void {
    this.state.conversation = conversation;
    this.notify();
  }

  addConversationMessage(role: 'user' | 'agent' | 'system', content: string): void {
    if (!this.state.conversation) {
      this.state.conversation = {
        id: `conv_${Date.now()}`,
        userId: 'operator',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    this.state.conversation.messages.push({ role, content, timestamp: new Date() });
    this.state.conversation.updatedAt = new Date();

    if (this.state.conversation.messages.length > 100) {
      this.state.conversation = {
        ...this.state.conversation,
        messages: this.state.conversation.messages.slice(-50),
      };
    }

    this.notify();
  }

  setRuntimeRunning(isRunning: boolean): void {
    this.state.runtimeState.isRunning = isRunning;
    if (isRunning && !this.state.runtimeState.startedAt) {
      this.state.runtimeState.startedAt = new Date();
    }
    this.notify();
  }

  updateSubsystemHealth(name: string, status: string): void {
    this.state.runtimeState.subsystemHealth.set(name, { status, lastCheck: new Date() });
    this.notify();
  }

  updateActiveCounts(workflowCount: number, agentCount: number): void {
    this.state.runtimeState.activeWorkflowCount = workflowCount;
    this.state.runtimeState.activeAgentCount = agentCount;
    this.notify();
  }

  setUserPreference<Key extends keyof UserPreferences>(key: Key, value: UserPreferences[Key]): void {
    (this.state.userPreferences as unknown as Record<string, unknown>)[key] = value;
    this.notify();
  }

  setSharedMemory(key: string, value: unknown): void {
    this.state.sharedMemory.set(key, value);
    this.notify();
  }

  getSharedMemory<T>(key: string, defaultValue?: T): T | undefined {
    const value = this.state.sharedMemory.get(key);
    return (value as T) ?? defaultValue;
  }

  deleteSharedMemory(key: string): boolean {
    const result = this.state.sharedMemory.delete(key);
    if (result) this.notify();
    return result;
  }

  setActiveWorkflow(workflow: WorkflowContext | null): void {
    this.state.activeWorkflow = workflow;
    this.notify();
  }

  updateAgentState(agentId: string, updates: Partial<AgentContextState>): void {
    const existing = this.state.agentStates.get(agentId);
    if (existing) {
      this.state.agentStates.set(agentId, { ...existing, ...updates, lastActivity: new Date() });
    } else {
      this.state.agentStates.set(agentId, {
        agentId,
        status: 'idle',
        emotion: 'idle',
        lastActivity: new Date(),
        ...updates,
      });
    }
    this.notify();
  }

  getAgentStates(): Map<string, AgentContextState> {
    return this.state.agentStates;
  }

  addExecutionRecord(record: ExecutionRecord): void {
    this.state.executionHistory.push(record);
    if (this.state.executionHistory.length > this.maxHistorySize) {
      this.state.executionHistory.shift();
    }
    this.notify();
  }

  getExecutionHistory(limit?: number): ExecutionRecord[] {
    return limit
      ? this.state.executionHistory.slice(-limit)
      : [...this.state.executionHistory];
  }

  subscribe(listener: ContextChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.state.lastUpdated = new Date();
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        this.logger.error('SharedContext listener error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private setupEventSubscriptions(): void {
    this.eventBus.subscribe(RuntimeEventTypes.AGENT_STATUS_CHANGED, (event) => {
      const payload = event.payload as { agentId: string; currentStatus: string; message?: string };
      this.updateAgentState(payload.agentId, {
        status: payload.currentStatus,
        message: payload.message,
      });
    });

    this.eventBus.subscribe(RuntimeEventTypes.CHARACTER_EMOTION_CHANGED, (event) => {
      const payload = event.payload as CharacterEmotionChangedPayload;
      this.updateAgentState(payload.characterId, {
        emotion: payload.currentEmotion,
      });
    });

    this.eventBus.subscribe(RuntimeEventTypes.WORKFLOW_STARTED, (event) => {
      const payload = event.payload as { workflowId: string; workflowType: string };
      this.setActiveWorkflow({
        id: payload.workflowId,
        name: payload.workflowType,
        status: 'running',
        completedSteps: [],
        failedSteps: [],
        startTime: new Date(),
        metadata: {},
      });
    });

    this.eventBus.subscribe(RuntimeEventTypes.WORKFLOW_COMPLETED, (event) => {
      const payload = event.payload as { workflowId: string; result: unknown; durationMs: number };
      this.addExecutionRecord({
        id: `exec_${Date.now()}`,
        workflowId: payload.workflowId,
        taskId: '',
        objective: 'Workflow completed',
        success: true,
        result: payload.result,
        startedAt: new Date(Date.now() - payload.durationMs),
        completedAt: new Date(),
        durationMs: payload.durationMs,
      });
      this.setActiveWorkflow(null);
    });

    this.eventBus.subscribe(RuntimeEventTypes.WORKFLOW_FAILED, (event) => {
      const payload = event.payload as { workflowId: string; error: string; durationMs: number };
      this.addExecutionRecord({
        id: `exec_${Date.now()}`,
        workflowId: payload.workflowId,
        taskId: '',
        objective: 'Workflow failed',
        success: false,
        error: payload.error,
        startedAt: new Date(Date.now() - payload.durationMs),
        completedAt: new Date(),
        durationMs: payload.durationMs,
      });
    });

    this.eventBus.subscribe(RuntimeEventTypes.TASK_STARTED, (event) => {
      const payload = event.payload as { taskId: string; agentId: string; objective: string };
      this.setActiveTask({
        id: payload.taskId,
        projectId: this.state.currentProject?.id ?? 'default',
        workflowId: this.state.activeWorkflow?.id ?? '',
        objective: payload.objective,
        assignedAgentId: payload.agentId,
        status: 'running',
        progress: 0,
        createdAt: new Date(),
      });
    });

    this.eventBus.subscribe(RuntimeEventTypes.TASK_COMPLETED, (event) => {
      const payload = event.payload as { taskId: string; agentId: string; output: unknown; durationMs: number };
      if (this.state.activeTask?.id === payload.taskId) {
        this.state.activeTask.status = 'completed';
        this.state.activeTask.progress = 100;
        this.state.activeTask.result = payload.output;
        this.notify();
      }
    });

    this.eventBus.subscribe(RuntimeEventTypes.TASK_PROGRESS, (event) => {
      const payload = event.payload as { taskId: string; progress: number };
      if (this.state.activeTask?.id === payload.taskId) {
        this.state.activeTask.progress = payload.progress;
        this.notify();
      }
    });

    this.eventBus.subscribe(RuntimeEventTypes.VOICE_COMMAND, (event) => {
      const payload = event.payload as { command: string; intent?: string };
      this.addConversationMessage('user', payload.command);
    });

    this.eventBus.subscribe(RuntimeEventTypes.VOICE_RESPONSE, (event) => {
      const payload = event.payload as { response: string; agentId?: string };
      this.addConversationMessage('agent', payload.response);
    });

    this.eventBus.subscribe(RuntimeEventTypes.DASHBOARD_NOTIFICATION, (event) => {
      const payload = event.payload as DashboardNotificationPayload;
      this.logger.info('SharedContext: Dashboard notification', {
        type: payload.type,
        title: payload.title,
        urgent: payload.urgent,
      });
    });

    this.logger.info('SharedContextManager: Event subscriptions configured');
  }
}

type CharacterEmotionChangedPayload = {
  workflowId: string;
  timestamp: string;
  traceId: string;
  spanId: string;
  characterId: string;
  department: string;
  previousEmotion: string;
  currentEmotion: string;
  triggerEvent?: string;
};

type DashboardNotificationPayload = {
  workflowId: string;
  timestamp: string;
  traceId: string;
  spanId: string;
  notificationId: string;
  type: string;
  title: string;
  message: string;
  urgent: boolean;
  agentId?: string;
};
