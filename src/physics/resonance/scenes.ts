import type { Locale } from '@/app/i18n/types';
import type { LocalizedText } from '@/core/data/dataset';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { L, massParam } from '../common/scene-helpers';
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
import { gammaOf, omega0 } from '../spring/model';
import type {
  Answer,
  DrawContext,
  GraphDef,
  ParamDef,
  Params,
  PhysicsScene,
  Solution,
  SolutionStep,
  WorldBounds,
} from '../types';
import { numericAmplitude } from './check';
import { RE } from './engine';
import { amplitudeAt, forced, resonance, steady, type Forced } from './model';

const LEN = 0.3;
const BLOCK = 0.05;

/** Largest |x| the motion can reach: the steady amplitude plus a bound on the free part. */
function reach(o: Forced): number {
  const { A, phi } = steady(o);
  const xh0 = o.x0 - A * Math.cos(phi);
  const vh0 = o.v0 - A * o.W * Math.sin(phi);
  return A + Math.abs(xh0) + Math.abs(vh0) / omega0(o);
}

function view(p: Params): WorldBounds {
  const r = Math.max(reach(forced(p)), 0.02);
  const wall = -LEN - BLOCK / 2;
  return {
    xMin: wall - 0.08,
    xMax: Math.max(r, LEN * 0.5) + BLOCK + 0.08,
    yMin: -0.12,
    yMax: 0.22,
  };
}

function validate(p: Params): LocalizedText[] {
  const o = forced(p);
  const errors: LocalizedText[] = [];
  if (!(o.m > 0 && o.k > 0)) {
    errors.push(
      L('Khối lượng và độ cứng phải lớn hơn 0.', 'Mass and stiffness must be greater than 0.'),
    );
  }
  if (!(o.b > 0)) {
    errors.push(
      L(
        'Cần có lực cản (b > 0): không có cản thì biên độ tăng mãi khi Ω = ω₀ và không có dao động ổn định.',
        'Damping is needed (b > 0): without it the amplitude grows forever at Ω = ω₀ and there is no steady motion.',
      ),
    );
  }
  if (!(o.W > 0)) {
    errors.push(
      L(
        'Tần số góc của ngoại lực phải lớn hơn 0.',
        'The driving angular frequency must be greater than 0.',
      ),
    );
  }
  return errors;
}

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const o = forced(p);
  const x = state[RE.x] ?? 0;
  const wall = -LEN - BLOCK / 2;
  ground(ctx, cam, 0, c);
  line(ctx, cam, wall, 0, wall, BLOCK * 2, c.ground, 3);
  drawSpring(ctx, cam, wall, BLOCK / 2, x - BLOCK / 2, BLOCK / 2, c.spring, 14);
  line(ctx, cam, 0, -BLOCK * 0.4, 0, BLOCK * 1.8, c.faint, 1, [5, 5]);
  text(ctx, cam, 0, BLOCK * 1.8, 'O', c.muted, 'center', { x: 0, y: -2 });
  block(ctx, cam, x, BLOCK / 2, BLOCK, BLOCK, 0, c.body, c.text, 'm');
  if (opts.vectors) {
    // The driving force F = F₀ cos Ωt pushes on the block (length shows the direction only).
    const kf = vectorScale(o.F0, LEN, 0.25);
    arrow(ctx, cam, x, BLOCK * 1.25, (state[RE.Fd] ?? 0) * kf, 0, c.force, 'F');
  }
  const v = view(p);
  text(
    ctx,
    cam,
    v.xMin,
    v.yMax,
    `k = ${fmtQty(opts.locale, o.k, 'N/m')}, m = ${fmtQty(opts.locale, o.m, 'kg')}, F = ${fmtQty(opts.locale, o.F0, 'N')}·cos(${fmtQty(opts.locale, o.W, 'rad/s')}·t)`,
    c.muted,
    'left',
    { x: 60, y: 18 },
  );
}

/** The A(Ω) curve from Ω ≈ 0 to 3ω₀ (or past the chosen Ω), in SI. */
export function amplitudeCurve(p: Params, steps = 240): [number, number][] {
  const o = forced(p);
  const top = Math.max(3 * omega0(o), 1.3 * o.W);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const W = (top * (i + 0.5)) / (steps + 1);
    return [W, amplitudeAt(o, W)];
  });
}

