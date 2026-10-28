import type { Locale } from '@/app/i18n/types';
import { dopri5 } from '@/core/ode/dopri5';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { L, gravityParam, massParam } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import { arrow, circle, line, polygon, polyline, text, vectorScale } from '../render/draw';
import type {
  Answer,
  DrawContext,
  GraphDef,
  Params,
  PhysicsScene,
  Solution,
  SolutionStep,
  WorldBounds,
} from '../types';
import { TS, startX, trackFor } from './engine';
import { speedAt, trackAccel, type Track } from './model';

function sample(tr: Track, n = 200) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = tr.xMin + ((tr.xMax - tr.xMin) * i) / n;
    pts.push({ x, y: tr.f(x) });
  }
  return pts;
}

/** Lowest point of the track (dense sampling, then golden-section refinement). */
export function lowestPoint(tr: Track): { x: number; y: number } {
  const pts = sample(tr, 2000);
  let best = pts[0] ?? { x: 0, y: 0 };
  for (const p of pts) if (p.y < best.y) best = p;
  let a = best.x - (tr.xMax - tr.xMin) / 2000;
  let b = best.x + (tr.xMax - tr.xMin) / 2000;
  const phi = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 80; i++) {
    const c = b - phi * (b - a);
    const d = a + phi * (b - a);
    if (tr.f(c) < tr.f(d)) b = d;
    else a = c;
  }
  const x = (a + b) / 2;
  return { x, y: tr.f(x) };
}

/**
 * The highest point a bead leaving x0 in direction `dir` must climb over before reaching
 * the end of the track, or null when the track only goes down that way. The descent from
 * the start is skipped (a bead moving away from a peak is not blocked by it); the maximum
 * of the rest is found on a fine grid and refined by golden-section search.
 */
export function barrierAhead(
  tr: Track,
  x0: number,
  dir: 1 | -1,
  n = 4000,
): { x: number; y: number } | null {
  const h = ((dir > 0 ? tr.xMax : tr.xMin) - x0) / n;
  if (!(Math.abs(h) > 0)) return null;
  const at = (i: number) => x0 + i * h;
  let i = 0;
  while (i < n && tr.f(at(i + 1)) <= tr.f(at(i))) i++;
  if (i >= n) return null;
  let best = i;
  for (let j = i + 1; j <= n; j++) if (tr.f(at(j)) > tr.f(at(best))) best = j;
  let lo = at(Math.max(i, best - 1));
  let hi = at(Math.min(n, best + 1));
  if (lo > hi) [lo, hi] = [hi, lo];
  const phi = (Math.sqrt(5) - 1) / 2;
  for (let k = 0; k < 80; k++) {
    const c = hi - phi * (hi - lo);
    const d = lo + phi * (hi - lo);
    if (tr.f(c) > tr.f(d)) hi = d;
    else lo = c;
  }
  const xm = (lo + hi) / 2;
  const xb = tr.f(xm) >= tr.f(at(best)) ? xm : at(best);
  return { x: xb, y: tr.f(xb) };
}

type HillVerdict =
  | { kind: 'exitLeft' | 'none' | 'rest' }
  | { kind: 'over' | 'back'; peak: { x: number; y: number } };

/**
 * Does a bead released at x0 with signed velocity v0 (energy level hMax) get over the
 * hills to its right? It first moves in the direction of v0 (downhill when v0 = 0). Moving
 * left, it either runs off the left end or is turned back and returns through x0 with the
 * same speed; then the highest point ahead on the right decides.
 */
function hillVerdict(tr: Track, x0: number, v0: number, hMax: number): HillVerdict {
  const dir = Math.sign(v0) || -Math.sign(tr.df(x0));
  if (dir === 0) return { kind: 'rest' };
  if (dir < 0) {
    const left = barrierAhead(tr, x0, -1);
    if (left === null || hMax > left.y) return { kind: 'exitLeft' };
  }
  const right = barrierAhead(tr, x0, 1);
  if (right === null) return { kind: 'none' };
  return { kind: hMax > right.y ? 'over' : 'back', peak: right };
}

