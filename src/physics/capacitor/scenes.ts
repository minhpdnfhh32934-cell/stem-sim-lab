import type { Locale } from '@/app/i18n/types';
import type { LocalizedText } from '@/core/data/dataset';
import { DIM, fromSI } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common/scene-helpers';
import { SRC, sgkVl11 } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import { line, text } from '../render/draw';
import type {
  Answer,
  BodyDef,
  DrawContext,
  GraphDef,
  ParamDef,
  Params,
  PhysicsScene,
  Solution,
  WorldBounds,
} from '../types';
import { CP } from './engine';
import {
  BANK_DEFAULTS,
  MODE,
  bankCharge,
  bankEnergy,
  bankInput,
  equivalent,
  integratedEnergy,
  isValid,
  overRated,
  parts,
  solvedCharge,
  type Bank,
} from './model';

const SUB = ['₁', '₂', '₃'];

/** Layout of the drawing (arbitrary units): source on the left, capacitors to its right. */
const TOP = 5;
const BOTTOM = 1;

/** Where capacitor i sits, and whether its plates stand upright (on the top wire). */
function slot(b: Bank, i: number): { x: number; y: number; upright: boolean } {
  const n = b.caps.length;
  if (b.mode === MODE.parallel) return { x: 3.5 + i * 2.5, y: (TOP + BOTTOM) / 2, upright: false };
  return { x: (10 * (i + 1)) / (n + 1), y: TOP, upright: true };
}

function view(): WorldBounds {
  return { xMin: -2.2, xMax: 11.2, yMin: -0.6, yMax: 6.8 };
}

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const b = bankInput(p);
  if (!isValid(b)) return;
  const loc = opts.locale;
  const right = b.mode === MODE.parallel ? 3.5 + (b.caps.length - 1) * 2.5 : 10;
  // Wires and the source (long plate +, on top).
  line(ctx, cam, 0, TOP, right, TOP, c.text, 1.5);
  line(ctx, cam, 0, BOTTOM, right, BOTTOM, c.text, 1.5);
  line(ctx, cam, 0, TOP, 0, 3.15, c.text, 1.5);
  line(ctx, cam, 0, 2.85, 0, BOTTOM, c.text, 1.5);
  line(ctx, cam, -0.5, 3.15, 0.5, 3.15, c.text, 2.5);
  line(ctx, cam, -0.25, 2.85, 0.25, 2.85, c.text, 4);
  text(ctx, cam, 0, 3.15, '+', c.force, 'left', { x: 26, y: -2 });
  text(ctx, cam, 0, 3, `U = ${fmtQty(loc, b.U, 'V', 4)}`, c.text, 'right', { x: -14, y: 6 });
  if (b.mode !== MODE.parallel) line(ctx, cam, right, TOP, right, BOTTOM, c.text, 1.5);

  const done = Math.min(1, (state[CP.q] ?? 0) / Math.max(bankCharge(b), 1e-300));
  const ps = parts(b);
  const qMax = Math.max(...ps.map((x) => x.Q), 1e-300);
  ps.forEach((part, i) => {
    const s = slot(b, i);
    const gap = 0.18;
    const half = 0.65;
    if (b.mode === MODE.parallel) line(ctx, cam, s.x, TOP, s.x, BOTTOM, c.text, 1.5);
    // Clear the wire between the plates, then draw the plates.
    const bg = c.stage;
    if (s.upright) {
      line(ctx, cam, s.x - gap, s.y, s.x + gap, s.y, bg, 4);
      line(ctx, cam, s.x - gap, s.y - half, s.x - gap, s.y + half, c.force, 3);
      line(ctx, cam, s.x + gap, s.y - half, s.x + gap, s.y + half, c.velocity, 3);
    } else {
      line(ctx, cam, s.x, s.y - gap, s.x, s.y + gap, bg, 4);
      line(ctx, cam, s.x - half, s.y + gap, s.x + half, s.y + gap, c.force, 3);
      line(ctx, cam, s.x - half, s.y - gap, s.x + half, s.y - gap, c.velocity, 3);
    }
    // Charges on the plates grow with the charge reached (+ on the side of the source's +).
    const k = Math.round((6 * done * part.Q) / qMax);
    for (let j = 0; j < k; j++) {
      const f = -half + ((j + 0.5) * 2 * half) / 6;
      if (s.upright) {
        text(ctx, cam, s.x - gap, s.y + f, '+', c.force, 'right', { x: -3, y: 6 }, false);
        text(ctx, cam, s.x + gap, s.y + f, '−', c.velocity, 'left', { x: 3, y: 6 }, false);
      } else {
        text(ctx, cam, s.x + f, s.y + gap, '+', c.force, 'center', { x: 0, y: -2 }, false);
        text(ctx, cam, s.x + f, s.y - gap, '−', c.velocity, 'center', { x: 0, y: 16 }, false);
      }
    }
    const lx = s.upright ? s.x : s.x + half;
    const ly = s.upright ? s.y - half - 0.15 : s.y;
    const Ui = state[CP.U1 + i] ?? 0;
    const lines = [
      `C${SUB[i] ?? ''} = ${fmtQty(loc, part.C, 'uF', 4)}`,
      `U${SUB[i] ?? ''} = ${fmtQty(loc, Ui, 'V', 4)}`,
      `Q${SUB[i] ?? ''} = ${fmtQty(loc, part.C * Ui, 'uC', 4)}`,
    ];
    lines.forEach((t, j) => {
      text(ctx, cam, lx, ly, t, part.U > b.Umax ? c.force : c.text, s.upright ? 'center' : 'left', {
        x: s.upright ? 0 : 8,
        y: 16 + 16 * j - (s.upright ? 0 : 16),
      });
    });
  });
  const bx = cam.visible();
  text(
    ctx,
    cam,
    bx.xMin,
    bx.yMax,
    `C = ${fmtQty(loc, equivalent(b), 'uF', 4)}   q = ${fmtQty(loc, state[CP.q] ?? 0, 'uC', 4)}   W = ${fmtQty(loc, state[CP.W] ?? 0, 'mJ', 4)}`,
    c.muted,
    'left',
    { x: 60, y: 18 },
  );
}

