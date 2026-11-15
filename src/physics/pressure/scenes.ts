import { formatNumber } from '@/app/i18n';
import type { Locale } from '@/app/i18n/types';
import { dopri5 } from '@/core/ode/dopri5';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { DASH, L, gravityParam } from '../common/scene-helpers';
import { SRC, sgk10 } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import { arrow, circle, ground, line, polygon, text } from '../render/draw';
import type {
  Answer,
  BodyDef,
  DrawContext,
  GraphDef,
  Params,
  PhysicsScene,
  Solution,
  WorldBounds,
} from '../types';
import { PR } from './engine';
import { ATM, WATER_RHO, column, liquidPart, totalPressure, type Column } from './model';

/**
 * Independent check: integrates dp/dh = ρg from the surface (p = pₐ) down to the point, the way
 * the pressure builds up layer by layer.
 */
export function numericPressure(q: Column): number {
  if (q.h <= 0) return q.pa;
  const f = (_h: number, _y: Float64Array, dy: Float64Array) => {
    dy[0] = q.rho * q.g;
  };
  return dopri5(f, [q.pa], 0, q.h, { rtol: 1e-12, atol: 1e-9 }).y[0] ?? NaN;
}

/** The drawn liquid is deeper than the point, so the probe never sits on the bottom. */
const liquidDepth = (q: Column) => Math.max(1.25 * q.h, 1);

function view(p: Params): WorldBounds {
  const D = liquidDepth(column(p));
  return { xMin: -0.9 * D, xMax: 0.9 * D, yMin: -0.12 * D, yMax: 1.3 * D };
}

const probe: BodyDef = {
  id: 'probe',
  label: L('Đầu đo áp suất', 'Pressure probe'),
  position: (s, p) => ({ x: 0, y: liquidDepth(column(p)) - (s[PR.d] ?? 0) }),
  radius: (p) => 0.035 * liquidDepth(column(p)),
  draggable: false,
  properties: (s) => [
    { label: L('Độ sâu', 'Depth'), symbol: 'h', value: s[PR.d] ?? 0, unit: 'm' },
    {
      label: L('Áp suất do chất lỏng', 'Pressure from the liquid'),
      symbol: '\\rho g h',
      value: s[PR.pl] ?? 0,
      unit: 'kPa',
    },
    {
      label: L('Áp suất toàn phần', 'Total pressure'),
      symbol: 'p',
      value: s[PR.p] ?? 0,
      unit: 'kPa',
    },
  ],
};

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const q = column(p);
  const vis = cam.visible();
  const D = liquidDepth(q);
  const w = 0.4 * D;
  ground(ctx, cam, 0, c);
  // Liquid, then the open glass vessel around it.
  ctx.save();
  ctx.globalAlpha = 0.14;
  polygon(
    ctx,
    cam,
    [
      { x: -w, y: 0 },
      { x: w, y: 0 },
      { x: w, y: D },
      { x: -w, y: D },
    ],
    c.velocity,
  );
  ctx.restore();
  line(ctx, cam, -w, D, w, D, c.velocity, 2);
  line(ctx, cam, -w, 0, -w, 1.12 * D, c.muted, 1.5);
  line(ctx, cam, w, 0, w, 1.12 * D, c.muted, 1.5);
  text(ctx, cam, -w, D, `pₐ = ${fmtQty(opts.locale, q.pa, 'kPa', 4)}`, c.muted, 'left', {
    x: 4,
    y: -6,
  });
  const d = state[PR.d] ?? 0;
  const y = D - d;
  const R = 0.035 * D;
  // Depth below the surface, beside the vessel.
  const xr = w + 0.12 * D;
  line(ctx, cam, xr, D, xr, y, c.text, 1.2, DASH);
  line(ctx, cam, xr - 0.03 * D, y, xr + 0.03 * D, y, c.text, 1.2);
  text(ctx, cam, xr, (D + y) / 2, `h = ${fmtQty(opts.locale, d, 'm', 3)}`, c.text, 'left', {
    x: 6,
    y: 6,
  });
  if (opts.vectors && d > 0) {
    // At a point the liquid pushes equally in every direction.
    const k = 0.1 * D;
    for (const [ux, uy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const)
      arrow(ctx, cam, (R + k) * ux, y + (R + k) * uy, -k * ux, -k * uy, c.force);
  }
  circle(ctx, cam, 0, y, R, opts.selected === 'probe' ? c.accent : c.body, c.text, 5);
  const pl = state[PR.pl] ?? 0;
  const pt = state[PR.p] ?? 0;
  text(
    ctx,
    cam,
    vis.xMin,
    vis.yMax,
    `p = ${fmtQty(opts.locale, pt, 'kPa', 4)}   ρgh = ${fmtQty(opts.locale, pl, 'kPa', 4)}`,
    c.muted,
    'left',
    { x: 60, y: 20 },
  );
}

