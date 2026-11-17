import { jitter } from '../common/jitter';
import { lazy } from 'react';
import type { Locale } from '@/app/i18n/types';
import type { LocalizedText } from '@/core/data/dataset';
import { C } from '@/core/constants';
import { DIM, type Dimension } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { DASH, L } from '../common/scene-helpers';
import { SRC, sgkVl11 } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import { arrow, circle, line, polygon, text } from '../render/draw';
import type {
  Answer,
  BodyDef,
  DrawContext,
  GraphDef,
  ParamDef,
  Params,
  PhysicsScene,
  Solution,
  WorldBounds,
} from '../types';
import { WR } from './engine';
import {
  WIRE_DEFAULTS,
  area,
  chargeIn,
  driftSpeed,
  electronsIn,
  integratedCharge,
  isValid,
  lengthOf,
  wireInput,
} from './model';

function view(p: Params): WorldBounds {
  const d = wireInput(p).d > 0 ? wireInput(p).d : WIRE_DEFAULTS.d;
  const Lw = lengthOf(d);
  return { xMin: -0.08 * Lw, xMax: 1.08 * Lw, yMin: -1.6 * d, yMax: 1.6 * d };
}

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const w = wireInput(p);
  if (!isValid(w)) return;
  const loc = opts.locale;
  const d = w.d;
  const Lw = lengthOf(d);
  const r = d / 2;
  // The wire, side view.
  ctx.save();
  ctx.globalAlpha = 0.12;
  polygon(
    ctx,
    cam,
    [
      { x: 0, y: -r },
      { x: Lw, y: -r },
      { x: Lw, y: r },
      { x: 0, y: r },
    ],
    c.spring,
  );
  ctx.restore();
  line(ctx, cam, 0, r, Lw, r, c.text, 1.5);
  line(ctx, cam, 0, -r, Lw, -r, c.text, 1.5);
  // Positive ions stay in place.
  const cols = 14;
  const rows = 4;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const x = ((i + 0.5) * Lw) / cols;
      const y = -r + ((j + 0.5) * 2 * r) / rows;
      circle(ctx, cam, x, y, d / 22, c.force, undefined, 5);
      text(ctx, cam, x, y, '+', c.panel, 'center', { x: 0, y: 6 }, false);
    }
  // Free electrons drift against the current, at their real speed (wrapping round the piece).
  const s = state[WR.s] ?? 0;
  const count = 40;
  for (let k = 0; k < count; k++) {
    const x0 = jitter(k, 1) * Lw;
    const x = (((x0 - s) % Lw) + Lw) % Lw;
    const y = -r + (0.12 + 0.76 * jitter(k, 2)) * 2 * r;
    circle(ctx, cam, x, y, d / 30, c.velocity, undefined, 4);
  }
  // The cross-section S.
  line(ctx, cam, Lw / 2, -r, Lw / 2, r, c.accent, 1.5, DASH);
  text(ctx, cam, Lw / 2, r, 'S', c.accent, 'center', { x: 0, y: -6 });
  // Conventional current to the right, electrons to the left.
  arrow(ctx, cam, 0.15 * Lw, 1.35 * r, 0.25 * Lw, 0, c.force, 'I');
  arrow(ctx, cam, 0.85 * Lw, -1.35 * r, -0.25 * Lw, 0, c.velocity, 'v');
  const b = cam.visible();
  text(
    ctx,
    cam,
    b.xMin,
    b.yMax,
    `v = ${fmtQty(loc, driftSpeed(w), 'mm/s', 3)}   Δq = ${fmtQty(loc, state[WR.q] ?? 0, 'C', 4)}`,
    c.muted,
    'left',
    { x: 60, y: 18 },
  );
  text(
    ctx,
    cam,
    b.xMin,
    b.yMax,
    loc === 'vi'
      ? 'Mỗi chấm xanh đại diện cho rất nhiều electron tự do'
      : 'Each blue dot stands for very many free electrons',
    c.muted,
    'left',
    { x: 60, y: 36 },
  );
}

