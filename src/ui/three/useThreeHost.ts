/**
 * The host of a 3D view: one WebGL renderer (per quality tier), a perspective camera centred on
 * the canvas's safe area, orbit controls (no panning; damping that settles), studio environment
 * lighting, frames drawn on demand only, taps and double-taps turned into rays, arrow-key
 * orbiting, smooth camera moves, and a clean teardown. A lost GPU context is reported once and
 * never retried (the view shows its 2D picture).
 *
 * Rendering on demand: `request()` draws one frame; the frame asks for another only while the
 * camera is still moving (damping after a drag, a camera move in progress) — an idle view costs
 * nothing.
 *
 * Every scene goes on the same stage (`stage.ts`: backdrop, theme-dependent light, exposure) and
 * its objects on their render layers (`layers.ts`). On the High tier with a discrete GPU the
 * frames go through the post-processing chain (`postfx.ts`, loaded on demand); a guard turns its
 * costly parts off when animated frames are slow. Without a real WebGL renderer (tests) there is
 * no environment and no post-processing.
 */
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { effectiveTier, usePerfStore } from '@/perf/perfStore';
import type { QualityTier } from '@/perf/tiers';
import { prefersReducedMotion } from './availability';
import { orbitForKey, tweenCamera, type CameraPose, type Vec3 } from './camera';
import { NO_INSETS, viewWindow, type Insets } from './frame';
import { gpuClass, postFxOverride, rendererString, type GpuClass } from './gpuInfo';
import { sameInsets } from './insets';
import { assignLayers, seeAllLayers } from './layers';
import { createEnvironment, type Environment } from './lighting';
import { createTapTracker, ndcFromEvent } from './pick';
import type { PostFx } from './postfx';
import { PostFxGuard, disableTransmission, sceneWantsBloom } from './postfxSupport';
import type { Quality3D } from './quality3d';
import { isWebGLRenderer, type RendererFactory, type RendererLike } from './renderer';
import { StageKeeper, currentTheme } from './stage';

/** Where the camera goes and how far it may zoom from there. */
export interface Placement extends CameraPose {
  min: number;
  max: number;
}

/** Duration of an animated camera move (ms; style guide: 700 ms, ease-in-out cubic). */
export const CAMERA_MOVE_MS = 700;

export interface ThreeHostOptions {
  createRenderer: RendererFactory;
  quality: Quality3D;
  /** Vertical field of view (degrees) of the whole virtual image. */
  fov: number;
  near?: number;
  far?: number;
  canvasClass: string;
  /** Controls over the canvas, measured now (the picture is centred in the rest). */
  insets?: () => Insets;
  /** The canvas or the controls over it changed size; `insetsChanged`: the safe area moved. */
  onLayout?: (host: ThreeHost, insetsChanged: boolean) => void;
  /** The renderer could not start, or its GPU context was lost (never retried). */
  onFail: () => void;
  /** A tap (not a drag, not a pinch) on the canvas: the ray under the pointer. */
  onTap?: (ray: THREE.Raycaster, e: PointerEvent) => void;
  /** A double click / double tap on the canvas. */
  onDoubleTap?: (ray: THREE.Raycaster, e: MouseEvent) => void;
  /** After every frame drawn (labels follow the picture). */
  onFrame?: (host: ThreeHost) => void;
  /** Elements whose size changes re-measure the insets (in addition to the host). */
  observe?: () => Iterable<Element>;
  /** Development builds: registers read-only test hooks; returns their cleanup. */
  debug?: (host: ThreeHost) => () => void;
}

/** What the host draws with now (debug hooks: end-to-end tests assert what ran). */
export interface QualityInEffect {
  tier: QualityTier;
  degraded: boolean;
  /** 'full' once the post-processing chain draws the frames. */
  postFx: 'none' | 'full';
  gpu: GpuClass;
}

/** Read-only hooks of the 3D views for end-to-end tests (dev builds only). */
declare global {
  interface Window {
    __simlab3d?: Record<string, unknown>;
  }
}

export class ThreeHost {
  readonly renderer: RendererLike;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly canvas: HTMLCanvasElement;
  readonly raycaster = new THREE.Raycaster();
  readonly quality: Quality3D;
  scene: THREE.Scene | null = null;
  /** Frames drawn so far. */
  frames = 0;
  private readonly el: HTMLElement;
  private readonly env: Environment;
  private readonly stage = new StageKeeper();
  private postfx: PostFx | null = null;
  private readonly guard = new PostFxGuard();
  private readonly fov: number;
  private insets: Insets = NO_INSETS;
  private raf = 0;
  private tween: { from: CameraPose; to: Placement; start: number } | null = null;
  private readonly cleanups: (() => void)[] = [];
  private disposed = false;
  private readonly opts: () => ThreeHostOptions;

