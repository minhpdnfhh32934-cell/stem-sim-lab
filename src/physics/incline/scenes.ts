import type { Locale } from '@/app/i18n/types';
import { dopri5 } from '@/core/ode/dopri5';
import { DIM } from '@/core/units';
import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { L, gravityParam, massParam, pairFriction } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import { arrow, block, ground, polygon, polyline, text, vectorScale } from '../render/draw';
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
import { IS, inclineInput } from './engine';
import { accelFor, forces, segments, type InclineInput } from './model';

const size = (p: InclineInput) => ({ w: 0.08 * p.length, h: 0.05 * p.length });

function blockCenter(p: InclineInput, s: number) {
  const { h } = size(p);
  const c = Math.cos(p.theta);
  const sn = Math.sin(p.theta);
  return { x: s * c - (h / 2) * sn, y: s * sn + (h / 2) * c };
}

function view(p: Params): WorldBounds {
  const q = inclineInput(p);
  const Lx = q.length * Math.cos(q.theta);
  const Ly = q.length * Math.sin(q.theta);
  const pad = 0.15 * q.length;
  return { xMin: -pad, xMax: Lx + pad, yMin: -pad * 0.8, yMax: Ly + pad * 1.6 };
}

const body: BodyDef = {
  id: 'block',
  label: L('Vật', 'Block'),
  position: (s, p) => blockCenter(inclineInput(p), s[IS.s] ?? 0),
  radius: (p) => size(inclineInput(p)).w / 2,
  draggable: true,
  properties: (s) => [
    {
      label: L('Vị trí dọc mặt phẳng', 'Position along surface'),
      symbol: 's',
      value: s[IS.s] ?? 0,
      unit: 'm',
    },
    { label: L('Vận tốc', 'Velocity'), symbol: 'v', value: s[IS.v] ?? 0, unit: 'm/s' },
    { label: L('Gia tốc', 'Acceleration'), symbol: 'a', value: s[IS.a] ?? 0, unit: 'm/s^2' },
    {
      label: L('Lực ma sát', 'Friction force'),
      symbol: 'F_{ms}',
      value: s[IS.friction] ?? 0,
      unit: 'N',
    },
    { label: L('Phản lực', 'Normal force'), symbol: 'N', value: s[IS.N] ?? 0, unit: 'N' },
  ],
};

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const q = inclineInput(p);
  const Lx = q.length * Math.cos(q.theta);
  const Ly = q.length * Math.sin(q.theta);
  ground(ctx, cam, 0, c);
  if (q.theta > 1e-6) {
    polygon(
      ctx,
      cam,
      [
        { x: 0, y: 0 },
        { x: Lx, y: 0 },
        { x: Lx, y: Ly },
      ],
      c.panel,
      c.ground,
    );
    const r = 0.12 * q.length;
    const arc = [];
    for (let i = 0; i <= 16; i++) {
      const th = (q.theta * i) / 16;
      arc.push({ x: r * Math.cos(th), y: r * Math.sin(th) });
    }
    polyline(ctx, cam, arc, c.muted, 1.2);
    text(ctx, cam, r * 1.1, 0, `θ = ${fmtQty(opts.locale, q.theta, 'deg', 3)}`, c.muted, 'left', {
      x: 4,
      y: -4,
    });
  }
  const s = state[IS.s] ?? 0;
  const pos = blockCenter(q, s);
  const { w, h } = size(q);
  block(
    ctx,
    cam,
    pos.x,
    pos.y,
    w,
    h,
    q.theta,
    opts.selected === 'block' ? c.accent : c.body,
    c.text,
    'm',
  );
  if (opts.vectors) {
    const f = forces(q);
    const ref = Math.max(q.m * q.g, Math.abs(q.F), 1e-9);
    const k = vectorScale(ref, q.length, 0.25);
    const ct = Math.cos(q.theta);
    const st = Math.sin(q.theta);
    arrow(ctx, cam, pos.x, pos.y, 0, -q.m * q.g * k, c.force, 'P');
    if (f.N > 0) arrow(ctx, cam, pos.x, pos.y, -st * f.N * k, ct * f.N * k, c.force, 'N');
    const fr = state[IS.friction] ?? 0;
    if (Math.abs(fr) > 1e-9)
      arrow(ctx, cam, pos.x, pos.y - 0.3 * h, ct * fr * k, st * fr * k, c.acceleration, 'Fms');
    if (q.F > 0) {
      const ang = q.theta + q.beta;
      arrow(
        ctx,
        cam,
        pos.x,
        pos.y,
        Math.cos(ang) * q.F * k,
        Math.sin(ang) * q.F * k,
        c.velocity,
        'F',
      );
    }
  }
}

