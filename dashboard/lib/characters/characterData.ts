import { CHARACTER_ASSET_MANIFEST } from "../../assets/characters/manifest";
import {
  ANIMATIONS,
  CharacterAssetVariant,
  CharacterEmotion,
  CharacterId,
  CharacterProfile,
  EXPRESSIONS,
  POSES,
} from "./types";

const assetById = new Map(CHARACTER_ASSET_MANIFEST.map((asset) => [asset.id, asset]));
const placeholderImage = (id: CharacterId) => `placeholder://characters/${id}`;
const fallbackAssetImage = (id: CharacterId) => assetById.get(id)?.fallback.path ?? placeholderImage(id);

const assetVariantsFor = (id: CharacterId, defaultEmotion: CharacterEmotion, isPlaceholder?: boolean): CharacterAssetVariant[] => {
  const metadata = assetById.get(id);

  if (!metadata?.fallback.path) {
    return [
      {
        emotion: defaultEmotion,
        expression: "neutral",
        pose: "idle",
        animation: "breathing",
        image: placeholderImage(id),
        renderer: "png",
        source: "placeholder",
      },
    ];
  }

  return Object.entries(metadata.imagePaths).flatMap(([pose, expressions]) =>
    Object.entries(expressions).map(([expression, image]) => ({
      emotion: expression as CharacterEmotion,
      expression,
      pose,
      animation: "breathing",
      image,
      renderer: "png",
      source: isPlaceholder ? "placeholder" : "generated-variation",
    })),
  ) as CharacterAssetVariant[];
};

const baseEmotions: CharacterEmotion[] = [
  "happy",
  "smile",
  "neutral",
  "thinking",
  "surprised",
  "worried",
  "sad",
  "excited",
  "confident",
  "celebrating",
];

const buildCharacter = (
  profile: Omit<
    CharacterProfile,
    | "currentEmotion"
    | "animationState"
    | "currentPose"
    | "runtimeState"
    | "status"
    | "supportedPoses"
    | "supportedExpressions"
    | "supportedAnimations"
    | "assets"
  >,
): CharacterProfile => ({
  ...profile,
  currentEmotion: profile.defaultEmotion,
  animationState: ["breathing", "blinking", "idleSway"],
  currentPose: "idle",
  runtimeState: profile.isPlaceholder ? "Offline" : "Idle",
  status: profile.isPlaceholder ? "offline" : "available",
  supportedPoses: [...POSES],
  supportedExpressions: [...EXPRESSIONS],
  supportedAnimations: [...ANIMATIONS],
  assetFolder: assetById.get(profile.id)?.assetFolder,
  assets: assetVariantsFor(profile.id, profile.defaultEmotion, profile.isPlaceholder),
});

