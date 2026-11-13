import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ENGLISH } from '../../../../core/i18n';
import type { BenchView, SetupProgress } from '../../../../gameplay/experiment/StationSystem';
import { ExperimentSession } from '../../../../simulation/ExperimentSession';
import { ExperimentDefinitionSchema, type WorkspacePiece } from '../../../../simulation/experiment';
import { geneticsModel, offspringGenotype } from '../../../../simulation/models/genetics';
import { enzymeModel } from '../../../../simulation/models/enzyme';
import { microscopeModel } from '../../../../simulation/models/microscope';
import { osmosisModel } from '../../../../simulation/models/osmosis';
import { photosynthesisModel } from '../../../../simulation/models/photosynthesis';
import { transpirationModel } from '../../../../simulation/models/transpiration';
import type { SimulationModel } from '../../../../simulation/SimulationModel';
import { CAPILLARY_ML, genotypeLetters, phenotypeClass } from '../../../labVisuals/biology';
import { clockText } from '../../../labVisuals/readouts';
import type { PieceContext } from '../types';
import { BIO_PIECES, pieces } from './bio-pieces';

// The Biology pieces, mounted into a minimal DOM stand-in and driven by real sessions of the real
// definitions and models (and fixtures for transpiration and genetics, whose definitions are not
// written yet): idle, mid-run, completed, reset.

// ---- a minimal DOM ----------------------------------------------------------------------------

type Listener = (event: unknown) => void;

class FakeText {
  parent: FakeEl | null = null;
  constructor(public data: string) {}
}

/** Counts every write a piece makes to the page (attributes, text, checked, style). */
const writes = { count: 0 };

class FakeEl {
  parent: FakeEl | null = null;
  kids: (FakeEl | FakeText)[] = [];
  attrs = new Map<string, string>();
  listeners = new Map<string, Set<Listener>>();
  dataset: Record<string, string> = {};
  title = '';
  type = '';
  name = '';
  value = '';
  width = 0;
  height = 0;
  private classes = '';
  private on = false;
  private context: unknown;
  style = new Proxy<Record<string, unknown>>(
    {},
    {
      set: (t, k: string, v) => ((t[k] = v), writes.count++, true),
      get: (t, k: string) =>
        k === 'setProperty' ? (name: string, v: string) => ((t[name] = v), writes.count++) : t[k],
    },
  );
  constructor(public tag: string) {}

  get className() {
    return this.classes;
  }
  set className(v: string) {
    this.classes = v;
  }
  get classList() {
    const list = { get: () => this.classes, set: (v: string) => (this.classes = v) };
    return {
      toggle(name: string, force?: boolean) {
        const set = new Set(list.get().split(' ').filter(Boolean));
        const want = force ?? !set.has(name);
        if (want) set.add(name);
        else set.delete(name);
        list.set([...set].join(' '));
        writes.count++;
        return want;
      },
      add(name: string) {
        list.set([...list.get().split(' ').filter(Boolean), name].join(' '));
      },
      contains: (name: string) => list.get().split(' ').includes(name),
    };
  }
  get checked() {
    return this.on;
  }
  set checked(v: boolean) {
    this.on = v;
    writes.count++;
  }
  get textContent(): string {
    return this.kids.map((k) => (k instanceof FakeText ? k.data : k.textContent)).join('');
  }
  set textContent(v: string) {
    this.kids = [];
    this.append(v);
    writes.count++;
  }
  get children() {
    return this.kids.filter((k): k is FakeEl => k instanceof FakeEl);
  }
  append(...items: (FakeEl | FakeText | string)[]) {
    for (const item of items) {
      const node = typeof item === 'string' ? new FakeText(item) : item;
      node.parent?.kids.splice(node.parent.kids.indexOf(node), 1);
      node.parent = this;
      this.kids.push(node);
    }
  }
  replaceChildren(...items: (FakeEl | FakeText | string)[]) {
    this.kids = [];
    this.append(...items);
    writes.count++;
  }
  remove() {
    this.parent?.kids.splice(this.parent.kids.indexOf(this), 1);
    this.parent = null;
  }
  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
    if (name === 'class') this.classes = value;
    writes.count++;
  }
  getAttribute(name: string) {
    return name === 'class' ? this.classes : (this.attrs.get(name) ?? null);
  }
  addEventListener(type: string, fn: Listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? new Set()).add(fn));
  }
  removeEventListener(type: string, fn: Listener) {
    this.listeners.get(type)?.delete(fn);
  }
  fire(type: string) {
    for (const fn of this.listeners.get(type) ?? []) fn({ type });
  }
  getContext() {
    if (this.tag !== 'canvas') return null;
    this.context ??= recorder();
    return this.context;
  }
}

/** A canvas context stand-in: remembers every call and the last value of every property. */
function recorder() {
  const props: Record<string, unknown> = {};
  const calls: string[] = [];
  const p = new Proxy(props, {
    get: (t, k: string) => (k in t ? t[k] : (...args: unknown[]) => (calls.push(k), args)),
    set: (t, k: string, v) => ((t[k] = v), true),
  });
  Object.defineProperty(props, 'calls', { value: calls });
  return p;
}

function walk(node: FakeEl, visit: (n: FakeEl) => void) {
  visit(node);
  for (const kid of node.children) walk(kid, visit);
}
const findAll = (root: FakeEl, test: (n: FakeEl) => boolean) => {
  const found: FakeEl[] = [];
  walk(root, (n) => test(n) && found.push(n));
  return found;
};
const byClass = (root: FakeEl, name: string) =>
  findAll(root, (n) => n.className.split(' ').includes(name));
const one = (root: FakeEl, name: string): FakeEl => {
  const found = byClass(root, name);
  if (found.length !== 1) throw new Error(`${found.length} of .${name}`);
  return found[0]!;
};
const listenerCount = (root: FakeEl) => {
  let n = 0;
  walk(root, (e) => e.listeners.forEach((s) => (n += s.size)));
  return n;
};

beforeAll(() => {
  vi.stubGlobal('document', {
    createElement: (tag: string) => new FakeEl(tag),
    createElementNS: (_ns: string, tag: string) => new FakeEl(tag),
  });
});
afterAll(() => vi.unstubAllGlobals());

// ---- stations ---------------------------------------------------------------------------------

const experiment = (id: string): object =>
  JSON.parse(readFileSync(`src/content/experiments/${id}.json`, 'utf8')) as object;

const presets = (values: number[], label = (v: number) => String(v)) =>
  values.map((v) => ({ label: label(v), value: v }));

const parameter = (id: string, label: string, unit: string, values: number[], def: number) => ({
  id,
  label,
  unit,
  default: def,
  min: Math.min(...values),
  max: Math.max(...values),
  presets: presets(values),
});

const GENOTYPES = [22, 21, 20, 12, 11, 10, 2, 1, 0];

