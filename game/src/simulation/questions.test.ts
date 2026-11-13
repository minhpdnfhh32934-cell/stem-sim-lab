import { describe, expect, it } from 'vitest';
import rawFreeFall from '../content/experiments/free-fall.json';
import rawBank from '../content/questions/free-fall.json';
import rawTitration from '../content/experiments/acid-base-titration.json';
import { ExperimentDefinitionSchema } from './experiment';
import { BUILT_IN_MODELS } from './models';
import { checkQuestionSet, type QuestionSet, QuestionSetSchema } from './questions';

const freeFall = ExperimentDefinitionSchema.parse(rawFreeFall);
const titration = ExperimentDefinitionSchema.parse(rawTitration);
const modelOf = (id: string) => BUILT_IN_MODELS.find((m) => m.id === id)!;
const bank = QuestionSetSchema.parse(rawBank);

describe('a question bank (Phase Y-4)', () => {
  it('ships free fall’s: every level and both kinds, its numbers the model’s', () => {
    expect(bank.questions.length).toBeGreaterThanOrEqual(10);
    expect(new Set(bank.questions.map((q) => q.level))).toEqual(
      new Set(['recognise', 'understand', 'apply', 'analyse']),
    );
    expect(new Set(bank.questions.map((q) => q.type))).toEqual(new Set(['choice', 'true-false']));
    expect(checkQuestionSet(freeFall, modelOf(freeFall.model), bank)).toEqual([]);
  });

  it('refuses a right option the model says is wrong, and a statement marked against its check', () => {
    const wrong: QuestionSet = structuredClone(bank);
    const moon = wrong.questions.find((q) => q.id === 'moon-time');
    const earth = wrong.questions.find((q) => q.id === 'statements-earth');
    if (moon?.type !== 'choice' || earth?.type !== 'true-false') throw new Error('fixture');
    moon.options[0]!.correct = false;
    moon.options[1]!.correct = true; // h/g: the ½ and the root forgotten
    earth.statements[0]!.true = false;
    const problems = checkQuestionSet(freeFall, modelOf(freeFall.model), wrong).join('\n');
    expect(problems).toMatch(/"moon-time" option A is marked wrong, but its check says right/);
    expect(problems).toMatch(/"moon-time" option B is marked correct, but its check says wrong/);
    expect(problems).toMatch(
      /"statements-earth" statement a is marked false, but its check makes it true/,
    );
  });

  it('refuses options that read the same, placeholders naming nothing, inputs out of range', () => {
    const wrong: QuestionSet = structuredClone(bank);
    const moon = wrong.questions.find((q) => q.id === 'moon-time');
    if (moon?.type !== 'choice') throw new Error('fixture');
    moon.options[3]!.text = '{@fallTime} s'; // the same as A
    moon.options[3]!.check = undefined;
    moon.stem = 'A {mass} kg ball';
    moon.set = { height: 9, gravity: 1.62 };
    const problems = checkQuestionSet(freeFall, modelOf(freeFall.model), wrong).join('\n');
    expect(problems).toMatch(/"moon-time": two options read the same/);
    expect(problems).toMatch(/"\{mass\}" names no input or prediction/);
    expect(problems).toMatch(/sets "height" to 9, outside 0\.2 … 3/);
  });

  it('where the station hides an input, a question with numbers supposes its own value', () => {
    const question = {
      id: 'volume',
      type: 'choice' as const,
      level: 'apply' as const,
      skills: ['s'],
      set: {},
      stem: 'What volume of base reaches equivalence?',
      explain: 'V = c_a·V_a/c_b',
      options: ['{@equivalenceVolume} mL', '1 mL', '2 mL', '3 mL'].map((text, i) => ({
        text,
        correct: i === 0,
      })),
    };
    const set: QuestionSet = {
      id: 'acid-base-titration',
      skills: [{ id: 's', name: 's', advice: 'a' }],
      questions: [question],
    };
    const model = modelOf(titration.model);
    // The hidden acid's concentration would be given away by any number worked from it.
    expect(checkQuestionSet(titration, model, set).join('\n')).toMatch(
      /must set "acidConcentration"/,
    );
    question.set = { acidConcentration: 0.12 };
    expect(checkQuestionSet(titration, model, set)).toEqual([]);
  });

  it('needs twenty questions, four of every level, both kinds, known skills and one right option', () => {
    const broken = structuredClone(rawBank) as { questions: { level: string; skills: string[] }[] };
    broken.questions = broken.questions.slice(0, 19);
    for (const q of broken.questions) if (q.level === 'analyse') q.level = 'apply';
    broken.questions[0]!.skills = ['nowhere'];
    const result = QuestionSetSchema.safeParse(broken);
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message).join('\n') ?? '';
    expect(messages).toMatch(/at least 20|>=20/);
    expect(messages).toMatch(/0 "analyse" questions, fewer than 4/);
  });
});