const graphs: GraphDef[] = [
  {
    id: 'position',
    title: L('Li độ theo thời gian', 'Displacement vs time'),
    yLabel: L('x (m)', 'x (m)'),
    series: [{ id: 'x', label: L('x', 'x'), value: (s) => s[RE.x] ?? 0 }],
  },
  {
    id: 'resonance',
    title: L('Biên độ theo tần số góc của ngoại lực', 'Amplitude vs driving angular frequency'),
    yLabel: L('Biên độ (m)', 'Amplitude (m)'),
    x: { label: L('Ω (rad/s)', 'Ω (rad/s)'), value: (_s, p) => forced(p).W },
    // √(x² + (v/Ω)²): the amplitude the motion has now; it settles on the curve as the free part dies.
    series: [
      {
        id: 'amp',
        label: L('Biên độ lúc này', 'Amplitude now'),
        value: (s, p) => Math.hypot(s[RE.x] ?? 0, (s[RE.v] ?? 0) / forced(p).W),
      },
    ],
    guides: (p) => [
      { label: L('Biên độ ổn định A(Ω)', 'Steady amplitude A(Ω)'), points: amplitudeCurve(p) },
    ],
  },
];

function solve(p: Params, locale: Locale): Solution {
  const o = forced(p);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const w0 = omega0(o);
  const g = gammaOf(o);
  const { A, phi } = steady(o);
  const res = resonance(o);
  const steps: SolutionStep[] = [
    {
      text: L('Tần số góc riêng và hệ số tắt dần:', 'Natural angular frequency and decay rate:'),
      tex: `\\omega_0 = \\sqrt{\\frac{k}{m}} = ${Q(w0, 'rad/s')},\\quad \\gamma = \\frac{b}{2m} = ${texNum(locale, g)}\\,\\mathrm{s^{-1}}`,
    },
    {
      text: L(
        'Khi dao động đã ổn định, vật dao động với tần số góc của ngoại lực Ω và biên độ:',
        'Once steady, the body oscillates at the driving angular frequency Ω with amplitude:',
      ),
      tex: `A = \\frac{F_0/m}{\\sqrt{(\\omega_0^2 - \\Omega^2)^2 + 4\\gamma^2\\Omega^2}} = ${Q(A, 'm')}`,
    },
    {
      text: L(
        'Độ lệch pha so với ngoại lực (li độ chậm pha hơn):',
        'Phase lag behind the driving force:',
      ),
      tex: `\\tan\\varphi = \\frac{2\\gamma\\Omega}{\\omega_0^2 - \\Omega^2},\\quad \\varphi = ${Q(phi, 'rad')}`,
    },
    res
      ? {
          text: L(
            'Cộng hưởng: biên độ lớn nhất khi tần số góc của ngoại lực bằng:',
            'Resonance: the amplitude is largest when the driving angular frequency is:',
          ),
          tex: `\\Omega_r = \\sqrt{\\omega_0^2 - 2\\gamma^2} = ${Q(res.W, 'rad/s')},\\quad A_{\\max} = ${Q(res.A, 'm')}`,
        }
      : {
          text: L(
            'Lực cản lớn (2γ² ≥ ω₀²): không có đỉnh cộng hưởng, biên độ chỉ giảm khi Ω tăng.',
            'Strong damping (2γ² ≥ ω₀²): no resonance peak, the amplitude only falls as Ω grows.',
          ),
        },
  ];
  const chk = numericAmplitude(o);
  const answers: Answer[] = [
    {
      id: 'A',
      label: L('Biên độ dao động ổn định', 'Steady amplitude'),
      value: A,
      unit: 'm',
      ...(chk === null ? {} : { check: chk }),
    },
    { id: 'phi', label: L('Độ lệch pha φ', 'Phase lag φ'), value: phi, unit: 'rad' },
    {
      id: 'omega0',
      label: L('Tần số góc riêng', 'Natural angular frequency'),
      value: w0,
      unit: 'rad/s',
    },
    ...(res
      ? [
          {
            id: 'omegaR',
            label: L('Tần số góc cộng hưởng', 'Resonance angular frequency'),
            value: res.W,
            unit: 'rad/s',
          },
        ]
      : []),
  ];
  return { answers, steps };
}

