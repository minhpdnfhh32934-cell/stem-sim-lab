import { z } from 'zod';
import { ENGLISH, localized, type Texts } from '../core/i18n';
import { IdSchema, Vec3Schema } from '../core/schema';
import { LAB_TYPES } from '../world/definitions';

const PresetSchema = z.object({
  label: z.string().min(1),
  value: z.number(),
  ...localized('label'),
});

const ParameterSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    ...localized('label'),
    /** Short symbol for instruments and graphs, e.g. "v₀". */
    symbol: z.string().min(1).optional(),
    unit: z.string(),
    default: z.number(),
    min: z.number(),
    max: z.number(),
    /** One dial click, in the parameter's unit. */
    step: z.number().positive().optional(),
    /** Named values a dial steps through instead of `step` (e.g. gravity on the Moon). */
    presets: z.array(PresetSchema).default([]),
  })
  .refine((p) => p.min <= p.default && p.default <= p.max, 'must satisfy min ≤ default ≤ max')
  .refine((p) => p.presets.every((s) => s.value >= p.min && s.value <= p.max), {
    message: 'every preset must lie within min … max',
    path: ['presets'],
  });

const MeasurementSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  ...localized('label'),
  /** How graphs name it, e.g. "θ" (the id otherwise). */
  symbol: z.string().min(1).optional(),
  unit: z.string(),
  /** A model variable, or `time` for the simulation clock. */
  variable: z.string().min(1),
});

/** A name for the values above the class before, up to `max`; the last may take all the rest. */
const ResultClassSchema = z.object({
  max: z.number().optional(),
  label: z.string().min(1),
  ...localized('label'),
});

const ResultSchema = MeasurementSchema.extend({
  /** final = value at the end; min/max are tracked every step, not just at samples. */
  reduce: z.enum(['final', 'min', 'max']),
  /** How the value is shown: `integer` for a count; a decimal otherwise. */
  format: z.literal('integer').optional(),
  /** The model's analytical prediction of the same quantity, shown as theory beside it. */
  theory: z.string().min(1).optional(),
  /**
   * A value the student works out (an unknown sample's concentration): its simulated value and
   * theory are never shown; the results panel checks the student's answer against it
   * (`checkAnswer`), within the bound the reading of the instrument on result `proportionalTo`
   * carries. The record keeps it like any result.
   */
  answer: z.object({ proportionalTo: z.string().min(1) }).optional(),
  /**
   * Qualitative names for ranges of the value (e.g. "Loses water"), ascending by `max`, shown
   * beside the number — never instead of it: records, the run history and CSV stay numeric.
   */
  classes: z
    .array(ResultClassSchema)
    .refine(
      (classes) =>
        classes.every(
          ({ max }, i) =>
            i === classes.length - 1 || (max ?? Infinity) < (classes[i + 1]?.max ?? Infinity),
        ),
      'classes must ascend by max, last may omit it',
    )
    .optional(),
});

const GraphSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  ...localized('title'),
  /** Horizontal axis: `time` or a measurement id. */
  x: z.string().min(1),
  /** Measurement ids plotted against it. */
  y: z.array(z.string().min(1)).min(1),
  /** Vertical axis name when several series share it (e.g. "E"); a single series names itself. */
  yLabel: z.string().min(1).optional(),
  /** A model prediction marked on the horizontal axis on live screens (e.g. the landing range). */
  mark: z.string().min(1).optional(),
});

/**
 * Checklist milestones a station recognises: an item inspected (instructions read), the
 * apparatus loaded, a parameter adjusted (any, or the one named), a run completed, the results
 * viewed, a run reset, a workspace setup step done. A station marks one only when the operation itself succeeded.
 */
const MilestoneSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('inspected'), item: IdSchema }),
  z.object({ kind: z.literal('loaded') }),
  z.object({ kind: z.literal('adjusted'), parameter: z.string().min(1).optional() }),
  z.object({ kind: z.literal('completed') }),
  z.object({ kind: z.literal('viewed') }),
  z.object({ kind: z.literal('reset') }),
  /** A workspace setup step (`workspace.setup`) was done. */
  z.object({ kind: z.literal('setup'), step: IdSchema }),
]);

/**
 * How an input that is not a parameter is shown (e.g. a launch height the apparatus supplies);
 * `desk: false` keeps it to the results panel and CSV, off a bench desk's six rows. `hidden: true`
 * shows it nowhere a student sees (an unknown the student works out); the model, the session, the
 * run record and validation keep it.
 */
const InputDisplaySchema = z.object({
  symbol: z.string().min(1),
  unit: z.string(),
  desk: z.boolean().optional(),
  hidden: z.boolean().optional(),
});

/**
 * A graph worth overlaying when runs are compared: one line per run, so one series — `series`
 * picks it from a graph that plots several (e.g. the total energy of an energy graph).
 */
