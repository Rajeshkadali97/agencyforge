import {
  CharacterEvent,
  CharacterExpression,
  CharacterPose,
  CharacterRuntimeState,
  CharacterStatePatch,
  CharacterStatus,
} from "./types";

export interface CharacterStateDefinition {
  state: CharacterRuntimeState;
  pose: CharacterPose;
  expression: CharacterExpression;
  status: CharacterStatus;
}

export const CHARACTER_STATE_DEFINITIONS: Record<CharacterRuntimeState, CharacterStateDefinition> = {
  Idle: { state: "Idle", pose: "idle", expression: "neutral", status: "idle" },
  Thinking: { state: "Thinking", pose: "thinking", expression: "thinking", status: "busy" },
  Listening: { state: "Listening", pose: "listening", expression: "listening", status: "available" },
  Talking: { state: "Talking", pose: "talking", expression: "talking", status: "speaking" },
  Typing: { state: "Typing", pose: "typing", expression: "focused", status: "busy" },
  Presenting: { state: "Presenting", pose: "presenting", expression: "confident", status: "speaking" },
  Celebrating: { state: "Celebrating", pose: "celebrating", expression: "celebrating", status: "available" },
  Happy: { state: "Happy", pose: "standing", expression: "happy", status: "available" },
  Sad: { state: "Sad", pose: "thinking", expression: "sad", status: "warning" },
  Worried: { state: "Worried", pose: "thinking", expression: "worried", status: "warning" },
  Busy: { state: "Busy", pose: "typing", expression: "focused", status: "busy" },
  Offline: { state: "Offline", pose: "idle", expression: "sleepy", status: "offline" },
  Sleeping: { state: "Sleeping", pose: "sitting", expression: "sleepy", status: "idle" },
  Error: { state: "Error", pose: "typing", expression: "worried", status: "error" },
};

export class CharacterStateMachine {
  transition(currentState: CharacterRuntimeState, patch: CharacterStatePatch): CharacterStatePatch {
    const nextState = patch.runtimeState ?? this.inferState(patch) ?? currentState;
    const definition = CHARACTER_STATE_DEFINITIONS[nextState];

    return {
      runtimeState: nextState,
      pose: patch.pose ?? definition.pose,
      expression: patch.expression ?? definition.expression,
      emotion: patch.emotion ?? definition.expression,
      animations: patch.animations,
      status: patch.status ?? definition.status,
    };
  }

  fromEvent(event: CharacterEvent): CharacterRuntimeState | undefined {
    if (event.severity === "critical") {
      return "Error";
    }

    switch (event.status) {
      case "idle":
        return "Idle";
      case "busy":
      case "running":
      case "processing":
        return "Busy";
      case "talking":
      case "speaking":
        return "Talking";
      case "listening":
        return "Listening";
      case "offline":
        return "Offline";
      default:
        return undefined;
    }
  }

  private inferState(patch: CharacterStatePatch): CharacterRuntimeState | undefined {
    if (patch.status === "offline") {
      return "Offline";
    }

    if (patch.status === "error") {
      return "Error";
    }

    switch (patch.emotion) {
      case "celebrating":
      case "excited":
        return "Celebrating";
      case "happy":
      case "smile":
      case "confident":
      case "proud":
        return "Happy";
      case "sad":
      case "disappointed":
        return "Sad";
      case "worried":
      case "stressed":
      case "concerned":
      case "warning":
        return "Worried";
      case "thinking":
      case "analyzing":
      case "searching":
      case "reading":
        return "Thinking";
      case "presenting":
        return "Presenting";
      default:
        break;
    }

    switch (patch.pose) {
      case "typing":
      case "writing":
      case "using laptop":
        return "Typing";
      case "presenting":
      case "explaining":
        return "Presenting";
      case "talking":
        return "Talking";
      case "listening":
        return "Listening";
      case "celebrating":
        return "Celebrating";
      case "idle":
        return "Idle";
      default:
        return undefined;
    }
  }
}

