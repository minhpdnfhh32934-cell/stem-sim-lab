import { DASH } from '../common/scene-helpers';
import { fmtQty } from '../common/tex';
import { arrow, block, circle, line, polyline, text } from '../render/draw';
import type { DrawContext } from '../types';
import { TW } from './engine';
import { KIND, displacement, isValid, travelInput, wavelength, type Travel } from './model';

/** Most wavelengths drawn at once (the picture keeps ~48 points per wavelength). */
const MAX_WAVES = 12;

/** Length of Ox drawn: three wavelengths, or up to M (≤ 12 λ) when it is further out. */
export function viewLength(q: Travel): number {
  if (!isValid(q)) return 12;
  const lam = wavelength(q);
  return Math.max(3 * lam, Math.min(1.15 * q.xM, MAX_WAVES * lam));
}

/** 1, 2, 5 × 10ⁿ ≥ 1 that makes `raw` a round factor. */
function nice(raw: number): number {
  if (!(raw > 1) || !Number.isFinite(raw)) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
}

/**
 * Transverse wave: the picture's vertical stretch so the crests reach ~8 % of the drawn length
 * (graphs and numbers are never stretched; the grid shows true metres).
 */
export const verticalScale = (q: Travel) =>
  q.kind === KIND.transverse && isValid(q) ? nice((0.08 * viewLength(q)) / q.A) : 1;

/**
 * Longitudinal wave: how many times the layers' shifts along Ox are enlarged so the compressions
 * show, keeping k·A·S ≤ 0,6: two neighbouring layers never pass each other.
 */
export function shiftScale(q: Travel): number {
  if (q.kind !== KIND.longitudinal || !isValid(q)) return 1;
  const kA = (2 * Math.PI * q.A) / wavelength(q);
  return kA >= 0.6 ? 1 : nice(0.6 / kA);
}

/**
 * The point `offset + nλ` behind the front (n = 0, 1, 2…) nearest to it but inside the drawn
 * length: points the same phase apart from the front repeat every wavelength.
 */
export function lastBehind(front: number, lam: number, offset: number, length: number): number {
  const first = front - offset;
  return first <= length ? first : first - Math.ceil((first - length) / lam) * lam;
}

/** Height of the drawn longitudinal medium (world m), centred on Ox. */
export const bandHeight = (q: Travel) => 0.1 * viewLength(q);

/** Where the picture draws the part whose equilibrium is x (world m). */
export function drawnAt(q: Travel, x: number, u: number) {
  return q.kind === KIND.transverse
    ? { x, y: u * verticalScale(q) }
    : { x: x + u * shiftScale(q), y: 0 };
}