const wire: BodyDef = {
  id: 'wire',
  label: L('Dây dẫn', 'Wire'),
  position: (_s, p) => ({ x: lengthOf(wireInput(p).d) / 2, y: 0 }),
  radius: (p) => wireInput(p).d / 2,
  draggable: false,
  properties: (s, p) => {
    const w = wireInput(p);
    return [
      { label: L('Tiết diện thẳng', 'Cross-section'), symbol: 'S', value: area(w), unit: 'mm^2' },
      {
        label: L('Tốc độ dịch chuyển có hướng', 'Drift speed'),
        symbol: 'v',
        value: driftSpeed(w),
        unit: 'mm/s',
      },
      {
        label: L('Điện lượng đã qua tiết diện', 'Charge through the section'),
        symbol: '\\Delta q',
        value: s[WR.q] ?? 0,
        unit: 'C',
      },
    ];
  },
};

const graphs: GraphDef[] = [
  {
    id: 'charge',
    title: L('Điện lượng theo thời gian', 'Charge vs time'),
    yLabel: L('Δq (C)', 'Δq (C)'),
    series: [{ id: 'q', label: L('Δq = IΔt', 'Δq = IΔt'), value: (s) => s[WR.q] ?? 0 }],
  },
];

function solve(p: Params, locale: Locale): Solution {
  const w = wireInput(p);
  if (!isValid(w)) return { answers: [], steps: [] };
  const n = (v: number) => texNum(locale, v);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const S = area(w);
  const v = driftSpeed(w);
  const dq = chargeIn(w, w.dt);
  const check = integratedCharge(w);
  const answers: Answer[] = [
    {
      id: 'S',
      label: L('Tiết diện thẳng của dây', 'Cross-section of the wire'),
      value: S,
      unit: 'mm^2',
    },
    {
      id: 'v',
      label: L('Tốc độ dịch chuyển có hướng của electron', 'Drift speed of the electrons'),
      value: v,
      unit: 'mm/s',
    },
    {
      id: 'dq',
      label: L('Điện lượng qua tiết diện trong Δt', 'Charge through the section in Δt'),
      value: dq,
      unit: 'C',
      check,
    },
    {
      id: 'N',
      label: L('Số electron qua tiết diện trong Δt', 'Electrons through the section in Δt'),
      value: electronsIn(w, w.dt),
      unit: '1',
      check: check / C.e,
    },
  ];
  const steps = [
    {
      text: L('Tiết diện thẳng của dây hình trụ:', 'The cross-section of the round wire:'),
      tex: `S = \\frac{\\pi d^2}{4} = \\frac{\\pi\\cdot ${n(w.d)}^2}{4} = ${Q(S, 'mm^2')}`,
    },
    {
      text: L(
        'Từ I = Snve (22.3), tốc độ dịch chuyển có hướng của electron:',
        'From I = Snve (22.3), the drift speed of the electrons:',
      ),
      tex: `v = \\frac{I}{nSe} = \\frac{${n(w.I)}}{${n(w.n)}\\cdot ${n(S)}\\cdot ${n(C.e)}} = ${Q(v, 'mm/s')}`,
    },
    {
      text: L('Điện lượng chuyển qua tiết diện (22.2):', 'The charge through the section (22.2):'),
      tex: `\\Delta q = I\\Delta t = ${n(w.I)}\\cdot ${n(w.dt)} = ${Q(dq, 'C')}`,
    },
    {
      text: L(
        'Mỗi electron mang điện tích e, nên số electron là:',
        'Each electron carries a charge e, so the number of electrons is:',
      ),
      tex: `N = \\frac{\\Delta q}{e} = ${n(electronsIn(w, w.dt))}`,
    },
  ];
  const notes = [
    L(
      'Chiều dòng điện là chiều dịch chuyển của điện tích dương, nên ngược chiều dịch chuyển của các electron tự do (tr. 92).',
      'The current flows the way positive charges move, so against the free electrons (p. 92).',
    ),
  ];
  return { answers, steps, notes };
}

function validate(p: Params): LocalizedText[] {
  return isValid(wireInput(p))
    ? []
    : [L('Các đại lượng phải lớn hơn 0.', 'Every quantity must be greater than 0.')];
}

