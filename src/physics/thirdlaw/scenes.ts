import type { Locale } from '@/app/i18n/types';
import type { LocalizedText } from '@/core/data/dataset';
import { dopri5 } from '@/core/ode/dopri5';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import { arrow, block, circle, ground, spring, text, vectorScale } from '../render/draw';
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
import { TL, runLength } from './engine';
import {
  cartWidth,
  contactTime,
  finalVelocities,
  reducedMass,
  stateAt,
  thirdLawInput,
  type ThirdLawInput,
} from './model';

/** Cart height for the picture, as a fraction of its width. */
const HEIGHT = 0.55;

/**
 * Independent check: integrates both carts' equations of motion from their own starting
 * positions (cart 1 at x = 0, nothing assumed about the centre of mass) until the spring is back
 * at its natural length.
 */
export function numericSeparation(q: ThirdLawInput): { t: number; v1: number; v2: number } | null {
  const half = (cartWidth(q.m1) + cartWidth(q.m2)) / 2;
  const compression = (y: Float64Array) => q.l0 - ((y[2] ?? 0) - (y[0] ?? 0) - half);
  const r = dopri5(
    (_t, y, dy) => {
      const F = q.k * Math.max(0, compression(y));
      dy[0] = y[1] ?? 0;
      dy[1] = -F / q.m1;
      dy[2] = y[3] ?? 0;
      dy[3] = F / q.m2;
    },
    [0, 0, half + q.l0 - q.d, 0],
    0,
    10 * contactTime(q) + 1,
    {
      rtol: 1e-12,
      atol: 1e-14,
      events: [{ id: 'free', g: (_t, y) => compression(y), direction: -1, terminal: true }],
    },
  );
  if (r.stoppedBy !== 'free') return null;
  return { t: r.t, v1: r.y[1] ?? 0, v2: r.y[3] ?? 0 };
}

function view(p: Params): WorldBounds {
  const q = thirdLawInput(p);
  const end = stateAt(q, runLength(q));
  const start = stateAt(q, 0);
  const w = Math.max(cartWidth(q.m1), cartWidth(q.m2));
  const xMin = Math.min(end.x1, start.x1) - w;
  const xMax = Math.max(end.x2, start.x2) + w;
  // The velocity arrows are up to 12 % of the view wide: room for them and their labels.
  const width = Math.max((xMax - xMin) / 0.66, 1);
  const cx = (xMin + xMax) / 2;
  const h = width * 0.45;
  return { xMin: cx - width / 2, xMax: cx + width / 2, yMin: -0.2 * h, yMax: 0.8 * h };
}

