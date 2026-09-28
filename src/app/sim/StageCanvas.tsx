import { useEffect, useRef } from 'react';
import { useT } from '@/app/i18n';
import { formatNumber } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { FrameMonitor } from '@/perf/frameMonitor';
import { usePerfStore, useTierConfig } from '@/perf/perfStore';
import { Camera } from '@/physics/render/camera';
import { drawGrid, line, polyline, text } from '@/physics/render/draw';
import type { PhysicsScene, ThemeColors } from '@/physics/types';
import { sim } from './runtime';
import { useSimStore } from './simStore';
import { readThemeColors } from './themeColors';

type Measure = {
  kind: 'ruler' | 'protractor';
  a: { x: number; y: number };
  b: { x: number; y: number };
};

/**
 * The 2D simulation canvas: owns the animation loop, camera, pointer interaction
 * (select, drag with spring constraint, pan, zoom) and measuring tools.
 */
export function StageCanvas({ scene }: { scene: PhysicsScene }) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef(new Camera());
  const colorsRef = useRef<ThemeColors | null>(null);
  const measureRef = useRef<Measure | null>(null);
  const theme = useResolvedTheme();
  const tier = useTierConfig();
  const fitRequest = useSimStore((s) => s.fitRequest);
  const tool = useWorkspaceStore((s) => s.activeTool);
  const toolRef = useRef(tool);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  // Theme colors (re-read when the theme changes).
  useEffect(() => {
    colorsRef.current = readThemeColors();
  }, [theme]);

  // Focus the canvas when a scene opens so Space/R work immediately.
  useEffect(() => {
    canvasRef.current?.focus({ preventScroll: true });
  }, [scene]);

  // Frame the scene on open / parameter change / "fit view".
  useEffect(() => {
    const cam = camRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    cam.resize(r.width, r.height);
    cam.fit(scene.view(useSimStore.getState().params));
  }, [scene, fitRequest]);

  // Resize + render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cam = camRef.current;
    let dpr = Math.min(window.devicePixelRatio || 1, tier.pixelRatioCap);
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, tier.pixelRatioCap);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      const first = cam.width === 800 && cam.height === 600;
      cam.resize(r.width, r.height);
      if (first) cam.fit(scene.view(useSimStore.getState().params));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const monitor = new FrameMonitor(1 / 60);
    let last = performance.now();
    let lastFpsPush = 0;
    let raf = 0;
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const playing = useWorkspaceStore.getState().playing;
      if (playing) monitor.record(dt);
      sim.tick(dt);
      render(ctx, dpr);
      if (now - lastFpsPush > 400) {
        lastFpsPush = now;
        usePerfStore.getState().setFps(playing ? monitor.fps : null);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const render = (c: CanvasRenderingContext2D, ratio: number) => {
      const colors = colorsRef.current ?? readThemeColors();
      const state = sim.renderState;
      const sstate = useSimStore.getState();
      const locale = useSettingsStore.getState().locale;
      c.setTransform(ratio, 0, 0, ratio, 0, 0);
      c.clearRect(0, 0, cam.width, cam.height);
      c.imageSmoothingEnabled = tier.antialias;
      drawGrid(c, cam, colors, locale);
      if (!state || sstate.validation.length > 0) return;
      const p = sstate.params;
      // Trail from recorded history (up to the current time when scrubbing).
      if (sstate.trail && scene.trail) {
        const h = sim.history;
        const end = sstate.scrubTime !== null ? h.indexAt(sstate.scrubTime) + 1 : h.length;
        const stride = Math.max(1, Math.floor(end / 600));
        const tracks: { x: number; y: number }[][] = [];
        for (let i = 0; i < end; i += stride) {
          const s = h.states[i];
          if (!s) continue;
          scene.trail(s, p).forEach((pt, k) => {
            (tracks[k] ??= []).push(pt);
          });
        }
        scene.trail(state, p).forEach((pt, k) => (tracks[k] ??= []).push(pt));
        for (const tr of tracks) polyline(c, cam, tr, colors.accent, 1.6);
      }
      scene.draw({
        ctx: c,
        cam,
        state,
        p,
        opts: {
          vectors: sstate.vectors,
          trail: sstate.trail,
          intervened: sstate.intervened,
          selected: sstate.selected,
          locale,
          colors,
          time: sim.latest?.t ?? 0,
        },
      });
      drawMeasure(c, colors, locale);
    };

    const drawMeasure = (c: CanvasRenderingContext2D, colors: ThemeColors, locale: 'vi' | 'en') => {
      const m = measureRef.current;
      if (!m) return;
      const { a, b } = m;
      line(c, cam, a.x, a.y, b.x, b.y, colors.accent, 2);
      if (m.kind === 'ruler') {
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        text(
          c,
          cam,
          (a.x + b.x) / 2,
          (a.y + b.y) / 2,
          `${formatNumber(locale, d, { maximumSignificantDigits: 4 })} m`,
          colors.accent,
          'center',
          { x: 0, y: -8 },
        );
      } else {
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const r = Math.hypot(b.x - a.x, b.y - a.y) * 0.3;
        line(
          c,
          cam,
          a.x,
          a.y,
          a.x + Math.hypot(b.x - a.x, b.y - a.y),
          a.y,
          colors.faint,
          1,
          [4, 4],
        );
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const th = (ang * i) / 24;
          pts.push({ x: a.x + r * Math.cos(th), y: a.y + r * Math.sin(th) });
        }
        polyline(c, cam, pts, colors.accent, 1.5);
        text(
          c,
          cam,
          a.x + r * Math.cos(ang / 2),
          a.y + r * Math.sin(ang / 2),
          `${formatNumber(locale, (Math.abs(ang) * 180) / Math.PI, { maximumFractionDigits: 1 })}°`,
          colors.accent,
          'left',
          { x: 6, y: 0 },
        );
      }
    };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      usePerfStore.getState().setFps(null);
    };
  }, [scene, tier]);

  // Pointer interaction.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cam = camRef.current;
    let mode: 'none' | 'pan' | 'drag' | 'measure' = 'none';
    let lastX = 0;
    let lastY = 0;

    const local = (e: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect();
      return { sx: e.clientX - r.left, sy: e.clientY - r.top };
    };

    const pick = (sx: number, sy: number) => {
      const state = sim.renderState;
      if (!state) return null;
      const p = useSimStore.getState().params;
      let best: { id: string; index: number; d: number } | null = null;
      scene.bodies.forEach((b, index) => {
        const pos = b.position(state, p);
        const s = cam.toScreen(pos.x, pos.y);
        const d = Math.hypot(s.sx - sx, s.sy - sy);
        const r = Math.max(14, b.radius(p) * cam.scale + 6);
        if (d <= r && (!best || d < best.d)) best = { id: b.id, index, d };
      });
      return best as { id: string; index: number; d: number } | null;
    };

    const down = (e: PointerEvent) => {
      const { sx, sy } = local(e);
      lastX = sx;
      lastY = sy;
      canvas.setPointerCapture(e.pointerId);
      if (e.button === 1) {
        mode = 'pan';
        return;
      }
      const w = cam.toWorld(sx, sy);
      const mode0 = toolRef.current;
      if (mode0 === 'ruler' || mode0 === 'protractor') {
        measureRef.current = { kind: mode0, a: w, b: w };
        mode = 'measure';
        return;
      }
      const hit = pick(sx, sy);
      if (hit) {
        useSimStore.setState({ selected: hit.id });
        const body = scene.bodies[hit.index];
        if (body?.draggable) {
          mode = 'drag';
          sim.input({ kind: 'dragStart', body: hit.index, x: w.x, y: w.y });
          // The spring constraint needs the clock running to move the body.
          if (!useWorkspaceStore.getState().playing) sim.togglePlay();
          return;
        }
      } else if (mode0 === 'select') {
        useSimStore.setState({ selected: null });
      }
      mode = 'pan';
    };

    const move = (e: PointerEvent) => {
      const { sx, sy } = local(e);
      const w = cam.toWorld(sx, sy);
      if (mode === 'pan') {
        cam.panPixels(sx - lastX, sy - lastY);
      } else if (mode === 'drag') {
        sim.input({ kind: 'dragMove', x: w.x, y: w.y });
      } else if (mode === 'measure' && measureRef.current) {
        measureRef.current = { ...measureRef.current, b: w };
      } else {
        const hit = pick(sx, sy);
        const draggable = hit && scene.bodies[hit.index]?.draggable;
        canvas.style.cursor = draggable
          ? 'grab'
          : toolRef.current === 'ruler' || toolRef.current === 'protractor'
            ? 'crosshair'
            : hit
              ? 'pointer'
              : 'default';
      }
      lastX = sx;
      lastY = sy;
    };

    const up = (e: PointerEvent) => {
      if (mode === 'drag') sim.input({ kind: 'dragEnd' });
      mode = 'none';
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };

    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const { sx, sy } = local(e);
      cam.zoomAt(sx, sy, Math.exp(-e.deltaY * 0.0015));
    };

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
    };
  }, [scene]);

  // Clear measurements when the tool changes away from measuring.
  useEffect(() => {
    if (tool !== 'ruler' && tool !== 'protractor') measureRef.current = null;
  }, [tool]);

  return (
    <canvas
      ref={canvasRef}
      className="stage__canvas"
      role="img"
      aria-label={t('stage.canvasLabel')}
      tabIndex={0}
    />
  );
}