const ComparisonSchema = z.object({ graph: IdSchema, series: z.string().min(1).optional() });

/**
 * Units an instrument reads in, each on a linear scale whose step d is in the same unit (so
 * u = d/√12 holds: `measurement.ts`); chemistry reads mL and mol/L, a pH meter steps in pH;
 * grade 12 physics reads a joulemeter (J), a pressure gauge (Pa), a syringe (m³) and a balance (kg).
 */
export const READING_UNITS: readonly string[] = 'm m³ s mL g kg N V A J Pa °C ° pH mol/L'.split(
  ' ',
);

/** Quantities an analysis can take from a run's measured oscillation (`analysis.ts`). */
export const OSCILLATION_IDS: readonly string[] = [
  'oscillation.period',
  'oscillation.periodSquared',
];

/**
 * An instrument that reads one result of a completed run to a resolution d. d is a parameter, so
 * it is set at the station, recorded with each run and saved like any setting; the model never
 * reads it. The reading and its uncertainty: `measurement.ts`.
 */
const InstrumentSchema = z.object({
  /** The result it reads: the run's simulated value is the true value of what it measures. */
  result: z.string().min(1),
  /** The measured quantity as readings name it, e.g. "Range R". */
  quantity: z.string().min(1),
  /** What reads it, e.g. "Tape measure". */
  name: z.string().min(1),
  /** The parameter holding its resolution d, in the result's unit. */
  resolution: z.string().min(1),
  /** What a real measurement adds that an uncertainty from the resolution alone leaves out. */
  excludes: z.string().min(1),
  ...localized('quantity', 'name', 'excludes'),
});

/**
 * How completed runs are analysed together (`analysis.ts`): each run is one point (`x`, `y`) and
 * the runs that share every `group` parameter's value (one spring, one damping) are fitted with a
 * straight line y = a·x + b, whose slope is compared with the model's prediction `slope.theory`
 * (a reference line y = a·x through the origin, or y = a·x + b when `slope.intercept` names the
 * prediction of the model's intercept b); `derived`, if given, is a quantity the slope
 * gives, `numerator` / a (e.g. k = 4π²/a), compared with the prediction `derived.theory`. `x`, `y`
 * and `columns` name a result, else a parameter or shown input, else a quantity measured from the
 * run's oscillation (`oscillation.period`, `oscillation.periodSquared`). E.g. Hooke: F = m·g
 * against Δl, slope k (N/m); T² against m, slope 4π²/(k(1 − ζ²)).
 */
const AnalysisSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  note: z.string().default(''),
  ...localized('title', 'note'),
  x: z.string().min(1),
  y: z.string().min(1),
  group: z.array(z.string().min(1)).min(1),
  columns: z.array(z.string().min(1)).min(1),
  slope: z.object({
    label: z.string().min(1),
    ...localized('label'),
    symbol: z.string().min(1),
    unit: z.string(),
    theory: z.string().min(1),
    intercept: z.string().min(1).optional(),
  }),
  derived: z
    .object({
      label: z.string().min(1),
      ...localized('label'),
      symbol: z.string().min(1),
      unit: z.string(),
      numerator: z.number().positive(),
      theory: z.string().min(1),
    })
    .optional(),
});

/**
 * A run that swings about rest: the measurement read for its oscillation (`oscillation.ts`), the
 * swing measured from 0, and the model predictions its period and decay are compared with.
 */
/**
 * Completed runs drawn as points, one per run record: x its input `x` (a parameter), y its
 * simulated result `y`. No line is fitted and no theory drawn.
 */
const ScatterSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  ...localized('title'),
  x: z.string().min(1),
  y: z.string().min(1),
});

const OscillationSchema = z.object({
  measurement: z.string().min(1),
  period0: z.string().min(1).optional(),
  periodDamped: z.string().min(1).optional(),
  decayRate: z.string().min(1).optional(),
  envelope0: z.string().min(1).optional(),
  dampingRatio: z.string().min(1).optional(),
});

/**
 * How an experiment is presented: `physical-3d` is a station in the 3D room (desk, dials,
 * buttons); `physical-lab` is done by hand with the objects in the 3D lab (glassware held, set
 * down, poured: `docs/physical-lab-architecture.md`), its workspace data the step vocabulary,
 * never opened; the others open a workspace from the apparatus
 * (`docs/experiment-ux-architecture.md`).
 */
export const PRESENTATIONS = [
  'physical-3d',
  'bench-embedded',
  '2d-workspace',
  'microscopy',
  'observation',
  'physical-lab',
] as const;

/**
 * What a workspace piece shows, read from the session and its run: a model variable, a result,
 * the reading of the instrument on the result of that id, a shown input, a parameter.
 */
