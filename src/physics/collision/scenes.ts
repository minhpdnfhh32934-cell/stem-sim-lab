import type { Locale } from '@/app/i18n/types';
import type { LocalizedText } from '@/core/data/dataset';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import { arrow, circle, ground, text, vectorScale } from '../render/draw';
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
import { CS, collisionInput, initialPositions, type CollisionInput } from './engine';
import { collide, collideCM, contactTime, kinetic, type V2 } from './model';

/** Line-of-centres unit vector at contact (ball 1 → ball 2) for motion along x. */
export function contactNormal(q: CollisionInput): V2 {
  const bb = q.b;
  return { x: Math.sqrt(1 - bb * bb), y: bb };
}

export function outcome(q: CollisionInput) {
  const v1 = { x: q.v1, y: 0 };
  const v2 = { x: q.v2, y: 0 };
  const n = contactNormal(q);
  const approaching = q.v1 > q.v2;
  const after = approaching ? collide(q.m1, q.m2, v1, v2, n, q.e) : { v1, v2 };
  const cm = approaching ? collideCM(q.m1, q.m2, v1, v2, n, q.e) : { v1, v2 };
  return { v1, v2, n, after, cm, approaching };
}

/** Collision instant and a run length that shows 1.5 s of motion after it. */
export function timeline(q: CollisionInput) {
  const { p1, p2 } = initialPositions(q);
  const tc = contactTime(
    { x: p2.x - p1.x, y: p2.y - p1.y },
    { x: q.v2 - q.v1, y: 0 },
    q.r1 + q.r2,
    1e6,
  );
  return { tc, tEnd: tc === null ? 4 : tc + 1.5 };
}

function view(p: Params): WorldBounds {
  const q = collisionInput(p);
  const { p1, p2 } = initialPositions(q);
  const { tc, tEnd } = timeline(q);
  const o = outcome(q);
  const xs = [p1.x, p2.x];
  const ys = [p1.y, p2.y];
  if (tc !== null) {
    const c1 = { x: p1.x + q.v1 * tc, y: p1.y };
    const c2 = { x: p2.x + q.v2 * tc, y: p2.y };
    const dt = tEnd - tc;
    xs.push(c1.x + o.after.v1.x * dt, c2.x + o.after.v2.x * dt);
    ys.push(c1.y + o.after.v1.y * dt, c2.y + o.after.v2.y * dt);
  } else {
    xs.push(p1.x + q.v1 * tEnd, p2.x + q.v2 * tEnd);
  }
  const R = Math.max(q.r1, q.r2);
  const xMin = Math.min(...xs) - 3 * R;
  const xMax = Math.max(...xs) + 3 * R;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const h = Math.max(Math.max(...ys) - Math.min(...ys) + 6 * R, (xMax - xMin) * 0.35);
  return { xMin, xMax, yMin: cy - h / 2, yMax: cy + h / 2 };
}

