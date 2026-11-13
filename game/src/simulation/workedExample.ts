import type { Texts } from '../core/i18n';
import type { ExperimentDefinition, WorkedExampleDefinition } from './experiment';
import { evaluate } from './expression';
import type { SimulationModel } from './SimulationModel';

/** Significant figures of a value worked out (a prediction, an expression) unless it says. */
const FIGURES = 3;
/** Of an input as set (it is shown as given). */
const INPUT_FIGURES = 4;
/** How near a step's check must come to the model's prediction (relative). */
const AGREE = 1e-6;
/** `{id}`, `{@id}` or `{=expr}`, each with an optional `|n` (significant figures). */
const PLACEHOLDER = /\{(=[^}|]+|@?[A-Za-z_][A-Za-z0-9_]*)(?:\|(\d))?\}/g;

/** A worked example as the teacher says it and writes it, in the current language. */
export interface WorkedExample {
  /** "Example 1 · Free fall" (the board's first line). */
  readonly title: string;
  readonly question: string;
  /** "Given: h = 2 m; g = 1.62 m/s²", "Find: t = ?; v = ?". */
  readonly given: string;
  readonly find: string;
  readonly steps: readonly { readonly say: string; readonly write: string | null }[];
  /** "Answer: t = 1.57 s; v = 2.55 m/s", and the same without its label (said). */
  readonly answer: string;
  readonly answerValues: string;
}

/** The model's inputs for `example` (or a question): initial conditions, parameters at their defaults, its own. */
export function exampleInputs(
  definition: ExperimentDefinition,
  example: Pick<WorkedExampleDefinition, 'set'>,
): Record<string, number> {
  const inputs: Record<string, number> = { ...definition.initialConditions };
  for (const p of definition.parameters) inputs[p.id] = p.default;
  return Object.assign(inputs, example.set);
}

/**
 * `value` to `n` significant figures, as a board shows it: ×10ⁿ outside 0.001 … 10⁶, and the
 * minus sign its formulas are written with (−, not -).
 */
export function figures(value: number, n: number): string {
  if (value === 0 || !Number.isFinite(value)) return String(value);
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1e-3 && abs < 1e6) return `${sign}${String(Number(abs.toPrecision(n)))}`;
  const [mantissa = '', exponent = '0'] = abs.toExponential(n - 1).split('e');
  return `${sign}${String(Number(mantissa))}×10${superscript(Number(exponent))}`;
}

/** A value with its unit: "2 m", "30°", "7" (no unit). */
export function withUnit(value: string, unit: string): string {
  if (unit === '') return value;
  return unit === '°' || unit.startsWith('°') || unit === '%'
    ? `${value}${unit}`
    : `${value} ${unit}`;
}

/**
 * `text` with its placeholders filled: `{id}` an input's value, `{@id}` a prediction's, `{=expr}`
 * an expression's; `|n` significant figures. A plain Error names one it cannot fill.
 */
export function fillExample(
  text: string,
  inputs: Readonly<Record<string, number>>,
  theory: Readonly<Record<string, number>>,
): string {
  const value = (name: string) => (name.startsWith('@') ? theory[name.slice(1)] : inputs[name]);
  return text.replace(PLACEHOLDER, (_whole, key: string, n?: string) => {
    if (key.startsWith('=')) {
      return figures(evaluate(key.slice(1), value), n ? Number(n) : FIGURES);
    }
    const found = value(key);
    if (found === undefined) throw new Error(`"{${key}}" names no input or prediction`);
    return figures(found, n ? Number(n) : key.startsWith('@') ? FIGURES : INPUT_FIGURES);
  });
}

/** The example worked out for the board and the teacher's words, in the current language. */
export function workExample(
  definition: ExperimentDefinition,
  model: SimulationModel,
  example: WorkedExampleDefinition,
  index: number,
  texts: Texts,
): WorkedExample {
  const inputs = exampleInputs(definition, example);
  const theory = model.predict?.(inputs) ?? {};
  const fill = (text: string) => fillExample(text, inputs, theory);
  const given = Object.entries(example.set)
    .map(([id, value]) => givenOf(definition, id, value, texts))
    .join('; ');
  const finds = example.find.map((f) => writtenAs(definition, f));
  const answerValues = example.find
    .map((f, i) => {
      const { symbol, unit } = finds[i] ?? { symbol: f.theory, unit: '' };
      return `${symbol} = ${withUnit(figures(theory[f.theory] ?? NaN, f.figures ?? FIGURES), unit)}`;
    })
    .join('; ');
  return {
    title: texts.ui('board.example', 'Example {n} · {experiment}', {
      n: index + 1,
      experiment: texts.of(definition, 'name'),
    }),
    question: fill(texts.of(example, 'question')),
    given: `${texts.ui('board.given', 'Given')}: ${given}`,
    find: `${texts.ui('board.find', 'Find')}: ${finds.map((f) => `${f.symbol} = ?`).join('; ')}`,
    steps: example.steps.map((step) => ({
      say: fill(texts.of(step, 'say')),
      write: step.write === undefined ? null : fill(step.write),
    })),
    answer: `${texts.ui('board.answer', 'Answer')}: ${answerValues}`,
    answerValues,
  };
}