const cart = (k: 0 | 1): BodyDef => ({
  id: k ? 'cart2' : 'cart1',
  label: k ? L('Xe 2', 'Cart 2') : L('Xe 1', 'Cart 1'),
  position: (s, p) => {
    const q = thirdLawInput(p);
    const w = cartWidth(k ? q.m2 : q.m1);
    return { x: (k ? s[TL.x2] : s[TL.x1]) ?? 0, y: (HEIGHT * w) / 2 + 0.03 };
  },
  radius: (p) => {
    const q = thirdLawInput(p);
    return cartWidth(k ? q.m2 : q.m1) / 2;
  },
  draggable: false,
  properties: (s, p) => {
    const q = thirdLawInput(p);
    const m = k ? q.m2 : q.m1;
    const v = (k ? s[TL.v2] : s[TL.v1]) ?? 0;
    const F = (k ? s[TL.F12] : s[TL.F21]) ?? 0;
    return [
      { label: L('Khối lượng', 'Mass'), symbol: 'm', value: m, unit: 'kg' },
      {
        label: k
          ? L('Lực xe 1 tác dụng lên', 'Force from cart 1')
          : L('Lực xe 2 tác dụng lên', 'Force from cart 2'),
        symbol: k ? 'F_{1\\to 2}' : 'F_{2\\to 1}',
        value: F,
        unit: 'N',
      },
      { label: L('Gia tốc', 'Acceleration'), symbol: 'a', value: F / m, unit: 'm/s^2' },
      { label: L('Vận tốc', 'Velocity'), symbol: 'v', value: v, unit: 'm/s' },
      { label: L('Động lượng', 'Momentum'), symbol: 'p', value: m * v, unit: 'kg*m/s' },
    ];
  },
});

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const q = thirdLawInput(p);
  const vis = cam.visible();
  ground(ctx, cam, 0, c);
  const carts = [
    {
      x: state[TL.x1] ?? 0,
      v: state[TL.v1] ?? 0,
      F: state[TL.F21] ?? 0,
      w: cartWidth(q.m1),
      id: 'cart1',
      label: '1',
    },
    {
      x: state[TL.x2] ?? 0,
      v: state[TL.v2] ?? 0,
      F: state[TL.F12] ?? 0,
      w: cartWidth(q.m2),
      id: 'cart2',
      label: '2',
    },
  ] as const;
  const wheel = 0.03;
  const [a, b] = carts;
  const yMid = (w: number) => wheel + (HEIGHT * w) / 2;
  // The spring is fixed to cart 1: squeezed against cart 2, then at its natural length.
  const from = a.x + a.w / 2;
  const to = Math.min(b.x - b.w / 2, from + q.l0);
  const ys = Math.min(yMid(a.w), yMid(b.w));
  spring(ctx, cam, from, ys, to, ys, c.spring, 10, 8);
  for (const k of carts) {
    const h = HEIGHT * k.w;
    const y = yMid(k.w);
    block(
      ctx,
      cam,
      k.x,
      y,
      k.w,
      h,
      0,
      opts.selected === k.id ? c.accent : k.label === '1' ? c.body : c.bodyAlt,
      c.text,
      k.label,
    );
    for (const dx of [-0.3, 0.3])
      circle(ctx, cam, k.x + dx * k.w, wheel, wheel, c.text, undefined, 3);
  }
  if (opts.vectors) {
    const Fmax = q.k * q.d;
    const span = vis.xMax - vis.xMin;
    const kF = vectorScale(Fmax, span, 0.14);
    // Each force starts where it acts: the spring's ends on the two carts.
    if (Math.abs(a.F) > 1e-9 * Fmax) {
      arrow(ctx, cam, a.x + a.w / 2, ys + 0.02 * span, a.F * kF, 0, c.force, 'F₂→₁');
      arrow(ctx, cam, b.x - b.w / 2, ys + 0.02 * span, b.F * kF, 0, c.force, 'F₁→₂');
    }
    const { v1, v2 } = finalVelocities(q);
    const kv = vectorScale(Math.max(Math.abs(v1), Math.abs(v2)), span, 0.12);
    for (const [i, k] of carts.entries()) {
      const top = yMid(k.w) + (HEIGHT * k.w) / 2 + 0.03 * span;
      arrow(ctx, cam, k.x, top, k.v * kv, 0, c.velocity, i ? 'v₂' : 'v₁');
    }
  }
  const P = q.m1 * a.v + q.m2 * b.v;
  // Momentum stays 0; a rounding residue of 1e-17 kg·m/s must not show as "−0".
  const shownP = Math.abs(P) < 1e-12 * (q.m1 + q.m2) ? 0 : P;
  text(
    ctx,
    cam,
    vis.xMin,
    vis.yMax,
    `F = ${fmtQty(opts.locale, Math.abs(b.F), 'N', 4)}   p₁ + p₂ = ${fmtQty(opts.locale, shownP, 'kg*m/s', 3)}`,
    c.muted,
    'left',
    { x: 60, y: 20 },
  );
}

const graphs: GraphDef[] = [
  {
    id: 'forces',
    title: L('Hai lực tương tác', 'The pair of forces'),
    yLabel: L('F (N)', 'F (N)'),
    series: [
      { id: 'F21', label: L('F₂→₁ (lên xe 1)', 'F₂→₁ (on cart 1)'), value: (s) => s[TL.F21] ?? 0 },
      { id: 'F12', label: L('F₁→₂ (lên xe 2)', 'F₁→₂ (on cart 2)'), value: (s) => s[TL.F12] ?? 0 },
    ],
  },
  {
    id: 'velocity',
    title: L('Vận tốc theo thời gian', 'Velocity over time'),
    yLabel: L('v (m/s)', 'v (m/s)'),
    series: [
      { id: 'v1', label: L('v₁', 'v₁'), value: (s) => s[TL.v1] ?? 0 },
      { id: 'v2', label: L('v₂', 'v₂'), value: (s) => s[TL.v2] ?? 0 },
    ],
  },
  {
    id: 'momentum',
    title: L('Động lượng', 'Momentum'),
    yLabel: L('p (kg·m/s)', 'p (kg·m/s)'),
    series: [
      { id: 'p1', label: L('p₁', 'p₁'), value: (s, p) => (p.m1 ?? 1) * (s[TL.v1] ?? 0) },
      { id: 'p2', label: L('p₂', 'p₂'), value: (s, p) => (p.m2 ?? 2) * (s[TL.v2] ?? 0) },
      {
        id: 'p',
        label: L('p₁ + p₂', 'p₁ + p₂'),
        value: (s, p) => (p.m1 ?? 1) * (s[TL.v1] ?? 0) + (p.m2 ?? 2) * (s[TL.v2] ?? 0),
        dash: [6, 4],
      },
    ],
  },
];

