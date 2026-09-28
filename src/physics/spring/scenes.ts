import type { Locale } from '@/app/i18n/types';
import { dopri5 } from '@/core/ode/dopri5';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { L, gravityParam, massParam } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import {
  arrow,
  block,
  ground,
  line,
  spring as drawSpring,
  text,
  vectorScale,
} from '../render/draw';
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
import { SP, springInput, staticExtension, type SpringInput } from './engine';
import { amplitudePhase, gammaOf, omega0, period, regime } from './model';

const blockSize = (q: SpringInput) => Math.max(0.04, 0.25 * q.l0);

function bounds(q: SpringInput) {
  const A = amplitudePhase(q, q.x0, q.v0).A;
  const bs = blockSize(q);
  const len = q.l0 + staticExtension(q);
  return { A, bs, len };
}

function view(p: Params): WorldBounds {
  const q = springInput(p);
  const { A, bs, len } = bounds(q);
  const span = len + A + bs;
  if (q.vertical) {
    return { xMin: -span * 0.9, xMax: span * 0.9, yMin: -A - bs * 1.5, yMax: len + bs * 1.2 };
  }
  return { xMin: -len - bs, xMax: A + bs * 2, yMin: -span * 0.35, yMax: span * 0.45 };
}

const body: BodyDef = {
  id: 'mass',
  label: L('Vật nặng', 'Mass'),
  position: (s, p) =>
    springInput(p).vertical
      ? { x: 0, y: s[SP.x] ?? 0 }
      : { x: s[SP.x] ?? 0, y: blockSize(springInput(p)) / 2 },
  radius: (p) => blockSize(springInput(p)) / 2,
  draggable: true,
  properties: (s) => [
    {
      label: L('Li độ (so với VTCB)', 'Displacement (from equilibrium)'),
      symbol: 'x',
      value: s[SP.x] ?? 0,
      unit: 'cm',
    },
    { label: L('Vận tốc', 'Velocity'), symbol: 'v', value: s[SP.v] ?? 0, unit: 'm/s' },
    { label: L('Gia tốc', 'Acceleration'), symbol: 'a', value: s[SP.a] ?? 0, unit: 'm/s^2' },
    {
      label: L('Độ biến dạng lò xo', 'Spring extension'),
      symbol: '\\Delta l',
      value: s[SP.ext] ?? 0,
      unit: 'cm',
    },
    { label: L('Lực đàn hồi', 'Spring force'), symbol: 'F_{đh}', value: s[SP.F] ?? 0, unit: 'N' },
  ],
};

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const q = springInput(p);
  const { bs, len, A } = bounds(q);
  const x = state[SP.x] ?? 0;
  if (q.vertical) {
    const ceil = len + bs / 2;
    line(ctx, cam, -bs * 2, ceil, bs * 2, ceil, c.ground, 3);
    drawSpring(ctx, cam, 0, ceil, 0, x + bs / 2, c.spring, 14);
    line(ctx, cam, -bs * 2.2, 0, bs * 2.2, 0, c.faint, 1, [5, 5]);
    text(ctx, cam, bs * 2.2, 0, opts.locale === 'vi' ? 'VTCB' : 'equilibrium', c.muted, 'left', {
      x: 4,
      y: 6,
    });
    const natural = ceil - q.l0 - bs / 2;
    line(ctx, cam, -bs * 1.6, natural, bs * 1.6, natural, c.faint, 1, [2, 4]);
    text(ctx, cam, -bs * 1.6, natural, `l₀`, c.muted, 'right', { x: -4, y: 6 });
    if (A > 0) {
      line(ctx, cam, bs * 1.4, A, bs * 1.8, A, c.faint, 1);
      line(ctx, cam, bs * 1.4, -A, bs * 1.8, -A, c.faint, 1);
    }
    block(ctx, cam, 0, x, bs, bs, 0, opts.selected === 'mass' ? c.accent : c.body, c.text, 'm');
    if (opts.vectors) {
      const k = vectorScale(Math.max(q.m * q.g, q.k * (staticExtension(q) + A)), len, 0.3);
      arrow(ctx, cam, bs * 0.25, x, 0, -q.m * q.g * k, c.force, 'P');
      arrow(ctx, cam, -bs * 0.25, x, 0, (state[SP.F] ?? 0) * k, c.velocity, 'Fđh');
    }
  } else {
    const wall = -len - bs / 2;
    ground(ctx, cam, 0, c);
    line(ctx, cam, wall, 0, wall, bs * 2, c.ground, 3);
    drawSpring(ctx, cam, wall, bs / 2, x - bs / 2, bs / 2, c.spring, 14);
    line(ctx, cam, 0, -bs * 0.4, 0, bs * 1.8, c.faint, 1, [5, 5]);
    text(ctx, cam, 0, bs * 1.8, 'O', c.muted, 'center', { x: 0, y: -2 });
    if (A > 0) {
      text(ctx, cam, A, 0, `+A`, c.muted, 'center', { x: 0, y: 16 });
      text(ctx, cam, -A, 0, `−A`, c.muted, 'center', { x: 0, y: 16 });
    }
    block(
      ctx,
      cam,
      x,
      bs / 2,
      bs,
      bs,
      0,
      opts.selected === 'mass' ? c.accent : c.body,
      c.text,
      'm',
    );
    if (opts.vectors) {
      const w = omega0(q);
      const kv = vectorScale(Math.max(w * A, 1e-6), len, 0.2);
      arrow(ctx, cam, x, bs * 1.15, (state[SP.v] ?? 0) * kv, 0, c.velocity, 'v');
      const kf = vectorScale(Math.max(q.k * A, 1e-6), len, 0.2);
      arrow(ctx, cam, x, bs * 0.5, (state[SP.F] ?? 0) * kf, 0, c.force, 'Fđh');
    }
  }
  text(
    ctx,
    cam,
    view(p).xMin,
    view(p).yMax,
    `k = ${fmtQty(opts.locale, q.k, 'N/m')}, m = ${fmtQty(opts.locale, q.m, 'kg')}`,
    c.muted,
    'left',
    { x: 60, y: 18 },
  );
}

