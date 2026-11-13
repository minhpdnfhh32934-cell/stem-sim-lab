import { describe, expect, it } from 'vitest';
import rawBank from '../content/questions/free-fall.json';
import { composePaper, gradePaper, type PaperItem, type PaperRequest } from './paper';
import { type QuestionSet, QuestionSetSchema } from './questions';

const freeFall = QuestionSetSchema.parse(rawBank);
// A second bank: the same questions under another experiment's id (only the drawing is tested).
const other: QuestionSet = { ...freeFall, id: 'other' };
const banks = new Map([
  ['free-fall', freeFall],
  ['other', other],
]);
const all: PaperRequest = {
  experiments: ['free-fall', 'other'],
  count: 10,
  types: ['choice', 'true-false'],
  levels: ['recognise', 'understand', 'apply', 'analyse'],
  seed: 7,
};
const question = (item: PaperItem) =>
  banks.get(item.experiment)!.questions.find((q) => q.id === item.question)!;

describe('a paper from the banks (composePaper)', () => {
  it('draws from every experiment in turn, choice questions first, the same for the same seed', () => {
    const paper = composePaper(banks, all);
    if (typeof paper === 'string') throw new Error(paper);
    expect(paper).toHaveLength(10);
    expect(paper.filter((i) => i.experiment === 'free-fall')).toHaveLength(5);
    const types = paper.map((i) => question(i).type);
    expect(types).toEqual([...types].sort()); // 'choice' < 'true-false': part I, then part II
    expect(new Set(paper.map((i) => `${i.experiment}/${i.question}`)).size).toBe(10);
    for (const item of paper) {
      expect([...item.order].sort()).toEqual(question(item).type === 'choice' ? [0, 1, 2, 3] : []);
    }
    expect(composePaper(banks, all)).toEqual(paper);
    expect(composePaper(banks, { ...all, seed: 8 })).not.toEqual(paper);
  });

  it('keeps to the kinds and levels asked for; fewer when the banks hold no more; none: why', () => {
    const hard = composePaper(banks, { ...all, levels: ['analyse'], count: 20 });
    if (typeof hard === 'string') throw new Error(hard);
    expect(hard.every((i) => question(i).level === 'analyse')).toBe(true);
    expect(hard).toHaveLength(10); // five analyse questions in each bank
    const statements = composePaper(banks, { ...all, types: ['true-false'] });
    if (typeof statements === 'string') throw new Error(statements);
    expect(statements.every((i) => question(i).type === 'true-false')).toBe(true);
    expect(composePaper(banks, { ...all, experiments: ['nowhere'] })).toMatch(/No question/);
  });
});

describe('marking a paper (gradePaper, THPT 2025)', () => {
  // The whole bank: 13 choice questions, then 7 true/false ones.
  const paper = composePaper(banks, { ...all, experiments: ['free-fall'], count: 20 });
  if (typeof paper === 'string') throw new Error(paper);
  // The right answer to each item, as printed.
  const right = paper.map((item) => {
    const q = question(item);
    return q.type === 'choice'
      ? item.order.findIndex((k) => q.options[k]!.correct)
      : q.statements.map((s) => s.true);
  });

  it('all right: 10; the choice questions 0.25 each, the true/false ones 1 each', () => {
    const grade = gradePaper(banks, paper, right);
    expect(paper.map((item) => question(item).type).filter((t) => t === 'choice')).toHaveLength(13);
    expect(grade.max).toBe(13 * 0.25 + 7 * 1);
    expect(grade.points).toBe(grade.max);
    expect(grade.score).toBe(10);
    expect(grade.skills.every((s) => s.right === s.total)).toBe(true);
  });

  it('a wrong option, blanks, and true/false statements right 3, 2, 1 and 0 of 4', () => {
    const answers = right.map((a, i) => {
      if (typeof a === 'number') return i === 0 ? (a + 1) % 4 : i === 1 ? null : a;
      const k = i - 13; // the first four true/false items: 3, 2, 1, 0 statements right
      return k > 3 ? a : a.map((t, j) => (j < 3 - k ? t : !t));
    });
    const grade = gradePaper(banks, paper, answers);
    expect(grade.items.map((it) => it.points)).toEqual([
      0,
      0,
      ...Array<number>(11).fill(0.25),
      0.5,
      0.25,
      0.1,
      0,
      1,
      1,
      1,
    ]);
    expect(grade.points).toBe(6.6);
    expect(grade.score).toBe(Math.round((1000 * 6.6) / 10.25) / 100);
    // A skill of a question not fully right is a gap.
    expect(grade.skills.some((s) => s.right < s.total)).toBe(true);
  });
});
