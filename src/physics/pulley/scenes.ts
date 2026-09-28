import { formatNumber } from '@/app/i18n';
import type { Locale } from '@/app/i18n/types';
import type { LocalizedText } from '@/core/data/dataset';
import { dopri5 } from '@/core/ode/dopri5';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { accel1D } from '../common/coulomb1d';
import { L, gravityParam, pairFriction } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { texNum, texQty } from '../common/tex';
import { arrow, block, circle, ground, line, polygon, vectorScale } from '../render/draw';
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
import { PU, pulleyInput, reduce, tension, type PulleyInput } from './engine';

const B = 0.3; // block size (m)
const R = 0.15; // pulley radius (m)

/** World geometry of the configuration for a given displacement s. */
export function geometry(q: PulleyInput, s: number) {
  const Ht = q.travel + 0.8;
  switch (q.config) {
    case 0: {
      const top = q.travel + 1.6;
      const y0 = q.travel + B / 2;
      return {
        pulley: { x: 0, y: top },
        m1: { x: -R, y: y0 + s, angle: 0 },
        m2: { x: R, y: y0 - s, angle: 0 },
        top,
      };
    }
    case 1: {
      const x10 = -q.travel - 0.6;
      return {
        pulley: { x: R, y: Ht },
        m1: { x: x10 + s, y: Ht + B / 2, angle: 0 },
        m2: { x: 2 * R, y: q.travel + B / 2 - s, angle: 0 },
        top: Ht,
      };
    }
    case 2: {
      const d = q.travel + 0.5 - s;
      const c = Math.cos(q.theta);
      const sn = Math.sin(q.theta);
      return {
        pulley: { x: R, y: Ht },
        m1: { x: -c * d - sn * (B / 2), y: Ht - sn * d + c * (B / 2), angle: q.theta },
        m2: { x: 2 * R, y: q.travel + B / 2 - s, angle: 0 },
        top: Ht,
      };
    }
  }
}

function view(p: Params): WorldBounds {
  const q = pulleyInput(p);
  const g0 = geometry(q, 0);
  const left =
    q.config === 0
      ? -1.2
      : q.config === 1
        ? g0.m1.x - q.travel - 0.6
        : -(g0.top / Math.max(Math.tan(q.theta), 0.2)) - 0.3;
  return { xMin: left, xMax: 1.4, yMin: -0.3, yMax: g0.top + 0.6 };
}

const props = (which: 1 | 2) => (s: Float64Array) => [
  {
    label: L('Độ dời của m₂ (xuống)', 'Displacement of m₂ (down)'),
    symbol: 's',
    value: s[PU.s] ?? 0,
    unit: 'm',
  },
  {
    label: L('Vận tốc', 'Velocity'),
    symbol: 'v',
    value: (which === 2 ? 1 : 1) * (s[PU.v] ?? 0),
    unit: 'm/s',
  },
  { label: L('Gia tốc', 'Acceleration'), symbol: 'a', value: s[PU.a] ?? 0, unit: 'm/s^2' },
  { label: L('Lực căng dây', 'String tension'), symbol: 'T', value: s[PU.T] ?? 0, unit: 'N' },
];