const graphs: GraphDef[] = [
  {
    id: 'position',
    title: L('Vị trí dọc mặt phẳng', 'Position along the surface'),
    yLabel: L('s (m)', 's (m)'),
    series: [{ id: 's', label: L('s', 's'), value: (st) => st[IS.s] ?? 0 }],
  },
  {
    id: 'velocity',
    title: L('Vận tốc – thời gian', 'Velocity – time'),
    yLabel: L('v (m/s)', 'v (m/s)'),
    series: [{ id: 'v', label: L('v', 'v'), value: (st) => st[IS.v] ?? 0 }],
  },
  {
    id: 'forces',
    title: L('Lực ma sát và gia tốc', 'Friction and acceleration'),
    yLabel: L('Giá trị (N; m/s²)', 'Value (N; m/s²)'),
    series: [
      { id: 'Fms', label: L('F_ms (N)', 'F_fr (N)'), value: (st) => st[IS.friction] ?? 0 },
      { id: 'a', label: L('a (m/s²)', 'a (m/s²)'), value: (st) => st[IS.a] ?? 0 },
    ],
  },
];

/** Dormand–Prince cross-check of the first moving segment's end (time and speed). */
export function numericEnd(q: InclineInput): { t: number; v: number } | null {
  const segs = segments(q);
  const first = segs.find((sg) => sg.regime !== 'static');
  if (!first || !Number.isFinite(first.t1)) return null;
  const r = dopri5(
    (_t, y, d) => {
      d[0] = y[1] ?? 0;
      d[1] = first.a;
    },
    [first.s0, first.v0],
    first.t0,
    first.t1 + 1,
    {
      rtol: 1e-12,
      atol: 1e-12,
      events: [
        { id: 'bottom', g: (_t, y) => y[0] ?? 0, terminal: true },
        { id: 'top', g: (_t, y) => (y[0] ?? 0) - q.length, terminal: true },
        { id: 'rest', g: (_t, y) => y[1] ?? 0, terminal: true },
      ],
    },
  );
  return { t: r.t, v: r.y[1] ?? 0 };
}

function validate(p: Params): LocalizedText[] {
  const q = inclineInput(p);
  const errs: LocalizedText[] = [];
  if (forces(q).N < 0) {
    errs.push(
      L(
        'Thành phần thẳng đứng của lực F lớn hơn trọng lực: vật bị nhấc khỏi mặt phẳng — mô hình này không áp dụng.',
        'The force lifts the block off the surface — this model does not apply.',
      ),
    );
  }
  if (q.muK > q.muS + 1e-12) {
    errs.push(
      L(
        'Hệ số ma sát trượt phải ≤ hệ số ma sát nghỉ.',
        'Kinetic friction must not exceed static friction.',
      ),
    );
  }
  return errs;
}

