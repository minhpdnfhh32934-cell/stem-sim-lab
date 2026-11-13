// Test fixture (imported only by *.test.ts files): a bench station that exists in no content
// file — Ohm's law on a board standing on the Physics Lab's bench, drawn by the reference bench
// model `demo-board` — and the test model it runs.
import { bundledContent } from '../content';
import type { SimulationModel } from '../simulation/SimulationModel';
import type { RawContent } from './content';

const V = 0;
const I = 1;
const LEVEL = 2;

/**
 * Ohm's law as a test model: the source ramps from 0 to `voltage` at `rampRate` (V/s) and stops
 * there; the current through `resistance` is I = V/R, and `level` the ramp's progress (0–1, what
 * the demo board's gauge shows). Its theory refuses a resistance that is not above 0 by throwing,
 * as a model refuses settings outside what it covers.
 */
export const ohmModel: SimulationModel = {
  id: 'fixture.ohm',
  inputs: ['resistance', 'voltage', 'rampRate'],
  variables: ['v', 'i', 'level'],
  predictions: ['current', 'rampTime'],
  init(_inputs, state) {
    state.fill(0);
  },
  step(state, dt, inputs) {
    const target = inputs.voltage ?? NaN;
    const rate = inputs.rampRate ?? NaN;
    const v = state[V] ?? 0;
    // The last step stops on the target and takes only the time it needs.
    const reached = v + rate * dt >= target;
    const next = reached ? target : v + rate * dt;
    state[V] = next;
    state[I] = next / (inputs.resistance ?? NaN);
    state[LEVEL] = next / target;
    return reached ? (target - v) / rate : dt;
  },
  isComplete: (state, inputs) => (state[V] ?? 0) >= (inputs.voltage ?? NaN),
  predict(inputs) {
    const r = inputs.resistance ?? NaN;
    if (!(r > 0)) throw new Error(`a resistance of ${r} Ω draws no finite current`);
    const v = inputs.voltage ?? NaN;
    return { current: v / r, rampTime: v / (inputs.rampRate ?? NaN) };
  },
};

const ITEMS = [
  {
    id: 'fixture-board',
    displayName: 'Circuit board',
    description: 'A resistor on a board, its source and its ammeter.',
    vi: { displayName: 'Bảng mạch', description: 'Một điện trở trên bảng, nguồn và ampe kế.' },
    category: 'equipment',
    tags: ['apparatus'],
    physical: { massKg: 2 },
    interactions: ['bench', 'inspect'],
    bench: { model: 'demo-board', top: [0, 0.03, 0] },
    visual: { shape: 'box', size: [0.4, 0.03, 0.3], color: '#2e6b4f', material: 'painted' },
  },
  {
    id: 'fixture-instructions',
    displayName: "Ohm's law — instructions",
    vi: { displayName: 'Định luật Ôm — hướng dẫn' },
    category: 'structure',
    physical: { massKg: 2, body: 'none' },
    interactions: ['inspect'],
    visual: { shape: 'box', size: [1.1, 0.75, 0.04], color: '#e8dcb5' },
  },
];

