// Test fixture (imported only by *.test.ts files): a `physical-lab` station that exists in no
// content file — a dilution done by hand on the Physics Lab's bench (top 0.9 m, x −1…1, z −2.4…
// −1.6), with the shipped `chemistry.dilution` model. Its definition takes the dilution draft's
// parameters, inputs and steps (docs/physical-lab-architecture.md §3.1), cut down to one stock, one
// pipette and one flask placed. Everything here is for tests: the bookkeeping volumes (`fill`, the
// cuvette's and bottles' capacities), pour rates and capture radii are AFFORDANCE values chosen so
// the tests run, never data the shipped content may copy as science.
import type { RawContent } from './content';

const vi = <T extends object>(texts: T) => ({ vi: texts });

const presets = (unit: string, values: number[]) =>
  values.map((value) => ({ label: `${value} ${unit}`, value }));

const step = (
  id: string,
  place: string,
  onto: string,
  extra: object,
  text: { en: [string, string]; vi: [string, string] },
) => ({
  id,
  instruction: text.en[0],
  refusal: text.en[1],
  ...vi({ instruction: text.vi[0], refusal: text.vi[1] }),
  place,
  onto,
  ...extra,
});

/** The dilution draft's definition as a `physical-lab` experiment (fixture id `fixture-dilution`). */
export const DILUTION_FIXTURE = {
  id: 'fixture-dilution',
  name: 'Dilution (fixture)',
  ...vi({ name: 'Pha loãng (thử)' }),
  category: 'chemistry',
  model: 'chemistry.dilution',
  presentation: 'physical-lab',
  parameters: [
    {
      id: 'stockConcentration',
      label: 'Stock concentration',
      ...vi({ label: 'Nồng độ dung dịch gốc' }),
      symbol: 'C₁',
      unit: 'mol/L',
      default: 2e-5,
      min: 5e-6,
      max: 4e-5,
      presets: presets('mol/L', [5e-6, 1e-5, 2e-5, 4e-5]),
    },
    {
      id: 'stockVolume',
      label: 'Stock volume',
      ...vi({ label: 'Thể tích dung dịch gốc' }),
      symbol: 'V₁',
      unit: 'mL',
      default: 5,
      min: 1,
      max: 10,
      presets: presets('mL', [1, 2, 5, 10]),
    },
    {
      id: 'finalVolume',
      label: 'Final volume',
      ...vi({ label: 'Thể tích cuối' }),
      symbol: 'V₂',
      unit: 'mL',
      default: 50,
      min: 25,
      max: 250,
      presets: presets('mL', [25, 50, 100, 250]),
    },
    {
      id: 'concentrationResolution',
      label: 'Colorimeter resolution',
      ...vi({ label: 'Độ phân giải máy so màu' }),
      symbol: 'd',
      unit: 'mol/L',
      default: 1e-7,
      min: 1e-8,
      max: 1e-6,
      presets: presets('mol/L', [1e-8, 1e-7, 1e-6]),
    },
  ],
  initialConditions: { fillTime: 10, absorptivity: 1e7, pathLength: 0.01 },
  inputs: {
    fillTime: { symbol: 't_fill', unit: 's', desk: false },
    absorptivity: { symbol: 'ε', unit: 'L/(mol·m)', desk: false },
    pathLength: { symbol: 'l', unit: 'm', desk: false },
  },
  simulation: { timeStep: 0.02, maxDuration: 12, sampleInterval: 0.05 },
  measurements: [
    { id: 'volume', label: 'Volume', ...vi({ label: 'Thể tích' }), unit: 'mL', variable: 'volume' },
    {
      id: 'concentration',
      label: 'Concentration',
      ...vi({ label: 'Nồng độ' }),
      unit: 'mol/L',
      variable: 'concentration',
    },
  ],
  results: [
    {
      id: 'finalConcentration',
      label: 'Final concentration',
      ...vi({ label: 'Nồng độ cuối' }),
      symbol: 'C₂',
      unit: 'mol/L',
      variable: 'concentration',
      reduce: 'final',
      theory: 'finalConcentration',
    },
    {
      id: 'amount',
      label: 'Amount of dye',
      ...vi({ label: 'Lượng chất màu' }),
      symbol: 'n',
      unit: 'mol',
      variable: 'amount',
      reduce: 'final',
      theory: 'amount',
    },
  ],
  instruments: [
    {
      result: 'finalConcentration',
      quantity: 'Concentration C₂',
      name: 'Colorimeter',
      resolution: 'concentrationResolution',
      excludes: 'the calibration',
      ...vi({ quantity: 'Nồng độ C₂', name: 'Máy so màu', excludes: 'việc hiệu chuẩn' }),
    },
  ],
  workspace: {
    pieces: [
      ['stock-bottle', ['stockConcentration'], 'Stock bottle', 'Chai dung dịch gốc'],
      ['pipette', ['stockVolume'], 'Volumetric pipette', 'Pipet bầu'],
      ['flask', ['finalVolume'], 'Volumetric flask', 'Bình định mức'],
      ['wash-bottle', [], 'Wash bottle', 'Bình tia'],
      ['tile', [], 'White tile', 'Tấm sứ trắng'],
      ['colorimeter', ['concentrationResolution'], 'Colorimeter', 'Máy so màu'],
      ['cuvette', [], 'Cuvette', 'Cuvet'],
    ].map(([id, owns, label, labelVi], i) => ({
      id,
      kind: 'glassware',
      slot: `s${i}`,
      label,
      ...vi({ label: labelVi }),
      owns,
    })),
    materials: [
      ['stock-20', 'stock', 'Crystal violet 2.0e-5 mol/L', 'stockConcentration', 2e-5],
      ['pipette-5', 'pipette', '5 mL pipette', 'stockVolume', 5],
      ['flask-50', 'flask', '50 mL flask', 'finalVolume', 50],
      ['water', 'solvent', 'Distilled water', null, null],
    ].map(([id, kind, label, parameter, value]) => ({
      id,
      kind,
      label,
      ...vi({ label: `${String(label)} (vi)` }),
      ...(parameter === null ? {} : { sets: { parameter, value } }),
    })),
    setup: [
      step(
        'flask',
        'flask',
        'tile',
        { locks: ['finalVolume'] },
        {
          en: ['Stand the flask on the tile.', 'Stand the flask on the white tile first.'],
          vi: ['Đặt bình lên tấm sứ.', 'Hãy đặt bình lên tấm sứ trắng trước.'],
        },
      ),
      step(
        'aspirate',
        'stock-bottle',
        'pipette',
        { locks: ['stockConcentration', 'stockVolume'] },
        {
          en: ['Fill the pipette from the stock.', 'Fill the pipette from the stock first.'],
          vi: ['Hút dung dịch gốc vào pipet.', 'Hãy hút dung dịch gốc vào pipet trước.'],
        },
      ),
      step(
        'dispense',
        'pipette',
        'flask',
        { after: ['flask', 'aspirate'] },
        {
          en: ['Deliver the pipette into the flask.', 'Deliver the stock into the flask first.'],
          vi: ['Cho pipet vào bình.', 'Hãy cho dung dịch gốc vào bình trước.'],
        },
      ),
      step(
        'mix',
        'flask',
        'flask',
        { by: 'invert', phase: 'after-run' },
        {
          en: ['Stopper and invert the flask.', 'Stopper and invert the flask first.'],
          vi: ['Đậy nút và lật ngược bình.', 'Hãy đậy nút và lật ngược bình trước.'],
        },
      ),
      step(
        'cuvette',
        'flask',
        'cuvette',
        { after: ['mix'], phase: 'after-run' },
        {
          en: ['Pour a sample into the cuvette.', 'Pour a sample into the cuvette first.'],
          vi: ['Rót mẫu vào cuvet.', 'Hãy rót mẫu vào cuvet trước.'],
        },
      ),
    ],
    drive: { place: 'water', onto: 'flask' },
  },
};

