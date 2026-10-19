/**
 * The 3D canvas of a biology lesson (every lesson but mitosis, which has its own view): one
 * WebGL renderer per quality tier, studio lighting, page-drawn labels (CSS2D), an orbit camera
 * that keeps the subject in the space the controls leave free, frames drawn on demand only
 * (orbit, a new model, a new moment, a resize) or every frame while the lesson animates (then
 * frame times feed the overload ladder). A lost GPU context hands the lesson to its 2D picture;
 * everything is freed on unmount.
 */
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { FrameMonitor } from '@/perf/frameMonitor';
import { effectiveTier, reportOverload, usePerfStore, useTierConfig } from '@/perf/perfStore';
import type { QualityTier } from '@/perf/tiers';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import {
  DEFAULT_VIEW,
  NO_INSETS,
  fitPointsDistance,
  fitSphereDistance,
  viewWindow,
  type Insets,
} from './frame';
import { measureInsets } from './insets';
import { SceneKit, type Bio3DScene, type Vec3 } from './kit';
import { createEnvironment } from './look';
import { useBio3DHealth, type Bio3DLesson } from './prefs';
import { webglRenderer, type RendererFactory, type RendererLike } from './renderer';

/** Vertical field of view (degrees). */
const FOV = 36;

/** Read-only hook for end-to-end tests (dev builds only). */
export interface Bio3DDebug {
  lesson: Bio3DLesson;
  info(): { calls: number; triangles: number; geometries: number; textures: number };
  /** Page rectangle the subject's bounding sphere is drawn in. */
  subjectRect(): { left: number; top: number; right: number; bottom: number } | null;
  /** Number of frames drawn so far. */
  frames(): number;
}
declare global {
  interface Window {
    __simlabBio3d?: Bio3DDebug;
  }
}

export interface Bio3DCanvasProps {
  lesson: Bio3DLesson;
  /** Builds the scene from the lesson's model; called again when `buildKey` changes. */
  build: (kit: SceneKit) => Bio3DScene;
  buildKey: string;
  /** Accessible description of the picture (what it shows now). */
  label: string;
  /** The lesson's time (s): the scene is moved there, not rebuilt. */
  time?: number;
  /** Illustrative motion runs (scene.tick every frame). */
  running?: boolean;
  viewDir?: Vec3;
  /** Width / height of the subject (for counting a corner control from the top or the side). */
  aspect?: number;
  /** Incremented to frame the subject again from the default direction. */
  resetNonce?: number;
  /** HUD whose `data-inset` children cover the canvas edges. */
  hudRef?: RefObject<HTMLElement | null>;
  createRenderer?: RendererFactory;
}

function tokenReader(): (name: string) => string {
  const css = getComputedStyle(document.documentElement);
  // Theme tokens only; the neutral fallback is for environments without the stylesheet.
  return (name) => css.getPropertyValue(name).trim() || 'gray';
}

interface Runtime {
  request: () => void;
  setScene: (s: Bio3DScene | null) => void;
  scene: Bio3DScene | null;
  frame: (dir: Vec3 | null) => void;
}

