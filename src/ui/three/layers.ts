/**
 * Render layers of the 3D views. Every object is drawn by the view's camera (all layers on); the
 * ambient occlusion pass of the High tier (`postfx.ts`) draws only the opaque layer, so
 * see-through shells and glass (LAYER.SHELL) and haze / fake shadows (LAYER.FX) never darken
 * what is behind or inside them. Picking rays test every layer.
 */
import * as THREE from 'three';

export const LAYER = {
  /** Opaque parts (three.js's default layer). */
  OPAQUE: 0,
  /** Every transparent shell, membrane and glass. */
  SHELL: 1,
  /** Haze, contact shadows, glow cards. */
  FX: 2,
} as const;

export type LayerId = (typeof LAYER)[keyof typeof LAYER];

function transparent(m: THREE.Material | THREE.Material[]): boolean {
  return Array.isArray(m) ? m.some((x) => x.transparent) : m.transparent;
}

/**
 * Puts each mesh, line or point cloud on its layer: an explicit `userData.layer` first, else
 * SHELL for a transparent material, else the opaque layer. Cheap (one walk of the scene); run
 * again when materials swap (a part fading in becomes see-through).
 */
export function assignLayers(root: THREE.Object3D): void {
  root.traverse((o) => {
    const material = (o as Partial<THREE.Mesh>).material;
    if (!material) return;
    const explicit = o.userData.layer as LayerId | undefined;
    const layer =
      explicit !== undefined ? explicit : transparent(material) ? LAYER.SHELL : LAYER.OPAQUE;
    if (o.layers.mask !== 1 << layer) o.layers.set(layer);
  });
}

/** A camera (or raycaster) that sees every layer. */
export function seeAllLayers(x: { layers: THREE.Layers }): void {
  x.layers.enableAll();
}
