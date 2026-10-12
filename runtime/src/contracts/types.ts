// ============================================================
// Message Contracts - Standardized Event Types
// ============================================================
// Strongly typed events for all module communication
// ============================================================

// Kernel event types - minimal definitions for compatibility
export type KernelEventType = string;
export type KernelEventPayload = Record<string, unknown>;
export interface KernelEvent<TPayload extends KernelEventPayload = KernelEventPayload> {
  id: string;
  version: string;
  timestamp: string;
  trace_id: string;
  span_id: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  event_type: KernelEventType;
  payload: TPayload;
}

// ============================================================
// Base Event Types
// ============================================================

export interface BaseEventPayload {
  workflowId: string;
  taskId?: string;
  timestamp: string;
  traceId: string;
  spanId: string;
}

export interface RuntimeEvent<TPayload extends BaseEventPayload = BaseEventPayload> {
  id: string;
  type: string;
  version: string;
  timestamp: string;
  traceId: string;
  spanId: string;
  payload: TPayload;
}

// ============================================================
// Goal & Workflow Events
// ============================================================

export interface GoalReceivedPayload extends BaseEventPayload {
  goalId: string;
  objective: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  projectId?: string;
  userId?: string;
  context?: Record<string, unknown>;
}

export interface WorkflowStartedPayload extends BaseEventPayload {
  workflowId: string;
  workflowType: string;
  goalId: string;
  rootTaskId: string;
}

export interface WorkflowCompletedPayload extends BaseEventPayload {
  workflowId: string;
  goalId: string;
  result: unknown;
  durationMs: number;
}

export interface WorkflowFailedPayload extends BaseEventPayload {
  workflowId: string;
  goalId: string;
  error: string;
  failedTaskId?: string;
  durationMs: number;
}

export interface WorkflowPausedPayload extends BaseEventPayload {
  workflowId: string;
  reason: string;
}

export interface WorkflowResumedPayload extends BaseEventPayload {
  workflowId: string;
}

export interface WorkflowCancelledPayload extends BaseEventPayload {
  workflowId: string;
  reason: string;
}

// ============================================================
// Task Events
// ============================================================

export interface TaskCreatedPayload extends BaseEventPayload {
  taskId: string;
  parentTaskId?: string;
  objective: string;
  requiredCapabilities: string[];
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  dependencies: string[];
}

export interface TaskQueuedPayload extends BaseEventPayload {
  taskId: string;
  position: number;
}

export interface TaskStartedPayload extends BaseEventPayload {
  taskId: string;
  agentId: string;
  objective: string;
}

export interface TaskProgressPayload extends BaseEventPayload {
  taskId: string;
  agentId: string;
  progress: number;
  message?: string;
}

export interface TaskCompletedPayload extends BaseEventPayload {
  taskId: string;
  agentId: string;
  output: unknown;
  durationMs: number;
}

export interface TaskFailedPayload extends BaseEventPayload {
  taskId: string;
  agentId?: string;
  error: string;
  retryCount: number;
  maxRetries: number;
  willRetry: boolean;
}

export interface TaskCancelledPayload extends BaseEventPayload {
  taskId: string;
  reason: string;
}

export interface TaskRetryingPayload extends BaseEventPayload {
  taskId: string;
  agentId?: string;
  retryCount: number;
  error: string;
}

// ============================================================
// Agent Events
// ============================================================

export interface AgentRegisteredPayload extends BaseEventPayload {
  agentId: string;
  name: string;
  capabilities: string[];
  version: string;
}

export interface AgentStatusChangedPayload extends BaseEventPayload {
  agentId: string;
  previousStatus: string;
  currentStatus: string;
  health: 'healthy' | 'degraded' | 'unavailable';
  message?: string;
}

export interface AgentHealthChangedPayload extends BaseEventPayload {
  agentId: string;
  previousHealth: 'healthy' | 'degraded' | 'unavailable';
  currentHealth: 'healthy' | 'degraded' | 'unavailable';
}

export interface AgentSpeakingPayload extends BaseEventPayload {
  agentId: string;
  message: string;
  durationMs?: number;
}

export interface AgentThinkingPayload extends BaseEventPayload {
  agentId: string;
  thought: string;
}

// ============================================================
// Research Engine Events
// ============================================================

export interface ResearchStartedPayload extends BaseEventPayload {
  researchId: string;
  request: {
    companyName?: string;
    domain?: string;
    websiteUrl?: string;
    industry?: string;
    depth: 'basic' | 'standard' | 'deep';
    includeCompetitors?: boolean;
    includeTechStack?: boolean;
    includeSeo?: boolean;
  };
}

export interface ResearchProgressPayload extends BaseEventPayload {
  researchId: string;
  currentTask: string;
  progress: number;
  completedTasks: string[];
  remainingTasks: string[];
}

