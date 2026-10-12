import { ILogger } from '../../interfaces';
import { EnhancedEventBus } from '../../events/EnhancedEventBus';
import { RuntimeEventTypes, VoiceStartedPayload, VoiceStoppedPayload, VoiceCommandPayload, VoiceResponsePayload, VoiceListeningPayload, VoiceErrorPayload, RuntimeEvent, BaseEventPayload } from '../../contracts';

export interface VoiceBindingConfig {
  maxSessionHistory?: number;
  defaultTimeoutMs?: number;
}

export interface VoiceSession {
  sessionId: string;
  agentId?: string;
  status: 'active' | 'stopped' | 'error';
  isListening: boolean;
  startedAt: string;
  stoppedAt?: string;
  durationMs?: number;
  commands: Array<{ command: string; timestamp: string; intent?: string }>;
  responses: Array<{ response: string; timestamp: string; audioDurationMs?: number }>;
  errors: Array<{ error: string; code?: string; timestamp: string }>;
}

export class VoiceBinding {
  private sessions: Map<string, VoiceSession> = new Map();
  private subscriptions: string[] = [];
  private listeners: Map<string, (sessions: Map<string, VoiceSession>) => void> = new Map();
  private nextListenerId = 0;
  private maxSessionHistory: number;

  constructor(
    private eventBus: EnhancedEventBus,
    private logger: ILogger,
    config: VoiceBindingConfig = {}
  ) {
    this.maxSessionHistory = config.maxSessionHistory ?? 100;
  }

  async initialize(): Promise<void> {
    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.VOICE_STARTED,
        (event: RuntimeEvent<VoiceStartedPayload>) => {
          this.handleVoiceStarted(event.payload);
        },
        { label: 'voice-binding-started' }
      )
    );

    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.VOICE_STOPPED,
        (event: RuntimeEvent<VoiceStoppedPayload>) => {
          this.handleVoiceStopped(event.payload);
        },
        { label: 'voice-binding-stopped' }
      )
    );

    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.VOICE_COMMAND,
        (event: RuntimeEvent<VoiceCommandPayload>) => {
          this.handleVoiceCommand(event.payload);
        },
        { label: 'voice-binding-command' }
      )
    );

    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.VOICE_RESPONSE,
        (event: RuntimeEvent<VoiceResponsePayload>) => {
          this.handleVoiceResponse(event.payload);
        },
        { label: 'voice-binding-response' }
      )
    );

    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.VOICE_LISTENING,
        (event: RuntimeEvent<VoiceListeningPayload>) => {
          this.handleVoiceListening(event.payload);
        },
        { label: 'voice-binding-listening' }
      )
    );

    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.VOICE_ERROR,
        (event: RuntimeEvent<VoiceErrorPayload>) => {
          this.handleVoiceError(event.payload);
        },
        { label: 'voice-binding-error' }
      )
    );

    this.logger.info('VoiceBinding: Initialized');
  }

  async shutdown(): Promise<void> {
    for (const subId of this.subscriptions) {
      this.eventBus.unsubscribe(subId);
    }
    this.subscriptions = [];
    this.sessions.clear();
    this.listeners.clear();
    this.logger.info('VoiceBinding: Shutdown');
  }

  getSession(sessionId: string): VoiceSession | undefined {
    return this.sessions.get(sessionId);
  }

  getActiveSessions(): VoiceSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'active');
  }

  getAllSessions(): VoiceSession[] {
    return Array.from(this.sessions.values());
  }

  subscribeToState(listener: (sessions: Map<string, VoiceSession>) => void): string {
    const id = `vbl_${++this.nextListenerId}`;
    this.listeners.set(id, listener);
    return id;
  }

  unsubscribeFromState(listenerId: string): boolean {
    return this.listeners.delete(listenerId);
  }

  private handleVoiceStarted(payload: VoiceStartedPayload): void {
    this.sessions.set(payload.sessionId, {
      sessionId: payload.sessionId,
      agentId: payload.agentId,
      status: 'active',
      isListening: false,
      startedAt: payload.timestamp,
      commands: [],
      responses: [],
      errors: [],
    });
    this.trimSessions();
    this.notifyListeners();
  }

  private handleVoiceStopped(payload: VoiceStoppedPayload): void {
    const session = this.sessions.get(payload.sessionId);
    if (session) {
      session.status = 'stopped';
      session.stoppedAt = payload.timestamp;
      session.durationMs = payload.durationMs;
    }
    this.notifyListeners();
  }

  private handleVoiceCommand(payload: VoiceCommandPayload): void {
    const session = this.sessions.get(payload.sessionId);
    if (session) {
      session.commands.push({
        command: payload.command,
        timestamp: payload.timestamp,
        intent: payload.intent,
      });
    }
    this.notifyListeners();
  }

  private handleVoiceResponse(payload: VoiceResponsePayload): void {
    const session = this.sessions.get(payload.sessionId);
    if (session) {
      session.responses.push({
        response: payload.response,
        timestamp: payload.timestamp,
        audioDurationMs: payload.audioDurationMs,
      });
    }
    this.notifyListeners();
  }

  private handleVoiceListening(payload: VoiceListeningPayload): void {
    const session = this.sessions.get(payload.sessionId);
    if (session) {
      session.isListening = payload.isListening;
    }
    this.notifyListeners();
  }

  private handleVoiceError(payload: VoiceErrorPayload): void {
    const session = this.sessions.get(payload.sessionId);
    if (session) {
      session.status = 'error';
      session.errors.push({
        error: payload.error,
        code: payload.code,
        timestamp: payload.timestamp,
      });
    }
    this.notifyListeners();
  }

  private trimSessions(): void {
    if (this.sessions.size <= this.maxSessionHistory) return;
    const entries = Array.from(this.sessions.entries()).sort(
      (a, b) => new Date(a[1].startedAt).getTime() - new Date(b[1].startedAt).getTime()
    );
    while (this.sessions.size > this.maxSessionHistory && entries.length > 0) {
      const [oldestId] = entries.shift()!;
      if (this.sessions.get(oldestId)?.status !== 'active') {
        this.sessions.delete(oldestId);
      }
    }
  }

  private notifyListeners(): void {
    const snapshot = new Map(this.sessions);
    for (const [, listener] of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        this.logger.error('VoiceBinding: Listener error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
