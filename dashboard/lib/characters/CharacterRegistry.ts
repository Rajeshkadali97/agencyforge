import { INITIAL_CHARACTERS } from "./characterData";
import { CharacterManager } from "./CharacterManager";
import {
  CharacterAssetVariant,
  CharacterRuntimeState,
  CharacterRenderPlan,
  CharacterRendererKind,
  CharacterEvent,
  CharacterId,
  CharacterProfile,
  CharacterSnapshot,
  CharacterStatePatch,
  EmotionalRule,
  ScreenCharacterRequest,
} from "./types";

class CharacterRegistryApi {
  private manager = new CharacterManager(INITIAL_CHARACTERS);

  get(id: CharacterId): CharacterSnapshot {
    return this.manager.get(id);
  }

  all(): CharacterSnapshot[] {
    return this.manager.getAll();
  }

  forScreen(request: ScreenCharacterRequest | string): CharacterSnapshot[] {
    return this.manager.getForScreen(request);
  }

  register(character: CharacterProfile): CharacterSnapshot {
    this.manager.register(character);
    return this.manager.get(character.id);
  }

  update(id: CharacterId, patch: CharacterStatePatch): CharacterSnapshot {
    return this.manager.updateState(id, patch);
  }

  reset(id: CharacterId): CharacterSnapshot {
    return this.manager.reset(id);
  }

  react(event: CharacterEvent): CharacterSnapshot[] {
    return this.manager.applyEvent(event);
  }

  addEmotionalRule(rule: EmotionalRule): void {
    this.manager.addEmotionalRule(rule);
  }

  listEmotionalRules(): EmotionalRule[] {
    return this.manager.listEmotionalRules();
  }

  registerGeneratedVariation(characterId: CharacterId, asset: Omit<CharacterAssetVariant, "source">): CharacterSnapshot {
    return this.manager.registerGeneratedVariation(characterId, asset);
  }

  resolveAsset(id: CharacterId): CharacterAssetVariant {
    return this.manager.resolveAsset(id);
  }

  replaceManager(manager: CharacterManager): void {
    this.manager = manager;
  }
}

export const CharacterRegistry = new CharacterRegistryApi();

export type {
  CharacterAnimation,
  CharacterAnimationPlan,
  CharacterAssetVariant,
  CharacterDepartment,
  CharacterEmotion,
  CharacterEvent,
  CharacterExpression,
  CharacterId,
  CharacterPose,
  CharacterProfile,
  CharacterRenderPlan,
  CharacterRendererKind,
  CharacterRuntimeState,
  CharacterSnapshot,
  CharacterStatePatch,
  CharacterStatus,
  EmotionalRule,
  ScreenCharacterRequest,
} from "./types";

export { ANIMATIONS, CHARACTER_LIBRARY_ROOT, EXPRESSIONS, POSES } from "./types";
export { CharacterAnimationController } from "./CharacterAnimationController";
export { CharacterAssetLoader } from "./CharacterAssetLoader";
export { CharacterManager };
export type { CharacterRenderer, CharacterRendererRegistry } from "./CharacterRenderer";
export { DefaultCharacterRendererRegistry } from "./CharacterRenderer";
export { CHARACTER_STATE_DEFINITIONS, CharacterStateMachine } from "./CharacterStateMachine";
export { EMOTION_RULES } from "./EmotionRules";
