import { z } from 'zod';
import { localized } from '../core/i18n';
import { IdSchema } from '../core/schema';
import type { ExperimentDefinition } from './experiment';
import { evaluate } from './expression';
import type { SimulationModel } from './SimulationModel';
import { agrees, fillExample, inputProblems } from './workedExample';

/**
 * How hard a question is, as Vietnamese exams grade them (Phase Y-4): recognition (Nhận biết),
 * comprehension (Thông hiểu), application (Vận dụng), advanced application (Vận dụng cao).
 */
export const QUESTION_LEVELS = ['recognise', 'understand', 'apply', 'analyse'] as const;
export type QuestionLevel = (typeof QUESTION_LEVELS)[number];
/** Multiple choice (four options, one right), or true/false (four statements a–d): THPT parts I, II. */
export const QUESTION_TYPES = ['choice', 'true-false'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Least questions an experiment's set holds (Phú, 2026-11-10: 20 per simulation, was 10). */
export const MIN_QUESTIONS = 20;
/** Least questions of each level, so every bank runs from the easiest to the hardest (Phú). */
export const MIN_PER_LEVEL = 4;

/**
 * A check of a number shown: `expr` (inputs by id, predictions as `@id`, `simulation/expression`)
 * against the model's prediction `equals`. An option or statement with one is right exactly when
 * they agree.
 */
const CheckSchema = z.strictObject({ expr: z.string().min(1), equals: z.string().min(1) });

/** A piece of knowledge the questions test, and how to study it when it is missed (pre-written). */
const SkillSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  advice: z.string().min(1),
  ...localized('name', 'advice'),
});

const OptionSchema = z.object({
  text: z.string().min(1),
  ...localized('text'),
  correct: z.boolean().default(false),
  check: CheckSchema.optional(),
});

const StatementSchema = z.object({
  text: z.string().min(1),
  ...localized('text'),
  true: z.boolean(),
  check: CheckSchema.optional(),
});

const base = {
  id: IdSchema,
  level: z.enum(QUESTION_LEVELS),
  /** The skills (of the set's `skills`) it tests: missed, they are the gaps a sheet names. */
  skills: z.array(IdSchema).min(1),
  /** Inputs it supposes (the rest at their defaults), as a worked example's `set`. */
  set: z.record(z.string(), z.number()).default({}),
  stem: z.string().min(1),
  /** Why the answer is right: shown when a paper is handed back. */
  explain: z.string().min(1),
  ...localized('stem', 'explain'),
};

const ChoiceQuestionSchema = z.object({
  ...base,
  type: z.literal('choice'),
  options: z.array(OptionSchema).length(4),
});

const TrueFalseQuestionSchema = z.object({
  ...base,
  type: z.literal('true-false'),
  statements: z.array(StatementSchema).length(4),
});

export const QuestionSchema = z.discriminatedUnion('type', [
  ChoiceQuestionSchema,
  TrueFalseQuestionSchema,
]);
export type Question = z.infer<typeof QuestionSchema>;

/**
 * An experiment's question bank (Phase Y-4, `content/questions/<experiment id>.json`): the skills
 * it tests, each with its study advice, and at least MIN_QUESTIONS questions of both types and
 * every level. Numbers in it are the model's: placeholders as in worked examples (`{id}`, `{@id}`,
 * `{=expr}`), and checks that make the right option right and each statement true or false.
 */
export const QuestionSetSchema = z
  .object({
    /** The experiment's id. */
    id: IdSchema,
    skills: z.array(SkillSchema).min(1),
    questions: z.array(QuestionSchema).min(MIN_QUESTIONS),
  })
  .superRefine((set, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    const skills = new Set(set.skills.map((s) => s.id));
    if (skills.size !== set.skills.length) issue(['skills'], 'duplicate skill id');
    const ids = new Set<string>();
    set.questions.forEach((q, i) => {
      if (ids.has(q.id)) issue(['questions', i, 'id'], `duplicate id "${q.id}"`);
      ids.add(q.id);
      for (const s of q.skills) {
        if (!skills.has(s)) issue(['questions', i, 'skills'], `unknown skill "${s}"`);
      }
      if (q.type === 'choice' && q.options.filter((o) => o.correct).length !== 1) {
        issue(['questions', i, 'options'], 'exactly one option is correct');
      }
    });
    for (const level of QUESTION_LEVELS) {
      const n = set.questions.filter((q) => q.level === level).length;
      if (n < MIN_PER_LEVEL)
        issue(['questions'], `${n} "${level}" questions, fewer than ${MIN_PER_LEVEL}`);
    }
    for (const type of QUESTION_TYPES) {
      if (!set.questions.some((q) => q.type === type))
        issue(['questions'], `no "${type}" question`);
    }
  });