const BindingSchema = z.union([
  z.strictObject({ variable: z.string().min(1) }),
  z.strictObject({ result: z.string().min(1) }),
  z.strictObject({ instrument: z.string().min(1) }),
  z.strictObject({ input: z.string().min(1) }),
  z.strictObject({ parameter: z.string().min(1) }),
]);

/** An apparatus in the workspace, drawn by the piece view registered for its `kind`. */
const WorkspacePieceSchema = z.object({
  id: IdSchema,
  kind: IdSchema,
  /** Where it stands in its layout. */
  slot: z.string().min(1),
  label: z.string().min(1),
  ...localized('label'),
  /** The parameters it sets (its controls); every parameter belongs to exactly one piece. */
  owns: z.array(z.string().min(1)).default([]),
  shows: z.array(BindingSchema).default([]),
});

/**
 * Something the player may use, from the specification only. Choosing it sets a parameter to one
 * of that parameter's presets: no free combination, so no reaction can be invented.
 */
const MaterialSchema = z.object({
  id: IdSchema,
  kind: IdSchema,
  label: z.string().min(1),
  ...localized('label'),
  /** Shown by the library, never parsed into chemistry. */
  formula: z.string().min(1).optional(),
  sets: z.object({ parameter: z.string().min(1), value: z.number() }).optional(),
});

/**
 * A setup step: put `place` (a material or piece) onto the piece `onto`, once the steps `after`
 * are done. Before-run steps gate RUN; after-run steps are done once a run has completed (they
 * reveal a reading, they change no value). `refusal`: why what waits for this step is refused.
 */
const SetupStepSchema = z.object({
  id: IdSchema,
  instruction: z.string().min(1),
  refusal: z.string().min(1),
  ...localized('instruction', 'refusal'),
  place: IdSchema,
  onto: IdSchema,
  after: z.array(IdSchema).default([]),
  phase: z.enum(['before-run', 'after-run']).default('before-run'),
  /** The step applies only while `parameter` is one of `values` (its presets: one material). */
  when: z.object({ parameter: z.string().min(1), values: z.array(z.number()).min(1) }).optional(),
  /**
   * Parameters this step commits: while it applies and is done they cannot be set to another value
   * until the bench is cleared (a pipetted volume, a stain on the slide, a slide on the stage).
   */
  locks: z.array(z.string().min(1)).optional(),
  /**
   * `physical-lab` only: the physical action that does it. Needed for an action with no receiver
   * (`invert`: a stoppered vessel turned over, `place` = `onto`) and for a holder that keeps the
   * vessel off any surface (`clamp`: a burette into a stand's clamp, `raise`: that clamp slid up
   * its rod to its working height); without it, a step onto a
   * piece that is a container is a `transfer`, onto any other piece (a seat) a `set-down`.
   */
  by: z.enum(['set-down', 'transfer', 'invert', 'clamp', 'raise']).optional(),
});

/**
 * `physical-lab` only: pouring `place` (a piece or material) into the piece `onto` is the run
 * itself — not a setup step (RUN would wait for it): its first accepted drop starts the run. It is
 * fed to the model's driven mode by `feed`: the `volume` in the receiver (mL, a flask filled to
 * its mark), or the volume `added` from the source in this run (mL, the base run from a burette
 * into an acid sample).
 */
const DriveSchema = z.strictObject({
  place: IdSchema,
  onto: IdSchema,
  feed: z.enum(['volume', 'added']).default('volume'),
  /**
   * A burette's tap is the source (`place` a piece whose container has a `tap`): the model input
   * (mL/s) it runs at while open, so the flow and the model's rate are one value.
   */
  rate: z.string().min(1).optional(),
});

const WorkspaceSchema = z.object({
  pieces: z.array(WorkspacePieceSchema).min(1),
  materials: z.array(MaterialSchema).default([]),
  setup: z.array(SetupStepSchema).default([]),
  drive: DriveSchema.optional(),
  /** The run button's verb; RUN otherwise. */
  runLabel: z.string().min(1).optional(),
  ...localized('runLabel'),
});

type WorkspaceData = z.output<typeof WorkspaceSchema>;

/**
 * The workspace's references inside the definition: owned parameters (each by exactly one piece),
 * bound results / instruments / inputs / parameters, materials' presets, setup steps' pieces,
 * materials and earlier steps. Model variables are checked where models are known (content).
 */
interface Secrets {
  results: readonly { id: string; variable: string; answer?: object | undefined }[];
  inputs: Readonly<Record<string, { hidden?: boolean | undefined }>>;
}

/** Why `id` may not be shown to the student (an answer result, a hidden input), or null. */
function secret(e: Secrets, id: string): string | null {
  if (e.results.some((r) => r.id === id && r.answer)) {
    return `"${id}" is an answer the student works out`;
  }
  return Object.hasOwn(e.inputs, id) && e.inputs[id]?.hidden ? `"${id}" is hidden` : null;
}

