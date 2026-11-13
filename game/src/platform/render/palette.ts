import * as THREE from 'three';
import type { MATERIALS } from '../../gameplay/item';
import { GLASSWARE, LOOKS } from './looks';

type Look = (typeof MATERIALS)[number];

interface FinishSpec {
  readonly color: string;
  readonly look: Look;
  /** Glows in its own colour × this (a `light` look glows × 1). */
  readonly glow?: number;
  /** See-through looks: instead of the look's own opacity. */
  readonly opacity?: number;
  /** Clear lab glassware: a filter and a sheen pass on High (looks.ts GLASSWARE_LOOK). */
  readonly glassware?: boolean;
}

/**
 * The finishes props are drawn in besides their body (props/*): one shared palette, so the rooms
 * speak one material language. Trim is the station controls' trim (WorldRenderer); inlays are the
 * emblem's colours laid in the floor, without its glow.
 */
export const FINISHES = {
  trim: { color: '#25292e', look: 'plastic' },
  steel: { color: '#b4bcc4', look: 'metal' },
  'frame-dark': { color: '#3a424b', look: 'painted' },
  stone: { color: '#d6dadd', look: 'satin' },
  'worktop-epoxy': { color: '#2b3138', look: 'satin' },
  'worktop-white': { color: '#eef1f3', look: 'satin' },
  wood: { color: '#b08a5a', look: 'matte' },
  glass: { color: '#cfe8f0', look: 'glass', opacity: 0.35, glassware: true },
  'reagent-amber': { color: '#b8742a', look: 'glass', opacity: 0.6 },
  'specimen-fluid': { color: '#d9cf8f', look: 'glass', opacity: 0.5 },
  foliage: { color: '#4f8a4b', look: 'matte' },
  pot: { color: '#b5653a', look: 'matte' },
  'book-a': { color: '#7a3b2e', look: 'matte' },
  'book-b': { color: '#2e5a7a', look: 'matte' },
  'book-c': { color: '#c9a24a', look: 'matte' },
  'glow-cool': { color: '#eaf2fb', look: 'light' },
  'glow-warm': { color: '#ffd9a0', look: 'light' },
  // Phase U: the starship doors' seam and header light
  'glow-cyan': { color: '#8fe6ff', look: 'light' },
  // Phase U-3: the Physics deck's hull panels (their seams are the wall's own dark paint)
  hull: { color: '#eef2f5', look: 'satin' },
  // Phase U-4: the Chemistry module's accents, teal and amber
  amber: { color: '#e39a2d', look: 'satin' },
  'pipe-teal': { color: '#23867c', look: 'satin' },
  'inlay-teal': { color: '#3aa99b', look: 'satin' },
  // Phase U-5: the Biology greenhouse — light wood, moss, and its glazing (bright as the sky)
  'wood-light': { color: '#ead6b4', look: 'matte' },
  moss: { color: '#62a044', look: 'matte' },
  sky: { color: '#dfeaf2', look: 'light' },
  'emblem-cyan': { color: '#4fb3d9', look: 'satin', glow: 0.45 },
  'emblem-pale': { color: '#cdeefa', look: 'light' },
  'emblem-warm': { color: '#ffb454', look: 'light' },
  'emblem-glow': { color: '#ffb454', look: 'glass', opacity: 0.25 },
  'inlay-cyan': { color: '#4fb3d9', look: 'satin' },
  'inlay-pale': { color: '#cdeefa', look: 'satin' },
  'inlay-warm': { color: '#ffb454', look: 'satin' },
  // UX2 lobby: the periodic table's f block
  'tile-f': { color: '#a596d6', look: 'satin' },
  // UX2 preparation: anodised aluminium (sign plates, frames, rails) beside stainless steel; linen
  // (coats, pillow, paper); the nitrile gloves' blue; black rubber (pedal, foot ring).
  aluminium: { color: '#c6ccd2', look: 'satin' },
  linen: { color: '#eceef0', look: 'matte' },
  'glove-blue': { color: '#5b8fd8', look: 'matte' },
  rubber: { color: '#2b2e32', look: 'rubber' },
  // UX3 doors: a leaf's vision panel (tinted safety glass, opaque: the scene behind a closed door
  // is not loaded), the clean areas' silicone seal line, the pictogram's blue, the warning yellow.
  'vision-glass': { color: '#4d6170', look: 'satin' },
  seal: { color: '#8e979f', look: 'rubber' },
  'sign-blue': { color: '#2f6fb3', look: 'satin' },
  'hazard-yellow': { color: '#f2c230', look: 'satin' },
  // UX3 rooms: the toilet seat's white plastic; the mirror's silvered glass (nearly opaque over its
  // light back plate: it reads as a mirror, never as a window); and tile grout.
  'seat-white': { color: '#f7f6f2', look: 'plastic' },
  mirror: { color: '#dfe8ec', look: 'glass', opacity: 0.85 },
  grout: { color: '#b9c1c6', look: 'matte' },
  // Phase G (Ultra's fittings, dress/fittings.ts): the exit sign's lit green, the call point's red.
  'exit-green': { color: '#17a05a', look: 'light' },
  'alarm-red': { color: '#c42a2a', look: 'plastic' },
  // Phase V: the sky in the hub's clerestories and oculus, painted by the time of day (sky.ts).
  'outside-sky': { color: '#eaf2fb', look: 'light' },
  // Phase V-2: the hub's glass floor, faintly green as laminated glass is.
  'floor-glass': { color: '#d6ecea', look: 'glass', opacity: 0.12 },
} as const satisfies Record<string, FinishSpec>;

