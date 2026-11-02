import { effectiveTier, usePerfStore } from '@/perf/perfStore';
import type { QualityTier } from '@/perf/tiers';
import { parseHex, type Rgb } from '@/ui/three/color';
import { fmtQty } from '../common/tex';
import type { Camera } from '../render/camera';
import { circle, line, text } from '../render/draw';
import type { DrawContext, Params, WorldBounds } from '../types';
import { IF, MODE, interferenceInput, sourcesOf, type InterferenceInput } from './engine';
import { beatFrequency } from './model';

/**
 * Size (CSS px) of one picture cell per quality tier. The overload ladder lowers the tier, so a
 * slow computer gets a coarser water picture; the numbers are computed the same on every tier.
 */
export const CELL_PX: Record<QualityTier, number> = { high: 2, medium: 3, low: 4 };

/** Below this many cells per wavelength the picture would alias (fake fringes): not drawn. */
export const MIN_CELLS_PER_WAVELENGTH = 4;

/** Region shown: both sources, M and its mirror image, so the whole symmetric pattern shows. */
export function interferenceView(p: Params): WorldBounds {
  const q = interferenceInput(p);
  const d = q.d > 0 ? q.d : 0.1;
  const xs = [-d / 2, d / 2, q.m?.x ?? 0];
  const yMax = q.m?.y ?? 0;
  const w = Math.max(...xs) - Math.min(...xs);
  const half = Math.max(0.5 * d, 0.6 * Math.max(w, 2 * yMax));
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  return { xMin: cx - 1.3 * half, xMax: cx + 1.3 * half, yMin: -half, yMax: half };
}

/** Pick radius of a source or of M. */
export const pickRadius = (p: Params) => {
  const v = interferenceView(p);
  return 0.025 * (v.xMax - v.xMin);
};

const GREY: Rgb = [0.5, 0.5, 0.5];

let cache: { key: string; canvas: HTMLCanvasElement; img: ImageData } | undefined;

/**
 * Water surface as an image: each cell is coloured by u/(2a) at its centre, crest colour above
 * zero and trough colour below, alpha ∝ |u|, so calm lines show the stage. Drawn again only when
 * the time, the parameters, the view or the theme change. Returns false when the wavelength is
 * too small on screen for the cells (nothing drawn).
 */
export function drawWater(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  q: InterferenceInput,
  t: number,
  crest: string,
  trough: string,
): boolean {
  const cell = CELL_PX[effectiveTier(usePerfStore.getState())];
  if (Math.min(q.lambda1, q.lambda2) * cam.scale < MIN_CELLS_PER_WAVELENGTH * cell) return false;
  const nx = Math.ceil(cam.width / cell);
  const ny = Math.ceil(cam.height / cell);
  const o = cam.toWorld(0, 0);
  const key = [nx, ny, cell, cam.scale, o.x, o.y, t, q.d, q.f1, q.f2, q.v, crest, trough].join();
  if (cache?.key !== key) {
    const canvas = cache?.canvas ?? document.createElement('canvas');
    if (canvas.width !== nx || canvas.height !== ny) {
      canvas.width = nx;
      canvas.height = ny;
    }
    const octx = canvas.getContext('2d');
    if (!octx) return true;
    const img =
      cache && cache.img.width === nx && cache.img.height === ny
        ? cache.img
        : octx.createImageData(nx, ny);
    fillWater(img.data, nx, ny, o.x, o.y, cell / cam.scale, q, t, crest, trough);
    octx.putImageData(img, 0, 0);
    cache = { key, canvas, img };
  }
  ctx.drawImage(cache.canvas, 0, 0, nx * cell, ny * cell);
  return true;
}