export type QuestionSet = z.infer<typeof QuestionSetSchema>;

/** The texts of a question that are filled (its stem, explanation, options or statements). */
function textsOf(q: Question): (string | undefined)[] {
  const own = [q.stem, q.vi?.stem, q.explain, q.vi?.explain];
  const items = q.type === 'choice' ? q.options : q.statements;
  return [...own, ...items.flatMap((o) => [o.text, o.vi?.text])];
}

/** Whether a question shows the model's numbers (a placeholder or a check anywhere in it). */
function numeric(q: Question): boolean {
  const items = q.type === 'choice' ? q.options : q.statements;
  return (
    items.some((o) => o.check) || textsOf(q).some((t) => t !== undefined && /\{[=@A-Za-z_]/.test(t))
  );
}

/**
 * What is wrong with `set`, the bank of `definition` run by `model`, beyond its schema: inputs it
 * supposes out of range (or a hidden one not supposed), placeholders that name nothing, a right
 * option whose check does not agree with the model or a wrong one whose check does, a statement
 * whose truth is not what its check makes it, and options that read the same.
 */
export function checkQuestionSet(
  definition: ExperimentDefinition,
  model: SimulationModel,
  set: QuestionSet,
): string[] {
  const problems: string[] = [];
  for (const q of set.questions) {
    const where = `question "${q.id}"`;
    if (!numeric(q)) {
      problems.push(
        ...inputProblems(definition, q.set, where).filter((p) => !p.includes('must set')),
      );
      continue;
    }
    problems.push(...inputProblems(definition, q.set, where));
    const inputs: Record<string, number> = { ...definition.initialConditions };
    for (const p of definition.parameters) inputs[p.id] = p.default;
    Object.assign(inputs, q.set);
    let theory: Record<string, number> = {};
    try {
      theory = model.predict?.(inputs) ?? {};
    } catch (error) {
      problems.push(`${where}: the model refuses its inputs (${(error as Error).message})`);
      continue;
    }
    for (const text of textsOf(q)) {
      if (text === undefined) continue;
      try {
        fillExample(text, inputs, theory);
      } catch (error) {
        problems.push(`${where}: ${(error as Error).message}`);
      }
    }
    const value = (name: string) => (name.startsWith('@') ? theory[name.slice(1)] : inputs[name]);
    const holds = (check: { expr: string; equals: string }, label: string): boolean | null => {
      const expected = theory[check.equals.replace(/^@/, '')];
      if (expected === undefined) {
        problems.push(`${where} ${label} checks against "${check.equals}", not a prediction`);
        return null;
      }
      try {
        return agrees(evaluate(check.expr, value), expected);
      } catch (error) {
        problems.push(`${where} ${label}: ${(error as Error).message}`);
        return null;
      }
    };
    if (q.type === 'choice') {
      q.options.forEach((o, i) => {
        if (!o.check) return;
        const right = holds(o.check, `option ${'ABCD'[i]}`);
        if (right !== null && right !== o.correct) {
          problems.push(
            `${where} option ${'ABCD'[i]} is marked ${o.correct ? 'correct' : 'wrong'}, but its check says ${right ? 'right' : 'wrong'}`,
          );
        }
      });
      try {
        const shown = q.options.map((o) => fillExample(o.text, inputs, theory));
        if (new Set(shown).size !== shown.length)
          problems.push(`${where}: two options read the same`);
      } catch {
        // Reported above.
      }
    } else {
      q.statements.forEach((s, i) => {
        if (!s.check) return;
        const right = holds(s.check, `statement ${'abcd'[i]}`);
        if (right !== null && right !== s.true) {
          problems.push(
            `${where} statement ${'abcd'[i]} is marked ${s.true ? 'true' : 'false'}, but its check makes it ${right ? 'true' : 'false'}`,
          );
        }
      });
    }
  }
  return problems;
}