const graphs: GraphDef[] = [
  {
    id: 'depth',
    title: L('Áp suất theo độ sâu', 'Pressure against depth'),
    yLabel: L('p (Pa)', 'p (Pa)'),
    x: { label: L('h (m)', 'h (m)'), value: (s) => s[PR.d] ?? 0 },
    series: [
      { id: 'p', label: L('Áp suất toàn phần', 'Total pressure'), value: (s) => s[PR.p] ?? 0 },
      {
        id: 'pl',
        label: L('Áp suất do chất lỏng', 'Pressure from the liquid'),
        value: (s) => s[PR.pl] ?? 0,
      },
    ],
  },
];

function solve(p: Params, locale: Locale): Solution {
  const q = column(p);
  const n = (v: number) => texNum(locale, v);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const pl = liquidPart(q);
  const pt = totalPressure(q);
  const chk = numericPressure(q);
  const answers: Answer[] = [
    {
      id: 'pl',
      label: L('Áp suất do chất lỏng gây ra', 'Pressure caused by the liquid'),
      value: pl,
      unit: 'kPa',
      check: chk - q.pa,
    },
    {
      id: 'p',
      label: L('Áp suất toàn phần tại điểm', 'Total pressure at the point'),
      value: pt,
      unit: 'kPa',
      check: chk,
    },
  ];
  const steps = [
    {
      text: L(
        'Áp suất do chất lỏng gây ra bằng trọng lượng cột chất lỏng phía trên điểm đó, chia cho diện tích đáy cột:',
        'The pressure caused by the liquid is the weight of the liquid column above the point, divided by the column’s base area:',
      ),
      tex: `\\rho g h = ${n(q.rho)}\\cdot ${n(q.g)}\\cdot ${n(q.h)} = ${Q(pl, 'kPa')}`,
    },
    {
      text: L(
        'Cộng áp suất khí quyển đè lên mặt thoáng:',
        'Add the air pressure pressing on the open surface:',
      ),
      tex: `p = p_a + \\rho g h = ${Q(q.pa, 'kPa')} + ${Q(pl, 'kPa')} = ${Q(pt, 'kPa')}`,
    },
  ];
  const perAtm = ATM / (q.rho * q.g);
  const fmt = (v: number) => formatNumber(locale, Number(v.toPrecision(3)));
  const notes = [
    L(
      `Cứ xuống sâu thêm ${fmt(perAtm)} m trong chất lỏng này, áp suất tăng thêm 1 atm. Áp suất chỉ phụ thuộc độ sâu, không phụ thuộc hình dạng bình.`,
      `Every ${fmt(perAtm)} m deeper in this liquid adds 1 atm. The pressure depends only on the depth, not on the shape of the vessel.`,
    ),
  ];
  return { answers, steps, notes };
}