const ball = (k: 0 | 1): BodyDef => ({
  id: k ? 'ball2' : 'ball1',
  label: k ? L('Vật 2', 'Ball 2') : L('Vật 1', 'Ball 1'),
  position: (s) => ({ x: s[4 * k] ?? 0, y: s[4 * k + 1] ?? 0 }),
  radius: (p) => (k ? collisionInput(p).r2 : collisionInput(p).r1),
  draggable: true,
  properties: (s, p) => {
    const q = collisionInput(p);
    const m = k ? q.m2 : q.m1;
    const vx = s[4 * k + 2] ?? 0;
    const vy = s[4 * k + 3] ?? 0;
    return [
      { label: L('Khối lượng', 'Mass'), symbol: 'm', value: m, unit: 'kg' },
      { label: L('Vận tốc theo x', 'Velocity x'), symbol: 'v_x', value: vx, unit: 'm/s' },
      { label: L('Vận tốc theo y', 'Velocity y'), symbol: 'v_y', value: vy, unit: 'm/s' },
      {
        label: L('Động lượng', 'Momentum'),
        symbol: 'p',
        value: m * Math.hypot(vx, vy),
        unit: 'kg*m/s',
      },
      {
        label: L('Động năng', 'Kinetic energy'),
        symbol: 'W_đ',
        value: 0.5 * m * (vx * vx + vy * vy),
        unit: 'J',
      },
    ];
  },
});

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const q = collisionInput(p);
  const vis = cam.visible();
  ground(ctx, cam, vis.yMin + 0.04 * (vis.yMax - vis.yMin), c);
  const vref = Math.max(Math.abs(q.v1), Math.abs(q.v2), 0.1);
  const k = vectorScale(vref, vis.xMax - vis.xMin, 0.12);
  ([0, 1] as const).forEach((i) => {
    const x = state[4 * i] ?? 0;
    const y = state[4 * i + 1] ?? 0;
    const r = i ? q.r2 : q.r1;
    const id = i ? 'ball2' : 'ball1';
    circle(ctx, cam, x, y, r, opts.selected === id ? c.accent : i ? c.bodyAlt : c.body, c.text, 5);
    text(ctx, cam, x, y, i ? '2' : '1', c.text, 'center', { x: 0, y: 6 });
    if (opts.vectors) {
      arrow(
        ctx,
        cam,
        x,
        y,
        (state[4 * i + 2] ?? 0) * k,
        (state[4 * i + 3] ?? 0) * k,
        c.velocity,
        `v${i ? '₂' : '₁'}`,
      );
    }
  });
  const P = q.m1 * (state[CS.vx1] ?? 0) + q.m2 * (state[CS.vx2] ?? 0);
  const Py = q.m1 * (state[CS.vy1] ?? 0) + q.m2 * (state[CS.vy2] ?? 0);
  const K =
    0.5 * q.m1 * ((state[CS.vx1] ?? 0) ** 2 + (state[CS.vy1] ?? 0) ** 2) +
    0.5 * q.m2 * ((state[CS.vx2] ?? 0) ** 2 + (state[CS.vy2] ?? 0) ** 2);
  text(
    ctx,
    cam,
    vis.xMin,
    vis.yMax,
    `p = (${fmtQty(opts.locale, P, 'kg*m/s', 4)}; ${fmtQty(opts.locale, Py, 'kg*m/s', 3)})   W_đ = ${fmtQty(opts.locale, K, 'J', 4)}`,
    c.muted,
    'left',
    { x: 60, y: 20 },
  );
}

const graphs: GraphDef[] = [
  {
    id: 'velocity',
    title: L('Vận tốc theo phương x', 'x-velocities'),
    yLabel: L('vₓ (m/s)', 'vₓ (m/s)'),
    series: [
      { id: 'v1x', label: L('v₁ₓ', 'v₁ₓ'), value: (s) => s[CS.vx1] ?? 0 },
      { id: 'v2x', label: L('v₂ₓ', 'v₂ₓ'), value: (s) => s[CS.vx2] ?? 0 },
    ],
  },
  {
    id: 'momentum',
    title: L('Động lượng của hệ', 'Total momentum'),
    yLabel: L('p (kg·m/s)', 'p (kg·m/s)'),
    series: [
      {
        id: 'px',
        label: L('pₓ', 'pₓ'),
        value: (s, p) => (p.m1 ?? 1) * (s[CS.vx1] ?? 0) + (p.m2 ?? 1) * (s[CS.vx2] ?? 0),
      },
      {
        id: 'py',
        label: L('p_y', 'p_y'),
        value: (s, p) => (p.m1 ?? 1) * (s[CS.vy1] ?? 0) + (p.m2 ?? 1) * (s[CS.vy2] ?? 0),
      },
    ],
  },
  {
    id: 'energy',
    title: L('Động năng của hệ', 'Total kinetic energy'),
    yLabel: L('W_đ (J)', 'K (J)'),
    series: [
      {
        id: 'K',
        label: L('W_đ', 'K'),
        value: (s, p) =>
          0.5 * (p.m1 ?? 1) * ((s[CS.vx1] ?? 0) ** 2 + (s[CS.vy1] ?? 0) ** 2) +
          0.5 * (p.m2 ?? 1) * ((s[CS.vx2] ?? 0) ** 2 + (s[CS.vy2] ?? 0) ** 2),
      },
    ],
  },
];

