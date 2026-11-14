import type { Locale } from '@/app/i18n/types';
import type { LocalizedText } from '@/core/data/dataset';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { DASH, L } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import { arrow, circle, line, text } from '../render/draw';
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
import { FC } from './engine';
import { BALANCED, forceSet, resultant, resultantByAngles, runLength } from './model';

const SUB = ['₁', '₂', '₃'];
const ORDINAL = [L('thứ nhất', 'first'), L('thứ hai', 'second'), L('thứ ba', 'third')];
const deg = (rad: number) => (rad * 180) / Math.PI;

/** Arrow length of the largest force (m on the stage). */
const ARROW = 1;

function view(): WorldBounds {
  return { xMin: -2.4, xMax: 2.4, yMin: -1.8, yMax: 1.8 };
}

const ring: BodyDef = {
  id: 'ring',
  label: L('Vòng nhẫn', 'Ring'),
  position: (s) => ({ x: s[FC.x] ?? 0, y: s[FC.y] ?? 0 }),
  radius: () => 0.08,
  draggable: false,
  properties: (s, p) => {
    const q = forceSet(p);
    const R = resultant(q);
    return [
      { label: L('Hợp lực', 'Resultant'), symbol: 'R', value: R.size, unit: 'N' },
      { label: L('Gia tốc', 'Acceleration'), symbol: 'a', value: R.size / q.m, unit: 'm/s^2' },
      {
        label: L('Tốc độ', 'Speed'),
        symbol: 'v',
        value: Math.hypot(s[FC.vx] ?? 0, s[FC.vy] ?? 0),
        unit: 'm/s',
      },
    ];
  },
};

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const q = forceSet(p);
  const R = resultant(q);
  const vis = cam.visible();
  const x = state[FC.x] ?? 0;
  const y = state[FC.y] ?? 0;
  const k = ARROW / Math.max(...q.F, R.size, 1e-9);
  const tips = q.F.map((F, i) => ({
    x: F * Math.cos(q.a[i] ?? 0) * k,
    y: F * Math.sin(q.a[i] ?? 0) * k,
  }));
  const [t1, t2] = tips;
  if (t1 && t2) {
    // Parallelogram of the first two forces: their sum is its diagonal.
    line(ctx, cam, x + t1.x, y + t1.y, x + t1.x + t2.x, y + t1.y + t2.y, c.faint, 1.2, DASH);
    line(ctx, cam, x + t2.x, y + t2.y, x + t1.x + t2.x, y + t1.y + t2.y, c.faint, 1.2, DASH);
  }
  tips.forEach((t, i) => {
    arrow(ctx, cam, x, y, t.x, t.y, c.force, `F${SUB[i] ?? ''}`);
  });
  if (R.size > BALANCED) {
    // Components of the resultant on the axes (phân tích lực).
    line(ctx, cam, x + R.x * k, y, x + R.x * k, y + R.y * k, c.faint, 1, DASH);
    line(ctx, cam, x, y + R.y * k, x + R.x * k, y + R.y * k, c.faint, 1, DASH);
    arrow(ctx, cam, x, y, R.x * k, 0, c.muted, 'R_x');
    arrow(ctx, cam, x, y, 0, R.y * k, c.muted, 'R_y');
    arrow(ctx, cam, x, y, R.x * k, R.y * k, c.accent, 'R');
  }
  circle(ctx, cam, x, y, 0.06, opts.selected === 'ring' ? c.accent : c.body, c.text, 6);
  const head =
    R.size > BALANCED
      ? `R = ${fmtQty(opts.locale, R.size, 'N', 4)}   a = ${fmtQty(opts.locale, R.size / q.m, 'm/s^2', 4)}`
      : opts.locale === 'vi'
        ? 'Hợp lực bằng 0: vòng đứng yên (cân bằng lực)'
        : 'Resultant 0: the ring stays at rest (forces balance)';
  text(ctx, cam, vis.xMin, vis.yMax, head, c.muted, 'left', { x: 60, y: 20 });
}

const graphs: GraphDef[] = [
  {
    id: 'speed',
    title: L('Tốc độ theo thời gian', 'Speed over time'),
    yLabel: L('v (m/s)', 'v (m/s)'),
    series: [
      { id: 'v', label: L('v', 'v'), value: (s) => Math.hypot(s[FC.vx] ?? 0, s[FC.vy] ?? 0) },
    ],
  },
  {
    id: 'position',
    title: L('Toạ độ theo thời gian', 'Position over time'),
    yLabel: L('x, y (m)', 'x, y (m)'),
    series: [
      { id: 'x', label: L('x', 'x'), value: (s) => s[FC.x] ?? 0 },
      { id: 'y', label: L('y', 'y'), value: (s) => s[FC.y] ?? 0 },
    ],
  },
];

