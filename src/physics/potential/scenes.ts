import { lazy } from 'react';
import type { Locale } from '@/app/i18n/types';
import type { LocalizedText } from '@/core/data/dataset';
import { DIM, fromSI } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { DASH, L } from '../common/scene-helpers';
import { SRC, sgkVl11 } from '../common/sources';
import { fmtQty, texNum, texQty } from '../common/tex';
import { arrow, circle, line, polygon, polyline, text } from '../render/draw';
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
import { PT } from './engine';
import {
  CHARGE,
  PATH,
  PLATE_DEFAULTS,
  energy,
  field,
  integratedPotential,
  integratedWork,
  isValid,
  pathPoints,
  platesInput,
  potential,
  work,
  type Plates,
  rightEdge,
} from './model';

/** Furthest N can be from M along the plates (m). */
const DX_MAX = 0.2;

function view(p: Params): WorldBounds {
  const q = platesInput(p);
  const d = q.d > 0 ? q.d : 0.04;
  return { xMin: -0.6 * d, xMax: rightEdge(q) + 0.25 * d, yMin: -0.35 * d, yMax: 1.45 * d };
}

/** Energies in nJ for a test charge (nC × V), in eV for an electron or a proton. */
const energyUnit = (q: Plates) => (q.kind === CHARGE.test ? 'nJ' : 'eV');

const pick = (p: Params) => Math.max(0.004, 0.06 * platesInput(p).d);

const charge: BodyDef = {
  id: 'charge',
  label: L('Điện tích q', 'Charge q'),
  position: (s) => ({ x: s[PT.x] ?? 0, y: s[PT.y] ?? 0 }),
  radius: pick,
  draggable: false,
  properties: (s, p) => [
    {
      label: L('Điện thế tại chỗ điện tích', 'Potential where the charge is'),
      symbol: 'V',
      value: s[PT.V] ?? 0,
      unit: 'V',
    },
    {
      label: L('Thế năng điện', 'Electric potential energy'),
      symbol: 'W',
      value: s[PT.W] ?? 0,
      unit: energyUnit(platesInput(p)),
    },
    {
      label: L('Công của lực điện từ M', 'Work of the electric force from M'),
      symbol: 'A',
      value: s[PT.A] ?? 0,
      unit: energyUnit(platesInput(p)),
    },
  ],
};

const clampY = (y: number, p: Params) =>
  Math.min(platesInput(p).d, Math.max(0, Math.round(y * 1000) / 1000));

const pointM: BodyDef = {
  id: 'pointM',
  label: L('Điểm M', 'Point M'),
  position: (_s, p) => platesInput(p).M,
  radius: pick,
  draggable: true,
  // Dragging M up or down sets its height above the negative plate.
  dragTo: (_x, y, p) => ({ hM: clampY(y, p) }),
  properties: (_s, p) => {
    const q = platesInput(p);
    return [
      {
        label: L('Khoảng cách tới bản âm', 'Distance to the negative plate'),
        symbol: 'h_M',
        value: q.M.y,
        unit: 'cm',
      },
      {
        label: L('Điện thế tại M', 'Potential at M'),
        symbol: 'V_M',
        value: potential(q, q.M.y),
        unit: 'V',
      },
    ];
  },
};

const pointN: BodyDef = {
  id: 'pointN',
  label: L('Điểm N', 'Point N'),
  position: (_s, p) => platesInput(p).N,
  radius: pick,
  draggable: true,
  dragTo: (x, y, p) => ({
    hN: clampY(y, p),
    dx: Math.min(DX_MAX, Math.max(0, Math.round(x * 1000) / 1000)),
  }),
  properties: (_s, p) => {
    const q = platesInput(p);
    return [
      {
        label: L('Khoảng cách tới bản âm', 'Distance to the negative plate'),
        symbol: 'h_N',
        value: q.N.y,
        unit: 'cm',
      },
      {
        label: L('Điện thế tại N', 'Potential at N'),
        symbol: 'V_N',
        value: potential(q, q.N.y),
        unit: 'V',
      },
    ];
  },
};

