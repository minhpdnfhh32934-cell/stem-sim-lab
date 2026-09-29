import { useEffect, useRef } from 'react';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { useTierConfig } from '@/perf/perfStore';

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  /** Size in CSS pixels. */
  width: number;
  height: number;
  /** Seconds since the canvas started (0 when motion is reduced or not animated). */
  time: number;
  /** Reads a CSS custom property (theme token). */
  css: (name: string) => string;
}

/**
 * A 2D canvas that fills its parent, handles device-pixel ratio and resizes, and redraws
 * on theme changes. With `animate`, it redraws every frame (paused when the tab is hidden
 * and frozen when the user prefers reduced motion).
 */
export function useCanvas(draw: (d: DrawContext) => void, animate: boolean, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  const theme = useResolvedTheme();
  const tier = useTierConfig();

  useEffect(() => {
    drawRef.current = draw;
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cs = getComputedStyle(document.documentElement);
    const css = (name: string) => cs.getPropertyValue(name).trim();
    const start = performance.now();
    let raf = 0;
    const render = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, tier.pixelRatioCap);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawRef.current({
        ctx,
        width: w,
        height: h,
        time: animate && !reduce ? (performance.now() - start) / 1000 : 0,
        css,
      });
    };
    const loop = () => {
      if (document.visibilityState === 'visible') render();
      raf = requestAnimationFrame(loop);
    };
    if (animate && !reduce) raf = requestAnimationFrame(loop);
    else render();
    const ro = new ResizeObserver(render);
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, theme, tier.pixelRatioCap, ...deps]);

  return ref;
}
