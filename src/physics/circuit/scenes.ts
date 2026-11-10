import type { Locale } from '@/app/i18n/types';
import type { LocalizedText } from '@/core/data/dataset';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { texNum, texQty } from '../common/tex';
import type {
  Answer,
  BodyDef,
  GraphDef,
  ParamDef,
  Params,
  PhysicsScene,
  Solution,
  SolutionStep,
} from '../types';
import { circuitView, drawCircuit, placement } from './draw';
import { CE } from './engine';
import {
  LAYOUT,
  circuitInput,
  nodalSolve,
  resistorCount,
  solveCircuit,
  type Circuit,
} from './model';

const SUB = ['₁', '₂', '₃'];
const used = (p: Params) => resistorCount(circuitInput(p));

function validate(p: Params): LocalizedText[] {
  const c = circuitInput(p);
  const errors: LocalizedText[] = [];
  if (!(c.emf > 0)) {
    errors.push(L('Suất điện động E phải lớn hơn 0.', 'The emf E must be greater than 0.'));
  }
  if (!(c.r >= 0)) {
    errors.push(
      L('Điện trở trong r không được âm.', 'The internal resistance r cannot be negative.'),
    );
  }
  c.R.slice(0, resistorCount(c)).forEach((R, i) => {
    if (!(R > 0)) {
      errors.push(
        L(
          `Điện trở R${SUB[i] ?? ''} phải lớn hơn 0.`,
          `Resistance R${SUB[i] ?? ''} must be greater than 0.`,
        ),
      );
    }
  });
  return errors;
}

/** R_N of each layout as the textbook writes it: the general formula, then the numbers. */
function rnStep(c: Circuit, locale: Locale): SolutionStep {
  const Q = (v: number, u = 'ohm') => texQty(locale, v, u);
  const [R1, R2, R3] = c.R;
  const RN = solveCircuit(c).RN;
  const end = `= ${Q(RN)}`;
  const lines: Record<number, [LocalizedText, string]> = {
    [LAYOUT.one]: [
      L('Mạch ngoài chỉ có R₁:', 'The external circuit is R₁ alone:'),
      `R_N = R_1 ${end}`,
    ],
    [LAYOUT.series2]: [
      L('Hai điện trở mắc nối tiếp:', 'Two resistors in series:'),
      `R_N = R_1 + R_2 = ${Q(R1)} + ${Q(R2)} ${end}`,
    ],
    [LAYOUT.series3]: [
      L('Ba điện trở mắc nối tiếp:', 'Three resistors in series:'),
      `R_N = R_1 + R_2 + R_3 = ${Q(R1)} + ${Q(R2)} + ${Q(R3)} ${end}`,
    ],
    [LAYOUT.parallel2]: [
      L('Hai điện trở mắc song song:', 'Two resistors in parallel:'),
      `R_N = \\frac{R_1 R_2}{R_1 + R_2} = \\frac{${Q(R1)} \\cdot ${Q(R2)}}{${Q(R1)} + ${Q(R2)}} ${end}`,
    ],
    [LAYOUT.parallel3]: [
      L('Ba điện trở mắc song song:', 'Three resistors in parallel:'),
      `\\frac{1}{R_N} = \\frac{1}{R_1} + \\frac{1}{R_2} + \\frac{1}{R_3} \\Rightarrow R_N ${end}`,
    ],
    [LAYOUT.seriesParallel]: [
      L('R₁ nối tiếp với cụm (R₂ song song R₃):', 'R₁ in series with (R₂ parallel to R₃):'),
      `R_N = R_1 + \\frac{R_2 R_3}{R_2 + R_3} = ${Q(R1)} + \\frac{${Q(R2)} \\cdot ${Q(R3)}}{${Q(R2)} + ${Q(R3)}} ${end}`,
    ],
    [LAYOUT.parallelSeries]: [
      L('Cụm (R₁ nối tiếp R₂) song song với R₃:', '(R₁ in series with R₂) in parallel with R₃:'),
      `R_N = \\frac{(R_1 + R_2) R_3}{R_1 + R_2 + R_3} = \\frac{(${Q(R1)} + ${Q(R2)}) \\cdot ${Q(R3)}}{${Q(R1)} + ${Q(R2)} + ${Q(R3)}} ${end}`,
    ],
  };
  const [text, tex] = lines[c.layout] ?? lines[LAYOUT.series2] ?? [L('', ''), ''];
  return { text, tex };
}

