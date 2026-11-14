import type { Locale } from '@/app/i18n/types';
import type { LocalizedText } from '@/core/data/dataset';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { DASH, L, gravityParam } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import { arrow, block, circle, line, text } from '../render/draw';
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
import { TS } from './engine';
import { hanging, indeterminate, tensions, tensionsByComponents, weight } from './model';

/** Knot 1 m below the ceiling; the lamp hangs 0.6 m below the knot. */
const DEPTH = 1;
const DROP = 0.6;
const LAMP = 0.24;
const deg = (rad: number) => (rad * 180) / Math.PI;

function anchors(p: Params) {
  const h = hanging(p);
  return h.two
    ? { A: { x: -DEPTH * Math.tan(h.a1), y: 0 }, B: { x: DEPTH * Math.tan(h.a2), y: 0 } }
    : { A: { x: 0, y: 0 }, B: null };
}

function view(p: Params): WorldBounds {
  const { A, B } = anchors(p);
  const xMin = Math.min(A.x, -0.8) - 0.4;
  const xMax = Math.max(B?.x ?? 0, 0.8) + 0.4;
  return { xMin, xMax, yMin: -DEPTH - DROP - 0.5, yMax: 0.3 };
}

const lamp: BodyDef = {
  id: 'lamp',
  label: L('Đèn', 'Lamp'),
  position: () => ({ x: 0, y: -DEPTH - DROP }),
  radius: () => LAMP / 2,
  draggable: false,
  properties: (s, p) => [
    { label: L('Khối lượng', 'Mass'), symbol: 'm', value: hanging(p).m, unit: 'kg' },
    { label: L('Trọng lực', 'Weight'), symbol: 'P', value: s[TS.P] ?? 0, unit: 'N' },
  ],
};

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const h = hanging(p);
  const vis = cam.visible();
  const { A, B } = anchors(p);
  // Ceiling with hatching above it.
  line(ctx, cam, vis.xMin, 0, vis.xMax, 0, c.ground, 2);
  for (let x = Math.ceil(vis.xMin * 5) / 5; x < vis.xMax; x += 0.2)
    line(ctx, cam, x, 0, x + 0.1, 0.1, c.ground, 1);
  const O = { x: 0, y: -DEPTH };
  line(ctx, cam, A.x, A.y, O.x, O.y, c.text, 1.6);
  if (B) line(ctx, cam, B.x, B.y, O.x, O.y, c.text, 1.6);
  line(ctx, cam, O.x, O.y, 0, -DEPTH - DROP + LAMP / 2, c.text, 1.6);
  block(
    ctx,
    cam,
    0,
    -DEPTH - DROP,
    LAMP,
    LAMP * 0.8,
    0,
    opts.selected === 'lamp' ? c.accent : c.body,
    c.text,
  );
  circle(ctx, cam, O.x, O.y, 0.02, c.text, undefined, 3);
  const P = state[TS.P] ?? weight(h);
  const T1 = state[TS.T1] ?? 0;
  const T2 = state[TS.T2] ?? 0;
  if (opts.vectors && P > 0) {
    // Forces on the knot, drawn to one scale: the largest is 0.7 m long.
    const k = 0.7 / Math.max(P, T1, T2);
    const u1 = h.two ? { x: -Math.sin(h.a1), y: Math.cos(h.a1) } : { x: 0, y: 1 };
    const u2 = { x: Math.sin(h.a2), y: Math.cos(h.a2) };
    arrow(ctx, cam, O.x, O.y, 0, -P * k, c.force, 'P');
    arrow(ctx, cam, O.x, O.y, u1.x * T1 * k, u1.y * T1 * k, c.acceleration, h.two ? 'T_1' : 'T');
    if (h.two) {
      arrow(ctx, cam, O.x, O.y, u2.x * T2 * k, u2.y * T2 * k, c.acceleration, 'T_2');
      // T₁ + T₂ (parallelogram, dashed) balances P.
      const t1 = { x: u1.x * T1 * k, y: u1.y * T1 * k };
      const t2 = { x: u2.x * T2 * k, y: u2.y * T2 * k };
      line(
        ctx,
        cam,
        O.x + t1.x,
        O.y + t1.y,
        O.x + t1.x + t2.x,
        O.y + t1.y + t2.y,
        c.faint,
        1.2,
        DASH,
      );
      line(
        ctx,
        cam,
        O.x + t2.x,
        O.y + t2.y,
        O.x + t1.x + t2.x,
        O.y + t1.y + t2.y,
        c.faint,
        1.2,
        DASH,
      );
    }
  }
  const head = indeterminate(h)
    ? ''
    : h.two
      ? `P = ${fmtQty(opts.locale, P, 'N', 4)}   T₁ = ${fmtQty(opts.locale, T1, 'N', 4)}   T₂ = ${fmtQty(opts.locale, T2, 'N', 4)}`
      : `P = T = ${fmtQty(opts.locale, P, 'N', 4)}`;
  text(ctx, cam, vis.xMin, vis.yMax, head, c.muted, 'left', { x: 60, y: 20 });
}

