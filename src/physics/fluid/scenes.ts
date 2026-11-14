import { formatNumber } from '@/app/i18n';
import type { Locale } from '@/app/i18n/types';
import type { LocalizedText } from '@/core/data/dataset';
import { dopri5 } from '@/core/ode/dopri5';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { L, gravityParam } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import { arrow, circle, ground, line, polygon, text, vectorScale } from '../render/draw';
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
import { FL, runLength } from './engine';
import {
  CUSTOM_FLUID,
  RE_CONSTANT_CD,
  direction,
  dragB,
  fallInput,
  netWeight,
  reynolds,
  startAccel,
  terminalSpeed,
  travelTime,
  volume,
  type FallInput,
} from './model';

/**
 * Independent check: integrates m·dv/dt = (P − F_A) − b·v² along the motion, from rest, until
 * the column is crossed (event), and separately long enough to reach the terminal speed.
 */
export function numericFall(q: FallInput): { t: number; v: number; vt: number } | null {
  if (direction(q) === 0) return null;
  const W = Math.abs(netWeight(q));
  const b = dragB(q);
  const f = (_t: number, y: Float64Array, dy: Float64Array) => {
    const v = y[1] ?? 0;
    dy[0] = v;
    dy[1] = (W - b * v * Math.abs(v)) / (q.m + 0.5 * q.fluid.rho * volume(q));
  };
  const tau = terminalSpeed(q) / startAccel(q);
  const cross = dopri5(f, [0, 0], 0, 1000 * tau + 10 * travelTime(q), {
    rtol: 1e-12,
    atol: 1e-14,
    events: [{ id: 'end', g: (_t, y) => (y[0] ?? 0) - q.H, direction: 1, terminal: true }],
  });
  if (cross.stoppedBy !== 'end') return null;
  const late = dopri5(f, [0, 0], 0, 40 * tau, { rtol: 1e-12, atol: 1e-14 });
  return { t: cross.t, v: cross.y[1] ?? 0, vt: late.y[1] ?? 0 };
}

/** Horizontal place of the ball and of the vacuum comparison ball (fractions of H). */
const X_BALL = -0.08;
const X_VAC = 0.36;

function view(p: Params): WorldBounds {
  const q = fallInput(p);
  return { xMin: -0.45 * q.H, xMax: 0.45 * q.H, yMin: -0.08 * q.H, yMax: 1.1 * q.H };
}

const ball: BodyDef = {
  id: 'ball',
  label: L('Quả cầu', 'Sphere'),
  position: (s, p) => ({ x: X_BALL * fallInput(p).H, y: s[FL.y] ?? 0 }),
  radius: (p) => Math.max(fallInput(p).r, 0.015 * fallInput(p).H),
  draggable: false,
  properties: (s, p) => {
    const q = fallInput(p);
    return [
      { label: L('Vận tốc', 'Velocity'), symbol: 'v', value: s[FL.v] ?? 0, unit: 'm/s' },
      { label: L('Gia tốc', 'Acceleration'), symbol: 'a', value: s[FL.a] ?? 0, unit: 'm/s^2' },
      { label: L('Lực cản', 'Drag'), symbol: 'F_c', value: s[FL.Fd] ?? 0, unit: 'N' },
      { label: L('Trọng lực', 'Weight'), symbol: 'P', value: q.m * q.g, unit: 'N' },
      {
        label: L('Lực đẩy Archimedes', 'Upthrust'),
        symbol: 'F_A',
        value: q.fluid.rho * volume(q) * q.g,
        unit: 'N',
      },
    ];
  },
};

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const q = fallInput(p);
  const vis = cam.visible();
  const water = Math.round(p.fluid ?? 0) === 1;
  ground(ctx, cam, -q.r, c);
  if (water) {
    // The water surface and the walls of the column.
    const w = 0.3 * q.H;
    ctx.save();
    ctx.globalAlpha = 0.12;
    polygon(
      ctx,
      cam,
      [
        { x: -w, y: -q.r },
        { x: w, y: -q.r },
        { x: w, y: q.H + q.r },
        { x: -w, y: q.H + q.r },
      ],
      c.velocity,
    );
    ctx.restore();
    line(ctx, cam, -w, q.H + q.r, w, q.H + q.r, c.velocity, 2);
    line(ctx, cam, -w, -q.r, -w, q.H + 1.5 * q.r, c.muted, 1.5);
    line(ctx, cam, w, -q.r, w, q.H + 1.5 * q.r, c.muted, 1.5);
  }
  const x = X_BALL * q.H;
  const y = state[FL.y] ?? 0;
  const R = Math.max(q.r, 0.012 * q.H);
  if (direction(q) > 0) {
    // The same sphere in a vacuum, for comparison (no drag, no upthrust).
    const yv = state[FL.yVac] ?? q.H;
    circle(ctx, cam, X_VAC * q.H, Math.max(yv, 0), R, c.panel, c.muted, 5);
    text(
      ctx,
      cam,
      X_VAC * q.H,
      q.H,
      opts.locale === 'vi' ? 'chân không' : 'vacuum',
      c.muted,
      'center',
      {
        x: 0,
        y: -14,
      },
    );
  }
  circle(ctx, cam, x, y, R, opts.selected === 'ball' ? c.accent : c.body, c.text, 5);
  if (opts.vectors) {
    const W = q.m * q.g;
    const FA = q.fluid.rho * volume(q) * q.g;
    const Fd = state[FL.Fd] ?? 0;
    const k = vectorScale(Math.max(W, FA), vis.yMax - vis.yMin, 0.16);
    arrow(ctx, cam, x, y, 0, -W * k, c.force, 'P');
    if (FA > 1e-3 * W) arrow(ctx, cam, x - 0.6 * R, y, 0, FA * k, c.force, 'F_A');
    if (Math.abs(Fd) > 1e-3 * W) arrow(ctx, cam, x + 0.6 * R, y, 0, Fd * k, c.acceleration, 'F_c');
  }
  const v = Math.abs(state[FL.v] ?? 0);
  const vt = terminalSpeed(q);
  text(
    ctx,
    cam,
    vis.xMin,
    vis.yMax,
    `v = ${fmtQty(opts.locale, v, 'm/s', 4)}   v_gh = ${Number.isFinite(vt) ? fmtQty(opts.locale, vt, 'm/s', 4) : '—'}`,
    c.muted,
    'left',
    { x: 60, y: 20 },
  );
}