const cylinder = (
  id: string,
  tags: string[],
  size: [number, number, number],
  container: object,
  handling = 'upright',
) => ({
  id,
  displayName: id,
  ...vi({ displayName: id }),
  category: 'equipment',
  tags,
  physical: { massKg: 0.1, body: 'dynamic', ccd: true, friction: 0.6, handling },
  interactions: ['grab', 'container'],
  container,
  visual: { shape: 'cylinder', size, color: '#ddeeff' },
});

/** AFFORDANCE (fixture): how far a spout may be off a mouth's centre and still pour in. */
export const CAPTURE = 0.02;

const ITEMS = [
  // 0.4 × 0.12 × 0.2 m: a 1 cm tile (top 0.91 m, seat "tile") beside a 12 cm colorimeter body whose
  // top holds the cuvette's mouth (a receiver-only container on a static item).
  {
    id: 'fx-colorimeter',
    displayName: 'Colorimeter',
    ...vi({ displayName: 'Máy so màu' }),
    category: 'equipment',
    physical: { massKg: 5 },
    interactions: ['bench', 'container'],
    bench: { model: 'dilution-colorimeter', top: [0.1, 0.12, 0] },
    colliders: [
      { center: [-0.1, -0.055, 0], size: [0.16, 0.01, 0.16] },
      { center: [0.1, 0, 0], size: [0.2, 0.12, 0.2] },
    ],
    seats: [{ id: 'tile', center: [-0.1, -0.05, 0], radius: 0.05, accepts: ['fx-flask'] }],
    container: {
      capacityMl: 3,
      mouth: { center: [0.1, 0.06, 0], radius: 0.006, captureRadius: CAPTURE },
    },
    visual: { shape: 'box', size: [0.4, 0.12, 0.2], color: '#ffffff' },
  },
  cylinder('fx-flask-50', ['fx-flask'], [0.06, 0.14, 0.06], {
    capacityMl: 60,
    fillLimitMl: 50,
    mouth: { center: [0, 0.07, 0], radius: 0.006, captureRadius: CAPTURE },
    pour: { spout: [0, 0.07, 0.006], trigger: 'tilt', rateMlPerS: 8 },
    closable: true,
  }),
  cylinder(
    'fx-pipette-5',
    ['fx-pipette'],
    [0.014, 0.16, 0.014],
    { capacityMl: 5, measured: { volumeMl: 5 } },
    'set-down',
  ),
  cylinder('fx-stock-bottle', ['fx-bottle'], [0.07, 0.14, 0.07], {
    capacityMl: 250,
    mouth: { center: [0, 0.07, 0], radius: 0.012, captureRadius: CAPTURE },
    closable: true,
  }),
  // The nozzle tip on its axis, so an upright bottle's spout is straight above its centre.
  cylinder('fx-wash-bottle', ['fx-wash-bottle'], [0.08, 0.2, 0.08], {
    capacityMl: 500,
    pour: { spout: [0, 0.1, 0], trigger: 'squeeze', rateMlPerS: 20 },
  }),
];