function solve(horizontal: boolean) {
  return (p: Params, locale: Locale): Solution => {
    const q = inclineInput(p);
    const n = (v: number) => texNum(locale, v);
    const Q = (v: number, u: string) => texQty(locale, v, u);
    const f = forces(q);
    const deg = texNum(locale, (q.theta * 180) / Math.PI);
    const bdeg = texNum(locale, (q.beta * 180) / Math.PI);
    const steps: SolutionStep[] = [
      {
        text: L(
          horizontal
            ? 'Chọn trục Ox theo phương chuyển động (nằm ngang), Oy thẳng đứng hướng lên. Các lực: trọng lực P, phản lực N, lực kéo F, lực ma sát.'
            : 'Chọn trục Ox dọc mặt phẳng nghiêng hướng lên, Oy vuông góc mặt phẳng. Các lực: trọng lực P, phản lực N, lực ma sát (và lực F nếu có).',
          horizontal
            ? 'x axis along the motion (horizontal), y up. Forces: weight P, normal N, pull F, friction.'
            : 'x axis up the slope, y perpendicular to it. Forces: weight P, normal N, friction (and F if any).',
        ),
      },
      {
        text: L('Phản lực của mặt phẳng (chiếu lên Oy):', 'Normal force (y projection):'),
        tex: horizontal
          ? `N = mg - F\\sin\\alpha = ${n(q.m)}\\cdot ${n(q.g)} - ${n(q.F)}\\sin ${bdeg}^\\circ = ${Q(f.N, 'N')}`
          : `N = mg\\cos\\theta - F\\sin\\beta = ${n(q.m)}\\cdot ${n(q.g)}\\cos ${deg}^\\circ - ${n(q.F)}\\sin ${bdeg}^\\circ = ${Q(f.N, 'N')}`,
      },
      {
        text: L(
          'Hợp lực dọc phương chuyển động khi chưa kể ma sát:',
          'Net driving force along the motion (without friction):',
        ),
        tex: horizontal
          ? `F\\cos\\alpha = ${Q(f.drive, 'N')}`
          : `F\\cos\\beta - mg\\sin\\theta = ${Q(f.drive, 'N')}`,
      },
    ];
    const answers: Answer[] = [
      { id: 'normal_force', label: L('Phản lực N', 'Normal force N'), value: f.N, unit: 'N' },
    ];
    const start = accelFor(q, q.v0);
    if (start.regime === 'static') {
      steps.push({
        text: L(
          'So sánh với lực ma sát nghỉ cực đại: vật đứng yên, lực ma sát nghỉ cân bằng lực kéo.',
          'Compare with maximum static friction: the block stays at rest.',
        ),
        tex: `|${n(f.drive)}| \\le \\mu_n N = ${n(q.muS)}\\cdot ${n(f.N)} = ${Q(f.staticMax, 'N')}`,
      });
      answers.push(
        { id: 'acceleration', label: L('Gia tốc', 'Acceleration'), value: 0, unit: 'm/s^2' },
        {
          id: 'friction',
          label: L('Lực ma sát nghỉ', 'Static friction'),
          value: Math.abs(start.friction),
          unit: 'N',
        },
      );
      return { answers, steps };
    }
    if (q.v0 === 0) {
      steps.push({
        text: L(
          'Lực kéo vượt ma sát nghỉ cực đại nên vật bắt đầu trượt:',
          'Driving force exceeds maximum static friction, so the block slides:',
        ),
        tex: `|${n(f.drive)}| > \\mu_n N = ${Q(f.staticMax, 'N')}`,
      });
    }
    steps.push({
      text: L(
        'Định luật II Newton (ma sát trượt ngược chiều chuyển động):',
        "Newton's second law (kinetic friction opposes motion):",
      ),
      tex: `a = \\frac{${n(f.drive)} ${start.regime === 'up' ? '-' : '+'} \\mu_t N}{m} = \\frac{${n(f.drive)} ${start.regime === 'up' ? '-' : '+'} ${n(q.muK)}\\cdot ${n(f.N)}}{${n(q.m)}} = ${Q(start.a, 'm/s^2')}`,
    });
    answers.push(
      { id: 'acceleration', label: L('Gia tốc', 'Acceleration'), value: start.a, unit: 'm/s^2' },
      {
        id: 'friction',
        label: L('Lực ma sát trượt', 'Kinetic friction'),
        value: Math.abs(start.friction),
        unit: 'N',
      },
    );
    const segs = segments(q);
    const first = segs[0];
    const chk = numericEnd(q);
    if (first && Number.isFinite(first.t1)) {
      const tau = first.t1 - first.t0;
      const vEnd = first.end === 'rest' ? 0 : first.v0 + first.a * tau;
      const where =
        first.end === 'rest'
          ? L('dừng lại', 'comes to rest')
          : first.end === 'bottom'
            ? L(
                horizontal ? 'về đến đầu đường' : 'xuống tới chân mặt phẳng',
                horizontal ? 'reaches the start' : 'reaches the bottom',
              )
            : L(
                horizontal ? 'tới cuối đường' : 'lên tới đỉnh',
                horizontal ? 'reaches the end' : 'reaches the top',
              );
      steps.push({
        text: {
          vi: `Vật ${where.vi} sau thời gian t (giải s = s₀ + v₀t + ½at²):`,
          en: `The block ${where.en} after time t (solve s = s₀ + v₀t + ½at²):`,
        },
        tex: `t = ${Q(tau, 's')},\\qquad v = v_0 + a t = ${Q(vEnd, 'm/s')}`,
      });
      answers.push(
        {
          id: 'time_end',
          label: {
            vi: `Thời gian đến khi vật ${where.vi}`,
            en: `Time until the block ${where.en}`,
          },
          value: tau,
          unit: 's',
          ...(chk ? { check: chk.t } : {}),
        },
        {
          id: 'speed_end',
          label: L('Tốc độ lúc đó', 'Speed at that moment'),
          value: Math.abs(vEnd),
          unit: 'm/s',
          ...(chk ? { check: Math.abs(chk.v) } : {}),
        },
      );
      if (first.end === 'rest' && segs[1]) {
        steps.push({
          text:
            segs[1].regime === 'static'
              ? L(
                  'Sau khi dừng, ma sát nghỉ đủ giữ vật đứng yên.',
                  'After stopping, static friction holds the block.',
                )
              : L(
                  'Sau khi dừng, vật trượt ngược lại với gia tốc mới:',
                  'After stopping, the block slides back with a new acceleration:',
                ),
          ...(segs[1].regime !== 'static' ? { tex: `a' = ${Q(segs[1].a, 'm/s^2')}` } : {}),
        });
      }
    }
    return { answers, steps };
  };
}