const capBody = (i: number): BodyDef => ({
  id: `cap${String(i + 1)}`,
  label: L(`Tụ điện C${SUB[i] ?? ''}`, `Capacitor C${SUB[i] ?? ''}`),
  position: (_s, p) => {
    const s = slot(bankInput(p), i);
    return { x: s.x, y: s.y };
  },
  radius: () => 0.7,
  draggable: false,
  active: (p) => bankInput(p).caps.length > i,
  properties: (s, p) => {
    const b = bankInput(p);
    const C = b.caps[i] ?? 0;
    const U = s[CP.U1 + i] ?? 0;
    return [
      { label: L('Điện dung', 'Capacitance'), symbol: `C_${String(i + 1)}`, value: C, unit: 'uF' },
      { label: L('Hiệu điện thế', 'Voltage'), symbol: `U_${String(i + 1)}`, value: U, unit: 'V' },
      { label: L('Điện tích', 'Charge'), symbol: `Q_${String(i + 1)}`, value: C * U, unit: 'uC' },
      {
        label: L('Năng lượng', 'Energy'),
        symbol: `W_${String(i + 1)}`,
        value: 0.5 * C * U * U,
        unit: 'mJ',
      },
    ];
  },
});

const graphs: GraphDef[] = [
  {
    id: 'uq',
    title: L('Hiệu điện thế theo điện tích khi tích điện', 'Voltage against charge while charging'),
    yLabel: L('U (V)', 'U (V)'),
    x: { label: L('q (µC)', 'q (µC)'), value: (s) => fromSI(s[CP.q] ?? 0, 'uC') },
    series: [{ id: 'U', label: L('U = q/C', 'U = q/C'), value: (s) => s[CP.U] ?? 0 }],
  },
  {
    id: 'wq',
    title: L('Năng lượng theo điện tích khi tích điện', 'Energy against charge while charging'),
    yLabel: L('W (mJ)', 'W (mJ)'),
    x: { label: L('q (µC)', 'q (µC)'), value: (s) => fromSI(s[CP.q] ?? 0, 'uC') },
    series: [
      { id: 'W', label: L('W = q²/2C', 'W = q²/2C'), value: (s) => fromSI(s[CP.W] ?? 0, 'mJ') },
    ],
  },
];