function graphs(): GraphDef[] {
  return [
    {
      id: 'x',
      title: L('Li độ – thời gian', 'Displacement – time'),
      yLabel: L('x (m)', 'x (m)'),
      series: [{ id: 'x', label: L('x', 'x'), value: (s) => s[SP.x] ?? 0 }],
    },
    {
      id: 'v',
      title: L('Vận tốc và gia tốc', 'Velocity and acceleration'),
      yLabel: L('Giá trị (m/s; m/s²)', 'Value (m/s; m/s²)'),
      series: [
        { id: 'v', label: L('v (m/s)', 'v (m/s)'), value: (s) => s[SP.v] ?? 0 },
        { id: 'a', label: L('a (m/s²)', 'a (m/s²)'), value: (s) => s[SP.a] ?? 0 },
      ],
    },
    {
      id: 'energy',
      title: L('Năng lượng dao động', 'Oscillation energy'),
      yLabel: L('Năng lượng (J)', 'Energy (J)'),
      series: [
        {
          id: 'K',
          label: L('Động năng', 'Kinetic'),
          value: (s, p) => 0.5 * (p.m ?? 1) * (s[SP.v] ?? 0) ** 2,
        },
        {
          id: 'U',
          label: L('Thế năng (quanh VTCB)', 'Potential (about equilibrium)'),
          value: (s, p) => 0.5 * (p.k ?? 1) * (s[SP.x] ?? 0) ** 2,
        },
        {
          id: 'E',
          label: L('Cơ năng', 'Total'),
          value: (s, p) =>
            0.5 * (p.m ?? 1) * (s[SP.v] ?? 0) ** 2 + 0.5 * (p.k ?? 1) * (s[SP.x] ?? 0) ** 2,
        },
      ],
    },
    {
      id: 'force',
      title: L('Lực đàn hồi và độ biến dạng', 'Spring force and extension'),
      yLabel: L('Giá trị (N; m)', 'Value (N; m)'),
      series: [
        { id: 'F', label: L('F_đh (N)', 'F_s (N)'), value: (s) => s[SP.F] ?? 0 },
        { id: 'ext', label: L('Δl (m)', 'Δl (m)'), value: (s) => s[SP.ext] ?? 0 },
      ],
    },
  ];
}

