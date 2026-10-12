// =============================================================================
// AgencyForge Event Architecture
// =============================================================================
// Defines all event types, interfaces, and subscriptions for real-time
// communication between the AgencyForge Kernel and the Dashboard UI.
// =============================================================================

import type { DepartmentId, CharacterEmotion } from "@/components/characters/core/types";
export type { DepartmentId } from "@/components/characters/core/types";

// =============================================================================
// CORE EVENT TYPES
// =============================================================================

export type EventType =
  // Research Events
  | "lead:found"
  | "research:completed"
  | "research:progress"
  // Sales Events
  | "proposal:generated"
  | "proposal:opened"
  | "proposal:signed"
  | "deal:won"
  | "deal:lost"
  // Website Events
  | "website:completed"
  | "website:deployed"
  | "website:approval_requested"
  // Creative Events
  | "design:completed"
  | "assets:uploaded"
  | "brand:refreshed"
  // Automation Events
  | "workflow:started"
  | "workflow:completed"
  | "workflow:failed"
  | "invoice:delivered"
  // Agent Status Events
  | "agent:busy"
  | "agent:idle"
  | "agent:thinking"
  | "agent:speaking"
  | "agent:error"
  | "agent:offline"
  | "agent:online"
  // Voice Events
  | "voice:started"
  | "voice:stopped"
  | "voice:command"
  | "voice:response"
  // CEO Events
  | "briefing:morning"
  | "briefing:urgent"
  | "alert:critical"
  | "approval:required"
  // Revenue Events
  | "revenue:updated"
  | "lead:qualified"
  | "opportunity:created";

// =============================================================================
// AGENT STATE
// =============================================================================

export interface AgentState {
  id: string;
  department: DepartmentId;
  name: string;
  title: string;
  status: AgentStatus;
  emotion: CharacterEmotion;
  message: string;
  progress?: number;
  lastUpdate: Date;
  notifications: AgentNotification[];
  activeTask?: string;
  health?: "healthy" | "warning" | "critical" | "unknown";
  voiceState?: "idle" | "listening" | "speaking" | "processing";
  priority?: "low" | "normal" | "high" | "urgent";
  workspacePreview?: string;
  tasks?: Array<{
    id: string;
    title: string;
    completed: boolean;
    dueDate?: string;
  }>;
  recentActivity?: Array<{
    id: string;
    description: string;
    timestamp: Date;
  }>;
}

export type AgentStatus =
  | "online"
  | "offline"
  | "busy"
  | "idle"
  | "thinking"
  | "speaking"
  | "error"
  | "loading";

// =============================================================================
// AGENT NOTIFICATION
// =============================================================================

export interface AgentNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  urgent: boolean;
  agentId?: string;
}

export type NotificationType =
  | "lead"
  | "proposal"
  | "website"
  | "design"
  | "workflow"
  | "approval"
  | "alert"
  | "message";

// =============================================================================
// CEO BRIEFING
// =============================================================================

export interface CEOBriefingItem {
  id: string;
  text: string;
  agent: string;
  department: DepartmentId;
  urgent: boolean;
  timestamp: Date;
}

export interface CEOMessage {
  id: string;
  text: string;
  timestamp: Date;
  type: "briefing" | "alert" | "update" | "greeting";
}

// =============================================================================
// VOICE INTERFACE
// =============================================================================

export interface VoiceMessage {
  id: string;
  role: "user" | "agent";
  agentId?: string;
  agentName?: string;
  text: string;
  timestamp: Date;
  status?: "sending" | "sent" | "error";
}

export interface VoiceCommand {
  id: string;
  text: string;
  timestamp: Date;
  response?: VoiceMessage;
}

// =============================================================================
// TEAM ACTIVITY
// =============================================================================

export interface TeamActivity {
  id: string;
  agentId: string;
  agentName: string;
  department: DepartmentId;
  action: string;
  timestamp: Date;
  type: ActivityType;
}

export type ActivityType =
  | "lead_found"
  | "proposal_generated"
  | "website_completed"
  | "workflow_started"
  | "workflow_finished"
  | "design_uploaded"
  | "approval_needed"
  | "revenue_update";

// =============================================================================
// DASHBOARD STATE
// =============================================================================

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

export interface DashboardState {
  ceo: CEOState;
  agents: Map<string, AgentState>;
  briefings: CEOBriefingItem[];
  activities: TeamActivity[];
  voiceMessages: VoiceMessage[];
  isConnected: boolean;
  lastSync: Date;
  kernelStatus?: KernelStatus;
  systemHealth?: {
    uptimeMs: number;
    subsystemHealth: Record<string, { status: string; lastCheck: string }>;
    memory?: { rss: number; heapUsed: number; heapTotal: number };
  };
}