function solve(p: Params, locale: Locale): Solution {
  const b = bankInput(p);
  if (!isValid(b)) return { answers: [], steps: [] };
  const n = (v: number) => texNum(locale, v);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const C = equivalent(b);
  const charge = bankCharge(b);
  const W = bankEnergy(b);
  const qStar = solvedCharge(b);
  const ps = parts(b);
  const answers: Answer[] = [
    {
      id: 'C',
      label: L('Điện dung của bộ tụ', 'Capacitance of the bank'),
      value: C,
      unit: 'uF',
      check: qStar / b.U,
    },
    {
      id: 'Q',
      label: L('Điện tích của bộ tụ', 'Charge of the bank'),
      value: charge,
      unit: 'uC',
      check: qStar,
    },
    {
      id: 'W',
      label: L('Năng lượng của bộ tụ', 'Energy of the bank'),
      value: W,
      unit: 'mJ',
      check: integratedEnergy(b),
    },
    ...ps.flatMap((part, i): Answer[] => [
      {
        id: `U${String(i + 1)}`,
        label: L(`Hiệu điện thế trên tụ C${SUB[i] ?? ''}`, `Voltage on C${SUB[i] ?? ''}`),
        value: part.U,
        unit: 'V',
      },
      {
        id: `Q${String(i + 1)}`,
        label: L(`Điện tích của tụ C${SUB[i] ?? ''}`, `Charge on C${SUB[i] ?? ''}`),
        value: part.Q,
        unit: 'uC',
      },
    ]),
  ];
  const idx = b.caps.map((_c, i) => String(i + 1));
  const sumTex =
    b.mode === MODE.parallel
      ? `C = ${idx.map((i) => `C_${i}`).join(' + ')} = ${b.caps.map((x) => n(x)).join(' + ')} = ${Q(C, 'uF')}`
      : b.mode === MODE.series
        ? `\\frac{1}{C} = ${idx.map((i) => `\\frac{1}{C_${i}}`).join(' + ')} \\Rightarrow C = ${Q(C, 'uF')}`
        : `C = C_1 = ${Q(C, 'uF')}`;
  const steps = [
    {
      text:
        b.mode === MODE.series
          ? L('Các tụ ghép nối tiếp (21.5):', 'The capacitors are in series (21.5):')
          : b.mode === MODE.parallel
            ? L('Các tụ ghép song song (21.8):', 'The capacitors are in parallel (21.8):')
            : L('Chỉ có một tụ điện:', 'There is a single capacitor:'),
      tex: sumTex,
    },
    {
      text: L('Điện tích của bộ tụ (21.1):', 'The charge of the bank (21.1):'),
      tex: `Q = CU = ${n(C)}\\cdot ${n(b.U)} = ${Q(charge, 'uC')}`,
    },
    {
      text:
        b.mode === MODE.parallel
          ? L(
              'Mỗi tụ chịu cùng hiệu điện thế U, điện tích Qᵢ = CᵢU (21.6, 21.7):',
              'Each capacitor takes the same U, charge Qᵢ = CᵢU (21.6, 21.7):',
            )
          : L(
              'Các tụ có cùng điện tích Q, hiệu điện thế Uᵢ = Q/Cᵢ (21.3, 21.4):',
              'The capacitors share the charge Q, voltage Uᵢ = Q/Cᵢ (21.3, 21.4):',
            ),
      tex: ps.map((part, i) => `U_${String(i + 1)} = ${Q(part.U, 'V')}`).join(',\\ '),
    },
    {
      text: L('Năng lượng của bộ tụ (21.9):', 'The energy of the bank (21.9):'),
      tex: `W = \\frac{CU^2}{2} = \\frac{${n(C)}\\cdot ${n(b.U)}^2}{2} = ${Q(W, 'mJ')}`,
    },
  ];
  const notes: LocalizedText[] = [];
  const over = overRated(b);
  if (over.length)
    notes.push(
      L(
        `Hiệu điện thế trên tụ ${over.map((i) => `C${SUB[i - 1] ?? ''}`).join(', ')} vượt giới hạn ${String(b.Umax)} V: tụ có nguy cơ bị đánh thủng.`,
        `The voltage on ${over.map((i) => `C${SUB[i - 1] ?? ''}`).join(', ')} is above the ${String(b.Umax)} V rating: the capacitor may break down.`,
      ),
    );
  if (b.mode !== MODE.single)
    notes.push(
      L(
        'Ghép song song cho điện dung lớn hơn ghép nối tiếp (ví dụ tr. 86–87): ở cùng hiệu điện thế, bộ ghép song song tích được nhiều điện tích hơn.',
        'In parallel the capacitance is larger than in series (example, pp. 86–87): at the same voltage the parallel bank stores more charge.',
      ),
    );
  return { answers, steps, notes };
}

