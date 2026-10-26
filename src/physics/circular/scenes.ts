import type { Locale } from '@/app/i18n/types';
import { DIM } from '@/core/units';
import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { L, massParam } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { fmtQty, texQty } from '../common/tex';
import { arrow, circle, line, polyline, text, vectorScale } from '../render/draw';
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
import { numericPeriod } from './check';
import { CE } from './engine';
import { MODE, circular } from './model';

/** The parameter holding the given quantity, indexed by `mode`. */
const GIVEN = ['v', 'omega', 'T', 'f'] as const;

const given = (p: Params, key: (typeof GIVEN)[number]) => GIVEN[p.mode ?? MODE.v] === key;

function validate(p: Params): LocalizedText[] {
  const errors: LocalizedText[] = [];
  if (!((p.r ?? 1) > 0)) {
    errors.push(L('Bán kính quỹ đạo phải lớn hơn 0.', 'The radius must be greater than 0.'));
  }
  const key = GIVEN[p.mode ?? MODE.v] ?? 'v';
  if (!((p[key] ?? 1) > 0)) {
    const names: Record<(typeof GIVEN)[number], LocalizedText> = {
      v: L('Tốc độ v', 'The speed v'),
      omega: L('Tốc độ góc ω', 'The angular speed ω'),
      T: L('Chu kì T', 'The period T'),
      f: L('Tần số f', 'The frequency f'),
    };
    errors.push(
      L(
        `${names[key].vi} phải lớn hơn 0 (chiều quay chọn ở ô "Chiều quay").`,
        `${names[key].en} must be greater than 0 (choose the sense in "Direction").`,
      ),
    );
  }
  return errors;
}

function view(p: Params): WorldBounds {
  const r = Math.max(circular(p).r, 1e-3);
  return { xMin: -1.6 * r, xMax: 1.6 * r, yMin: -1.35 * r, yMax: 1.35 * r };
}

const body: BodyDef = {
  id: 'ball',
  label: L('Vật', 'Body'),
  position: (s) => ({ x: s[CE.x] ?? 0, y: s[CE.y] ?? 0 }),
  radius: (p) => 0.07 * circular(p).r,
  draggable: false,
  properties: (s, p) => {
    const c = circular(p);
    return [
      { label: L('Góc φ', 'Angle φ'), symbol: '\\varphi', value: s[CE.phi] ?? 0, unit: 'rad' },
      { label: L('Tốc độ', 'Speed'), symbol: 'v', value: c.v, unit: 'm/s' },
      {
        label: L('Gia tốc hướng tâm', 'Centripetal acceleration'),
        symbol: 'a_{ht}',
        value: c.aC,
        unit: 'm/s^2',
      },
      { label: L('Lực hướng tâm', 'Centripetal force'), symbol: 'F_{ht}', value: c.F, unit: 'N' },
    ];
  },
};

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const col = opts.colors;
  const c = circular(p);
  const r = c.r;
  line(ctx, cam, -1.3 * r, 0, 1.3 * r, 0, col.faint, 1, [4, 5]);
  line(ctx, cam, 0, -1.2 * r, 0, 1.2 * r, col.faint, 1, [4, 5]);
  const path = [];
  for (let i = 0; i <= 96; i++) {
    const a = (2 * Math.PI * i) / 96;
    path.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  polyline(ctx, cam, path, col.muted, 1.5);
  const x = state[CE.x] ?? r;
  const y = state[CE.y] ?? 0;
  line(ctx, cam, 0, 0, x, y, col.faint, 1.2);
  circle(ctx, cam, 0, 0, 0.015 * r, col.text, undefined, 3);
  circle(ctx, cam, x, y, 0.07 * r, opts.selected === 'ball' ? col.accent : col.body, col.text, 6);
  text(
    ctx,
    cam,
    -1.6 * r,
    1.35 * r,
    `r = ${fmtQty(opts.locale, r, 'm')}, v = ${fmtQty(opts.locale, c.v, 'm/s')}, T = ${fmtQty(opts.locale, c.T, 's')}`,
    col.muted,
    'left',
    { x: 60, y: 18 },
  );
  if (opts.vectors) {
    // Fixed lengths: the arrows show directions; magnitudes are in the Inspector.
    const kv = vectorScale(c.v, r, 0.45);
    arrow(ctx, cam, x, y, (state[CE.vx] ?? 0) * kv, (state[CE.vy] ?? 0) * kv, col.velocity, 'v');
    const ka = vectorScale(c.aC, r, 0.4);
    arrow(
      ctx,
      cam,
      x,
      y,
      (state[CE.ax] ?? 0) * ka,
      (state[CE.ay] ?? 0) * ka,
      col.acceleration,
      opts.locale === 'vi' ? 'aht, Fht' : 'ac, Fc',
    );
  }
}

