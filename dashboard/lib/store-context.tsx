// =============================================================================
// AgencyForge Dashboard Store
// =============================================================================
// Centralized state management for the Dashboard UI.
// Manages agent states, briefings, activities, and voice messages.
// =============================================================================

"use client";

import * as React from "react";
import type {
  AgentState,
  AgentStatus,
  CEOBriefingItem,
  TeamActivity,
  VoiceMessage,
  CEOState,
  DashboardState,
  EventType,
  EventCallback,
  EventSubscription,
  EventPayload,
  ActivityType,
  NotificationType,
} from "./events";
import { emotionFromEvent } from "./events";
import type { CharacterEmotion, DepartmentId } from "@/components/characters/core/types";

const INITIAL_DEPARTMENTS: DepartmentId[] = [
  "research",
  "marketing",
  "sales",
  "automation",
  "website",
  "creative",
  "content",
  "motion",
  "seo",
  "analytics",
];

function createInitialAgentState(
  id: string,
  department: DepartmentId,
  name: string,
  title: string,
  initialMessage: string = "Ready to assist."
): AgentState {
  return {
    id,
    department,
    name,
    title,
    status: "idle",
    emotion: "idle",
    message: initialMessage,
    progress: undefined,
    lastUpdate: new Date(),
    notifications: [],
    activeTask: undefined,
    health: "healthy",
    voiceState: "idle",
    priority: "normal",
    workspacePreview: "Workspace preview connected to Kernel...",
    tasks: [],
    recentActivity: [],
  };
}

const initialAgents: Map<string, AgentState> = new Map([
  ["research", createInitialAgentState("research", "research", "Research", "Intelligence Analyst", "Standing by")],
  ["marketing", createInitialAgentState("marketing", "marketing", "Marketing", "Growth Strategist", "Standing by")],
  ["sales", createInitialAgentState("sales", "sales", "Sales", "Revenue Lead", "Standing by")],
  ["automation", createInitialAgentState("automation", "automation", "Automation", "Systems Engineer", "Standing by")],
  ["website", createInitialAgentState("website", "website", "Website", "Digital Architect", "Standing by")],
  ["creative", createInitialAgentState("creative", "creative", "Creative", "Design Director", "Standing by")],
  ["content", createInitialAgentState("content", "content", "Content", "Copywriter", "Standing by")],
  ["motion", createInitialAgentState("motion", "motion", "Motion", "Motion Designer", "Standing by")],
  ["seo", createInitialAgentState("seo", "seo", "SEO", "Search Optimizer", "Standing by")],
  ["analytics", createInitialAgentState("analytics", "analytics", "Analytics", "Data Analyst", "Standing by")],
]);

const initialState: DashboardState = {
  ceo: {
    emotion: "idle",
    message: "Welcome. How can I assist you today?",
    briefings: [],
    isListening: false,
  },
  agents: initialAgents,
  briefings: [],
  activities: [],
  voiceMessages: [],
  isConnected: false,
  lastSync: new Date(),
  kernelStatus: undefined,
  systemHealth: undefined,
};

type Listener = () => void;

class DashboardStore {
  private state: DashboardState;
  private listeners: Set<Listener> = new Set();
  private subscriptions: Map<string, EventSubscription> = new Map();
  private subscriptionIdCounter = 0;

