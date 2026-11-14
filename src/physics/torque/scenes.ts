import type { Locale } from '@/app/i18n/types';
import type { LocalizedText } from '@/core/data/dataset';
import { dopri5 } from '@/core/ode/dopri5';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { L, gravityParam } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import { arrow, block, ground, line, polygon, text } from '../render/draw';
import type {
  Answer,
  BodyDef,
  DrawContext,
  GraphDef,
  ParamDef,
  Params,
  PhysicsScene,
  Solution,
  SolutionStep,
  WorldBounds,
} from '../types';
import { TQ, runLength } from './engine';
import {
  BEAM,
  PIVOT_H,
  THETA_MAX,
  balanceDistance,
  balanced,
  inertia,
  lever,
  moments,
  netMoment,
  tipTime,
  type Lever,
} from './model';

/**
 * Independent check of the tipping time: DOPRI5 on θ″ = (net moment)·cos θ / I until the low
 * end reaches the ground (event), with no energy argument or quadrature.
 */
export function numericTip(q: Lever): number | null {
  if (balanced(q)) return null;
  const sgn = Math.sign(netMoment(q));
  const r = dopri5(
    (_t, y, dy) => {
      dy[0] = y[1] ?? 0;
      dy[1] = (netMoment(q) * Math.cos(y[0] ?? 0)) / inertia(q);
    },
    [0, 0],
    0,
    100,
    {
      rtol: 1e-12,
      atol: 1e-14,
      events: [
        { id: 'ground', g: (_t, y) => sgn * (y[0] ?? 0) - THETA_MAX, direction: 1, terminal: true },
      ],
    },
  );
  return r.stoppedBy === 'ground' ? r.t : null;
}