/**
 * Why a text bound to a physical-lab object (a placement's params, a material's label or formula,
 * an item's inspect text) may not be shown: it names an answer result or a hidden input by id, or
 * a hidden input's value as written in the definition — or null. The content check of
 * `docs/physical-lab-architecture.md` §2.3 and §2.16; a text is never scanned for other numbers.
 */
export function leakIn(definition: ExperimentDefinition, text: string): string | null {
  for (const r of definition.results) {
    if (r.answer && text.includes(r.id)) return `names the answer "${r.id}"`;
  }
  for (const [id, shown] of Object.entries(definition.inputs)) {
    if (!shown.hidden) continue;
    const value = definition.initialConditions[id];
    if (text.includes(id)) return `names the hidden input "${id}"`;
    if (value !== undefined && text.includes(String(value))) {
      return `shows the hidden input "${id}" (${value})`;
    }
  }
  return null;
}

function workspaceProblems(
  e: Secrets & {
    presentation: (typeof PRESENTATIONS)[number];
    workspace?: WorkspaceData | undefined;
    parameters: readonly { id: string; presets: readonly { value: number }[] }[];
    instruments: readonly { result: string }[];
  },
): [(string | number)[], string][] {
  const w = e.workspace;
  if (!w) {
    return e.presentation === 'physical-3d'
      ? []
      : [[[], `a "${e.presentation}" experiment needs a workspace`]];
  }
  // Nothing could open it (open-workspace is refused there), so its setup could never be done.
  if (e.presentation === 'physical-3d') {
    return [[[], 'a "physical-3d" experiment has no workspace']];
  }
  const problems: [(string | number)[], string][] = [];
  const ids = [...w.pieces.map((p) => p.id), ...w.materials.map((m) => m.id)];
  ids.forEach((id, i) => {
    if (ids.indexOf(id) !== i) problems.push([[], `duplicate piece or material id "${id}"`]);
  });
  const parameter = (id: string) => e.parameters.find((p) => p.id === id);
  const owner = new Map<string, string>();
  w.pieces.forEach((piece, i) => {
    piece.owns.forEach((id, j) => {
      const other = owner.get(id);
      if (!parameter(id)) problems.push([['pieces', i, 'owns', j], `no parameter "${id}"`]);
      else if (other !== undefined) {
        problems.push([['pieces', i, 'owns', j], `"${id}" is already owned by "${other}"`]);
      }
      owner.set(id, other ?? piece.id);
    });
    piece.shows.forEach((b, j) => {
      const problem =
        'result' in b
          ? !e.results.some((r) => r.id === b.result) && `no result "${b.result}"`
          : 'instrument' in b
            ? !e.instruments.some((m) => m.result === b.instrument) &&
              `no instrument reads "${b.instrument}"`
            : 'input' in b
              ? !(b.input in e.inputs) && `no shown input "${b.input}"`
              : 'parameter' in b && !parameter(b.parameter) && `no parameter "${b.parameter}"`;
      const hidden =
        'result' in b
          ? secret(e, b.result)
          : 'input' in b
            ? secret(e, b.input)
            : 'variable' in b && e.results.some((r) => r.answer && r.variable === b.variable)
              ? `variable "${b.variable}" is an answer the student works out`
              : null;
      if (problem || hidden) problems.push([['pieces', i, 'shows', j], problem || hidden || '']);
    });
  });
  for (const p of e.parameters) {
    if (!owner.has(p.id)) problems.push([['pieces'], `parameter "${p.id}" is owned by no piece`]);
  }
  // A physical lab binds pieces and materials to objects in the room (placement params, labels):
  // none may name an answer or a hidden input (placement params: checked with the content).
  for (const [kind, list] of [
    ['pieces', w.pieces],
    ['materials', w.materials],
  ] as const) {
    list.forEach(({ id }, i) => {
      const hidden = secret(e, id);
      if (hidden) problems.push([[kind, i, 'id'], hidden]);
    });
  }
  w.materials.forEach(({ sets }, i) => {
    if (!sets) return;
    const p = parameter(sets.parameter);
    if (!p) problems.push([['materials', i, 'sets'], `no parameter "${sets.parameter}"`]);
    else if (!p.presets.some((s) => s.value === sets.value)) {
      problems.push([['materials', i, 'sets'], `${sets.value} is not a preset of "${p.id}"`]);
    }
  });
  const steps = w.setup.map((s) => s.id);
  w.setup.forEach((s, i) => {
    if (steps.indexOf(s.id) !== i) problems.push([['setup', i, 'id'], `duplicate id "${s.id}"`]);
    if (!ids.includes(s.place)) {
      problems.push([['setup', i, 'place'], `no piece or material "${s.place}"`]);
    }
    if (!w.pieces.some((p) => p.id === s.onto)) {
      problems.push([['setup', i, 'onto'], `no piece "${s.onto}"`]);
    }
    if (s.by && e.presentation !== 'physical-lab') {
      problems.push([['setup', i, 'by'], '"by" is for a "physical-lab" experiment']);
    } else if (s.by === 'invert' && s.place !== s.onto) {
      problems.push([['setup', i, 'by'], 'an inversion turns one vessel: "place" = "onto"']);
    }
    if (s.when) {
      const p = parameter(s.when.parameter);
      if (!p) problems.push([['setup', i, 'when'], `no parameter "${s.when.parameter}"`]);
      else {
        for (const value of s.when.values) {
          if (!p.presets.some((preset) => preset.value === value)) {
            problems.push([['setup', i, 'when'], `${value} is not a preset of "${p.id}"`]);
          }
        }
      }
    }
    s.locks?.forEach((id, j) => {
      if (!parameter(id)) problems.push([['setup', i, 'locks', j], `no parameter "${id}"`]);
    });
    s.after.forEach((id, j) => {
      // Only earlier steps: the order can never be circular.
      const before = w.setup.slice(0, i).find((other) => other.id === id);
      if (!before) problems.push([['setup', i, 'after', j], `no earlier step "${id}"`]);
      else if (s.phase === 'before-run' && before.phase === 'after-run') {
        problems.push([['setup', i, 'after', j], `before-run cannot wait for after-run "${id}"`]);
      }
    });
  });
  if (w.drive) {
    const { place, onto } = w.drive;
    if (e.presentation !== 'physical-lab') {
      problems.push([['drive'], '"drive" is for a "physical-lab" experiment']);
    }
    if (!ids.includes(place))
      problems.push([['drive', 'place'], `no piece or material "${place}"`]);
    if (!w.pieces.some((p) => p.id === onto))
      problems.push([['drive', 'onto'], `no piece "${onto}"`]);
  }
  return problems;
}