const bodies: BodyDef[] = [
  {
    id: 'm1',
    label: L('Vật m₁', 'Block m₁'),
    position: (s, p) => geometry(pulleyInput(p), s[PU.s] ?? 0).m1,
    radius: () => B / 2,
    draggable: true,
    properties: props(1),
  },
  {
    id: 'm2',
    label: L('Vật m₂', 'Block m₂'),
    position: (s, p) => geometry(pulleyInput(p), s[PU.s] ?? 0).m2,
    radius: () => B / 2,
    draggable: true,
    properties: props(2),
  },
];

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const q = pulleyInput(p);
  const s = state[PU.s] ?? 0;
  const g = geometry(q, s);
  ground(ctx, cam, 0, c);
  if (q.config === 1) {
    polygon(
      ctx,
      cam,
      [
        { x: g.m1.x - q.travel - 1, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: g.top },
        { x: g.m1.x - q.travel - 1, y: g.top },
      ],
      c.panel,
      c.ground,
    );
  } else if (q.config === 2) {
    const base = g.top / Math.max(Math.tan(q.theta), 1e-6);
    polygon(
      ctx,
      cam,
      [
        { x: -base, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: g.top },
      ],
      c.panel,
      c.ground,
    );
  } else {
    line(ctx, cam, -0.6, g.top + R + 0.05, 0.6, g.top + R + 0.05, c.ground, 3);
    line(ctx, cam, 0, g.top, 0, g.top + R + 0.05, c.ground, 2);
  }
  // Pulley and string.
  circle(ctx, cam, g.pulley.x, g.pulley.y, R, c.panel, c.text, 4);
  circle(ctx, cam, g.pulley.x, g.pulley.y, 0.02, c.text, undefined, 2);
  const rope = c.text;
  if (q.config === 0) {
    line(ctx, cam, -R, g.pulley.y, g.m1.x, g.m1.y + B / 2, rope, 1.5);
    line(ctx, cam, R, g.pulley.y, g.m2.x, g.m2.y + B / 2, rope, 1.5);
  } else {
    const ct = Math.cos(g.m1.angle);
    const st = Math.sin(g.m1.angle);
    line(
      ctx,
      cam,
      g.m1.x + ct * (B / 2),
      g.m1.y + st * (B / 2),
      g.pulley.x - st * R,
      g.pulley.y + ct * R,
      rope,
      1.5,
    );
    line(ctx, cam, 2 * R, g.pulley.y, g.m2.x, g.m2.y + B / 2, rope, 1.5);
  }
  block(
    ctx,
    cam,
    g.m1.x,
    g.m1.y,
    B,
    B,
    g.m1.angle,
    opts.selected === 'm1' ? c.accent : c.body,
    c.text,
    'm₁',
  );
  block(
    ctx,
    cam,
    g.m2.x,
    g.m2.y,
    B,
    B,
    0,
    opts.selected === 'm2' ? c.accent : c.bodyAlt,
    c.text,
    'm₂',
  );
  if (opts.vectors) {
    const T = state[PU.T] ?? 0;
    const k = vectorScale(Math.max(q.m1, q.m2) * q.g, 1, 0.5);
    arrow(ctx, cam, g.m2.x, g.m2.y, 0, -q.m2 * q.g * k, c.force, 'P₂');
    arrow(ctx, cam, g.m2.x, g.m2.y, 0, T * k, c.velocity, 'T');
    if (q.config === 0) {
      arrow(ctx, cam, g.m1.x, g.m1.y, 0, -q.m1 * q.g * k, c.force, 'P₁');
      arrow(ctx, cam, g.m1.x, g.m1.y, 0, T * k, c.velocity, 'T');
    } else {
      const ct = Math.cos(g.m1.angle);
      const st = Math.sin(g.m1.angle);
      arrow(ctx, cam, g.m1.x, g.m1.y, ct * T * k, st * T * k, c.velocity, 'T');
      const fr = state[PU.friction] ?? 0;
      if (Math.abs(fr) > 1e-9)
        arrow(ctx, cam, g.m1.x, g.m1.y - B / 3, ct * fr * k, st * fr * k, c.acceleration, 'Fms');
    }
  }
}

const graphs: GraphDef[] = [
  {
    id: 'position',
    title: L('Độ dời của m₂', 'Displacement of m₂'),
    yLabel: L('s (m)', 's (m)'),
    series: [{ id: 's', label: L('s', 's'), value: (s) => s[PU.s] ?? 0 }],
  },
  {
    id: 'velocity',
    title: L('Vận tốc – thời gian', 'Velocity – time'),
    yLabel: L('v (m/s)', 'v (m/s)'),
    series: [{ id: 'v', label: L('v', 'v'), value: (s) => s[PU.v] ?? 0 }],
  },
  {
    id: 'tension',
    title: L('Lực căng dây và ma sát', 'Tension and friction'),
    yLabel: L('Lực (N)', 'Force (N)'),
    series: [
      { id: 'T', label: L('T', 'T'), value: (s) => s[PU.T] ?? 0 },
      { id: 'Fms', label: L('F_ms', 'F_fr'), value: (s) => s[PU.friction] ?? 0 },
    ],
  },
];

/** Dormand–Prince check of the time for m2 to travel the full distance from rest. */
export function numericTravel(q: PulleyInput): { t: number; v: number } | null {
  const r0 = accel1D(reduce(q), 0);
  if (r0.regime === 'static' || r0.a === 0) return null;
  const target = r0.a > 0 ? q.travel : -q.travel;
  const res = dopri5(
    (_t, y, d) => {
      d[0] = y[1] ?? 0;
      d[1] = r0.a;
    },
    [0, 0],
    0,
    1e3,
    {
      rtol: 1e-12,
      atol: 1e-13,
      events: [{ id: 'end', g: (_t, y) => (y[0] ?? 0) - target, terminal: true }],
    },
  );
  return { t: res.t, v: res.y[1] ?? 0 };
}