const graphs: GraphDef[] = [
  {
    id: 'speed',
    title: L('Tốc độ theo thời gian', 'Speed over time'),
    yLabel: L('v (m/s)', 'v (m/s)'),
    series: [
      { id: 'v', label: L('Có lực cản', 'With drag'), value: (s) => Math.abs(s[FL.v] ?? 0) },
      {
        id: 'vVac',
        label: L('Chân không', 'Vacuum'),
        value: (s) => Math.abs(s[FL.vVac] ?? 0),
        when: (p) => direction(fallInput(p)) > 0,
        dash: [6, 4],
      },
    ],
    guides: (p) => {
      const q = fallInput(p);
      if (direction(q) === 0) return [];
      const vt = terminalSpeed(q);
      return [
        {
          label: L('Tốc độ giới hạn', 'Terminal speed'),
          points: [
            [0, vt],
            [runLength(q), vt],
          ],
        },
      ];
    },
  },
  {
    id: 'forces',
    title: L('Các lực theo thời gian', 'Forces over time'),
    yLabel: L('F (N)', 'F (N)'),
    series: [
      {
        id: 'P',
        label: L('Trọng lực P', 'Weight P'),
        value: (_s, p) => fallInput(p).m * fallInput(p).g,
      },
      {
        id: 'FA',
        label: L('Lực đẩy Archimedes', 'Upthrust'),
        value: (_s, p) => {
          const q = fallInput(p);
          return q.fluid.rho * volume(q) * q.g;
        },
      },
      { id: 'Fd', label: L('Lực cản', 'Drag'), value: (s) => Math.abs(s[FL.Fd] ?? 0) },
    ],
  },
  {
    id: 'distance',
    title: L('Quãng đường theo thời gian', 'Distance over time'),
    yLabel: L('s (m)', 's (m)'),
    series: [
      { id: 's', label: L('Có lực cản', 'With drag'), value: (s) => s[FL.s] ?? 0 },
      {
        id: 'sVac',
        label: L('Chân không', 'Vacuum'),
        value: (s, p) => fallInput(p).H - (s[FL.yVac] ?? 0),
        when: (p) => direction(fallInput(p)) > 0,
        dash: [6, 4],
      },
    ],
  },
];