export interface ResearchCompletedPayload extends BaseEventPayload {
  researchId: string;
  report: {
    companyProfile?: unknown;
    websiteAnalysis?: unknown;
    competitorAnalysis?: unknown;
    technologyDetection?: unknown;
    seoAnalysis?: unknown;
    overallInsights: string[];
    priorityActions: string[];
  };
  durationMs: number;
}

export interface ResearchFailedPayload extends BaseEventPayload {
  researchId: string;
  error: string;
  failedTask?: string;
}

export interface LeadFoundPayload extends BaseEventPayload {
  leadId: string;
  businessName: string;
  domain: string;
  location: string;
  source: string;
  confidence: number;
}

// ============================================================
// Revenue Engine Events
// ============================================================

export interface LeadScoredPayload extends BaseEventPayload {
  leadId: string;
  score: number;
  tier: 'hot' | 'warm' | 'cold';
  factors: string[];
}

export interface ProposalGeneratedPayload extends BaseEventPayload {
  proposalId: string;
  leadId: string;
  clientName: string;
  sections: string[];
}

export interface WebsiteAuditCompletedPayload extends BaseEventPayload {
  auditId: string;
  leadId: string;
  url: string;
  overallScore: number;
  findingsCount: number;
  opportunitiesCount: number;
}

export interface DealWonPayload extends BaseEventPayload {
  dealId: string;
  leadId: string;
  amount: number;
  currency: string;
}

export interface DealLostPayload extends BaseEventPayload {
  dealId: string;
  leadId: string;
  reason: string;
}

export interface RevenueUpdatedPayload extends BaseEventPayload {
  amount: number;
  change: number;
  period: string;
  source: string;
}

// ============================================================
// Voice System Events
// ============================================================

export interface VoiceStartedPayload extends BaseEventPayload {
  sessionId: string;
  agentId?: string;
}

export interface VoiceStoppedPayload extends BaseEventPayload {
  sessionId: string;
  durationMs: number;
}

export interface VoiceCommandPayload extends BaseEventPayload {
  sessionId: string;
  command: string;
  intent?: string;
  agentId?: string;
}

export interface VoiceResponsePayload extends BaseEventPayload {
  sessionId: string;
  response: string;
  agentId?: string;
  audioDurationMs?: number;
}

export interface VoiceListeningPayload extends BaseEventPayload {
  sessionId: string;
  isListening: boolean;
}

export interface VoiceErrorPayload extends BaseEventPayload {
  sessionId: string;
  error: string;
  code?: string;
}

// ============================================================
// Character System Events
// ============================================================

export interface CharacterEmotionChangedPayload extends BaseEventPayload {
  characterId: string;
  department: string;
  previousEmotion: string;
  currentEmotion: string;
  triggerEvent?: string;
}

export interface CharacterStateChangedPayload extends BaseEventPayload {
  characterId: string;
  department: string;
  pose: string;
  isSpeaking: boolean;
  isListening: boolean;
}

// ============================================================
// Dashboard Events
// ============================================================

export interface DashboardBriefingPayload extends BaseEventPayload {
  briefingId: string;
  type: 'morning' | 'urgent' | 'update' | 'greeting';
  items: Array<{
    id: string;
    text: string;
    agent: string;
    department: string;
    urgent: boolean;
  }>;
}

export interface DashboardNotificationPayload extends BaseEventPayload {
  notificationId: string;
  type: 'lead' | 'proposal' | 'website' | 'design' | 'workflow' | 'approval' | 'alert' | 'message';
  title: string;
  message: string;
  urgent: boolean;
  agentId?: string;
}

export interface DashboardActivityPayload extends BaseEventPayload {
  activityId: string;
  agentId: string;
  agentName: string;
  department: string;
  action: string;
  type: string;
}

// ============================================================
// System Events
// ============================================================

export interface SystemErrorPayload extends BaseEventPayload {
  error: string;
  code?: string;
  severity: 'ERROR' | 'CRITICAL' | 'WARNING';
  component: string;
  recoverable: boolean;
}

export interface SystemWarningPayload extends BaseEventPayload {
  warning: string;
  component: string;
  details?: Record<string, unknown>;
}

export interface CheckpointApprovalPayload extends BaseEventPayload {
  checkpointId: string;
  taskId: string;
  type: 'approval' | 'review';
  data: unknown;
  timeoutMs?: number;
}

export interface CheckpointApprovedPayload extends BaseEventPayload {
  checkpointId: string;
  taskId: string;
  approved: boolean;
  reviewer?: string;
  comment?: string;
}

// ============================================================
// Union Type for All Runtime Events
// ============================================================