export function Bio3DCanvas(props: Bio3DCanvasProps) {
  const {
    lesson,
    buildKey,
    label,
    time,
    running = false,
    viewDir = DEFAULT_VIEW,
    aspect = 1.4,
    resetNonce = 0,
    hudRef,
    createRenderer = webglRenderer,
  } = props;
  const tier = useTierConfig();
  const tierName: QualityTier = usePerfStore(effectiveTier);
  const theme = useResolvedTheme();
  const hostRef = useRef<HTMLDivElement>(null);
  const rtRef = useRef<Runtime | null>(null);
  const buildRef = useRef(props.build);
  const timeRef = useRef(time);
  const viewRef = useRef(viewDir);
  /** What the camera framed last (a new subject size is framed again). */
  const framedRef = useRef<{ radius: number; center: Vec3 } | null>(null);
  // The latest props for the effects below (layout effects run before them).
  useLayoutEffect(() => {
    buildRef.current = props.build;
    timeRef.current = time;
    viewRef.current = viewDir;
  });

  // Renderer, camera, controls and labels: one set per quality tier.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: RendererLike;
    try {
      renderer = createRenderer({ antialias: tier.antialias });
    } catch {
      useBio3DHealth.setState({ failed: true });
      return;
    }
    // A new renderer (tier) frames its first scene from scratch.
    framedRef.current = null;
    const width = () => Math.max(1, host.clientWidth);
    const height = () => Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.pixelRatioCap));
    renderer.setSize(width(), height());
    renderer.domElement.className = 'bio3d__canvas';
    host.appendChild(renderer.domElement);
    const env = createEnvironment(renderer);
    const labels = new CSS2DRenderer();
    labels.setSize(width(), height());
    labels.domElement.className = 'bio3d__labels';
    host.appendChild(labels.domElement);

    const cam = new THREE.PerspectiveCamera(FOV, 1, 0.05, 2000);
    let insets: Insets = NO_INSETS;
    const applyViewport = () => {
      const win = viewWindow(width(), height(), insets);
      cam.aspect = win.fullWidth / win.fullHeight;
      cam.setViewOffset(win.fullWidth, win.fullHeight, win.x, win.y, win.width, win.height);
      cam.updateProjectionMatrix();
    };
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enablePan = false;
    let drawn = 0;
    let raf = 0;
    const rt: Runtime = {
      scene: null,
      request: () => {
        if (!raf) raf = requestAnimationFrame(render);
      },
      setScene: (s) => {
        rt.scene = s;
      },
      /** Fits the subject from `dir` (null: keep the learner's direction). */
      frame: (dir) => {
        const s = rt.scene;
        if (!s) return;
        const d = dir
          ? new THREE.Vector3(...dir).normalize()
          : cam.position.clone().sub(controls.target).normalize();
        if (d.lengthSq() < 1e-9) d.set(...viewRef.current).normalize();
        const b = s.bounds;
        const dist = b.points?.length
          ? Math.max(
              b.radius * 0.6,
              fitPointsDistance(
                b.points,
                b.center,
                [d.x, d.y, d.z],
                FOV,
                width(),
                height(),
                insets,
              ),
            )
          : fitSphereDistance(b.radius, FOV, width(), height(), insets);
        controls.target.set(...s.bounds.center);
        cam.position.copy(controls.target).addScaledVector(d, dist);
        cam.near = Math.max(0.01, dist / 400);
        cam.far = dist * 20;
        cam.updateProjectionMatrix();
        // Zooming in stops outside the subject's sphere (or, for a flat subject, at a third of
        // the framing distance); out, at three times it.
        controls.minDistance = b.points?.length
          ? dist * 0.3
          : Math.max(b.radius * 1.05, dist * 0.35);
        controls.maxDistance = dist * 3;
        controls.update();
        rt.request();
      },
    };
    const render = () => {
      raf = 0;
      if (!rt.scene) return;
      rt.scene.kit.scene.environment = env.texture;
      renderer.render(rt.scene.kit.scene, cam);
      labels.render(rt.scene.kit.scene, cam);
      drawn++;
    };
    controls.addEventListener('change', rt.request);

    const onLost = (e: Event) => {
      e.preventDefault();
      useBio3DHealth.setState({ failed: true });
    };
    renderer.domElement.addEventListener('webglcontextlost', onLost);

    insets = measureInsets(host, hudRef?.current ?? null, NO_INSETS, aspect);
    applyViewport();
    const ro =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            renderer.setSize(width(), height());
            labels.setSize(width(), height());
            insets = measureInsets(host, hudRef?.current ?? null, NO_INSETS, aspect);
            applyViewport();
            rt.frame(null);
          });
    ro?.observe(host);
    for (const el of hudRef?.current?.querySelectorAll('[data-inset]') ?? []) ro?.observe(el);

    let hook: Bio3DDebug | null = null;
    if (import.meta.env.DEV) {
      hook = {
        lesson,
        info: () => ({
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
        }),
        subjectRect: () => {
          const s = rt.scene;
          if (!s) return null;
          const box = host.getBoundingClientRect();
          const c = new THREE.Vector3(...s.bounds.center);
          cam.updateMatrixWorld();
          const r = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
          const v = new THREE.Vector3();
          for (let k = 0; k < 64; k++) {
            const y = 1 - (2 * (k + 0.5)) / 64;
            const rr = Math.sqrt(1 - y * y);
            const a = k * 2.39996;
            v.set(rr * Math.cos(a), y, rr * Math.sin(a))
              .multiplyScalar(s.bounds.radius)
              .add(c)
              .project(cam);
            const x = box.left + ((v.x + 1) / 2) * box.width;
            const yy = box.top + ((1 - v.y) / 2) * box.height;
            r.left = Math.min(r.left, x);
            r.right = Math.max(r.right, x);
            r.top = Math.min(r.top, yy);
            r.bottom = Math.max(r.bottom, yy);
          }
          return r;
        },
        frames: () => drawn,
      };
      window.__simlabBio3d = hook;
    }
    rtRef.current = rt;

    return () => {
      rtRef.current = null;
      if (hook && window.__simlabBio3d === hook) delete window.__simlabBio3d;
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      controls.removeEventListener('change', rt.request);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      env.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
      labels.domElement.remove();
    };
  }, [tier, createRenderer, lesson, hudRef, aspect]);

  // Scene: rebuilt when the model, the tier or the theme changes; the renderer stays.
  useEffect(() => {
    const rt = rtRef.current;
    if (!rt) return;
    const kit = new SceneKit({
      tier: tierName,
      segments: tier.sphereSegments,
      maxParticles: tier.maxParticles,
      token: tokenReader(),
    });
    let built: Bio3DScene;
    try {
      built = buildRef.current(kit);
    } catch (e) {
      kit.dispose();
      throw e;
    }
    if (timeRef.current !== undefined) built.setTime?.(timeRef.current);
    rt.setScene(built);
    const prev = framedRef.current;
    const b = built.bounds;
    const moved =
      !prev ||
      Math.abs(b.radius - prev.radius) > 0.05 * prev.radius ||
      Math.hypot(
        b.center[0] - prev.center[0],
        b.center[1] - prev.center[1],
        b.center[2] - prev.center[2],
      ) >
        0.1 * prev.radius;
    // A new subject size is framed again (keeping the learner's direction once they orbited).
    if (moved) rt.frame(prev ? null : viewRef.current);
    framedRef.current = { radius: b.radius, center: [...b.center] };
    rt.request();
    return () => {
      if (rt.scene === built) rt.setScene(null);
      kit.dispose();
    };
  }, [buildKey, tier, tierName, theme, createRenderer, lesson]);

  // A new moment of the lesson: the scene moves, nothing is rebuilt.
  useEffect(() => {
    const rt = rtRef.current;
    if (!rt?.scene || time === undefined) return;
    rt.scene.setTime?.(time);
    rt.request();
  }, [time]);

  // "Đặt lại góc nhìn".
  useEffect(() => {
    if (resetNonce) rtRef.current?.frame(viewRef.current);
  }, [resetNonce]);

  // Illustrative motion: every frame while running (frame times feed the overload ladder).
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let prev = performance.now();
    const monitor = new FrameMonitor(1 / 30);
    const step = (now: number) => {
      const elapsed = Math.max(0, (now - prev) / 1000);
      prev = now;
      if (document.visibilityState === 'visible') {
        monitor.record(elapsed);
        if (monitor.overloaded) {
          reportOverload();
          monitor.resetOverload();
        }
      }
      const rt = rtRef.current;
      if (rt?.scene?.tick) {
        rt.scene.tick(Math.min(0.1, elapsed));
        rt.request();
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [running]);

  return <div ref={hostRef} className="bio3d__gl" role="img" aria-label={label} />;
}