const graphs: GraphDef[] = [
  {
    id: 'angle',
    title: L('Góc φ theo thời gian', 'Angle φ vs time'),
    yLabel: L('φ (rad)', 'φ (rad)'),
    series: [{ id: 'phi', label: L('φ', 'φ'), value: (s) => s[CE.phi] ?? 0 }],
  },
  {
    id: 'velocity',
    title: L('Vận tốc theo thời gian', 'Velocity vs time'),
    yLabel: L('Vận tốc (m/s)', 'Velocity (m/s)'),
    series: [
      { id: 'vx', label: L('vₓ', 'vₓ'), value: (s) => s[CE.vx] ?? 0 },
      { id: 'vy', label: L('v_y', 'v_y'), value: (s) => s[CE.vy] ?? 0 },
    ],
  },
  {
    id: 'position',
    title: L('Tọa độ theo thời gian', 'Position vs time'),
    yLabel: L('Tọa độ (m)', 'Position (m)'),
    series: [
      { id: 'x', label: L('x', 'x'), value: (s) => s[CE.x] ?? 0 },
      { id: 'y', label: L('y', 'y'), value: (s) => s[CE.y] ?? 0 },
    ],
  },
];

function solve(p: Params, locale: Locale): Solution {
  const c = circular(p);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const mode = p.mode ?? MODE.v;
  const r = Q(c.r, 'm');
  const first: SolutionStep =
    mode === MODE.omega
      ? {
          text: L('Từ tốc độ góc ω đã cho:', 'From the given angular speed ω:'),
          tex: `v = \\omega r = ${Q(c.omega, 'rad/s')} \\cdot ${r} = ${Q(c.v, 'm/s')},\\quad T = \\frac{2\\pi}{\\omega} = ${Q(c.T, 's')}`,
        }
      : mode === MODE.period
        ? {
            text: L('Từ chu kì T đã cho:', 'From the given period T:'),
            tex: `\\omega = \\frac{2\\pi}{T} = \\frac{2\\pi}{${Q(c.T, 's')}} = ${Q(c.omega, 'rad/s')},\\quad v = \\omega r = ${Q(c.v, 'm/s')}`,
          }
        : mode === MODE.freq
          ? {
              text: L(
                'Từ tần số f đã cho (f là số vòng mỗi giây, đơn vị Hz):',
                'From the given frequency f (turns per second, in Hz):',
              ),
              tex: `\\omega = 2\\pi f = 2\\pi \\cdot ${Q(c.f, 'Hz')} = ${Q(c.omega, 'rad/s')},\\quad T = \\frac{1}{f} = ${Q(c.T, 's')},\\quad v = \\omega r = ${Q(c.v, 'm/s')}`,
            }
          : {
              text: L('Từ tốc độ v đã cho:', 'From the given speed v:'),
              tex: `\\omega = \\frac{v}{r} = \\frac{${Q(c.v, 'm/s')}}{${r}} = ${Q(c.omega, 'rad/s')},\\quad T = \\frac{2\\pi r}{v} = ${Q(c.T, 's')}`,
            };
  const steps: SolutionStep[] = [
    first,
    {
      text: L('Tần số (số vòng quay mỗi giây):', 'Frequency (turns per second):'),
      tex: `f = \\frac{1}{T} = ${Q(c.f, 'Hz')}`,
    },
    {
      text: L(
        'Gia tốc hướng tâm (luôn hướng vào tâm quỹ đạo):',
        'Centripetal acceleration (always towards the centre):',
      ),
      tex: `a_{ht} = \\frac{v^2}{r} = \\omega^2 r = ${Q(c.aC, 'm/s^2')}`,
    },
    {
      text: L(
        'Lực hướng tâm (hợp lực tác dụng lên vật):',
        'Centripetal force (the net force on the body):',
      ),
      tex: `F_{ht} = m\\,a_{ht} = \\frac{m v^2}{r} = ${Q(c.m, 'kg')} \\cdot ${Q(c.aC, 'm/s^2')} = ${Q(c.F, 'N')}`,
    },
  ];
  const chk = numericPeriod(c);
  const answers: Answer[] = [
    { id: 'omega', label: L('Tốc độ góc ω', 'Angular speed ω'), value: c.omega, unit: 'rad/s' },
    { id: 'speed', label: L('Tốc độ v', 'Speed v'), value: c.v, unit: 'm/s' },
    {
      id: 'period',
      label: L('Chu kì T', 'Period T'),
      value: c.T,
      unit: 's',
      ...(chk ? { check: chk } : {}),
    },
    { id: 'frequency', label: L('Tần số f', 'Frequency f'), value: c.f, unit: 'Hz' },
    {
      id: 'a_c',
      label: L('Gia tốc hướng tâm', 'Centripetal acceleration'),
      value: c.aC,
      unit: 'm/s^2',
    },
    { id: 'force', label: L('Lực hướng tâm', 'Centripetal force'), value: c.F, unit: 'N' },
  ];
  return { answers, steps };
}