function card(horizontal: boolean) {
  return (): ScienceCardData => {
    return {
      title: horizontal
        ? L('Các định luật Newton', "Newton's laws")
        : L('Mặt phẳng nghiêng', 'Inclined plane'),
      model: L(
        'Vật rắn trượt tịnh tiến như chất điểm trên mặt phẳng; ma sát Coulomb (nghỉ μₙ, trượt μₜ).',
        'Rigid block sliding (treated as a point mass); Coulomb friction (static μs, kinetic μk).',
      ),
      equations: [
        { tex: '\\vec{F}_{hl} = m\\vec{a}' },
        { tex: 'N = mg\\cos\\theta - F\\sin\\beta' },
        { tex: 'F_{ms,t} = \\mu_t N,\\qquad F_{ms,n} \\le \\mu_n N' },
      ],
      assumptions: [
        L(
          'Vật không lăn, không lật; bỏ qua lực cản không khí.',
          'No rolling or tipping; air resistance neglected.',
        ),
        L('Hệ số ma sát không phụ thuộc tốc độ.', 'Friction coefficients do not depend on speed.'),
        L('Mặt phẳng cố định, không biến dạng.', 'The surface is fixed and rigid.'),
      ],
      validity: L(
        'Khi vật luôn tiếp xúc mặt phẳng (N ≥ 0).',
        'While the block stays in contact (N ≥ 0).',
      ),
      confidence: 'exact',
      confidenceNote: L(
        'Gia tốc không đổi từng đoạn; thời điểm dừng/đổi chiều được xác định chính xác; đáp số kiểm chứng bằng Dormand–Prince.',
        'Piecewise-constant acceleration; stop/reversal instants located exactly; answers cross-checked with Dormand–Prince.',
      ),
      method: L(
        'Cập nhật chính xác từng đoạn, Δt = 1/240 s.',
        'Exact piecewise update, Δt = 1/240 s.',
      ),
      userIntervened: false,
      sources: [SRC.sgk10, SRC.halliday],
    };
  };
}

const angleParam = (
  key: string,
  label: LocalizedText,
  sym: string,
  min: number,
  max: number,
): ParamDef => ({
  key,
  label,
  symbol: sym,
  kind: 'number',
  unit: 'deg',
  min,
  max,
  step: 1,
});
const muParam = (key: string, label: LocalizedText, sym: string): ParamDef => ({
  key,
  label,
  symbol: sym,
  kind: 'number',
  min: 0,
  max: 1.5,
  step: 0.01,
});
const forceParam: ParamDef = {
  key: 'F',
  label: L('Lực kéo', 'Applied force'),
  symbol: 'F',
  kind: 'number',
  dim: DIM.force,
  unit: 'N',
  min: 0,
  max: 200,
  step: 0.5,
};
const lengthParam = (label: LocalizedText): ParamDef => ({
  key: 'length',
  label,
  symbol: 'L',
  kind: 'number',
  dim: DIM.length,
  unit: 'm',
  min: 0.5,
  max: 100,
  step: 0.1,
});
const v0Param: ParamDef = {
  key: 'v0',
  label: L('Vận tốc ban đầu (dọc mặt phẳng)', 'Initial velocity (along surface)'),
  symbol: 'v_0',
  kind: 'number',
  dim: DIM.velocity,
  unit: 'm/s',
  min: -20,
  max: 20,
  step: 0.1,
};