export interface CEOState {
  emotion: CharacterEmotion;
  message: string;
  briefings: CEOBriefingItem[];
  isListening: boolean;
}

// =============================================================================
// EVENT PAYLOADS
// =============================================================================

export interface EventPayload {
  type: EventType;
  timestamp: Date;
  source: string;
  data: Record<string, unknown>;
}

export interface LeadFoundPayload extends EventPayload {
  type: "lead:found";
  data: {
    leadId: string;
    businessName: string;
    location: string;
    source: string;
    agentId: string;
  };
}

export interface ProposalGeneratedPayload extends EventPayload {
  type: "proposal:generated";
  data: {
    proposalId: string;
    clientName: string;
    agentId: string;
  };
}

export interface WorkflowCompletedPayload extends EventPayload {
  type: "workflow:completed";
  data: {
    workflowId: string;
    workflowName: string;
    agentId: string;
  };
}

export interface AgentStatusPayload extends EventPayload {
  type: "agent:busy" | "agent:idle" | "agent:thinking" | "agent:speaking" | "agent:error" | "agent:offline" | "agent:online";
  data: {
    agentId: string;
    previousStatus?: AgentStatus;
    currentStatus: AgentStatus;
    emotion: CharacterEmotion;
    message?: string;
  };
}

export interface VoiceCommandPayload extends EventPayload {
  type: "voice:command";
  data: {
    command: string;
    agentId?: string;
  };
}

export interface RevenueUpdatePayload extends EventPayload {
  type: "revenue:updated";
  data: {
    amount: number;
    change: number;
    period: string;
    agentId: string;
  };
}

// =============================================================================
// EVENT SUBSCRIPTION
// =============================================================================

export type EventCallback<T extends EventPayload = EventPayload> = (event: T) => void;

export interface EventSubscription {
  id: string;
  eventType: EventType | EventType[];
  callback: EventCallback;
  unsubscribed: boolean;
}

export interface DashboardEvents {
  // Subscribe to events
  on: <T extends EventPayload>(
    eventType: EventType | EventType[],
    callback: EventCallback<T>
  ) => () => void;

  // Unsubscribe from events
  off: (subscriptionId: string) => void;

  // Emit events
  emit: <T extends EventPayload>(event: T) => void;

  // Get current state
  getState: () => DashboardState;

  // Update agent state
  updateAgent: (agentId: string, updates: Partial<AgentState>) => void;

  // Add briefing item
  addBriefing: (item: CEOBriefingItem) => void;

  // Add activity
  addActivity: (activity: TeamActivity) => void;

  // Add voice message
  addVoiceMessage: (message: VoiceMessage) => void;

  // Clear voice messages
  clearVoiceMessages: () => void;
}

// =============================================================================
// KERNEL COMMUNICATION
// =============================================================================

export interface KernelMessage {
  id: string;
  type: "command" | "query" | "event" | "response";
  action: string;
  payload?: Record<string, unknown>;
  timestamp: Date;
  source: "kernel" | "dashboard" | "agent";
  target?: string;
}

export interface KernelConnection {
  connect: () => Promise<void>;
  disconnect: () => void;
  send: (message: KernelMessage) => Promise<KernelMessage>;
  onMessage: (callback: (message: KernelMessage) => void) => () => void;
  isConnected: () => boolean;
}

// =============================================================================
// CHARACTER EMOTION MAP
// =============================================================================

export const emotionFromEvent: Record<EventType, CharacterEmotion> = {
  "lead:found": "excited",
  "research:completed": "happy",
  "research:progress": "thinking",
  "proposal:generated": "happy",
  "proposal:opened": "thinking",
  "proposal:signed": "celebrating",
  "deal:won": "celebrating",
  "deal:lost": "concerned",
  "website:completed": "happy",
  "website:deployed": "excited",
  "website:approval_requested": "listening",
  "design:completed": "happy",
  "assets:uploaded": "happy",
  "brand:refreshed": "excited",
  "workflow:started": "working",
  "workflow:completed": "happy",
  "workflow:failed": "error",
  "invoice:delivered": "happy",
  "agent:busy": "working",
  "agent:idle": "idle",
  "agent:thinking": "thinking",
  "agent:speaking": "speaking",
  "agent:error": "error",
  "agent:offline": "offline",
  "agent:online": "happy",
  "voice:started": "listening",
  "voice:stopped": "idle",
  "voice:command": "thinking",
  "voice:response": "speaking",
  "briefing:morning": "idle",
  "briefing:urgent": "concerned",
  "alert:critical": "error",
  "approval:required": "listening",
  "revenue:updated": "happy",
  "lead:qualified": "excited",
  "opportunity:created": "happy",
};