const GENETICS = {
  id: 'genetics',
  name: 'Genetics',
  category: 'biology',
  model: 'biology.genetics',
  parameters: [
    {
      ...parameter('parent1', 'Parent 1', '', GENOTYPES, 11),
      presets: presets(GENOTYPES, genotypeLetters),
    },
    {
      ...parameter('parent2', 'Parent 2', '', GENOTYPES, 11),
      presets: presets(GENOTYPES, genotypeLetters),
    },
    parameter('offspring', 'Offspring', '', [16, 80, 556, 8023], 80),
    parameter('sample', 'Sample', '', [1, 2, 3, 4, 5, 6, 7, 8], 1),
  ],
  initialConditions: { countTime: 10 },
  simulation: { timeStep: 0.05, maxDuration: 11, sampleInterval: 0.5 },
  measurements: [{ id: 'counted', label: 'Seeds counted', unit: '', variable: 'counted' }],
};

const TRANSPIRATION = {
  id: 'transpiration',
  name: 'Transpiration',
  category: 'biology',
  model: 'biology.transpiration',
  parameters: [
    parameter('illuminance', 'Light', 'lux', [0, 1000, 5000, 20000], 5000),
    parameter('humidity', 'Humidity', '%', [30, 50, 70, 90], 50),
    parameter('airSpeed', 'Air speed', 'm/s', [0.1, 0.5, 1, 3], 1),
    parameter('scaleResolution', 'Scale resolution', 'm', [0.0005, 0.001, 0.005], 0.001),
  ],
  initialConditions: {
    temperature: 20,
    leafArea: 0.0005,
    leafWidth: 0.04,
    boreDiameter: 0.001,
    scaleLength: 0.1,
    duration: 600,
    timeLapse: 100,
  },
  inputs: { scaleLength: { symbol: 'L', unit: 'm' }, temperature: { symbol: 'θ', unit: '°C' } },
  simulation: { timeStep: 0.05, maxDuration: 8, sampleInterval: 0.5 },
  measurements: [
    { id: 'distance', label: 'Bubble distance', unit: 'm', variable: 'distance' },
    {
      id: 'conductance',
      label: 'Stomatal conductance',
      unit: 'mol/(m²·s)',
      variable: 'stomatalConductance',
    },
  ],
  results: [
    { id: 'distance', label: 'Bubble distance', unit: 'm', variable: 'distance', reduce: 'final' },
  ],
  instruments: [
    {
      result: 'distance',
      quantity: 'Bubble distance',
      name: 'Scale',
      resolution: 'scaleResolution',
      excludes: 'reading by eye',
    },
  ],
};

const wsPiece = (id: string, kind: string, owns: string[] = []) => ({
  id,
  kind,
  slot: 'back-centre',
  label: id,
  owns,
});

/** The microscope's workspace as design D1 has it: the onion preparation of spec 21, then the stage. */
const MICROSCOPE_WORKSPACE = {
  pieces: [
    wsPiece('specimens', 'specimen', ['specimen']),
    wsPiece('stains', 'stain-bottle', ['stain']),
    wsPiece('slide', 'slide'),
    wsPiece('coverslip', 'coverslip'),
    wsPiece('prep', 'prep-tile'),
    wsPiece('stage', 'microscope-stage'),
    wsPiece('nosepiece', 'nosepiece', ['objective']),
    wsPiece('focus', 'focus-knob', ['focus']),
  ],
  materials: [
    { id: 'onion', kind: 'specimen', label: 'Onion', sets: { parameter: 'specimen', value: 0 } },
    { id: 'iodine', kind: 'stain', label: 'Iodine', sets: { parameter: 'stain', value: 1 } },
  ],
  setup: [
    ['s1', 'Take a clean slide', 'slide', 'prep', []],
    ['s2', 'Add the specimen', 'onion', 'slide', ['s1']],
    ['s3', 'Stain it', 'iodine', 'slide', ['s2']],
    ['s4', 'Lower the coverslip', 'coverslip', 'slide', ['s3']],
    ['s5', 'Put the slide on the stage', 'slide', 'stage', ['s4']],
  ].map(([id, instruction, place, onto, after]) => ({
    id,
    instruction,
    refusal: `Do "${String(instruction)}" first.`,
    place,
    onto,
    after,
  })),
};

interface Station {
  view: BenchView;
  session: ExperimentSession;
  setup(done: number): void;
  advance(seconds: number): void;
  finish(): void;
}

function station(raw: object, model: SimulationModel, extra: object = {}): Station {
  const definition = ExperimentDefinitionSchema.parse({ ...raw, ...extra });
  const session = new ExperimentSession('s', definition, model);
  session.setReady(true);
  const sample: Record<string, number> = {};
  let setup: SetupProgress[] = [];
  const view = {
    kind: 'bench',
    id: 's',
    definition,
    session,
    checklist: [],
    next: 0,
    runBlock: null,
    model: 'test',
    get setup() {
      return setup;
    },
    pose: {
      get status() {
        return session.state;
      },
      get parameters() {
        return session.run?.inputs ?? session.parameters;
      },
      get sample() {
        session.sample(sample);
        return sample;
      },
    },
  } as unknown as BenchView;
  return {
    view,
    session,
    setup(done) {
      setup = (definition.workspace?.setup ?? []).map((step, i) => ({ step, done: i < done }));
    },
    advance(seconds) {
      for (let t = 0; t < seconds && session.state === 'running'; t += 0.05) session.advance(0.05);
    },
    finish() {
      for (let i = 0; i < 20_000 && session.state === 'running'; i++) session.advance(0.05);
    },
  };
}

const microscope = (extra: object = {}) =>
  station(experiment('microscope'), microscopeModel, {
    presentation: 'microscopy',
    workspace: MICROSCOPE_WORKSPACE,
    procedure: [], // the shipped checklist names the shipped workspace's steps, not this fixture's
    ...extra,
  });
const osmosis = () => station(experiment('osmosis'), osmosisModel);
const enzyme = () => station(experiment('enzyme-activity'), enzymeModel);
const photosynthesis = () => station(experiment('photosynthesis'), photosynthesisModel);
const transpiration = () => station(TRANSPIRATION, transpirationModel);
const genetics = () => station(GENETICS, geneticsModel);

// ---- pieces -----------------------------------------------------------------------------------

interface Mounted {
  root: FakeEl;
  host: FakeEl;
  sent: Record<string, unknown>[];
  refuse: { reason: string | null };
  update(s: Station): void;
  dispose(): void;
}

function mount(
  kind: string,
  owns: string[] = [],
  shows: object[] = [],
  piece: Partial<WorkspacePiece> = {},
): Mounted {
  const root = new FakeEl('div');
  const sent: Record<string, unknown>[] = [];
  const refuse: { reason: string | null } = { reason: null };
  const ctx: PieceContext = {
    texts: ENGLISH,
    stationId: 's',
    piece: {
      id: kind,
      kind,
      slot: 'back-centre',
      label: kind,
      owns,
      shows,
      ...piece,
    } as WorkspacePiece,
    send: (command) => sent.push(command),
    refusal: () => refuse.reason,
  };
  const view = BIO_PIECES[kind]!();
  view.mount(root as unknown as HTMLElement, ctx);
  return {
    root,
    host: root.children[0]!,
    sent,
    refuse,
    update: (s) => view.update(s.view),
    dispose: () => view.dispose(),
  };
}

