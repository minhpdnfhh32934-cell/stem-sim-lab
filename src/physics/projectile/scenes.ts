import type { Locale } from '@/app/i18n/types';
import { dopri5 } from '@/core/ode/dopri5';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { arrow, circle, ground, line, polygon, polyline, text, vectorScale } from '../render/draw';
import { L, gravityParam, massParam, pointMassGraphs } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import type {
  Answer,
  BodyDef,
  DrawContext,
  Params,
  PhysicsScene,
  Solution,
  SolutionStep,
  WorldBounds,
} from '../types';
import { projectile, projectileAt, type ProjectileInput } from './analytic';
import { PS } from './engine';

/** Converts scene params (any of the three projectile topics) to launch conditions. */
function launch(p: Params): ProjectileInput {
  return { v0: p.v0 ?? 0, angle: p.angle ?? 0, h0: p.h0 ?? 0, g: p.g ?? 9.81 };
}

/**
 * Independent numerical cross-check of the closed-form answers: integrate
 * y'' = −g with Dormand–Prince (rtol 1e-11) and locate landing/apex as events.
 */
export function numericCheck(inp: ProjectileInput) {
  const g = inp.g;
  const r = dopri5(
    (_t, s, d) => {
      d[0] = s[2] ?? 0;
      d[1] = s[3] ?? 0;
      d[2] = 0;
      d[3] = -g;
    },
    [0, inp.h0, inp.v0 * Math.cos(inp.angle), inp.v0 * Math.sin(inp.angle)],
    0,
    1e4,
    {
      rtol: 1e-11,
      atol: 1e-12,
      events: [
        { id: 'ground', g: (_t, s) => s[1] ?? 0, direction: -1, terminal: true },
        { id: 'apex', g: (_t, s) => s[3] ?? 0, direction: -1 },
      ],
    },
  );
  const apex = r.events.find((e) => e.id === 'apex');
  const y = r.y;
  return {
    flightTime: r.t,
    range: y[0] ?? 0,
    maxHeight: apex ? (apex.y[1] ?? 0) : inp.h0,
    impactSpeed: Math.hypot(y[2] ?? 0, y[3] ?? 0),
  };
}

function size(p: Params): number {
  const r = projectile(launch(p));
  return Math.max(Math.abs(r.range), r.maxHeight, 1);
}

function view(p: Params): WorldBounds {
  const r = projectile(launch(p));
  const s = size(p);
  const xMin = Math.min(0, r.range) - 0.12 * s;
  const xMax = Math.max(0, r.range) + 0.12 * s;
  return { xMin, xMax, yMin: -0.08 * s, yMax: r.maxHeight + 0.15 * s };
}