function card(): ScienceCardData {
  const rho = (loc: Locale) => formatNumber(loc, WATER_RHO);
  const atm = (loc: Locale) => fmtQty(loc, ATM, 'kPa', 6);
  return {
    title: L('Khối lượng riêng. Áp suất chất lỏng', 'Density. Liquid pressure'),
    model: L(
      'Một điểm ở độ sâu h trong chất lỏng đứng yên, đựng trong bình hở. Áp suất tại điểm đó gồm áp suất khí quyển trên mặt thoáng và áp suất do trọng lượng cột chất lỏng phía trên gây ra.',
      'A point at depth h in a liquid at rest in an open vessel. The pressure there is the air pressure on the open surface plus the pressure caused by the weight of the liquid above it.',
    ),
    equations: [
      { tex: '\\rho = \\frac{m}{V}', label: L('Khối lượng riêng', 'Density') },
      // SGK Vật lí 10 KNTT (34.2), tr. 132: the pressing force F_N over the area S.
      {
        tex: { vi: 'p = \\frac{F_N}{S}', en: 'p = \\frac{F}{A}' },
        label: L('Áp suất', 'Pressure'),
      },
      { tex: 'p = p_a + \\rho g h', label: L('Áp suất ở độ sâu h', 'Pressure at depth h') },
      {
        tex: '\\Delta p = \\rho g\\,\\Delta h',
        label: L('Hai điểm chênh nhau Δh', 'Two points Δh apart'),
      },
    ],
    assumptions: [
      L(
        'Chất lỏng đứng yên, không nén được: khối lượng riêng như nhau ở mọi độ sâu.',
        'The liquid is at rest and incompressible: the same density at every depth.',
      ),
      L(
        'Gia tốc trọng trường như nhau trong cả bình; mặt thoáng chịu áp suất khí quyển pₐ.',
        'Gravity is the same throughout the vessel; the open surface carries the air pressure pₐ.',
      ),
      L(
        `Mặc định: nước ở 20 °C (ρ = ${rho('vi')} kg/m³) và pₐ = 1 atm = ${atm('vi')}.`,
        `Defaults: water at 20 °C (ρ = ${rho('en')} kg/m³) and pₐ = 1 atm = ${atm('en')}.`,
      ),
      L(
        'Đầu đo chìm đều xuống chỉ để minh họa; áp suất tại mỗi độ sâu không phụ thuộc cách đầu đo đi xuống.',
        'The probe sinks steadily only as an illustration; the pressure at each depth does not depend on how it gets there.',
      ),
    ],
    validity: L(
      'Điểm nằm trong chất lỏng (h ≥ 0), chất lỏng coi như không nén được.',
      'The point is in the liquid (h ≥ 0), and the liquid counts as incompressible.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Công thức đúng của chất lỏng không nén được đứng yên; kiểm chứng bằng tích phân số DOPRI5 của dp/dh = ρg từ mặt thoáng.',
      'Exact for an incompressible liquid at rest; cross-checked by a DOPRI5 integration of dp/dh = ρg from the surface.',
    ),
    method: L(
      'Áp suất tính đúng tại độ sâu của đầu đo ở mỗi bước (Δt = 1/60 s).',
      'The pressure is evaluated exactly at the probe’s depth at every step (Δt = 1/60 s).',
    ),
    userIntervened: false,
    sources: [sgk10(34), SRC.halliday, SRC.iapwsWater, SRC.codata],
  };
}

export const liquidPressure: PhysicsScene = {
  id: 'liquidPressure',
  required: ['h'],
  engineId: 'phys.liquidPressure',
  title: L('Áp suất chất lỏng', 'Liquid pressure'),
  usesGravity: true,
  params: [
    {
      key: 'h',
      label: L('Độ sâu của điểm', 'Depth of the point'),
      symbol: 'h',
      kind: 'number',
      dim: DIM.length,
      unit: 'm',
      min: 0,
      max: 20,
      step: 0.1,
    },
    {
      key: 'rho',
      label: L('Khối lượng riêng của chất lỏng', 'Density of the liquid'),
      symbol: '\\rho',
      kind: 'number',
      dim: DIM.density,
      unit: 'kg/m^3',
      min: 500,
      max: 14000,
      step: 1,
    },
    {
      key: 'pa',
      label: L('Áp suất khí quyển trên mặt thoáng', 'Air pressure on the surface'),
      symbol: 'p_a',
      kind: 'number',
      dim: DIM.pressure,
      unit: 'kPa',
      min: 0,
      max: 200,
      step: 0.1,
    },
    gravityParam,
  ],
  defaults: { h: 2, rho: WATER_RHO, pa: ATM, g: 9.81 },
  scienceCard: card,
  solve,
  graphs,
  bodies: [probe],
  view,
  draw,
};