const radios = (root: FakeEl) => findAll(root, (n) => n.type === 'radio');
const pressed = (n: FakeEl) => n.getAttribute('aria-pressed') === 'true';
const attr = (root: FakeEl, cls: string, name: string) => one(root, cls).getAttribute(name);

describe('the registry', () => {
  const KINDS = [
    'specimen,stain-bottle,slide,coverslip,microscope-stage,nosepiece,focus-knob,lamp-indicator,eyepiece-field',
    'solution-bottle,buffer-bottle,tissue-sample,boiling-tube,membrane-lens,timer,balance,dispensing-syringe',
    'water-bath,reaction-tube,gas-syringe,stopwatch,lamp-rule,heat-filter,plant,capillary-scale,fan',
    'hygrometer,stomata-lens,lamp,parent-plant,punnett-board,seed-tray,seed-counter',
  ]
    .join(',')
    .split(',');

  it('has the Biology kinds of the design, each a factory', () => {
    expect(Object.keys(BIO_PIECES).sort()).toEqual([...KINDS].sort());
    for (const factory of Object.values(BIO_PIECES)) expect(typeof factory()).toBe('object');
  });

  it('registers the kinds Chemistry shares under bio- names, so neither subject overwrites the other', () => {
    for (const kind of ['balance', 'timer', 'stopwatch', 'water-bath', 'boiling-tube']) {
      expect(pieces[kind]).toBeUndefined();
      expect(pieces[`bio-${kind}`]).toBe(BIO_PIECES[kind]);
    }
    expect(pieces.specimen).toBe(BIO_PIECES.specimen);
    expect(Object.keys(pieces)).toHaveLength(Object.keys(BIO_PIECES).length);
  });

  it('shares no kind with another module the host registers (the later would replace the earlier)', () => {
    const modules = import.meta.glob<{ pieces?: Record<string, unknown> }>(
      ['./*.ts', '!./*.test.ts'],
      { eager: true },
    );
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const [path, module] of Object.entries(modules)) {
      for (const kind of Object.keys(module.pieces ?? {})) {
        const other = owner.get(kind);
        if (other) clashes.push(`${kind}: ${other} and ${path}`);
        else owner.set(kind, path);
      }
    }
    expect(clashes).toEqual([]);
  });
});

// Every kind with the owns / shows its design table gives it, on the experiment it belongs to.
type Spec = [kind: string, owns?: string[], shows?: object[]];
const EXPERIMENTS: [string, () => Station, Spec[]][] = [
  [
    'microscope',
    microscope,
    [
      ['specimen', ['specimen']],
      ['stain-bottle', ['stain']],
      ['slide'],
      ['coverslip'],
      ['microscope-stage'],
      ['nosepiece', ['objective']],
      ['focus-knob', ['focus']],
      ['lamp-indicator'],
      ['eyepiece-field'],
    ],
  ],
  [
    'osmosis',
    osmosis,
    [
      ['solution-bottle', ['concentration']],
      ['tissue-sample', ['initialMass']],
      ['boiling-tube', [], [{ parameter: 'concentration' }, { result: 'solutionPotential' }]],
      ['membrane-lens'],
      ['timer', ['soakTime'], [{ variable: 'labTime' }, { input: 'timeLapse' }]],
      ['balance', ['balanceResolution'], [{ instrument: 'finalMass' }]],
    ],
  ],
  [
    'enzyme-activity',
    enzyme,
    [
      ['solution-bottle', ['substrate']],
      ['buffer-bottle', ['pH']],
      ['dispensing-syringe', ['enzymeVolume']],
      ['water-bath', ['temperature']],
      ['reaction-tube'],
      ['gas-syringe'],
      ['stopwatch', [], [{ variable: 'clock' }, { input: 'collectionTime' }]],
    ],
  ],
  [
    'photosynthesis',
    photosynthesis,
    [
      ['lamp-rule', ['distance']],
      ['heat-filter'],
      ['solution-bottle', ['carbonate']],
      ['water-bath', ['temperature']],
      ['plant'],
      ['capillary-scale', ['resolution'], [{ variable: 'volume' }, { instrument: 'volume' }]],
      ['stopwatch', [], [{ variable: 'elapsed' }, { input: 'duration' }]],
    ],
  ],
  [
    'transpiration',
    transpiration,
    [
      ['lamp', ['illuminance']],
      ['plant'],
      ['fan', ['airSpeed']],
      ['hygrometer', ['humidity']],
      ['stomata-lens'],
      [
        'capillary-scale',
        ['scaleResolution'],
        [{ variable: 'distance' }, { instrument: 'distance' }],
      ],
      ['stopwatch'],
    ],
  ],
  [
    'genetics',
    genetics,
    [
      ['parent-plant', ['parent1']],
      ['parent-plant', ['parent2']],
      ['punnett-board'],
      ['seed-tray'],
      ['seed-counter', ['offspring', 'sample']],
    ],
  ],
];

describe('every piece, on its experiment', () => {
  it('covers every kind', () => {
    const kinds = new Set(EXPERIMENTS.flatMap(([, , specs]) => specs.map(([kind]) => kind)));
    expect([...kinds].sort()).toEqual(Object.keys(BIO_PIECES).sort());
  });

  for (const [name, make, specs] of EXPERIMENTS) {
    describe(name, () => {
      it('draws idle, mid-run, completed and reset, writing nothing for what has not changed', () => {
        const s = make();
        const all = specs.map(([kind, owns, shows]) => ({ kind, m: mount(kind, owns, shows) }));
        const states: [string, () => void][] = [
          ['idle', () => undefined],
          ['configured', () => undefined],
          [
            'running',
            () => {
              s.session.start();
              s.advance(1.2);
            },
          ],
          ['completed', () => s.finish()],
          ['reset', () => s.session.reset()],
        ];
        for (const [state, enter] of states) {
          enter();
          for (const { kind, m } of all) {
            expect(() => m.update(s), `${kind} ${state}`).not.toThrow();
            writes.count = 0;
            m.update(s);
            expect(writes.count, `${kind} writes again in ${state}`).toBe(0);
          }
        }
        for (const { m } of all) {
          m.dispose();
          expect(m.root.children).toEqual([]); // removed from the slot
          expect(listenerCount(m.root)).toBe(0);
        }
      });
    });
  }

  it('lets a piece be disposed before it was ever updated', () => {
    const m = mount('eyepiece-field');
    expect(() => m.dispose()).not.toThrow();
    expect(() => m.dispose()).not.toThrow();
  });
});

