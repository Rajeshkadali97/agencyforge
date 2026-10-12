import {
  CharacterAnimation,
  CharacterAnimationPlan,
  CharacterExpression,
  CharacterPose,
  CharacterRuntimeState,
  CharacterSnapshot,
  CharacterStatePatch,
} from "./types";

const EXPRESSION_BY_EMOTION: Partial<Record<NonNullable<CharacterStatePatch["emotion"]>, CharacterExpression>> = {
  happy: "happy",
  smile: "smile",
  laugh: "laugh",
  neutral: "neutral",
  thinking: "thinking",
  surprised: "surprised",
  confused: "confused",
  worried: "worried",
  sad: "sad",
  angry: "angry",
  excited: "excited",
  confident: "confident",
  proud: "proud",
  sleepy: "sleepy",
  celebrating: "celebrating",
  focused: "focused",
  stressed: "worried",
  concerned: "worried",
  disappointed: "sad",
  presenting: "confident",
  reading: "focused",
  analyzing: "focused",
  searching: "thinking",
  sketching: "focused",
  designing: "focused",
  reviewing: "thinking",
  coding: "focused",
  debugging: "worried",
  deploying: "confident",
  monitoring: "focused",
  processing: "focused",
  warning: "worried",
  ranking: "confident",
};

const SPEED_BY_STATE: Record<CharacterRuntimeState, number> = {
  Idle: 1,
  Thinking: 0.85,
  Listening: 0.9,
  Talking: 1.2,
  Typing: 1.15,
  Presenting: 1.1,
  Celebrating: 1.35,
  Happy: 1.05,
  Sad: 0.7,
  Worried: 0.9,
  Busy: 1.1,
  Offline: 0,
  Sleeping: 0.45,
  Error: 1.25,
};

export class CharacterAnimationController {
  createPlan(character: CharacterSnapshot): CharacterAnimationPlan {
    const pose = character.currentPose;
    const expression = this.expressionFor(character.currentEmotion);
    const animations = this.animationsFor(character.runtimeState, character.animationState);

    return {
      pose,
      expression,
      animations,
      animationSpeed: SPEED_BY_STATE[character.runtimeState],
      idleMotion: this.idleMotionFor(character.runtimeState),
      transitionDurationMs: 200,
      crossfadeMs: 200,
      scaleFrom: 1,
      scaleTo: 1.02,
      opacityFrom: 0,
      opacityTo: 1,
    };
  }

  private expressionFor(emotion: CharacterSnapshot["currentEmotion"]): CharacterExpression {
    return EXPRESSION_BY_EMOTION[emotion] ?? "neutral";
  }

  private animationsFor(state: CharacterRuntimeState, requested: CharacterAnimation[]): CharacterAnimation[] {
    if (state === "Offline") {
      return [];
    }

    if (state === "Talking") {
      return ["microphoneTalking", "blinking", "headMovement"];
    }

    if (state === "Celebrating") {
      return ["celebration", "handGestures", "blinking"];
    }

    if (state === "Error" || state === "Worried") {
      return ["breathing", "eyeMovement", "headMovement"];
    }

    return requested.length > 0 ? requested : ["breathing", "blinking", "idleSway"];
  }

  private idleMotionFor(state: CharacterRuntimeState): CharacterAnimation[] {
    if (state === "Offline") {
      return [];
    }

    if (state === "Sleeping") {
      return ["breathing"];
    }

    return ["breathing", "blinking", "idleSway"];
  }
}