/** Period measured independently: time between successive upward zero crossings (DOPRI5). */
export function numericPeriod(q: SpringInput): number | null {
  if (q.b > 0 || (q.x0 === 0 && q.v0 === 0)) return null;
  const w = omega0(q);
  const r = dopri5(
    (_t, y, d) => {
      d[0] = y[1] ?? 0;
      d[1] = -(q.k / q.m) * (y[0] ?? 0);
    },
    [q.x0, q.v0],
    0,
    (3 * 2 * Math.PI) / w,
    { rtol: 1e-12, atol: 1e-14, events: [{ id: 'up', g: (_t, y) => y[0] ?? 0, direction: 1 }] },
  );
  const [a, b] = r.events;
  return a && b ? b.t - a.t : null;
}

function solve(hooke: boolean) {
  return (p: Params, locale: Locale): Solution => {
    const q = springInput(p);
    const n = (v: number) => texNum(locale, v);
    const Q = (v: number, u: string) => texQty(locale, v, u);
    const w = omega0(q);
    const T = period(q);
    const { A, phi } = amplitudePhase(q, q.x0, q.v0);
    const steps: SolutionStep[] = [];
    const answers: Answer[] = [];
    if (q.vertical) {
      const dl = staticExtension(q);
      steps.push({
        text: L(
          'Tại vị trí cân bằng, lực đàn hồi cân bằng trọng lực (định luật Hooke):',
          'At equilibrium the spring force balances the weight (Hooke’s law):',
        ),
        tex: `k\\,\\Delta l_0 = mg \\;\\Rightarrow\\; \\Delta l_0 = \\frac{mg}{k} = \\frac{${n(q.m)}\\cdot ${n(q.g)}}{${n(q.k)}} = ${Q(dl, 'cm')}`,
      });
      steps.push({
        text: L('Chiều dài lò xo ở vị trí cân bằng:', 'Spring length at equilibrium:'),
        tex: `l = l_0 + \\Delta l_0 = ${Q(q.l0, 'cm')} + ${Q(dl, 'cm')} = ${Q(q.l0 + dl, 'cm')}`,
      });
      answers.push(
        {
          id: 'static_extension',
          label: L('Độ dãn ở VTCB', 'Static extension'),
          value: dl,
          unit: 'cm',
        },
        {
          id: 'spring_force',
          label: L('Lực đàn hồi ở VTCB', 'Spring force at equilibrium'),
          value: q.k * dl,
          unit: 'N',
        },
        {
          id: 'length_eq',
          label: L('Chiều dài ở VTCB', 'Length at equilibrium'),
          value: q.l0 + dl,
          unit: 'cm',
        },
      );
    }
    steps.push({
      text: L('Tần số góc và chu kì dao động:', 'Angular frequency and period:'),
      tex: `\\omega = \\sqrt{\\frac{k}{m}} = \\sqrt{\\frac{${n(q.k)}}{${n(q.m)}}} = ${Q(w, 'rad/s')},\\qquad T = \\frac{2\\pi}{\\omega} = ${Q(T, 's')}`,
    });
    const chk = numericPeriod(q);
    answers.push(
      { id: 'omega', label: L('Tần số góc', 'Angular frequency'), value: w, unit: 'rad/s' },
      {
        id: 'period',
        label: L('Chu kì', 'Period'),
        value: T,
        unit: 's',
        ...(chk ? { check: chk } : {}),
      },
      { id: 'frequency', label: L('Tần số', 'Frequency'), value: 1 / T, unit: 'Hz' },
    );
    if (q.b === 0) {
      steps.push({
        text: L(
          'Biên độ và pha ban đầu từ điều kiện đầu (x₀, v₀):',
          'Amplitude and initial phase from (x₀, v₀):',
        ),
        tex: `A = \\sqrt{x_0^2 + \\left(\\frac{v_0}{\\omega}\\right)^2} = ${Q(A, 'cm')},\\qquad \\varphi = ${n(phi)}\\,\\text{rad}`,
      });
      steps.push({
        text: L('Phương trình dao động và các giá trị cực đại:', 'Equation of motion and maxima:'),
        tex: `x = ${n(A * 100)}\\cos(${n(w)}\\,t ${phi >= 0 ? '+' : '-'} ${n(Math.abs(phi))})\\;\\text{cm},\\quad v_{max} = \\omega A = ${Q(w * A, 'm/s')},\\quad a_{max} = \\omega^2 A = ${Q(w * w * A, 'm/s^2')}`,
      });
      steps.push({
        text: L('Cơ năng (bảo toàn):', 'Mechanical energy (conserved):'),
        tex: `W = \\tfrac{1}{2} k A^2 = ${Q(0.5 * q.k * A * A, 'J')}`,
      });
      answers.push(
        { id: 'amplitude', label: L('Biên độ', 'Amplitude'), value: A, unit: 'cm' },
        { id: 'v_max', label: L('Tốc độ cực đại', 'Maximum speed'), value: w * A, unit: 'm/s' },
        {
          id: 'a_max',
          label: L('Gia tốc cực đại', 'Maximum acceleration'),
          value: w * w * A,
          unit: 'm/s^2',
        },
        {
          id: 'energy',
          label: L('Cơ năng', 'Mechanical energy'),
          value: 0.5 * q.k * A * A,
          unit: 'J',
        },
      );
    } else {
      const g = gammaOf(q);
      const reg = regime(q);
      steps.push({
        text:
          reg === 'under'
            ? L(
                'Dao động tắt dần (lực cản nhớt nhỏ): biên độ giảm theo hàm mũ.',
                'Underdamped: the amplitude decays exponentially.',
              )
            : reg === 'critical'
              ? L(
                  'Tắt dần tới hạn: vật về VTCB nhanh nhất mà không dao động.',
                  'Critically damped: returns fastest without oscillating.',
                )
              : L(
                  'Tắt dần mạnh (quá tới hạn): vật trở về VTCB từ từ, không dao động.',
                  'Overdamped: creeps back without oscillating.',
                ),
        tex: `\\gamma = \\frac{b}{2m} = ${Q(g, 'Hz')}${reg === 'under' ? `,\\quad \\omega_d = \\sqrt{\\omega^2 - \\gamma^2} = ${Q(Math.sqrt(w * w - g * g), 'rad/s')}` : ''}`,
      });
      answers.push({
        id: 'gamma',
        label: L('Hệ số tắt dần γ', 'Damping rate γ'),
        value: g,
        unit: 'Hz',
      });
    }
    if (hooke && !q.vertical) {
      steps.unshift({ text: L('Định luật Hooke: F = −k·x.', "Hooke's law: F = −k·x.") });
    }
    return { answers, steps };
  };
}