  constructor() {
    this.state = initialState;
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private generateId(): string {
    return crypto.randomUUID().slice(0, 8);
  }

  // Subscribe to state changes
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Get current state
  getState(): DashboardState {
    return this.state;
  }

  // Get specific agent
  getAgent(agentId: string): AgentState | undefined {
    return this.state.agents.get(agentId);
  }

  // Get all agents as array
  getAllAgents(): AgentState[] {
    return Array.from(this.state.agents.values());
  }

  // Get CEO state
  getCEO(): CEOState {
    return this.state.ceo;
  }

  // Update connection status
  setConnected(connected: boolean) {
    this.state = {
      ...this.state,
      isConnected: connected,
      lastSync: new Date(),
    };
    this.notify();
  }

  // Update agent state
  updateAgent(agentId: string, updates: Partial<AgentState>) {
    const currentAgent = this.state.agents.get(agentId);
    if (!currentAgent) return;

    const updatedAgent: AgentState = {
      ...currentAgent,
      ...updates,
      lastUpdate: new Date(),
    };

    this.state = {
      ...this.state,
      agents: new Map(this.state.agents).set(agentId, updatedAgent),
    };
    this.notify();

    // Add activity for status changes
    if (updates.status) {
      this.addActivity({
        id: this.generateId(),
        agentId,
        agentName: currentAgent.name,
        department: currentAgent.department,
        action: this.getStatusAction(updates.status, currentAgent.name),
        timestamp: new Date(),
        type: this.getActivityTypeFromStatus(updates.status),
      });
    }
  }

  private getStatusAction(status: AgentStatus, agentName: string): string {
    const actions: Record<AgentStatus, string> = {
      online: `${agentName} is now online`,
      offline: `${agentName} went offline`,
      busy: `${agentName} started working`,
      idle: `${agentName} is idle`,
      thinking: `${agentName} is thinking`,
      speaking: `${agentName} is speaking`,
      error: `${agentName} encountered an error`,
      loading: `${agentName} is loading`,
    };
    return actions[status];
  }

  private getActivityTypeFromStatus(status: AgentStatus): ActivityType {
    if (status === "busy" || status === "loading") return "workflow_started";
    if (status === "thinking") return "lead_found";
    if (status === "speaking") return "proposal_generated";
    return "lead_found";
  }

  // Update CEO state
  updateCEO(updates: Partial<CEOState>) {
    this.state = {
      ...this.state,
      ceo: {
        ...this.state.ceo,
        ...updates,
      },
    };
    this.notify();
  }

  // Add briefing item
  addBriefing(item: CEOBriefingItem) {
    this.state = {
      ...this.state,
      briefings: [item, ...this.state.briefings].slice(0, 10),
    };
    this.notify();
  }

  // Mark briefing as read
  markBriefingRead(briefingId: string) {
    this.state = {
      ...this.state,
      briefings: this.state.briefings.map((b) =>
        b.id === briefingId ? b : b
      ),
    };
    this.notify();
  }

  // Add activity
  addActivity(activity: TeamActivity) {
    this.state = {
      ...this.state,
      activities: [activity, ...this.state.activities].slice(0, 20),
    };
    this.notify();
  }

  // Add voice message
  addVoiceMessage(message: VoiceMessage) {
    this.state = {
      ...this.state,
      voiceMessages: [...this.state.voiceMessages, message],
    };
    this.notify();
  }

  // Clear voice messages
  clearVoiceMessages() {
    this.state = {
      ...this.state,
      voiceMessages: [],
    };
    this.notify();
  }

  // Remove oldest voice message
  removeOldestVoiceMessage() {
    this.state = {
      ...this.state,
      voiceMessages: this.state.voiceMessages.slice(1),
    };
    this.notify();
  }

  // Event subscription
  on<T extends EventPayload>(
    eventType: EventType | EventType[],
    callback: EventCallback<T>
  ): () => void {
    const id = this.generateId();
    const subscription: EventSubscription = {
      id,
      eventType,
      callback: callback as EventCallback<EventPayload>,
      unsubscribed: false,
    };
    this.subscriptions.set(id, subscription);
    return () => {
      subscription.unsubscribed = true;
      this.subscriptions.delete(id);
    };
  }

  // Emit event to all matching subscriptions
  emit<T extends EventPayload>(
    event: T
  ) {
    this.subscriptions.forEach((sub) => {
      if (sub.unsubscribed) return;

      const types = Array.isArray(sub.eventType) ? sub.eventType : [sub.eventType];
      if (types.includes(event.type)) {
        try {
          sub.callback(event as any);
        } catch (error) {
          console.error(`Error in event handler for ${event.type}:`, error);
        }
      }
    });

    // Auto-update agent emotion based on event
    const emotion = emotionFromEvent[event.type];
    if (emotion) {
      // Find which agent the event came from
      const agentId = event.source.toLowerCase();
      if (this.state.agents.has(agentId)) {
        this.updateAgent(agentId, { emotion });
      }
    }
  }

  // Process incoming Kernel message
  processKernelMessage(message: { type: string; payload?: Record<string, unknown> }) {
    // Handle different message types
    switch (message.type) {
      case "agent_update":
        if (message.payload?.agentId) {
          this.updateAgent(message.payload.agentId as string, {
            status: message.payload.status as AgentStatus,
            emotion: message.payload.emotion as CharacterEmotion,
            message: message.payload.message as string,
            progress: message.payload.progress as number | undefined,
          });
        }
        break;

      case "briefing":
        this.addBriefing({
          id: this.generateId(),
          text: message.payload?.text as string,
          agent: message.payload?.agent as string,
          department: (message.payload?.department as DepartmentId) || "research",
          urgent: (message.payload?.urgent as boolean) || false,
          timestamp: new Date(),
        });
        break;

      case "activity":
        this.addActivity({
          id: this.generateId(),
          agentId: message.payload?.agentId as string,
          agentName: message.payload?.agentName as string,
          department: (message.payload?.department as DepartmentId) || "research",
          action: message.payload?.action as string,
          timestamp: new Date(),
          type: (message.payload?.activityType as ActivityType) || "lead_found",
        });
        break;

      case "voice_response":
        this.addVoiceMessage({
          id: this.generateId(),
          role: "agent",
          agentId: message.payload?.agentId as string,
          agentName: message.payload?.agentName as string,
          text: message.payload?.text as string,
          timestamp: new Date(),
          status: "sent",
        });
        break;

      default:
        break;
    }
  }

  // Process full state snapshot
  processSnapshot(snapshot: any) {
    if (!snapshot) return;

    this.state = {
      ...this.state,
      isConnected: true,
      lastSync: new Date(),
    };

    // Update agents based on context.agentStates
    if (snapshot.context && snapshot.context.agentStates) {
      const agentStates = snapshot.context.agentStates;
      const updatedAgents = new Map(this.state.agents);
      
      Object.entries(agentStates).forEach(([agentId, data]: [string, any]) => {
        const currentAgent = updatedAgents.get(agentId);
        if (currentAgent) {
          updatedAgents.set(agentId, {
            ...currentAgent,
            status: (data.status as any) || currentAgent.status,
            emotion: (data.emotion as any) || currentAgent.emotion,
            message: data.message || currentAgent.message,
            activeTask: data.currentTask || currentAgent.activeTask,
            lastUpdate: new Date(),
          });
        }
      });
      this.state.agents = updatedAgents;
    }

    // Update activities from dashboard.activities
    if (snapshot.dashboard && Array.isArray(snapshot.dashboard.activities)) {
      this.state.activities = snapshot.dashboard.activities.map((act: any) => ({
        id: act.activityId || act.id || this.generateId(),
        agentId: act.agentId || "unknown",
        agentName: act.agentName || "Agent",
        department: act.department || "research",
        action: act.action || "",
        timestamp: new Date(act.timestamp || Date.now()),
        type: act.type || "workflow_started",
      })).slice(0, 20);
    }

    // Update notifications from dashboard.notifications
    if (snapshot.dashboard && Array.isArray(snapshot.dashboard.notifications)) {
      const updatedAgents = new Map(this.state.agents);
      
      // Clear current notifications
      for (const [id, agent] of updatedAgents.entries()) {
        updatedAgents.set(id, { ...agent, notifications: [] });
      }

      snapshot.dashboard.notifications.forEach((notif: any) => {
        const agentId = notif.agentId || "research";
        const agent = updatedAgents.get(agentId);
        if (agent) {
          agent.notifications.push({
            id: notif.notificationId || notif.id || this.generateId(),
            type: notif.type || "alert",
            title: notif.title || "Alert",
            message: notif.message || "",
            timestamp: new Date(notif.timestamp || Date.now()),
            read: notif.read || false,
            urgent: notif.urgent || false,
            agentId: notif.agentId,
          });
        }
      });
      this.state.agents = updatedAgents;
    }

    // Update briefings from dashboard.lastBriefing
    if (snapshot.dashboard && snapshot.dashboard.lastBriefing) {
      const briefing = snapshot.dashboard.lastBriefing;
      if (Array.isArray(briefing.items)) {
        this.state.briefings = briefing.items.map((item: any) => ({
          id: item.id || this.generateId(),
          text: item.text,
          agent: item.agent,
          department: item.department || "research",
          urgent: item.urgent || false,
          timestamp: new Date(briefing.timestamp || Date.now()),
        })).slice(0, 10);
      }
    }

    // Update kernel status
    if (snapshot.kernel) {
      this.state.kernelStatus = snapshot.kernel;
    }

    // Update system health
    if (snapshot.context && snapshot.context.runtimeState) {
      const rt = snapshot.context.runtimeState;
      this.state.systemHealth = {
        uptimeMs: rt.uptimeMs || 0,
        subsystemHealth: rt.subsystemHealth || {},
      };
    }

    this.notify();
  }
}

// Create singleton instance
const dashboardStore = new DashboardStore();

// React Context
const DashboardContext = React.createContext<DashboardStore>(dashboardStore);

// Provider component
function DashboardProvider({ children }: { children: React.ReactNode }) {
  return (
    <DashboardContext.Provider value={dashboardStore}>
      {children}
    </DashboardContext.Provider>
  );
}

// Hook to use dashboard store
function useDashboardStore(): DashboardStore {
  return React.useContext(DashboardContext);
}

// Hook to get current state
function useDashboardState() {
  const store = useDashboardStore();
  const [state, setState] = React.useState<DashboardState>(store.getState());

  React.useEffect(() => {
    return store.subscribe(() => {
      setState(store.getState());
    });
  }, [store]);

  return state;
}

// Hook to get specific agent
function useAgent(agentId: string) {
  const store = useDashboardStore();
  const [agent, setAgent] = React.useState<AgentState | undefined>(store.getAgent(agentId));

  React.useEffect(() => {
    return store.subscribe(() => {
      setAgent(store.getAgent(agentId));
    });
  }, [store, agentId]);

  return agent;
}

// Hook to get all agents
function useAllAgents() {
  const store = useDashboardStore();
  const [agents, setAgents] = React.useState<AgentState[]>(store.getAllAgents());

  React.useEffect(() => {
    return store.subscribe(() => {
      setAgents(store.getAllAgents());
    });
  }, [store]);

  return agents;
}

// Hook to get CEO state
function useCEO() {
  const store = useDashboardStore();
  const [ceo, setCeo] = React.useState<CEOState>(store.getCEO());

  React.useEffect(() => {
    return store.subscribe(() => {
      setCeo(store.getCEO());
    });
  }, [store]);

  return ceo;
}

// Hook to get briefings
function useBriefings() {
  const store = useDashboardStore();
  const [briefings, setBriefings] = React.useState<CEOBriefingItem[]>(store.getState().briefings);

  React.useEffect(() => {
    return store.subscribe(() => {
      setBriefings(store.getState().briefings);
    });
  }, [store]);

  return briefings;
}

// Hook to get activities
function useActivities() {
  const store = useDashboardStore();
  const [activities, setActivities] = React.useState<TeamActivity[]>(store.getState().activities);

  React.useEffect(() => {
    return store.subscribe(() => {
      setActivities(store.getState().activities);
    });
  }, [store]);

  return activities;
}

// Hook to get voice messages
function useVoiceMessages() {
  const store = useDashboardStore();
  const [messages, setMessages] = React.useState<VoiceMessage[]>(store.getState().voiceMessages);

  React.useEffect(() => {
    return store.subscribe(() => {
      setMessages(store.getState().voiceMessages);
    });
  }, [store]);

  return messages;
}

export {
  DashboardStore,
  DashboardProvider,
  useDashboardStore,
  useDashboardState,
  useAgent,
  useAllAgents,
  useCEO,
  useBriefings,
  useActivities,
  useVoiceMessages,
};
export type { AgentState, CEOBriefingItem, TeamActivity, VoiceMessage, CEOState };