function solve(p: Params, locale: Locale): Solution {
  const c = circuitInput(p);
  const r = solveCircuit(c);
  const check = nodalSolve(c);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const steps: SolutionStep[] = [
    rnStep(c, locale),
    {
      text: L(
        'Định luật Ohm cho toàn mạch (cường độ dòng điện qua nguồn, số chỉ ampe kế):',
        "Ohm's law for the whole circuit (current through the source, the ammeter reading):",
      ),
      tex: `I = \\frac{E}{R_N + r} = \\frac{${Q(c.emf, 'V')}}{${Q(r.RN, 'ohm')} + ${Q(c.r, 'ohm')}} = ${Q(r.I, 'A')}`,
    },
    {
      text: L(
        'Hiệu điện thế giữa hai cực của nguồn (số chỉ vôn kế); bằng E chỉ khi r = 0:',
        'Voltage across the terminals (the voltmeter reading); equal to E only when r = 0:',
      ),
      tex: `U = E - I r = I R_N = ${Q(r.U, 'V')}`,
    },
    ...r.parts.map((part, i): SolutionStep => {
      const n = i + 1;
      return {
        text: L(`Điện trở R${SUB[i] ?? ''}:`, `Resistor R${SUB[i] ?? ''}:`),
        tex: `I_${n} = ${Q(part.I, 'A')},\\quad U_${n} = I_${n} R_${n} = ${Q(part.U, 'V')},\\quad P_${n} = U_${n} I_${n} = ${Q(part.P, 'W')}`,
      };
    }),
    {
      text: L(
        'Công suất mạch ngoài, công suất của nguồn và hiệu suất của nguồn:',
        'Power of the external circuit, power of the source and its efficiency:',
      ),
      tex: `P = U I = ${Q(r.Pout, 'W')},\\quad P_{ng} = E I = ${Q(r.Psource, 'W')},\\quad H = \\frac{U}{E} = ${texNum(locale, r.H * 100)}\\,\\%`,
    },
  ];
  const answers: Answer[] = [
    {
      id: 'RN',
      label: L('Điện trở mạch ngoài R_N', 'External resistance R_N'),
      value: r.RN,
      unit: 'ohm',
      check: check.RN,
    },
    {
      id: 'I',
      label: L('Cường độ dòng điện qua nguồn I', 'Current through the source I'),
      value: r.I,
      unit: 'A',
      check: check.I,
    },
    {
      id: 'U',
      label: L('Hiệu điện thế mạch ngoài U', 'Terminal voltage U'),
      value: r.U,
      unit: 'V',
      check: check.U,
    },
    ...r.parts.flatMap((part, i): Answer[] => [
      {
        id: `I${String(i + 1)}`,
        label: L(`Dòng điện qua R${SUB[i] ?? ''}`, `Current through R${SUB[i] ?? ''}`),
        value: part.I,
        unit: 'A',
        check: check.parts[i]?.I ?? Number.NaN,
      },
      {
        id: `U${String(i + 1)}`,
        label: L(`Hiệu điện thế trên R${SUB[i] ?? ''}`, `Voltage across R${SUB[i] ?? ''}`),
        value: part.U,
        unit: 'V',
        check: check.parts[i]?.U ?? Number.NaN,
      },
    ]),
    {
      id: 'P_out',
      label: L('Công suất mạch ngoài P', 'Power of the external circuit P'),
      value: r.Pout,
      unit: 'W',
      check: check.Pout,
    },
    {
      id: 'P_source',
      label: L('Công suất của nguồn', 'Power of the source'),
      value: r.Psource,
      unit: 'W',
      check: check.Psource,
    },
    {
      id: 'H',
      label: L('Hiệu suất của nguồn H', 'Efficiency of the source H'),
      value: r.H,
      unit: '%',
      check: check.H,
    },
  ];
  return { answers, steps };
}