const station = (params: object) => ({ station: 'dl-colorimeter', ...params });

/** On the Physics Lab bench, right of the steel ball: the colorimeter and the glassware. */
const PLACEMENTS = [
  {
    id: 'dl-colorimeter',
    item: 'fx-colorimeter',
    position: [2.1, 0.9, 0.22], // its tile in the reach of a player at the bench (Phase H-2)
    params: { experimentId: 'fixture-dilution', piece: 'cuvette' },
  },
  {
    id: 'dl-flask',
    item: 'fx-flask-50',
    position: [1.65, 0.9, 0.15],
    params: station({ piece: 'flask', material: 'flask-50' }),
  },
  {
    id: 'dl-pipette',
    item: 'fx-pipette-5',
    position: [1.5, 0.9, 0.15],
    params: station({ piece: 'pipette', material: 'pipette-5' }),
  },
  {
    // AFFORDANCE: bookkeeping volume (fixture).
    id: 'dl-stock',
    item: 'fx-stock-bottle',
    position: [1.8, 0.9, 0.2], // in reach from the bench front (Phase H-2)
    params: station({ piece: 'stock-bottle', material: 'stock-20', fill: 125 }),
  },
  {
    // AFFORDANCE: bookkeeping volume (fixture).
    id: 'dl-wash',
    item: 'fx-wash-bottle',
    position: [1.35, 0.9, -0.25],
    params: station({ piece: 'wash-bottle', material: 'water', fill: 500 }),
  },
  {
    id: 'dl-reset',
    item: 'reset-button',
    position: [2.4, 0.9, 0.3],
    params: station({ command: 'reset', label: 'RESET' }),
    ...vi({ label: 'ĐẶT LẠI' }),
  },
  {
    id: 'dl-clear',
    item: 'reset-button',
    position: [2.45, 0.9, 0.15],
    params: station({ command: 'clear', label: 'Clear the bench' }),
    ...vi({ label: 'Dọn bàn' }),
  },
];

/**
 * `base` (the bundled content: tests pass it, the lab pack is loaded on demand) with the
 * physical-lab dilution station added, as a fresh copy.
 */
/**
 * The Physics Lab's bench the fixture stands on: the teacher's bench (moved by Phase U-2), the old lab
 * bench moved by this shift. `onBench` moves a point given on the old bench to it.
 */
export const BENCH_SHIFT = [-3.167, 0, -4.474] as const;
export const onBench = (p: readonly [number, number, number]): [number, number, number] => [
  p[0] + BENCH_SHIFT[0],
  p[1] + BENCH_SHIFT[1],
  p[2] + BENCH_SHIFT[2],
];

export function physicalLabFixture(base: RawContent): RawContent {
  const content = structuredClone(base);
  const raw = content as unknown as {
    items: object[];
    experiments: object[];
    topics: { id: string; experiments: string[] }[];
    rooms: { id: string; placements: object[] }[];
  };
  raw.items.push(...structuredClone(ITEMS));
  raw.experiments.push(structuredClone(DILUTION_FIXTURE));
  raw.topics.find((t) => t.id === 'acids-and-bases')?.experiments.push('fixture-dilution');
  const placed = structuredClone(PLACEMENTS).map((p) => ({
    ...p,
    position: onBench(p.position as [number, number, number]),
  }));
  raw.rooms.find((r) => r.id === 'physics-lab')?.placements.push(...placed);
  return content;
}