/**
 * What is wrong with `example` of `definition` run by `model` (none: it can be worked): inputs it
 * sets that are not there or out of range, answers that are not predictions, placeholders that
 * name nothing, and steps whose check does not come to the model's prediction.
 */
export function checkExample(
  definition: ExperimentDefinition,
  model: SimulationModel,
  example: WorkedExampleDefinition,
): string[] {
  const where = `example "${example.id}"`;
  const problems = inputProblems(definition, example.set, where);
  if (!model.predict) return [...problems, `${where}: model "${model.id}" predicts nothing`];
  const inputs = exampleInputs(definition, example);
  let theory: Record<string, number>;
  try {
    theory = model.predict(inputs);
  } catch (error) {
    return [...problems, `${where}: the model refuses its inputs (${(error as Error).message})`];
  }
  for (const f of example.find) {
    if (!(model.predictions ?? []).includes(f.theory)) {
      problems.push(`${where} asks for "${f.theory}", not a prediction of the model`);
    } else if (!Number.isFinite(theory[f.theory])) {
      problems.push(`${where}: the model's "${f.theory}" is not a number here`);
    }
    if (!f.symbol && !definition.results.some((r) => r.theory === f.theory && r.symbol)) {
      problems.push(`${where}: "${f.theory}" needs a symbol (no result shows it)`);
    }
  }
  const texts = [
    example.question,
    example.vi?.question,
    ...example.steps.flatMap((s) => [s.say, s.vi?.say, s.write]),
  ];
  for (const text of texts) {
    if (text === undefined) continue;
    try {
      fillExample(text, inputs, theory);
    } catch (error) {
      problems.push(`${where}: ${(error as Error).message}`);
    }
  }
  const value = (name: string) => (name.startsWith('@') ? theory[name.slice(1)] : inputs[name]);
  for (const [i, step] of example.steps.entries()) {
    if (!step.check) continue;
    const key = step.check.equals.replace(/^@/, '');
    const expected = theory[key];
    if (expected === undefined) {
      problems.push(`${where} step ${i + 1} checks against "${key}", not a prediction`);
      continue;
    }
    try {
      const got = evaluate(step.check.expr, value);
      if (!agrees(got, expected)) {
        problems.push(
          `${where} step ${i + 1}: ${step.check.expr} = ${got}, the model's "${key}" is ${expected}`,
        );
      }
    } catch (error) {
      problems.push(`${where} step ${i + 1}: ${(error as Error).message}`);
    }
  }
  return problems;
}

/**
 * What is wrong with the inputs a worked example or a question sets (`where` names it): one that
 * is not an input of the experiment, a parameter outside its range — and, where the station hides
 * an input (the titration's acid), not setting it: every prediction is worked from all the inputs,
 * so a number shown from the hidden one would give it away. It must suppose its own value.
 */
export function inputProblems(
  definition: ExperimentDefinition,
  set: Readonly<Record<string, number>>,
  where: string,
): string[] {
  const problems: string[] = [];
  for (const [id, value] of Object.entries(set)) {
    const p = definition.parameters.find((q) => q.id === id);
    if (!p && !(id in definition.initialConditions)) {
      problems.push(`${where} sets "${id}", not an input of the experiment`);
    } else if (p && (value < p.min || value > p.max)) {
      problems.push(`${where} sets "${id}" to ${value}, outside ${p.min} … ${p.max}`);
    }
  }
  for (const [id, shown] of Object.entries(definition.inputs)) {
    if (shown.hidden && !(id in set)) {
      problems.push(
        `${where} must set "${id}" (a supposed value): the station hides it, and its numbers are worked from it`,
      );
    }
  }
  return problems;
}

/** Whether `got` comes to `expected` (relative 10⁻⁶): a check agrees with the model. */
export function agrees(got: number, expected: number): boolean {
  return Math.abs(got - expected) <= AGREE * Math.max(1e-12, Math.abs(expected));
}

/** How a found value is written: its symbol and unit (the example's, or the result's). */
function writtenAs(
  definition: ExperimentDefinition,
  find: WorkedExampleDefinition['find'][number],
): { symbol: string; unit: string } {
  const result = definition.results.find((r) => r.theory === find.theory);
  return {
    symbol: find.symbol ?? result?.symbol ?? find.theory,
    unit: find.unit ?? result?.unit ?? '',
  };
}

/** "h = 2 m", "Configuration: series" (a named value), from a parameter or an initial condition. */
function givenOf(
  definition: ExperimentDefinition,
  id: string,
  value: number,
  texts: Texts,
): string {
  const p = definition.parameters.find((q) => q.id === id);
  if (p) {
    const preset = p.presets.find((s) => Math.abs(s.value - value) < 1e-9);
    if (!p.symbol && preset) return `${texts.of(p, 'label')}: ${texts.of(preset, 'label')}`;
    return `${p.symbol ?? texts.of(p, 'label')} = ${withUnit(figures(value, INPUT_FIGURES), p.unit)}`;
  }
  const shown = definition.inputs[id];
  return `${shown?.symbol ?? id} = ${withUnit(figures(value, INPUT_FIGURES), shown?.unit ?? '')}`;
}

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
function superscript(n: number): string {
  const digits = String(Math.abs(n))
    .split('')
    .map((d) => SUPERSCRIPT[Number(d)] ?? d)
    .join('');
  return n < 0 ? `⁻${digits}` : digits;
}
