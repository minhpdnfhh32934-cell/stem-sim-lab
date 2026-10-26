import type { Locale } from '@/app/i18n/types';
import { C } from '@/core/constants';
import type { LocalizedText } from '@/core/data/dataset';
import { DIM } from '@/core/units';
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common/scene-helpers';
import { SRC } from '../common/sources';
import { fmtQty, texQty } from '../common/tex';
import type {
  Answer,
  BodyDef,
  GraphDef,
  ParamDef,
  ParamSource,
  Params,
  PhysicsScene,
  Solution,
  SolutionStep,
} from '../types';
import { chargeRadius, drawField, fieldView, linesFor } from './draw';
import { FE } from './engine';
import { MODE, fieldAt, fieldSetup, forceOn, plateField, potentialAt } from './model';

const SUB = ['₁', '₂', '₃'];
const points = (p: Params) => (p.mode ?? MODE.points) === MODE.points;
const plates = (p: Params) => !points(p);
const count = (p: Params) => Math.min(3, Math.max(1, Math.round(p.n ?? 2)));

function validate(p: Params): LocalizedText[] {
  const errors: LocalizedText[] = [];
  const s = fieldSetup(p);
  if (!(s.k > 0)) errors.push(L('Hằng số k phải lớn hơn 0.', 'k must be greater than 0.'));
  if (plates(p)) {
    if (!(s.plates.d > 0)) {
      errors.push(
        L(
          'Khoảng cách hai bản d phải lớn hơn 0.',
          'The plate separation d must be greater than 0.',
        ),
      );
    }
    return errors;
  }
  const r0 = chargeRadius(p);
  s.charges.forEach((a, i) => {
    s.charges.slice(i + 1).forEach((b, j) => {
      if (Math.hypot(a.x - b.x, a.y - b.y) < r0) {
        const cm = fmtQty('vi', r0, 'cm', 2);
        const cmEn = fmtQty('en', r0, 'cm', 2);
        errors.push(
          L(
            `Hai điện tích q${SUB[i]} và q${SUB[i + j + 1]} phải cách nhau ít nhất ${cm}.`,
            `Charges q${SUB[i]} and q${SUB[i + j + 1]} must be at least ${cmEn} apart.`,
          ),
        );
      }
    });
    if (Math.hypot(a.x - s.probe.x, a.y - s.probe.y) < 1e-9) {
      errors.push(
        L(
          `Điểm M trùng với điện tích q${SUB[i]}: điện trường ở đó không xác định.`,
          `Point M is on charge q${SUB[i]}: the field is undefined there.`,
        ),
      );
    }
  });
  return errors;
}

const probe: BodyDef = {
  id: 'probe',
  label: L('Điểm M', 'Point M'),
  position: (_s, p) => (points(p) ? fieldSetup(p).probe : { x: 0, y: 0 }),
  radius: (p) => chargeRadius(p),
  draggable: false,
  properties: (s, p) => [
    { label: L('Eₓ', 'Eₓ'), symbol: 'E_x', value: s[FE.ex] ?? 0, unit: 'V/m' },
    { label: L('E_y', 'E_y'), symbol: 'E_y', value: s[FE.ey] ?? 0, unit: 'V/m' },
    {
      label: L('Cường độ điện trường', 'Field strength'),
      symbol: 'E',
      value: s[FE.e] ?? 0,
      unit: 'V/m',
    },
    {
      label: L('Lực điện lên q₀', 'Electric force on q₀'),
      symbol: 'F',
      value: Math.abs(fieldSetup(p).q0) * (s[FE.e] ?? 0),
      unit: 'N',
    },
  ],
};

const graphs: GraphDef[] = [
  {
    id: 'field',
    title: L(
      'Điện trường tại M (không đổi theo thời gian: điện trường tĩnh)',
      'Field at M (constant in time: electrostatics)',
    ),
    yLabel: L('E (V/m)', 'E (V/m)'),
    series: [
      { id: 'e', label: L('E', 'E'), value: (s) => s[FE.e] ?? 0 },
      { id: 'ex', label: L('Eₓ', 'Eₓ'), value: (s) => s[FE.ex] ?? 0 },
      { id: 'ey', label: L('E_y', 'E_y'), value: (s) => s[FE.ey] ?? 0 },
    ],
  },
];