function solve(p: Params, locale: Locale): Solution {
  const q = forceSet(p);
  const R = resultant(q);
  const n = (v: number) => texNum(locale, v);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  // "3\cos(0^\circ) + 4\cos(90^\circ) + …": each force's size and direction as given.
  const terms = (fn: 'cos' | 'sin') =>
    q.F.map((F, i) => `${n(F)}\\${fn}(${n(deg(q.a[i] ?? 0))}^\\circ)`).join(' + ');
  const steps: SolutionStep[] = [
    {
      text: L(
        'Phân tích mỗi lực thành hai thành phần theo Ox và Oy rồi cộng lại:',
        'Resolve each force along Ox and Oy, then add:',
      ),
      tex: `R_x = ${terms('cos')} = ${Q(R.x, 'N')},\\quad R_y = ${terms('sin')} = ${Q(R.y, 'N')}`,
    },
    {
      text: L('Độ lớn và hướng của hợp lực:', 'Size and direction of the resultant:'),
      tex: `R = \\sqrt{R_x^2 + R_y^2} = ${Q(R.size, 'N')}${R.size > BALANCED ? `,\\quad \\theta = ${Q(R.angle, 'deg')}` : ''}`,
    },
  ];
  if (q.F.length === 2) {
    const alpha = Math.abs(
      Math.atan2(Math.sin((q.a[1] ?? 0) - (q.a[0] ?? 0)), Math.cos((q.a[1] ?? 0) - (q.a[0] ?? 0))),
    );
    steps.push({
      text: L(
        'Kiểm lại bằng quy tắc hình bình hành (α là góc giữa hai lực):',
        'Check with the parallelogram rule (α is the angle between the forces):',
      ),
      tex: `R = \\sqrt{F_1^2 + F_2^2 + 2F_1F_2\\cos\\alpha} = \\sqrt{${n(q.F[0] ?? 0)}^2 + ${n(q.F[1] ?? 0)}^2 + 2\\cdot ${n(q.F[0] ?? 0)}\\cdot ${n(q.F[1] ?? 0)}\\cos ${n(deg(alpha))}^\\circ} = ${Q(resultantByAngles(q), 'N')}`,
    });
  }
  const notes: LocalizedText[] = [];
  if (R.size <= BALANCED) {
    steps.push({
      text: L(
        'Hợp lực bằng 0: các lực cân bằng nhau, vòng đang đứng yên thì tiếp tục đứng yên (định luật I Newton).',
        'The resultant is 0: the forces balance, so the ring at rest stays at rest (Newton’s first law).',
      ),
    });
  } else {
    steps.push(
      {
        text: L(
          'Hợp lực khác 0: vòng chuyển động nhanh dần đều theo hướng của hợp lực (định luật II Newton):',
          'The resultant is not 0: the ring speeds up uniformly along it (Newton’s second law):',
        ),
        tex: `a = \\frac{R}{m} = \\frac{${n(R.size)}}{${n(q.m)}} = ${Q(R.size / q.m, 'm/s^2')}`,
      },
      {
        text: L(
          'Muốn vòng cân bằng phải thêm một lực bằng hợp lực về độ lớn, ngược hướng:',
          'To balance the ring, add a force as large as the resultant, in the opposite direction:',
        ),
        tex: `F' = ${Q(R.size, 'N')},\\quad \\theta' = ${Q(R.angle + (R.angle > 0 ? -Math.PI : Math.PI), 'deg')}`,
      },
    );
  }
  notes.push(
    L(
      'Hướng của mỗi lực đo từ trục Ox, ngược chiều kim đồng hồ.',
      'Each force’s direction is measured from Ox, counter-clockwise.',
    ),
  );
  const answers: Answer[] = [
    {
      id: 'R',
      label: L('Độ lớn hợp lực', 'Size of the resultant'),
      value: R.size,
      unit: 'N',
      check: resultantByAngles(q),
    },
    { id: 'Rx', label: L('Thành phần theo Ox', 'Component along Ox'), value: R.x, unit: 'N' },
    { id: 'Ry', label: L('Thành phần theo Oy', 'Component along Oy'), value: R.y, unit: 'N' },
    {
      id: 'a',
      label: L('Gia tốc của vòng', 'Acceleration of the ring'),
      value: R.size / q.m,
      unit: 'm/s^2',
    },
  ];
  if (R.size > BALANCED)
    answers.push({
      id: 'theta',
      label: L('Hướng của hợp lực (so với Ox)', 'Direction of the resultant (from Ox)'),
      value: R.angle,
      unit: 'deg',
    });
  return { answers, steps, notes };
}