function view(p: Params): WorldBounds {
  const tr = trackFor(p);
  const ys = sample(tr).map((q) => q.y);
  const top = Math.max(...ys);
  const span = tr.xMax - tr.xMin;
  return {
    xMin: tr.xMin - 0.05 * span,
    xMax: tr.xMax + 0.05 * span,
    yMin: -0.25 * top - 0.3,
    yMax: top * 1.45 + 0.3,
  };
}

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const tr = trackFor(p);
  const pts = sample(tr);
  polygon(ctx, cam, [{ x: tr.xMin, y: -10 }, ...pts, { x: tr.xMax, y: -10 }], c.panel);
  polyline(ctx, cam, pts, c.ground, 2.5);
  const g = p.g ?? 9.81;
  const m = p.m ?? 1;
  const x0 = startX(p);
  const y0 = tr.f(x0);
  const v0 = p.v0 ?? 0;
  // Energy level line: the highest point reachable (v = 0).
  const Eh = y0 + (v0 * v0) / (2 * g);
  line(ctx, cam, tr.xMin, Eh, tr.xMax, Eh, c.faint, 1, [6, 5]);
  // Ends left of the energy bars (drawn below in the right part of the stage), never under them.
  const vis = cam.visible();
  const baseX = vis.xMax - 0.16 * (vis.xMax - vis.xMin);
  text(
    ctx,
    cam,
    Math.min(tr.xMax, baseX),
    Eh,
    opts.locale === 'vi' ? 'mức cơ năng' : 'energy level',
    c.muted,
    'right',
    { x: -8, y: -4 },
  );
  const x = state[TS.x] ?? 0;
  const y = state[TS.y] ?? 0;
  const r = 0.025 * (tr.xMax - tr.xMin);
  // Bead sits on top of the track: offset along the normal.
  const d = tr.df(x);
  const nx = -d / Math.sqrt(1 + d * d);
  const ny = 1 / Math.sqrt(1 + d * d);
  const bx = x + nx * r;
  const by = y + ny * r;
  circle(ctx, cam, bx, by, r, opts.selected === 'bead' ? c.accent : c.body, c.text, 6);
  if (opts.vectors) {
    const v = state[TS.v] ?? 0;
    const tx = 1 / Math.sqrt(1 + d * d);
    const ty = d / Math.sqrt(1 + d * d);
    const vref = Math.sqrt(v0 * v0 + 2 * g * Math.max(Eh - lowestPoint(tr).y, 0.1));
    const k = vectorScale(vref, tr.xMax - tr.xMin, 0.15);
    arrow(
      ctx,
      cam,
      bx,
      by,
      v * tx * k * Math.sign(tx),
      v * ty * k * Math.sign(tx),
      c.velocity,
      'v',
    );
  }
  // Energy bars (Wđ, Wt, W) — the key idea of this topic.
  const E = m * g * Eh;
  const K = 0.5 * m * (state[TS.v] ?? 0) ** 2;
  const U = m * g * y;
  const barW = 0.03 * (vis.xMax - vis.xMin);
  // Top-right corner (baseX), below the HUD, away from the floating tool bar.
  const baseY = vis.yMax - 0.5 * (vis.yMax - vis.yMin);
  const H = 0.3 * (vis.yMax - vis.yMin);
  const bars: [string, number, string][] = [
    [opts.locale === 'vi' ? 'W_đ' : 'K', K, c.velocity],
    [opts.locale === 'vi' ? 'W_t' : 'U', U, c.acceleration],
    [opts.locale === 'vi' ? 'W' : 'E', K + U, c.force],
  ];
  bars.forEach(([name, val, col], i) => {
    const x1 = baseX + i * barW * 1.6;
    const h = E > 0 ? (Math.max(0, val) / E) * H : 0;
    polygon(
      ctx,
      cam,
      [
        { x: x1, y: baseY },
        { x: x1 + barW, y: baseY },
        { x: x1 + barW, y: baseY + h },
        { x: x1, y: baseY + h },
      ],
      col,
    );
    text(ctx, cam, x1 + barW / 2, baseY, name, c.text, 'center', { x: 0, y: 16 });
  });
  text(ctx, cam, baseX, baseY + H, `W = ${fmtQty(opts.locale, E, 'J')}`, c.muted, 'left', {
    x: 0,
    y: -6,
  });
}

