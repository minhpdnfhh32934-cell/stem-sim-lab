/**
 * Post-processing of the High tier on a discrete GPU (loaded on demand: Medium never downloads
 * it). One chain for every 3D view, in two halves so the picture keeps the colours of the
 * direct path (Medium, and High on other GPUs):
 *
 *   HDR half (HalfFloat target, 4× MSAA, depth texture): the opaque and refracting layers →
 *   GTAO (half resolution, opaque layer only) → bloom (HDR threshold 1.15, only while a
 *   highlight is shown) [→ SMAA when the target cannot be multisampled].
 *
 *   Screen half, drawn like the direct path: the backdrop exactly as the stage made it (never
 *   tone-mapped, so the stage keeps its token colour) → the HDR picture tone-mapped (Khronos
 *   Neutral + sRGB, the renderer's own functions) where a surface was drawn, writing its depth →
 *   the see-through shells and haze (LAYER.SHELL, LAYER.FX) forward, blended in display space
 *   and tested against that depth.
 *
 * So a membrane, a contact shadow or the backdrop look the same on every GPU; only the opaque
 * parts gain occlusion and glow. The ambient occlusion pass skips shells, glass and haze: a
 * membrane never darkens the chromosomes inside it. Everything here is visual only — never a
 * count or a position — and `degrade()` turns the costly parts off one by one when frames are
 * slow (AO, then bloom, then refraction): smoothness first, accuracy never (MASTER_PROMPT §2.6).
 */
import * as THREE from 'three';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { LAYER } from './layers';

/** Style-guide values of the chain. */
export const POSTFX = {
  /** AO radius as a share of the subject's bounding radius. */
  aoRadiusShare: 0.04,
  aoBlend: { light: 0.65, dark: 0.8 },
  aoSamples: 12,
  bloom: { strength: 0.35, radius: 0.4, threshold: 1.15 },
  /** Refraction renders the opaque scene again at this share of the canvas size. */
  transmissionScale: 0.5,
} as const;

/** Layers each camera of the chain draws (bit masks). */
export const POSTFX_LAYERS = {
  /** HDR half: opaque parts and refracting glass (refraction needs the opaque scene). */
  hdr: (1 << LAYER.OPAQUE) | (1 << LAYER.GLASS),
  /** Ambient occlusion: opaque parts only. */
  ao: 1 << LAYER.OPAQUE,
  /** Screen half, forward: see-through shells and haze. */
  forward: (1 << LAYER.SHELL) | (1 << LAYER.FX),
  /**
   * Screen half, backdrop: a layer no object uses, so the renderer draws only the background
   * (three.js draws it on every layer; a camera that sees no layer would skip it too).
   */
  backdrop: 1 << 31,
} as const;

export interface PostFxState {
  ao: boolean;
  bloom: boolean;
  transmission: boolean;
}

export interface PostFxOptions {
  width: number;
  height: number;
  pixelRatio: number;
  theme: 'light' | 'dark';
  /** Multisampling of the render target (4; 0 falls back to SMAA). */
  samples: number;
}

export interface PostFx {
  /** What still runs (`degrade` turns parts off). */
  readonly state: Readonly<PostFxState>;
  /** Whether a highlight is shown now (bloom runs only then). */
  readonly highlight: boolean;
  setScene(scene: THREE.Scene): void;
  /** The subject's bounds: AO clip box and radius. */
  setSubject(box: THREE.Box3): void;
  setTheme(theme: 'light' | 'dark'): void;
  setHighlight(on: boolean): void;
  setSize(width: number, height: number, pixelRatio: number): void;
  render(): void;
  /** Turns off the next costly part (AO, then bloom, then refraction); null when none is left. */
  degrade(): keyof PostFxState | null;
  dispose(): void;
}

/** Parts `degrade()` turns off, in order. */
export const DEGRADE_ORDER: readonly (keyof PostFxState)[] = ['ao', 'bloom', 'transmission'];

const COMPOSITE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/**
 * Tone-maps the HDR picture with the renderer's own tone mapping and output transfer (the same
 * functions every material uses on the direct path) and writes the surface's depth, so the
 * forward shells are hidden behind opaque parts exactly as on the direct path. Where no surface
 * was drawn the backdrop already on screen stays; only a bloom halo is added there.
 */