function card(): ScienceCardData {
  return {
    title: L('Cường độ dòng điện', 'Electric current'),
    model: L(
      'Dây kim loại hình trụ, đường kính d, có n electron tự do trong mỗi mét khối. Dòng điện không đổi I chạy qua dây; các electron tự do dịch chuyển có hướng ngược chiều dòng điện với tốc độ v.',
      'A round metal wire of diameter d with n free electrons per cubic metre. A steady current I flows; the free electrons drift against the current at speed v.',
    ),
    equations: [
      {
        tex: 'I = \\frac{\\Delta q}{\\Delta t}',
        label: L('Cường độ dòng điện (22.1)', 'Current (22.1)'),
      },
      {
        tex: 'I = Snve',
        label: L(
          'Liên hệ với mật độ và tốc độ hạt mang điện (22.3)',
          'Density and speed of the carriers (22.3)',
        ),
      },
      {
        tex: 'S = \\frac{\\pi d^2}{4}',
        label: L('Tiết diện dây tròn', 'Cross-section of a round wire'),
      },
    ],
    assumptions: [
      L(
        'Dòng điện không đổi; mọi electron tự do dịch chuyển với cùng tốc độ v (tốc độ trung bình của chuyển động có hướng).',
        'A steady current; every free electron drifts at the same speed v (the average of the directed motion).',
      ),
      L(
        'Mặc định theo bài tập vận dụng tr. 93: dây đồng d = 2 mm, I = 5 A, n = 8,45·10²⁸ electron/m³ (kết quả v ≈ 1,2·10⁻⁴ m/s).',
        'Defaults from the exercise on p. 93: a copper wire, d = 2 mm, I = 5 A, n = 8.45·10²⁸ electrons/m³ (answer v ≈ 1.2·10⁻⁴ m/s).',
      ),
      L(
        'Điện tích nguyên tố e theo CODATA 2022 (SGK làm tròn 1,6·10⁻¹⁹ C). Hình vẽ đúng tỉ lệ đoạn dây và tốc độ trôi; vị trí các hạt chỉ là minh họa.',
        'The elementary charge e from CODATA 2022 (the textbook rounds it to 1.6·10⁻¹⁹ C). The piece of wire and the drift speed are to scale; where the particles sit is an illustration.',
      ),
    ],
    validity: L(
      'Dòng điện không đổi trong dây kim loại đồng chất.',
      'A steady current in a uniform metal wire.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Công thức đúng (22.1)–(22.3). Kiểm chứng độc lập: điện lượng tích phân I theo thời gian bằng DOPRI5.',
      'Exact formulas (22.1)–(22.3). Independent check: the charge integrates I over time with DOPRI5.',
    ),
    method: L(
      'Quãng đường trôi và điện lượng tính đúng tại t = n·Δt; không tích lũy sai số.',
      'The drift distance and the charge are exact at t = n·Δt; no error builds up.',
    ),
    userIntervened: false,
    sources: [sgkVl11(22), SRC.hallidayCircuits, SRC.codata, SRC.hairer],
  };
}

const num = (
  key: string,
  label: LocalizedText,
  symbol: string,
  dim: Dimension,
  unit: string,
  range: readonly [number, number, number],
): ParamDef => ({
  key,
  label,
  symbol,
  kind: 'number',
  dim,
  unit,
  min: range[0],
  max: range[1],
  step: range[2],
});

export const electricCurrent: PhysicsScene = {
  id: 'electricCurrent',
  engineId: 'phys.electricCurrent',
  view3d: lazy(() => import('./Current3DView')),
  endless: true,
  title: L('Cường độ dòng điện', 'Electric current'),
  required: ['I'],
  params: [
    num('I', L('Cường độ dòng điện', 'Current'), 'I', DIM.current, 'A', [0.1, 20, 0.1]),
    num(
      'd',
      L('Đường kính tiết diện dây', 'Diameter of the wire'),
      'd',
      DIM.length,
      'mm',
      [0.1, 5, 0.1],
    ),
    num(
      'n',
      L('Mật độ electron tự do', 'Free-electron density'),
      'n',
      DIM.numberDensity,
      '1e28/m^3',
      [0.1, 20, 0.01],
    ),
    num('dt', L('Khoảng thời gian xét', 'Time span'), '\\Delta t', DIM.time, 's', [0.1, 100, 0.1]),
  ],
  defaults: { ...WIRE_DEFAULTS },
  usesGravity: false,
  validate,
  scienceCard: card,
  solve,
  graphs,
  bodies: [wire],
  view,
  draw,
};