function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const q = platesInput(p);
  if (!isValid(q)) return;
  const d = q.d;
  const x0 = -0.45 * d;
  const x1 = rightEdge(q);
  const t = 0.06 * d;
  const loc = opts.locale;
  // Positive plate on top (V = U), negative plate below (V = 0).
  for (const [y, sign, colour] of [
    [d, '+', c.force],
    [0, '−', c.velocity],
  ] as const) {
    polygon(
      ctx,
      cam,
      [
        { x: x0, y },
        { x: x1, y },
        { x: x1, y: y + (sign === '+' ? t : -t) },
        { x: x0, y: y + (sign === '+' ? t : -t) },
      ],
      colour,
    );
    const n = 8;
    for (let i = 0; i <= n; i++)
      text(
        ctx,
        cam,
        x0 + ((x1 - x0) * i) / n,
        y + (sign === '+' ? t : -t) / 2,
        sign,
        c.text,
        'center',
        { x: 0, y: 7 },
        false,
      );
  }
  text(ctx, cam, x0, d, `V = ${fmtQty(loc, q.U, 'V', 4)}`, c.muted, 'right', { x: -6, y: 4 });
  text(ctx, cam, x0, 0, 'V = 0', c.muted, 'right', { x: -6, y: 4 });
  // Field lines: E points from + to −.
  const lines = 6;
  for (let i = 0; i < lines; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / lines;
    line(ctx, cam, x, d, x, 0, c.faint, 1);
    arrow(ctx, cam, x, 0.55 * d, 0, -0.12 * d, c.faint);
  }
  text(ctx, cam, x1, 0.5 * d, `E = ${fmtQty(loc, field(q), 'V/m', 4)}`, c.text, 'left', {
    x: 6,
    y: 4,
  });
  // Equipotentials through M and N.
  for (const [pt, name] of [
    [q.M, 'M'],
    [q.N, 'N'],
  ] as const) {
    line(ctx, cam, x0, pt.y, x1, pt.y, c.muted, 1, [3, 4]);
    text(
      ctx,
      cam,
      x1,
      pt.y,
      `V${name === 'M' ? 'ₘ' : 'ₙ'} = ${fmtQty(loc, potential(q, pt.y), 'V', 4)}`,
      c.muted,
      'right',
      { x: -4, y: -4 },
    );
  }
  // The chosen path, then M, N, P.
  const pts = pathPoints(q);
  polyline(ctx, cam, pts, c.accent, 1.5, DASH);
  const r = pick(p) / 2;
  for (const [pt, name, id] of [
    [q.M, 'M', 'pointM'],
    [q.N, 'N', 'pointN'],
  ] as const) {
    circle(ctx, cam, pt.x, pt.y, r * 0.6, opts.selected === id ? c.accent : c.bodyAlt, c.text, 4);
    text(ctx, cam, pt.x, pt.y, name, c.text, 'left', { x: 8, y: -6 });
  }
  if (q.path === PATH.broken) text(ctx, cam, q.P.x, q.P.y, 'P', c.text, 'left', { x: 6, y: -6 });
  // The charge, with its sign.
  const x = state[PT.x] ?? q.M.x;
  const y = state[PT.y] ?? q.M.y;
  circle(ctx, cam, x, y, r, q.q >= 0 ? c.force : c.velocity, c.text, 8);
  text(ctx, cam, x, y, q.q >= 0 ? '+' : '−', c.panel, 'center', { x: 0, y: 7 }, false);
  // Force on the charge: qE, down for a positive charge.
  if (opts.vectors && q.U !== 0)
    arrow(ctx, cam, x, y, 0, (q.q >= 0 ? -1 : 1) * Math.sign(q.U) * 0.22 * d, c.force, 'F');
  // d beside the plates.
  const xd = x0 - 0.12 * d;
  line(ctx, cam, xd, 0, xd, d, c.text, 1, DASH);
  text(ctx, cam, xd, d / 2, 'd', c.text, 'right', { x: -4, y: 6 });
  const b = cam.visible();
  text(
    ctx,
    cam,
    b.xMin,
    b.yMax,
    `A = ${fmtQty(loc, state[PT.A] ?? 0, energyUnit(q), 4)}   W = ${fmtQty(loc, state[PT.W] ?? 0, energyUnit(q), 4)}`,
    c.muted,
    'left',
    { x: 60, y: 18 },
  );
}