/** |−∇V| at M by central differences of V = Σkqᵢ/rᵢ: an independent check of Coulomb's E. */
function gradientCheck(p: Params): number {
  const s = fieldSetup(p);
  const { x, y } = s.probe;
  const near = Math.min(...s.charges.map((c) => Math.hypot(x - c.x, y - c.y)));
  const h = 1e-5 * near;
  const V = (a: number, b: number) => potentialAt(s.charges, s.k, a, b);
  return Math.hypot((V(x + h, y) - V(x - h, y)) / (2 * h), (V(x, y + h) - V(x, y - h)) / (2 * h));
}

function solvePlates(p: Params, locale: Locale): Solution {
  const s = fieldSetup(p);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const e = Math.abs(plateField(s.plates, 0, 0)[1]);
  const f = Math.abs(s.q0) * e;
  const steps: SolutionStep[] = [
    {
      text: L(
        'Giữa hai bản phẳng là điện trường đều, hướng từ bản dương sang bản âm:',
        'Between the plates the field is uniform, pointing from the + plate to the − plate:',
      ),
      tex: `E = \\frac{U}{d} = \\frac{${Q(Math.abs(s.plates.U), 'V')}}{${Q(s.plates.d, 'm')}} = ${Q(e, 'V/m')}`,
    },
    {
      text: L(
        s.q0 >= 0
          ? 'Lực điện lên điện tích thử q₀ (q₀ > 0: cùng chiều E):'
          : 'Lực điện lên điện tích thử q₀ (q₀ < 0: ngược chiều E):',
        s.q0 >= 0
          ? 'Electric force on the test charge q₀ (q₀ > 0: along E):'
          : 'Electric force on the test charge q₀ (q₀ < 0: against E):',
      ),
      tex: `F = |q_0|\\,E = ${Q(Math.abs(s.q0), 'C')} \\cdot ${Q(e, 'V/m')} = ${Q(f, 'N')}`,
    },
  ];
  return {
    answers: [
      { id: 'E', label: L('Cường độ điện trường E', 'Field strength E'), value: e, unit: 'V/m' },
      { id: 'F', label: L('Lực điện lên q₀', 'Electric force on q₀'), value: f, unit: 'N' },
    ],
    steps,
  };
}

function solve(p: Params, locale: Locale): Solution {
  if (plates(p)) return solvePlates(p, locale);
  const s = fieldSetup(p);
  const Q = (v: number, u: string) => texQty(locale, v, u);
  const k = Q(s.k, 'N*m^2/C^2');
  const steps: SolutionStep[] = s.charges.map((c, i) => {
    const n = i + 1;
    const r = Math.hypot(s.probe.x - c.x, s.probe.y - c.y);
    const e = (s.k * Math.abs(c.q)) / (r * r);
    const sub = SUB[i] ?? '';
    return {
      text: L(
        c.q >= 0
          ? `Điện trường do q${sub} gây ra tại M (q${sub} > 0: hướng ra xa q${sub}):`
          : `Điện trường do q${sub} gây ra tại M (q${sub} < 0: hướng về phía q${sub}):`,
        c.q >= 0
          ? `Field of q${sub} at M (q${sub} > 0: pointing away from q${sub}):`
          : `Field of q${sub} at M (q${sub} < 0: pointing towards q${sub}):`,
      ),
      tex: `r_${n} = \\sqrt{(x_M - x_${n})^2 + (y_M - y_${n})^2} = ${Q(r, 'm')},\\quad E_${n} = k\\frac{|q_${n}|}{r_${n}^2} = ${k} \\cdot \\frac{${Q(Math.abs(c.q), 'C')}}{(${Q(r, 'm')})^2} = ${Q(e, 'V/m')}`,
    };
  });
  const [ex, ey] = fieldAt(s.charges, s.k, s.probe.x, s.probe.y);
  const e = Math.hypot(ex, ey);
  const f = Math.hypot(...forceOn(s.q0, [ex, ey]));
  if (s.charges.length > 1) {
    steps.push({
      text: L(
        'Nguyên lí chồng chất: cộng các vectơ điện trường theo từng trục.',
        'Superposition: add the field vectors axis by axis.',
      ),
      tex: `E_x = \\sum_i E_{i,x} = ${Q(ex, 'V/m')},\\quad E_y = \\sum_i E_{i,y} = ${Q(ey, 'V/m')}`,
    });
  }
  steps.push(
    {
      text: L('Cường độ điện trường tại M:', 'Field strength at M:'),
      tex: `E = \\sqrt{E_x^2 + E_y^2} = ${Q(e, 'V/m')}`,
    },
    {
      text: L(
        s.q0 >= 0
          ? 'Lực điện lên điện tích thử q₀ đặt tại M (q₀ > 0: cùng chiều E):'
          : 'Lực điện lên điện tích thử q₀ đặt tại M (q₀ < 0: ngược chiều E):',
        s.q0 >= 0
          ? 'Electric force on a test charge q₀ at M (q₀ > 0: along E):'
          : 'Electric force on a test charge q₀ at M (q₀ < 0: against E):',
      ),
      tex: `F = |q_0|\\,E = ${Q(Math.abs(s.q0), 'C')} \\cdot ${Q(e, 'V/m')} = ${Q(f, 'N')}`,
    },
  );
  const answers: Answer[] = [
    {
      id: 'E',
      label: L('Cường độ điện trường tại M', 'Field strength at M'),
      value: e,
      unit: 'V/m',
      check: gradientCheck(p),
    },
    { id: 'Ex', label: L('Thành phần Eₓ', 'Component Eₓ'), value: ex, unit: 'V/m' },
    { id: 'Ey', label: L('Thành phần E_y', 'Component E_y'), value: ey, unit: 'V/m' },
    {
      id: 'F',
      label: L('Lực điện lên q₀ tại M', 'Electric force on q₀ at M'),
      value: f,
      unit: 'N',
    },
  ];
  const [a, b] = s.charges;
  if (a && b) {
    const r = Math.hypot(a.x - b.x, a.y - b.y);
    const f12 = (s.k * Math.abs(a.q * b.q)) / (r * r);
    const attract = a.q * b.q < 0;
    steps.push({
      text: L(
        `Lực tương tác giữa q₁ và q₂ (định luật Coulomb; ${attract ? 'trái dấu: hút nhau' : 'cùng dấu: đẩy nhau'}):`,
        `Force between q₁ and q₂ (Coulomb's law; ${attract ? 'opposite signs: attract' : 'same sign: repel'}):`,
      ),
      tex: `F_{12} = k\\frac{|q_1 q_2|}{r_{12}^2} = ${k} \\cdot \\frac{${Q(Math.abs(a.q), 'C')} \\cdot ${Q(Math.abs(b.q), 'C')}}{(${Q(r, 'm')})^2} = ${Q(f12, 'N')}`,
    });
    answers.push({
      id: 'F12',
      label: L('Lực tương tác giữa q₁ và q₂', 'Force between q₁ and q₂'),
      value: f12,
      unit: 'N',
    });
  }
  return { answers, steps };
}

