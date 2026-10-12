import { CharacterRenderPlan, CharacterRendererKind } from "./types";

export interface CharacterRenderer {
  readonly kind: CharacterRendererKind;
  render(plan: CharacterRenderPlan, mount: HTMLElement): void;
}

export interface CharacterRendererRegistry {
  get(kind: CharacterRendererKind): CharacterRenderer | undefined;
  register(renderer: CharacterRenderer): void;
}

export class DefaultCharacterRendererRegistry implements CharacterRendererRegistry {
  private readonly renderers = new Map<CharacterRendererKind, CharacterRenderer>();

  get(kind: CharacterRendererKind): CharacterRenderer | undefined {
    return this.renderers.get(kind);
  }

  register(renderer: CharacterRenderer): void {
    this.renderers.set(renderer.kind, renderer);
  }
}

