/**
 * AI Teacher's orb on the page (#234 step 2). The drawing runs in its own animation loop, outside
 * React: no store is written per frame, so it never holds back React's other work (the lesson of
 * #228). On Low quality, without WebGL 2 or after a lost context the light SVG rings (`fallback`)
 * show instead; with reduced motion the orb is drawn once and stays still. Everything is freed
 * when the page goes.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { effectiveTier, usePerfStore } from '@/perf/perfStore';
import { webgl2Available } from '@/ui/three/availability';
import { prefersReducedMotion, useFrameLoop } from '@/ui/three/loop';
import { webglRenderer, type RendererFactory, type RendererLike } from '@/ui/three/renderer';
import { buildOrbScene, type OrbColors, type OrbScene } from './orbScene';
import {
  ORB_STATES,
  TRANSITION_MS,
  orbPicture,
  paramsAt,
  still,
  type OrbParams,
  type OrbState,
} from './states';

/** A settled, waiting orb is drawn at most this often (ms): it barely moves. */
const IDLE_FRAME_MS = 50;

/** The orb's colours from the theme tokens (the bench sets `--teacher-*`; else the accent). */
function themeColors(theme: 'light' | 'dark'): OrbColors {
  const css = getComputedStyle(document.documentElement);
  const read = (name: string, or: string) => css.getPropertyValue(name).trim() || or;
  const accent = read('--teacher-accent', read('--accent', '#0a6b66'));
  return { accent, line: read('--teacher-line', accent), glow: theme === 'dark' };
}

interface Drawn {
  orb: OrbScene;
  renderer: RendererLike;
}

/** Read-only hooks for end-to-end tests (dev builds only). */
export interface OrbDebug {
  picture: string;
  points: number;
  pairs: number;
  frames: number;
}

export function OrbView({
  state,
  fallback,
  createRenderer = webglRenderer,
}: {
  state: OrbState;
  /** The SVG rings, shown when the orb cannot be drawn. */
  fallback: ReactNode;
  createRenderer?: RendererFactory;
}) {
  const tier = usePerfStore(effectiveTier);
  const theme = useResolvedTheme();
  const [lost, setLost] = useState(false);
  const picture = orbPicture({
    tier,
    webgl2: webgl2Available(),
    contextLost: lost,
    reducedMotion: prefersReducedMotion(),
  });
  const hostRef = useRef<HTMLDivElement>(null);
  const drawn = useRef<Drawn | null>(null);
  // The colours a new orb starts with (a theme change recolours it without rebuilding it).
  const themeRef = useRef(theme);
  useLayoutEffect(() => {
    themeRef.current = theme;
  });
  const frames = useRef(0);
  // The change in progress: from the parameters shown when it began to the new state's.
  const motion = useRef({
    from: ORB_STATES[state],
    to: ORB_STATES[state],
    since: 0,
    last: 0,
    pending: 0,
  });

  /** Draws one frame `dt` seconds on (the reduced-motion picture: once, still). */
  const drawRef = useRef((dt: number, params: OrbParams) => {
    const d = drawn.current;
    if (!d) return;
    d.orb.update(dt, params, 0);
    d.renderer.render(d.orb.scene, d.orb.camera);
    frames.current += 1;
  });
  const drawStill = () => {
    const m = motion.current;
    drawRef.current(0, still(m.to));
  };

  // A new state: ease from what is shown now.
  useLayoutEffect(() => {
    const m = motion.current;
    const now = performance.now();
    m.from = paramsAt(m.from, m.to, now - m.since);
    m.to = ORB_STATES[state];
    m.since = now;
    if (picture === 'still') drawStill();
  }, [state, picture]);

  useEffect(() => {
    if (picture === 'rings') return;
    const host = hostRef.current;
    if (!host) return;
    let renderer: RendererLike;
    try {
      renderer = createRenderer({ antialias: tier === 'high' });
    } catch {
      // No renderer (no WebGL): the rings, from the next render on.
      queueMicrotask(() => {
        setLost(true);
      });
      return;
    }
    const canvas = renderer.domElement;
    canvas.className = 'teacher-orb__canvas';
    host.append(canvas);
    const orb = buildOrbScene(tier === 'high' ? 'high' : 'medium', themeColors(themeRef.current));
    drawn.current = { orb, renderer };
    const onLost = (e: Event) => {
      e.preventDefault();
      setLost(true);
    };
    canvas.addEventListener('webglcontextlost', onLost);
    const fit = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(w, h);
      orb.setAspect(w / h);
      if (picture === 'still') drawStill();
    };
    fit();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    ro?.observe(host);
    const undebug = import.meta.env.DEV ? registerDebug(() => ({ picture, orb, frames })) : null;
    return () => {
      undebug?.();
      ro?.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      drawn.current = null;
      orb.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
    };
  }, [picture, tier, createRenderer]);

  // The theme changed: the orb takes its colours again.
  useEffect(() => {
    drawn.current?.orb.setColors(themeColors(theme));
    if (picture === 'still') drawStill();
  }, [theme, picture]);

  useFrameLoop(picture === 'orb', (dt) => {
    const m = motion.current;
    const now = performance.now();
    m.pending += dt;
    const settled = state === 'idle' && now - m.since > TRANSITION_MS;
    if (settled && now - m.last < IDLE_FRAME_MS) return;
    drawRef.current(m.pending, paramsAt(m.from, m.to, now - m.since));
    m.pending = 0;
    m.last = now;
  });

  if (picture === 'rings') return <>{fallback}</>;
  return <div ref={hostRef} className="teacher-orb" data-picture={picture} aria-hidden="true" />;
}

function registerDebug(
  read: () => { picture: string; orb: OrbScene; frames: { current: number } },
): () => void {
  const w = window as unknown as { __simlabOrb?: () => OrbDebug };
  w.__simlabOrb = () => {
    const { picture, orb, frames } = read();
    return { picture, points: orb.points, pairs: orb.pairs, frames: frames.current };
  };
  return () => {
    delete w.__simlabOrb;
  };
}