function solve(p: Params, locale: Locale): Solution {
  const q = fallInput(p);
  const n = (v: number) => texNum(locale, v);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const P = q.m * q.g;
  const FA = q.fluid.rho * volume(q) * q.g;
  const dir = direction(q);
  const steps: SolutionStep[] = [
    {
      text: L('Trọng lực và lực đẩy Archimedes của chất lưu:', 'Weight and the fluid’s upthrust:'),
      tex: `P = mg = ${Q(P, 'N')},\\qquad F_A = \\rho_{f} V g = ${n(q.fluid.rho)}\\cdot ${n(volume(q))}\\cdot ${n(q.g)} = ${Q(FA, 'N')}`,
    },
  ];
  const answers: Answer[] = [
    { id: 'P', label: L('Trọng lực', 'Weight'), value: P, unit: 'N' },
    { id: 'FA', label: L('Lực đẩy Archimedes', 'Upthrust'), value: FA, unit: 'N' },
  ];
  const notes: LocalizedText[] = [];
  if (dir === 0) {
    steps.push({
      text: L(
        'Trọng lực bằng lực đẩy Archimedes: quả cầu lơ lửng, không chuyển động nên không có lực cản.',
        'The weight equals the upthrust: the sphere hovers; it does not move, so there is no drag.',
      ),
    });
    return { answers, steps };
  }
  const vt = terminalSpeed(q);
  const a0 = startAccel(q);
  const tEnd = travelTime(q);
  const vEnd = vt * Math.tanh((a0 * tEnd) / vt);
  const chk = numericFall(q);
  steps.push(
    {
      text:
        dir > 0
          ? L(
              'Trọng lực lớn hơn lực đẩy Archimedes: quả cầu chìm xuống. Lực cản tăng theo bình phương tốc độ cho tới khi bằng hiệu của hai lực đó:',
              'The weight is larger than the upthrust: the sphere sinks. The drag grows with the square of the speed until it equals the difference of those two forces:',
            )
          : L(
              'Lực đẩy Archimedes lớn hơn trọng lực: quả cầu nổi lên. Lực cản tăng theo bình phương tốc độ cho tới khi bằng hiệu của hai lực đó:',
              'The upthrust is larger than the weight: the sphere rises. The drag grows with the square of the speed until it equals the difference of those two forces:',
            ),
      tex: `v_{gh} = \\sqrt{\\frac{2\\,|P - F_A|}{\\rho_{f} C_d A}} = \\sqrt{\\frac{2\\cdot ${n(Math.abs(P - FA))}}{${n(q.fluid.rho)}\\cdot ${n(q.cd)}\\cdot ${n(Math.PI * q.r ** 2)}}} = ${Q(vt, 'm/s')}`,
    },
    {
      text: L(
        'Tốc độ tiến dần tới tốc độ giới hạn nhưng không vượt qua; thời gian đi hết cột chất lưu:',
        'The speed approaches the terminal speed but never exceeds it; time to cross the column:',
      ),
      tex: `a_0 = \\frac{|P - F_A|}{m + \\tfrac{1}{2}\\rho_{f} V} = ${Q(a0, 'm/s^2')},\\quad t = \\frac{v_{gh}}{a_0}\\,\\mathrm{arcosh}\\!\\left(e^{a_0 H / v_{gh}^2}\\right) = ${Q(tEnd, 's')},\\quad v = ${Q(vEnd, 'm/s')}`,
    },
  );
  answers.push(
    {
      id: 'vt',
      label: L('Tốc độ giới hạn', 'Terminal speed'),
      value: vt,
      unit: 'm/s',
      ...(chk ? { check: chk.vt } : {}),
    },
    {
      id: 'tEnd',
      label:
        dir > 0
          ? L('Thời gian rơi hết độ cao', 'Time to fall the height')
          : L('Thời gian nổi lên mặt', 'Time to reach the surface'),
      value: tEnd,
      unit: 's',
      ...(chk ? { check: chk.t } : {}),
    },
    {
      id: 'vEnd',
      label:
        dir > 0
          ? L('Tốc độ khi chạm đáy', 'Speed at the bottom')
          : L('Tốc độ khi tới mặt', 'Speed at the surface'),
      value: vEnd,
      unit: 'm/s',
      ...(chk ? { check: chk.v } : {}),
    },
  );
  if (dir > 0) {
    const t0 = Math.sqrt((2 * q.H) / q.g);
    steps.push({
      text: L(
        'So sánh: cùng độ cao trong chân không (không lực cản, không lực đẩy):',
        'Compare: the same height in a vacuum (no drag, no upthrust):',
      ),
      tex: `t_0 = \\sqrt{2H/g} = ${Q(t0, 's')},\\qquad v_0 = \\sqrt{2gH} = ${Q(Math.sqrt(2 * q.g * q.H), 'm/s')}`,
    });
    answers.push(
      {
        id: 'tVac',
        label: L('Thời gian rơi trong chân không', 'Fall time in a vacuum'),
        value: t0,
        unit: 's',
      },
      {
        id: 'vVac',
        label: L('Tốc độ chạm đất trong chân không', 'Landing speed in a vacuum'),
        value: Math.sqrt(2 * q.g * q.H),
        unit: 'm/s',
      },
    );
  }
  const re = reynolds(q, vt);
  if (Number.isFinite(re)) {
    steps.push({
      text: L(
        'Số Reynolds ở tốc độ giới hạn (kiểm tra giả thiết hệ số cản không đổi):',
        'Reynolds number at the terminal speed (checks the constant drag coefficient):',
      ),
      tex: `Re = \\frac{\\rho_{f}\\, v_{gh}\\, 2r}{\\mu} = ${n(re)}`,
    });
    answers.push({ id: 'Re', label: L('Số Reynolds', 'Reynolds number'), value: re, unit: '1' });
    if (re < RE_CONSTANT_CD[0] || re > RE_CONSTANT_CD[1]) {
      const f = (loc: Locale) => formatNumber(loc, re, { maximumSignificantDigits: 3 });
      notes.push(
        L(
          `Re = ${f('vi')} nằm ngoài khoảng 10³ – 2·10⁵: hệ số cản thực của quả cầu khác hằng số, kết quả chỉ gần đúng.`,
          `Re = ${f('en')} is outside 10³ – 2·10⁵: the sphere’s real drag coefficient is not constant there, so the result is approximate.`,
        ),
      );
    }
  }
  return { answers, steps, notes };
}

