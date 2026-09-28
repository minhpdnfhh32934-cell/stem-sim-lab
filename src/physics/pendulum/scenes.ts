import type { Locale } from '@/app/i18n/types';
import { pendulumPeriodExact, pendulumPeriodSmallAngle } from '@/core/math/special';
import { dopri5 } from '@/core/ode/dopri5';
import { DIM } from '@/core/units';
import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { L, gravityParam, massParam } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import { arrow, circle, line, polyline, text, vectorScale } from '../render/draw';
import type {
  Answer,
  BodyDef,
  DrawContext,
  GraphDef,
  Params,
  PhysicsScene,
  Solution,
  SolutionStep,
  WorldBounds,
} from '../types';
import { PE, pendulumInput, type PendulumInput } from './engine';

/** Turning angle θmax from energy (may exceed π → the pendulum loops over the top). */
export function maxAngle(q: PendulumInput): number | null {
  const c = Math.cos(q.theta0) - (q.L * q.omega0 * q.omega0) / (2 * q.g);
  if (c <= -1) return null; // goes over the top
  return Math.acos(c);
}

const bob = (q: PendulumInput, th: number) => ({ x: q.L * Math.sin(th), y: -q.L * Math.cos(th) });

function view(p: Params): WorldBounds {
  const q = pendulumInput(p);
  return { xMin: -1.25 * q.L, xMax: 1.25 * q.L, yMin: -1.3 * q.L, yMax: 0.35 * q.L };
}

const body: BodyDef = {
  id: 'bob',
  label: L('Quả nặng', 'Bob'),
  position: (s, p) => bob(pendulumInput(p), s[PE.th] ?? 0),
  radius: (p) => 0.06 * pendulumInput(p).L,
  draggable: true,
  properties: (s, p) => {
    const q = pendulumInput(p);
    return [
      { label: L('Li độ góc', 'Angle'), symbol: '\\alpha', value: s[PE.th] ?? 0, unit: 'deg' },
      {
        label: L('Tốc độ góc', 'Angular velocity'),
        symbol: '\\omega',
        value: s[PE.om] ?? 0,
        unit: 'rad/s',
      },
      {
        label: L('Tốc độ dài', 'Speed'),
        symbol: 'v',
        value: Math.abs((s[PE.om] ?? 0) * q.L),
        unit: 'm/s',
      },
      { label: L('Lực căng dây', 'String tension'), symbol: 'T', value: s[PE.T] ?? 0, unit: 'N' },
      {
        label: L('Góc theo mô hình góc nhỏ', 'Small-angle model angle'),
        symbol: '\\alpha_{nhỏ}',
        value: s[PE.thS] ?? 0,
        unit: 'deg',
      },
    ];
  },
};

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const q = pendulumInput(p);
  const th = state[PE.th] ?? 0;
  const thS = state[PE.thS] ?? 0;
  line(ctx, cam, -0.3 * q.L, 0, 0.3 * q.L, 0, c.ground, 3);
  line(ctx, cam, 0, 0, 0, -1.1 * q.L, c.faint, 1, [4, 5]);
  // Swing arc (turning points).
  const tm = maxAngle(q);
  if (tm !== null) {
    const arc = [];
    for (let i = 0; i <= 40; i++) arc.push(bob(q, -tm + (2 * tm * i) / 40));
    polyline(ctx, cam, arc, c.faint, 1, [2, 4]);
  }
  const r = 0.06 * q.L;
  if ((p.showSmall ?? 1) > 0.5) {
    const b2 = bob(q, thS);
    line(ctx, cam, 0, 0, b2.x, b2.y, c.faint, 1.2, [6, 4]);
    circle(ctx, cam, b2.x, b2.y, r, 'transparent', c.velocity, 5);
    text(
      ctx,
      cam,
      b2.x,
      b2.y,
      opts.locale === 'vi' ? 'góc nhỏ' : 'small-angle',
      c.velocity,
      'left',
      { x: 10, y: 14 },
    );
  }
  const b = bob(q, th);
  line(ctx, cam, 0, 0, b.x, b.y, c.text, 1.8);
  circle(ctx, cam, 0, 0, 0.015 * q.L, c.text, undefined, 3);
  circle(ctx, cam, b.x, b.y, r, opts.selected === 'bob' ? c.accent : c.body, c.text, 6);
  text(ctx, cam, 0, 0, `α = ${fmtQty(opts.locale, th, 'deg', 3)}`, c.muted, 'left', {
    x: 10,
    y: 18,
  });
  if (opts.vectors) {
    const om = state[PE.om] ?? 0;
    const vmax = Math.sqrt(2 * q.g * q.L * 2);
    const kv = vectorScale(vmax, q.L, 0.35);
    // Velocity is tangent: L ω (cos θ, sin θ).
    arrow(
      ctx,
      cam,
      b.x,
      b.y,
      q.L * om * Math.cos(th) * kv,
      q.L * om * Math.sin(th) * kv,
      c.velocity,
      'v',
    );
    const kf = vectorScale(q.m * q.g * 3, q.L, 0.35);
    arrow(ctx, cam, b.x, b.y, 0, -q.m * q.g * kf, c.force, 'P');
    const T = state[PE.T] ?? 0;
    arrow(ctx, cam, b.x, b.y, -Math.sin(th) * T * kf, Math.cos(th) * T * kf, c.acceleration, 'T');
  }
}