function solve(p: Params, locale: Locale): Solution {
  const q = pulleyInput(p);
  const n = (v: number) => texNum(locale, v);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const red = reduce(q);
  const r0 = accel1D(red, 0);
  const steps: SolutionStep[] = [
    {
      text: L(
        'Dây nhẹ, không dãn; ròng rọc nhẹ, không ma sát ⇒ hai vật có cùng độ lớn gia tốc, lực căng như nhau dọc dây. Chọn chiều dương là chiều m₂ đi xuống.',
        'Light inextensible string, ideal pulley ⇒ both blocks share |a| and the tension is uniform. Positive direction: m₂ moving down.',
      ),
    },
  ];
  if (q.config === 0) {
    steps.push({
      text: L(
        'Định luật II Newton cho m₂ và m₁ rồi cộng vế:',
        "Newton's 2nd law for m₂ and m₁, then add:",
      ),
      tex: `m_2 g - T = m_2 a,\\quad T - m_1 g = m_1 a \\;\\Rightarrow\\; a = \\frac{(m_2 - m_1)g}{m_1 + m_2} = \\frac{(${n(q.m2)} - ${n(q.m1)})\\cdot ${n(q.g)}}{${n(q.m1 + q.m2)}} = ${Q(r0.a, 'm/s^2')}`,
    });
  } else {
    steps.push({
      text: L(
        'Phản lực tác dụng lên m₁ và lực kéo hệ (chưa kể ma sát):',
        'Normal force on m₁ and net driving force (without friction):',
      ),
      tex:
        q.config === 1
          ? `N = m_1 g = ${Q(red.N, 'N')},\\qquad F_{kéo} = m_2 g = ${Q(red.D, 'N')}`
          : `N = m_1 g\\cos\\theta = ${Q(red.N, 'N')},\\qquad F_{kéo} = m_2 g - m_1 g\\sin\\theta = ${Q(red.D, 'N')}`,
    });
    if (r0.regime === 'static') {
      steps.push({
        text: L(
          'Lực kéo không thắng được ma sát nghỉ cực đại: hệ đứng yên.',
          'The driving force does not overcome maximum static friction: the system stays at rest.',
        ),
        tex: `|${n(red.D)}| \\le \\mu_n N = ${Q(red.Fs, 'N')}`,
      });
      return {
        answers: [
          { id: 'acceleration', label: L('Gia tốc', 'Acceleration'), value: 0, unit: 'm/s^2' },
          { id: 'tension', label: L('Lực căng dây', 'Tension'), value: tension(q, 0), unit: 'N' },
          {
            id: 'friction',
            label: L('Lực ma sát nghỉ', 'Static friction'),
            value: Math.abs(r0.friction),
            unit: 'N',
          },
        ],
        steps,
      };
    }
    steps.push({
      text: L(
        'Định luật II Newton cho cả hệ (ma sát trượt ngược chiều chuyển động):',
        "Newton's 2nd law for the whole system (kinetic friction opposes motion):",
      ),
      tex: `a = \\frac{F_{kéo} ${r0.a > 0 ? '-' : '+'} \\mu_t N}{m_1 + m_2} = \\frac{${n(red.D)} ${r0.a > 0 ? '-' : '+'} ${n(red.Fk)}}{${n(red.M)}} = ${Q(r0.a, 'm/s^2')}`,
    });
  }
  const T = tension(q, r0.a);
  steps.push({
    text: L('Lực căng dây (từ phương trình của m₂):', 'String tension (from m₂’s equation):'),
    tex: `T = m_2 (g - a) = ${n(q.m2)}\\cdot(${n(q.g)} - (${n(r0.a)})) = ${Q(T, 'N')}`,
  });
  const tt = Math.sqrt((2 * q.travel) / Math.abs(r0.a));
  const vv = Math.abs(r0.a) * tt;
  const chk = numericTravel(q);
  steps.push({
    text: L(
      `Thời gian để m₂ dịch chuyển ${formatNumber(locale, q.travel)} m từ trạng thái nghỉ và vận tốc khi đó:`,
      `Time for m₂ to move ${q.travel} m from rest and the speed then:`,
    ),
    tex: `t = \\sqrt{\\frac{2d}{|a|}} = ${Q(tt, 's')},\\qquad v = |a|\\,t = ${Q(vv, 'm/s')}`,
  });
  const answers: Answer[] = [
    {
      id: 'acceleration',
      label: L('Gia tốc của hệ', 'Acceleration of the system'),
      value: r0.a,
      unit: 'm/s^2',
    },
    { id: 'tension', label: L('Lực căng dây', 'String tension'), value: T, unit: 'N' },
  ];
  if (q.config !== 0) {
    answers.push({
      id: 'friction',
      label: L('Lực ma sát trượt', 'Kinetic friction'),
      value: red.Fk,
      unit: 'N',
    });
  }
  answers.push(
    {
      id: 'travel_time',
      label: L('Thời gian dịch chuyển', 'Travel time'),
      value: tt,
      unit: 's',
      ...(chk ? { check: chk.t } : {}),
    },
    {
      id: 'travel_speed',
      label: L('Tốc độ cuối', 'Final speed'),
      value: vv,
      unit: 'm/s',
      ...(chk ? { check: Math.abs(chk.v) } : {}),
    },
  );
  return { answers, steps };
}