function card(p: Params): ScienceCardData {
  const sense = circular(p).dir > 0 ? '+' : '-';
  return {
    title: L('Chuyển động tròn đều', 'Uniform circular motion'),
    model: L(
      'Chất điểm chuyển động trên đường tròn bán kính r với tốc độ không đổi. Hợp lực tác dụng lên vật đóng vai trò lực hướng tâm.',
      'A point mass moves on a circle of radius r at constant speed. The net force on it is the centripetal force.',
    ),
    equations: [
      {
        tex: '\\omega = \\frac{v}{r} = \\frac{2\\pi}{T} = 2\\pi f,\\quad f = \\frac{1}{T}',
        label: L('Tốc độ góc, chu kì, tần số', 'Angular speed, period, frequency'),
      },
      {
        tex: 'a_{ht} = \\frac{v^2}{r} = \\omega^2 r,\\quad F_{ht} = m\\,a_{ht} = \\frac{m v^2}{r}',
        label: L('Gia tốc và lực hướng tâm', 'Centripetal acceleration and force'),
      },
      {
        tex: `\\varphi = \\varphi_0 ${sense} \\omega t,\\quad x = r\\cos\\varphi,\\quad y = r\\sin\\varphi`,
        label: L(
          'Vị trí theo thời gian (dấu + khi quay ngược chiều kim đồng hồ, − khi cùng chiều)',
          'Position over time (+ counterclockwise, − clockwise)',
        ),
      },
    ],
    assumptions: [
      L(
        'Bán kính và tốc độ không đổi; vật là chất điểm.',
        'Constant radius and speed; the body is a point mass.',
      ),
      L(
        'Mô hình chỉ cho biết hợp lực cần có; không xét lực nào cụ thể tạo ra nó (lực căng dây, ma sát, trọng lực…).',
        'The model gives the net force needed; it does not say which force provides it (tension, friction, gravity…).',
      ),
      L(
        'Cơ học cổ điển: tốc độ rất nhỏ so với tốc độ ánh sáng.',
        'Classical mechanics: speeds far below the speed of light.',
      ),
    ],
    validity: L(
      'Đúng với mọi r > 0 và tốc độ không đổi khác 0. Khi tốc độ thay đổi (tròn không đều) còn có gia tốc tiếp tuyến — ngoài mô hình này.',
      'Holds for any r > 0 and constant non-zero speed. When the speed changes (non-uniform circular motion) there is also a tangential acceleration — outside this model.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Vị trí tính thẳng từ t (không cộng dồn). Kiểm chứng bằng tích phân Dormand–Prince định luật II Newton với lực hướng tâm: chu kì khớp 2πr/v tới 10⁻⁹.',
      'Positions are computed straight from t (nothing accumulates). Checked by Dormand–Prince integration of Newton’s second law with the centripetal force: the period matches 2πr/v to 10⁻⁹.',
    ),
    method: L(
      'Nghiệm giải tích φ = φ₀ ± ωt; bước Δt = 1/240 s chỉ dùng để vẽ hình.',
      'Closed form φ = φ₀ ± ωt; the step Δt = 1/240 s is only for drawing.',
    ),
    userIntervened: false,
    sources: [SRC.sgk10kntt, SRC.hallidayCircular, SRC.hairer],
  };
}

