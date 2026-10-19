import { z } from 'zod';
import { LocalizedTextSchema, ReviewStatusSchema, SourceSchema } from '@/core/data/dataset';

/**
 * Science Studio scenario: one guided lesson shared by every subject. The subject-specific part
 * (`binding`) names existing engines/data only; a scenario never carries measured numbers.
 */
export const SCENARIO_SCHEMA_VERSION = 1;

export const STUDIO_SUBJECTS = ['chemistry', 'biology', 'physics'] as const;
export type StudioSubject = (typeof STUDIO_SUBJECTS)[number];

/** Predict → Interact → Observe → Explain → Conclude → Save/Report. */
export const FLOW_STEPS = [
  'predict',
  'interact',
  'observe',
  'explain',
  'conclude',
  'report',
] as const;
export type FlowStep = (typeof FLOW_STEPS)[number];

/** Tools a scenario may turn on in its screens. */
export const STUDIO_TOOLS = [
  'controls',
  'engine-run',
  'table',
  'graph',
  'science-card',
  'open-lab',
  'bench',
  'model-3d',
  'match',
  'report',
] as const;
export type StudioTool = (typeof STUDIO_TOOLS)[number];

/** How a measured value is read from the engine run (never from the scenario). */
const EngineReadSchema = z.discriminatedUnion('kind', [
  /** Time at which the engine reported `finished()` (e.g. exact landing time). */
  z.object({ kind: z.literal('endTime') }),
  /** A scene graph series evaluated on the final engine state. */
  z.object({ kind: z.literal('seriesEnd'), graph: z.string().min(1), series: z.string().min(1) }),
]);
export type EngineRead = z.infer<typeof EngineReadSchema>;

const MeasureSchema = z.object({
  /** `solve()` answer id: gives label and unit, and is the analytic cross-check. */
  answer: z.string().min(1),
  engine: EngineReadSchema,
});
export type MeasureSpec = z.infer<typeof MeasureSchema>;

const PhysicsBindingSchema = z.object({
  kind: z.literal('physics'),
  /** Physics scene id (`src/physics/registry.ts`). */
  scene: z.string().min(1),
  /** POE id (`src/learn/poe.ts`): condition B = condition A with `poe.param × poe.factor`. */
  poe: z.string().min(1),
  /** Scene parameters the learner may change for condition A. */
  controls: z.array(z.string().min(1)).min(1),
  measures: z.array(MeasureSchema).min(1),
  /** Graph drawn for both conditions from the engine states. */
  graph: z.object({ graph: z.string().min(1), series: z.string().min(1) }),
  /** Longest simulated time (s) before a run counts as unfinished. */
  tMax: z.number().positive().max(3600),
});
export type PhysicsBinding = z.infer<typeof PhysicsBindingSchema>;

const ChemistryBindingSchema = z.object({
  kind: z.literal('chemistry'),
  /** Solutions on the bench: reactant formulas of the curated library (`data/reactions.json`). */
  inventory: z.array(z.string().min(1)).min(2).max(8),
  /** The mix the POE question is about, in the order the procedure adds the solutions. */
  target: z.tuple([z.string().min(1), z.string().min(1)]),
  /** Library record the target mix must match; a mismatch blocks the lesson instead of guessing. */
  reaction: z.string().min(1),
  /** The POE question shown before the bench. */
  question: LocalizedTextSchema,
});
export type ChemistryBinding = z.infer<typeof ChemistryBindingSchema>;

const BiologyBindingSchema = z.object({
  kind: z.literal('biology'),
  /** The 3D mitosis model (`src/biology/division/mitosis3d`). */
  model: z.literal('mitosis3d'),
  cellType: z.enum(['animal', 'plant']),
  /** Chromosome pairs n: the 3D view draws 2n = 2…8 only. */
  pairs: z.number().int().min(1).max(4),
  /** Cell parts (`COMPONENTS` ids) the learner finds in the model from their function. */
  parts: z.array(z.string().min(1)).min(2).max(8),
  /** Stage arrangement the POE question asks about; the answer is computed from the model. */
  stageQuestion: z.enum(['equatorRow']),
  /** The POE question shown before the model. */
  question: LocalizedTextSchema,
});
export type BiologyBinding = z.infer<typeof BiologyBindingSchema>;

export const ScenarioBindingSchema = z.discriminatedUnion('kind', [
  PhysicsBindingSchema,
  ChemistryBindingSchema,
  BiologyBindingSchema,
]);
export type ScenarioBinding = z.infer<typeof ScenarioBindingSchema>;