function card(): ScienceCardData {
  return {
    title: L('Dao động cưỡng bức và cộng hưởng', 'Forced oscillation and resonance'),
    model: L(
      'Vật gắn lò xo nằm ngang, chịu lực cản nhớt và ngoại lực điều hoà F = F₀cos(Ωt). Lúc đầu là tổng của dao động riêng tắt dần và dao động cưỡng bức; dao động riêng tắt dần đi, còn lại dao động ổn định với tần số góc của ngoại lực.',
      'A body on a horizontal spring with viscous damping and a driving force F = F₀cos(Ωt). At first the motion is the damped free oscillation plus the forced one; the free part dies out and the steady motion at the driving frequency remains.',
    ),
    equations: [
      {
        tex: 'm\\ddot{x} + b\\dot{x} + kx = F_0\\cos(\\Omega t)',
        label: L('Định luật II Newton', 'Newton’s second law'),
      },
      {
        tex: 'x_p = A\\cos(\\Omega t - \\varphi),\\quad A = \\frac{F_0/m}{\\sqrt{(\\omega_0^2-\\Omega^2)^2 + 4\\gamma^2\\Omega^2}}',
        label: L(
          'Dao động ổn định (γ = b/2m, ω₀ = √(k/m))',
          'Steady motion (γ = b/2m, ω₀ = √(k/m))',
        ),
      },
      {
        tex: '\\Omega_r = \\sqrt{\\omega_0^2 - 2\\gamma^2}',
        label: L(
          'Tần số góc cộng hưởng (khi 2γ² < ω₀²)',
          'Resonance angular frequency (when 2γ² < ω₀²)',
        ),
      },
    ],
    assumptions: [
      L(
        'Lò xo lí tưởng (lực đàn hồi tỉ lệ li độ), lực cản tỉ lệ vận tốc, không ma sát với mặt sàn.',
        'Ideal spring (force proportional to displacement), damping proportional to velocity, no friction with the floor.',
      ),
      L(
        'Ngoại lực có biên độ và tần số không đổi, tác dụng dọc theo trục lò xo.',
        'The driving force has constant amplitude and frequency, along the spring.',
      ),
      L(
        'Trên hình, mũi tên F chỉ hướng của ngoại lực; độ dài không theo độ lớn.',
        'In the picture the F arrow shows the direction of the driving force; its length is not to scale.',
      ),
    ],
    validity: L(
      'Đúng với dao động nhỏ (lò xo còn tuyến tính) và b > 0. Không có cản, khi Ω = ω₀ biên độ tăng mãi: ngoài mô hình này.',
      'Holds for small oscillations (spring still linear) and b > 0. Without damping, at Ω = ω₀ the amplitude grows forever: outside this model.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Vị trí tính thẳng từ t (nghiệm giải tích, không cộng dồn). Biên độ ổn định được kiểm chéo bằng tích phân Dormand–Prince phương trình chuyển động sau khi dao động riêng đã tắt.',
      'Positions come straight from t (closed form, nothing accumulates). The steady amplitude is cross-checked by Dormand–Prince integration of the equation of motion after the free part has died out.',
    ),
    method: L(
      'Nghiệm giải tích: dao động ổn định dạng đóng cộng dao động riêng tắt dần (bản đồ chuyển trạng thái chính xác); bước Δt = 1/240 s chỉ để vẽ.',
      'Closed form: the steady part plus the damped free part (exact transition map); the step Δt = 1/240 s is only for drawing.',
    ),
    userIntervened: false,
    sources: [SRC.sgk11kntt, SRC.halliday, SRC.hairer],
  };
}

const number = (def: Omit<ParamDef, 'kind'>): ParamDef => ({ ...def, kind: 'number' });

export const forcedOscillation: PhysicsScene = {
  id: 'forcedOscillation',
  engineId: 'phys.resonance',
  title: L('Dao động cưỡng bức và cộng hưởng', 'Forced oscillation and resonance'),
  required: ['m', 'k', 'b', 'F0', 'Omega'],
  usesGravity: false,
  params: [
    number({
      key: 'Omega',
      label: L('Tần số góc của ngoại lực', 'Driving angular frequency'),
      symbol: '\\Omega',
      dim: DIM.frequency,
      unit: 'rad/s',
      min: 0.5,
      max: 30,
      step: 0.01,
    }),
    number({
      key: 'F0',
      label: L('Biên độ ngoại lực', 'Driving force amplitude'),
      symbol: 'F_0',
      dim: DIM.force,
      unit: 'N',
      min: 0.1,
      max: 10,
      step: 0.01,
    }),
    number({
      key: 'b',
      label: L('Hệ số cản nhớt', 'Viscous damping coefficient'),
      symbol: 'b',
      dim: DIM.damping,
      unit: 'kg/s',
      min: 0.1,
      max: 10,
      step: 0.01,
    }),
    massParam('m', 1),
    number({
      key: 'k',
      label: L('Độ cứng lò xo', 'Spring stiffness'),
      symbol: 'k',
      dim: DIM.springConstant,
      unit: 'N/m',
      min: 5,
      max: 200,
      step: 0.1,
    }),
    number({
      key: 'x0',
      label: L('Li độ ban đầu', 'Initial displacement'),
      symbol: 'x_0',
      dim: DIM.length,
      unit: 'm',
      min: -0.2,
      max: 0.2,
      step: 0.001,
    }),
  ],
  defaults: { Omega: 8, F0: 1, b: 0.5, m: 0.5, k: 50, x0: 0 },
  validate,
  scienceCard: card,
  solve,
  graphs,
  bodies: [],
  view,
  draw,
};