/** Whether the constant-C_d law is known to hold at the terminal speed. */
export function reInRange(q: FallInput): boolean | null {
  if (direction(q) === 0) return true;
  const re = reynolds(q, terminalSpeed(q));
  if (!Number.isFinite(re)) return null;
  return re >= RE_CONSTANT_CD[0] && re <= RE_CONSTANT_CD[1];
}

function card(p: Params): ScienceCardData {
  const q = fallInput(p);
  const inRange = reInRange(q);
  const custom = Math.round(p.fluid ?? 0) === CUSTOM_FLUID;
  return {
    title: L('Lực cản và lực đẩy của chất lưu', 'Drag and upthrust in a fluid'),
    model: L(
      'Quả cầu được thả không vận tốc đầu trong chất lưu đứng yên. Ba lực: trọng lực, lực đẩy Archimedes và lực cản tỉ lệ với bình phương tốc độ (hệ số cản không đổi).',
      'A sphere released from rest in a still fluid. Three forces: weight, the upthrust, and a drag proportional to the square of the speed (constant drag coefficient).',
    ),
    equations: [
      { tex: 'F_A = \\rho_{f}\\, V g', label: L('Lực đẩy Archimedes', 'Upthrust (Archimedes)') },
      {
        tex: 'F_c = \\tfrac{1}{2}\\rho_{f}\\, C_d A v^2',
        label: L('Lực cản của chất lưu', 'Fluid drag'),
      },
      {
        tex: '\\left(m + \\tfrac{1}{2}\\rho_{f} V\\right)\\frac{dv}{dt} = |P - F_A| - F_c',
        label: L(
          'Định luật II Newton theo chiều chuyển động',
          "Newton's second law along the motion",
        ),
      },
      {
        tex: 'v = v_{gh}\\tanh\\frac{a_0 t}{v_{gh}},\\quad v_{gh} = \\sqrt{\\frac{2\\,|P - F_A|}{\\rho_{f} C_d A}}',
        label: L('Nghiệm khi thả không vận tốc đầu', 'Solution from rest'),
      },
    ],
    assumptions: [
      L(
        'Chất lưu đứng yên, rộng vô hạn (bỏ qua ảnh hưởng của thành bình).',
        'Still, unbounded fluid (walls ignored).',
      ),
      L(
        'Hệ số cản không đổi (lực cản bậc hai). Chất lưu bị kéo theo quả cầu được tính như một khối lượng kèm theo bằng nửa khối lượng chất lưu bị chiếm chỗ (dòng thế); bỏ qua các lực phụ thuộc lịch sử chuyển động, nên giai đoạn tăng tốc trong nước chỉ gần đúng. Tốc độ giới hạn không phụ thuộc các giả thiết này.',
        'Constant drag coefficient (quadratic drag). The fluid carried along with the sphere is counted as an added mass of half the displaced fluid (potential flow); history-dependent forces are ignored, so the speeding-up phase in water is approximate. The terminal speed depends on none of this.',
      ),
      L(
        'Không khí: khí quyển chuẩn ISA ở mực nước biển (15 °C); nước ở 20 °C.',
        'Air: ISA standard atmosphere at sea level (15 °C); water at 20 °C.',
      ),
    ],
    validity:
      inRange === false
        ? L(
            'Số Reynolds ở tốc độ giới hạn nằm ngoài 10³ – 2·10⁵: hệ số cản thực không còn là hằng số, kết quả chỉ gần đúng.',
            'The Reynolds number at the terminal speed is outside 10³ – 2·10⁵: the real drag coefficient is not constant, the result is approximate.',
          )
        : custom
          ? L(
              'Chất lưu tự nhập: không biết độ nhớt nên không kiểm được số Reynolds; hệ số cản coi là không đổi.',
              'Typed-in fluid: its viscosity is unknown, so the Reynolds number cannot be checked; the drag coefficient is taken as constant.',
            )
          : L(
              'Quả cầu nhẵn với 10³ < Re < 2·10⁵ (hệ số cản gần như không đổi).',
              'Smooth sphere with 10³ < Re < 2·10⁵ (drag coefficient nearly constant).',
            ),
    confidence: inRange === false ? 'approx' : 'exact',
    confidenceNote: L(
      'Nghiệm đóng của mô hình (tanh, arcosh); thời gian, tốc độ cuối và tốc độ giới hạn được kiểm chứng bằng tích phân số DOPRI5 độc lập.',
      'Closed form of the model (tanh, arcosh); time, final speed and terminal speed are cross-checked by an independent DOPRI5 integration.',
    ),
    method: L(
      'Mỗi bước tính trạng thái từ nghiệm đóng tại t = n·Δt (Δt = 1/240 s): sai số không tích lũy.',
      'Each step evaluates the closed form at t = n·Δt (Δt = 1/240 s): no error builds up.',
    ),
    userIntervened: false,
    sources: [SRC.sgk10kntt, SRC.hallidayDrag, SRC.hoerner, SRC.lamb, SRC.isa, SRC.iapwsWater],
  };
}