const COMPOSITE_FRAGMENT = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tGlow;
uniform float glow;
varying vec2 vUv;

vec3 toDisplay(vec3 c) {
  vec4 o = vec4(c, 1.0);
  #ifdef TONE_MAPPING
  o.rgb = toneMapping(o.rgb);
  #endif
  return linearToOutputTexel(o).rgb;
}

void main() {
  float depth = texture2D(tDepth, vUv).x;
  vec3 c = max(texture2D(tColor, vUv).rgb, vec3(0.0));
  if (depth >= 1.0) {
    gl_FragDepth = 1.0;
    if (glow < 0.5) discard;
    vec3 g = texture2D(tGlow, vUv).rgb;
    // Only the halo's own light, added over the backdrop on screen.
    gl_FragColor = vec4(max(toDisplay(c) - toDisplay(max(c - g, vec3(0.0))), vec3(0.0)), 0.0);
  } else {
    gl_FragDepth = depth;
    gl_FragColor = vec4(toDisplay(c), 1.0);
  }
}`;

function compositeMaterial(depth: THREE.DepthTexture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'simlab.postfx.composite',
    uniforms: {
      tColor: { value: null },
      tDepth: { value: depth },
      tGlow: { value: null },
      glow: { value: 0 },
    },
    vertexShader: COMPOSITE_VERTEX,
    fragmentShader: COMPOSITE_FRAGMENT,
    // The renderer's tone mapping and sRGB output, applied once here.
    toneMapped: true,
    // Writes the surface depth wherever it draws.
    depthTest: true,
    depthWrite: true,
    depthFunc: THREE.AlwaysDepth,
    // Premultiplied: a surface (alpha 1) replaces the backdrop, a halo (alpha 0) adds to it.
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
}

const devicePx = (css: number, pixelRatio: number) => Math.max(1, Math.round(css * pixelRatio));

export function createPostFx(
  renderer: THREE.WebGLRenderer,
  initialScene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  o: PostFxOptions,
): PostFx {
  let scene = initialScene;
  const maxSamples = renderer.capabilities.maxSamples;
  const samples = maxSamples >= o.samples ? o.samples : 0;
  let w = devicePx(o.width, o.pixelRatio);
  let h = devicePx(o.height, o.pixelRatio);

  // HDR half: colour + depth (the depth tells surfaces from the backdrop and hides the shells).
  const depth = new THREE.DepthTexture(w, h);
  const hdr = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    samples,
    depthTexture: depth,
  });
  hdr.texture.name = 'simlab.postfx.hdr';
  const aoTarget = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
  });
  aoTarget.texture.name = 'simlab.postfx.ao';
  const smaaTarget =
    samples === 0
      ? new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false })
      : null;

  // One camera per half, copied from the main camera every frame.
  const hdrCamera = camera.clone();
  const aoCamera = camera.clone();
  const forwardCamera = camera.clone();
  const backdropCamera = camera.clone();
  const syncCameras = () => {
    for (const [c, mask] of [
      [hdrCamera, POSTFX_LAYERS.hdr],
      [aoCamera, POSTFX_LAYERS.ao],
      [forwardCamera, POSTFX_LAYERS.forward],
      [backdropCamera, POSTFX_LAYERS.backdrop],
    ] as const) {
      c.copy(camera, false);
      c.layers.mask = mask;
    }
  };
  syncCameras();

  const gtao = new GTAOPass(scene, aoCamera, devicePx(w, 0.5), devicePx(h, 0.5));
  gtao.updateGtaoMaterial({ samples: POSTFX.aoSamples });
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(w, h),
    POSTFX.bloom.strength,
    POSTFX.bloom.radius,
    POSTFX.bloom.threshold,
  );
  // The halo is added into the HDR colour without touching its depth.
  bloom.blendMaterial.depthTest = false;
  bloom.blendMaterial.depthWrite = false;
  const smaa = smaaTarget ? new SMAAPass() : null;
  const composite = compositeMaterial(depth);
  const quad = new FullScreenQuad(composite);

  const setSize = (width: number, height: number, pixelRatio: number) => {
    w = devicePx(width, pixelRatio);
    h = devicePx(height, pixelRatio);
    hdr.setSize(w, h);
    aoTarget.setSize(w, h);
    smaaTarget?.setSize(w, h);
    // Half resolution (the denoise pass smooths it).
    gtao.setSize(devicePx(w, 0.5), devicePx(h, 0.5));
    bloom.setSize(w, h);
    smaa?.setSize(w, h);
  };
  setSize(o.width, o.height, o.pixelRatio);

  const state: PostFxState = { ao: true, bloom: true, transmission: true };
  let highlight = false;
  const sync = () => {
    gtao.enabled = state.ao;
    bloom.enabled = state.bloom && highlight;
  };
  const setTheme = (theme: 'light' | 'dark') => {
    gtao.blendIntensity = POSTFX.aoBlend[theme];
  };
  setTheme(o.theme);
  sync();
  const previousTransmissionScale = renderer.transmissionResolutionScale;
  renderer.transmissionResolutionScale = POSTFX.transmissionScale;

  const render = () => {
    syncCameras();
    const autoClear = renderer.autoClear;
    const autoShadows = renderer.shadowMap.autoUpdate;
    const autoReset = renderer.info.autoReset;
    // One frame's draw calls add up over every step (the test hooks read the total).
    renderer.info.reset();
    renderer.info.autoReset = false;
    const background = scene.background;
    try {
      // 1. HDR: opaque parts and glass, over the backdrop (refraction shows it).
      renderer.autoClear = true;
      renderer.setRenderTarget(hdr);
      renderer.render(scene, hdrCamera);
      // Shadow maps are drawn once per frame.
      renderer.shadowMap.autoUpdate = false;
      let read: THREE.WebGLRenderTarget = hdr;
      if (gtao.enabled) {
        // The backdrop is not a surface: it never enters the normal/depth buffer.
        scene.background = null;
        try {
          gtao.render(renderer, aoTarget, hdr, 0, false);
        } finally {
          scene.background = background;
        }
        read = aoTarget;
      }
      // Bloom adds its halo into `read` itself (the write buffer is unused).
      if (bloom.enabled) bloom.render(renderer, read, read, 0, false);
      if (smaa && smaaTarget) {
        smaa.render(renderer, smaaTarget, read, 0, false);
        read = smaaTarget;
      }

      // 2. Screen: the backdrop exactly as the direct path draws it (no object is drawn).
      renderer.setRenderTarget(null);
      renderer.render(scene, backdropCamera);
      renderer.autoClear = false;
      // 3. The tone-mapped surfaces with their depth (+ the halo over the backdrop).
      const u = composite.uniforms as Record<'tColor' | 'tGlow' | 'glow', THREE.IUniform>;
      u.tColor.value = read.texture;
      u.glow.value = bloom.enabled ? 1 : 0;
      u.tGlow.value = bloom.enabled ? (bloom.renderTargetsHorizontal[0]?.texture ?? null) : null;
      quad.render(renderer);
      // 4. See-through shells and haze, blended on screen like the direct path.
      scene.background = null;
      renderer.render(scene, forwardCamera);
    } finally {
      scene.background = background;
      renderer.autoClear = autoClear;
      renderer.shadowMap.autoUpdate = autoShadows;
      renderer.info.autoReset = autoReset;
    }
  };

  return {
    state,
    get highlight() {
      return highlight;
    },
    setScene(next) {
      scene = next;
      gtao.scene = next;
    },
    setSubject(box) {
      if (box.isEmpty()) return;
      gtao.setSceneClipBox(box);
      const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
      gtao.updateGtaoMaterial({ radius: Math.max(1e-3, POSTFX.aoRadiusShare * radius) });
    },
    setTheme,
    setHighlight(on) {
      highlight = on;
      sync();
    },
    setSize,
    render,
    degrade() {
      const next = DEGRADE_ORDER.find((k) => state[k]) ?? null;
      if (next) {
        state[next] = false;
        sync();
      }
      return next;
    },
    dispose() {
      renderer.transmissionResolutionScale = previousTransmissionScale;
      gtao.dispose();
      bloom.dispose();
      smaa?.dispose();
      quad.dispose();
      composite.dispose();
      hdr.dispose();
      depth.dispose();
      aoTarget.dispose();
      smaaTarget?.dispose();
    },
  };
}