const graphs: GraphDef[] = [
  {
    id: 'angle',
    title: L('Li độ góc: phi tuyến và góc nhỏ', 'Angle: nonlinear vs small-angle'),
    yLabel: L('α (rad)', 'α (rad)'),
    series: [
      { id: 'th', label: L('α (chính xác)', 'α (exact model)'), value: (s) => s[PE.th] ?? 0 },
      {
        id: 'thS',
        label: L('α (gần đúng góc nhỏ)', 'α (small-angle)'),
        value: (s) => s[PE.thS] ?? 0,
      },
    ],
  },
  {
    id: 'omega',
    title: L('Tốc độ góc', 'Angular velocity'),
    yLabel: L('ω (rad/s)', 'ω (rad/s)'),
    series: [{ id: 'om', label: L('ω', 'ω'), value: (s) => s[PE.om] ?? 0 }],
  },
  {
    id: 'energy',
    title: L('Năng lượng', 'Energy'),
    yLabel: L('Năng lượng (J)', 'Energy (J)'),
    series: [
      {
        id: 'K',
        label: L('Động năng', 'Kinetic'),
        value: (s, p) => 0.5 * (p.m ?? 1) * ((p.L ?? 1) * (s[PE.om] ?? 0)) ** 2,
      },
      {
        id: 'U',
        label: L('Thế năng', 'Potential'),
        value: (s, p) => (p.m ?? 1) * (p.g ?? 9.81) * (p.L ?? 1) * (1 - Math.cos(s[PE.th] ?? 0)),
      },
      {
        id: 'E',
        label: L('Cơ năng', 'Total'),
        value: (s, p) =>
          0.5 * (p.m ?? 1) * ((p.L ?? 1) * (s[PE.om] ?? 0)) ** 2 +
          (p.m ?? 1) * (p.g ?? 9.81) * (p.L ?? 1) * (1 - Math.cos(s[PE.th] ?? 0)),
      },
    ],
  },
  {
    id: 'tension',
    title: L('Lực căng dây', 'String tension'),
    yLabel: L('T (N)', 'T (N)'),
    series: [{ id: 'T', label: L('T', 'T'), value: (s) => s[PE.T] ?? 0 }],
  },
];

/** Period measured by high-accuracy integration: twice the time between zero crossings. */
export function numericPeriodPendulum(q: PendulumInput): number | null {
  if (q.c !== 0 || maxAngle(q) === null) return null;
  const T0 = pendulumPeriodSmallAngle(q.L, q.g);
  const r = dopri5(
    (_t, y, d) => {
      d[0] = y[1] ?? 0;
      d[1] = -(q.g / q.L) * Math.sin(y[0] ?? 0);
    },
    [q.theta0, q.omega0],
    0,
    6 * T0,
    { rtol: 1e-12, atol: 1e-14, events: [{ id: 'zero', g: (_t, y) => y[0] ?? 0 }] },
  );
  const [a, b] = r.events;
  return a && b ? 2 * (b.t - a.t) : null;
}