describe('choices', () => {
  it("offers exactly the presets of the owned parameter and shows the dial's", () => {
    const s = microscope();
    const m = mount('nosepiece', ['objective']);
    m.update(s);
    const inputs = radios(m.root);
    expect(inputs.map((i) => i.value)).toEqual(['4', '10', '40']);
    expect(inputs.map((i) => i.checked)).toEqual([true, false, false]);
    expect(m.root.textContent).toContain('10× (total 100×)');
    s.session.set('objective', 10);
    m.update(s);
    expect(radios(m.root).map((i) => i.checked)).toEqual([false, true, false]);
  });

  it('sends set for a chosen preset and leaves the dial to the station', () => {
    const s = microscope();
    const m = mount('nosepiece', ['objective']);
    m.update(s);
    const ten = radios(m.root)[1]!;
    ten.checked = true;
    ten.fire('change');
    expect(m.sent).toEqual([{ command: 'set', parameter: 'objective', value: 10 }]);
    expect(radios(m.root).map((i) => i.checked)).toEqual([true, false, false]); // the dial is still 4
  });

  it("does not send a refused choice, disables it with the station's reason and says why", () => {
    const s = microscope();
    const m = mount('focus-knob', ['focus']);
    m.refuse.reason = 'Stop the run before changing its parameters.';
    m.update(s);
    const first = radios(m.root)[0]!;
    first.fire('change');
    expect(m.sent).toEqual([]);
    expect(first.getAttribute('aria-disabled')).toBe('true');
    expect(first.parent!.title).toBe(m.refuse.reason);
    expect(one(m.root, 'bio-refusal').textContent).toBe(m.refuse.reason);
    // and enabled again once the station allows it
    m.refuse.reason = null;
    s.session.start();
    m.update(s);
    expect(first.getAttribute('aria-disabled')).toBe('false');
    expect(one(m.root, 'bio-refusal').textContent).toBe('');
  });

  it("puts the unstained slide's bottle empty and the stains in their ink", () => {
    const s = microscope();
    const m = mount('stain-bottle', ['stain']);
    m.update(s);
    const liquids = findAll(
      m.root,
      (n) => n.tag === 'rect' && n.getAttribute('opacity') === '0.85',
    );
    expect(liquids.map((l) => l.getAttribute('fill'))).toEqual(['#6b4512', '#1f3380']);
  });
});