  /** Throws when the renderer cannot start (no WebGL). */
  constructor(el: HTMLElement, opts: () => ThreeHostOptions) {
    const o = opts();
    this.el = el;
    this.opts = opts;
    this.quality = o.quality;
    this.fov = o.fov;
    this.renderer = o.createRenderer({
      antialias: o.quality.antialias,
      shadows: o.quality.shadows,
    });
    this.canvas = this.renderer.domElement;
    this.renderer.localClippingEnabled = true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.quality.pixelRatioCap));
    this.renderer.setSize(this.width(), this.height());
    this.canvas.className = o.canvasClass;
    el.appendChild(this.canvas);
    // Studio lighting for every scene this renderer draws (none with a fake renderer).
    this.env = o.quality.envMap
      ? createEnvironment(this.renderer)
      : { texture: null, dispose: () => undefined };
    this.camera = new THREE.PerspectiveCamera(o.fov, 1, o.near ?? 0.1, o.far ?? 400);
    // The camera draws every layer; picking rays test every layer (shells can be picked).
    seeAllLayers(this.camera);
    seeAllLayers(this.raycaster);
    this.insets = o.insets?.() ?? NO_INSETS;
    this.applyViewport();
    this.controls = new OrbitControls(this.camera, this.canvas);
    // Orbit and zoom only: the target stays on the subject, so the zoom limits keep the camera
    // outside it. Damping: a drag glides to a stop (the frames that settle it are requested).
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.14;
    const onChange = () => {
      this.request();
    };
    this.controls.addEventListener('change', onChange);
    this.cleanups.push(() => {
      this.controls.removeEventListener('change', onChange);
    });
    this.raycaster.params.Line = { threshold: 0.12 };
    this.listen();
    this.startPostFx();
  }

  /**
   * Loads the post-processing chain when the quality table asks for it and the renderer really
   * runs on a discrete GPU (the development override may force it for art probes).
   */
  private startPostFx(): void {
    const r = this.renderer;
    if (this.quality.postFx !== 'full' || !isWebGLRenderer(r)) return;
    const actual = gpuClass(rendererString(r.getContext()));
    if (postFxOverride() !== 'on' && actual !== 'discrete' && actual !== 'unknown') return;
    void import('./postfx').then(({ createPostFx }) => {
      if (this.disposed) return;
      this.postfx = createPostFx(r, this.scene ?? new THREE.Scene(), this.camera, {
        width: this.width(),
        height: this.height(),
        pixelRatio: r.getPixelRatio(),
        theme: currentTheme(),
        samples: this.quality.msaaSamples,
      });
      if (this.scene) this.preparePostFx(this.scene);
      this.request();
    });
  }

  /** A new scene for the chain: its bounds (AO clip box and radius), theme and refraction. */
  private preparePostFx(scene: THREE.Scene): void {
    const fx = this.postfx;
    if (!fx) return;
    fx.setScene(scene);
    fx.setTheme(currentTheme());
    fx.setSubject(new THREE.Box3().setFromObject(scene));
    if (!fx.state.transmission) disableTransmission(scene);
  }

  width(): number {
    return Math.max(1, this.el.clientWidth);
  }

  height(): number {
    return Math.max(1, this.el.clientHeight);
  }

  /** Controls over the canvas as last measured. */
  currentInsets(): Insets {
    return this.insets;
  }

  /** Draws a frame soon (once, however often it is asked before then). */
  request = (): void => {
    if (!this.raf && !this.disposed) this.raf = requestAnimationFrame(this.render);
  };

  setScene(scene: THREE.Scene | null): void {
    this.scene = scene;
    if (scene) {
      assignLayers(scene);
      this.stage.apply(scene, this.renderer, this.quality.envIntensity);
      this.preparePostFx(scene);
    }
    this.request();
  }

  /** The camera's pose now. */
  pose(): CameraPose {
    const p = this.camera.position;
    const t = this.controls.target;
    return { target: [t.x, t.y, t.z], position: [p.x, p.y, p.z] };
  }

  /** Unit direction from the target to the camera now. */
  direction(fallback: Vec3): Vec3 {
    const d = this.camera.position.clone().sub(this.controls.target);
    if (d.lengthSq() < 1e-12) return fallback;
    d.normalize();
    return [d.x, d.y, d.z];
  }

  /**
   * Moves the camera to a placement: at once, or (`animate`) smoothly over CAMERA_MOVE_MS —
   * always at once when the learner asked for reduced motion.
   */
  place(p: Placement, o: { animate?: boolean } = {}): void {
    if (!o.animate || prefersReducedMotion() || this.frames === 0) {
      this.tween = null;
      this.setPose(p);
      this.controls.minDistance = p.min;
      this.controls.maxDistance = p.max;
      this.controls.update();
      this.request();
      return;
    }
    const from = this.pose();
    const d0 = this.camera.position.distanceTo(this.controls.target);
    const d1 = Math.hypot(
      p.position[0] - p.target[0],
      p.position[1] - p.target[1],
      p.position[2] - p.target[2],
    );
    // Limits wide enough for every step of the move (they tighten when it ends).
    this.controls.minDistance = Math.min(p.min, d0, d1);
    this.controls.maxDistance = Math.max(p.max, d0, d1);
    this.tween = { from, to: p, start: performance.now() };
    this.request();
  }

  /** True while an animated camera move is running. */
  moving(): boolean {
    return this.tween !== null;
  }

  /** Re-measures the controls over the canvas; tells the view when the safe area moved. */
  relayout(): void {
    const next = this.opts().insets?.() ?? NO_INSETS;
    if (sameInsets(next, this.insets)) return;
    this.insets = next;
    this.applyViewport();
    this.opts().onLayout?.(this, true);
    this.request();
  }

  /** Read-only facts for the end-to-end test hooks. */
  info(): {
    geometries: number;
    textures: number;
    programs: number;
    calls: number;
    triangles: number;
    frames: number;
  } {
    const i = this.renderer.info;
    return {
      geometries: i.memory.geometries,
      textures: i.memory.textures,
      programs: i.programs?.length ?? 0,
      calls: i.render.calls,
      triangles: i.render.triangles,
      frames: this.frames,
    };
  }

  /** Quality tier in effect, and whether the app lowered it by itself (overload). */
  static tierInEffect(): { tier: QualityTier; degraded: boolean } {
    const perf = usePerfStore.getState();
    return { tier: effectiveTier(perf), degraded: perf.degraded };
  }

  /** The tier in effect plus what this host draws with (post-processing, GPU class). */
  qualityInEffect(): QualityInEffect {
    return {
      ...ThreeHost.tierInEffect(),
      postFx: this.postfx ? 'full' : 'none',
      gpu: this.quality.gpu,
    };
  }

  /** The post-processing parts still running (null without the chain). */
  postFxState(): { ao: boolean; bloom: boolean; transmission: boolean } | null {
    return this.postfx ? { ...this.postfx.state } : null;
  }

  /** Registers a test hook as `window.__simlab3d[key]`; returns its removal. */
  static registerDebug(key: string, hook: object): () => void {
    const all = (window.__simlab3d ??= {});
    all[key] = hook;
    return () => {
      const all = window.__simlab3d;
      if (all?.[key] === hook) Reflect.deleteProperty(all, key);
    };
  }

  dispose(): void {
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    for (const c of this.cleanups.splice(0)) c();
    this.controls.dispose();
    this.postfx?.dispose();
    this.postfx = null;
    this.stage.dispose();
    this.env.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    this.canvas.remove();
    this.scene = null;
  }

  private setPose(p: CameraPose): void {
    this.controls.target.set(...p.target);
    this.camera.position.set(...p.position);
    this.camera.lookAt(this.controls.target);
  }

  private applyViewport(): void {
    const win = viewWindow(this.width(), this.height(), this.insets);
    this.camera.fov = this.fov;
    this.camera.aspect = win.fullWidth / win.fullHeight;
    this.camera.setViewOffset(win.fullWidth, win.fullHeight, win.x, win.y, win.width, win.height);
    this.camera.updateProjectionMatrix();
  }

  private readonly render = (): void => {
    this.raf = 0;
    if (this.disposed) return;
    const tw = this.tween;
    if (tw) {
      const u = (performance.now() - tw.start) / CAMERA_MOVE_MS;
      this.setPose(tweenCamera(tw.from, tw.to, u));
      if (u >= 1) {
        this.tween = null;
        this.controls.minDistance = tw.to.min;
        this.controls.maxDistance = tw.to.max;
      }
      this.request();
    }
    // Damping: keeps gliding (and asking for frames through 'change') until it settles.
    this.controls.update();
    const scene = this.scene;
    if (!scene) return;
    scene.environment = this.env.texture;
    const fx = this.postfx;
    if (fx) {
      // Parts may have turned see-through since the last frame (fades): keep them out of AO.
      assignLayers(scene);
      fx.setHighlight(sceneWantsBloom(scene));
      fx.render();
      this.watchPostFx(scene, fx);
    } else {
      this.renderer.render(scene, this.camera);
    }
    this.frames++;
    this.opts().onFrame?.(this);
  };

  /** Slow animated frames turn off one costly part at a time (visual only, never a number). */
  private watchPostFx(scene: THREE.Scene, fx: PostFx): void {
    if (!this.guard.frame(performance.now())) return;
    const off = fx.degrade();
    if (off === 'transmission') disableTransmission(scene);
    // One line for whoever looks at the console; the learner sees no notice (nothing they read
    // changed).
    // eslint-disable-next-line no-console
    if (off) console.debug(`[3d] post-processing: ${off} turned off (slow frames)`);
  }

  private listen(): void {
    const canvas = this.canvas;
    const tap = createTapTracker();
    const ndc = new THREE.Vector2();
    const rayFor = (e: { clientX: number; clientY: number }) => {
      ndcFromEvent(e, canvas, ndc);
      this.camera.updateMatrixWorld();
      this.raycaster.setFromCamera(ndc, this.camera);
      return this.raycaster;
    };
    const onDown = (e: PointerEvent) => {
      tap.down(e);
    };
    const onCancel = (e: PointerEvent) => {
      tap.cancel(e);
    };
    const onUp = (e: PointerEvent) => {
      if (!tap.up(e)) return;
      const cb = this.opts().onTap;
      if (cb && this.scene) cb(rayFor(e), e);
    };
    const onDouble = (e: MouseEvent) => {
      const cb = this.opts().onDoubleTap;
      if (cb && this.scene) cb(rayFor(e), e);
    };
    // Keyboard users orbit with the arrow keys (the host element takes the focus).
    const onKey = (e: KeyboardEvent) => {
      const step = orbitForKey(e.key);
      if (!step || e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      if (step.left) this.controls.rotateLeft(step.left);
      if (step.up) this.controls.rotateUp(step.up);
      this.request();
    };
    // A lost GPU context (driver reset) never retries: the 2D view takes over.
    const onLost = (e: Event) => {
      e.preventDefault();
      this.postfx?.dispose();
      this.postfx = null;
      this.opts().onFail();
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('dblclick', onDouble);
    canvas.addEventListener('webglcontextlost', onLost);
    this.el.addEventListener('keydown', onKey);
    this.cleanups.push(() => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('dblclick', onDouble);
      canvas.removeEventListener('webglcontextlost', onLost);
      this.el.removeEventListener('keydown', onKey);
    });

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      this.renderer.setSize(this.width(), this.height());
      const r = this.renderer;
      if (this.postfx && isWebGLRenderer(r)) {
        this.postfx.setSize(this.width(), this.height(), r.getPixelRatio());
      }
      const next = this.opts().insets?.() ?? NO_INSETS;
      const changed = !sameInsets(next, this.insets);
      this.insets = next;
      this.applyViewport();
      this.opts().onLayout?.(this, changed);
      this.request();
    });
    ro.observe(this.el);
    for (const e of this.opts().observe?.() ?? []) ro.observe(e);
    this.cleanups.push(() => {
      ro.disconnect();
    });
  }
}

/**
 * Creates the view's `ThreeHost` in `hostRef`'s element and frees it on unmount, or when
 * `quality.tier`, `createRenderer` or `key` change (a new renderer). Callbacks in `options` may
 * change on every render (the latest ones are used). A renderer that cannot start calls
 * `onFail` and leaves the ref empty.
 */
export function useThreeHost(
  hostRef: RefObject<HTMLElement | null>,
  options: ThreeHostOptions,
  key = '',
): RefObject<ThreeHost | null> {
  const ref = useRef<ThreeHost | null>(null);
  const opts = useRef(options);
  useLayoutEffect(() => {
    opts.current = options;
  });
  const { createRenderer } = options;
  const tier = options.quality.tier;
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let host: ThreeHost;
    try {
      host = new ThreeHost(el, () => opts.current);
    } catch {
      opts.current.onFail();
      return;
    }
    ref.current = host;
    const undebug = import.meta.env.DEV ? opts.current.debug?.(host) : undefined;
    return () => {
      undebug?.();
      if (ref.current === host) ref.current = null;
      host.dispose();
    };
  }, [hostRef, createRenderer, tier, key]);
  return ref;
}