const graphs: GraphDef[] = [
  {
    id: 'forces',
    title: L('Các lực tại nút', 'Forces at the knot'),
    yLabel: L('F (N)', 'F (N)'),
    series: [
      { id: 'P', label: L('Trọng lực', 'Weight'), value: (s) => s[TS.P] ?? 0 },
      { id: 'T1', label: L('Lực căng dây 1', 'Tension 1'), value: (s) => s[TS.T1] ?? 0 },
      {
        id: 'T2',
        label: L('Lực căng dây 2', 'Tension 2'),
        value: (s) => s[TS.T2] ?? 0,
        when: (p) => hanging(p).two,
      },
    ],
  },
];

function solve(p: Params, locale: Locale): Solution {
  const h = hanging(p);
  const n = (v: number) => texNum(locale, v);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const P = weight(h);
  const steps: SolutionStep[] = [
    {
      text: L('Trọng lực của đèn:', 'Weight of the lamp:'),
      tex: `P = mg = ${n(h.m)}\\cdot ${n(h.g)} = ${Q(P, 'N')}`,
    },
  ];
  const answers: Answer[] = [{ id: 'P', label: L('Trọng lực', 'Weight'), value: P, unit: 'N' }];
  if (!h.two) {
    steps.push({
      text: L(
        'Một dây thẳng đứng: nút đứng yên nên lực căng cân bằng trọng lực.',
        'One vertical string: the knot is at rest, so the tension balances the weight.',
      ),
      tex: `T = P = ${Q(P, 'N')}`,
    });
    answers.push({ id: 'T', label: L('Lực căng dây', 'Tension'), value: P, unit: 'N' });
    return { answers, steps };
  }
  if (indeterminate(h)) {
    steps.push({
      text: L(
        'Hai dây cùng thẳng đứng: điều kiện cân bằng chỉ cho T₁ + T₂ = P, không cho biết mỗi dây chịu bao nhiêu (còn phụ thuộc độ dãn của dây).',
        'Two vertical strings: balance only gives T₁ + T₂ = P, not how much each one carries (that depends on how the strings stretch).',
      ),
    });
    return { answers, steps };
  }
  const { T1, T2 } = tensions(h);
  const chk = tensionsByComponents(h);
  steps.push(
    {
      text: L(
        'Nút đứng yên: tổng các lực tác dụng lên nút bằng 0. Chiếu lên phương ngang và phương thẳng đứng:',
        'The knot is at rest: the forces on it add to 0. Along the horizontal and the vertical:',
      ),
      tex: `T_1\\sin\\alpha_1 = T_2\\sin\\alpha_2,\\qquad T_1\\cos\\alpha_1 + T_2\\cos\\alpha_2 = P`,
    },
    {
      text: L('Giải hệ hai phương trình:', 'Solving the two equations:'),
      tex: `T_1 = \\frac{P\\sin\\alpha_2}{\\sin(\\alpha_1 + \\alpha_2)} = \\frac{${n(P)}\\sin ${n(deg(h.a2))}^\\circ}{\\sin ${n(deg(h.a1 + h.a2))}^\\circ} = ${Q(T1, 'N')},\\quad T_2 = \\frac{P\\sin\\alpha_1}{\\sin(\\alpha_1 + \\alpha_2)} = ${Q(T2, 'N')}`,
    },
  );
  answers.push(
    {
      id: 'T1',
      label: L('Lực căng dây 1', 'Tension in string 1'),
      value: T1,
      unit: 'N',
      ...(chk ? { check: chk.T1 } : {}),
    },
    {
      id: 'T2',
      label: L('Lực căng dây 2', 'Tension in string 2'),
      value: T2,
      unit: 'N',
      ...(chk ? { check: chk.T2 } : {}),
    },
  );
  const notes: LocalizedText[] = [];
  if (h.a1 > 0 && h.a2 > 0)
    answers.push({
      id: 'ratio',
      label: L('Tỉ số T₁ / T₂', 'Ratio T₁ / T₂'),
      value: T1 / T2,
      unit: '1',
      ...(chk ? { check: chk.T1 / chk.T2 } : {}),
    });
  else
    notes.push(
      L(
        'Một dây thẳng đứng: dây đó giữ toàn bộ trọng lực, dây nghiêng không căng (lực căng bằng 0).',
        'One string is vertical: it carries the whole weight and the slanted one is slack (zero tension).',
      ),
    );
  if (Math.max(T1, T2) > P)
    notes.push(
      L(
        'Một lực căng lớn hơn cả trọng lực: dây càng gần nằm ngang thì càng phải căng.',
        'One tension is larger than the weight itself: the closer a string is to horizontal, the harder it must pull.',
      ),
    );
  return { answers, steps, notes };
}