/**
 * Where a part of the apparatus is, for its label: `part`, a named object of the apparatus' 3D
 * model (the label follows it as it moves), or `at`, a point in the apparatus' frame (m, its
 * placement's origin and turn).
 */
const ExplainAnchorSchema = z.union([
  z.strictObject({ part: z.string().min(1) }),
  z.strictObject({ at: Vec3Schema }),
]);

/** A part of the apparatus the Explain view names: what it is and what it does here. */
const ExplainPartSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  role: z.string().min(1),
  ...localized('name', 'role'),
  anchor: ExplainAnchorSchema,
});

/** One step of the principle: what to understand, and the parts it is about (lit). */
const ExplainStepSchema = z.object({
  text: z.string().min(1),
  ...localized('text'),
  parts: z.array(IdSchema).default([]),
});

/**
 * The Explain view (and later the hub's teacher, who drives it): the experiment in one sentence,
 * the apparatus' parts with their labels, and the principle step by step (Phase X).
 */
export const ExplainSchema = z.object({
  summary: z.string().min(1),
  ...localized('summary'),
  /**
   * The close view, in the apparatus' frame (m): the camera `from` there, looking at `to` (the
   * labelled parts' middle by default). Without it the camera stands in front, holding the parts.
   */
  view: z.strictObject({ from: Vec3Schema, to: Vec3Schema.optional() }).optional(),
  parts: z.array(ExplainPartSchema).min(1),
  steps: z.array(ExplainStepSchema).min(1),
});
export type Explain = z.infer<typeof ExplainSchema>;

/** A value a worked example asks for: one of the model's predictions, as it is written. */
const ExampleFindSchema = z.strictObject({
  /** The model's prediction (a `predict` key) that is the answer. */
  theory: z.string().min(1),
  /** How it is written; by default the symbol and unit of the result compared with it. */
  symbol: z.string().min(1).optional(),
  unit: z.string().optional(),
  /** Significant figures of the answer (default 3). */
  figures: z.number().int().min(1).max(6).optional(),
});

/**
 * One step of a worked example: what the teacher says while writing it, what he writes on the
 * board (formulas, not translated), and a check of what it works out against the model (`expr`,
 * inputs by id and predictions as `@id`, equals prediction `equals`). Texts may hold `{id}` (an
 * input's value), `{@id}` (a prediction's), `{=expr}` (an expression's), each with an optional
 * `|n` for n significant figures.
 */
const ExampleStepSchema = z.object({
  say: z.string().min(1),
  ...localized('say'),
  write: z.string().min(1).optional(),
  check: z.strictObject({ expr: z.string().min(1), equals: z.string().min(1) }).optional(),
});