export const fluidFall: PhysicsScene = {
  id: 'fluidFall',
  required: ['m', 'r', 'H'],
  engineId: 'phys.fluidFall',
  title: L('Lực cản của chất lưu', 'Drag in a fluid'),
  usesGravity: true,
  params: [
    {
      key: 'fluid',
      label: L('Chất lưu', 'Fluid'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: 0, label: L('Không khí', 'Air') },
        { value: 1, label: L('Nước', 'Water') },
        { value: CUSTOM_FLUID, label: L('Tự nhập', 'Typed in') },
      ],
    },
    {
      key: 'rhoF',
      label: L('Khối lượng riêng của chất lưu', 'Fluid density'),
      symbol: '\\rho_{f}',
      kind: 'number',
      dim: DIM.density,
      unit: 'kg/m^3',
      min: 0.1,
      max: 2000,
      step: 0.01,
      when: (p) => Math.round(p.fluid ?? 0) === CUSTOM_FLUID,
    },
    {
      key: 'm',
      label: L('Khối lượng quả cầu', 'Mass of the sphere'),
      symbol: 'm',
      kind: 'number',
      dim: DIM.mass,
      unit: 'g',
      min: 0.5,
      max: 5000,
      step: 0.1,
    },
    {
      key: 'r',
      label: L('Bán kính quả cầu', 'Radius of the sphere'),
      symbol: 'r',
      kind: 'number',
      dim: DIM.length,
      unit: 'cm',
      min: 0.5,
      max: 20,
      step: 0.1,
    },
    {
      key: 'cd',
      label: L('Hệ số cản', 'Drag coefficient'),
      symbol: 'C_d',
      kind: 'number',
      min: 0.1,
      max: 1.5,
      step: 0.01,
    },
    {
      key: 'H',
      label: L('Chiều cao cột chất lưu', 'Height of the fluid column'),
      symbol: 'H',
      kind: 'number',
      dim: DIM.length,
      unit: 'm',
      min: 1,
      max: 200,
      step: 0.5,
    },
    gravityParam,
  ],
  defaults: { fluid: 0, rhoF: 1.29, m: 0.0027, r: 0.02, cd: 0.47, H: 20 },
  scienceCard: card,
  solve,
  graphs,
  bodies: [ball],
  view,
  draw,
  trail: (s, p) => [{ x: X_BALL * fallInput(p).H, y: s[FL.y] ?? 0 }],
};
