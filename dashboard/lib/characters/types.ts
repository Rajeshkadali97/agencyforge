export const CHARACTER_LIBRARY_ROOT = process.env.CHARACTER_LIBRARY_ROOT ?? "character-library";

export const POSES = [
  "idle",
  "standing",
  "sitting",
  "typing",
  "pointing",
  "presenting",
  "walking",
  "running",
  "talking",
  "celebrating",
  "thinking",
  "listening",
  "explaining",
  "waving",
  "reading",
  "writing",
  "using laptop",
  "using tablet",
  "using phone",
  "looking left",
  "looking right",
  "looking up",
  "looking down",
  "crossed arms",
  "hands on hips",
  "holding coffee",
  "holding document",
  "holding laptop",
] as const;

export const EXPRESSIONS = [
  "happy",
  "smile",
  "laugh",
  "neutral",
  "thinking",
  "surprised",
  "confused",
  "worried",
  "sad",
  "angry",
  "excited",
  "confident",
  "proud",
  "sleepy",
  "celebrating",
  "focused",
  "talking",
  "listening",
] as const;

export const ANIMATIONS = [
  "breathing",
  "blinking",
  "headMovement",
  "eyeMovement",
  "shoulderMovement",
  "handGestures",
  "idleSway",
  "microphoneTalking",
  "celebration",
  "nodding",
  "shakingHead",
  "pointing",
] as const;

export type CharacterPose = (typeof POSES)[number];
export type CharacterExpression = (typeof EXPRESSIONS)[number];
export type CharacterAnimation = (typeof ANIMATIONS)[number];

export type CharacterStatus =
  | "idle"
  | "available"
  | "busy"
  | "speaking"
  | "monitoring"
  | "processing"
  | "warning"
  | "error"
  | "offline";

export type CharacterRuntimeState =
  | "Idle"
  | "Thinking"
  | "Listening"
  | "Talking"
  | "Typing"
  | "Presenting"
  | "Celebrating"
  | "Happy"
  | "Sad"
  | "Worried"
  | "Busy"
  | "Offline"
  | "Sleeping"
  | "Error";

export type CharacterRendererKind = "png" | "rive" | "spine" | "live2d" | "avatar3d";

export type CharacterDepartment =
  | "leadership"
  | "research"
  | "sales"
  | "marketing"
  | "creative"
  | "content"
  | "motion"
  | "engineering"
  | "seo"
  | "analytics"
  | "automation"
  | "support";

export type CharacterId =
  | "ceo"
  | "research-agent"
  | "sales-agent"
  | "marketing-agent"
  | "creative-director"
  | "content-strategist"
  | "motion-designer"
  | "web-architect"
  | "seo-specialist"
  | "analytics-expert"
  | "developer"
  | "automation-agent";

export type CharacterEmotion =
  | CharacterExpression
  | "proud"
  | "presenting"
  | "brainstorming"
  | "reading"
  | "analyzing"
  | "searching"
  | "sketching"
  | "designing"
  | "reviewing"
  | "coding"
  | "debugging"
  | "deploying"
  | "monitoring"
  | "processing"
  | "warning"
  | "ranking"
  | "concerned"
  | "disappointed"
  | "stressed";

export interface CharacterAssetVariant {
  emotion?: CharacterEmotion;
  expression?: CharacterExpression;
  pose?: CharacterPose;
  animation?: CharacterAnimation;
  image: string;
  renderer?: CharacterRendererKind;
  source: "master-sheet" | "generated-variation" | "placeholder";
}

export interface CharacterAnimationPlan {
  pose: CharacterPose;
  expression: CharacterExpression;
  animations: CharacterAnimation[];
  animationSpeed: number;
  idleMotion: CharacterAnimation[];
  transitionDurationMs: number;
  crossfadeMs: number;
  scaleFrom: number;
  scaleTo: number;
  opacityFrom: number;
  opacityTo: number;
}

export interface CharacterRenderPlan {
  characterId: CharacterId;
  renderer: CharacterRendererKind;
  asset: CharacterAssetVariant;
  state: CharacterRuntimeState;
  pose: CharacterPose;
  expression: CharacterExpression;
  animation: CharacterAnimationPlan;
  cacheKey: string;
  preloadKeys: string[];
}

export interface CharacterProfile {
  id: CharacterId;
  name: string;
  department: CharacterDepartment;
  role: string;
  image: string;
  personality: string;
  defaultEmotion: CharacterEmotion;
  currentEmotion: CharacterEmotion;
  animationState: CharacterAnimation[];
  currentPose: CharacterPose;
  runtimeState: CharacterRuntimeState;
  status: CharacterStatus;
  supportedEmotions: CharacterEmotion[];
  supportedPoses: CharacterPose[];
  supportedExpressions: CharacterExpression[];
  supportedAnimations: CharacterAnimation[];
  assets: CharacterAssetVariant[];
  assetFolder?: string;
  isPlaceholder?: boolean;
}

export interface CharacterSnapshot extends CharacterProfile {
  resolvedAsset: CharacterAssetVariant;
  renderPlan: CharacterRenderPlan;
}

export interface CharacterStatePatch {
  runtimeState?: CharacterRuntimeState;
  emotion?: CharacterEmotion;
  pose?: CharacterPose;
  expression?: CharacterExpression;
  animations?: CharacterAnimation[];
  status?: CharacterStatus;
}

export interface CharacterEvent {
  type: string;
  targetCharacterId?: CharacterId;
  targetDepartment?: CharacterDepartment;
  ownerCharacterId?: CharacterId;
  value?: number;
  previousValue?: number;
  severity?: "info" | "success" | "warning" | "critical";
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface EmotionalRule {
  id: string;
  description: string;
  eventType: string;
  characterId?: CharacterId;
  department?: CharacterDepartment;
  when?: (event: CharacterEvent) => boolean;
  state: CharacterStatePatch;
}

export interface ScreenCharacterRequest {
  screen: string;
  context?: CharacterEvent;
  speakingCharacterId?: CharacterId;
  relevantCharacterId?: CharacterId;
}