/**
 * A worked example the hub's teacher works on the lab's board (Phase Y-3): a question with the
 * experiment's own inputs (`set`, the rest at their defaults), what it asks for — the model's
 * predictions: the answer is the model's, never typed in — and the steps to it.
 */
export const ExampleSchema = z.object({
  id: IdSchema,
  question: z.string().min(1),
  ...localized('question'),
  set: z.record(z.string(), z.number()).default({}),
  find: z.array(ExampleFindSchema).min(1),
  steps: z.array(ExampleStepSchema).min(1),
});
export type WorkedExampleDefinition = z.infer<typeof ExampleSchema>;

const ProcedureStepSchema = z.object({
  id: IdSchema,
  instruction: z.string().min(1),
  ...localized('instruction'),
  done: MilestoneSchema,
});

/**
 * What an experiment is — never how it runs. The `model` id selects a SimulationModel in code;
 * everything a designer tunes (parameters, ranges, sampling, what to measure, which theory to
 * compare with, what to plot, the guided steps) lives here. Values are SI numbers except where
 * a parameter's `unit` says otherwise (angles are entered in degrees; chemistry uses mL and
 * mol/L); units are display labels.
 */
export const ExperimentDefinitionSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    category: z.enum(LAB_TYPES),
    description: z.string().default(''),
    ...localized('name', 'description', 'note'),
    requiredEquipment: z.array(IdSchema).default([]),
    model: IdSchema,
    /** A 3D station (default), or a workspace opened from its apparatus. */
    presentation: z.enum(PRESENTATIONS).default('physical-3d'),
    /** Required unless `physical-3d`. */
    workspace: WorkspaceSchema.optional(),
    /** Player-adjustable inputs. */
    parameters: z.array(ParameterSchema).default([]),
    /** Fixed model inputs that are not exposed to the player (an apparatus may supply them). */
    initialConditions: z.record(z.string(), z.number()).default({}),
    /** Symbol and unit of initial conditions where instruments show them. */
    inputs: z.record(z.string(), InputDisplaySchema).default({}),
    simulation: z.object({
      timeStep: z.number().positive().max(1),
      maxDuration: z.number().positive(),
      sampleInterval: z.number().positive(),
    }),
    measurements: z.array(MeasurementSchema).min(1),
    results: z.array(ResultSchema).default([]),
    graphs: z.array(GraphSchema).default([]),
    /** The graph a station's results monitor draws live (default: the first). */
    monitor: IdSchema.optional(),
    /** Graphs overlaid when runs are compared: only those that mean something side by side. */
    compare: z.array(ComparisonSchema).default([]),
    /** Instruments that read results, each to a resolution set at the station. */
    instruments: z.array(InstrumentSchema).default([]),
    /** What theory and measurement mean here, printed under the results. */
    note: z.string().default(''),
    /** Guided steps shown at a station, in order; a checklist, not a gate. */
    procedure: z.array(ProcedureStepSchema).default([]),
    /** Runs fitted together in a table and a line, one way per analysis. */
    analyses: z.array(AnalysisSchema).default([]),
    /** Completed runs as points (x a parameter, y a result), from their records only. */
    scatters: z.array(ScatterSchema).default([]),
    /** How a run's swing is measured from its samples, if it swings. */
    oscillation: OscillationSchema.optional(),
    /** Its parts and principle for the Explain view (Phase X). */
    explain: ExplainSchema.optional(),
    /** Worked examples the hub's teacher works on the lab's board (Phase Y-3). */
    examples: z.array(ExampleSchema).default([]),
  })
  .superRefine((e, ctx) => {
    const unique = (ids: string[], path: string) => {
      ids.forEach((id, i) => {
        if (ids.indexOf(id) !== i) {
          ctx.addIssue({ code: 'custom', path: [path, i, 'id'], message: `duplicate id "${id}"` });
        }
      });
    };
    unique(
      e.parameters.map((p) => p.id),
      'parameters',
    );
    unique(
      e.measurements.map((m) => m.id),
      'measurements',
    );
    unique(
      e.results.map((r) => r.id),
      'results',
    );
    unique(
      e.procedure.map((s) => s.id),
      'procedure',
    );
    unique(
      e.examples.map((x) => x.id),
      'examples',
    );
    if (e.explain) {
      const parts = e.explain.parts.map((p) => p.id);
      parts.forEach((id, i) => {
        if (parts.indexOf(id) !== i) {
          ctx.addIssue({
            code: 'custom',
            path: ['explain', 'parts', i, 'id'],
            message: `duplicate id "${id}"`,
          });
        }
      });
      e.explain.steps.forEach((step, i) =>
        step.parts.forEach((id, j) => {
          if (!parts.includes(id)) {
            ctx.addIssue({
              code: 'custom',
              path: ['explain', 'steps', i, 'parts', j],
              message: `no part "${id}"`,
            });
          }
        }),
      );
    }
    const measured = new Set(['time', ...e.measurements.map((m) => m.id)]);
    e.graphs.forEach((g, i) => {
      for (const [axis, id] of [['x', g.x] as const, ...g.y.map((y) => ['y', y] as const)]) {
        if (!measured.has(id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['graphs', i, axis],
            message: `"${id}" is not "time" or a measurement`,
          });
        }
      }
    });
    if (e.monitor !== undefined && !e.graphs.some((g) => g.id === e.monitor)) {
      ctx.addIssue({ code: 'custom', path: ['monitor'], message: `no graph "${e.monitor}"` });
    }
    e.compare.forEach((c, i) => {
      const graph = e.graphs.find((g) => g.id === c.graph);
      const problem = !graph
        ? `no graph "${c.graph}"`
        : c.series !== undefined && !graph.y.includes(c.series)
          ? `graph "${c.graph}" does not plot "${c.series}"`
          : c.series === undefined && graph.y.length > 1
            ? `graph "${c.graph}" plots ${graph.y.length} series: name one as "series"`
            : null;
      if (problem) ctx.addIssue({ code: 'custom', path: ['compare', i], message: problem });
    });
    const instrumentProblem = (m: (typeof e.instruments)[number], i: number) => {
      const result = e.results.find((r) => r.id === m.result);
      const d = e.parameters.find((p) => p.id === m.resolution);
      if (!result) return `no result "${m.result}"`;
      if (e.instruments.findIndex((other) => other.result === m.result) !== i) {
        return `result "${m.result}" already has an instrument`;
      }
      if (!READING_UNITS.includes(result.unit)) {
        return `cannot read "${result.unit}": instruments read ${READING_UNITS.join(', ')}`;
      }
      if (!d) return `no parameter "${m.resolution}"`;
      if (d.unit !== result.unit) {
        return `resolution "${d.id}" is in "${d.unit}", its result in "${result.unit}"`;
      }
      if (d.min <= 0) return `resolution "${d.id}" must stay above 0, not from ${d.min}`;
      return null;
    };
    e.instruments.forEach((m, i) => {
      const problem = instrumentProblem(m, i);
      if (problem) ctx.addIssue({ code: 'custom', path: ['instruments', i], message: problem });
    });
    for (const id of Object.keys(e.inputs)) {
      if (!(id in e.initialConditions)) {
        ctx.addIssue({
          code: 'custom',
          path: ['inputs', id],
          message: `"${id}" is not an initial condition`,
        });
      }
    }
    if (e.oscillation && !measured.has(e.oscillation.measurement)) {
      ctx.addIssue({
        code: 'custom',
        path: ['oscillation', 'measurement'],
        message: `"${e.oscillation.measurement}" is not a measurement`,
      });
    }
    unique(
      e.analyses.map((a) => a.id),
      'analyses',
    );
    e.analyses.forEach((a, k) => {
      const isParameter = (id: string) => e.parameters.some((p) => p.id === id);
      const known = (id: string) =>
        e.results.some((r) => r.id === id) ||
        isParameter(id) ||
        id in e.inputs ||
        (e.oscillation !== undefined && OSCILLATION_IDS.includes(id));
      const problem = (path: (string | number)[], message: string) =>
        ctx.addIssue({ code: 'custom', path: ['analyses', k, ...path], message });
      for (const [path, id] of [
        [['x'], a.x],
        [['y'], a.y],
        ...a.columns.map((id, i) => [['columns', i], id] as const),
      ] as const) {
        if (!known(id)) problem([...path], `"${id}" is not a result, parameter, input or measure`);
        const hidden = secret(e, id);
        if (hidden) problem([...path], hidden);
      }
      a.group.forEach((id, i) => {
        if (!isParameter(id)) problem(['group', i], `"${id}" is not a parameter`);
      });
    });
    // Analyses and the swing panel are built on theory, which a hidden input withholds.
    if (!theoryShown(e) && (e.analyses.length > 0 || e.oscillation)) {
      ctx.addIssue({
        code: 'custom',
        path: ['inputs'],
        message: 'an experiment with a hidden input shows no theory: no analyses or oscillation',
      });
    }
    // An answer stays the student's: nothing shown may carry its value or its theory.
    e.results.forEach((r, i) => {
      if (!r.answer) return;
      const { proportionalTo } = r.answer;
      const problem = !e.instruments.some((m) => m.result === proportionalTo)
        ? `no instrument reads "${proportionalTo}"`
        : e.instruments.some((m) => m.result === r.id)
          ? 'an instrument would show it'
          : e.results.some((o) => o !== r && o.variable === r.variable)
            ? `another result shows its variable "${r.variable}"`
            : e.measurements.some((m) => m.variable === r.variable)
              ? `a measurement shows its variable "${r.variable}"`
              : r.theory !== undefined &&
                  (e.graphs.some((g) => g.mark === r.theory) ||
                    e.results.some((o) => o !== r && o.theory === r.theory))
                ? `its theory "${r.theory}" is shown elsewhere`
                : null;
      if (problem)
        ctx.addIssue({ code: 'custom', path: ['results', i, 'answer'], message: problem });
    });
    unique(
      e.scatters.map((s) => s.id),
      'scatters',
    );
    e.scatters.forEach((s, i) => {
      const problem = (axis: string, message: string) =>
        ctx.addIssue({ code: 'custom', path: ['scatters', i, axis], message });
      if (!e.parameters.some((p) => p.id === s.x)) problem('x', `no parameter "${s.x}"`);
      if (!e.results.some((r) => r.id === s.y)) problem('y', `no result "${s.y}"`);
      else if (secret(e, s.y)) problem('y', secret(e, s.y) ?? '');
    });
    for (const [path, message] of workspaceProblems(e)) {
      ctx.addIssue({ code: 'custom', path: ['workspace', ...path], message });
    }
    e.procedure.forEach((s, i) => {
      const { done } = s;
      const step =
        done.kind === 'setup' ? e.workspace?.setup.find((x) => x.id === done.step) : undefined;
      if (done.kind === 'setup' && (!step || step.when)) {
        ctx.addIssue({
          code: 'custom',
          path: ['procedure', i, 'done', 'step'],
          // A step that applies to some materials only could never be ticked with the others.
          message: step ? `setup step "${done.step}" has a "when"` : `no setup step "${done.step}"`,
        });
      }
      const parameter = s.done.kind === 'adjusted' ? s.done.parameter : undefined;
      if (parameter !== undefined && !e.parameters.some((p) => p.id === parameter)) {
        ctx.addIssue({
          code: 'custom',
          path: ['procedure', i, 'done', 'parameter'],
          message: `no parameter "${parameter}"`,
        });
      }
    });
  });