export const INITIAL_CHARACTERS: CharacterProfile[] = [
  buildCharacter({
    id: "ceo",
    name: "CEO",
    department: "leadership",
    role: "Executive command and strategic oversight",
    image: fallbackAssetImage("ceo"),
    personality: "Calm, decisive, optimistic, and focused on business momentum.",
    defaultEmotion: "neutral",
    supportedEmotions: ["happy", "excited", "proud", "thinking", "neutral", "celebrating", "surprised"],
  }),
  buildCharacter({
    id: "research-agent",
    name: "Research Agent",
    department: "research",
    role: "Market intelligence, discovery, and investigation",
    image: fallbackAssetImage("research-agent"),
    personality: "Curious, analytical, patient, and detail-oriented.",
    defaultEmotion: "thinking",
    supportedEmotions: ["reading", "analyzing", "searching", "thinking", "neutral", "happy"],
  }),
  buildCharacter({
    id: "sales-agent",
    name: "Sales Agent",
    department: "sales",
    role: "Pipeline management, outreach, and client conversion",
    image: fallbackAssetImage("sales-agent"),
    personality: "Confident, persuasive, upbeat, and attentive to risk.",
    defaultEmotion: "confident",
    supportedEmotions: ["happy", "confident", "worried", "stressed", "sad", "celebrating", "presenting"],
  }),
  buildCharacter({
    id: "marketing-agent",
    name: "Marketing Agent",
    department: "marketing",
    role: "Campaign strategy, audience growth, and launch messaging",
    image: fallbackAssetImage("marketing-agent"),
    personality: "Energetic, creative, strategic, and audience-aware.",
    defaultEmotion: "happy",
    supportedEmotions: ["brainstorming", "presenting", "happy", "thinking", "celebrating", "disappointed"],
  }),
  buildCharacter({
    id: "creative-director",
    name: "Creative Director",
    department: "creative",
    role: "Brand direction, art review, and creative quality",
    image: fallbackAssetImage("creative-director"),
    personality: "Expressive, precise, tasteful, and visually ambitious.",
    defaultEmotion: "designing",
    supportedEmotions: ["sketching", "designing", "reviewing", "thinking", "happy", "celebrating"],
  }),
  buildCharacter({
    id: "content-strategist",
    name: "Content Strategist",
    department: "content",
    role: "Narrative systems, content planning, and editorial quality",
    image: fallbackAssetImage("content-strategist"),
    personality: "Clear, structured, brand-aware, and editorially sharp.",
    defaultEmotion: "thinking",
    supportedEmotions: [...baseEmotions, "reviewing", "presenting"],
  }),
  buildCharacter({
    id: "motion-designer",
    name: "Motion Designer",
    department: "motion",
    role: "Motion language, micro-interactions, and visual rhythm",
    image: fallbackAssetImage("motion-designer"),
    personality: "Playful, precise, kinetic, and polished.",
    defaultEmotion: "designing",
    supportedEmotions: [...baseEmotions, "designing", "reviewing"],
  }),
  buildCharacter({
    id: "web-architect",
    name: "Web Architect",
    department: "engineering",
    role: "Website architecture, build planning, and deployment readiness",
    image: fallbackAssetImage("web-architect"),
    personality: "Methodical, pragmatic, calm under pressure, and systems-minded.",
    defaultEmotion: "coding",
    supportedEmotions: ["coding", "debugging", "deploying", "celebrating", "thinking", "stressed"],
  }),
  buildCharacter({
    id: "seo-specialist",
    name: "SEO Specialist",
    department: "seo",
    role: "Search visibility, ranking diagnostics, and content optimization",
    image: fallbackAssetImage("seo-specialist"),
    personality: "Investigative, patient, metrics-driven, and quietly competitive.",
    defaultEmotion: "analyzing",
    supportedEmotions: ["analyzing", "ranking", "celebrating", "thinking", "warning", "happy"],
  }),
  buildCharacter({
    id: "analytics-expert",
    name: "Analytics Expert",
    department: "analytics",
    role: "Reporting, monitoring, and performance interpretation",
    image: fallbackAssetImage("analytics-expert"),
    personality: "Precise, observant, objective, and calmly explanatory.",
    defaultEmotion: "monitoring",
    supportedEmotions: ["presenting", "monitoring", "warning", "analyzing", "thinking", "happy"],
  }),
  buildCharacter({
    id: "developer",
    name: "Developer",
    department: "engineering",
    role: "Implementation, debugging, and release execution",
    image: fallbackAssetImage("developer"),
    personality: "Focused, practical, resilient, and build-oriented.",
    defaultEmotion: "coding",
    supportedEmotions: ["coding", "debugging", "deploying", "celebrating", "stressed", "thinking"],
    isPlaceholder: true,
  }),
  buildCharacter({
    id: "automation-agent",
    name: "Automation Agent",
    department: "automation",
    role: "Workflow monitoring, processing, and operational alerts",
    image: fallbackAssetImage("automation-agent"),
    personality: "Steady, vigilant, procedural, and fast to escalate anomalies.",
    defaultEmotion: "monitoring",
    supportedEmotions: ["monitoring", "processing", "warning", "concerned", "neutral"],
    isPlaceholder: true,
  }),
];