const graphs: GraphDef[] = [
  {
    id: 'energy',
    title: L('Động năng, thế năng, cơ năng', 'Kinetic, potential and total energy'),
    yLabel: L('Năng lượng (J)', 'Energy (J)'),
    series: [
      { id: 'K', label: L('Wđ', 'K'), value: (s, p) => 0.5 * (p.m ?? 1) * (s[TS.v] ?? 0) ** 2 },
      {
        id: 'U',
        label: L('Wt', 'U'),
        value: (s, p) => (p.m ?? 1) * (p.g ?? 9.81) * (s[TS.y] ?? 0),
      },
      {
        id: 'E',
        label: L('W', 'E'),
        value: (s, p) =>
          0.5 * (p.m ?? 1) * (s[TS.v] ?? 0) ** 2 + (p.m ?? 1) * (p.g ?? 9.81) * (s[TS.y] ?? 0),
      },
    ],
  },
  {
    id: 'height',
    title: L('Độ cao và tốc độ', 'Height and speed'),
    yLabel: L('Giá trị (m; m/s)', 'Value (m; m/s)'),
    series: [
      { id: 'y', label: L('Độ cao y (m)', 'Height y (m)'), value: (s) => s[TS.y] ?? 0 },
      {
        id: 'v',
        label: L('Tốc độ v (m/s)', 'Speed v (m/s)'),
        value: (s) => Math.abs(s[TS.v] ?? 0),
      },
    ],
  },
];

/** Speed at the lowest point by integrating the constrained equation (DOPRI5, event x = x_low). */
export function numericLowSpeed(p: Params): number | null {
  const tr = trackFor(p);
  const low = lowestPoint(tr);
  const x0 = startX(p);
  const d0 = tr.df(x0);
  const g = p.g ?? 9.81;
  const xd0 = (p.v0 ?? 0) / Math.sqrt(1 + d0 * d0);
  if (Math.abs(x0 - low.x) < 1e-9) return null;
  const r = dopri5(
    (_t, y, d) => {
      d[0] = y[1] ?? 0;
      d[1] = trackAccel(tr, g, y[0] ?? 0, y[1] ?? 0);
    },
    [x0, xd0],
    0,
    60,
    {
      rtol: 1e-12,
      atol: 1e-13,
      events: [{ id: 'low', g: (_t, y) => (y[0] ?? 0) - low.x, terminal: true }],
    },
  );
  if (r.stoppedBy !== 'low') return null;
  const d = tr.df(r.y[0] ?? 0);
  return Math.abs((r.y[1] ?? 0) * Math.sqrt(1 + d * d));
}