/** Independent check of the balance distance: bisection on the net moment as d₂ varies. */
function balanceByBisection(q: Lever): number {
  let lo = 0;
  let hi = 100 * BEAM;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (netMoment({ ...q, d2: mid }) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const block3 = (m: number) => Math.min(0.32, Math.max(0.1, 0.14 * Math.cbrt(m)));

function view(): WorldBounds {
  return { xMin: -1.6, xMax: 1.6, yMin: -0.3, yMax: 1.4 };
}

const beam: BodyDef = {
  id: 'beam',
  label: L('Thanh', 'Beam'),
  position: () => ({ x: 0, y: PIVOT_H }),
  radius: () => 0.1,
  draggable: false,
  properties: (s, p) => {
    const q = lever(p);
    const { M1, M2 } = moments(q);
    return [
      { label: L('Moment của vật 1', 'Moment of weight 1'), symbol: 'M_1', value: M1, unit: 'N*m' },
      { label: L('Moment của vật 2', 'Moment of weight 2'), symbol: 'M_2', value: M2, unit: 'N*m' },
      { label: L('Góc nghiêng', 'Tilt'), symbol: '\\theta', value: s[TQ.theta] ?? 0, unit: 'deg' },
    ];
  },
};

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const q = lever(p);
  const vis = cam.visible();
  ground(ctx, cam, 0, c);
  // The support: a triangle from the ground to the pivot.
  polygon(
    ctx,
    cam,
    [
      { x: -0.14, y: 0 },
      { x: 0.14, y: 0 },
      { x: 0, y: PIVOT_H },
    ],
    c.muted,
    c.text,
  );
  const th = state[TQ.theta] ?? 0;
  const along = (d: number) => ({ x: d * Math.cos(th), y: PIVOT_H + d * Math.sin(th) });
  const L2 = BEAM / 2;
  const a = along(-L2);
  const b = along(L2);
  line(ctx, cam, a.x, a.y, b.x, b.y, c.text, 5);
  // Each weight sits on the beam at its distance from the pivot.
  const nx = -Math.sin(th);
  const ny = Math.cos(th);
  const pieces = [
    { d: -q.d1, m: q.m1, label: '1', fill: c.body },
    { d: q.d2, m: q.m2, label: '2', fill: c.bodyAlt },
  ];
  for (const w of pieces) {
    const s = block3(w.m);
    const at = along(w.d);
    block(ctx, cam, at.x + (nx * s) / 2, at.y + (ny * s) / 2, s, s, th, w.fill, c.text, w.label);
    if (opts.vectors) {
      const k = 0.45 / (Math.max(q.m1, q.m2) * q.g);
      arrow(
        ctx,
        cam,
        at.x + (nx * s) / 2,
        at.y + (ny * s) / 2,
        0,
        -w.m * q.g * k,
        c.force,
        `P_${w.label}`,
      );
    }
  }
  if (Math.abs(th) < 1e-9 && opts.vectors) {
    // Lever arms: horizontal distances from the pivot to each weight's line of action.
    line(ctx, cam, -q.d1, PIVOT_H - 0.06, 0, PIVOT_H - 0.06, c.faint, 1);
    line(ctx, cam, 0, PIVOT_H - 0.06, q.d2, PIVOT_H - 0.06, c.faint, 1);
    text(ctx, cam, -q.d1 / 2, PIVOT_H - 0.06, 'd_1', c.muted, 'center', { x: 0, y: 16 });
    text(ctx, cam, q.d2 / 2, PIVOT_H - 0.06, 'd_2', c.muted, 'center', { x: 0, y: 16 });
  }
  const { M1, M2 } = moments(q);
  text(
    ctx,
    cam,
    vis.xMin,
    vis.yMax,
    `M₁ = ${fmtQty(opts.locale, M1, 'N*m', 4)}   M₂ = ${fmtQty(opts.locale, M2, 'N*m', 4)}`,
    c.muted,
    'left',
    { x: 60, y: 20 },
  );
}

const graphs: GraphDef[] = [
  {
    id: 'angle',
    title: L('Góc nghiêng theo thời gian', 'Tilt over time'),
    yLabel: L('θ (rad)', 'θ (rad)'),
    series: [{ id: 'theta', label: L('θ', 'θ'), value: (s) => s[TQ.theta] ?? 0 }],
  },
  {
    id: 'moment',
    title: L('Moment tổng hợp theo thời gian', 'Net moment over time'),
    yLabel: L('M (N·m)', 'M (N·m)'),
    series: [{ id: 'M', label: L('M', 'M'), value: (s) => s[TQ.moment] ?? 0 }],
  },
];

function solve(p: Params, locale: Locale): Solution {
  const q = lever(p);
  const n = (v: number) => texNum(locale, v);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const { M1, M2 } = moments(q);
  const net = netMoment(q);
  const dStar = balanceDistance(q);
  const steps: SolutionStep[] = [
    {
      text: L(
        'Moment của mỗi trọng lực đối với trục quay (thanh nằm ngang):',
        'Moment of each weight about the pivot (beam level):',
      ),
      tex: `M_1 = m_1 g d_1 = ${n(q.m1)}\\cdot ${n(q.g)}\\cdot ${n(q.d1)} = ${Q(M1, 'N*m')},\\quad M_2 = m_2 g d_2 = ${n(q.m2)}\\cdot ${n(q.g)}\\cdot ${n(q.d2)} = ${Q(M2, 'N*m')}`,
    },
    {
      text: L(
        'Quy tắc moment: thanh cân bằng khi M₁ = M₂, tức vật 2 phải đặt cách trục:',
        'The moment rule: the beam balances when M₁ = M₂, so weight 2 must sit at:',
      ),
      tex: `d_2 = \\frac{m_1 d_1}{m_2} = \\frac{${n(q.m1)}\\cdot ${n(q.d1)}}{${n(q.m2)}} = ${Q(dStar, 'm')}`,
    },
  ];
  const answers: Answer[] = [
    { id: 'M1', label: L('Moment của vật 1', 'Moment of weight 1'), value: M1, unit: 'N*m' },
    { id: 'M2', label: L('Moment của vật 2', 'Moment of weight 2'), value: M2, unit: 'N*m' },
    {
      id: 'Mnet',
      label: L(
        'Moment tổng hợp (dương: bên trái nặng hơn)',
        'Net moment (positive: left side heavier)',
      ),
      value: net,
      unit: 'N*m',
      check: M1 - M2,
    },
    {
      id: 'd2star',
      label: L('Vị trí cân bằng của vật 2', 'Balance position of weight 2'),
      value: dStar,
      unit: 'm',
      check: balanceByBisection(q),
    },
  ];
  const notes: LocalizedText[] = [];
  if (dStar > BEAM / 2)
    notes.push(
      L(
        `Vị trí cân bằng nằm ngoài thanh (thanh chỉ dài 1 m mỗi bên): cần vật 2 nặng hơn.`,
        `The balance position is beyond the beam (only 1 m each side): weight 2 must be heavier.`,
      ),
    );
  if (balanced(q)) {
    steps.push({
      text: L(
        'M₁ = M₂: thanh đứng yên nằm ngang. Hai điều kiện cân bằng của vật rắn đều thỏa: tổng moment bằng 0, và trục đỡ đẩy lên một lực bằng tổng trọng lượng.',
        'M₁ = M₂: the beam stays level. Both conditions for a rigid body hold: the moments add to 0, and the pivot pushes up with the total weight.',
      ),
      tex: `N = (m_1 + m_2 + M)\\,g = ${Q((q.m1 + q.m2 + q.M) * q.g, 'N')}`,
    });
    answers.push({
      id: 'N',
      label: L('Lực đỡ của trục', 'Push of the pivot'),
      value: (q.m1 + q.m2 + q.M) * q.g,
      unit: 'N',
    });
  } else {
    const t = tipTime(q);
    const chk = numericTip(q);
    steps.push(
      {
        text:
          net > 0
            ? L(
                'M₁ > M₂: thanh quay, bên trái hạ xuống. Lúc thả:',
                'M₁ > M₂: the beam turns, left side down. At release:',
              )
            : L(
                'M₂ > M₁: thanh quay, bên phải hạ xuống. Lúc thả:',
                'M₂ > M₁: the beam turns, right side down. At release:',
              ),
        tex: `I = m_1 d_1^2 + m_2 d_2^2 + \\tfrac{1}{12} M L^2 = ${Q(inertia(q), 'kg*m^2')},\\quad \\gamma_0 = \\frac{|M_1 - M_2|}{I} = ${n(Math.abs(net) / inertia(q))}\\,\\text{rad/s}^{2}`,
      },
      {
        text: L(
          'Khi thanh nghiêng, cánh tay đòn ngắn lại theo cos θ. Thời gian tới lúc đầu thanh chạm đất:',
          'As the beam tilts the lever arms shrink by cos θ. Time until its end touches the ground:',
        ),
        tex: `t = \\int_0^{\\theta_{max}} \\frac{d\\theta}{\\sqrt{2K\\sin\\theta}} = ${Q(t, 's')},\\quad K = \\frac{|M_1 - M_2|}{I},\\ \\theta_{max} = ${Q(THETA_MAX, 'deg')}`,
      },
    );
    answers.push(
      {
        id: 'gamma0',
        label: L('Gia tốc góc lúc thả', 'Angular acceleration at release'),
        value: Math.abs(net) / inertia(q),
        unit: 'rad/s^2',
      },
      {
        id: 'tTip',
        label: L('Thời gian tới khi chạm đất', 'Time to touch the ground'),
        value: t,
        unit: 's',
        ...(chk !== null ? { check: chk } : {}),
      },
    );
  }
  return { answers, steps, notes };
}

function card(): ScienceCardData {
  return {
    title: L('Moment lực và cân bằng của vật rắn', 'Moments and the balance of a rigid body'),
    model: L(
      'Thanh cứng đồng chất dài 2 m quay quanh trục nằm ngang ở trung điểm, cao 0,4 m. Hai vật đặt trên thanh ở hai bên trục. Thả thanh nằm ngang, không vận tốc đầu.',
      'A uniform rigid beam 2 m long turns about a horizontal axle at its middle, 0.4 m high. Two weights sit on it, one on each side. It is released level, at rest.',
    ),
    equations: [
      {
        tex: 'M = F\\,d',
        label: L('Moment lực (d: cánh tay đòn)', 'Moment of a force (d: lever arm)'),
      },
      {
        tex: 'm_1 g\\,d_1 = m_2 g\\,d_2',
        label: L('Quy tắc moment: thanh cân bằng', 'Moment rule: the beam balances'),
      },
      {
        tex: '\\sum \\vec{F} = \\vec{0},\\qquad \\sum M = 0',
        label: L(
          'Hai điều kiện cân bằng của vật rắn',
          'The two conditions for a rigid body at rest',
        ),
      },
      {
        tex: 'I\\,\\ddot{\\theta} = (m_1 d_1 - m_2 d_2)\\,g\\cos\\theta,\\quad I = m_1 d_1^2 + m_2 d_2^2 + \\tfrac{1}{12} M L^2',
        label: L('Khi chưa cân bằng: thanh quay', 'When unbalanced: the beam turns'),
      },
    ],
    assumptions: [
      L(
        'Thanh cứng, đồng chất; trọng lực của thanh đặt tại trục nên không có moment.',
        'Rigid uniform beam; its weight acts at the axle, so it has no moment.',
      ),
      L(
        'Trục quay không ma sát. Hai vật coi như chất điểm nằm trên trục của thanh.',
        'Frictionless axle. The weights are points on the beam’s axis.',
      ),
      L(
        'Đầu thanh chạm đất thì dừng lại (không nảy).',
        'The end that reaches the ground stays there (no bounce).',
      ),
    ],
    validity: L(
      'Vật nằm trên thanh: cánh tay đòn từ 0 tới 1 m mỗi bên.',
      'Weights on the beam: lever arms from 0 to 1 m on each side.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Quy tắc moment là công thức đúng; vị trí cân bằng kiểm lại bằng phép chia đôi. Thời gian chạm đất tính bằng tích phân (Gauss–Legendre), kiểm chứng bằng DOPRI5; hình động dùng RK4 với 10 bước con.',
      'The moment rule is exact; the balance position is re-found by bisection. The time to touch the ground is an integral (Gauss–Legendre), cross-checked by DOPRI5; the animation uses RK4 with 10 substeps.',
    ),
    method: L(
      'RK4, Δt = 1/2400 s; theo dõi cơ năng khi thanh quay.',
      'RK4, Δt = 1/2400 s; mechanical energy watched while it turns.',
    ),
    userIntervened: false,
    sources: [SRC.sgk10kntt, SRC.halliday],
  };
}

const weightP = (i: 1 | 2): ParamDef[] => [
  {
    key: `m${i}`,
    label: L(
      `Khối lượng vật ${i === 1 ? 'bên trái' : 'bên phải'}`,
      `Mass of the ${i === 1 ? 'left' : 'right'} weight`,
    ),
    symbol: `m_${i}`,
    kind: 'number',
    dim: DIM.mass,
    unit: 'kg',
    min: 0.1,
    max: 10,
    step: 0.1,
  },
  {
    key: `d${i}`,
    label: L(
      `Khoảng cách từ trục tới vật ${i === 1 ? 'bên trái' : 'bên phải'}`,
      `Distance from the axle to the ${i === 1 ? 'left' : 'right'} weight`,
    ),
    symbol: `d_${i}`,
    kind: 'number',
    dim: DIM.length,
    unit: 'm',
    min: 0,
    max: 1,
    step: 0.01,
  },
];

export const torqueBalance: PhysicsScene = {
  id: 'torqueBalance',
  required: ['m1', 'd1', 'm2', 'd2'],
  engineId: 'phys.torque',
  title: L('Moment lực và cân bằng vật rắn', 'Moments and rigid-body balance'),
  usesGravity: true,
  params: [
    ...weightP(1),
    ...weightP(2),
    {
      key: 'M',
      label: L('Khối lượng thanh', 'Mass of the beam'),
      symbol: 'M',
      kind: 'number',
      dim: DIM.mass,
      unit: 'kg',
      min: 0,
      max: 10,
      step: 0.1,
    },
    gravityParam,
  ],
  defaults: { m1: 1.5, d1: 0.4, m2: 1, d2: 0.8, M: 1 },
  engineParams: (p) => ({ ...p, tEnd: runLength(lever(p)) }),
  scienceCard: card,
  solve,
  graphs,
  bodies: [beam],
  view,
  draw,
};