const givenParam = (
  key: (typeof GIVEN)[number],
  def: Omit<ParamDef, 'key' | 'kind' | 'when'>,
): ParamDef => ({ ...def, key, kind: 'number', when: (p) => given(p, key) });

export const uniformCircularMotion: PhysicsScene = {
  id: 'uniformCircularMotion',
  engineId: 'phys.circular',
  title: L('Chuyển động tròn đều', 'Uniform circular motion'),
  // Only the given quantity of the chosen mode is asked for (`when`).
  required: ['r', ...GIVEN],
  usesGravity: false,
  params: [
    {
      key: 'mode',
      label: L('Đề bài cho biết', 'The problem gives'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: MODE.v, label: L('Biết tốc độ v', 'Speed v') },
        { value: MODE.omega, label: L('Biết tốc độ góc ω', 'Angular speed ω') },
        { value: MODE.period, label: L('Biết chu kì T', 'Period T') },
        { value: MODE.freq, label: L('Biết tần số f', 'Frequency f') },
      ],
    },
    {
      key: 'r',
      label: L('Bán kính quỹ đạo', 'Radius'),
      symbol: 'r',
      kind: 'number',
      dim: DIM.length,
      unit: 'm',
      min: 0.1,
      max: 10,
      step: 0.01,
    },
    givenParam('v', {
      label: L('Tốc độ', 'Speed'),
      symbol: 'v',
      dim: DIM.velocity,
      unit: 'm/s',
      min: 0.1,
      max: 20,
      step: 0.01,
    }),
    givenParam('omega', {
      label: L('Tốc độ góc', 'Angular speed'),
      symbol: '\\omega',
      dim: DIM.frequency,
      unit: 'rad/s',
      min: 0.1,
      max: 30,
      step: 0.01,
    }),
    givenParam('T', {
      label: L('Chu kì', 'Period'),
      symbol: 'T',
      dim: DIM.time,
      unit: 's',
      min: 0.1,
      max: 60,
      step: 0.01,
    }),
    givenParam('f', {
      label: L('Tần số (số vòng mỗi giây)', 'Frequency (turns per second)'),
      symbol: 'f',
      dim: DIM.frequency,
      unit: 'Hz',
      min: 0.02,
      max: 10,
      step: 0.01,
    }),
    massParam('m', 20),
    {
      key: 'phi0',
      label: L('Góc ban đầu (so với trục Ox)', 'Initial angle (from the x-axis)'),
      symbol: '\\varphi_0',
      kind: 'number',
      unit: 'deg',
      min: -180,
      max: 180,
      step: 1,
    },
    {
      key: 'dir',
      label: L('Chiều quay', 'Direction'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: 1, label: L('Ngược chiều kim đồng hồ', 'Counterclockwise') },
        { value: -1, label: L('Cùng chiều kim đồng hồ', 'Clockwise') },
      ],
    },
  ],
  // r = 1 m, v = 2 m/s: ω = 2 rad/s, T = π s, a_ht = 4 m/s², F_ht = 2 N.
  defaults: {
    mode: MODE.v,
    r: 1,
    v: 2,
    omega: 2,
    T: Math.PI,
    f: 1 / Math.PI,
    m: 0.5,
    phi0: 0,
    dir: 1,
  },
  // The first of v, ω, T, f the problem states is the given quantity; buildDraft flags any other
  // stated one as not used.
  autoDefaults: (_p, sources) => {
    const stated = GIVEN.find((k) => sources[k] === 'problem');
    return stated ? { mode: GIVEN.indexOf(stated) } : {};
  },
  // About four seconds per turn for slow motions (e.g. a period given in hours).
  suggestedSpeed: (p) => Math.max(1, circular(p).T / 4),
  validate,
  scienceCard: card,
  solve,
  graphs,
  bodies: [body],
  view,
  draw,
  trail: (s) => [{ x: s[CE.x] ?? 0, y: s[CE.y] ?? 0 }],
};
