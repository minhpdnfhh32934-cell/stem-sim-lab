/**
 * Render layers of the 3D views. Every object is drawn by the view's camera (all layers on). The
 * post-processing chain of the High tier (`postfx.ts`) splits them: opaque parts and refracting
 * glass go through the HDR half (only the opaque layer casts ambient occlusion), see-through
 * shells (LAYER.SHELL) and haze / fake shadows (LAYER.FX) are blended on screen afterwards like
 * the direct path, so they never darken what is behind or inside them and keep one colour on
 * every GPU. Lights shine on every layer. Picking rays test every layer.
 */
import * as THREE from 'three';

export const LAYER = {
  /** Opaque parts (three.js's default layer). */
  OPAQUE: 0,
  /** Every transparent shell, membrane and glass. */
  SHELL: 1,
  /** Haze, contact shadows, glow cards. */
  FX: 2,
  /** Refracting glass (transmission): drawn with the opaque scene it refracts, no occlusion. */
  GLASS: 3,
} as const;

export type LayerId = (typeof LAYER)[keyof typeof LAYER];

const ALL_LAYERS = 0xffffffff | 0;

function some(m: THREE.Material | THREE.Material[], test: (x: THREE.Material) => boolean) {
  return Array.isArray(m) ? m.some(test) : test(m);
}

const transmissive = (x: THREE.Material) =>
  x instanceof THREE.MeshPhysicalMaterial && x.transmission > 0;

/**
 * Puts each mesh, line or point cloud on its layer: refracting glass on GLASS (it needs the
 * opaque scene behind it), else an explicit `userData.layer`, else SHELL for a transparent
 * material, else the opaque layer. Lights go on every layer (each half of the chain is lit).
 * Cheap (one walk of the scene); run again when materials swap (a part fading in becomes
 * see-through, glass that stops refracting becomes a shell).
 */
export function assignLayers(root: THREE.Object3D): void {
  root.traverse((o) => {
    if ((o as Partial<THREE.Light>).isLight === true) {
      if (o.layers.mask !== ALL_LAYERS) o.layers.enableAll();
      return;
    }
    const material = (o as Partial<THREE.Mesh>).material;
    if (!material) return;
    const explicit = o.userData.layer as LayerId | undefined;
    const layer = some(material, transmissive)
      ? LAYER.GLASS
      : explicit !== undefined
        ? explicit
        : some(material, (x) => x.transparent)
          ? LAYER.SHELL
          : LAYER.OPAQUE;
    if (o.layers.mask !== 1 << layer) o.layers.set(layer);
  });
}

/** A camera (or raycaster) that sees every layer. */
export function seeAllLayers(x: { layers: THREE.Layers }): void {
  x.layers.enableAll();
}