function validate(p: Params): LocalizedText[] {
  return isValid(bankInput(p))
    ? []
    : [L('Điện dung các tụ phải lớn hơn 0.', 'Every capacitance must be greater than 0.')];
}

function card(): ScienceCardData {
  return {
    title: L('Tụ điện', 'Capacitors'),
    model: L(
      'Một tụ điện hoặc bộ 2–3 tụ ghép nối tiếp hay song song, ban đầu chưa tích điện, được nối với nguồn có hiệu điện thế U. Điện dung của mỗi tụ không đổi.',
      'One capacitor, or a bank of 2–3 capacitors in series or in parallel, uncharged at first, connected to a source of voltage U. Each capacitance is constant.',
    ),
    equations: [
      { tex: 'C = \\frac{Q}{U}', label: L('Điện dung (21.2)', 'Capacitance (21.2)') },
      {
        tex: '\\frac{1}{C} = \\frac{1}{C_1} + \\frac{1}{C_2} + \\ldots + \\frac{1}{C_n}',
        label: L('Ghép nối tiếp (21.5)', 'In series (21.5)'),
      },
      {
        tex: 'C = C_1 + C_2 + \\ldots + C_n',
        label: L('Ghép song song (21.8)', 'In parallel (21.8)'),
      },
      {
        tex: 'W = \\frac{QU}{2} = \\frac{Q^2}{2C} = \\frac{CU^2}{2}',
        label: L('Năng lượng của tụ (21.9)', 'Energy of a capacitor (21.9)'),
      },
    ],
    assumptions: [
      L(
        'Tụ lí tưởng: không rò điện, điện dung không phụ thuộc hiệu điện thế; dây nối không có điện trở.',
        'Ideal capacitors: no leakage, capacitance independent of the voltage; the wires have no resistance.',
      ),
      L(
        'Quá trình tích điện được vẽ chậm, điện tích tăng đều trong 4 s, chỉ để minh họa Hình 21.9; mạch không có điện trở nên SimLab không tính thời gian tích điện thật.',
        'Charging is drawn slowly, the charge growing steadily over 4 s, only to illustrate Figure 21.9; with no resistor in the circuit SimLab does not compute a real charging time.',
      ),
      L(
        'Mặc định theo bài tập ví dụ tr. 86 (C₁ = 2 µF, C₂ = 3 µF, C₃ = 4 µF) và câu hỏi 1 tr. 85 (tụ 2 µF – 200 V, U = 36 V).',
        'Defaults from the worked example on p. 86 (C₁ = 2 µF, C₂ = 3 µF, C₃ = 4 µF) and question 1 on p. 85 (a 2 µF – 200 V capacitor at 36 V).',
      ),
    ],
    validity: L(
      'Tụ lí tưởng, hiệu điện thế trên mỗi tụ không vượt giới hạn ghi trên vỏ (nếu vượt, tụ có thể bị đánh thủng).',
      'Ideal capacitors whose voltages stay within the printed rating (above it the dielectric may break down).',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Công thức đúng của tụ lí tưởng. Kiểm chứng độc lập: điện tích tìm bằng phương pháp chia đôi từ U = U₁ + … + Uₙ (không dùng công thức 1/C); năng lượng tích phân U dq bằng DOPRI5 (diện tích dưới đường U(q), Hình 21.9).',
      'Exact for ideal capacitors. Independent checks: the charge found by bisection from U = U₁ + … + Uₙ (without the 1/C formula); the energy integrates U dq with DOPRI5 (the area under U(q), Figure 21.9).',
    ),
    method: L(
      'Ở mỗi bước (Δt = 1/60 s) U = q/C và W = q²/2C tính đúng cho điện tích đã đạt.',
      'At each step (Δt = 1/60 s) U = q/C and W = q²/2C are exact for the charge reached.',
    ),
    userIntervened: false,
    sources: [sgkVl11(21), SRC.hallidayElectric, SRC.hairer],
  };
}