export const CompletionSchema = z.object({
  prediction: z.boolean(),
  observation: z.boolean(),
  explanationMinChars: z.number().int().min(0).max(2000),
  conclusion: z.boolean(),
  /** The subject's activity record (engine evidence with key `activity`) is required. */
  activity: z.boolean().optional(),
});
export type CompletionCriteria = z.infer<typeof CompletionSchema>;

export const ScenarioSchema = z
  .object({
    schemaVersion: z.literal(SCENARIO_SCHEMA_VERSION),
    id: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/, 'lowercase id'),
    subject: z.enum(STUDIO_SUBJECTS),
    /** Catalog topic id (`src/app/catalog.ts`). */
    topic: z.string().min(1),
    title: LocalizedTextSchema,
    objectives: z.array(LocalizedTextSchema).min(1),
    level: z.enum(['foundation', 'general']),
    difficulty: z.enum(['intro', 'core', 'stretch']),
    tools: z.array(z.enum(STUDIO_TOOLS)).min(1),
    /** Engine / model ids the scenario relies on (for the report and the feature map). */
    models: z.array(z.string().min(1)).min(1),
    /** Starting inputs in SI, merged over the model's defaults. */
    initial: z.record(z.string(), z.number()),
    steps: z.array(z.enum(FLOW_STEPS)).min(1),
    hints: z.array(LocalizedTextSchema),
    questions: z.array(LocalizedTextSchema),
    completion: CompletionSchema,
    expectedConclusion: LocalizedTextSchema,
    sources: z.array(SourceSchema),
    assumptions: z.array(LocalizedTextSchema),
    limits: z.array(LocalizedTextSchema),
    review_status: ReviewStatusSchema,
    /**
     * Who wrote the teaching text. Absent: built-in copy. 'teacher': written in the authoring
     * studio, shown with a teacher-content label and never presented as engine output.
     */
    author: z.literal('teacher').optional(),
    binding: ScenarioBindingSchema,
  })
  .superRefine((s, ctx) => {
    if (s.binding.kind !== s.subject) {
      ctx.addIssue({ code: 'custom', path: ['binding', 'kind'], message: 'binding ≠ subject' });
    }
    // Steps keep the POE order (a scenario may skip steps but never reorder them).
    const order = s.steps.map((st) => FLOW_STEPS.indexOf(st));
    if (order.some((v, i) => i > 0 && v <= (order[i - 1] ?? -1))) {
      ctx.addIssue({ code: 'custom', path: ['steps'], message: 'steps out of order' });
    }
    const need: [boolean, FlowStep][] = [
      [s.completion.prediction, 'predict'],
      [s.completion.observation, 'observe'],
      [s.completion.explanationMinChars > 0, 'explain'],
      [s.completion.conclusion, 'conclude'],
      [s.completion.activity === true, 'interact'],
    ];
    for (const [required, step] of need) {
      if (required && !s.steps.includes(step)) {
        ctx.addIssue({ code: 'custom', path: ['completion'], message: `needs step ${step}` });
      }
    }
    const b = s.binding;
    if (b.kind === 'physics') {
      for (const key of b.controls) {
        if (!(key in s.initial)) {
          ctx.addIssue({
            code: 'custom',
            path: ['initial', key],
            message: 'control without a start value',
          });
        }
      }
    } else if (b.kind === 'biology') {
      if (new Set(b.parts).size !== b.parts.length) {
        ctx.addIssue({ code: 'custom', path: ['binding', 'parts'], message: 'duplicate' });
      }
    } else {
      if (new Set(b.inventory).size !== b.inventory.length) {
        ctx.addIssue({ code: 'custom', path: ['binding', 'inventory'], message: 'duplicate' });
      }
      if (b.target[0] === b.target[1] || b.target.some((f) => !b.inventory.includes(f))) {
        ctx.addIssue({
          code: 'custom',
          path: ['binding', 'target'],
          message: 'target must be two different inventory solutions',
        });
      }
    }
  });
export type StudioScenario = z.infer<typeof ScenarioSchema>;

export type ScenarioCheck =
  { ok: true; scenario: StudioScenario } | { ok: false; errors: string[] };

/** Validates untrusted scenario JSON (built-in data, files, the authoring studio). */
export function validateScenario(input: unknown): ScenarioCheck {
  const r = ScenarioSchema.safeParse(input);
  if (r.success) return { ok: true, scenario: r.data };
  return {
    ok: false,
    errors: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}

/** The steps of a scenario in flow order. */
export function scenarioSteps(s: StudioScenario): FlowStep[] {
  return FLOW_STEPS.filter((st) => s.steps.includes(st));
}
