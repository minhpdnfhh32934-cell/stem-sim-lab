import { z } from 'zod';
import type { Locale } from '@/app/i18n';
import { LocalizedTextSchema, ReviewStatusSchema } from '@/core/data/dataset';
import {
  FLOW_STEPS,
  scenarioSteps,
  STUDIO_SUBJECTS,
  type FlowStep,
  type StudioScenario,
  type StudioSubject,
} from './scenario';

/**
 * A learner's run through one scenario, kept on this computer only (`stemsim.studio`).
 * Evidence keeps three origins apart: numbers the engine computed, the learner's own words and
 * AI-written text. Only `engine` records may hold measurements.
 */
export const STUDIO_TABS = ['chemistry', 'biology', 'physics', 'authoring'] as const;
export type StudioTab = (typeof STUDIO_TABS)[number];

/** Longest learner note kept (characters). */
export const MAX_NOTE = 2000;

const StepSchema = z.enum(FLOW_STEPS);
// zod 4 numbers already reject NaN and ±Infinity.
const Finite = z.number();

export const EngineQuantitySchema = z.object({
  id: z.string().min(1),
  label: LocalizedTextSchema,
  /** SI unit symbol (`src/core/units.ts`); '1' for a ratio. */
  unit: z.string(),
  /** Condition id ('A', 'B', 'B/A' …). */
  condition: z.string().min(1),
  value: Finite,
  /** Independent value of the same quantity (e.g. the analytic `solve()`), when one exists. */
  check: Finite.nullable(),
});
export type EngineQuantity = z.infer<typeof EngineQuantitySchema>;

const ConditionSchema = z.object({
  id: z.string().min(1),
  inputs: z.array(EngineQuantitySchema),
});

/** A non-numeric result copied from curated data (e.g. a reaction record's observation). */
export const EngineFactSchema = z.object({
  id: z.string().min(1),
  label: LocalizedTextSchema,
  text: LocalizedTextSchema,
});
export type EngineFact = z.infer<typeof EngineFactSchema>;

/** Longest subject operation log kept (the subject's model replays it). */
export const MAX_ACTIONS = 50;

/** One operation of a subject's interactive model (e.g. "add NaCl" on the chemistry bench). */
export const ActionSchema = z.object({
  op: z.string().min(1).max(40),
  arg: z.string().max(80).nullable(),
  at: z.number(),
});
export type ActionRecord = z.infer<typeof ActionSchema>;

const Base = { id: z.string().min(1), at: Finite, step: StepSchema };

export const EvidenceSchema = z.discriminatedUnion('kind', [
  z.object({
    ...Base,
    kind: z.literal('engine'),
    /** Replaces an earlier record with the same key (only the latest run is evidence). */
    key: z.string().min(1),
    model: z.string().min(1),
    title: LocalizedTextSchema,
    conditions: z.array(ConditionSchema),
    quantities: z.array(EngineQuantitySchema),
    facts: z.array(EngineFactSchema).optional(),
    /**
     * Review status of the curated data the record copies (a library record, a model's
     * descriptions). Absent when everything comes from code (e.g. a physics engine run).
     */
    review_status: ReviewStatusSchema.optional(),
  }),
  z.object({
    ...Base,
    kind: z.literal('learner'),
    role: z.enum(['explanation', 'conclusion', 'note']),
    text: z.string().max(MAX_NOTE),
  }),
  z.object({
    ...Base,
    kind: z.literal('ai'),
    provider: z.string().min(1),
    text: z.string().max(MAX_NOTE * 4),
  }),
]);
export type EvidenceRecord = z.infer<typeof EvidenceSchema>;
export type EngineEvidence = Extract<EvidenceRecord, { kind: 'engine' }>;
export type LearnerRole = Extract<EvidenceRecord, { kind: 'learner' }>['role'];

export const PredictionSchema = z.object({
  /** Subject-specific choice id. */
  choice: z.string().min(1),
  /** The choice as the learner saw it (in the language on screen then). */
  label: z.string().min(1),
  /** The choice in both languages, shown in the language on screen now (absent before 0.7). */
  text: LocalizedTextSchema.optional(),
  at: Finite,
});
export type Prediction = z.infer<typeof PredictionSchema>;

/** Prediction vs. the outcome the engine computed. `match` is null when no choice fits. */
export const VerdictSchema = z.object({
  correct: z.string().nullable(),
  /** The computed choice in both languages (null when no choice fits). */
  correctText: LocalizedTextSchema.nullable().optional(),
  /** Sessions saved before 0.7: the computed choice in the language on screen then. */
  correctLabel: z.string().nullable().optional(),
  match: z.boolean().nullable(),
});
export type Verdict = z.infer<typeof VerdictSchema>;