function solve(p: Params, locale: Locale): Solution {
  const q = collisionInput(p);
  const n = (v: number) => texNum(locale, v);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const o = outcome(q);
  const steps: SolutionStep[] = [];
  const notes: LocalizedText[] = [];
  if (!o.approaching) {
    steps.push({
      text: L(
        'v₁ ≤ v₂: vật 1 không đuổi kịp vật 2 nên không có va chạm.',
        'v₁ ≤ v₂: ball 1 never catches ball 2, so there is no collision.',
      ),
    });
    return { answers: [], steps };
  }
  const P = q.m1 * q.v1 + q.m2 * q.v2;
  const K0 = kinetic(q.m1, o.v1) + kinetic(q.m2, o.v2);
  const K1 = kinetic(q.m1, o.after.v1) + kinetic(q.m2, o.after.v2);
  steps.push({
    text: L(
      'Hệ kín theo phương ngang: động lượng bảo toàn.',
      'Isolated system horizontally: momentum is conserved.',
    ),
    tex: `p = m_1 v_1 + m_2 v_2 = ${n(q.m1)}\\cdot ${n(q.v1)} + ${n(q.m2)}\\cdot(${n(q.v2)}) = ${Q(P, 'kg*m/s')}`,
  });
  if (q.e <= 0) {
    steps.push({
      text: L(
        'Va chạm mềm: hai vật dính vào nhau, chuyển động cùng vận tốc.',
        'Perfectly inelastic: the bodies stick and move together.',
      ),
      tex: `V = \\frac{m_1 v_1 + m_2 v_2}{m_1 + m_2} = ${Q(o.after.v1.x, 'm/s')}`,
    });
  } else if (!q.twoD) {
    steps.push({
      text:
        q.e === 1
          ? L(
              'Va chạm đàn hồi xuyên tâm: bảo toàn động lượng và động năng.',
              'Elastic head-on collision: momentum and kinetic energy conserved.',
            )
          : L(
              'Va chạm xuyên tâm với hệ số phục hồi e:',
              'Head-on collision with coefficient of restitution e:',
            ),
      tex: `v_1' = \\frac{(m_1 - e m_2) v_1 + (1+e) m_2 v_2}{m_1 + m_2} = ${Q(o.after.v1.x, 'm/s')},\\quad v_2' = \\frac{(m_2 - e m_1) v_2 + (1+e) m_1 v_1}{m_1 + m_2} = ${Q(o.after.v2.x, 'm/s')}`,
    });
  } else {
    const ang = Math.atan2(o.n.y, o.n.x);
    steps.push({
      text: L(
        'Va chạm xiên, bề mặt nhẵn: chỉ thành phần vận tốc dọc đường nối tâm thay đổi; thành phần vuông góc giữ nguyên.',
        'Oblique collision, smooth surfaces: only velocity components along the line of centres change.',
      ),
      tex: `\\vec{n} = (\\cos\\varphi, \\sin\\varphi),\\ \\varphi = ${Q(ang, 'deg')},\\quad J = \\frac{(1+e)(\\vec{v}_1 - \\vec{v}_2)\\cdot\\vec{n}}{1/m_1 + 1/m_2}`,
    });
    steps.push({
      text: L('Vận tốc sau va chạm:', 'Velocities after the collision:'),
      tex: `\\vec{v}_1' = (${n(o.after.v1.x)};\\ ${n(o.after.v1.y)})\\,\\text{m/s},\\qquad \\vec{v}_2' = (${n(o.after.v2.x)};\\ ${n(o.after.v2.y)})\\,\\text{m/s}`,
    });
  }
  steps.push({
    text: L('Động năng trước và sau va chạm:', 'Kinetic energy before and after:'),
    tex: `W_đ = ${Q(K0, 'J')} \\;\\to\\; W_đ' = ${Q(K1, 'J')}\\quad (\\Delta W_đ = ${Q(K1 - K0, 'J')})`,
  });
  if (q.e < 1 && q.e > 0)
    notes.push(
      L(
        'Phần động năng mất đi chuyển thành nhiệt, âm thanh, biến dạng.',
        'The lost kinetic energy becomes heat, sound and deformation.',
      ),
    );
  const answers: Answer[] = [
    {
      id: 'v1x_after',
      label: L('v₁ sau (theo x)', 'v₁ after (x)'),
      value: o.after.v1.x,
      unit: 'm/s',
      check: o.cm.v1.x,
    },
    {
      id: 'v2x_after',
      label: L('v₂ sau (theo x)', 'v₂ after (x)'),
      value: o.after.v2.x,
      unit: 'm/s',
      check: o.cm.v2.x,
    },
  ];
  if (q.twoD && q.e > 0) {
    answers.push(
      {
        id: 'v1y_after',
        label: L('v₁ sau (theo y)', 'v₁ after (y)'),
        value: o.after.v1.y,
        unit: 'm/s',
        check: o.cm.v1.y,
      },
      {
        id: 'v2y_after',
        label: L('v₂ sau (theo y)', 'v₂ after (y)'),
        value: o.after.v2.y,
        unit: 'm/s',
        check: o.cm.v2.y,
      },
      {
        id: 'angle1',
        label: L('Góc lệch của vật 1', 'Deflection of ball 1'),
        value: Math.atan2(o.after.v1.y, o.after.v1.x),
        unit: 'deg',
      },
      {
        id: 'angle2',
        label: L('Hướng của vật 2', 'Direction of ball 2'),
        value: Math.atan2(o.after.v2.y, o.after.v2.x),
        unit: 'deg',
      },
    );
  }
  answers.push(
    {
      id: 'momentum',
      label: L('Động lượng của hệ', 'Total momentum'),
      value: P,
      unit: 'kg*m/s',
      check: q.m1 * o.after.v1.x + q.m2 * o.after.v2.x,
    },
    { id: 'ke_before', label: L('Động năng trước', 'Kinetic energy before'), value: K0, unit: 'J' },
    { id: 'ke_after', label: L('Động năng sau', 'Kinetic energy after'), value: K1, unit: 'J' },
  );
  return { answers, steps, notes };
}

