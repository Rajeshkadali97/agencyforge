import { INITIAL_CHARACTERS } from "./characterData";
import { CharacterAnimationController } from "./CharacterAnimationController";
import { EMOTION_RULES } from "./EmotionRules";
import { CharacterStateMachine } from "./CharacterStateMachine";
import { SCREEN_CHARACTER_MAP } from "./screenCharacterMap";
import {
  CharacterAssetVariant,
  CharacterEvent,
  CharacterId,
  CharacterProfile,
  CharacterSnapshot,
  CharacterStatePatch,
  EmotionalRule,
  ScreenCharacterRequest,
} from "./types";

const cloneCharacter = (character: CharacterProfile): CharacterProfile => ({
  ...character,
  animationState: [...character.animationState],
  supportedEmotions: [...character.supportedEmotions],
  supportedPoses: [...character.supportedPoses],
  supportedExpressions: [...character.supportedExpressions],
  supportedAnimations: [...character.supportedAnimations],
  assets: character.assets.map((asset) => ({ ...asset })),
});

export class CharacterManager {
  private readonly characters = new Map<CharacterId, CharacterProfile>();
  private emotionalRules: EmotionalRule[] = [...EMOTION_RULES];
  private readonly missingAssetWarnings = new Set<string>();
  private readonly stateMachine = new CharacterStateMachine();
  private readonly animationController = new CharacterAnimationController();

  constructor(characters: CharacterProfile[] = INITIAL_CHARACTERS) {
    characters.forEach((character) => this.register(character));
  }

  register(character: CharacterProfile): CharacterProfile {
    const cloned = cloneCharacter(character);
    this.characters.set(cloned.id, cloned);
    return cloneCharacter(cloned);
  }

  get(id: CharacterId): CharacterSnapshot {
    const character = this.characters.get(id);

    if (!character) {
      throw new Error(`Character "${id}" is not registered.`);
    }

    return this.toSnapshot(character);
  }

  getAll(): CharacterSnapshot[] {
    return [...this.characters.values()].map((character) => this.toSnapshot(character));
  }

  getForScreen(request: ScreenCharacterRequest | string): CharacterSnapshot[] {
    const screenRequest = typeof request === "string" ? { screen: request } : request;
    const normalizedScreen = screenRequest.screen.toLowerCase().trim().replace(/\s+/g, "-");

    if (screenRequest.speakingCharacterId) {
      return [this.get(screenRequest.speakingCharacterId)];
    }

    if (screenRequest.relevantCharacterId) {
      return [this.get(screenRequest.relevantCharacterId)];
    }

    const characterIds = SCREEN_CHARACTER_MAP[normalizedScreen] ?? ["ceo"];
    return characterIds.map((id) => this.get(id));
  }

  updateState(id: CharacterId, patch: CharacterStatePatch): CharacterSnapshot {
    const character = this.characters.get(id);

    if (!character) {
      throw new Error(`Character "${id}" is not registered.`);
    }

    const nextEmotion = patch.emotion ?? character.currentEmotion;
    const nextPose = patch.pose ?? character.currentPose;
    const nextAnimations = patch.animations ?? character.animationState;
    const transitioned = this.stateMachine.transition(character.runtimeState, {
      ...patch,
      emotion: nextEmotion,
      pose: nextPose,
      animations: nextAnimations,
    });

    character.runtimeState = transitioned.runtimeState ?? character.runtimeState;
    character.currentEmotion = transitioned.emotion ?? nextEmotion;
    character.currentPose = transitioned.pose ?? nextPose;
    character.animationState = (transitioned.animations ?? nextAnimations).filter((animation) => character.supportedAnimations.includes(animation));
    character.status = transitioned.status ?? character.status;

    if (character.animationState.length === 0) {
      character.animationState = ["breathing", "blinking"];
    }

    return this.toSnapshot(character);
  }

  reset(id: CharacterId): CharacterSnapshot {
    const character = this.characters.get(id);

    if (!character) {
      throw new Error(`Character "${id}" is not registered.`);
    }

    character.currentEmotion = character.defaultEmotion;
    character.currentPose = "idle";
    character.runtimeState = character.isPlaceholder ? "Offline" : "Idle";
    character.animationState = ["breathing", "blinking", "idleSway"];
    character.status = character.isPlaceholder ? "offline" : "available";

    return this.toSnapshot(character);
  }

  applyEvent(event: CharacterEvent): CharacterSnapshot[] {
    const matchingRules = this.emotionalRules.filter((rule) => this.ruleMatches(rule, event));
    const snapshots: CharacterSnapshot[] = [];

    matchingRules.forEach((rule) => {
      const targetId = event.ownerCharacterId ?? event.targetCharacterId ?? rule.characterId ?? this.findByDepartment(rule.department ?? event.targetDepartment);

      if (!targetId) {
        return;
      }

      const eventState = this.stateMachine.fromEvent(event);
      snapshots.push(this.updateState(targetId, { runtimeState: eventState, ...rule.state }));
    });

    return snapshots;
  }