/** The learner's choice in the language on screen (older sessions: as it was stored). */
export function predictionLabel(p: Prediction, locale: Locale): string {
  return p.text?.[locale] ?? p.label;
}

/** The computed choice in the language on screen, or null when no choice fits. */
export function computedLabel(v: Verdict, locale: Locale): string | null {
  return v.correctText?.[locale] ?? v.correctLabel ?? null;
}

export const SessionSchema = z.object({
  scenarioId: z.string().min(1),
  step: StepSchema,
  startedAt: Finite,
  updatedAt: Finite,
  inputs: z.record(z.string(), Finite),
  prediction: PredictionSchema.nullable(),
  /** Set by the first engine run: later inputs never reopen the prediction (POE order). */
  predictionLocked: z.boolean().default(false),
  verdict: VerdictSchema.nullable(),
  evidence: z.array(EvidenceSchema),
  /** Operation log of the subject's model; only the subject plugin gives it a meaning. */
  actions: z.array(ActionSchema).max(MAX_ACTIONS).default([]),
  completedAt: Finite.nullable(),
});
export type StudioSession = z.infer<typeof SessionSchema>;

export function createSession(scenario: StudioScenario, now: number): StudioSession {
  return {
    scenarioId: scenario.id,
    step: scenarioSteps(scenario)[0] ?? 'predict',
    startedAt: now,
    updatedAt: now,
    inputs: { ...scenario.initial },
    prediction: null,
    predictionLocked: false,
    verdict: null,
    evidence: [],
    actions: [],
    completedAt: null,
  };
}

export function engineEvidence(s: StudioSession): EngineEvidence[] {
  return s.evidence.filter((e): e is EngineEvidence => e.kind === 'engine');
}

export function learnerText(s: StudioSession, role: LearnerRole): string {
  const rec = s.evidence.find((e) => e.kind === 'learner' && e.role === role);
  return rec?.kind === 'learner' ? rec.text : '';
}

/** Key of the engine record that completes a subject's activity (`completion.activity`). */
export const ACTIVITY_KEY = 'activity';

/** Why the learner cannot leave `step` yet (null = may continue). */
export type Blocker = 'prediction' | 'observation' | 'activity' | 'explanation' | 'conclusion';

export function blockerAt(
  scenario: StudioScenario,
  s: StudioSession,
  step: FlowStep,
): Blocker | null {
  const c = scenario.completion;
  if (step === 'predict' && c.prediction && !s.prediction) return 'prediction';
  // The observation that answers the prediction sets the verdict; other runs do not count.
  if (step === 'interact' && c.observation && (engineEvidence(s).length === 0 || !s.verdict)) {
    return 'observation';
  }
  if (
    step === 'interact' &&
    c.activity === true &&
    !engineEvidence(s).some((e) => e.key === ACTIVITY_KEY)
  ) {
    return 'activity';
  }
  if (step === 'explain' && learnerText(s, 'explanation').trim().length < c.explanationMinChars) {
    return 'explanation';
  }
  if (step === 'conclude' && c.conclusion && learnerText(s, 'conclusion').trim().length === 0) {
    return 'conclusion';
  }
  return null;
}

/** First step whose requirement is still open (null = every requirement met). */
export function firstBlocked(scenario: StudioScenario, s: StudioSession): FlowStep | null {
  for (const step of scenarioSteps(scenario)) {
    if (blockerAt(scenario, s, step)) return step;
  }
  return null;
}

/** Moves to `step` only when every earlier step is satisfied. */
export function goTo(scenario: StudioScenario, s: StudioSession, step: FlowStep): StudioSession {
  const steps = scenarioSteps(scenario);
  const target = steps.indexOf(step);
  if (target < 0) return s;
  for (const earlier of steps.slice(0, target)) {
    if (blockerAt(scenario, s, earlier)) return s;
  }
  return { ...s, step };
}

export function neighbour(
  scenario: StudioScenario,
  step: FlowStep,
  delta: 1 | -1,
): FlowStep | null {
  const steps = scenarioSteps(scenario);
  return steps[steps.indexOf(step) + delta] ?? null;
}

/** The prediction is locked once the engine has produced an observation (POE order). */
export function withPrediction(s: StudioSession, p: Prediction): StudioSession {
  if (s.predictionLocked || s.verdict || engineEvidence(s).length > 0) return s;
  return { ...s, prediction: p, updatedAt: p.at };
}

/**
 * New inputs make every engine fact and the verdict stale: they are dropped so the table, the
 * graph, the conclusion and the report always describe the same state.
 */