const ball: BodyDef = {
  id: 'ball',
  label: L('Vật', 'Ball'),
  position: (s) => ({ x: s[PS.x] ?? 0, y: s[PS.y] ?? 0 }),
  radius: (p) => 0.02 * size(p),
  draggable: true,
  properties: (s) => [
    { label: L('Hoành độ', 'x position'), symbol: 'x', value: s[PS.x] ?? 0, unit: 'm' },
    { label: L('Độ cao', 'Height'), symbol: 'y', value: s[PS.y] ?? 0, unit: 'm' },
    {
      label: L('Vận tốc ngang', 'Horizontal velocity'),
      symbol: 'v_x',
      value: s[PS.vx] ?? 0,
      unit: 'm/s',
    },
    {
      label: L('Vận tốc đứng', 'Vertical velocity'),
      symbol: 'v_y',
      value: s[PS.vy] ?? 0,
      unit: 'm/s',
    },
    {
      label: L('Tốc độ', 'Speed'),
      symbol: 'v',
      value: Math.hypot(s[PS.vx] ?? 0, s[PS.vy] ?? 0),
      unit: 'm/s',
    },
  ],
};

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const inp = launch(p);
  const r = projectile(inp);
  const s = size(p);
  ground(ctx, cam, 0, c);
  if (inp.h0 > 0) {
    const w = 0.08 * s;
    polygon(
      ctx,
      cam,
      [
        { x: -w, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: inp.h0 },
        { x: -w, y: inp.h0 },
      ],
      c.panel,
      c.ground,
    );
    text(
      ctx,
      cam,
      -w,
      inp.h0 / 2,
      `h₀ = ${fmtQty(opts.locale, inp.h0, 'm', 3)}`,
      c.muted,
      'right',
      {
        x: -6,
        y: 6,
      },
    );
  }
  // Predicted analytic trajectory (only meaningful while nobody intervened).
  if (!opts.intervened) {
    const pts = [];
    for (let i = 0; i <= 80; i++) pts.push(projectileAt(inp, (r.flightTime * i) / 80));
    polyline(ctx, cam, pts, c.faint, 1.2, [5, 5]);
    if (r.apexTime > 0) {
      const apex = projectileAt(inp, r.apexTime);
      line(ctx, cam, apex.x, 0, apex.x, apex.y, c.faint, 1, [2, 4]);
      text(
        ctx,
        cam,
        apex.x,
        apex.y,
        `H = ${fmtQty(opts.locale, r.maxHeight, 'm', 4)}`,
        c.muted,
        'center',
        {
          x: 0,
          y: -10,
        },
      );
    }
    text(ctx, cam, r.range, 0, `L = ${fmtQty(opts.locale, r.range, 'm', 4)}`, c.muted, 'center', {
      x: 0,
      y: 22,
    });
  }
  const x = state[PS.x] ?? 0;
  const y = state[PS.y] ?? 0;
  const vx = state[PS.vx] ?? 0;
  const vy = state[PS.vy] ?? 0;
  if (opts.vectors) {
    const k = vectorScale(
      Math.max(inp.v0, Math.sqrt(2 * inp.g * Math.max(r.maxHeight, 0.1))),
      s,
      0.22,
    );
    arrow(ctx, cam, x, y, vx * k, 0, c.velocity);
    arrow(ctx, cam, x, y, 0, vy * k, c.velocity);
    arrow(ctx, cam, x, y, vx * k, vy * k, c.velocity, 'v');
    const ka = vectorScale(inp.g, s, 0.1);
    arrow(ctx, cam, x, y, (state[PS.ax] ?? 0) * ka, (state[PS.ay] ?? 0) * ka, c.acceleration, 'a');
  }
  circle(ctx, cam, x, y, 0.02 * s, opts.selected === 'ball' ? c.accent : c.body, c.text, 6);
}

function card(p: Params, title: ScienceCardData['title']): ScienceCardData {
  const r = projectile(launch(p));
  const check = numericCheck(launch(p));
  const dev = Math.max(
    Math.abs(check.flightTime - r.flightTime) / r.flightTime,
    r.range !== 0 ? Math.abs(check.range - r.range) / Math.abs(r.range) : 0,
  );
  return {
    title,
    model: L(
      'Chất điểm chuyển động trong trọng trường đều; bỏ qua lực cản không khí.',
      'Point mass in a uniform gravitational field; air resistance neglected.',
    ),
    equations: [
      { tex: 'x = v_0\\cos\\alpha\\; t' },
      { tex: 'y = h_0 + v_0\\sin\\alpha\\; t - \\tfrac{1}{2} g t^2' },
      { tex: 'v_x = v_0\\cos\\alpha,\\quad v_y = v_0\\sin\\alpha - g t' },
    ],
    assumptions: [
      L('Vật là chất điểm; g không đổi theo độ cao.', 'Point mass; g does not vary with height.'),
      L('Mặt đất phẳng, nằm ngang tại y = 0.', 'Flat horizontal ground at y = 0.'),
      L(
        'Bỏ qua lực cản không khí, gió và chuyển động quay của Trái Đất.',
        "Air resistance, wind and Earth's rotation are neglected.",
      ),
    ],
    validity: L(
      'Tốt khi tốc độ nhỏ và vật nặng, gọn (lực cản không đáng kể) và độ cao ≪ bán kính Trái Đất.',
      "Good for low speeds and dense compact objects (negligible drag), heights ≪ Earth's radius.",
    ),
    confidence: 'exact',
    confidenceNote: L(
      `Đáp số giải tích khớp với tích phân số Dormand–Prince (sai lệch tương đối ${dev.toExponential(1)}).`,
      `Closed-form answers agree with Dormand–Prince integration (relative deviation ${dev.toExponential(1)}).`,
    ),
    method: L(
      'Cập nhật chính xác cho gia tốc không đổi, Δt = 1/240 s; thời điểm chạm đất được giải đúng bên trong bước.',
      'Exact constant-acceleration update, Δt = 1/240 s; landing time solved exactly inside the step.',
    ),
    userIntervened: false,
    sources: [SRC.sgk10, SRC.halliday, SRC.hairer],
  };
}