export type ExperimentDefinition = z.infer<typeof ExperimentDefinitionSchema>;
export type Presentation = ExperimentDefinition['presentation'];
export type ExperimentWorkspace = NonNullable<ExperimentDefinition['workspace']>;
export type WorkspacePiece = ExperimentWorkspace['pieces'][number];
export type WorkspaceBinding = WorkspacePiece['shows'][number];
export type SetupStep = ExperimentWorkspace['setup'][number];
export type ExperimentParameter = ExperimentDefinition['parameters'][number];
export type ExperimentMilestone = ExperimentDefinition['procedure'][number]['done'];

/**
 * The name of the class a result's value falls in ("Loses water"): the first of its ascending
 * `classes` whose `max` the value does not pass, the last without one taking the rest; null
 * without classes or a value. Shown beside the number, never instead of it. It classes the
 * simulated value, not a rounded display of it (screens round differently), so two values that
 * display alike either side of a boundary can be in different classes.
 */
export function resultClass(
  result: ExperimentDefinition['results'][number],
  value: number | null,
  texts: Texts = ENGLISH,
): string | null {
  // NaN is in no class: it compares false with every max.
  const named =
    value === null ? null : result.classes?.find(({ max }) => value <= (max ?? Infinity));
  return named ? texts.of(named, 'label') : null;
}