export type Finish = keyof typeof FINISHES;

/** Lit and see-through surfaces cast no shadow (as entity meshes in WorldRenderer). */
export const castsShadowIn = (look: Look) => look !== 'light' && look !== 'glass';

/**
 * The materials of props: one per finish, and one per colour and look for decor bodies (which,
 * unlike entities, share theirs: nothing glows on focus), each made on first use and shared by
 * every copy. Owned here and freed by `dispose()` (the renderer's lifetime).
 */
export class Palette {
  private readonly finishes = new Map<Finish, THREE.MeshStandardMaterial>();
  private readonly surfaces = new Map<string, THREE.MeshStandardMaterial>();

  finish(finish: Finish): THREE.MeshStandardMaterial {
    let material = this.finishes.get(finish);
    if (!material) {
      const spec: FinishSpec = FINISHES[finish];
      material = make(spec.color, spec.look, spec.glow, spec.opacity, spec.glassware);
      material.userData.finish = finish; // its Ultra surface (surfaces.ts)
      this.finishes.set(finish, material);
    }
    return material;
  }

  /** An item's own colour and look, as its entity mesh has it (`light` glows in its colour). */
  surface(color: string, look: Look): THREE.MeshStandardMaterial {
    const key = `${color}:${look}`;
    let material = this.surfaces.get(key);
    if (!material) {
      material = make(color, look);
      material.userData.look = look; // its Ultra surface (surfaces.ts)
      this.surfaces.set(key, material);
    }
    return material;
  }

  dispose(): void {
    for (const material of this.finishes.values()) material.dispose();
    for (const material of this.surfaces.values()) material.dispose();
    this.finishes.clear();
    this.surfaces.clear();
  }
}

function make(
  color: string,
  look: Look,
  glow = look === 'light' ? 1 : 0,
  opacity?: number,
  glassware = false,
) {
  return new THREE.MeshStandardMaterial({
    color,
    ...LOOKS[look],
    ...(glassware ? { name: GLASSWARE } : {}),
    ...(glow > 0 ? { emissive: color, emissiveIntensity: glow } : {}),
    ...(opacity === undefined ? {} : { opacity }),
    // See-through: no depth write, so what is inside (liquid in glass, the ball in its halo) shows.
    ...(look === 'glass' ? { depthWrite: false } : {}),
  });
}