  addEmotionalRule(rule: EmotionalRule): void {
    this.emotionalRules = [...this.emotionalRules.filter((candidate) => candidate.id !== rule.id), rule];
  }

  listEmotionalRules(): EmotionalRule[] {
    return [...this.emotionalRules];
  }

  registerGeneratedVariation(characterId: CharacterId, asset: Omit<CharacterAssetVariant, "source">): CharacterSnapshot {
    const character = this.characters.get(characterId);

    if (!character) {
      throw new Error(`Character "${characterId}" is not registered.`);
    }

    character.assets = [
      ...character.assets.filter(
        (candidate) =>
          candidate.emotion !== asset.emotion ||
          candidate.expression !== asset.expression ||
          candidate.pose !== asset.pose ||
          candidate.animation !== asset.animation,
      ),
      { ...asset, source: "generated-variation" },
    ];

    return this.toSnapshot(character);
  }

  resolveAsset(characterId: CharacterId): CharacterAssetVariant {
    return this.get(characterId).resolvedAsset;
  }

  private ruleMatches(rule: EmotionalRule, event: CharacterEvent): boolean {
    if (rule.eventType !== event.type) {
      return false;
    }

    if (rule.characterId && event.targetCharacterId && rule.characterId !== event.targetCharacterId) {
      return false;
    }

    if (rule.department && event.targetDepartment && rule.department !== event.targetDepartment) {
      return false;
    }

    return rule.when ? rule.when(event) : true;
  }

  private findByDepartment(department?: CharacterProfile["department"]): CharacterId | undefined {
    if (!department) {
      return undefined;
    }

    return [...this.characters.values()].find((character) => character.department === department)?.id;
  }

  private toSnapshot(character: CharacterProfile): CharacterSnapshot {
    const cloned = cloneCharacter(character);
    const snapshotSeed = {
      ...cloned,
      resolvedAsset: this.findBestAsset(character),
      renderPlan: undefined as never,
    };
    const animation = this.animationController.createPlan(snapshotSeed);
    const resolvedAsset = this.findBestAsset({ ...character, currentPose: animation.pose, currentEmotion: animation.expression });
    const cacheKey = `${resolvedAsset.renderer ?? "png"}:${resolvedAsset.image}`;
    const preloadKeys = this.nextExpectedAssets(character)
      .map((asset) => `${asset.renderer ?? "png"}:${asset.image}`)
      .filter((key) => key !== cacheKey);

    return {
      ...cloned,
      resolvedAsset,
      renderPlan: {
        characterId: character.id,
        renderer: resolvedAsset.renderer ?? "png",
        asset: resolvedAsset,
        state: character.runtimeState,
        pose: animation.pose,
        expression: animation.expression,
        animation,
        cacheKey,
        preloadKeys,
      },
    };
  }

  private findBestAsset(character: CharacterProfile): CharacterAssetVariant {
    const exactAsset =
      character.assets.find(
        (asset) =>
          asset.emotion === character.currentEmotion &&
          asset.pose === character.currentPose &&
          character.animationState.includes(asset.animation ?? "breathing"),
      ) ??
      character.assets.find((asset) => asset.emotion === character.currentEmotion) ??
      character.assets.find((asset) => asset.pose === character.currentPose);

    if (exactAsset) {
      return exactAsset;
    }

    this.logMissingAsset(character);

    return (
      character.assets.find((asset) => asset.pose === "idle" && asset.expression === "neutral") ??
      character.assets[0] ?? {
        image: character.image,
        emotion: character.defaultEmotion,
        pose: "idle",
        renderer: "png",
        source: character.isPlaceholder ? "placeholder" : "master-sheet",
      }
    );
  }

  /**
   * Avatars are rendered as vector art (see components/avatar3d.tsx), so a pose or emotion
   * without a raster asset is expected and not worth a console warning. The key is still
   * recorded so callers that inspect `missingAssetWarnings` keep working.
   */
  private logMissingAsset(character: CharacterProfile): void {
    this.missingAssetWarnings.add(`${character.id}:${character.currentPose}:${character.currentEmotion}`);
  }

  private nextExpectedAssets(character: CharacterProfile): CharacterAssetVariant[] {
    return character.assets.filter(
      (asset) =>
        asset.pose === character.currentPose ||
        asset.pose === "idle" ||
        asset.expression === "neutral" ||
        asset.emotion === character.currentEmotion,
    );
  }
}
