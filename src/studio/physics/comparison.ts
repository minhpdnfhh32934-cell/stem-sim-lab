import { translate } from '@/app/i18n';
import type { LocalizedText } from '@/core/data/dataset';
import { toSI } from '@/core/units';
import { answerValue } from '@/learn/challenges';
import { changedValue, observe, POES, type Poe, type PoeOutcome } from '@/learn/poe';
import type { Params, PhysicsScene } from '@/physics/types';
import type { MeasureSpec, PhysicsBinding, StudioScenario } from '../scenario';
import type { EngineEvidence, EngineQuantity, Prediction, Verdict } from '../session';
import { runEngine, type EngineTrace } from './engineRun';

/**
 * Physics Studio adapter: condition A is the learner's inputs, condition B is A with the POE's
 * parameter scaled. Both run in the scene's own engine; `solve()` is only the cross-check and
 * the POE verdict (`observe`), exactly as in the lab's "Dự đoán trước".
 */
export function poeById(id: string): Poe | undefined {
  return POES.find((p) => p.id === id);
}

/** The scenario's physics binding with its POE, or null when the POE id is unknown. */
export function physicsOf(scenario: StudioScenario): { b: PhysicsBinding; poe: Poe } | null {
  const b = scenario.binding;
  if (b.kind !== 'physics') return null;
  const poe = poeById(b.poe);
  return poe ? { b, poe } : null;
}

/** Mismatches between a binding and the scene/POE it names (empty = consistent). */
export function checkBinding(scene: PhysicsScene, b: PhysicsBinding): string[] {
  const errors: string[] = [];
  const poe = poeById(b.poe);
  if (!poe) errors.push(`unknown POE ${b.poe}`);
  else if (poe.topic !== scene.id) errors.push(`POE ${b.poe} belongs to ${poe.topic}`);
  const keys = new Set(scene.params.map((d) => d.key));
  for (const c of b.controls) if (!keys.has(c)) errors.push(`unknown control ${c}`);
  const answers = new Set(scene.solve(scene.defaults, 'vi').answers.map((a) => a.id));
  for (const m of b.measures) {
    if (!answers.has(m.answer)) errors.push(`unknown answer ${m.answer}`);
    if (m.engine.kind === 'seriesEnd' && !findSeries(scene, m.engine.graph, m.engine.series)) {
      errors.push(`unknown series ${m.engine.graph}.${m.engine.series}`);
    }
  }
  if (!findSeries(scene, b.graph.graph, b.graph.series)) errors.push('unknown graph series');
  if (poe && !b.measures.some((m) => m.answer === poe.answer)) {
    errors.push(`POE answer ${poe.answer} is not measured`);
  }
  return errors;
}

function findSeries(scene: PhysicsScene, graph: string, series: string) {
  return scene.graphs.find((g) => g.id === graph)?.series.find((s) => s.id === series);
}

/** Slider range (SI) of a control; the scaled POE parameter must stay inside the scene's range. */
export function controlRange(scene: PhysicsScene, poe: Poe, key: string): [number, number] {
  const def = scene.params.find((d) => d.key === key);
  const unit = def?.unit ?? '1';
  let lo = toSI(def?.min ?? 0, unit);
  let hi = toSI(def?.max ?? 1, unit);
  const step = toSI(def?.step ?? 0.1, unit);
  if (key === poe.param) {
    // A zero start value has no ratio to compare.
    if (lo <= 0) lo = step;
    hi = poe.factor > 1 ? hi / poe.factor : hi;
  }
  return [lo, hi];
}

export function conditionParams(
  scene: PhysicsScene,
  scenario: StudioScenario,
  b: PhysicsBinding,
  poe: Poe,
  inputs: Record<string, number>,
  g: number,
): { A: Params; B: Params } {
  const A: Params = { ...scene.defaults, ...scenario.initial };
  for (const key of b.controls) {
    const v = inputs[key];
    if (v !== undefined && Number.isFinite(v)) A[key] = v;
  }
  if (scene.usesGravity) A.g = g;
  return { A, B: { ...A, [poe.param]: changedValue(poe, A) } };
}