function card(): ScienceCardData {
  return {
    title: L('Mạch điện một chiều', 'Direct-current circuit'),
    model: L(
      'Nguồn điện có suất điện động E và điện trở trong r nối với mạch ngoài gồm 1 đến 3 điện trở thuần (nối tiếp, song song hoặc hỗn hợp). Mạch ở trạng thái ổn định: dòng điện không đổi.',
      'A source of emf E and internal resistance r feeds an external circuit of 1 to 3 resistors (series, parallel or mixed). The circuit is at steady state: the current does not change.',
    ),
    equations: [
      {
        tex: 'R_{nt} = R_1 + R_2 + \\dots,\\quad \\frac{1}{R_{ss}} = \\frac{1}{R_1} + \\frac{1}{R_2} + \\dots',
        label: L(
          'Điện trở tương đương: nối tiếp, song song',
          'Equivalent resistance: series, parallel',
        ),
      },
      {
        tex: 'I = \\frac{E}{R_N + r},\\quad U = E - I r = I R_N',
        label: L('Định luật Ohm cho toàn mạch', "Ohm's law for the whole circuit"),
      },
      {
        tex: 'P = U I,\\quad P_{ng} = E I,\\quad H = \\frac{U}{E}',
        label: L(
          'Công suất mạch ngoài, công suất của nguồn, hiệu suất',
          'Power of the external circuit, power of the source, efficiency',
        ),
      },
    ],
    assumptions: [
      L(
        'Điện trở thuần không đổi theo nhiệt độ; dây nối, ampe kế và vôn kế lí tưởng (dây và ampe kế không có điện trở, vôn kế có điện trở rất lớn).',
        'Resistances do not change with temperature; ideal wires, ammeter and voltmeter (wires and ammeter have no resistance, the voltmeter a very large one).',
      ),
      L(
        'E và r của nguồn không đổi. Đề không cho r thì r = 0 (nguồn lí tưởng): khi đó U = E.',
        'E and r stay constant. A problem that gives no r uses r = 0 (an ideal source): then U = E.',
      ),
      L(
        'Hình vẽ là sơ đồ, không theo tỉ lệ: lưới và trục của sân khấu không có ý nghĩa ở bài này.',
        'The picture is a diagram, not to scale: the stage grid and axes mean nothing in this topic.',
      ),
    ],
    validity: L(
      'Dòng điện không đổi (mạch đã ổn định), điện trở thuần. Không áp dụng cho tụ điện, cuộn cảm, đèn có điện trở đổi theo nhiệt độ.',
      'Steady current, pure resistances. Not for capacitors, inductors or lamps whose resistance changes with temperature.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Các con số tính bằng công thức chính xác và được kiểm chéo bằng phương pháp điện thế nút (định luật Kirchhoff về dòng điện tại mỗi nút, giải hệ phương trình tuyến tính), không dùng công thức nối tiếp, song song.',
      "The numbers come from exact formulas and are cross-checked with nodal analysis (Kirchhoff's current law at every node, a linear system), which never uses the series/parallel formulas.",
    ),
    method: L(
      'Mạch tĩnh: tính một lần mỗi khi thông số đổi; đồng hồ chạy để đồ thị hiện các giá trị không đổi.',
      'A static circuit: computed once per parameter change; the clock runs so the graphs show the constant values.',
    ),
    userIntervened: false,
    sources: [SRC.sgk11kntt, SRC.hallidayCircuits],
  };
}

const resistor = (i: 1 | 2 | 3): ParamDef => ({
  key: `R${String(i)}`,
  label: L(`Điện trở thứ ${String(i)}`, `Resistor ${String(i)}`),
  symbol: `R_${String(i)}`,
  kind: 'number',
  dim: DIM.resistance,
  unit: 'ohm',
  min: 0.5,
  max: 100,
  step: 0.5,
  when: (p) => used(p) >= i,
});