/**
 * A topic of a subject (kinematics in physics): how experiments are grouped for learning, apart
 * from the rooms and stations where they are played. Every experiment is in at least one, of its
 * own subject (`category`); a topic lists only experiments that exist.
 */
export const TopicDefinitionSchema = z.object({
  id: IdSchema,
  subject: z.enum(LAB_TYPES),
  name: z.string().min(1),
  ...localized('name'),
  experiments: z.array(IdSchema).min(1),
});

export type TopicDefinition = z.infer<typeof TopicDefinitionSchema>;

/** The results a student is shown: every one but the answers they work out (`answer`). */
export const shownResults = (definition: ExperimentDefinition) =>
  definition.results.filter((r) => !r.answer);

/**
 * Whether a student may see the model's theory (results' theory, graph marks, analyses): not
 * where an input is `hidden`, since every theory is computed from all the inputs, the hidden one
 * included (the titration's V_eq = c_a·V_a/c_b gives c_a back exactly).
 */
export const theoryShown = (definition: Pick<ExperimentDefinition, 'inputs'>) =>
  !Object.values(definition.inputs).some((shown) => shown.hidden);

/** The non-parameter inputs a student is shown, [id, display]: every one but the `hidden`. */
export const shownInputs = (definition: ExperimentDefinition) =>
  Object.entries(definition.inputs).filter(([, shown]) => !shown.hidden);