function card(hooke: boolean) {
  return (p: Params): ScienceCardData => {
    const q = springInput(p);
    return {
      title: hooke
        ? L('Lò xo – định luật Hooke', "Springs – Hooke's law")
        : L('Con lắc lò xo', 'Spring–mass oscillator'),
      model: L(
        q.b > 0
          ? 'Lò xo lý tưởng (tuân theo định luật Hooke), khối lượng không đáng kể; lực cản nhớt F = −b·v.'
          : 'Lò xo lý tưởng (tuân theo định luật Hooke), khối lượng không đáng kể; không ma sát.',
        q.b > 0
          ? 'Ideal massless Hookean spring; viscous drag F = −b·v.'
          : 'Ideal massless Hookean spring; no friction.',
      ),
      equations: [
        { tex: 'F_{đh} = -k\\,\\Delta l' },
        {
          tex:
            q.b > 0
              ? 'm\\ddot{x} + b\\dot{x} + kx = 0'
              : 'x = A\\cos(\\omega t + \\varphi),\\quad \\omega = \\sqrt{k/m}',
        },
        { tex: 'W = \\tfrac{1}{2} m v^2 + \\tfrac{1}{2} k x^2' },
      ],
      assumptions: [
        L(
          'Lò xo nằm trong giới hạn đàn hồi (lực tỉ lệ độ biến dạng).',
          'The spring stays within its elastic limit (force ∝ extension).',
        ),
        L('Vật chuyển động dọc trục lò xo.', 'The mass moves along the spring axis.'),
        ...(q.vertical
          ? [
              L(
                'Trọng lực chỉ dịch VTCB đi Δl₀ = mg/k, không đổi chu kì.',
                'Gravity only shifts equilibrium by Δl₀ = mg/k; the period is unchanged.',
              ),
            ]
          : []),
      ],
      validity: L(
        'Biến dạng nhỏ so với chiều dài lò xo; lò xo không bị nén sát vòng.',
        'Small deformations; the spring is never fully compressed.',
      ),
      confidence: 'exact',
      confidenceNote: L(
        'Engine dùng nghiệm giải tích chính xác của phương trình dao động để cập nhật từng bước (không có sai số cắt cụt); chu kì kiểm chứng bằng Dormand–Prince.',
        'The engine steps with the exact analytic solution (no truncation error); the period is cross-checked with Dormand–Prince.',
      ),
      method: L(
        'Ánh xạ chuyển trạng thái chính xác, Δt = 1/240 s.',
        'Exact state-transition map, Δt = 1/240 s.',
      ),
      userIntervened: false,
      sources: [SRC.sgk10, SRC.sgk11, SRC.halliday],
    };
  };
}