function solve(p: Params, locale: Locale): Solution {
  const q = pendulumInput(p);
  const n = (v: number) => texNum(locale, v);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const T0 = pendulumPeriodSmallAngle(q.L, q.g);
  const tm = maxAngle(q);
  const steps: SolutionStep[] = [
    {
      text: L('Chu kì theo gần đúng góc nhỏ (sin α ≈ α):', 'Small-angle period (sin α ≈ α):'),
      tex: `T_0 = 2\\pi\\sqrt{\\frac{l}{g}} = 2\\pi\\sqrt{\\frac{${n(q.L)}}{${n(q.g)}}} = ${Q(T0, 's')}`,
    },
  ];
  const answers: Answer[] = [
    {
      id: 'period_small',
      label: L('Chu kì gần đúng góc nhỏ T₀', 'Small-angle period T₀'),
      value: T0,
      unit: 's',
    },
  ];
  if (tm === null) {
    steps.push({
      text: L(
        'Vận tốc ban đầu đủ lớn để con lắc quay tròn qua điểm cao nhất: không có dao động.',
        'The initial speed is large enough to loop over the top: no oscillation.',
      ),
    });
    return { answers, steps };
  }
  const T = pendulumPeriodExact(q.L, q.g, tm);
  const chk = numericPeriodPendulum(q);
  steps.push({
    text: L('Biên độ góc (từ bảo toàn cơ năng):', 'Angular amplitude (from energy conservation):'),
    tex: `\\cos\\alpha_0 = \\cos\\alpha_{bđ} - \\frac{l\\,\\omega_{bđ}^2}{2g} \\Rightarrow \\alpha_0 = ${Q(tm, 'deg')}`,
  });
  steps.push({
    text: L(
      'Chu kì chính xác (phi tuyến) qua tích phân elliptic loại 1:',
      'Exact (nonlinear) period via the complete elliptic integral:',
    ),
    tex: `T = 4\\sqrt{\\frac{l}{g}}\\,K\\!\\left(\\sin\\frac{\\alpha_0}{2}\\right) = ${Q(T, 's')}\\quad \\left(\\frac{T}{T_0} - 1 = ${n((T / T0 - 1) * 100)}\\,\\%\\right)`,
  });
  const vmax = Math.sqrt(2 * q.g * q.L * (1 - Math.cos(tm)));
  steps.push({
    text: L(
      'Tốc độ cực đại (tại vị trí thấp nhất) và lực căng dây cực đại:',
      'Maximum speed (at the bottom) and maximum tension:',
    ),
    tex: `v_{max} = \\sqrt{2gl(1-\\cos\\alpha_0)} = ${Q(vmax, 'm/s')},\\quad T_{max} = mg(3 - 2\\cos\\alpha_0) = ${Q(q.m * q.g * (3 - 2 * Math.cos(tm)), 'N')}`,
  });
  const notes: LocalizedText[] = [];
  if (tm > (10 * Math.PI) / 180) {
    notes.push(
      L(
        `Biên độ ${fmtQty('vi', tm, 'deg', 3)} lớn hơn 10°: công thức góc nhỏ sai lệch ${((T / T0 - 1) * 100).toFixed(2).replace('.', ',')} % — xem hai con lắc lệch pha dần trên khung mô phỏng.`,
        `Amplitude ${fmtQty('en', tm, 'deg', 3)} exceeds 10°: the small-angle formula is off by ${((T / T0 - 1) * 100).toFixed(2)} % — watch the two pendulums drift apart.`,
      ),
    );
  }
  answers.push(
    { id: 'amplitude', label: L('Biên độ góc', 'Angular amplitude'), value: tm, unit: 'deg' },
    {
      id: 'period',
      label: L('Chu kì chính xác T', 'Exact period T'),
      value: T,
      unit: 's',
      ...(chk ? { check: chk } : {}),
    },
    { id: 'v_max', label: L('Tốc độ cực đại', 'Maximum speed'), value: vmax, unit: 'm/s' },
    {
      id: 'tension_max',
      label: L('Lực căng cực đại', 'Maximum tension'),
      value: q.m * q.g * (3 - 2 * Math.cos(tm)),
      unit: 'N',
    },
  );
  return { answers, steps, notes };
}