/** Graph values in the energy unit of the answers: nJ for a test charge, eV for e⁻ or p⁺. */
const inUnit = (v: number, p: Params) => fromSI(v, energyUnit(platesInput(p)));

const graphs: GraphDef[] = [
  {
    id: 'workEnergy',
    title: L('Công và thế năng theo quãng đường', 'Work and potential energy along the path'),
    yLabel: L('A, W (nJ; eV với electron, proton)', 'A, W (nJ; eV for an electron, a proton)'),
    x: { label: L('s (m)', 's (m)'), value: (s) => s[PT.s] ?? 0 },
    series: [
      {
        id: 'A',
        label: L('Công A của lực điện', 'Work A of the electric force'),
        value: (s, p) => inUnit(s[PT.A] ?? 0, p),
      },
      {
        id: 'W',
        label: L('Thế năng W', 'Potential energy W'),
        value: (s, p) => inUnit(s[PT.W] ?? 0, p),
      },
    ],
  },
];

const KIND_NAME: Record<number, LocalizedText> = {
  [CHARGE.test]: L('điện tích thử q', 'the test charge q'),
  [CHARGE.electron]: L('electron', 'the electron'),
  [CHARGE.proton]: L('proton', 'the proton'),
};

function solve(p: Params, locale: Locale): Solution {
  const q = platesInput(p);
  if (!isValid(q)) return { answers: [], steps: [] };
  const n = (v: number) => texNum(locale, v);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const E = field(q);
  const VM = potential(q, q.M.y);
  const VN = potential(q, q.N.y);
  const A = work(q, q.M, q.N);
  const answers: Answer[] = [
    {
      id: 'E',
      label: L('Cường độ điện trường giữa hai bản', 'Field strength between the plates'),
      value: E,
      unit: 'V/m',
    },
    {
      id: 'VM',
      label: L('Điện thế tại M', 'Potential at M'),
      value: VM,
      unit: 'V',
      check: integratedPotential(q, q.M.y),
    },
    {
      id: 'VN',
      label: L('Điện thế tại N', 'Potential at N'),
      value: VN,
      unit: 'V',
      check: integratedPotential(q, q.N.y),
    },
    {
      id: 'UMN',
      label: L('Hiệu điện thế giữa M và N', 'Voltage between M and N'),
      value: VM - VN,
      unit: 'V',
    },
    {
      id: 'WM',
      label: L('Thế năng điện tại M', 'Potential energy at M'),
      value: energy(q, q.M.y),
      unit: energyUnit(q),
    },
    {
      id: 'A',
      label: L('Công của lực điện từ M đến N', 'Work of the electric force from M to N'),
      value: A,
      unit: energyUnit(q),
      check: integratedWork(q),
    },
  ];
  const steps = [
    {
      text: L(
        'Điện trường giữa hai bản là điện trường đều:',
        'The field between the plates is uniform:',
      ),
      tex: `E = \\frac{U}{d} = \\frac{${n(q.U)}}{${n(q.d)}} = ${Q(E, 'V/m')}`,
    },
    {
      text: L(
        'Chọn bản âm làm mốc điện thế; điện thế tại một điểm cách bản âm h là V = Eh:',
        'Take the negative plate as the zero of potential; a point h above it has V = Eh:',
      ),
      tex: `V_M = E h_M = ${n(E)}\\cdot ${n(q.M.y)} = ${Q(VM, 'V')},\\quad V_N = ${Q(VN, 'V')}`,
    },
    {
      text: L('Hiệu điện thế giữa M và N:', 'The voltage between M and N:'),
      tex: `U_{MN} = V_M - V_N = ${Q(VM - VN, 'V')}`,
    },
    {
      text: L(
        'Công của lực điện chỉ phụ thuộc điểm đầu và điểm cuối, không phụ thuộc đường đi:',
        'The work of the electric force depends only on the start and the end, not on the path:',
      ),
      tex: `A_{MN} = qU_{MN} = ${n(q.q)}\\cdot ${n(VM - VN)} = ${Q(A, energyUnit(q))} = W_M - W_N`,
    },
  ];
  const sign: LocalizedText =
    A > 0
      ? L(
          `A > 0: lực điện sinh công dương khi ${KIND_NAME[q.kind]?.vi ?? ''} đi từ M đến N, thế năng điện giảm.`,
          `A > 0: the electric force does positive work as ${KIND_NAME[q.kind]?.en ?? ''} goes from M to N; its potential energy falls.`,
        )
      : A < 0
        ? L(
            `A < 0: lực điện cản trở ${KIND_NAME[q.kind]?.vi ?? ''} đi từ M đến N, thế năng điện tăng.`,
            `A < 0: the electric force opposes ${KIND_NAME[q.kind]?.en ?? ''} going from M to N; its potential energy rises.`,
          )
        : L(
            'A = 0: M và N cùng điện thế, lực điện không sinh công.',
            'A = 0: M and N have the same potential; the electric force does no work.',
          );
  const notes = [
    sign,
    L(
      'Chọn đường "Gấp khúc M → P → N": công vẫn bằng như trên (Hình 19.1).',
      'Choose the broken path M → P → N: the work is the same (Figure 19.1).',
    ),
  ];
  return { answers, steps, notes };
}