export type RuntimeEventPayload =
  | GoalReceivedPayload
  | WorkflowStartedPayload
  | WorkflowCompletedPayload
  | WorkflowFailedPayload
  | WorkflowPausedPayload
  | WorkflowResumedPayload
  | WorkflowCancelledPayload
  | TaskCreatedPayload
  | TaskQueuedPayload
  | TaskStartedPayload
  | TaskProgressPayload
  | TaskCompletedPayload
  | TaskFailedPayload
  | TaskCancelledPayload
  | TaskRetryingPayload
  | AgentRegisteredPayload
  | AgentStatusChangedPayload
  | AgentHealthChangedPayload
  | AgentSpeakingPayload
  | AgentThinkingPayload
  | ResearchStartedPayload
  | ResearchProgressPayload
  | ResearchCompletedPayload
  | ResearchFailedPayload
  | LeadFoundPayload
  | LeadScoredPayload
  | ProposalGeneratedPayload
  | WebsiteAuditCompletedPayload
  | DealWonPayload
  | DealLostPayload
  | RevenueUpdatedPayload
  | VoiceStartedPayload
  | VoiceStoppedPayload
  | VoiceCommandPayload
  | VoiceResponsePayload
  | VoiceListeningPayload
  | VoiceErrorPayload
  | CharacterEmotionChangedPayload
  | CharacterStateChangedPayload
  | DashboardBriefingPayload
  | DashboardNotificationPayload
  | DashboardActivityPayload
  | SystemErrorPayload
  | SystemWarningPayload
  | CheckpointApprovalPayload
  | CheckpointApprovedPayload;

export type RuntimeEventType = RuntimeEvent<RuntimeEventPayload>['type'];

// ============================================================
// Event Type Constants
// ============================================================

export const RuntimeEventTypes = {
  // Goal & Workflow
  GOAL_RECEIVED: 'goal.received',
  WORKFLOW_STARTED: 'workflow.started',
  WORKFLOW_COMPLETED: 'workflow.completed',
  WORKFLOW_FAILED: 'workflow.failed',
  WORKFLOW_PAUSED: 'workflow.paused',
  WORKFLOW_RESUMED: 'workflow.resumed',
  WORKFLOW_CANCELLED: 'workflow.cancelled',

  // Task
  TASK_CREATED: 'task.created',
  TASK_QUEUED: 'task.queued',
  TASK_STARTED: 'task.started',
  TASK_PROGRESS: 'task.progress',
  TASK_COMPLETED: 'task.completed',
  TASK_FAILED: 'task.failed',
  TASK_CANCELLED: 'task.cancelled',
  TASK_RETRYING: 'task.retrying',

  // Agent
  AGENT_REGISTERED: 'agent.registered',
  AGENT_STATUS_CHANGED: 'agent.status_changed',
  AGENT_HEALTH_CHANGED: 'agent.health_changed',
  AGENT_SPEAKING: 'agent.speaking',
  AGENT_THINKING: 'agent.thinking',

  // Research
  RESEARCH_STARTED: 'research.started',
  RESEARCH_PROGRESS: 'research.progress',
  RESEARCH_COMPLETED: 'research.completed',
  RESEARCH_FAILED: 'research.failed',
  LEAD_FOUND: 'lead.found',

  // Revenue
  LEAD_SCORED: 'lead.scored',
  PROPOSAL_GENERATED: 'proposal.generated',
  WEBSITE_AUDIT_COMPLETED: 'website_audit.completed',
  DEAL_WON: 'deal.won',
  DEAL_LOST: 'deal.lost',
  REVENUE_UPDATED: 'revenue.updated',

  // Voice
  VOICE_STARTED: 'voice.started',
  VOICE_STOPPED: 'voice.stopped',
  VOICE_COMMAND: 'voice.command',
  VOICE_RESPONSE: 'voice.response',
  VOICE_LISTENING: 'voice.listening',
  VOICE_ERROR: 'voice.error',

  // Character
  CHARACTER_EMOTION_CHANGED: 'character.emotion_changed',
  CHARACTER_STATE_CHANGED: 'character.state_changed',

  // Dashboard
  DASHBOARD_BRIEFING: 'dashboard.briefing',
  DASHBOARD_NOTIFICATION: 'dashboard.notification',
  DASHBOARD_ACTIVITY: 'dashboard.activity',

  // Missions
  MISSION_CREATED: 'mission.created',
  MISSION_STAGE: 'mission.stage',
  MISSION_TASK: 'mission.task',
  MISSION_COMPLETED: 'mission.completed',
  MISSION_FAILED: 'mission.failed',

  // System
  SYSTEM_ERROR: 'system.error',
  SYSTEM_WARNING: 'system.warning',
  CHECKPOINT_APPROVAL: 'checkpoint.approval',
  CHECKPOINT_APPROVED: 'checkpoint.approved',
} as const;

export function createRuntimeEvent<TPayload extends BaseEventPayload>(
  type: string,
  payload: TPayload,
  traceId: string,
  spanId: string
): RuntimeEvent<TPayload> {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    type,
    version: '1.0',
    timestamp: new Date().toISOString(),
    traceId,
    spanId,
    payload,
  };
}

export function isRuntimeEvent(event: unknown): event is RuntimeEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'id' in event &&
    'type' in event &&
    'version' in event &&
    'timestamp' in event &&
    'traceId' in event &&
    'spanId' in event &&
    'payload' in event
  );
}