describe('microscope', () => {
  it('shows the specimen cards as the painter draws them, redrawn when the stain changes', () => {
    const s = microscope();
    const m = mount('specimen', ['specimen']);
    m.update(s);
    const canvases = findAll(m.root, (n) => n.tag === 'canvas');
    expect(canvases).toHaveLength(3);
    const calls = (c: FakeEl) => (c.getContext() as { calls: string[] }).calls.length;
    const before = canvases.map(calls);
    expect(before.every((n) => n > 5)).toBe(true);
    m.update(s);
    expect(canvases.map(calls)).toEqual(before); // nothing repainted
    s.session.set('stain', 2);
    m.update(s);
    expect(canvases.map(calls).every((n, i) => n > before[i]!)).toBe(true);
  });

  it('keeps the field in standby without a run, then shows the picture, its classes and the lamp', () => {
    const s = microscope();
    const field = mount('eyepiece-field');
    const lamp = mount('lamp-indicator');
    field.update(s);
    lamp.update(s);
    expect(one(field.root, 'bio-standby').textContent).toBe('Lamp off');
    expect(one(field.root, 'bio-class').textContent).toBe('');
    expect(one(lamp.root, 'bio-status').textContent).toBe('Lamp off');
    s.session.start();
    s.advance(0.1); // far from focus: out of focus
    field.update(s);
    lamp.update(s);
    expect(one(field.root, 'bio-standby').textContent).toBe('');
    expect(one(field.root, 'bio-class').textContent).toContain('Out of focus');
    expect(one(lamp.root, 'bio-status').textContent).toBe('Lamp on');
    s.session.reset();
    s.session.set('focus', 0);
    s.session.start();
    s.finish();
    field.update(s);
    expect(one(field.root, 'bio-class').textContent).toContain('Sharp');
    s.session.reset();
    field.update(s);
    expect(one(field.root, 'bio-standby').textContent).toBe('Lamp off');
  });

  it('has no illumination control, pan or zoom: the lamp is an indicator, the field has two toggles', () => {
    const s = microscope();
    const lamp = mount('lamp-indicator');
    const field = mount('eyepiece-field');
    lamp.update(s);
    field.update(s);
    expect(findAll(lamp.root, (n) => ['button', 'input'].includes(n.tag))).toEqual([]);
    expect(findAll(field.root, (n) => n.tag === 'button').map((b) => b.textContent)).toEqual([
      'Measure',
      'Inspect',
    ]);
  });

  it('measures: the diameter once toggled, the n ticks only after completion', () => {
    const s = microscope();
    s.session.set('objective', 10);
    s.session.set('focus', 0);
    const field = mount('eyepiece-field');
    field.update(s);
    const [measure] = findAll(field.root, (n) => n.tag === 'button');
    measure!.fire('click');
    expect(pressed(measure!)).toBe(true);
    field.update(s);
    expect(attr(field.root, 'bio-measure-line', 'opacity')).toBe('0'); // no run, no field
    s.session.start();
    s.advance(0.1);
    field.update(s);
    expect(attr(field.root, 'bio-measure-line', 'opacity')).toBe('1');
    expect(attr(field.root, 'bio-measure-ticks', 'd')).toBe('');
    expect(one(field.root, 'bio-count').textContent).toBe('Field of view 1800 µm');
    s.finish();
    field.update(s);
    const n = s.session.run!.results!.cellsCounted!;
    expect(n).toBeGreaterThan(0);
    expect(attr(field.root, 'bio-measure-ticks', 'd')!.match(/M/g)).toHaveLength(n);
    const text = one(field.root, 'bio-count').textContent;
    expect(text).toContain(`${n} cells counted`);
    expect(text).toContain(`Length from the count ${Number((1800 / n).toPrecision(4))} µm`);
    measure!.fire('click'); // off again
    field.update(s);
    expect(attr(field.root, 'bio-measure-line', 'opacity')).toBe('0');
    expect(attr(field.root, 'bio-measure-ticks', 'd')).toBe('');
    expect(one(field.root, 'bio-count').textContent).toBe('');
  });

  it('counts nothing for a field that cannot be counted (unstained onion: faint)', () => {
    const s = microscope();
    s.session.set('stain', 0);
    s.session.set('objective', 10);
    const field = mount('eyepiece-field');
    findAll(field.root, (n) => n.tag === 'button')[0]!.fire('click');
    s.session.start();
    s.finish();
    field.update(s);
    expect(s.session.run!.results!.cellsCounted).toBe(0);
    expect(attr(field.root, 'bio-measure-ticks', 'd')).toBe('');
    expect(one(field.root, 'bio-count').textContent).toBe(
      'Field of view 1800 µm · 0 cells counted',
    );
  });

  it('inspects only the structures drawn: a cheek outline is a membrane, nothing is invented', () => {
    const names = (specimen: number, objective: number) => {
      const s = microscope();
      s.session.set('specimen', specimen);
      s.session.set('objective', objective);
      s.session.set('stain', 1);
      const field = mount('eyepiece-field');
      findAll(field.root, (n) => n.tag === 'button')[1]!.fire('click');
      field.update(s);
      expect(one(field.root, 'bio-legend').children).toHaveLength(0); // no run, nothing drawn, nothing named
      s.session.start();
      s.finish();
      field.update(s);
      return one(field.root, 'bio-legend').children.map((li) => li.textContent);
    };
    expect(names(1, 10)).toEqual(['Cell membrane', 'Cytoplasm', 'Nucleus']);
    expect(names(0, 10)).toEqual(['Cell wall', 'Cytoplasm', 'Nucleus']);
    expect(names(2, 40)).toEqual(['Cell wall', 'Cytoplasm', 'Chloroplast']);
    for (const list of [names(0, 4), names(1, 40), names(2, 4)]) {
      expect(list.join()).not.toMatch(/vacuole|organelle|plant membrane/i);
    }
  });

  it("turns the turret to the run's objective and the knob by the stage's travel", () => {
    const s = microscope();
    s.session.set('objective', 40);
    const nose = mount('nosepiece', ['objective']);
    const knob = mount('focus-knob', ['focus']);
    nose.update(s);
    knob.update(s);
    const turret = findAll(nose.root, (n) => n.tag === 'g')[0]!;
    expect(turret.getAttribute('transform')).toBe('rotate(-240 70 70)');
    expect(findAll(knob.root, (n) => n.tag === 'g')[0]!.getAttribute('transform')).toBe(
      'rotate(0 50 50)',
    );
    s.session.start();
    s.finish();
    nose.update(s);
    knob.update(s);
    const focus = s.session.run!.inputs.focus!;
    const turns = (100 - focus) / 200;
    expect(findAll(knob.root, (n) => n.tag === 'g')[0]!.getAttribute('transform')).toBe(
      `rotate(${Math.round((turns % 1) * 3600) / 10} 50 50)`,
    );
    expect(nose.root.textContent).toContain('400'); // M from the run, not computed here
  });

  it('prepares the onion slide step by step, each step a button the station can refuse', () => {
    const s = microscope();
    s.setup(0);
    const slide = mount('slide', [], [], { id: 'slide' });
    const stage = mount('microscope-stage', [], [], { id: 'stage' });
    const cover = mount('coverslip', [], [], { id: 'coverslip' });
    for (const m of [slide, stage, cover]) m.update(s);
    const buttons = (m: Mounted) => findAll(m.root, (n) => n.tag === 'button');
    // One control per action: s5 (the slide onto the stage) is the stage's, the slide has s1 only.
    expect(buttons(slide).map((b) => b.textContent)).toEqual(['Take a clean slide']);
    expect(buttons(stage).map((b) => b.textContent)).toEqual(['Put the slide on the stage']);
    expect(buttons(cover).map((b) => b.textContent)).toEqual(['Lower the coverslip']);
    // The glass is dashed (not yet on the tile), the patch hidden, the stage shows the slide faint.
    const glass = findAll(slide.root, (n) => n.className.includes('bio-glass'))[0]!;
    expect(glass.getAttribute('stroke-dasharray')).toBe('4 3');
    expect(findAll(slide.root, (n) => n.tag === 'ellipse')[0]!.getAttribute('opacity')).toBe('0');
    const clean = buttons(slide)[0]!;
    slide.refuse.reason = null;
    s.setup(0);
    slide.update(s);
    clean.fire('click');
    expect(slide.sent).toEqual([{ command: 'setup', step: 's1' }]);
    // Done steps are pressed and not sent again; a refused step says why and sends nothing.
    s.setup(1);
    slide.update(s);
    expect(pressed(clean)).toBe(true);
    clean.fire('click');
    expect(slide.sent).toHaveLength(1);
    stage.refuse.reason = 'Cover the slide first.';
    s.setup(2); // the state changed: the station is asked again
    stage.update(s);
    const later = buttons(stage)[0]!;
    later.fire('click');
    expect(stage.sent).toHaveLength(0);
    expect(later.title).toBe('Cover the slide first.');
    expect(one(stage.root, 'bio-refusal').textContent).toBe('Cover the slide first.');
    // Once everything is done the slide shows its patch in the stain's ink, covered, on the stage.
    s.setup(5);
    for (const m of [slide, stage, cover]) m.update(s);
    const patch = findAll(slide.root, (n) => n.tag === 'ellipse')[0]!;
    expect(patch.getAttribute('opacity')).toBe('1');
    expect(patch.getAttribute('fill')).toBe('#c9953a');
    expect(
      findAll(slide.root, (n) => n.className.includes('bio-cover'))[0]!.getAttribute('opacity'),
    ).toBe('0.55');
    expect(
      findAll(cover.root, (n) => n.className.includes('bio-glass'))[0]!.getAttribute('transform'),
    ).toBe('rotate(0 30 30)');
  });

  it('offers the stain of any slide and shows the the station reason when a choice is fixed', () => {
    // The shipped workspace: the onion's four steps apply to specimen 0, the stage step to every slide.
    const s = station(experiment('microscope'), microscopeModel);
    const all = s.view.definition.workspace!.setup;
    const progress = (ids: [string, boolean][]) =>
      Object.defineProperty(s.view, 'setup', {
        configurable: true,
        value: ids.map(([id, done]) => ({ step: all.find((x) => x.id === id)!, done })),
      });
    const onion = (done: string[]): [string, boolean][] =>
      ['new-slide', 'specimen', 'stain', 'coverslip', 'stage'].map((id) => [id, done.includes(id)]);
    const stains = mount('stain-bottle', ['stain'], [], { id: 'stains' });
    const specimens = mount('specimen', ['specimen'], [], { id: 'specimens' });
    const disabled = (m: Mounted) => radios(m.root).map((i) => i.getAttribute('aria-disabled'));
    const buttons = (m: Mounted) => findAll(m.root, (n) => n.tag === 'button');
    // The choices' reason comes first; the step buttons have their own line after it.
    const reason = (m: Mounted) =>
      findAll(m.root, (n) => n.className.includes('bio-refusal'))[0]!.textContent;

    progress(onion([]));
    stains.update(s);
    specimens.update(s);
    expect(disabled(stains)).toEqual(['false', 'false', 'false']); // none, iodine, methylene blue
    expect(disabled(specimens)).toEqual(['false', 'false', 'false']);
    // The steps the cards complete are their own buttons: the stain, the specimen.
    expect(buttons(stains).map((b) => b.textContent)).toEqual([
      expect.stringContaining('Choose a stain and add it to the slide'),
    ]);
    expect(buttons(specimens).map((b) => b.textContent)).toEqual([
      'Put the onion epidermis on the slide.',
    ]);

    // Once the station fixes a choice (its lock) the cards show its reason and send nothing.
    progress(onion(['new-slide', 'specimen', 'stain']));
    stains.refuse.reason = 'c is already fixed by a finished step: clear the bench to change it.';
    stains.update(s);
    expect(disabled(stains)).toEqual(['true', 'true', 'true']);
    expect(reason(stains)).toBe(stains.refuse.reason);
    radios(stains.root)[2]!.fire('change');
    expect(stains.sent).toEqual([]);

    // A prepared slide (cheek cells): only the stage step applies; its stain is still the player's choice.
    stains.refuse.reason = null;
    s.session.set('specimen', 1);
    progress([['stage', false]]);
    stains.update(s);
    specimens.update(s);
    expect(disabled(stains)).toEqual(['false', 'false', 'false']);
    expect(reason(stains)).toBe('');
    expect(buttons(stains)).toEqual([]);
    expect(disabled(specimens)).toEqual(['false', 'false', 'false']);
    expect(radios(stains.root).map((i) => i.checked)).toEqual([false, true, false]); // left as it was
    // The stage step is the stage's button, for any slide.
    const stage = mount('microscope-stage', [], [], { id: 'stage' });
    stage.update(s);
    expect(buttons(stage).map((b) => b.textContent)).toEqual([
      'Put the slide on the microscope stage.',
    ]);
  });

  it('draws a prepared slide with no steps: patch and coverslip, nothing to press', () => {
    const s = station(experiment('microscope'), microscopeModel);
    const slide = mount('slide');
    slide.update(s);
    expect(findAll(slide.root, (n) => n.tag === 'button')).toEqual([]);
    expect(findAll(slide.root, (n) => n.tag === 'ellipse')[0]!.getAttribute('opacity')).toBe('1');
  });
});