function card(p: Params): ScienceCardData {
  const h = hanging(p);
  return {
    title: L('Trọng lực và lực căng', 'Weight and tension'),
    model: L(
      'Đèn treo đứng yên tại một nút. Nút được giữ bởi một dây thẳng đứng, hoặc bởi hai dây buộc vào trần, mỗi dây hợp với phương thẳng đứng một góc.',
      'A lamp hangs at rest from a knot, held by one vertical string or by two strings tied to the ceiling, each at an angle to the vertical.',
    ),
    equations: [
      { tex: 'P = mg', label: L('Trọng lực', 'Weight') },
      {
        tex: h.two
          ? '\\vec{T}_1 + \\vec{T}_2 + \\vec{P} = \\vec{0}'
          : '\\vec{T} + \\vec{P} = \\vec{0}',
        label: L('Nút cân bằng', 'The knot balances'),
      },
      ...(h.two
        ? [
            {
              tex: 'T_1 = \\dfrac{P\\sin\\alpha_2}{\\sin(\\alpha_1 + \\alpha_2)},\\quad T_2 = \\dfrac{P\\sin\\alpha_1}{\\sin(\\alpha_1 + \\alpha_2)}',
            },
          ]
        : []),
    ],
    assumptions: [
      L(
        'Dây nhẹ, không dãn: lực căng dọc theo dây, như nhau tại mọi điểm của một dây.',
        'Light, inextensible strings: each pulls along itself, with the same tension all along.',
      ),
      L(
        'Đèn và nút đứng yên; bỏ qua lực đẩy của không khí.',
        'Lamp and knot at rest; the air’s upthrust is ignored.',
      ),
    ],
    validity: L(
      'Với hai dây: ít nhất một dây nghiêng (α₁ + α₂ > 0); hai dây cùng thẳng đứng thì cân bằng không đủ để tính lực căng mỗi dây.',
      'With two strings: at least one is slanted (α₁ + α₂ > 0); with both vertical, balance alone cannot give each tension.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Công thức đúng của bài toán cân bằng; kiểm chứng bằng cách giải trực tiếp hệ hai phương trình chiếu (quy tắc Cramer).',
      'Exact balance formulas, cross-checked by solving the two component equations directly (Cramer’s rule).',
    ),
    method: L(
      'Tính một lần (đứng yên, không có chuyển động).',
      'Computed once (at rest, no motion).',
    ),
    userIntervened: false,
    sources: [SRC.sgk10kntt, SRC.halliday],
  };
}

const angleP = (key: string, sym: string, name: { vi: string; en: string }) => ({
  key,
  label: L(`Góc giữa ${name.vi} và phương thẳng đứng`, `Angle between ${name.en} and the vertical`),
  symbol: sym,
  kind: 'number' as const,
  unit: 'deg',
  min: 0,
  max: 85,
  step: 1,
  when: (p: Params) => hanging(p).two,
});

export const stringTension: PhysicsScene = {
  id: 'stringTension',
  required: ['m'],
  engineId: 'phys.tension',
  title: L('Trọng lực và lực căng dây', 'Weight and string tension'),
  usesGravity: true,
  params: [
    {
      key: 'strings',
      label: L('Cách treo', 'Hung by'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: 1, label: L('Một dây', 'One string') },
        { value: 2, label: L('Hai dây', 'Two strings') },
      ],
    },
    {
      key: 'm',
      label: L('Khối lượng đèn', 'Mass of the lamp'),
      symbol: 'm',
      kind: 'number',
      dim: DIM.mass,
      unit: 'kg',
      min: 0.1,
      max: 50,
      step: 0.1,
    },
    angleP('a1', '\\alpha_1', { vi: 'dây trái', en: 'the left string' }),
    angleP('a2', '\\alpha_2', { vi: 'dây phải', en: 'the right string' }),
    gravityParam,
  ],
  defaults: { strings: 2, m: 2, a1: Math.PI / 6, a2: Math.PI / 3 },
  validate: (p) =>
    indeterminate(hanging(p))
      ? [
          L(
            'Hai dây cùng thẳng đứng: không xác định được lực căng mỗi dây. Hãy nghiêng ít nhất một dây.',
            'Both strings vertical: each tension cannot be found. Slant at least one string.',
          ),
        ]
      : [],
  scienceCard: card,
  solve,
  graphs,
  bodies: [lamp],
  view,
  draw,
};