function card(): ScienceCardData {
  return {
    title: L('Ròng rọc – dây nối', 'Pulleys and strings'),
    model: L(
      'Hai vật nối bằng dây nhẹ, không dãn qua ròng rọc cố định nhẹ, không ma sát; ma sát Coulomb trên m₁.',
      'Two blocks joined by a light inextensible string over an ideal fixed pulley; Coulomb friction on m₁.',
    ),
    equations: [{ tex: '(m_1 + m_2)\\,a = F_{kéo} - F_{ms}' }, { tex: 'T = m_2 (g - a)' }],
    assumptions: [
      L(
        'Khối lượng dây và ròng rọc không đáng kể; dây luôn căng.',
        'String and pulley are massless; the string stays taut.',
      ),
      L('Bỏ qua lực cản không khí.', 'Air resistance neglected.'),
    ],
    validity: L(
      'Khi dây còn căng (T > 0) và các vật chưa chạm sàn/ròng rọc.',
      'While the string is taut (T > 0) and nothing has hit the floor/pulley.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Gia tốc không đổi từng đoạn; thời gian dịch chuyển kiểm chứng bằng Dormand–Prince.',
      'Piecewise-constant acceleration; travel time cross-checked with Dormand–Prince.',
    ),
    method: L(
      'Cập nhật chính xác từng đoạn, Δt = 1/240 s.',
      'Exact piecewise update, Δt = 1/240 s.',
    ),
    userIntervened: false,
    sources: [SRC.sgk10, SRC.halliday],
  };
}

const mass = (key: 'm1' | 'm2', sym: string): ParamDef => ({
  key,
  label: key === 'm1' ? L('Khối lượng m₁', 'Mass m₁') : L('Khối lượng m₂', 'Mass m₂'),
  symbol: sym,
  kind: 'number',
  dim: DIM.mass,
  unit: 'kg',
  min: 0.05,
  max: 20,
  step: 0.05,
});

const notAtwood = (p: Params) => Math.round(p.config ?? 0) !== 0;

function validate(p: Params): LocalizedText[] {
  const q = pulleyInput(p);
  return q.muK > q.muS + 1e-12
    ? [
        L(
          'Hệ số ma sát trượt phải ≤ hệ số ma sát nghỉ.',
          'Kinetic friction must not exceed static friction.',
        ),
      ]
    : [];
}

export const pulley: PhysicsScene = {
  id: 'pulley',
  required: ['m1', 'm2'],
  engineId: 'phys.pulley',
  title: L('Ròng rọc – dây nối', 'Pulleys and strings'),
  usesGravity: true,
  params: [
    {
      key: 'config',
      label: L('Cách bố trí', 'Arrangement'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: 0, label: L('Máy Atwood', 'Atwood machine') },
        { value: 1, label: L('m₁ trên bàn', 'm₁ on a table') },
        { value: 2, label: L('m₁ trên dốc', 'm₁ on an incline') },
      ],
    },
    mass('m1', 'm_1'),
    mass('m2', 'm_2'),
    {
      key: 'theta',
      label: L('Góc nghiêng', 'Incline angle'),
      symbol: '\\theta',
      kind: 'number',
      unit: 'deg',
      min: 5,
      max: 75,
      step: 1,
      when: (p) => Math.round(p.config ?? 0) === 2,
    },
    {
      key: 'muS',
      label: L('Hệ số ma sát nghỉ', 'Static friction coefficient'),
      symbol: '\\mu_n',
      kind: 'number',
      min: 0,
      max: 1.5,
      step: 0.01,
      when: notAtwood,
    },
    {
      key: 'muK',
      label: L('Hệ số ma sát trượt', 'Kinetic friction coefficient'),
      symbol: '\\mu_t',
      kind: 'number',
      min: 0,
      max: 1.5,
      step: 0.01,
      when: notAtwood,
    },
    {
      key: 'travel',
      label: L('Quãng đường dịch chuyển tối đa', 'Maximum travel'),
      symbol: 'd',
      kind: 'number',
      dim: DIM.length,
      unit: 'm',
      min: 0.2,
      max: 3,
      step: 0.1,
    },
    gravityParam,
  ],
  defaults: {
    config: 1,
    m1: 2,
    m2: 1,
    theta: Math.PI / 6,
    muS: 0.25,
    muK: 0.2,
    travel: 1.2,
    g: 9.81,
  },
  validate,
  autoDefaults: pairFriction,
  scienceCard: card,
  solve,
  graphs,
  bodies,
  view,
  draw,
};