export interface MeasuredValue {
  answer: string;
  label: LocalizedText;
  unit: string;
  /** Read from the engine run. */
  engine: number | null;
  /** The scene's analytic `solve()` for the same parameters. */
  check: number | null;
}

export interface ConditionRun {
  id: 'A' | 'B';
  params: Params;
  trace: EngineTrace;
  values: MeasuredValue[];
}

export interface PhysicsComparison {
  A: ConditionRun;
  B: ConditionRun;
  poe: Poe;
  /** POE verdict from `solve()` before/after (same rule as the lab). */
  outcome: PoeOutcome | null;
  /** B/A of the POE's answer, from the engine. */
  ratio: number | null;
  graph: { x: number[]; a: (number | null)[]; b: (number | null)[] };
}

export type ComparisonResult =
  | { ok: true; cmp: PhysicsComparison }
  | { ok: false; reason: 'invalid' | 'unfinished' | 'binding' };

function readEngine(
  scene: PhysicsScene,
  m: MeasureSpec,
  trace: EngineTrace,
  p: Params,
): number | null {
  if (!trace.finished) return null;
  if (m.engine.kind === 'endTime') return trace.endTime;
  const last = trace.states[trace.states.length - 1];
  const series = findSeries(scene, m.engine.graph, m.engine.series);
  if (!last || !series) return null;
  const v = series.value(last, p);
  return Number.isFinite(v) ? v : null;
}

function measureAll(
  scene: PhysicsScene,
  b: PhysicsBinding,
  trace: EngineTrace,
  p: Params,
): MeasuredValue[] {
  const answers = scene.solve(p, 'vi').answers;
  return b.measures.map((m) => {
    const a = answers.find((x) => x.id === m.answer);
    return {
      answer: m.answer,
      label: a?.label ?? { vi: m.answer, en: m.answer },
      unit: a?.unit ?? '1',
      engine: readEngine(scene, m, trace, p),
      check: answerValue(scene, p, m.answer),
    };
  });
}

/** One time axis for both runs; a run has no value outside its own samples (gap, not invented). */
export function mergeOnTime(
  a: { t: number[]; y: number[] },
  b: { t: number[]; y: number[] },
): { x: number[]; a: (number | null)[]; b: (number | null)[] } {
  const key = (t: number) => Math.round(t * 1e9);
  const ma = new Map(a.t.map((t, i) => [key(t), a.y[i] ?? null]));
  const mb = new Map(b.t.map((t, i) => [key(t), b.y[i] ?? null]));
  const keys = [...new Set([...ma.keys(), ...mb.keys()])].sort((x, y) => x - y);
  return {
    x: keys.map((k) => k / 1e9),
    a: keys.map((k) => ma.get(k) ?? null),
    b: keys.map((k) => mb.get(k) ?? null),
  };
}

function seriesOf(scene: PhysicsScene, b: PhysicsBinding, trace: EngineTrace, p: Params) {
  const s = findSeries(scene, b.graph.graph, b.graph.series);
  return { t: trace.times, y: trace.states.map((st) => (s ? s.value(st, p) : NaN)) };
}

export async function runComparison(
  scene: PhysicsScene,
  scenario: StudioScenario,
  inputs: Record<string, number>,
  g: number,
): Promise<ComparisonResult> {
  const b = scenario.binding;
  if (b.kind !== 'physics') return { ok: false, reason: 'binding' };
  const poe = poeById(b.poe);
  if (!poe || checkBinding(scene, b).length > 0) {
    return { ok: false, reason: 'binding' };
  }
  const { A, B } = conditionParams(scene, scenario, b, poe, inputs, g);
  if ((scene.validate?.(A) ?? []).length > 0 || (scene.validate?.(B) ?? []).length > 0) {
    return { ok: false, reason: 'invalid' };
  }
  const engineParams = (p: Params) => scene.engineParams?.(p) ?? p;
  // About 600 samples over tMax: smooth enough for the graph, cheap to run twice.
  const opts = { tMax: b.tMax, sampleDt: b.tMax / 600 };
  const [ta, tb] = await Promise.all([
    runEngine(scene.engineId, engineParams(A), opts),
    runEngine(scene.engineId, engineParams(B), opts),
  ]);
  if (!ta.finished || !tb.finished) return { ok: false, reason: 'unfinished' };
  const runA: ConditionRun = { id: 'A', params: A, trace: ta, values: measureAll(scene, b, ta, A) };
  const runB: ConditionRun = { id: 'B', params: B, trace: tb, values: measureAll(scene, b, tb, B) };
  const ea = runA.values.find((v) => v.answer === poe.answer)?.engine ?? null;
  const eb = runB.values.find((v) => v.answer === poe.answer)?.engine ?? null;
  const ratio = ea !== null && eb !== null && Math.abs(ea) > 1e-12 ? eb / ea : null;
  return {
    ok: true,
    cmp: {
      A: runA,
      B: runB,
      poe,
      outcome: observe(scene, poe, A),
      ratio,
      graph: mergeOnTime(seriesOf(scene, b, ta, A), seriesOf(scene, b, tb, B)),
    },
  };
}