function solve(p: Params, locale: Locale): Solution {
  const tr = trackFor(p);
  const g = p.g ?? 9.81;
  const m = p.m ?? 1;
  const n = (v: number) => texNum(locale, v);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const x0 = startX(p);
  const y0 = tr.f(x0);
  const v0 = Math.abs(p.v0 ?? 0);
  const low = lowestPoint(tr);
  const E = m * g * y0 + 0.5 * m * v0 * v0;
  const vLow = speedAt(g, y0, v0, low.y) ?? 0;
  const steps: SolutionStep[] = [
    {
      text: L(
        'Chọn mốc thế năng tại mặt đất (y = 0). Không có ma sát nên cơ năng bảo toàn:',
        'Take U = 0 at the ground (y = 0). Without friction, mechanical energy is conserved:',
      ),
      tex: `W = mgh_0 + \\tfrac{1}{2} m v_0^2 = ${n(m)}\\cdot ${n(g)}\\cdot ${n(y0)} + \\tfrac{1}{2}\\cdot ${n(m)}\\cdot ${n(v0)}^2 = ${Q(E, 'J')}`,
    },
    {
      text: L('Tại điểm thấp nhất của máng:', 'At the lowest point of the track:'),
      tex: `v = \\sqrt{v_0^2 + 2g(h_0 - h_{min})} = \\sqrt{${n(v0)}^2 + 2\\cdot ${n(g)}\\cdot(${n(y0)} - ${n(low.y)})} = ${Q(vLow, 'm/s')}`,
    },
    {
      text: L('Độ cao lớn nhất vật có thể đạt tới (v = 0):', 'Highest point reachable (v = 0):'),
      tex: `h_{max} = h_0 + \\frac{v_0^2}{2g} = ${Q(y0 + (v0 * v0) / (2 * g), 'm')}`,
    },
  ];
  const chk = numericLowSpeed(p);
  const answers: Answer[] = [
    { id: 'energy', label: L('Cơ năng', 'Mechanical energy'), value: E, unit: 'J' },
    {
      id: 'v_low',
      label: L('Tốc độ tại điểm thấp nhất', 'Speed at the lowest point'),
      value: vLow,
      unit: 'm/s',
      ...(chk !== null ? { check: chk } : {}),
    },
    {
      id: 'h_max',
      label: L('Độ cao cực đại đạt được', 'Maximum reachable height'),
      value: y0 + (v0 * v0) / (2 * g),
      unit: 'm',
    },
  ];
  if (Math.round(p.shape ?? 0) === 1) {
    const hMax = y0 + (v0 * v0) / (2 * g);
    const verdict = hillVerdict(tr, x0, p.v0 ?? 0, hMax);
    if (verdict.kind === 'exitLeft') {
      steps.push({
        text: L(
          'Vật đi sang trái và cao hơn mọi điểm phía bên trái nên trượt ra khỏi đầu trái của máng — không tới đồi thứ hai.',
          'The bead moves left and is above every point on that side, so it runs off the left end — it never reaches the second hill.',
        ),
      });
    } else if (verdict.kind === 'none') {
      steps.push({
        text: L(
          'Phía bên phải vị trí thả không còn đồi nào cao hơn: vật trượt tới cuối máng.',
          'There is no higher hill to the right of the release point: the bead slides to the end of the track.',
        ),
      });
    } else if (verdict.kind === 'over' || verdict.kind === 'back') {
      const passes = verdict.kind === 'over';
      const peak = verdict.peak;
      steps.push({
        text: passes
          ? L(
              'Mức cơ năng cao hơn đỉnh cao nhất vật phải vượt qua ở phía trước (đỉnh đồi thứ hai) nên vật vượt qua được.',
              'The energy level is above the highest point the bead must cross ahead (the top of the second hill), so it gets over.',
            )
          : L(
              'Mức cơ năng không cao hơn đỉnh cao nhất phía trước (đỉnh đồi thứ hai) nên vật không vượt qua, sẽ trượt ngược lại.',
              'The energy level is not above the highest point ahead (the top of the second hill), so the bead rolls back.',
            ),
        tex: `h_{max} = ${Q(hMax, 'm')}\\; ${passes ? '>' : '\\le'} \\; h_2 \\approx ${Q(peak.y, 'm')}\\quad (x \\approx ${Q(peak.x, 'm')})`,
      });
      const vTop = speedAt(g, y0, v0, peak.y);
      if (passes && vTop !== null) {
        answers.push({
          id: 'v_top2',
          label: L('Tốc độ tại đỉnh đồi thứ hai', 'Speed on top of the second hill'),
          value: vTop,
          unit: 'm/s',
        });
      }
    }
  }
  return { answers, steps };
}

function card(): ScienceCardData {
  return {
    title: L('Bảo toàn cơ năng', 'Conservation of mechanical energy'),
    model: L(
      'Vật nhỏ trượt không ma sát dọc một đường ray cố định (luôn bám ray), chỉ trọng lực sinh công.',
      'Small bead sliding without friction along a fixed rail (never leaves it); only gravity does work.',
    ),
    equations: [
      { tex: 'W = W_{\\text{đ}} + W_t = \\tfrac{1}{2}mv^2 + mgh = \\text{const}' },
      {
        tex: "\\ddot{x} = -\\frac{f'(x)\\,(g + f''(x)\\,\\dot{x}^2)}{1 + f'(x)^2}",
        label: L('Phương trình chuyển động trên ray y = f(x)', 'Equation of motion on y = f(x)'),
      },
    ],
    assumptions: [
      L(
        'Không ma sát, không lực cản; ray cứng, cố định.',
        'No friction or drag; rigid fixed rail.',
      ),
      L(
        'Vật là chất điểm, bỏ qua chuyển động quay (không lăn).',
        'Point mass, no rotation (not rolling).',
      ),
      L(
        'Phản lực của ray vuông góc với ray nên không sinh công.',
        'The rail’s normal force is perpendicular to the motion and does no work.',
      ),
    ],
    confidence: 'exact',
    confidenceNote: L(
      'Tốc độ tính từ bảo toàn cơ năng; kiểm chứng bằng tích phân Dormand–Prince phương trình chuyển động có ràng buộc.',
      'Speeds follow from energy conservation, cross-checked by Dormand–Prince integration of the constrained motion.',
    ),
    method: L(
      'RK4 với 8 bước con mỗi Δt = 1/240 s; độ trôi cơ năng được theo dõi liên tục.',
      'RK4 with 8 substeps per Δt = 1/240 s; energy drift is monitored continuously.',
    ),
    userIntervened: false,
    sources: [SRC.sgk10, SRC.halliday, SRC.hairer],
  };
}