export function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const q = travelInput(p);
  if (!isValid(q)) return;
  const Lv = viewLength(q);
  const lam = wavelength(q);
  // The state's own instant (front = v·t), so a scrubbed or replayed frame draws its wave.
  const xf = state[TW.front] ?? 0;
  const t = xf / q.v;
  const n = Math.max(241, Math.ceil((48 * Lv) / lam));
  const xs = Array.from({ length: n }, (_, i) => (i * Lv) / (n - 1));
  const u = (x: number) => displacement(q, x, t);
  const S = verticalScale(q);
  const H = q.kind === KIND.transverse ? 1.25 * q.A * S : bandHeight(q) / 2;

  if (q.kind === KIND.transverse) {
    line(ctx, cam, 0, 0, Lv, 0, c.faint, 1, [5, 5]);
    polyline(
      ctx,
      cam,
      xs.map((x) => ({ x, y: S * u(x) })),
      c.spring,
      3,
    );
    // Parts of the medium every λ/8: each only goes up and down at its own x.
    const dots = Math.min(8 * MAX_WAVES, Math.floor((8 * Lv) / lam));
    for (let j = 0; j <= dots; j++) {
      const x = (j * lam) / 8;
      circle(ctx, cam, x, S * u(x), Lv / 260, c.body, undefined, 3);
    }
    // λ between two neighbouring crests behind the front (Hình 8.3), the last pair on screen.
    const c2 = lastBehind(xf, lam, lam / 4, Lv);
    const c1 = c2 - lam;
    if (c1 >= 0) {
      const y = 1.25 * q.A * S;
      line(ctx, cam, c1, y, c2, y, c.accent, 1.2);
      for (const x of [c1, c2]) line(ctx, cam, x, y - 0.012 * Lv, x, y + 0.012 * Lv, c.accent, 1.2);
      text(ctx, cam, (c1 + c2) / 2, y, 'λ', c.accent, 'center', { x: 0, y: -4 });
    }
  } else {
    // Layers of the medium every λ/16, each shifted along Ox by its displacement (Hình 9.3).
    const layers = Math.min(16 * MAX_WAVES, Math.floor((16 * Lv) / lam));
    const sl = shiftScale(q);
    for (let j = 0; j <= layers; j++) {
      const x0 = (j * lam) / 16;
      const x = x0 + sl * u(x0);
      line(ctx, cam, x, -H, x, H, c.spring, 1.5);
    }
    // A compression (phase 2πn behind the front) and the rarefaction half a wave after it.
    const thin = lastBehind(xf, lam, lam / 2, Lv);
    const press = thin - lam / 2;
    if (press >= 0) {
      const pl = opts.locale === 'vi';
      text(ctx, cam, press, -H, pl ? 'Nén' : 'Compression', c.text, 'center', { x: 0, y: 18 });
      text(ctx, cam, thin, -H, pl ? 'Dãn' : 'Rarefaction', c.text, 'center', { x: 0, y: 18 });
    }
  }

  // The source O, shaking the medium.
  const o = drawnAt(q, 0, state[TW.uO] ?? 0);
  block(ctx, cam, o.x - 0.02 * Lv, o.y, 0.03 * Lv, 0.06 * Lv, 0, c.ground, c.text);
  text(ctx, cam, 0, -H, 'O', c.text, 'center', { x: 0, y: 36 });

  // M: its swing range, and the part itself.
  const m = drawnAt(q, q.xM, state[TW.uM] ?? 0);
  if (q.xM <= Lv) {
    if (q.kind === KIND.transverse)
      line(ctx, cam, q.xM, -q.A * S, q.xM, q.A * S, c.accent, 1, [2, 3]);
    else {
      const sl = shiftScale(q);
      line(ctx, cam, q.xM - q.A * sl, H * 1.15, q.xM + q.A * sl, H * 1.15, c.accent, 1, [2, 3]);
      line(ctx, cam, q.xM, H * 1.05, q.xM, H * 1.25, c.accent, 1);
    }
    circle(ctx, cam, m.x, m.y, Lv / 110, opts.selected === 'pointM' ? c.accent : c.bodyAlt, c.text);
    text(ctx, cam, m.x, Math.max(m.y, H), 'M', c.accent, 'center', { x: 10, y: -14 });
  } else
    text(ctx, cam, Lv, 0, `M → x = ${fmtQty(opts.locale, q.xM, 'm', 3)}`, c.accent, 'right', {
      x: 0,
      y: -10,
    });

  // The front: the wave has not reached anything to its right yet.
  if (xf > 0 && xf < Lv) {
    line(ctx, cam, xf, -H * 1.3, xf, H * 1.3, c.muted, 1, DASH);
    text(ctx, cam, xf, H * 1.3, opts.locale === 'vi' ? 'đầu sóng' : 'front', c.muted, 'center', {
      x: 0,
      y: -4,
    });
  }
  const yv = q.kind === KIND.transverse ? 1.6 * H : 3 * H;
  arrow(ctx, cam, 0.78 * Lv, yv, 0.12 * Lv, 0, c.velocity, 'v');

  const b = cam.visible();
  const header = `f = ${fmtQty(opts.locale, q.f, 'Hz')},  v = ${fmtQty(opts.locale, q.v, 'm/s')},  λ = ${fmtQty(opts.locale, lam, 'm')}`;
  text(ctx, cam, b.xMin, b.yMax, header, c.muted, 'left', { x: 60, y: 18 });
  const enlarged =
    q.kind === KIND.transverse
      ? S > 1
        ? opts.locale === 'vi'
          ? `Hình vẽ phóng to li độ ×${String(S)}`
          : `Displacement drawn ×${String(S)}`
        : ''
      : shiftScale(q) > 1
        ? opts.locale === 'vi'
          ? `Hình vẽ phóng to độ dời của các lớp ×${String(shiftScale(q))}`
          : `Layer shifts drawn ×${String(shiftScale(q))}`
        : '';
  if (enlarged) text(ctx, cam, b.xMin, b.yMax, enlarged, c.muted, 'left', { x: 60, y: 36 });
}
