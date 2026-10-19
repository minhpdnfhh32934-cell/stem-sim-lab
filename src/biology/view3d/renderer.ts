/**
 * The WebGL renderer of the biology 3D views (mitosis and the other lessons), behind a small
 * interface: tests pass a fake one (jsdom has no WebGL).
 */
import * as THREE from 'three';

/** The part of THREE.WebGLRenderer the views use. */
export interface RendererLike {
  domElement: HTMLCanvasElement;
  localClippingEnabled: boolean;
  setPixelRatio: (ratio: number) => void;
  setSize: (width: number, height: number) => void;
  render: (scene: THREE.Object3D, camera: THREE.Camera) => void;
  dispose: () => void;
  /** Frees the GPU context at once (THREE.WebGLRenderer has it). */
  forceContextLoss?: () => void;
  info: {
    memory: { geometries: number; textures: number };
    programs: unknown[] | null;
    render: { calls: number; triangles: number };
  };
}
export type RendererFactory = (opts: { antialias: boolean }) => RendererLike;

/**
 * A real WebGL renderer: transparent (the theme's stage colour shows through), its last frame
 * kept for "Xuất ảnh PNG" (frames are drawn on demand only), low-power GPU preferred.
 * Tone mapping "Neutral" (Khronos PBR Neutral) keeps the theme colours of the parts recognisable
 * under the studio lighting.
 */
export const webglRenderer: RendererFactory = ({ antialias }) => {
  const r = new THREE.WebGLRenderer({
    antialias,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'low-power',
  });
  r.toneMapping = THREE.NeutralToneMapping;
  r.toneMappingExposure = 1;
  return r;
};

/** True for a real three.js renderer (environment maps need one; fakes in tests are not). */
export function isWebGLRenderer(r: RendererLike): r is RendererLike & THREE.WebGLRenderer {
  return r instanceof THREE.WebGLRenderer;
}