describe('osmosis', () => {
  it("draws the tube's cylinder only while it soaks, and the label from the run's own settings", () => {
    const s = osmosis();
    const tube = mount(
      'boiling-tube',
      [],
      [{ parameter: 'concentration' }, { result: 'solutionPotential' }],
    );
    tube.update(s);
    const cylinder = findAll(tube.root, (n) => n.className.includes('bio-flesh'))[0]!;
    expect(cylinder.getAttribute('height')).toBe('0');
    expect(tube.root.textContent).toContain('0.4 mol/L'); // the default is not a preset: shown as set
    s.session.start();
    s.advance(2);
    tube.update(s);
    expect(Number(cylinder.getAttribute('height'))).toBeGreaterThan(0);
    s.finish();
    tube.update(s);
    expect(cylinder.getAttribute('height')).toBe('0'); // on the balance now
    expect(tube.root.textContent).toMatch(/Ψ|potential/i);
  });

  it('keeps the balance at a dash until completion, then reads the mass to d with u and d/2', () => {
    const s = osmosis();
    const balance = mount('balance', ['balanceResolution'], [{ instrument: 'finalMass' }]);
    balance.update(s);
    expect(one(balance.root, 'bio-lcd').textContent).toBe('—');
    expect(one(balance.root, 'bio-note').textContent).toBe('');
    s.session.start();
    s.advance(3);
    balance.update(s);
    expect(one(balance.root, 'bio-lcd').textContent).toBe('—'); // no reading mid-run
    s.finish();
    balance.update(s);
    const run = s.session.run!;
    const d = run.inputs.balanceResolution!;
    expect(d).toBe(0.01);
    expect(one(balance.root, 'bio-lcd').textContent).toBe(
      `${run.results!.finalMass!.toFixed(2)} g`,
    );
    expect(one(balance.root, 'bio-note').textContent).toBe(
      `u = ${(d / Math.sqrt(12)).toPrecision(2)} g from the resolution alone · d/2 = 0.005 g`,
    );
    const pan = findAll(balance.root, (n) => n.className.includes('bio-flesh'))[0]!;
    expect(pan.getAttribute('opacity')).toBe('1');
  });

  it('draws the lens arrows by the sign of the direction, none without a run', () => {
    const arrowsOf = (concentration: number) => {
      const s = osmosis();
      s.session.set('concentration', concentration);
      const lens = mount('membrane-lens');
      lens.update(s);
      const g = one(lens.root, 'bio-arrows');
      expect(g.getAttribute('opacity')).toBe('0');
      s.session.start();
      s.advance(6);
      lens.update(s);
      return {
        shown: g.getAttribute('opacity'),
        flip: g.getAttribute('transform'),
        text: one(lens.root, 'bio-class').textContent,
      };
    };
    const into = arrowsOf(0);
    const out = arrowsOf(1);
    expect(into).toMatchObject({ shown: '1', flip: 'translate(0 0)' });
    expect(into.text).toBe('Gains water');
    expect(out).toMatchObject({ shown: '1', flip: 'translate(140 0) scale(-1 1)' });
    expect(out.text).toBe('Loses water');
  });

  it('counts lab time on the timer and shows the time-lapse as an input', () => {
    const s = osmosis();
    const timer = mount('timer', ['soakTime'], [{ variable: 'labTime' }, { input: 'timeLapse' }]);
    timer.update(s);
    expect(one(timer.root, 'bio-lcd').textContent).toBe('—');
    s.session.start();
    s.advance(5);
    timer.update(s);
    expect(one(timer.root, 'bio-lcd').textContent).toBe(clockText(s.session.run!.value('labTime'))); // ×240
    expect(timer.root.textContent).toContain('240');
  });

  it('draws the cylinders to length in proportion to their mass', () => {
    const s = osmosis();
    const m = mount('tissue-sample', ['initialMass']);
    m.update(s);
    const widths = findAll(m.root, (n) => n.className.includes('bio-flesh')).map((r) =>
      Number(r.getAttribute('width')),
    );
    expect(widths).toHaveLength(3);
    expect(widths[1]! / widths[0]!).toBeCloseTo(3 / 2, 12);
    expect(widths[2]! / widths[0]!).toBeCloseTo(5 / 2, 12);
  });
});

describe('enzyme activity', () => {
  it('draws the bubbles in proportion to the rate and none without a run', () => {
    const s = enzyme();
    const tube = mount('reaction-tube');
    tube.update(s);
    const bubbles = byClass(tube.root, 'bio-bubble');
    expect(bubbles.every((b) => b.getAttribute('opacity') === '0')).toBe(true);
    s.session.start();
    s.advance(2);
    tube.update(s);
    const shown = bubbles.filter((b) => b.getAttribute('opacity') === '1').length;
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThanOrEqual(8);
    expect(tube.root.textContent).toContain('Hydrogen peroxide left');
    expect(
      findAll(tube.root, (n) => n.attrs.has('fill') && n.getAttribute('fill') !== '#d9eaf2'),
    ).toEqual([]); // no colour change
  });

  it("moves the gas syringe's plunger with the oxygen collected", () => {
    const s = enzyme();
    const syringe = mount('gas-syringe');
    syringe.update(s);
    const plunger = findAll(
      syringe.root,
      (n) => n.className.includes('bio-metal') && n.tag === 'rect',
    )[0]!;
    expect(plunger.getAttribute('x')).toBe('20');
    s.session.start();
    s.advance(10);
    syringe.update(s);
    const early = Number(plunger.getAttribute('x'));
    expect(early).toBeGreaterThan(20);
    s.advance(20);
    syringe.update(s);
    expect(Number(plunger.getAttribute('x'))).toBeGreaterThan(early);
  });

  it('tints the water bath from the set temperature and fills the syringe to the set volume', () => {
    const s = enzyme();
    const bath = mount('water-bath', ['temperature']);
    const syringe = mount('dispensing-syringe', ['enzymeVolume']);
    s.session.set('temperature', 20);
    bath.update(s);
    syringe.update(s);
    const water = findAll(
      bath.root,
      (n) => n.tag === 'rect' && n.getAttribute('opacity') === '0.8',
    )[0]!;
    const cool = water.getAttribute('fill');
    const filled = findAll(syringe.root, (n) => n.getAttribute('opacity') === '0.85')[0]!;
    const small = Number(filled.getAttribute('width'));
    s.session.set('temperature', 50);
    s.session.set('enzymeVolume', 2);
    bath.update(s);
    syringe.update(s);
    expect(water.getAttribute('fill')).not.toBe(cool);
    expect(Number(filled.getAttribute('width'))).toBeGreaterThan(small);
  });
});