/** RGBA of u/(2a) = ½[cos(ω₁t − k₁r₁) + cos(ω₂t − k₂r₂)] at the centre of every cell. */
export function fillWater(
  data: Uint8ClampedArray,
  nx: number,
  ny: number,
  x0: number,
  y0: number,
  step: number,
  q: InterferenceInput,
  t: number,
  crest: string,
  trough: string,
): void {
  const [s1, s2] = sourcesOf(q);
  const up = (parseHex(crest) ?? GREY).map((c) => Math.round(c * 255));
  const down = (parseHex(trough) ?? GREY).map((c) => Math.round(c * 255));
  const p1 = s1.omega * t;
  const p2 = s2.omega * t;
  for (let j = 0; j < ny; j++) {
    const y = y0 - (j + 0.5) * step;
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * step;
      const r1 = Math.sqrt((x - s1.x) ** 2 + y * y);
      const r2 = Math.sqrt((x - s2.x) ** 2 + y * y);
      const u = 0.5 * (Math.cos(p1 - s1.k * r1) + Math.cos(p2 - s2.k * r2));
      const c = u >= 0 ? up : down;
      const at = 4 * (j * nx + i);
      data[at] = c[0] ?? 128;
      data[at + 1] = c[1] ?? 128;
      data[at + 2] = c[2] ?? 128;
      data[at + 3] = Math.round(204 * Math.abs(u));
    }
  }
}

const SUB = ['₁', '₂'];

export function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const q = interferenceInput(p);
  const c = opts.colors;
  const vi = opts.locale === 'vi';
  const t = state[IF.t] ?? 0;
  const drawn = drawWater(ctx, cam, q, t, c.velocity, c.acceleration);

  const h = q.d / 2;
  line(ctx, cam, -h, 0, h, 0, c.muted, 1, [4, 4]);
  // Maxima on S₁S₂ (x = kλ/2, |k| < d/λ) when the pattern stands still and the marks fit.
  if (q.mode === MODE.same && (q.lambda1 / 2) * cam.scale >= 6) {
    const n = Math.ceil(q.d / q.lambda1);
    for (let k = -n; k <= n; k++) {
      const x = (k * q.lambda1) / 2;
      if (Math.abs(x) < h * (1 - 1e-9)) circle(ctx, cam, x, 0, 0, c.text, undefined, 2.5);
    }
  }
  if (q.m) {
    line(ctx, cam, q.m.x, q.m.y, -h, 0, c.faint, 1, [3, 4]);
    line(ctx, cam, q.m.x, q.m.y, h, 0, c.faint, 1, [3, 4]);
    circle(ctx, cam, q.m.x, q.m.y, 0, opts.selected === 'M' ? c.accent : c.bodyAlt, c.text, 6);
    text(ctx, cam, q.m.x, q.m.y, 'M', c.text, 'left', { x: 9, y: -9 });
  }
  [-h, h].forEach((x, i) => {
    const id = `S${String(i + 1)}`;
    circle(ctx, cam, x, 0, 0, opts.selected === id ? c.accent : c.body, c.text, 7);
    text(ctx, cam, x, 0, `S${SUB[i] ?? ''}`, c.text, 'center', { x: 0, y: 24 });
  });

  const b = cam.visible();
  const Q = (v: number, u: string) => fmtQty(opts.locale, v, u);
  const header =
    q.mode === MODE.beats
      ? `f₁ = ${Q(q.f1, 'Hz')},  f₂ = ${Q(q.f2, 'Hz')},  f${vi ? '_phách' : '_beat'} = ${Q(beatFrequency(q.f1, q.f2), 'Hz')},  S₁S₂ = ${Q(q.d, 'cm')}`
      : `f = ${Q(q.f1, 'Hz')},  v = ${Q(q.v, 'cm/s')},  λ = ${Q(q.lambda1, 'cm')},  S₁S₂ = ${Q(q.d, 'cm')}`;
  const rows = [
    header,
    vi
      ? 'Màu: li độ mặt nước — xanh: nhô lên (u > 0), cam: lõm xuống (u < 0)'
      : 'Colour: water displacement — blue: raised (u > 0), orange: lowered (u < 0)',
  ];
  if (!drawn)
    rows.push(
      vi
        ? 'Bước sóng nhỏ hơn độ mịn của hình: phóng to (con lăn chuột) để thấy mặt nước'
        : 'The wavelength is smaller than the picture’s cells: zoom in (mouse wheel) to see the water',
    );
  rows.forEach((r, i) => {
    text(ctx, cam, b.xMin, b.yMax, r, c.muted, 'left', { x: 60, y: 18 * (i + 1) });
  });
}