export const energyConservation: PhysicsScene = {
  id: 'energyConservation',
  required: ['H'],
  engineId: 'phys.track',
  title: L('Bảo toàn cơ năng', 'Conservation of mechanical energy'),
  usesGravity: true,
  params: [
    {
      key: 'shape',
      label: L('Dạng đường ray', 'Track shape'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: 0, label: L('Máng parabol', 'Parabolic valley') },
        { value: 1, label: L('Hai ngọn đồi', 'Two hills') },
      ],
    },
    {
      key: 'H',
      label: L('Độ cao (đồi 1 / thành máng)', 'Height (hill 1 / rim)'),
      symbol: 'H',
      kind: 'number',
      dim: DIM.length,
      unit: 'm',
      min: 0.2,
      max: 20,
      step: 0.1,
    },
    {
      key: 'H2',
      label: L('Độ cao đồi 2', 'Height of hill 2'),
      symbol: 'H_2',
      kind: 'number',
      dim: DIM.length,
      unit: 'm',
      min: 0.1,
      max: 20,
      step: 0.1,
      when: (p) => Math.round(p.shape ?? 0) === 1,
    },
    {
      key: 'a',
      label: L('Nửa bề rộng', 'Half width'),
      symbol: 'a',
      kind: 'number',
      dim: DIM.length,
      unit: 'm',
      min: 0.5,
      max: 30,
      step: 0.1,
    },
    {
      key: 'x0',
      label: L('Vị trí thả (hoành độ)', 'Release position (x)'),
      symbol: 'x_0',
      kind: 'number',
      dim: DIM.length,
      unit: 'm',
      min: -40,
      max: 40,
      step: 0.1,
    },
    {
      key: 'v0',
      label: L('Tốc độ ban đầu (dọc ray)', 'Initial speed (along the rail)'),
      symbol: 'v_0',
      kind: 'number',
      dim: DIM.velocity,
      unit: 'm/s',
      min: -20,
      max: 20,
      step: 0.1,
    },
    massParam('m', 20),
    gravityParam,
  ],
  defaults: { shape: 1, H: 3, H2: 2, a: 4, w: 1.5, x0: -4, v0: 0.5, m: 1, g: 9.81 },
  validate: (p) => {
    const tr = trackFor(p);
    const x0 = startX(p);
    return x0 < tr.xMin || x0 > tr.xMax
      ? [L('Vị trí thả nằm ngoài đường ray.', 'The release position is outside the track.')]
      : [];
  },
  scienceCard: card,
  solve,
  graphs,
  bodies: [
    {
      id: 'bead',
      label: L('Vật', 'Bead'),
      position: (s) => ({ x: s[TS.x] ?? 0, y: s[TS.y] ?? 0 }),
      radius: (p) => 0.025 * (trackFor(p).xMax - trackFor(p).xMin),
      draggable: true,
      properties: (s, p) => [
        { label: L('Độ cao', 'Height'), symbol: 'h', value: s[TS.y] ?? 0, unit: 'm' },
        { label: L('Tốc độ', 'Speed'), symbol: 'v', value: Math.abs(s[TS.v] ?? 0), unit: 'm/s' },
        {
          label: L('Động năng', 'Kinetic energy'),
          symbol: 'W_{\\text{đ}}',
          value: 0.5 * (p.m ?? 1) * (s[TS.v] ?? 0) ** 2,
          unit: 'J',
        },
        {
          label: L('Thế năng', 'Potential energy'),
          symbol: 'W_t',
          value: (p.m ?? 1) * (p.g ?? 9.81) * (s[TS.y] ?? 0),
          unit: 'J',
        },
      ],
    },
  ],
  view,
  draw,
  trail: (s) => [{ x: s[TS.x] ?? 0, y: s[TS.y] ?? 0 }],
};
