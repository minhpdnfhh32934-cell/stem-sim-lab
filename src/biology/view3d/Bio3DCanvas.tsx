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
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { effectiveTier, usePerfStore, useTierConfig } from '@/perf/perfStore';
import type { QualityTier } from '@/perf/tiers';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { DEFAULT_VIEW, NO_INSETS, fitPointsDistance, fitSphereDistance } from '@/ui/three/frame';
import { measureInsets } from '@/ui/three/insets';
import { useFrameLoop } from '@/ui/three/loop';
import { quality3d } from '@/ui/three/quality3d';
import { webglRenderer, type RendererFactory } from '@/ui/three/renderer';
import { ThreeHost, useThreeHost, type QualityInEffect } from '@/ui/three/useThreeHost';
import { SceneKit, type Bio3DScene, type Vec3 } from './kit';
import { useBio3DHealth, type Bio3DLesson } from './prefs';

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
  /** Quality tier in effect and what the host draws with (post-processing, GPU class). */
  quality(): QualityInEffect;
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
  const quality = quality3d(tierName, tier);
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Bio3DScene | null>(null);
  const labelsRef = useRef<CSS2DRenderer | null>(null);
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

  /** Fits the subject from `dir` (null: keep the learner's direction). */
  const frame = (h: ThreeHost, dir: Vec3 | null) => {
    const s = sceneRef.current;
    if (!s) return;
    const d = dir
      ? new THREE.Vector3(...dir).normalize()
      : h.camera.position.clone().sub(h.controls.target).normalize();
    if (d.lengthSq() < 1e-9) d.set(...viewRef.current).normalize();
    const b = s.bounds;
    const insets = h.currentInsets();
    const dist = b.points?.length
      ? Math.max(
          b.radius * 0.6,
          fitPointsDistance(
            b.points,
            b.center,
            [d.x, d.y, d.z],
            FOV,
            h.width(),
            h.height(),
            insets,
          ),
        )
      : fitSphereDistance(b.radius, FOV, h.width(), h.height(), insets);
    const cam = h.camera;
    cam.near = Math.max(0.01, dist / 400);
    cam.far = dist * 20;
    cam.updateProjectionMatrix();
    const [cx, cy, cz] = b.center;
    h.place({
      target: [cx, cy, cz],
      position: [cx + d.x * dist, cy + d.y * dist, cz + d.z * dist],
      // Zooming in stops outside the subject's sphere (or, for a flat subject, at a third of
      // the framing distance); out, at three times it.
      min: b.points?.length ? dist * 0.3 : Math.max(b.radius * 1.05, dist * 0.35),
      max: dist * 3,
    });
  };

  // Renderer, camera and controls: one set per quality tier (and lesson, subject aspect).
  const hostRt = useThreeHost(
    hostRef,
    {
      createRenderer,
      quality,
      fov: FOV,
      near: 0.05,
      far: 2000,
      canvasClass: 'bio3d__canvas',
      insets: () =>
        hostRef.current
          ? measureInsets(hostRef.current, hudRef?.current ?? null, NO_INSETS, aspect)
          : NO_INSETS,
      observe: () => hudRef?.current?.querySelectorAll('[data-inset]') ?? [],
      onLayout: (h) => {
        labelsRef.current?.setSize(h.width(), h.height());
        frame(h, null);
      },
      onFail: () => {
        useBio3DHealth.setState({ failed: true });
      },
      onFrame: (h) => {
        if (h.scene) labelsRef.current?.render(h.scene, h.camera);
      },
      debug: (h) => {
        const host = hostRef.current;
        const hook: Bio3DDebug = {
          lesson,
          info: () => {
            const i = h.info();
            return {
              calls: i.calls,
              triangles: i.triangles,
              geometries: i.geometries,
              textures: i.textures,
            };
          },
          subjectRect: () => {
            const s = sceneRef.current;
            if (!s || !host) return null;
            const box = host.getBoundingClientRect();
            const c = new THREE.Vector3(...s.bounds.center);
            h.camera.updateMatrixWorld();
            const r = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
            const v = new THREE.Vector3();
            for (let k = 0; k < 64; k++) {
              const y = 1 - (2 * (k + 0.5)) / 64;
              const rr = Math.sqrt(1 - y * y);
              const a = k * 2.39996;
              v.set(rr * Math.cos(a), y, rr * Math.sin(a))
                .multiplyScalar(s.bounds.radius)
                .add(c)
                .project(h.camera);
              const x = box.left + ((v.x + 1) / 2) * box.width;
              const yy = box.top + ((1 - v.y) / 2) * box.height;
              r.left = Math.min(r.left, x);
              r.right = Math.max(r.right, x);
              r.top = Math.min(r.top, yy);
              r.bottom = Math.max(r.bottom, yy);
            }
            return r;
          },
          frames: () => h.frames,
          quality: () => h.qualityInEffect(),
        };
        // `__simlabBio3d` is kept as an alias for the existing end-to-end tests.
        window.__simlabBio3d = hook;
        const unregister = ThreeHost.registerDebug(lesson, hook);
        return () => {
          unregister();
          if (window.__simlabBio3d === hook) delete window.__simlabBio3d;
        };
      },
    },
    `${lesson}|${String(aspect)}`,
  );

  // Page-drawn labels (sharp at any zoom), one layer per renderer.
  useEffect(() => {
    const h = hostRt.current;
    const host = hostRef.current;
    if (!h || !host) return;
    // A new renderer (tier) frames its first scene from scratch.
    framedRef.current = null;
    const labels = new CSS2DRenderer();
    labels.setSize(h.width(), h.height());
    labels.domElement.className = 'bio3d__labels';
    host.appendChild(labels.domElement);
    labelsRef.current = labels;
    return () => {
      if (labelsRef.current === labels) labelsRef.current = null;
      labels.domElement.remove();
    };
  }, [hostRt, tierName, createRenderer, lesson, aspect]);

  // Scene: rebuilt when the model, the tier or the theme changes; the renderer stays.
  useEffect(() => {
    const h = hostRt.current;
    if (!h) return;
    const kit = new SceneKit({
      tier: tierName,
      segments: tier.sphereSegments,
      maxParticles: tier.maxParticles,
      token: tokenReader(),
      transmission: quality.transmission,
      hdr: quality.bloom,
      shadows: quality.shadowScenes,
    });
    let built: Bio3DScene;
    try {
      built = buildRef.current(kit);
    } catch (e) {
      kit.dispose();
      throw e;
    }
    if (timeRef.current !== undefined) built.setTime?.(timeRef.current);
    sceneRef.current = built;
    h.setScene(built.kit.scene);
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
    if (moved) frame(h, prev ? null : viewRef.current);
    framedRef.current = { radius: b.radius, center: [...b.center] };
    h.request();
    return () => {
      if (sceneRef.current === built) {
        sceneRef.current = null;
        h.setScene(null);
      }
      kit.dispose();
    };
  }, [
    buildKey,
    tier,
    tierName,
    theme,
    createRenderer,
    lesson,
    aspect,
    hostRt,
    quality.transmission,
    quality.bloom,
    quality.shadowScenes,
  ]);

  // A new moment of the lesson: the scene moves, nothing is rebuilt.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s || time === undefined) return;
    s.setTime?.(time);
    hostRt.current?.request();
  }, [time, hostRt]);

  // "Đặt lại góc nhìn".
  useEffect(() => {
    const h = hostRt.current;
    if (resetNonce && h) frame(h, viewRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetNonce]);

  // Illustrative motion: every frame while running (frame times feed the overload ladder).
  useFrameLoop(running, (dt) => {
    const s = sceneRef.current;
    if (s?.tick) {
      s.tick(dt);
      hostRt.current?.request();
    }
  });

  return <div ref={hostRef} className="bio3d__gl" role="img" aria-label={label} />;
}
