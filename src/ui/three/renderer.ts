/**
 * The WebGL renderer of the 3D views (biology lessons; later the chemistry viewers), behind a
 * small interface: tests pass a fake one (jsdom has no WebGL).
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

export interface RendererOptions {
  antialias: boolean;
  /** Shadow maps (the High tier only: one extra depth pass per shadow-casting light). */
  shadows?: boolean;
}

export type RendererFactory = (opts: RendererOptions) => RendererLike;

/**
 * A real WebGL renderer: transparent (the theme's stage colour shows through), its last frame
 * kept for "Xuất ảnh PNG" (frames are drawn on demand only), low-power GPU preferred.
 * Colour-managed output (sRGB); tone mapping "Neutral" (Khronos PBR Neutral) keeps the theme
 * colours of the parts recognisable under the studio lighting. Local clipping planes are on
 * (a plant cell plate is clipped by the wall). Shadow maps use PCF filtering (three.js r18x
 * dropped the separate "soft" PCF type; the light's `shadow.radius` softens the edge).
 */
export const webglRenderer: RendererFactory = ({ antialias, shadows = false }) => {
  const r = new THREE.WebGLRenderer({
    antialias,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'low-power',
  });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NeutralToneMapping;
  r.toneMappingExposure = 1;
  r.localClippingEnabled = true;
  // Stand-ins for the renderer in tests have no shadow map.
  const shadowMap = (r as Partial<THREE.WebGLRenderer>).shadowMap;
  if (shadowMap) {
    shadowMap.enabled = shadows;
    shadowMap.type = THREE.PCFShadowMap;
  }
  return r;
};

/** True for a real three.js renderer (environment maps need one; fakes in tests are not). */
export function isWebGLRenderer(r: RendererLike): r is RendererLike & THREE.WebGLRenderer {
  return r instanceof THREE.WebGLRenderer;
}
