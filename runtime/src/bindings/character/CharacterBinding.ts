import { ILogger } from '../../interfaces';
import { EnhancedEventBus, EventHandler } from '../../events/EnhancedEventBus';
import { RuntimeEventTypes, CharacterEmotionChangedPayload, CharacterStateChangedPayload, RuntimeEvent, BaseEventPayload } from '../../contracts';

export interface CharacterBindingConfig {
  maxStateHistory?: number;
}

export interface CharacterBindingState {
  characterId: string;
  department: string;
  emotion: string;
  previousEmotion?: string;
  pose: string;
  isSpeaking: boolean;
  isListening: boolean;
  lastUpdated: string;
  emotionHistory: Array<{ emotion: string; timestamp: string; trigger?: string }>;
}

export class CharacterBinding {
  private characters: Map<string, CharacterBindingState> = new Map();
  private subscriptions: string[] = [];
  private listeners: Map<string, (characters: Map<string, CharacterBindingState>) => void> = new Map();
  private nextListenerId = 0;
  private maxStateHistory: number;

  constructor(
    private eventBus: EnhancedEventBus,
    private logger: ILogger,
    config: CharacterBindingConfig = {}
  ) {
    this.maxStateHistory = config.maxStateHistory ?? 50;
  }

  async initialize(): Promise<void> {
    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.CHARACTER_EMOTION_CHANGED,
        (event: RuntimeEvent<CharacterEmotionChangedPayload>) => {
          this.handleEmotionChanged(event.payload);
        },
        { label: 'character-binding-emotion' }
      )
    );

    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.CHARACTER_STATE_CHANGED,
        (event: RuntimeEvent<CharacterStateChangedPayload>) => {
          this.handleStateChanged(event.payload);
        },
        { label: 'character-binding-state' }
      )
    );

    this.subscriptions.push(
      this.eventBus.subscribe(
        RuntimeEventTypes.AGENT_SPEAKING,
        (event: RuntimeEvent<BaseEventPayload & { agentId: string; message: string; durationMs?: number }>) => {
          const agentId = event.payload.agentId;
          const char = this.characters.get(agentId);
          if (char) {
            char.isSpeaking = true;
            char.lastUpdated = new Date().toISOString();
            this.notifyListeners();
          }
        },
        { label: 'character-binding-speaking' }
      )
    );

    this.logger.info('CharacterBinding: Initialized');
  }

  async shutdown(): Promise<void> {
    for (const subId of this.subscriptions) {
      this.eventBus.unsubscribe(subId);
    }
    this.subscriptions = [];
    this.characters.clear();
    this.listeners.clear();
    this.logger.info('CharacterBinding: Shutdown');
  }

  getCharacter(characterId: string): CharacterBindingState | undefined {
    return this.characters.get(characterId);
  }

  getAllCharacters(): CharacterBindingState[] {
    return Array.from(this.characters.values());
  }

  getCharactersByDepartment(department: string): CharacterBindingState[] {
    return Array.from(this.characters.values()).filter((c) => c.department === department);
  }

  registerCharacter(characterId: string, department: string, initialEmotion = 'neutral', initialPose = 'idle'): void {
    this.characters.set(characterId, {
      characterId,
      department,
      emotion: initialEmotion,
      pose: initialPose,
      isSpeaking: false,
      isListening: false,
      lastUpdated: new Date().toISOString(),
      emotionHistory: [{ emotion: initialEmotion, timestamp: new Date().toISOString() }],
    });
    this.notifyListeners();
  }

  removeCharacter(characterId: string): boolean {
    const result = this.characters.delete(characterId);
    if (result) {
      this.notifyListeners();
    }
    return result;
  }

  subscribeToState(listener: (characters: Map<string, CharacterBindingState>) => void): string {
    const id = `cbl_${++this.nextListenerId}`;
    this.listeners.set(id, listener);
    return id;
  }

  unsubscribeFromState(listenerId: string): boolean {
    return this.listeners.delete(listenerId);
  }

  private handleEmotionChanged(payload: CharacterEmotionChangedPayload): void {
    let char = this.characters.get(payload.characterId);
    if (!char) {
      char = {
        characterId: payload.characterId,
        department: payload.department,
        emotion: payload.currentEmotion,
        previousEmotion: payload.previousEmotion,
        pose: 'idle',
        isSpeaking: false,
        isListening: false,
        lastUpdated: new Date().toISOString(),
        emotionHistory: [],
      };
      this.characters.set(payload.characterId, char);
    } else {
      char.previousEmotion = payload.previousEmotion;
      char.emotion = payload.currentEmotion;
    }

    char.emotionHistory.push({
      emotion: payload.currentEmotion,
      timestamp: new Date().toISOString(),
      trigger: payload.triggerEvent,
    });

    if (char.emotionHistory.length > this.maxStateHistory) {
      char.emotionHistory = char.emotionHistory.slice(-this.maxStateHistory);
    }

    char.lastUpdated = new Date().toISOString();
    this.notifyListeners();
  }

  private handleStateChanged(payload: CharacterStateChangedPayload): void {
    let char = this.characters.get(payload.characterId);
    if (!char) {
      char = {
        characterId: payload.characterId,
        department: payload.department,
        emotion: 'neutral',
        pose: payload.pose,
        isSpeaking: payload.isSpeaking,
        isListening: payload.isListening,
        lastUpdated: new Date().toISOString(),
        emotionHistory: [{ emotion: 'neutral', timestamp: new Date().toISOString() }],
      };
      this.characters.set(payload.characterId, char);
    } else {
      char.pose = payload.pose;
      char.isSpeaking = payload.isSpeaking;
      char.isListening = payload.isListening;
    }

    char.lastUpdated = new Date().toISOString();
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const snapshot = new Map(this.characters);
    for (const [, listener] of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        this.logger.error('CharacterBinding: Listener error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