export const newtonLaws: PhysicsScene = {
  id: 'newtonLaws',
  required: ['m', 'F'],
  engineId: 'phys.incline',
  title: L('Các định luật Newton', "Newton's laws"),
  usesGravity: true,
  params: [
    massParam('m', 100),
    forceParam,
    angleParam(
      'beta',
      L('Góc của lực F so với phương ngang', 'Angle of F above horizontal'),
      '\\alpha',
      0,
      80,
    ),
    muParam(
      'mu',
      L('Hệ số ma sát (nghỉ = trượt)', 'Friction coefficient (static = kinetic)'),
      '\\mu',
    ),
    v0Param,
    lengthParam(L('Chiều dài đường', 'Track length')),
    gravityParam,
  ],
  // m = 5 kg pulled by 20 N at 30°, μ = 0.2 (classic SGK set-up).
  defaults: { m: 5, F: 20, beta: 0, mu: 0.2, v0: 0, length: 20, g: 9.81 },
  engineParams: (p) => ({ ...p, theta: 0, muS: p.mu ?? 0, muK: p.mu ?? 0, s0: 0, tEnd: 30 }),
  validate: (p) => validate({ ...p, theta: 0, muS: p.mu ?? 0, muK: p.mu ?? 0 }),
  scienceCard: card(true),
  solve: (p, locale) =>
    solve(true)({ ...p, theta: 0, muS: p.mu ?? 0, muK: p.mu ?? 0, s0: 0 }, locale),
  graphs,
  bodies: [
    {
      ...body,
      position: (s, p) => body.position(s, { ...p, theta: 0 }),
      radius: (p) => body.radius({ ...p, theta: 0 }),
    },
  ],
  view: (p) => view({ ...p, theta: 0 }),
  draw: (dc) => {
    draw({ ...dc, p: { ...dc.p, theta: 0, muS: dc.p.mu ?? 0, muK: dc.p.mu ?? 0 } });
  },
};

export const inclinedPlane: PhysicsScene = {
  id: 'inclinedPlane',
  required: ['theta'],
  engineId: 'phys.incline',
  title: L('Mặt phẳng nghiêng', 'Inclined plane'),
  usesGravity: true,
  params: [
    angleParam('theta', L('Góc nghiêng', 'Incline angle'), '\\theta', 0, 80),
    massParam('m', 100),
    muParam('muS', L('Hệ số ma sát nghỉ', 'Static friction coefficient'), '\\mu_n'),
    muParam('muK', L('Hệ số ma sát trượt', 'Kinetic friction coefficient'), '\\mu_t'),
    lengthParam(L('Chiều dài mặt phẳng nghiêng', 'Length of the incline')),
    {
      key: 's0',
      label: L('Vị trí ban đầu (tính từ chân dốc)', 'Start position (from the bottom)'),
      symbol: 's_0',
      kind: 'number',
      dim: DIM.length,
      unit: 'm',
      min: 0,
      max: 100,
      step: 0.1,
    },
    v0Param,
    forceParam,
    angleParam(
      'beta',
      L('Góc của F so với mặt phẳng nghiêng', 'Angle of F above the incline'),
      '\\beta',
      -80,
      80,
    ),
    gravityParam,
  ],
  // Block released from the top of a 5 m, 30° incline with μk = 0.2.
  defaults: {
    theta: Math.PI / 6,
    m: 2,
    muS: 0.25,
    muK: 0.2,
    length: 5,
    s0: 5,
    v0: 0,
    F: 0,
    beta: 0,
    g: 9.81,
  },
  // "Released from the top": when the start position is not given, start at the top.
  autoDefaults: (p, src) => ({
    ...pairFriction(p, src),
    ...(src.s0 === 'default' ? { s0: p.length ?? 5 } : {}),
  }),
  engineParams: (p) => ({ ...p, tEnd: 60 }),
  validate: (p) => {
    const e = validate(p);
    if ((p.s0 ?? 0) > (p.length ?? 0))
      e.push(
        L('Vị trí ban đầu vượt quá chiều dài dốc.', 'Start position exceeds the incline length.'),
      );
    return e;
  },
  scienceCard: card(false),
  solve: solve(false),
  graphs,
  bodies: [body],
  view,
  draw,
};