function validate(p: Params): LocalizedText[] {
  const q = platesInput(p);
  if (!(q.d > 0))
    return [
      L('Khoảng cách giữa hai bản phải lớn hơn 0.', 'The plate separation must be greater than 0.'),
    ];
  if (!isValid(q))
    return [
      L(
        'M và N phải nằm giữa hai bản: khoảng cách tới bản âm từ 0 đến d.',
        'M and N must lie between the plates: their distance to the negative plate is from 0 to d.',
      ),
    ];
  return [];
}

function card(): ScienceCardData {
  return {
    title: L('Thế năng điện. Điện thế', 'Electric potential energy. Potential'),
    model: L(
      'Điện tích q nằm trong điện trường đều giữa hai bản phẳng song song nhiễm điện trái dấu, hiệu điện thế U, cách nhau d. Bản âm được chọn làm mốc thế năng và mốc điện thế. Điện tích được dời từ M đến N theo đoạn thẳng hoặc theo đường gấp khúc M → P → N.',
      'A charge q in the uniform field between two oppositely charged parallel plates at voltage U, a distance d apart. The negative plate is the zero of potential energy and of potential. The charge is moved from M to N along a straight line or along the broken path M → P → N.',
    ),
    equations: [
      {
        tex: 'A_{MN} = qEd_{MN}',
        label: L('Công của lực điện (19.1)', 'Work of the electric force (19.1)'),
      },
      {
        tex: 'W_M = qEd',
        label: L(
          'Thế năng trong điện trường đều (19.2)',
          'Potential energy in a uniform field (19.2)',
        ),
      },
      {
        tex: 'V = \\frac{A}{q},\\quad W_M = V_M q',
        label: L('Điện thế (20.1), (20.4)', 'Potential (20.1), (20.4)'),
      },
      {
        tex: 'U_{MN} = V_M - V_N,\\quad A_{MN} = qU_{MN}',
        label: L('Hiệu điện thế (20.2), (20.3)', 'Voltage (20.2), (20.3)'),
      },
      { tex: 'E = \\frac{U_{MN}}{d_{MN}}', label: L('Liên hệ E và U (20.5)', 'E and U (20.5)') },
    ],
    assumptions: [
      L(
        'Điện trường đều giữa hai bản (bỏ qua mép bản); điện tích q không làm đổi điện trường.',
        'A uniform field between the plates (edges ignored); the charge q does not change the field.',
      ),
      L(
        'Điện tích được dời chậm từ M đến N trong 4 s chỉ để minh họa; công của lực điện không phụ thuộc cách dời. Không xét trọng lực.',
        'The charge is carried slowly from M to N over 4 s only as an illustration; the work of the electric force does not depend on how. Gravity is left out.',
      ),
      L(
        'Mặc định theo bài tập ví dụ tr. 81: U = 36 V, M ở chính giữa khe hở (V_M = 18 V). Sách không cho khoảng cách d; 4 cm là số minh họa.',
        'Defaults from the worked example on p. 81: U = 36 V, M in the middle of the gap (V_M = 18 V). The book gives no separation d; 4 cm is illustrative.',
      ),
      L(
        'Điện tích của electron và proton: ±e theo CODATA 2022 (SGK làm tròn 1,6·10⁻¹⁹ C).',
        'The charge of the electron and the proton: ±e from CODATA 2022 (the textbook rounds it to 1.6·10⁻¹⁹ C).',
      ),
    ],
    validity: L(
      'Điện trường đều, điểm nằm giữa hai bản, điện tích điểm.',
      'A uniform field, points between the plates, a point charge.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Công thức đúng của điện trường đều. Kiểm chứng độc lập bằng DOPRI5: điện thế tích phân E dọc đường sức; công tích phân lực điện dọc từng đoạn của đường đi đã chọn.',
      'Exact for a uniform field. Independent DOPRI5 checks: the potential integrates E up a field line; the work integrates the electric force along each piece of the chosen path.',
    ),
    method: L(
      'Ở mỗi bước (Δt = 1/60 s) V, W, A tính đúng tại chỗ điện tích; không tích lũy sai số.',
      'At each step (Δt = 1/60 s) V, W, A are evaluated exactly where the charge is; no error builds up.',
    ),
    userIntervened: false,
    sources: [sgkVl11(19), sgkVl11(20), SRC.hallidayElectric, SRC.codata, SRC.hairer],
  };
}