function card(p: Params): ScienceCardData {
  const q = pendulumInput(p);
  const damped = q.c > 0;
  return {
    title: L('Con lắc đơn', 'Simple pendulum'),
    model: L(
      'Chất điểm treo vào dây nhẹ, không dãn, điểm treo cố định; dao động trong mặt phẳng thẳng đứng. Giải phương trình phi tuyến đầy đủ, hiển thị song song mô hình góc nhỏ.',
      'Point mass on a light inextensible string from a fixed pivot, planar motion. The full nonlinear equation is solved, with the small-angle model shown alongside.',
    ),
    equations: [
      {
        tex:
          '\\ddot{\\alpha} = -\\frac{g}{l}\\sin\\alpha' + (damped ? ' - c\\,\\dot{\\alpha}' : ''),
        label: L('Phi tuyến (chính xác)', 'Nonlinear (exact model)'),
      },
      {
        tex: '\\ddot{\\alpha} \\approx -\\frac{g}{l}\\alpha,\\quad T_0 = 2\\pi\\sqrt{l/g}',
        label: L('Gần đúng góc nhỏ', 'Small-angle approximation'),
      },
      { tex: 'T = 4\\sqrt{l/g}\\,K(\\sin(\\alpha_0/2))' },
    ],
    assumptions: [
      L(
        'Dây luôn căng (T > 0), khối lượng dây không đáng kể.',
        'The string stays taut (T > 0) and is massless.',
      ),
      damped
        ? L(
            'Lực cản tỉ lệ tốc độ góc (mô hình giản lược).',
            'Damping proportional to angular velocity (simplified model).',
          )
        : L(
            'Bỏ qua lực cản không khí và ma sát ở điểm treo.',
            'Air resistance and pivot friction neglected.',
          ),
    ],
    validity: L(
      'Công thức góc nhỏ chỉ đúng khi α₀ ≲ 10° (sai số < 0,2 %). Mô hình phi tuyến đúng với mọi biên độ khi dây còn căng.',
      'The small-angle formula holds only for α₀ ≲ 10° (error < 0.2 %). The nonlinear model holds at any amplitude while the string is taut.',
    ),
    confidence: damped ? 'approx' : 'exact',
    confidenceNote: damped
      ? L(
          'Có lực cản: không có nghiệm giải tích đóng; kết quả là tích phân số RK4 bước rất nhỏ.',
          'With damping there is no closed form; results are fine-step RK4 integration.',
        )
      : L(
          'Chu kì đo từ mô phỏng khớp công thức tích phân elliptic (kiểm chứng Dormand–Prince, sai lệch < 10⁻⁹).',
          'The simulated period matches the elliptic-integral formula (Dormand–Prince check, deviation < 10⁻⁹).',
        ),
    ...(damped ? { estimatedError: 1e-9 } : {}),
    method: L(
      'RK4 với 8 bước con mỗi Δt = 1/240 s (h ≈ 0,52 ms); mô hình góc nhỏ dùng nghiệm chính xác.',
      'RK4 with 8 substeps per Δt = 1/240 s (h ≈ 0.52 ms); the small-angle model uses its exact solution.',
    ),
    userIntervened: false,
    sources: [SRC.sgk11, SRC.landau, SRC.halliday, SRC.hairer],
  };
}

export const simplePendulum: PhysicsScene = {
  id: 'simplePendulum',
  engineId: 'phys.pendulum',
  title: L('Con lắc đơn', 'Simple pendulum'),
  usesGravity: true,
  params: [
    {
      key: 'L',
      label: L('Chiều dài dây', 'String length'),
      symbol: 'l',
      kind: 'number',
      dim: DIM.length,
      unit: 'm',
      min: 0.1,
      max: 10,
      step: 0.01,
    },
    {
      key: 'theta0',
      label: L('Li độ góc ban đầu', 'Initial angle'),
      symbol: '\\alpha_{bđ}',
      kind: 'number',
      unit: 'deg',
      min: -179,
      max: 179,
      step: 1,
    },
    {
      key: 'omega0',
      label: L('Tốc độ góc ban đầu', 'Initial angular velocity'),
      symbol: '\\omega_{bđ}',
      kind: 'number',
      dim: DIM.frequency,
      unit: 'rad/s',
      min: -10,
      max: 10,
      step: 0.01,
    },
    massParam('m', 10),
    {
      key: 'c',
      label: L('Hệ số cản (theo góc)', 'Angular damping'),
      symbol: 'c',
      kind: 'number',
      dim: DIM.frequency,
      unit: 'Hz',
      min: 0,
      max: 2,
      step: 0.01,
    },
    {
      key: 'showSmall',
      label: L('Hiện con lắc theo gần đúng góc nhỏ', 'Show small-angle pendulum'),
      symbol: '',
      kind: 'toggle',
    },
    gravityParam,
  ],
  // 60° amplitude: the small-angle formula is ~7 % off, clearly visible.
  defaults: { L: 1, theta0: Math.PI / 3, omega0: 0, m: 0.5, c: 0, showSmall: 1, g: 9.81 },
  scienceCard: card,
  solve,
  graphs,
  bodies: [body],
  view,
  draw,
  trail: (s, p) => [bob(pendulumInput(p), s[PE.th] ?? 0)],
};