function solveGeneral(
  p: Params,
  locale: Locale,
  kind: 'free' | 'horizontal' | 'oblique',
): Solution {
  const inp = launch(p);
  const r = projectile(inp);
  const chk = numericCheck(inp);
  const n = (v: number) => texNum(locale, v);
  const q = (v: number, u: string) => texQty(locale, v, u);
  const { g, h0 } = inp;
  const steps: SolutionStep[] = [
    {
      text: L(
        'Chọn gốc tọa độ O tại chân điểm ném, trục Ox nằm ngang, Oy thẳng đứng hướng lên, gốc thời gian lúc ném.',
        'Origin O at the foot of the launch point, x horizontal, y vertically up, t = 0 at launch.',
      ),
    },
  ];
  if (kind === 'oblique') {
    steps.push({
      text: L('Phân tích vận tốc ban đầu:', 'Resolve the initial velocity:'),
      tex: `v_{0x} = v_0\\cos\\alpha = ${n(inp.v0)}\\cos ${texNum(locale, (inp.angle * 180) / Math.PI)}^\\circ = ${q(r.vx0, 'm/s')},\\quad v_{0y} = v_0\\sin\\alpha = ${q(r.vy0, 'm/s')}`,
    });
  }
  steps.push({
    text: L('Phương trình chuyển động:', 'Equations of motion:'),
    tex:
      kind === 'free'
        ? `y = ${n(h0)} ${r.vy0 >= 0 ? '+' : '-'} ${n(Math.abs(r.vy0))}\\,t - \\tfrac{1}{2}\\cdot ${n(g)}\\,t^2`
        : `x = ${n(r.vx0)}\\,t,\\qquad y = ${n(h0)} + ${n(r.vy0)}\\,t - \\tfrac{1}{2}\\cdot ${n(g)}\\,t^2`,
  });
  steps.push({
    text: L(
      'Vật chạm đất khi y = 0, lấy nghiệm dương:',
      'The object lands when y = 0 (positive root):',
    ),
    tex: `t = \\frac{v_{0y} + \\sqrt{v_{0y}^2 + 2 g h_0}}{g} = \\frac{${n(r.vy0)} + \\sqrt{${n(r.vy0)}^2 + 2\\cdot ${n(g)}\\cdot ${n(h0)}}}{${n(g)}} = ${q(r.flightTime, 's')}`,
  });
  if (kind !== 'free') {
    steps.push({
      text: L('Tầm xa:', 'Range:'),
      tex: `L = v_{0x}\\, t = ${n(r.vx0)}\\cdot ${n(r.flightTime)} = ${q(r.range, 'm')}`,
    });
  }
  if (r.vy0 > 0) {
    steps.push({
      text: L('Độ cao cực đại (khi v_y = 0):', 'Maximum height (when v_y = 0):'),
      tex: `H = h_0 + \\frac{v_{0y}^2}{2g} = ${n(h0)} + \\frac{${n(r.vy0)}^2}{2\\cdot ${n(g)}} = ${q(r.maxHeight, 'm')}`,
    });
  }
  steps.push({
    text: L(
      'Tốc độ khi chạm đất (bảo toàn cơ năng):',
      'Speed at impact (conservation of mechanical energy):',
    ),
    tex: `v = \\sqrt{v_0^2 + 2 g h_0} = \\sqrt{${n(inp.v0)}^2 + 2\\cdot ${n(g)}\\cdot ${n(h0)}} = ${q(r.impactSpeed, 'm/s')}`,
  });

  const answers: Answer[] = [
    {
      id: 'time_of_flight',
      label: L('Thời gian chuyển động', 'Time of flight'),
      value: r.flightTime,
      unit: 's',
      check: chk.flightTime,
    },
  ];
  if (kind !== 'free') {
    answers.push({
      id: 'range',
      label: L('Tầm xa', 'Range'),
      value: r.range,
      unit: 'm',
      check: chk.range,
    });
  }
  answers.push(
    {
      id: 'max_height',
      label: L('Độ cao cực đại', 'Maximum height'),
      value: r.maxHeight,
      unit: 'm',
      check: chk.maxHeight,
    },
    {
      id: 'impact_speed',
      label: L('Tốc độ chạm đất', 'Impact speed'),
      value: r.impactSpeed,
      unit: 'm/s',
      check: chk.impactSpeed,
    },
  );
  if (kind !== 'free') {
    answers.push({
      id: 'impact_angle',
      label: L('Góc chạm đất (so với phương ngang)', 'Impact angle (below horizontal)'),
      value: r.impactAngle,
      unit: 'deg',
    });
  }
  return { answers, steps };
}

