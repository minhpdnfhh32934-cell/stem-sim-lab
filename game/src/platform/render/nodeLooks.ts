import type * as THREE from 'three';

/**
 * What a material's own shader code does (its `onBeforeCompile`, which only WebGL reads), said
 * again for Ultra's WebGPU device, which builds it from nodes (gpu/looks.ts, its own chunk; Phase
 * G2-1). The module that patches a material for WebGL names its look here too, with the same
 * values (uniform objects and colours are shared, so a change reaches both).
 */
export type NodeLook =
  /** finishes.ts glassEdge: glass darker or more opaque where the view grazes it. */
  | { readonly kind: 'glass-edge' }
  /** looks.ts liquidLook: the filter's darker edge. */
  | { readonly kind: 'liquid-filter' }
  /** looks.ts liquidLook: the light kept through the liquid, tinted, and its rim. */
  | { readonly kind: 'liquid-rim'; readonly tint: THREE.Color }
  /** outlines.ts: a shell pushed out along its normals, brightened by `glow`. */
  | {
      readonly kind: 'outline-shell';
      readonly width: { value: number };
      readonly glow: { value: number };
    }
  /** body/BodyModel.ts clothMaterial: folds from the vertex colours (WebGPU: a soft rim, G2-5). */
  | { readonly kind: 'body-cloth' }
  /** body/BodyModel.ts skinMaterial: WebGPU only (G2-5): a soft rim, warm shadows. */
  | { readonly kind: 'body-skin' }
  /** body/BodyModel.ts hairMaterial: a cloth's folds; WebGPU (G2-5): a rim, a ring of sheen. */
  | { readonly kind: 'body-hair' }
  /** body/BodyModel.ts outlineMaterial: the back faces pushed out by `width` (m). */
  | { readonly kind: 'body-outline'; readonly width: { value: number } }
  /** city/CityView.ts: a window's glow scaled by its copy's colour. */
  | { readonly kind: 'city-window' }
  /**
   * ExperimentView.ts: a screen's picture, uploaded as plain RGBA8 and decoded from sRGB in the
   * shader (WebGL: three's DECODE_VIDEO_TEXTURE define, which WebGPU does not read).
   */
  | { readonly kind: 'decoded-map'; readonly map: THREE.Texture }
  /** water.ts: the falling column (a ShaderMaterial: drawn by a node material of the same look). */
  | { readonly kind: 'water-column'; readonly color: THREE.Color; readonly time: { value: number } }
  /** water.ts: the rings where it lands. */
  | { readonly kind: 'water-splash'; readonly color: THREE.Color; readonly time: { value: number } }
  /** bench/optical-bench.ts: the arrow's image on the screen (a ShaderMaterial). */
  | {
      readonly kind: 'lens-image';
      readonly m: { value: number };
      readonly blur: { value: number };
      readonly glow: { value: number };
      readonly height: { value: number };
      readonly color: THREE.Color;
      readonly shaft: number;
      readonly head: number;
      readonly headWidth: number;
    }
  /** surfaces.ts: a photographed surface laid in world space (triplanar). */
  | {
      readonly kind: 'surface';
      readonly color: THREE.Texture;
      readonly normal: THREE.Texture;
      readonly roughness: THREE.Texture;
      readonly ao: THREE.Texture | null;
      readonly scale: number;
      readonly detail: number;
      readonly rough: number;
      readonly normalScale: number;
      readonly colorMean: number;
      readonly roughMean: number;
    };

const looks = new WeakMap<THREE.Material, NodeLook>();

export function setNodeLook(material: THREE.Material, look: NodeLook | null): void {
  if (look) looks.set(material, look);
  else looks.delete(material);
}

export function nodeLookOf(material: THREE.Material): NodeLook | null {
  return looks.get(material) ?? null;
}