/** Inputs shown for a condition: the scenario's start values, the controls and g. */
function conditionInputs(
  scene: PhysicsScene,
  scenario: StudioScenario,
  b: PhysicsBinding,
  p: Params,
): EngineQuantity[] {
  const keys = [...new Set([...Object.keys(scenario.initial), ...b.controls])];
  if (scene.usesGravity) keys.push('g');
  return keys.flatMap((key) => {
    const def = scene.params.find((d) => d.key === key);
    const value = p[key];
    if (!def || value === undefined) return [];
    return [
      { id: key, label: def.label, unit: def.unit ?? '1', condition: '', value, check: null },
    ];
  });
}

/** Engine facts of a comparison as one evidence record (numbers only from the runs). */
export function toEvidence(
  scene: PhysicsScene,
  scenario: StudioScenario,
  cmp: PhysicsComparison,
  now: number,
): EngineEvidence | null {
  const b = scenario.binding;
  if (b.kind !== 'physics') return null;
  const quantities: EngineQuantity[] = [];
  for (const run of [cmp.A, cmp.B]) {
    for (const v of run.values) {
      if (v.engine === null) return null;
      quantities.push({
        id: v.answer,
        label: v.label,
        unit: v.unit,
        condition: run.id,
        value: v.engine,
        check: v.check,
      });
    }
  }
  const main = cmp.A.values.find((v) => v.answer === cmp.poe.answer);
  if (cmp.ratio !== null && main) {
    const o = cmp.outcome;
    quantities.push({
      id: `${cmp.poe.answer}.ratio`,
      label: {
        vi: translate('vi', 'studio.physics.ratioOf', { q: main.label.vi }),
        en: translate('en', 'studio.physics.ratioOf', { q: main.label.en }),
      },
      unit: '1',
      condition: 'B/A',
      value: cmp.ratio,
      check: o && Math.abs(o.before) > 1e-12 ? o.after / o.before : null,
    });
  }
  return {
    id: `engine:${scenario.id}`,
    key: 'comparison',
    at: now,
    step: 'interact',
    kind: 'engine',
    model: scene.engineId,
    title: scene.title,
    conditions: [cmp.A, cmp.B].map((run) => ({
      id: run.id,
      inputs: conditionInputs(scene, scenario, b, run.params).map((q) => ({
        ...q,
        condition: run.id,
      })),
    })),
    quantities,
  };
}

/** Compares the learner's choice with the computed one. */
export function verdictFor(
  outcome: PoeOutcome | null,
  prediction: Prediction | null,
  labelOf: (choice: number) => LocalizedText | null,
): Verdict {
  const correct = outcome && outcome.correct >= 0 ? outcome.correct : null;
  return {
    correct: correct === null ? null : String(correct),
    correctText: correct === null ? null : labelOf(correct),
    match: correct === null || !prediction ? null : prediction.choice === String(correct),
  };
}

/** Largest relative gap between an engine value and its analytic cross-check. */
export function maxCheckGap(quantities: readonly EngineQuantity[]): number | null {
  let worst: number | null = null;
  for (const q of quantities) {
    if (q.check === null) continue;
    const rel = Math.abs(q.value - q.check) / Math.max(Math.abs(q.check), 1e-12);
    worst = worst === null ? rel : Math.max(worst, rel);
  }
  return worst;
}