function card(p: Params): ScienceCardData {
  const lines = plates(p) ? null : linesFor(p);
  const errVi = lines ? fmtQty('vi', lines.maxError, 'mm', 2) : '';
  const errEn = lines ? fmtQty('en', lines.maxError, 'mm', 2) : '';
  return {
    title: L('Điện trường của điện tích điểm', 'Electric field of point charges'),
    model: L(
      'Điện tích điểm đứng yên trong chân không hoặc không khí; điện trường của nhiều điện tích là tổng vectơ (nguyên lí chồng chất). Tụ điện phẳng lí tưởng: điện trường đều giữa hai bản.',
      'Point charges at rest in vacuum or air; the field of several charges is the vector sum (superposition). Ideal parallel-plate capacitor: a uniform field between the plates.',
    ),
    equations: [
      {
        tex: 'F = k\\frac{|q_1 q_2|}{r^2},\\quad k = \\frac{1}{4\\pi\\varepsilon_0}',
        label: L('Định luật Coulomb', "Coulomb's law"),
      },
      {
        tex: 'E_i = k\\frac{|q_i|}{r_i^2},\\quad \\vec E = \\sum_i \\vec E_i,\\quad \\vec F = q_0\\vec E',
        label: L(
          'Điện trường của điện tích điểm, chồng chất, lực lên điện tích thử',
          'Field of a point charge, superposition, force on a test charge',
        ),
      },
      {
        tex: 'E = \\frac{U}{d}',
        label: L('Điện trường đều giữa hai bản phẳng', 'Uniform field between parallel plates'),
      },
      {
        tex: '\\frac{d\\vec r}{ds} = \\pm\\frac{\\vec E}{|\\vec E|}',
        label: L(
          'Đường sức: luôn tiếp tuyến với E (s là độ dài dọc đường)',
          'Field line: always tangent to E (s is the length along the line)',
        ),
      },
    ],
    assumptions: [
      L(
        'Chân không hoặc không khí (ε = 1). Đề có hằng số điện môi ε khác 1 thì ngoài phạm vi.',
        'Vacuum or air (ε = 1). A problem with a dielectric constant ε ≠ 1 is outside the model.',
      ),
      L(
        `k mặc định = 1/(4πε₀) ≈ ${fmtQty('vi', C.kC, 'N*m^2/C^2')} (CODATA); đề ghi “lấy k = 9.10⁹” thì dùng số của đề (hai giá trị lệch 0,14 %).`,
        `Default k = 1/(4πε₀) ≈ ${fmtQty('en', C.kC, 'N*m^2/C^2')} (CODATA); a problem saying “take k = 9·10⁹” uses its own value (the two differ by 0.14 %).`,
      ),
      L(
        'Mật độ đường sức trên hình phẳng không tỉ lệ với |E|: đây là một lát cắt của trường ba chiều. Số đường mỗi điện tích tỉ lệ với |q|.',
        'The density of lines in the flat picture is not proportional to |E|: it is a slice of a 3D field. Each charge has a number of lines proportional to |q|.',
      ),
      L(
        'Tụ phẳng lí tưởng: E đều giữa hai bản, bằng 0 bên ngoài; bỏ qua hiệu ứng mép (độ dài bản trên hình chỉ để minh họa).',
        'Ideal capacitor: E uniform between the plates and 0 outside; edge effects are ignored (the drawn plate length is only illustrative).',
      ),
      L(
        'Không kéo được gì: điện tích và điểm M chỉnh bằng thanh trượt.',
        'Nothing can be dragged: charges and point M move with their sliders.',
      ),
    ],
    validity: L(
      'Điện tích đứng yên (tĩnh điện), kích thước rất nhỏ so với khoảng cách tới M. Điểm M không được trùng điện tích.',
      'Charges at rest (electrostatics), tiny compared with their distance to M. Point M must not sit on a charge.',
    ),
    confidence: 'exact',
    confidenceNote: lines
      ? L(
          `Các con số (E, F) tính bằng công thức chính xác; E được kiểm chéo bằng −∇V (sai phân trung tâm của V = Σkqᵢ/rᵢ). Đường sức vẽ bằng tích phân số RK4: sai số lớn nhất ≈ ${errVi} (ước lượng trên, giống nhau ở mọi mức máy).`,
          `The numbers (E, F) come from exact formulas; E is cross-checked with −∇V (central differences of V = Σkqᵢ/rᵢ). Field lines are drawn by RK4 numerical integration: largest error ≈ ${errEn} (an upper estimate, the same on every device tier).`,
        )
      : L(
          'Các con số tính bằng công thức chính xác E = U/d, F = |q₀|E. Đường sức giữa hai bản là các đường thẳng song song.',
          'The numbers come from the exact formulas E = U/d, F = |q₀|E. Field lines between the plates are parallel straight lines.',
        ),
    method: L(
      'Đường sức: RK4 với chia đôi bước để kiểm sai số và tự chỉnh bước; tính một lần mỗi khi thông số đổi, không theo từng khung hình.',
      'Field lines: RK4 with step doubling to control the error and adapt the step; computed once per parameter change, not per frame.',
    ),
    userIntervened: false,
    sources: [SRC.sgk11kntt, SRC.hallidayElectric, SRC.codata, SRC.hairer],
  };
}

