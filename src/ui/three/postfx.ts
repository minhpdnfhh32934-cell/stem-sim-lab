/**
 * Post-processing of the High tier on a discrete GPU (loaded on demand: Medium never downloads
 * it). One chain for every 3D view:
 *
 *   HalfFloat render target with 4× MSAA → RenderPass → GTAO (half resolution, opaque layer only)
 *   → bloom (HDR threshold 1.15, only while a highlight is shown) → OutputPass (Neutral tone
 *   mapping + sRGB) [→ SMAA, only when the render target cannot be multisampled].
 *
 * The ambient occlusion pass draws normals and depth through its own camera, which skips the
 * see-through shells and glass (LAYER.SHELL) and haze (LAYER.FX): a membrane never darkens the
 * chromosomes inside it. Everything here is visual only — never a count or a position — and
 * `degrade()` turns the costly parts off one by one when frames are slow (AO, then bloom, then
 * refraction): smoothness first, accuracy never (MASTER_PROMPT §2.6).
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
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

export function createPostFx(
  renderer: THREE.WebGLRenderer,
  initialScene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  o: PostFxOptions,
): PostFx {
  let scene = initialScene;
  const maxSamples = renderer.capabilities.maxSamples;
  const samples = maxSamples >= o.samples ? o.samples : 0;
  const target = new THREE.WebGLRenderTarget(
    Math.max(1, Math.round(o.width * o.pixelRatio)),
    Math.max(1, Math.round(o.height * o.pixelRatio)),
    { type: THREE.HalfFloatType, samples },
  );
  target.texture.name = 'simlab.postfx.rt';
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(o.pixelRatio);
  composer.setSize(o.width, o.height);

  const renderPass = new RenderPass(scene, camera);

  // The AO pass's own camera: the main camera's view without the see-through layers.
  const aoCamera = camera.clone();
  const syncAoCamera = () => {
    aoCamera.copy(camera, false);
    aoCamera.layers.set(LAYER.OPAQUE);
  };
  syncAoCamera();
  const gtao = new GTAOPass(scene, aoCamera, o.width, o.height);
  gtao.updateGtaoMaterial({ samples: POSTFX.aoSamples });
  // Half resolution (the denoise pass smooths it).
  const gtaoSetSize = gtao.setSize.bind(gtao);
  gtao.setSize = (w: number, h: number) => {
    gtaoSetSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
  };
  // The backdrop is not a surface: it never enters the normal/depth buffer.
  const gtaoRender = gtao.render.bind(gtao);
  gtao.render = (r, write, read, dt, mask) => {
    const bg = scene.background;
    scene.background = null;
    try {
      gtaoRender(r, write, read, dt, mask);
    } finally {
      scene.background = bg;
    }
  };

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(o.width, o.height),
    POSTFX.bloom.strength,
    POSTFX.bloom.radius,
    POSTFX.bloom.threshold,
  );
  const output = new OutputPass();
  const smaa = samples === 0 ? new SMAAPass() : null;

  composer.addPass(renderPass);
  composer.addPass(gtao);
  composer.addPass(bloom);
  composer.addPass(output);
  if (smaa) composer.addPass(smaa);
  // Size every pass (GTAO at half resolution).
  composer.setSize(o.width, o.height);

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

  return {
    state,
    get highlight() {
      return highlight;
    },
    setScene(next) {
      scene = next;
      renderPass.scene = next;
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
    setSize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
    render() {
      syncAoCamera();
      composer.render();
    },
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
      output.dispose();
      smaa?.dispose();
      renderPass.dispose();
      // Frees both of the composer's render targets (the second is a clone of `target`).
      composer.dispose();
    },
  };
}