const graphs = pointMassGraphs(PS, { mass: (p) => p.m ?? 1, g: (p) => p.g ?? 9.81 });

const v0Param = (max = 60) => ({
  key: 'v0',
  label: L('Vận tốc ban đầu', 'Initial speed'),
  symbol: 'v_0',
  kind: 'number' as const,
  dim: DIM.velocity,
  unit: 'm/s',
  min: 0,
  max,
  step: 0.1,
});

const h0Param = (max = 100) => ({
  key: 'h0',
  label: L('Độ cao ban đầu', 'Initial height'),
  symbol: 'h_0',
  kind: 'number' as const,
  dim: DIM.length,
  unit: 'm',
  min: 0,
  max,
  step: 0.1,
});

const common = {
  engineId: 'phys.projectile',
  usesGravity: true,
  graphs,
  bodies: [ball],
  view,
  draw,
  trail: (s: Float64Array) => [{ x: s[PS.x] ?? 0, y: s[PS.y] ?? 0 }],
};

export const obliqueProjectile: PhysicsScene = {
  ...common,
  id: 'obliqueProjectile',
  required: ['v0', 'angle'],
  title: L('Ném xiên', 'Oblique projectile'),
  params: [
    v0Param(),
    {
      key: 'angle',
      label: L('Góc ném (so với phương ngang)', 'Launch angle (above horizontal)'),
      symbol: '\\alpha',
      kind: 'number',
      unit: 'deg',
      min: -89,
      max: 89,
      step: 1,
    },
    h0Param(),
    massParam(),
    gravityParam,
  ],
  defaults: { v0: 15, angle: Math.PI / 4, h0: 0, m: 0.5, g: 9.81 },
  scienceCard: (p) => card(p, L('Ném xiên', 'Oblique projectile')),
  solve: (p, locale) => solveGeneral(p, locale, 'oblique'),
};

export const horizontalProjectile: PhysicsScene = {
  ...common,
  id: 'horizontalProjectile',
  required: ['v0', 'h0'],
  title: L('Ném ngang', 'Horizontal projectile'),
  params: [v0Param(), h0Param(), massParam(), gravityParam],
  defaults: { v0: 10, h0: 45, m: 0.5, g: 9.81 },
  engineParams: (p) => ({ ...p, angle: 0 }),
  validate: (p) =>
    (p.h0 ?? 0) > 0
      ? []
      : [L('Ném ngang cần độ cao ban đầu h₀ > 0.', 'A horizontal throw needs h₀ > 0.')],
  scienceCard: (p) => card({ ...p, angle: 0 }, L('Ném ngang', 'Horizontal projectile')),
  solve: (p, locale) => solveGeneral({ ...p, angle: 0 }, locale, 'horizontal'),
};

/** Free fall / vertical throw: signed v0 (positive = upward). */
function freeFallLaunch(p: Params): Params {
  const v = p.v0 ?? 0;
  return { ...p, v0: Math.abs(v), angle: v >= 0 ? Math.PI / 2 : -Math.PI / 2 };
}

export const freeFall: PhysicsScene = {
  ...common,
  id: 'freeFall',
  required: ['h0'],
  title: L('Rơi tự do và ném thẳng đứng', 'Free fall and vertical throw'),
  params: [
    h0Param(200),
    {
      key: 'v0',
      label: L('Vận tốc ban đầu (dương: hướng lên)', 'Initial velocity (positive = up)'),
      symbol: 'v_0',
      kind: 'number',
      dim: DIM.velocity,
      unit: 'm/s',
      min: -50,
      max: 50,
      step: 0.1,
    },
    massParam(),
    gravityParam,
  ],
  defaults: { h0: 45, v0: 0, m: 1, g: 9.81 },
  engineParams: freeFallLaunch,
  view: (p) => {
    const b = view(freeFallLaunch(p));
    const s = size(freeFallLaunch(p));
    return { ...b, xMin: -0.6 * s, xMax: 0.6 * s };
  },
  scienceCard: (p) =>
    card(freeFallLaunch(p), L('Rơi tự do và ném thẳng đứng', 'Free fall and vertical throw')),
  solve: (p, locale) => solveGeneral(freeFallLaunch(p), locale, 'free'),
  draw: (dc) => {
    draw({ ...dc, p: freeFallLaunch(dc.p) });
  },
};
