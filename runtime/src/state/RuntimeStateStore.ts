import { WorkflowExecution, WorkflowStatus } from '../workflow';
import { AgentMetadata, AgentStatus, AgentHealth } from '../agent';
import { RuntimeEvent } from '../contracts';

export interface ProjectState {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface TaskState {
  id: string;
  workflowId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  agentId?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  result?: unknown;
  error?: string;
}

export interface NotificationState {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  agentId?: string;
  workflowId?: string;
}

export interface VoiceState {
  sessionId: string;
  status: 'idle' | 'listening' | 'speaking' | 'processing';
  agentId?: string;
  lastCommand?: string;
  lastResponse?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterState {
  characterId: string;
  department: string;
  emotion: string;
  pose: string;
  isSpeaking: boolean;
  isListening: boolean;
  lastUpdate: Date;
}

export interface ResearchJobState {
  jobId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  request: unknown;
  result?: unknown;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface RevenueJobState {
  jobId: string;
  workflowId: string;
  type: 'lead_scoring' | 'proposal_generation' | 'website_audit' | 'deal_tracking';
  status: 'pending' | 'running' | 'completed' | 'failed';
  leadId?: string;
  result?: unknown;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface RuntimeStateSnapshot {
  projects: Map<string, ProjectState>;
  tasks: Map<string, TaskState>;
  workflows: Map<string, WorkflowExecution>;
  agents: Map<string, { metadata: AgentMetadata; status: AgentStatus; health: AgentHealth }>;
  notifications: Map<string, NotificationState>;
  voice: Map<string, VoiceState>;
  characters: Map<string, CharacterState>;
  researchJobs: Map<string, ResearchJobState>;
  revenueJobs: Map<string, RevenueJobState>;
  events: RuntimeEvent[];
  updatedAt: Date;
}

export interface IRuntimeStateStore {
  // Projects
  setProject(project: ProjectState): void;
  getProject(projectId: string): ProjectState | undefined;
  updateProject(projectId: string, updates: Partial<ProjectState>): void;
  listProjects(status?: string): ProjectState[];

  // Tasks
  setTask(task: TaskState): void;
  getTask(taskId: string): TaskState | undefined;
  updateTask(taskId: string, updates: Partial<TaskState>): void;
  listTasks(workflowId?: string, status?: string): TaskState[];

  // Workflows
  setWorkflow(execution: WorkflowExecution): void;
  getWorkflow(workflowId: string): WorkflowExecution | undefined;
  updateWorkflow(workflowId: string, updates: Partial<WorkflowExecution>): void;
  listWorkflows(status?: WorkflowStatus): WorkflowExecution[];

  // Agents
  setAgent(agentId: string, metadata: AgentMetadata, status: AgentStatus, health: AgentHealth): void;
  getAgent(agentId: string): { metadata: AgentMetadata; status: AgentStatus; health: AgentHealth } | undefined;
  updateAgentStatus(agentId: string, status: Partial<AgentStatus>): void;
  updateAgentHealth(agentId: string, health: Partial<AgentHealth>): void;
  listAgents(): { metadata: AgentMetadata; status: AgentStatus; health: AgentHealth }[];

  // Notifications
  addNotification(notification: NotificationState): void;
  getNotification(notificationId: string): NotificationState | undefined;
  markNotificationRead(notificationId: string): void;
  listNotifications(unreadOnly?: boolean): NotificationState[];
  clearNotifications(): void;

  // Voice
  setVoiceState(state: VoiceState): void;
  getVoiceState(sessionId: string): VoiceState | undefined;
  updateVoiceState(sessionId: string, updates: Partial<VoiceState>): void;
  listVoiceStates(): VoiceState[];

  // Characters
  setCharacterState(state: CharacterState): void;
  getCharacterState(characterId: string): CharacterState | undefined;
  updateCharacterEmotion(characterId: string, emotion: string, triggerEvent?: string): void;
  listCharacterStates(): CharacterState[];

  // Research Jobs
  setResearchJob(job: ResearchJobState): void;
  getResearchJob(jobId: string): ResearchJobState | undefined;
  updateResearchJob(jobId: string, updates: Partial<ResearchJobState>): void;
  listResearchJobs(status?: string): ResearchJobState[];

  // Revenue Jobs
  setRevenueJob(job: RevenueJobState): void;
  getRevenueJob(jobId: string): RevenueJobState | undefined;
  updateRevenueJob(jobId: string, updates: Partial<RevenueJobState>): void;
  listRevenueJobs(status?: string): RevenueJobState[];

  // Events
  addEvent(event: RuntimeEvent): void;
  getEvents(eventType?: string, limit?: number): RuntimeEvent[];
  clearEvents(): void;

  // Snapshot
  getSnapshot(): RuntimeStateSnapshot;
  clear(): void;
}

export class InMemoryRuntimeStateStore implements IRuntimeStateStore {
  private projectsStore: Map<string, ProjectState> = new Map();
  private tasksStore: Map<string, TaskState> = new Map();
  private workflowsStore: Map<string, WorkflowExecution> = new Map();
  private agentsStore: Map<string, { metadata: AgentMetadata; status: AgentStatus; health: AgentHealth }> = new Map();
  private notificationsStore: Map<string, NotificationState> = new Map();
  private voiceStore: Map<string, VoiceState> = new Map();
  private charactersStore: Map<string, CharacterState> = new Map();
  private researchJobsStore: Map<string, ResearchJobState> = new Map();
  private revenueJobsStore: Map<string, RevenueJobState> = new Map();
  private eventsStore: RuntimeEvent[] = [];
  private updatedAt: Date = new Date();

  setProject(project: ProjectState): void {
    this.projectsStore.set(project.id, project);
    this.updatedAt = new Date();
  }

  getProject(projectId: string): ProjectState | undefined {
    return this.projectsStore.get(projectId);
  }

  updateProject(projectId: string, updates: Partial<ProjectState>): void {
    const project = this.projectsStore.get(projectId);
    if (project) {
      this.projectsStore.set(projectId, { ...project, ...updates, updatedAt: new Date() });
      this.updatedAt = new Date();
    }
  }

  listProjects(status?: string): ProjectState[] {
    const projects = Array.from(this.projectsStore.values());
    if (status) {
      return projects.filter((p) => p.status === status);
    }
    return projects;
  }

  setTask(task: TaskState): void {
    this.tasksStore.set(task.id, task);
    this.updatedAt = new Date();
  }

  getTask(taskId: string): TaskState | undefined {
    return this.tasksStore.get(taskId);
  }

  updateTask(taskId: string, updates: Partial<TaskState>): void {
    const task = this.tasksStore.get(taskId);
    if (task) {
      this.tasksStore.set(taskId, { ...task, ...updates, updatedAt: new Date() });
      this.updatedAt = new Date();
    }
  }

  listTasks(workflowId?: string, status?: string): TaskState[] {
    let tasks = Array.from(this.tasksStore.values());
    if (workflowId) {
      tasks = tasks.filter((t) => t.workflowId === workflowId);
    }
    if (status) {
      tasks = tasks.filter((t) => t.status === status);
    }
    return tasks;
  }

  setWorkflow(execution: WorkflowExecution): void {
    this.workflowsStore.set(execution.workflowId, execution);
    this.updatedAt = new Date();
  }

  getWorkflow(workflowId: string): WorkflowExecution | undefined {
    return this.workflowsStore.get(workflowId);
  }

  updateWorkflow(workflowId: string, updates: Partial<WorkflowExecution>): void {
    const workflow = this.workflowsStore.get(workflowId);
    if (workflow) {
      this.workflowsStore.set(workflowId, { ...workflow, ...updates });
      this.updatedAt = new Date();
    }
  }

  listWorkflows(status?: WorkflowStatus): WorkflowExecution[] {
    const workflows = Array.from(this.workflowsStore.values());
    if (status) {
      return workflows.filter((w) => w.status === status);
    }
    return workflows;
  }

  setAgent(
    agentId: string,
    metadata: AgentMetadata,
    status: AgentStatus,
    health: AgentHealth
  ): void {
    this.agentsStore.set(agentId, { metadata, status, health });
    this.updatedAt = new Date();
  }

  getAgent(agentId: string): { metadata: AgentMetadata; status: AgentStatus; health: AgentHealth } | undefined {
    return this.agentsStore.get(agentId);
  }

  updateAgentStatus(agentId: string, status: Partial<AgentStatus>): void {
    const agent = this.agentsStore.get(agentId);
    if (agent) {
      this.agentsStore.set(agentId, { ...agent, status: { ...agent.status, ...status } });
      this.updatedAt = new Date();
    }
  }

  updateAgentHealth(agentId: string, health: Partial<AgentHealth>): void {
    const agent = this.agentsStore.get(agentId);
    if (agent) {
      this.agentsStore.set(agentId, { ...agent, health: { ...agent.health, ...health } });
      this.updatedAt = new Date();
    }
  }

  listAgents(): { metadata: AgentMetadata; status: AgentStatus; health: AgentHealth }[] {
    return Array.from(this.agentsStore.values());
  }

  addNotification(notification: NotificationState): void {
    this.notificationsStore.set(notification.id, notification);
    this.updatedAt = new Date();
  }

  getNotification(notificationId: string): NotificationState | undefined {
    return this.notificationsStore.get(notificationId);
  }

  markNotificationRead(notificationId: string): void {
    const notification = this.notificationsStore.get(notificationId);
    if (notification) {
      this.notificationsStore.set(notificationId, { ...notification, read: true });
      this.updatedAt = new Date();
    }
  }

  listNotifications(unreadOnly?: boolean): NotificationState[] {
    const notifications = Array.from(this.notificationsStore.values());
    if (unreadOnly) {
      return notifications.filter((n) => !n.read);
    }
    return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  clearNotifications(): void {
    this.notificationsStore.clear();
    this.updatedAt = new Date();
  }

  setVoiceState(state: VoiceState): void {
    this.voiceStore.set(state.sessionId, state);
    this.updatedAt = new Date();
  }

  getVoiceState(sessionId: string): VoiceState | undefined {
    return this.voiceStore.get(sessionId);
  }

  updateVoiceState(sessionId: string, updates: Partial<VoiceState>): void {
    const state = this.voiceStore.get(sessionId);
    if (state) {
      this.voiceStore.set(sessionId, { ...state, ...updates, updatedAt: new Date() });
      this.updatedAt = new Date();
    }
  }

  listVoiceStates(): VoiceState[] {
    return Array.from(this.voiceStore.values());
  }

  setCharacterState(state: CharacterState): void {
    this.charactersStore.set(state.characterId, state);
    this.updatedAt = new Date();
  }

  getCharacterState(characterId: string): CharacterState | undefined {
    return this.charactersStore.get(characterId);
  }

  updateCharacterEmotion(characterId: string, emotion: string, triggerEvent?: string): void {
    const state = this.charactersStore.get(characterId);
    if (state) {
      this.charactersStore.set(characterId, {
        ...state,
        emotion,
        lastUpdate: new Date(),
      });
      this.updatedAt = new Date();
    }
  }

  listCharacterStates(): CharacterState[] {
    return Array.from(this.charactersStore.values());
  }

  setResearchJob(job: ResearchJobState): void {
    this.researchJobsStore.set(job.jobId, job);
    this.updatedAt = new Date();
  }

  getResearchJob(jobId: string): ResearchJobState | undefined {
    return this.researchJobsStore.get(jobId);
  }

  updateResearchJob(jobId: string, updates: Partial<ResearchJobState>): void {
    const job = this.researchJobsStore.get(jobId);
    if (job) {
      this.researchJobsStore.set(jobId, { ...job, ...updates });
      this.updatedAt = new Date();
    }
  }

  listResearchJobs(status?: string): ResearchJobState[] {
    const jobs = Array.from(this.researchJobsStore.values());
    if (status) {
      return jobs.filter((j) => j.status === status);
    }
    return jobs;
  }

  setRevenueJob(job: RevenueJobState): void {
    this.revenueJobsStore.set(job.jobId, job);
    this.updatedAt = new Date();
  }

  getRevenueJob(jobId: string): RevenueJobState | undefined {
    return this.revenueJobsStore.get(jobId);
  }

  updateRevenueJob(jobId: string, updates: Partial<RevenueJobState>): void {
    const job = this.revenueJobsStore.get(jobId);
    if (job) {
      this.revenueJobsStore.set(jobId, { ...job, ...updates });
      this.updatedAt = new Date();
    }
  }

  listRevenueJobs(status?: string): RevenueJobState[] {
    const jobs = Array.from(this.revenueJobsStore.values());
    if (status) {
      return jobs.filter((j) => j.status === status);
    }
    return jobs;
  }

  addEvent(event: RuntimeEvent): void {
    this.eventsStore.push(event);
    if (this.eventsStore.length > 10000) {
      this.eventsStore.shift();
    }
    this.updatedAt = new Date();
  }

  getEvents(eventType?: string, limit?: number): RuntimeEvent[] {
    let events = [...this.eventsStore];
    if (eventType) {
      events = events.filter((e) => e.type === eventType);
    }
    if (limit) {
      events = events.slice(-limit);
    }
    return events;
  }

  clearEvents(): void {
    this.eventsStore = [];
    this.updatedAt = new Date();
  }

  getSnapshot(): RuntimeStateSnapshot {
    return {
      projects: new Map(this.projectsStore),
      tasks: new Map(this.tasksStore),
      workflows: new Map(this.workflowsStore),
      agents: new Map(this.agentsStore),
      notifications: new Map(this.notificationsStore),
      voice: new Map(this.voiceStore),
      characters: new Map(this.charactersStore),
      researchJobs: new Map(this.researchJobsStore),
      revenueJobs: new Map(this.revenueJobsStore),
      events: [...this.eventsStore],
      updatedAt: this.updatedAt,
    };
  }

  clear(): void {
    this.projectsStore.clear();
    this.tasksStore.clear();
    this.workflowsStore.clear();
    this.agentsStore.clear();
    this.notificationsStore.clear();
    this.voiceStore.clear();
    this.charactersStore.clear();
    this.researchJobsStore.clear();
    this.revenueJobsStore.clear();
    this.eventsStore = [];
    this.updatedAt = new Date();
  }
}