function card(p: Params): ScienceCardData {
  const q = collisionInput(p);
  return {
    title: L('Va chạm', 'Collisions'),
    model: L(
      'Hai vật tròn cứng trên mặt phẳng nhẵn nằm ngang; va chạm tức thời, bề mặt tiếp xúc nhẵn (không ma sát).',
      'Two rigid disks on a smooth horizontal table; instantaneous collision between smooth surfaces.',
    ),
    equations: [
      { tex: "m_1\\vec{v}_1 + m_2\\vec{v}_2 = m_1\\vec{v}_1' + m_2\\vec{v}_2'" },
      {
        tex: "(\\vec{v}_2' - \\vec{v}_1')\\cdot\\vec{n} = -e\\,(\\vec{v}_2 - \\vec{v}_1)\\cdot\\vec{n}",
        label: L('Hệ số phục hồi e', 'Coefficient of restitution e'),
      },
    ],
    assumptions: [
      L(
        'Hệ kín: không ma sát với mặt bàn, bỏ qua lực cản.',
        'Isolated system: no table friction or drag.',
      ),
      L('Va chạm xảy ra tức thời; vật không quay.', 'Instantaneous collision; no rotation.'),
      q.e <= 0
        ? L(
            'e = 0 được hiểu là va chạm mềm: hai vật dính vào nhau.',
            'e = 0 is taken as perfectly inelastic: the bodies stick together.',
          )
        : L(
            'e = 1: đàn hồi hoàn toàn; 0 < e < 1: va chạm không đàn hồi.',
            'e = 1: perfectly elastic; 0 < e < 1: inelastic.',
          ),
    ],
    confidence: 'exact',
    confidenceNote: L(
      'Thời điểm va chạm được giải chính xác; vận tốc sau va chạm kiểm chứng bằng cách tính độc lập trong hệ quy chiếu khối tâm.',
      'The collision instant is solved exactly; post-collision velocities are cross-checked independently in the centre-of-mass frame.',
    ),
    method: L(
      'Chuyển động thẳng đều giữa các va chạm (chính xác), Δt = 1/240 s.',
      'Exact straight-line motion between collisions, Δt = 1/240 s.',
    ),
    userIntervened: false,
    sources: [SRC.sgk10, SRC.halliday],
  };
}