const charge = (i: 1 | 2 | 3): ParamDef => ({
  key: `q${i}`,
  label: L(`Điện tích q${SUB[i - 1]} (có dấu)`, `Charge q${SUB[i - 1]} (signed)`),
  symbol: `q_${i}`,
  kind: 'number',
  dim: DIM.charge,
  unit: 'uC',
  min: -10,
  max: 10,
  step: 0.001,
  when: (p) => points(p) && count(p) >= i,
});

const position = (key: string, label: LocalizedText, symbol: string, i?: 1 | 2 | 3): ParamDef => ({
  key,
  label,
  symbol,
  kind: 'number',
  dim: DIM.length,
  unit: 'cm',
  min: -50,
  max: 50,
  step: 0.1,
  when: (p) => points(p) && (i === undefined || count(p) >= i),
});

const stated = (s: ParamSource | undefined) => s === 'problem' || s === 'user';

export const electricField: PhysicsScene = {
  id: 'electricField',
  engineId: 'phys.field',
  title: L('Điện trường của điện tích điểm', 'Electric field of point charges'),
  // `when` keeps only the ones the chosen mode and number of charges use. q₁ sits at the origin
  // and q₂ on the x-axis (any two points can be placed so); q₃ and M need both coordinates,
  // except that M on the line q₁q₂ has y_M = 0 (the default).
  required: ['U', 'd', 'q1', 'q2', 'x2', 'q3', 'x3', 'y3', 'xP'],
  usesGravity: false,
  params: [
    {
      key: 'mode',
      label: L('Mô hình', 'Model'),
      symbol: '',
      kind: 'choice',
      choices: [
        { value: MODE.points, label: L('Điện tích điểm', 'Point charges') },
        { value: MODE.plates, label: L('Tụ điện phẳng', 'Parallel-plate capacitor') },
      ],
    },
    {
      key: 'U',
      label: L('Hiệu điện thế giữa hai bản', 'Voltage between the plates'),
      symbol: 'U',
      kind: 'number',
      dim: DIM.voltage,
      unit: 'V',
      min: 1,
      max: 1000,
      step: 1,
      when: plates,
    },
    {
      key: 'd',
      label: L('Khoảng cách hai bản', 'Plate separation'),
      symbol: 'd',
      kind: 'number',
      dim: DIM.length,
      unit: 'cm',
      min: 0.5,
      max: 10,
      step: 0.1,
      when: plates,
    },
    {
      key: 'n',
      label: L('Số điện tích', 'Number of charges'),
      symbol: 'n',
      kind: 'choice',
      choices: [
        { value: 1, label: L('1 điện tích', '1 charge') },
        { value: 2, label: L('2 điện tích', '2 charges') },
        { value: 3, label: L('3 điện tích', '3 charges') },
      ],
      when: points,
    },
    charge(1),
    charge(2),
    charge(3),
    position('xP', L('Điểm M: hoành độ', 'Point M: x'), 'x_M'),
    position('yP', L('Điểm M: tung độ', 'Point M: y'), 'y_M'),
    position('x1', L('Vị trí q₁: hoành độ', 'q₁ position: x'), 'x_1', 1),
    position('y1', L('Vị trí q₁: tung độ', 'q₁ position: y'), 'y_1', 1),
    position('x2', L('Vị trí q₂: hoành độ', 'q₂ position: x'), 'x_2', 2),
    position('y2', L('Vị trí q₂: tung độ', 'q₂ position: y'), 'y_2', 2),
    position('x3', L('Vị trí q₃: hoành độ', 'q₃ position: x'), 'x_3', 3),
    position('y3', L('Vị trí q₃: tung độ', 'q₃ position: y'), 'y_3', 3),
    {
      key: 'q0',
      label: L('Điện tích thử q₀ (đặt tại M)', 'Test charge q₀ (placed at M)'),
      symbol: 'q_0',
      kind: 'number',
      dim: DIM.charge,
      unit: 'uC',
      min: -10,
      max: 10,
      step: 0.001,
    },
    {
      key: 'k',
      label: L('Hằng số Coulomb', 'Coulomb constant'),
      symbol: 'k',
      kind: 'number',
      dim: DIM.coulombConstant,
      unit: 'N*m^2/C^2',
      min: 8.9e9,
      max: 9.1e9,
      step: 1e6,
    },
  ],
  // q₁ = 4·10⁻⁸ C at A(0; 0), q₂ = −4·10⁻⁸ C at B(20 cm; 0), M the midpoint of AB:
  // E = 2·k·q/(0,1 m)² ≈ 7,19·10⁴ V/m towards B. Plates: U = 100 V, d = 2 cm → E = 5000 V/m.
  defaults: {
    mode: MODE.points,
    U: 100,
    d: 0.02,
    n: 2,
    q1: 4e-8,
    q2: -4e-8,
    q3: 4e-8,
    xP: 0.1,
    yP: 0,
    x1: 0,
    y1: 0,
    x2: 0.2,
    y2: 0,
    x3: 0.1,
    y3: 0.15,
    q0: 1e-8,
    k: C.kC,
  },
  // A problem that gives U or d is about plates; one that gives charges is about point charges,
  // with as many charges as the highest q it names. Only once the problem has given something:
  // moving a slider by hand never changes the mode or hides a charge.
  autoDefaults: (_p, sources) => {
    const out: Params = {};
    if (stated(sources.U) || stated(sources.d)) out.mode = MODE.plates;
    const given = [3, 2, 1].find((i) => stated(sources[`q${i}`]));
    const fromProblem = ['q1', 'q2', 'q3', 'xP', 'U', 'd'].some((k) => sources[k] === 'problem');
    if (given !== undefined && fromProblem) {
      out.n = given;
      out.mode ??= MODE.points;
    }
    return out;
  },
  validate,
  scienceCard: card,
  solve,
  graphs,
  bodies: [probe],
  view: fieldView,
  draw: drawField,
};