function card(p: Params): ScienceCardData {
  const three = forceSet(p).F.length === 3;
  return {
    title: L('Tổng hợp và phân tích lực', 'Adding and resolving forces'),
    model: L(
      'Một vòng nhẹ trên mặt bàn nằm ngang nhẵn, bị kéo bởi các lực nằm ngang có độ lớn và hướng không đổi, cùng đặt vào tâm vòng (lực đồng quy). Nhìn từ trên xuống.',
      'A light ring on a smooth horizontal table, pulled by horizontal forces of fixed size and direction, all acting at its centre (concurrent forces). Seen from above.',
    ),
    equations: [
      {
        tex: three
          ? '\\vec{R} = \\vec{F}_1 + \\vec{F}_2 + \\vec{F}_3'
          : '\\vec{R} = \\vec{F}_1 + \\vec{F}_2',
        label: L('Hợp lực', 'Resultant'),
      },
      {
        tex: 'R_x = \\sum F_i\\cos\\alpha_i,\\qquad R_y = \\sum F_i\\sin\\alpha_i',
        label: L('Phân tích theo hai trục', 'Resolving along two axes'),
      },
      {
        tex: 'R^2 = F_1^2 + F_2^2 + 2F_1F_2\\cos\\alpha',
        label: L('Quy tắc hình bình hành (hai lực)', 'Parallelogram rule (two forces)'),
      },
      {
        tex: '\\vec{a} = \\dfrac{\\vec{R}}{m},\\qquad \\vec{R} = \\vec{0}\\ \\Rightarrow\\ \\vec{a} = \\vec{0}',
        label: L('Cân bằng lực khi hợp lực bằng 0', 'Forces balance when the resultant is 0'),
      },
    ],
    assumptions: [
      L(
        'Mặt bàn nhẵn: không ma sát; trọng lực và phản lực của bàn cân bằng nhau.',
        'Smooth table: no friction; weight and the table’s push balance.',
      ),
      L(
        'Các lực giữ nguyên độ lớn và hướng trong khi vòng chuyển động.',
        'The forces keep their size and direction while the ring moves.',
      ),
      L(
        'Vòng coi như chất điểm: các lực đồng quy tại tâm vòng.',
        'The ring is a point: the forces meet at its centre.',
      ),
    ],
    validity: L(
      'Các lực nằm trong cùng một mặt phẳng nằm ngang.',
      'All forces lie in one horizontal plane.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Độ lớn hợp lực tính theo thành phần, kiểm chứng độc lập bằng công thức chỉ dùng độ lớn và góc giữa các lực; chuyển động nhanh dần đều tính chính xác.',
      'The resultant’s size from components is cross-checked by a formula using only the forces’ sizes and the angles between them; the uniformly accelerated motion is exact.',
    ),
    method: L(
      'Chuyển động với gia tốc không đổi, tính chính xác tại t = n·Δt (Δt = 1/240 s).',
      'Constant-acceleration motion, evaluated exactly at t = n·Δt (Δt = 1/240 s).',
    ),
    userIntervened: false,
    sources: [SRC.sgk10kntt, SRC.halliday],
  };
}

const forceP = (i: 0 | 1 | 2): ParamDef[] => {
  const ord = ORDINAL[i] ?? L('', '');
  const when = i === 2 ? { when: (p: Params) => Math.round(p.count ?? 3) === 3 } : {};
  return [
    {
      key: `F${i + 1}`,
      label: L(`Độ lớn lực ${ord.vi}`, `Size of the ${ord.en} force`),
      symbol: `F_${i + 1}`,
      kind: 'number',
      dim: DIM.force,
      unit: 'N',
      min: 0,
      max: 20,
      step: 0.1,
      ...when,
    },
    {
      key: `a${i + 1}`,
      label: L(`Hướng lực ${ord.vi} (so với Ox)`, `Direction of the ${ord.en} force (from Ox)`),
      symbol: `\\alpha_${i + 1}`,
      kind: 'number',
      unit: 'deg',
      min: -180,
      max: 180,
      step: 1,
      ...when,
    },
  ];
};

export const forceComposition: PhysicsScene = {
  id: 'forceComposition',
  // F₁ along Ox is a convention (default), not a number of the problem: only the angle between counts.
  required: ['F1', 'F2', 'a2'],
  engineId: 'phys.forces',
  title: L('Tổng hợp và phân tích lực', 'Adding and resolving forces'),
  usesGravity: false,
  params: [
    {
      key: 'count',
      label: L('Số lực', 'Number of forces'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: 2, label: L('Hai lực', 'Two forces') },
        { value: 3, label: L('Ba lực', 'Three forces') },
      ],
    },
    ...forceP(0),
    ...forceP(1),
    ...forceP(2),
    {
      key: 'm',
      label: L('Khối lượng vòng', 'Mass of the ring'),
      symbol: 'm',
      kind: 'number',
      dim: DIM.mass,
      unit: 'kg',
      min: 0.1,
      max: 10,
      step: 0.1,
    },
  ],
  defaults: {
    count: 3,
    F1: 3,
    a1: 0,
    F2: 4,
    a2: Math.PI / 2,
    F3: 4,
    a3: (-127 * Math.PI) / 180,
    m: 1,
  },
  engineParams: (p) => ({ ...p, tEnd: runLength(forceSet(p)) }),
  scienceCard: card,
  solve,
  graphs,
  bodies: [ring],
  view,
  draw,
  trail: (s) => [{ x: s[FC.x] ?? 0, y: s[FC.y] ?? 0 }],
};