export function withInputs(
  s: StudioSession,
  inputs: Record<string, number>,
  now: number,
): StudioSession {
  const same =
    Object.keys(inputs).length === Object.keys(s.inputs).length &&
    Object.entries(inputs).every(([k, v]) => s.inputs[k] === v);
  if (same) return s;
  const beyond = FLOW_STEPS.indexOf(s.step) > FLOW_STEPS.indexOf('interact');
  return {
    ...s,
    inputs: { ...inputs },
    evidence: s.evidence.filter((e) => e.kind !== 'engine'),
    verdict: null,
    completedAt: null,
    step: beyond ? 'interact' : s.step,
    updatedAt: now,
  };
}

/**
 * Adds an engine record. A run that does not answer the prediction passes the current verdict
 * (possibly null) so an earlier answer is kept.
 */
export function withEngine(
  s: StudioSession,
  rec: EngineEvidence,
  verdict: Verdict | null,
): StudioSession {
  return {
    ...s,
    evidence: [...s.evidence.filter((e) => !(e.kind === 'engine' && e.key === rec.key)), rec],
    predictionLocked: true,
    verdict,
    updatedAt: rec.at,
  };
}

/** Replaces the subject's operation log (the subject validates it by replaying its model). */
export function withActions(
  s: StudioSession,
  actions: readonly ActionRecord[],
  now: number,
): StudioSession {
  return { ...s, actions: actions.slice(-MAX_ACTIONS), updatedAt: now };
}

export function withLearnerText(
  s: StudioSession,
  role: LearnerRole,
  text: string,
  now: number,
): StudioSession {
  const clipped = text.slice(0, MAX_NOTE);
  const others = s.evidence.filter((e) => !(e.kind === 'learner' && e.role === role));
  const rec: EvidenceRecord = {
    id: `learner:${role}`,
    at: now,
    step: role === 'explanation' ? 'explain' : role === 'conclusion' ? 'conclude' : s.step,
    kind: 'learner',
    role,
    text: clipped,
  };
  return { ...s, evidence: clipped ? [...others, rec] : others, updatedAt: now };
}

/** AI text is kept apart and labelled; it is never a measurement. */
export function withAiText(
  s: StudioSession,
  provider: string,
  text: string,
  now: number,
): StudioSession {
  const n = s.evidence.filter((e) => e.kind === 'ai').length + 1;
  const rec: EvidenceRecord = {
    id: `ai:${String(n)}`,
    at: now,
    step: s.step,
    kind: 'ai',
    provider,
    text: text.slice(0, MAX_NOTE * 4),
  };
  return { ...s, evidence: [...s.evidence, rec], updatedAt: now };
}

export function markComplete(
  scenario: StudioScenario,
  s: StudioSession,
  now: number,
): StudioSession {
  if (firstBlocked(scenario, s) !== null || s.completedAt !== null) return s;
  return { ...s, completedAt: now, updatedAt: now };
}

/* ---------------- Persistence ---------------- */

export const STUDIO_STORE_VERSION = 1;

export interface PersistedStudio {
  tab: StudioTab;
  sessions: Record<string, StudioSession>;
  /** Lesson last shown per subject; an id that no longer exists falls back to the first one. */
  picked: Partial<Record<StudioSubject, string>>;
}

const PickedSchema = z.partialRecord(z.enum(STUDIO_SUBJECTS), z.string().min(1).max(200));

export const DEFAULT_TAB: StudioTab = 'physics';

/**
 * Turns whatever is in storage into a valid state: unknown tabs fall back to the default and
 * sessions that do not match the schema are dropped (a broken record never crashes the app).
 * Version 0 had no `tab` and stored sessions as an array.
 */
export function migrateStudio(persisted: unknown, version: number): PersistedStudio {
  const raw = (typeof persisted === 'object' && persisted !== null ? persisted : {}) as Record<
    string,
    unknown
  >;
  const tab = z.enum(STUDIO_TABS).safeParse(raw.tab);
  let list: unknown[] = [];
  if (version === 0 && Array.isArray(raw.sessions)) list = raw.sessions as unknown[];
  else if (typeof raw.sessions === 'object' && raw.sessions !== null) {
    list = Object.values(raw.sessions as Record<string, unknown>);
  }
  const sessions: Record<string, StudioSession> = {};
  for (const item of list) {
    const r = SessionSchema.safeParse(item);
    if (r.success) sessions[r.data.scenarioId] = r.data;
  }
  const picked = PickedSchema.safeParse(raw.picked);
  return {
    tab: tab.success ? tab.data : DEFAULT_TAB,
    sessions,
    picked: picked.success ? picked.data : {},
  };
}