const num = (
  key: string,
  label: LocalizedText,
  symbol: string,
  dim: ParamDef['dim'],
  unit: string,
  range: readonly [number, number, number],
  when?: (p: Params) => boolean,
): ParamDef => ({
  key,
  label,
  symbol,
  kind: 'number',
  ...(dim ? { dim } : {}),
  unit,
  min: range[0],
  max: range[1],
  step: range[2],
  ...(when ? { when } : {}),
});

export const electricPotential: PhysicsScene = {
  id: 'electricPotential',
  engineId: 'phys.electricPotential',
  view3d: lazy(() => import('./Potential3DView')),
  title: L('Thế năng điện. Điện thế', 'Electric potential energy. Potential'),
  required: ['U', 'd'],
  params: [
    num(
      'U',
      L('Hiệu điện thế giữa hai bản', 'Voltage between the plates'),
      'U',
      DIM.voltage,
      'V',
      [0, 500, 1],
    ),
    num(
      'd',
      L('Khoảng cách giữa hai bản', 'Plate separation'),
      'd',
      DIM.length,
      'cm',
      [0.5, 20, 0.1],
    ),
    num(
      'hM',
      L('Khoảng cách từ M tới bản âm', 'Distance from M to the negative plate'),
      'h_M',
      DIM.length,
      'cm',
      [0, 20, 0.1],
    ),
    num(
      'hN',
      L('Khoảng cách từ N tới bản âm', 'Distance from N to the negative plate'),
      'h_N',
      DIM.length,
      'cm',
      [0, 20, 0.1],
    ),
    {
      key: 'path',
      label: L('Đường đi', 'Path'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: PATH.straight, label: L('Đoạn thẳng MN', 'Straight line MN') },
        { value: PATH.broken, label: L('Gấp khúc M → P → N', 'Broken M → P → N') },
      ],
    },
    {
      key: 'kind',
      label: L('Điện tích dịch chuyển', 'The charge moved'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: CHARGE.test, label: L('Điện tích thử q', 'Test charge q') },
        { value: CHARGE.electron, label: L('Electron', 'Electron') },
        { value: CHARGE.proton, label: L('Proton', 'Proton') },
      ],
    },
    num(
      'q',
      L('Điện tích thử', 'Test charge'),
      'q',
      DIM.charge,
      'nC',
      [-10, 10, 0.1],
      (p) => Math.round(p.kind ?? 0) === CHARGE.test,
    ),
    num(
      'dx',
      L('Độ lệch ngang từ M đến N', 'Sideways offset from M to N'),
      'x_N',
      DIM.length,
      'cm',
      [0, DX_MAX * 100, 0.1],
    ),
  ],
  defaults: { ...PLATE_DEFAULTS },
  usesGravity: false,
  validate,
  scienceCard: card,
  solve,
  graphs,
  bodies: [charge, pointM, pointN],
  view,
  draw,
};
