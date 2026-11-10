import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { readThemeColors } from '@/app/sim/themeColors';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { Camera } from '@/physics/render/camera';
import { drawGrid, polyline } from '@/physics/render/draw';
import { stillRun } from './stillRun';

/** When the page is idle (after the first paint), never blocking it. */
function whenIdle(run: () => void): () => void {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(run, { timeout: 2000 });
    return () => {
      window.cancelIdleCallback(id);
    };
  }
  const id = setTimeout(run, 200);
  return () => {
    clearTimeout(id);
  };
}

/** Once `el` is on screen (at once without IntersectionObserver), then `run`; cancels either. */
function whenSeen(el: Element | null, run: () => () => void): () => void {
  if (!el || !('IntersectionObserver' in window)) return run();
  let cancel: () => void = () => {
    /* nothing started yet */
  };
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    cancel = run();
  });
  io.observe(el);
  return () => {
    io.disconnect();
    cancel();
  };
}

/**
 * One static frame of a physics topic at its default values (docs/BENCH_DESIGN.md §9.1 "bench
 * still", §9.3 card previews): the scene's own engine and draw(), once, after the first paint,
 * no loop. Decorative (aria-hidden): the caption or the card says what it is. Draws nothing if
 * the run fails.
 */
export function SceneStill({
  topic,
  className,
  grid = true,
}: {
  topic: string;
  className?: string;
  /** The stage grid and its numbers (off for a card's small preview, where they would crowd). */
  grid?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const locale = useSettingsStore((s) => s.locale);
  const theme = useResolvedTheme();

  useEffect(() => {
    let live = true;
    // Only a card on screen runs its engine (a shelf has up to 16), when the page is idle.
    const cancel = whenSeen(ref.current, () =>
      whenIdle(() => {
        // No 2D canvas (tests, a lost context): no picture and no run.
        const ctx = ref.current?.getContext('2d');
        if (!ctx) return;
        void stillRun(topic).then((run) => {
          const canvas = ref.current;
          const state = run?.states.at(-1);
          if (!live || !run || !canvas || !state) return;
          const r = canvas.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) return;
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          canvas.width = Math.round(r.width * dpr);
          canvas.height = Math.round(r.height * dpr);
          const { scene } = run;
          const p = scene.defaults;
          const cam = new Camera();
          cam.resize(r.width, r.height);
          // The stage's 48 px margin would leave nothing of an 88 px preview.
          cam.fit(scene.view(p), Math.min(48, r.height * 0.1));
          const colors = readThemeColors();
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          if (grid) drawGrid(ctx, cam, colors, locale, scene.yStretch?.(p));
          if (scene.trail) {
            const tracks: { x: number; y: number }[][] = [];
            for (const s of run.states)
              scene.trail(s, p).forEach((pt, k) => (tracks[k] ??= []).push(pt));
            for (const tr of tracks) polyline(ctx, cam, tr, colors.accent, 1.6);
          }
          scene.draw({
            ctx,
            cam,
            state,
            p,
            opts: {
              vectors: false,
              trail: true,
              intervened: false,
              selected: null,
              locale,
              colors,
              time: 0,
            },
          });
        });
      }),
    );
    return () => {
      live = false;
      cancel();
    };
  }, [topic, locale, theme, grid]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
