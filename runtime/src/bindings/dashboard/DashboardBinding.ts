import { ILogger } from '../../interfaces';
import { EnhancedEventBus, EventHandler } from '../../events/EnhancedEventBus';
import { RuntimeEventTypes, DashboardNotificationPayload, DashboardActivityPayload, DashboardBriefingPayload, RuntimeEvent, BaseEventPayload } from '../../contracts';

export interface DashboardBindingConfig {
  maxNotifications?: number;
  maxActivities?: number;
  enableBriefings?: boolean;
}

export interface DashboardState {
  notifications: DashboardNotificationPayload[];
  activities: DashboardActivityPayload[];
  lastBriefing?: DashboardBriefingPayload;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  connectedClients: number;
  lastUpdated: string;
}

export class DashboardBinding {
  private state: DashboardState;
  private subscriptions: string[] = [];
  private listeners: Map<string, (state: DashboardState) => void> = new Map();
  private nextListenerId = 0;

  constructor(
    private eventBus: EnhancedEventBus,
    private logger: ILogger,
    private config: DashboardBindingConfig = {}
  ) {
    this.state = {
      notifications: [],
      activities: [],
      connectionStatus: 'disconnected',
      connectedClients: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  async initialize(): Promise<void> {
    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.DASHBOARD_NOTIFICATION,
        (event: RuntimeEvent<DashboardNotificationPayload>) => {
          this.addNotification(event.payload);
        },
        { label: 'dashboard-binding-notification' }
      )
    );

    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.DASHBOARD_ACTIVITY,
        (event: RuntimeEvent<DashboardActivityPayload>) => {
          this.addActivity(event.payload);
        },
        { label: 'dashboard-binding-activity' }
      )
    );

    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.DASHBOARD_BRIEFING,
        (event: RuntimeEvent<DashboardBriefingPayload>) => {
          this.state.lastBriefing = event.payload;
          this.notifyListeners();
        },
        { label: 'dashboard-binding-briefing' }
      )
    );

    this.subscriptions.push(
      this.eventBus.subscribe(
        [
          RuntimeEventTypes.WORKFLOW_STARTED,
          RuntimeEventTypes.WORKFLOW_COMPLETED,
          RuntimeEventTypes.WORKFLOW_FAILED,
        ],
        () => {
          this.state.lastUpdated = new Date().toISOString();
          this.notifyListeners();
        },
        { label: 'dashboard-binding-workflow' }
      )
    );

    this.state.connectionStatus = 'connected';
    this.state.connectedClients = 1;
    this.logger.info('DashboardBinding: Initialized');
  }

  async shutdown(): Promise<void> {
    for (const subId of this.subscriptions) {
      this.eventBus.unsubscribe(subId);
    }
    this.subscriptions = [];
    this.state.connectionStatus = 'disconnected';
    this.state.connectedClients = 0;
    this.listeners.clear();
    this.logger.info('DashboardBinding: Shutdown');
  }

  getState(): DashboardState {
    return { ...this.state };
  }

  subscribeToState(listener: (state: DashboardState) => void): string {
    const id = `dbl_${++this.nextListenerId}`;
    this.listeners.set(id, listener);
    return id;
  }

  unsubscribeFromState(listenerId: string): boolean {
    return this.listeners.delete(listenerId);
  }

  getNotifications(limit?: number): DashboardNotificationPayload[] {
    const notifications = [...this.state.notifications];
    return limit ? notifications.slice(-limit) : notifications;
  }

  getActivities(limit?: number): DashboardActivityPayload[] {
    const activities = [...this.state.activities];
    return limit ? activities.slice(-limit) : activities;
  }

  clearNotifications(): void {
    this.state.notifications = [];
    this.notifyListeners();
  }

  clearActivities(): void {
    this.state.activities = [];
    this.notifyListeners();
  }

  private addNotification(payload: DashboardNotificationPayload): void {
    const maxNotifications = this.config.maxNotifications ?? 100;
    this.state.notifications.push(payload);
    if (this.state.notifications.length > maxNotifications) {
      this.state.notifications = this.state.notifications.slice(-maxNotifications);
    }
    this.state.lastUpdated = new Date().toISOString();
    this.notifyListeners();
  }

  private addActivity(payload: DashboardActivityPayload): void {
    const maxActivities = this.config.maxActivities ?? 200;
    this.state.activities.push(payload);
    if (this.state.activities.length > maxActivities) {
      this.state.activities = this.state.activities.slice(-maxActivities);
    }
    this.state.lastUpdated = new Date().toISOString();
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const snapshot = this.getState();
    for (const [, listener] of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        this.logger.error('DashboardBinding: Listener error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