function solve(p: Params, locale: Locale): Solution {
  const q = thirdLawInput(p);
  const n = (v: number) => texNum(locale, v);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const F0 = q.k * q.d;
  const mu = reducedMass(q);
  const tc = contactTime(q);
  const { v1, v2 } = finalVelocities(q);
  const chk = numericSeparation(q);
  const steps = [
    {
      text: L(
        'Định luật III Newton: lò xo đẩy hai xe bằng hai lực cùng độ lớn, ngược chiều. Lúc thả:',
        "Newton's third law: the spring pushes the two carts with forces of equal size and opposite direction. At release:",
      ),
      tex: `F_{1\\to 2} = F_{2\\to 1} = k\\,d = ${n(q.k)}\\cdot ${n(q.d)} = ${Q(F0, 'N')}`,
    },
    {
      text: L(
        'Cùng một độ lớn lực, xe nhẹ hơn có gia tốc lớn hơn:',
        'With the same force, the lighter cart gets the larger acceleration:',
      ),
      tex: `a_1 = \\frac{F}{m_1} = ${Q(F0 / q.m1, 'm/s^2')},\\qquad a_2 = \\frac{F}{m_2} = ${Q(F0 / q.m2, 'm/s^2')}`,
    },
    {
      text: L(
        'Lò xo bung hết sau một phần tư chu kì của chuyển động tương đối:',
        'The spring is back at its natural length after a quarter period of the relative motion:',
      ),
      tex: `\\mu = \\frac{m_1 m_2}{m_1 + m_2} = ${Q(mu, 'kg')},\\quad t^{*} = \\frac{\\pi}{2}\\sqrt{\\frac{\\mu}{k}} = ${Q(tc, 's')}`,
    },
    {
      text: L(
        'Hai xe đứng yên lúc đầu nên tổng động lượng luôn bằng 0; thế năng của lò xo chia cho hai xe:',
        'The carts start at rest, so the total momentum stays 0; the spring energy is shared between them:',
      ),
      tex: `m_1 v_1' + m_2 v_2' = 0,\\quad \\tfrac{1}{2} k d^2 = \\tfrac{1}{2} m_1 v_1'^2 + \\tfrac{1}{2} m_2 v_2'^2 \\Rightarrow v_1' = ${Q(v1, 'm/s')},\\ v_2' = ${Q(v2, 'm/s')}`,
    },
  ];
  const ratio = Math.abs(v1) / Math.abs(v2);
  const answers: Answer[] = [
    {
      id: 'F0',
      label: L('Lực mỗi xe nhận lúc thả', 'Force on each cart at release'),
      value: F0,
      unit: 'N',
    },
    {
      id: 'tc',
      label: L('Thời gian lò xo đẩy', 'Time the spring pushes'),
      value: tc,
      unit: 's',
      ...(chk ? { check: chk.t } : {}),
    },
    {
      id: 'v1_after',
      label: L('Vận tốc xe 1 sau khi tách', 'Cart 1 velocity after separation'),
      value: v1,
      unit: 'm/s',
      ...(chk ? { check: chk.v1 } : {}),
    },
    {
      id: 'v2_after',
      label: L('Vận tốc xe 2 sau khi tách', 'Cart 2 velocity after separation'),
      value: v2,
      unit: 'm/s',
      ...(chk ? { check: chk.v2 } : {}),
    },
    {
      id: 'speedRatio',
      label: L('Tỉ số tốc độ |v₁′| / |v₂′|', 'Speed ratio |v₁′| / |v₂′|'),
      value: ratio,
      unit: '1',
      ...(chk ? { check: Math.abs(chk.v1) / Math.abs(chk.v2) } : {}),
    },
    {
      id: 'impulse',
      label: L('Xung lượng mỗi xe nhận', 'Impulse on each cart'),
      value: q.m2 * v2,
      unit: 'kg*m/s',
      ...(chk ? { check: -q.m1 * chk.v1 } : {}),
    },
  ];
  const notes: LocalizedText[] = [
    L(
      'Hai lực tương tác đặt vào hai vật khác nhau nên không triệt tiêu nhau: mỗi xe chuyển động theo lực tác dụng lên chính nó.',
      'The two forces act on different bodies, so they do not cancel: each cart moves under the force acting on it.',
    ),
  ];
  return { answers, steps, notes };
}