const kParam: ParamDef = {
  key: 'k',
  label: L('Độ cứng lò xo', 'Spring constant'),
  symbol: 'k',
  kind: 'number',
  dim: DIM.springConstant,
  unit: 'N/m',
  min: 1,
  max: 1000,
  step: 1,
};
const x0Param: ParamDef = {
  key: 'x0',
  label: L('Li độ ban đầu (so với VTCB)', 'Initial displacement (from equilibrium)'),
  symbol: 'x_0',
  kind: 'number',
  dim: DIM.length,
  unit: 'cm',
  min: -30,
  max: 30,
  step: 0.1,
};
const v0Param: ParamDef = {
  key: 'v0',
  label: L('Vận tốc ban đầu', 'Initial velocity'),
  symbol: 'v_0',
  kind: 'number',
  dim: DIM.velocity,
  unit: 'm/s',
  min: -5,
  max: 5,
  step: 0.01,
};
const bParam: ParamDef = {
  key: 'b',
  label: L('Hệ số cản nhớt', 'Viscous damping coefficient'),
  symbol: 'b',
  kind: 'number',
  dim: DIM.damping,
  unit: 'kg/s',
  min: 0,
  max: 20,
  step: 0.01,
};
const l0Param: ParamDef = {
  key: 'l0',
  label: L('Chiều dài tự nhiên', 'Natural length'),
  symbol: 'l_0',
  kind: 'number',
  dim: DIM.length,
  unit: 'cm',
  min: 5,
  max: 100,
  step: 1,
};
const orientation: ParamDef = {
  key: 'vertical',
  label: L('Cách treo', 'Orientation'),
  symbol: '',
  kind: 'choice',
  choices: [
    { value: 0, label: L('Nằm ngang', 'Horizontal') },
    { value: 1, label: L('Thẳng đứng', 'Vertical') },
  ],
};

const common = {
  engineId: 'phys.spring',
  usesGravity: true,
  graphs: graphs(),
  bodies: [body],
  view,
  draw,
};

export const hookeSpring: PhysicsScene = {
  ...common,
  id: 'hookeSpring',
  required: ['k', 'm'],
  title: L('Lò xo – định luật Hooke', "Springs – Hooke's law"),
  params: [orientation, massParam('m', 5), kParam, l0Param, x0Param, bParam, gravityParam],
  // 200 g hanging on a 50 N/m spring (Δl₀ ≈ 3.9 cm), released 2 cm below equilibrium.
  defaults: { vertical: 1, m: 0.2, k: 50, l0: 0.2, x0: -0.02, v0: 0, b: 0.05, g: 9.81 },
  scienceCard: card(true),
  solve: solve(true),
};

export const springPendulum: PhysicsScene = {
  ...common,
  id: 'springPendulum',
  required: ['m', 'k'],
  title: L('Con lắc lò xo', 'Spring–mass oscillator'),
  params: [orientation, massParam('m', 5), kParam, x0Param, v0Param, bParam, l0Param, gravityParam],
  defaults: { vertical: 0, m: 0.25, k: 100, x0: 0.05, v0: 0, b: 0, l0: 0.3, g: 9.81 },
  scienceCard: card(false),
  solve: solve(false),
};