const massP = (key: string, sym: string, name: string): ParamDef => ({
  key,
  label: L(`Khối lượng vật ${name}`, `Mass of ball ${name}`),
  symbol: sym,
  kind: 'number',
  dim: DIM.mass,
  unit: 'kg',
  min: 0.05,
  max: 20,
  step: 0.05,
});
const velP = (key: string, sym: string, name: string): ParamDef => ({
  key,
  label: L(`Vận tốc vật ${name} (theo x)`, `Velocity of ball ${name} (x)`),
  symbol: sym,
  kind: 'number',
  dim: DIM.velocity,
  unit: 'm/s',
  min: -10,
  max: 10,
  step: 0.1,
});

export const collisions: PhysicsScene = {
  id: 'collisions',
  required: ['m1', 'v1', 'm2', 'v2'],
  engineId: 'phys.collision',
  title: L('Va chạm đàn hồi và va chạm mềm', 'Elastic and inelastic collisions'),
  usesGravity: false,
  params: [
    {
      key: 'mode',
      label: L('Kiểu va chạm', 'Collision type'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: 0, label: L('Xuyên tâm (1D)', 'Head-on (1D)') },
        { value: 1, label: L('Xiên (2D)', 'Oblique (2D)') },
      ],
    },
    massP('m1', 'm_1', '1'),
    velP('v1', 'v_1', '1'),
    massP('m2', 'm_2', '2'),
    velP('v2', 'v_2', '2'),
    {
      key: 'e',
      label: L('Hệ số phục hồi (1: đàn hồi, 0: mềm)', 'Restitution (1: elastic, 0: sticks)'),
      symbol: 'e',
      kind: 'number',
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      key: 'b',
      label: L('Độ lệch tâm (phần của r₁ + r₂)', 'Impact offset (fraction of r₁ + r₂)'),
      symbol: 'b',
      kind: 'number',
      min: -0.95,
      max: 0.95,
      step: 0.01,
      when: (p) => (p.mode ?? 0) > 0.5,
    },
  ],
  defaults: { mode: 0, m1: 2, v1: 3, m2: 1, v2: -1, e: 1, b: 0.4, r1: 0.12, r2: 0.1, gap: 1.2 },
  engineParams: (p) => ({ ...p, tEnd: timeline(collisionInput(p)).tEnd }),
  scienceCard: card,
  solve,
  graphs,
  bodies: [ball(0), ball(1)],
  view,
  draw,
  trail: (s) => [
    { x: s[CS.x1] ?? 0, y: s[CS.y1] ?? 0 },
    { x: s[CS.x2] ?? 0, y: s[CS.y2] ?? 0 },
  ],
};