describe('photosynthesis', () => {
  it("lets one bubble rise per increment of the count, with the model's time", () => {
    const s = photosynthesis();
    const plant = mount('plant');
    plant.update(s);
    const bubbles = byClass(plant.root, 'bio-bubble');
    const visible = () => bubbles.filter((b) => b.getAttribute('opacity') === '0.9').length;
    expect(visible()).toBe(0);
    s.session.start();
    let most = 0;
    for (let i = 0; i < 400 && s.session.state === 'running'; i++) {
      s.advance(0.1);
      plant.update(s);
      most = Math.max(most, visible());
    }
    expect(most).toBeGreaterThan(0);
    s.finish();
    plant.update(s);
    s.session.reset();
    plant.update(s);
    expect(visible()).toBe(0);
    expect(
      findAll(plant.root, (n) => n.tag === 'g').some((g) => g.getAttribute('display') === 'none'),
    ).toBe(true);
  });

  it('puts the lamp at its distance on the rule, marked at the presets', () => {
    const s = photosynthesis();
    const rule = mount('lamp-rule', ['distance']);
    s.session.set('distance', 0.05);
    rule.update(s);
    const lamp = findAll(rule.root, (n) => n.tag === 'g')[0]!;
    const near = lamp.getAttribute('transform');
    s.session.set('distance', 0.4);
    rule.update(s);
    const x = (t: string | null) => Number(/translate\(([\d.]+)/.exec(t ?? '')![1]);
    expect(x(lamp.getAttribute('transform'))).toBeGreaterThan(x(near));
    const marks = findAll(
      rule.root,
      (n) => n.tag === 'path' && n.className.includes('bio-metal-line'),
    )[0]!;
    expect(marks.getAttribute('d')!.match(/M/g)).toHaveLength(4);
    expect(attr(rule.root, 'bio-glow', 'opacity')).toBe('0');
    s.session.start();
    s.advance(1);
    rule.update(s);
    expect(attr(rule.root, 'bio-glow', 'opacity')).toBe('0.9');
  });

  it('marks the capillary every resolution, grows the gas column and reads to δV after completion', () => {
    const s = photosynthesis();
    s.session.set('resolution', 0.2);
    const cap = mount(
      'capillary-scale',
      ['resolution'],
      [{ variable: 'volume' }, { instrument: 'volume' }],
    );
    cap.update(s);
    const ticks = one(cap.root, 'bio-metal-line');
    expect(ticks.getAttribute('d')!.match(/M/g)).toHaveLength(Math.floor(CAPILLARY_ML / 0.2) + 1);
    const column = one(cap.root, 'bio-gas');
    expect(column.getAttribute('width')).toBe('0');
    expect(one(cap.root, 'bio-lcd').textContent).toBe('—');
    s.session.start();
    s.advance(30);
    cap.update(s);
    expect(Number(column.getAttribute('width'))).toBeGreaterThan(0);
    expect(one(cap.root, 'bio-lcd').textContent).toBe('—');
    s.finish();
    cap.update(s);
    expect(one(cap.root, 'bio-lcd').textContent).toMatch(/^\d+\.\d mL$/);
    expect(one(cap.root, 'bio-note').textContent).toContain('from the resolution alone');
    // The marks stay at the resolution the reading was taken at, whatever the dial says since.
    const marks = ticks.getAttribute('d');
    s.session.set('resolution', 0.005);
    cap.update(s);
    expect(ticks.getAttribute('d')).toBe(marks);
  });

  it('rebuilds the step buttons when the steps change although their number does not', () => {
    const s = microscope();
    s.setup(0);
    const cover = mount('coverslip', [], [], { id: 'coverslip' });
    cover.update(s);
    const names = () => findAll(cover.root, (n) => n.tag === 'button').map((b) => b.textContent);
    expect(names()).toEqual(['Lower the coverslip']);
    // The same number of steps, the same number done, another step: the button follows the step.
    const swapped = s.view.setup.map((p) =>
      p.step.id === 's4' ? { ...p, step: { ...p.step, id: 'z9', instruction: 'Lay it flat' } } : p,
    );
    Object.defineProperty(s.view, 'setup', { get: () => swapped });
    cover.update(s);
    expect(names()).toEqual(['Lay it flat']);
    findAll(cover.root, (n) => n.tag === 'button')[0]!.fire('click');
    expect(cover.sent).toEqual([{ command: 'setup', step: 'z9' }]);
  });
});

describe('transpiration', () => {
  it('runs the fixture', () => {
    const s = transpiration();
    expect(s.session.start()).toBeNull();
  });

  it('turns the fan with the run clock, still before a run and when the clock is', () => {
    const s = transpiration();
    const fan = mount('fan', ['airSpeed']);
    const blades = () => one(fan.root, 'bio-blades');
    s.session.set('airSpeed', 0.1);
    fan.update(s);
    const angle = () => blades().getAttribute('transform');
    expect(angle()).toBe('rotate(0 50 50)');
    // Before a run it stands still whatever the dial, and it turns with the run's clock only.
    s.session.set('airSpeed', 0.5);
    fan.update(s);
    expect(angle()).toBe('rotate(0 50 50)');
    s.session.start();
    s.advance(0.1);
    fan.update(s);
    const slow = angle();
    expect(slow).not.toBe('rotate(0 50 50)');
    fan.update(s);
    expect(angle()).toBe(slow); // the clock did not move: neither does the fan
  });

  it('opens the stomatal pore with the light, closed without a run', () => {
    const open = (lux: number) => {
      const s = transpiration();
      s.session.set('illuminance', lux);
      const lens = mount('stomata-lens');
      lens.update(s);
      const pore = one(lens.root, 'bio-pore');
      expect(pore.getAttribute('ry')).toBe('1');
      s.session.start();
      s.advance(1);
      lens.update(s);
      return Number(pore.getAttribute('ry'));
    };
    expect(open(0)).toBe(1);
    expect(open(1000)).toBeGreaterThan(1);
    expect(open(20000)).toBeGreaterThan(open(1000));
  });

  it('turns the hygrometer needle with the set humidity and glows the lamp with the light, off at 0', () => {
    const s = transpiration();
    const gauge = mount('hygrometer', ['humidity']);
    const lamp = mount('lamp', ['illuminance']);
    const angle = () =>
      Number(/rotate\((-?[\d.]+)/.exec(attr(gauge.root, 'bio-needle', 'transform')!)![1]);
    s.session.set('humidity', 30);
    s.session.set('illuminance', 0);
    gauge.update(s);
    lamp.update(s);
    const dry = angle();
    expect(attr(lamp.root, 'bio-glow', 'opacity')).toBe('0');
    s.session.set('humidity', 90);
    s.session.set('illuminance', 20000);
    gauge.update(s);
    lamp.update(s);
    expect(angle()).toBeGreaterThan(dry);
    expect(attr(lamp.root, 'bio-glow', 'opacity')).toBe('0.9');
  });

  it('marks the capillary in mm along its scale length and reads the bubble to δx', () => {
    const s = transpiration();
    const cap = mount(
      'capillary-scale',
      ['scaleResolution'],
      [{ variable: 'distance' }, { instrument: 'distance' }],
    );
    cap.update(s);
    expect(one(cap.root, 'bio-metal-line').getAttribute('d')!.match(/M/g)).toHaveLength(101); // 100 mm / 1 mm
    s.session.start();
    s.finish();
    cap.update(s);
    expect(Number(one(cap.root, 'bio-gas').getAttribute('width'))).toBeGreaterThan(0);
    expect(one(cap.root, 'bio-lcd').textContent).toMatch(/^\d+\.\d+ m$/);
  });

  it("sways the shoot's leaves only while a run exists", () => {
    const s = transpiration();
    const plant = mount('plant');
    plant.update(s);
    const leaves = byClass(plant.root, 'bio-leaf');
    expect(leaves.map((l) => l.getAttribute('transform'))).toEqual(
      leaves.map((_, i) => `rotate(0 110 ${190 - 40 * i})`),
    );
    s.session.start();
    s.advance(0.37);
    plant.update(s);
    expect(leaves.some((l) => !/^rotate\(0 /.test(l.getAttribute('transform')!))).toBe(true);
  });
});

describe('genetics', () => {
  const cellsOf = (m: Mounted) => byClass(m.root, 'bio-cell');

  it("lays out the Punnett board with the model's own helper, 9:3:3:1 for YyRr × YyRr", () => {
    const s = genetics();
    const board = mount('punnett-board');
    board.update(s);
    const texts = findAll(board.root, (n) => n.className.includes('bio-cell-text')).map(
      (n) => n.textContent,
    );
    expect(texts).toHaveLength(16);
    texts.forEach((t, i) =>
      expect(t).toBe(genotypeLetters(offspringGenotype(11, 11, (i >> 2) | ((i & 3) << 2)))),
    );
    const fills = cellsOf(board).map((c) => c.getAttribute('fill'));
    expect(fills.filter((f) => f === '#e6c229')).toHaveLength(12); // yellow: 9 round + 3 wrinkled
    expect(cellsOf(board).filter((c) => c.getAttribute('rx') === '16')).toHaveLength(12); // round: 9 + 3
    // a new parent redraws from the dials
    s.session.set('parent1', 0);
    s.session.set('parent2', 0);
    board.update(s);
    expect(
      new Set(
        findAll(board.root, (n) => n.className.includes('bio-cell-text')).map((n) => n.textContent),
      ),
    ).toEqual(new Set(['yyrr']));
  });

  it('shows a parent with its genotype, its phenotype in words and its seeds, from the dial', () => {
    const s = genetics();
    const pot = mount('parent-plant', ['parent1']);
    pot.update(s);
    expect(one(pot.root, 'bio-genotype').textContent).toBe('YyRr');
    expect(one(pot.root, 'bio-class').textContent).toBe('yellow, round');
    expect(radios(pot.root)).toHaveLength(GENOTYPES.length);
    s.session.set('parent1', 2); // yyRR
    pot.update(s);
    expect(one(pot.root, 'bio-genotype').textContent).toBe('yyRR');
    expect(one(pot.root, 'bio-class').textContent).toBe('green, round');
    const seeds = byClass(pot.root, 'bio-seed').filter((n) => n.attrs.get('fill') === '#5d9a3a');
    expect(seeds.length).toBeGreaterThanOrEqual(4);
  });

  it('fills the tray with the counts against N, with the Punnett share marked, integers only', () => {
    const s = genetics();
    const tray = mount('seed-tray');
    tray.update(s);
    const heights = () =>
      findAll(
        tray.root,
        (n) =>
          n.tag === 'rect' && n.getAttribute('fill') !== null && /^#/.test(n.getAttribute('fill')!),
      ).map((r) => Number(r.getAttribute('height')));
    expect(heights()).toEqual([0, 0, 0, 0]);
    expect(byClass(tray.root, 'bio-expected').map((m) => m.getAttribute('transform'))).toEqual([
      'translate(0 -45)', // 9/16 of the 80 px: yellow round
      'translate(0 -15)',
      'translate(0 -15)',
      'translate(0 -5)',
    ]);
    expect(
      findAll(tray.root, (n) => n.className.includes('bio-cell-text')).map((t) => t.textContent),
    ).toEqual(['1', '—', '2', '—', '3', '—', '4', '—']);
    s.session.start();
    s.finish();
    tray.update(s);
    const run = s.session.run!;
    const counts = ['yellowRound', 'yellowWrinkled', 'greenRound', 'greenWrinkled'].map((v) =>
      run.value(v),
    );
    expect(counts.reduce((a, b) => a + b, 0)).toBe(80);
    expect(heights()).toEqual(counts.map((c) => 80 * (c / 80)));
    const shown = findAll(tray.root, (n) => n.className.includes('bio-cell-text')).map(
      (t) => t.textContent,
    );
    expect(shown.filter((t) => /^\d+$/.test(t)).length).toBe(8);
    expect(shown.filter((_, i) => i % 2 === 1)).toEqual(counts.map(String));
    s.session.reset();
    tray.update(s);
    expect(heights()).toEqual([0, 0, 0, 0]);
  });

  it('draws at most one seed in flight, the latest, none while there is none', () => {
    const s = genetics();
    const tray = mount('seed-tray');
    tray.update(s);
    const flying = () => byClass(tray.root, 'bio-seed').length;
    expect(flying()).toBe(0);
    s.session.start();
    s.advance(2);
    tray.update(s);
    expect(flying()).toBe(1);
    const last = s.session.run!.value('lastGenotype');
    const colour = byClass(tray.root, 'bio-seed')[0]!.getAttribute('fill');
    expect(colour).toBe(phenotypeClass(last) < 2 ? '#e6c229' : '#5d9a3a');
    s.session.reset();
    tray.update(s);
    expect(flying()).toBe(0);
  });

  it('sets the number of offspring and the sample, and counts', () => {
    const s = genetics();
    const counter = mount('seed-counter', ['offspring', 'sample']);
    counter.update(s);
    expect(radios(counter.root).map((r) => r.value)).toEqual([
      '16',
      '80',
      '556',
      '8023',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
    ]);
    radios(counter.root)[2]!.fire('change');
    expect(counter.sent).toEqual([{ command: 'set', parameter: 'offspring', value: 556 }]);
    s.session.start();
    s.finish();
    counter.update(s);
    expect(one(counter.root, 'bio-value').textContent).toBe('80');
  });
});