const capParam = (i: number): ParamDef => ({
  key: `C${String(i)}`,
  label: L(`Điện dung tụ ${String(i)}`, `Capacitance of capacitor ${String(i)}`),
  symbol: `C_${String(i)}`,
  kind: 'number',
  dim: DIM.capacitance,
  unit: 'uF',
  min: 0.1,
  max: 100,
  step: 0.1,
  when: (p) => bankInput(p).caps.length >= i,
});

export const capacitor: PhysicsScene = {
  id: 'capacitor',
  engineId: 'phys.capacitor',
  title: L('Tụ điện', 'Capacitors'),
  required: ['C1', 'U'],
  params: [
    {
      key: 'mode',
      label: L('Cách mắc', 'Connection'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: MODE.single, label: L('Một tụ', 'One capacitor') },
        { value: MODE.series, label: L('Nối tiếp', 'Series') },
        { value: MODE.parallel, label: L('Song song', 'Parallel') },
      ],
    },
    {
      key: 'U',
      label: L('Hiệu điện thế của nguồn', 'Voltage of the source'),
      symbol: 'U',
      kind: 'number',
      dim: DIM.voltage,
      unit: 'V',
      min: 1,
      max: 500,
      step: 1,
    },
    capParam(1),
    capParam(2),
    capParam(3),
    {
      key: 'count',
      label: L('Số tụ trong bộ', 'Capacitors in the bank'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: 2, label: L('2 tụ', '2 capacitors') },
        { value: 3, label: L('3 tụ', '3 capacitors') },
      ],
      when: (p) => bankInput(p).mode !== MODE.single,
    },
    {
      key: 'Umax',
      label: L(
        'Hiệu điện thế giới hạn ghi trên mỗi tụ',
        'Voltage rating printed on each capacitor',
      ),
      symbol: { vi: 'U_{gh}', en: 'U_{max}' },
      kind: 'number',
      dim: DIM.voltage,
      unit: 'V',
      min: 1,
      max: 1000,
      step: 1,
    },
  ],
  defaults: { ...BANK_DEFAULTS },
  usesGravity: false,
  validate,
  scienceCard: card,
  solve,
  graphs,
  bodies: [0, 1, 2].map(capBody),
  view,
  draw,
};