function card(): ScienceCardData {
  return {
    title: L('Định luật III Newton', "Newton's third law"),
    model: L(
      'Hai xe lăn đứng yên trên đường ray nằm ngang nhẵn. Một lò xo nhẹ gắn vào xe 1, bị nén giữa hai xe; khi thả, lò xo đẩy hai xe cho tới khi trở về chiều dài tự nhiên, rồi hai xe chạy đều.',
      'Two carts at rest on a smooth horizontal track. A light spring fixed to cart 1 is squeezed between them; on release it pushes both carts until it is back at its natural length, then the carts coast.',
    ),
    equations: [
      {
        tex: '\\vec{F}_{2\\to 1} = -\\vec{F}_{1\\to 2}',
        label: L('Định luật III Newton', "Newton's third law"),
      },
      { tex: 'F = k\\,|\\Delta l|', label: L('Lực đàn hồi của lò xo', 'Spring force') },
      {
        tex: '\\mu = \\dfrac{m_1 m_2}{m_1 + m_2},\\quad \\omega = \\sqrt{k/\\mu},\\quad t^{*} = \\dfrac{\\pi}{2\\omega}',
        label: L('Chuyển động tương đối khi lò xo đẩy', 'Relative motion while the spring pushes'),
      },
      {
        tex: "m_1 v_1' + m_2 v_2' = 0,\\qquad \\tfrac{1}{2} k d^2 = \\tfrac{1}{2} m_1 v_1'^2 + \\tfrac{1}{2} m_2 v_2'^2",
      },
    ],
    assumptions: [
      L(
        'Đường ray nhẵn: không ma sát, bỏ qua lực cản không khí.',
        'Smooth track: no friction, no air drag.',
      ),
      L(
        'Lò xo nhẹ (bỏ qua khối lượng), tuân theo định luật Hooke trong suốt lúc nén.',
        'Light spring (mass neglected), obeying Hooke’s law throughout the compression.',
      ),
      L(
        'Lò xo gắn vào xe 1 và chỉ đẩy xe 2: hai xe tách nhau khi lò xo trở về chiều dài tự nhiên.',
        'The spring is fixed to cart 1 and only pushes cart 2: the carts part when it is back at its natural length.',
      ),
      L(
        'Hai xe đứng yên lúc thả; kích thước xe trên hình chỉ để minh họa.',
        'Both carts start at rest; the cart sizes in the picture are illustrative.',
      ),
    ],
    validity: L(
      'Độ nén nhỏ hơn chiều dài tự nhiên của lò xo (15 cm).',
      'Compression smaller than the spring’s natural length (15 cm).',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Nghiệm chính xác dạng đóng; thời điểm tách và vận tốc sau khi tách được kiểm chứng bằng tích phân số DOPRI5 độc lập.',
      'Exact closed form; the separation instant and the velocities after it are cross-checked by an independent DOPRI5 integration.',
    ),
    method: L(
      'Mỗi bước tính trạng thái từ nghiệm đóng tại t = n·Δt (Δt = 1/240 s): sai số không tích lũy.',
      'Each step evaluates the closed form at t = n·Δt (Δt = 1/240 s): no error builds up.',
    ),
    userIntervened: false,
    sources: [SRC.sgk10kntt, SRC.halliday],
  };
}

const massP = (key: string, sym: string, name: string): ParamDef => ({
  key,
  label: L(`Khối lượng xe ${name}`, `Mass of cart ${name}`),
  symbol: sym,
  kind: 'number',
  dim: DIM.mass,
  unit: 'kg',
  min: 0.1,
  max: 10,
  step: 0.1,
});

export const newtonThirdLaw: PhysicsScene = {
  id: 'newtonThirdLaw',
  required: ['m1', 'm2', 'k', 'd'],
  engineId: 'phys.thirdLaw',
  title: L('Định luật III Newton', "Newton's third law"),
  usesGravity: false,
  params: [
    massP('m1', 'm_1', '1'),
    massP('m2', 'm_2', '2'),
    {
      key: 'k',
      label: L('Độ cứng lò xo', 'Spring constant'),
      symbol: 'k',
      kind: 'number',
      dim: DIM.springConstant,
      unit: 'N/m',
      min: 5,
      max: 2000,
      step: 5,
    },
    {
      key: 'd',
      label: L('Độ nén ban đầu của lò xo', 'Initial compression of the spring'),
      symbol: 'd',
      kind: 'number',
      dim: DIM.length,
      unit: 'cm',
      min: 0.5,
      max: 12,
      step: 0.5,
    },
  ],
  defaults: { m1: 1, m2: 2, k: 20, d: 0.1, l0: 0.15 },
  validate: (p) => {
    const q = thirdLawInput(p);
    return q.d > 0 && q.d < q.l0
      ? []
      : [
          L(
            'Độ nén phải lớn hơn 0 và nhỏ hơn chiều dài tự nhiên của lò xo (15 cm).',
            'The compression must be above 0 and below the spring’s natural length (15 cm).',
          ),
        ];
  },
  scienceCard: card,
  solve,
  graphs,
  bodies: [cart(0), cart(1)],
  view,
  draw,
  trail: (s, p) => {
    const q = thirdLawInput(p);
    return [
      { x: s[TL.x1] ?? 0, y: 0.03 + (HEIGHT * cartWidth(q.m1)) / 2 },
      { x: s[TL.x2] ?? 0, y: 0.03 + (HEIGHT * cartWidth(q.m2)) / 2 },
    ];
  },
};