const EXPERIMENT = {
  id: 'fixture-ohm',
  name: "Ohm's law",
  vi: { name: 'Định luật Ôm' },
  category: 'physics',
  model: 'fixture.ohm',
  parameters: [
    {
      id: 'resistance',
      label: 'Resistance',
      vi: { label: 'Điện trở' },
      symbol: 'R',
      unit: 'Ω',
      default: 10,
      min: 0,
      max: 20,
      step: 10,
    },
    {
      id: 'voltage',
      label: 'Voltage',
      vi: { label: 'Hiệu điện thế' },
      symbol: 'U',
      unit: 'V',
      default: 2,
      min: 1,
      max: 4,
      step: 1,
    },
    {
      id: 'resolution',
      label: 'Ammeter resolution',
      vi: { label: 'Độ phân giải ampe kế' },
      symbol: 'd',
      unit: 'A',
      default: 0.01,
      min: 0.001,
      max: 0.1,
      presets: [
        { label: '0.001 A', value: 0.001 },
        { label: '0.01 A', value: 0.01 },
        { label: '0.1 A', value: 0.1 },
      ],
    },
  ],
  initialConditions: { rampRate: 2 },
  simulation: { timeStep: 0.01, maxDuration: 10, sampleInterval: 0.05 },
  measurements: [
    {
      id: 'u',
      label: 'Voltage',
      vi: { label: 'Hiệu điện thế' },
      symbol: 'U',
      unit: 'V',
      variable: 'v',
    },
    {
      id: 'i',
      label: 'Current',
      vi: { label: 'Cường độ dòng điện' },
      symbol: 'I',
      unit: 'A',
      variable: 'i',
    },
  ],
  results: [
    {
      id: 'ramp-time',
      label: 'Ramp time',
      vi: { label: 'Thời gian tăng áp' },
      symbol: 't',
      unit: 's',
      variable: 'time',
      reduce: 'final',
      theory: 'rampTime',
    },
    {
      id: 'current',
      label: 'Current',
      vi: { label: 'Cường độ dòng điện' },
      symbol: 'I',
      unit: 'A',
      variable: 'i',
      reduce: 'final',
      theory: 'current',
      classes: [
        { max: 0.15, label: 'Weak', vi: { label: 'Yếu' } },
        { label: 'Strong', vi: { label: 'Mạnh' } },
      ],
    },
  ],
  graphs: [
    {
      id: 'current-voltage',
      title: 'Current against voltage',
      vi: { title: 'Cường độ dòng điện theo hiệu điện thế' },
      x: 'u',
      y: ['i'],
    },
  ],
  instruments: [
    {
      result: 'current',
      quantity: 'Current I',
      name: 'Ammeter',
      resolution: 'resolution',
      excludes: "the meter's calibration",
      vi: {
        quantity: 'Cường độ dòng điện I',
        name: 'Ampe kế',
        excludes: 'sai số hiệu chuẩn của đồng hồ',
      },
    },
  ],
  procedure: [
    {
      id: 'read',
      instruction: 'Read the instructions.',
      vi: { instruction: 'Đọc hướng dẫn.' },
      done: { kind: 'inspected', item: 'fixture-instructions' },
    },
    {
      id: 'voltage',
      instruction: 'Set the voltage U.',
      vi: { instruction: 'Đặt hiệu điện thế U.' },
      done: { kind: 'adjusted', parameter: 'voltage' },
    },
    {
      id: 'run',
      instruction: 'Press RUN.',
      vi: { instruction: 'Nhấn CHẠY.' },
      done: { kind: 'completed' },
    },
    {
      id: 'results',
      instruction: 'Read the results.',
      vi: { instruction: 'Đọc kết quả.' },
      done: { kind: 'viewed' },
    },
    {
      id: 'reset',
      instruction: 'Press RESET.',
      vi: { instruction: 'Nhấn ĐẶT LẠI.' },
      done: { kind: 'reset' },
    },
  ],
};

const control = (id: string, item: string, x: number, params: object, vi?: object) => ({
  id,
  item,
  position: [x, 0.9, -1.7],
  params: { station: 'demo-board-station', ...params },
  ...(vi && { vi }),
});

/** In the Physics Lab: the board on its bench (top 0.9 m), the controls along the bench's front. */
const PLACEMENTS = [
  {
    id: 'demo-board-station',
    item: 'fixture-board',
    position: [0.5, 0.9, -2],
    params: { experimentId: 'fixture-ohm' },
  },
  { id: 'demo-instructions', item: 'fixture-instructions', position: [-0.5, 1.2, -3.97] },
  control('demo-dial-resistance', 'control-dial', 0.1, { parameter: 'resistance', label: 'R' }),
  control('demo-dial-voltage', 'control-dial', 0.2, { parameter: 'voltage', label: 'U' }),
  control('demo-run', 'run-button', 0.4, { command: 'run', label: 'RUN' }, { label: 'CHẠY' }),
  control('demo-stop', 'stop-button', 0.55, { command: 'stop', label: 'STOP' }, { label: 'DỪNG' }),
  control(
    'demo-reset',
    'reset-button',
    0.7,
    { command: 'reset', label: 'RESET' },
    { label: 'ĐẶT LẠI' },
  ),
  control('demo-monitor', 'results-monitor', 0.9, {}),
];

/** The bundled content with the bench station added (a fresh copy each call). */
export function benchFixture(): RawContent {
  const content = structuredClone(bundledContent);
  const raw = content as unknown as {
    items: object[];
    experiments: object[];
    topics: { id: string; experiments: string[] }[];
    rooms: { id: string; placements: object[] }[];
  };
  raw.items.push(...structuredClone(ITEMS));
  raw.experiments.push(structuredClone(EXPERIMENT));
  raw.topics.find((t) => t.id === 'dynamics')?.experiments.push('fixture-ohm');
  raw.rooms.find((r) => r.id === 'physics-lab')?.placements.push(...structuredClone(PLACEMENTS));
  return content;
}
