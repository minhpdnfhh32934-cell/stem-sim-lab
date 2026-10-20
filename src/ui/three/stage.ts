/**
 * The stage a 3D view's host puts every scene on: the theme-dependent part of the light rig,
 * the environment's strength and rotation, the exposure and the backdrop (`backdrop.ts`). One
 * path for every 3D view, so a lesson gets the look without code of its own. The backdrop
 * texture belongs to the keeper (rebuilt only when the theme or preset changes).
 */
import * as THREE from 'three';
import { BACKDROP_TOKEN_NAMES, stageBackdrop, type BackdropTokens } from './backdrop';
import { applyStageLook, type LookPreset, type StageTheme } from './lighting';
import { isWebGLRenderer, type RendererLike } from './renderer';

export interface StageTokens {
  theme: StageTheme;
  rimTint: string;
  backdrop: BackdropTokens;
}

/** The theme shown now (`useApplyTheme` sets it before the views rebuild their scenes). */
export function currentTheme(): StageTheme {
  return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
    ? 'dark'
    : 'light';
}

/** Reads the stage's theme tokens (empty strings when the stylesheet is missing, e.g. tests). */
export function readStageTokens(): StageTokens {
  const css = getComputedStyle(document.documentElement);
  const read = (name: string) => css.getPropertyValue(name).trim();
  const backdrop = Object.fromEntries(
    Object.entries(BACKDROP_TOKEN_NAMES).map(([k, name]) => [k, read(name)]),
  ) as unknown as BackdropTokens;
  return { theme: currentTheme(), rimTint: read('--m3d-rim-tint'), backdrop };
}

export class StageKeeper {
  private texture: THREE.DataTexture | null = null;
  private key = '';

  /** The backdrop now (tests). */
  get backdrop(): THREE.DataTexture | null {
    return this.texture;
  }

  /**
   * Puts `scene` on the stage: rim and environment for the theme, the backdrop (unless the scene
   * set a background of its own) and the renderer's exposure. Returns the scene's preset.
   */
  apply(
    scene: THREE.Scene,
    renderer: RendererLike,
    envScale: number,
    tokens: StageTokens = readStageTokens(),
  ): { preset: LookPreset; theme: StageTheme } {
    const { preset, exposure } = applyStageLook(scene, {
      theme: tokens.theme,
      rimTint: tokens.rimTint,
      envScale,
    });
    const key = JSON.stringify([tokens.theme, preset, tokens.backdrop]);
    if (key !== this.key) {
      this.key = key;
      this.texture?.dispose();
      this.texture = stageBackdrop(tokens.backdrop, tokens.theme, preset);
    }
    const own = scene.background;
    if (own === null || (own instanceof THREE.Texture && own.userData.stageBackdrop === true)) {
      if (this.texture) this.texture.userData.stageBackdrop = true;
      scene.background = this.texture;
    }
    if (isWebGLRenderer(renderer)) renderer.toneMappingExposure = exposure;
    return { preset, theme: tokens.theme };
  }

  dispose(): void {
    this.texture?.dispose();
    this.texture = null;
    this.key = '';
  }
}