const body = (i: 1 | 2 | 3): BodyDef => ({
  id: `R${String(i)}`,
  label: L(`Điện trở R${SUB[i - 1] ?? ''}`, `Resistor R${SUB[i - 1] ?? ''}`),
  position: (_s, p) => placement(circuitInput(p).layout).at[i - 1] ?? { x: 0, y: 0 },
  radius: () => 0.7,
  draggable: false,
  active: (p) => used(p) >= i,
  properties: (_s, p) => {
    const part = solveCircuit(circuitInput(p)).parts[i - 1];
    if (!part) return [];
    return [
      { label: L('Điện trở', 'Resistance'), symbol: 'R', value: part.R, unit: 'ohm' },
      { label: L('Cường độ dòng điện', 'Current'), symbol: 'I', value: part.I, unit: 'A' },
      { label: L('Hiệu điện thế', 'Voltage'), symbol: 'U', value: part.U, unit: 'V' },
      { label: L('Công suất', 'Power'), symbol: 'P', value: part.P, unit: 'W' },
    ];
  },
});

const graphs: GraphDef[] = [
  {
    id: 'steady',
    title: L(
      'I và U (mạch ở trạng thái ổn định: không đổi theo thời gian)',
      'I and U (steady state: constant in time)',
    ),
    yLabel: L('Giá trị (A; V)', 'Value (A; V)'),
    series: [
      { id: 'I', label: L('I (A)', 'I (A)'), value: (s) => s[CE.I] ?? 0 },
      { id: 'U', label: L('U (V)', 'U (V)'), value: (s) => s[CE.U] ?? 0 },
    ],
  },
  {
    id: 'power',
    title: L('Công suất mạch ngoài (không đổi)', 'Power of the external circuit (constant)'),
    yLabel: L('P (W)', 'P (W)'),
    series: [{ id: 'P', label: L('P', 'P'), value: (s) => s[CE.P] ?? 0 }],
  },
];

export const dcCircuit: PhysicsScene = {
  id: 'dcCircuit',
  engineId: 'phys.circuit',
  title: L('Mạch điện một chiều', 'Direct-current circuit'),
  // `when` keeps only the resistors the chosen layout uses; r is optional (0 = ideal source).
  required: ['emf', 'R1', 'R2', 'R3'],
  usesGravity: false,
  params: [
    {
      key: 'layout',
      label: L('Cách mắc mạch ngoài', 'External circuit'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: LAYOUT.one, label: L('1 điện trở', '1 resistor') },
        { value: LAYOUT.series2, label: L('2 điện trở nối tiếp', '2 resistors in series') },
        { value: LAYOUT.series3, label: L('3 điện trở nối tiếp', '3 resistors in series') },
        { value: LAYOUT.parallel2, label: L('2 điện trở song song', '2 resistors in parallel') },
        { value: LAYOUT.parallel3, label: L('3 điện trở song song', '3 resistors in parallel') },
        { value: LAYOUT.seriesParallel, label: L('R₁ nt (R₂ ∥ R₃)', 'R₁ + (R₂ ∥ R₃)') },
        { value: LAYOUT.parallelSeries, label: L('(R₁ nt R₂) ∥ R₃', '(R₁ + R₂) ∥ R₃') },
      ],
    },
    {
      key: 'emf',
      label: L('Suất điện động của nguồn', 'Electromotive force (emf)'),
      symbol: 'E',
      kind: 'number',
      dim: DIM.voltage,
      unit: 'V',
      min: 1,
      max: 48,
      step: 0.5,
    },
    resistor(1),
    resistor(2),
    resistor(3),
    {
      key: 'rInt',
      label: L('Điện trở trong của nguồn', 'Internal resistance of the source'),
      symbol: 'r',
      kind: 'number',
      dim: DIM.resistance,
      unit: 'ohm',
      min: 0,
      max: 10,
      step: 0.1,
    },
  ],
  // E = 12 V, r = 0, R₁ = 4 Ω nối tiếp R₂ = 6 Ω: R_N = 10 Ω, I = 1,2 A, U = 12 V.
  defaults: { layout: LAYOUT.series2, emf: 12, R1: 4, R2: 6, R3: 12, rInt: 0 },
  validate,
  scienceCard: card,
  solve,
  graphs,
  bodies: [body(1), body(2), body(3)],
  view: circuitView,
  draw: drawCircuit,
};
