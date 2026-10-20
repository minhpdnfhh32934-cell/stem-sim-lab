import { describe, expect, it } from 'vitest';
import { COMPONENTS, type ComponentId } from '@/biology/division/mitosis3d/components';
import { validateScenario } from '../scenario';
import { biologyMitosisMetaphase as scenario } from '../scenarios/biologyMitosisMetaphase';
import {
  ACTIVITY_KEY,
  blockerAt,
  createSession,
  engineEvidence,
  withPrediction,
  type StudioSession,
} from '../session';
import { withAnswer, withMatchCheck, withStageObservation } from './bioSession';
import { matchEvidence } from './evidence';
import { answersFromActions, answersToActions, scoreMatch, type Answers } from './match';
import { biologyOf, taskParts } from './model';

const b = biologyOf(scenario)!;
const tasks = taskParts(b);
const label = (s: string) => ({ vi: s, en: s });

function answerAll(s: StudioSession, pick: (task: ComponentId) => ComponentId): StudioSession {
  return tasks.reduce((acc, task, i) => withAnswer(acc, tasks, task, pick(task), 10 + i), s);
}

describe('find-the-part activity: scoring from the data', () => {
  it('an answer is right exactly when the picked part is the part the function belongs to', () => {
    const right = Object.fromEntries(tasks.map((t) => [t, t]));
    expect(scoreMatch(tasks, right)).toMatchObject({ correct: tasks.length, complete: true });
    // Swap two answers: exactly those two are wrong.
    const [a, c] = tasks as [ComponentId, ComponentId];
    const swapped = { ...right, [a]: c, [c]: a };
    const s = scoreMatch(tasks, swapped);
    expect(s.correct).toBe(tasks.length - 2);
    expect(s.results.filter((r) => !r.correct).map((r) => r.task)).toEqual([a, c]);
    expect(scoreMatch(tasks, { [a]: a })).toMatchObject({ correct: 1, complete: false });
  });

  it('the answer sheet survives the action log; unknown parts and tasks are ignored', () => {
    const answers = { membrane: 'nucleus', spindle: 'spindle' } as const;
    const log = answersToActions(answers, tasks, 5);
    expect(answersFromActions(log, tasks)).toEqual(answers);
    const junk = [
      ...log,
      { op: 'answer', arg: 'flagellum=membrane', at: 6 },
      { op: 'answer', arg: 'cellWall=membrane', at: 6 },
      { op: 'answer', arg: 'membrane=tail', at: 6 },
      { op: 'other', arg: 'membrane=membrane', at: 6 },
    ];
    expect(answersFromActions(junk, tasks)).toEqual(answers);
  });

  it('the stored check copies names and functions from COMPONENTS and holds no number', () => {
    const answers: Answers = {
      ...Object.fromEntries(tasks.map((t) => [t, t])),
      membrane: 'spindle',
    };
    const rec = matchEvidence(tasks, answers, 1);
    expect(rec.key).toBe(ACTIVITY_KEY);
    expect(rec.quantities).toEqual([]);
    expect(rec.facts?.map((f) => f.id)).toEqual(tasks);
    for (const f of rec.facts ?? []) {
      const info = COMPONENTS[f.id as ComponentId];
      expect(f.label).toEqual(info.name);
      expect(f.text.vi).toContain(info.role.vi);
      expect(f.text.en).toContain(info.role.en);
      expect(f.text.vi).not.toMatch(/\d/);
    }
    const membrane = rec.facts?.find((f) => f.id === 'membrane');
    expect(membrane?.text.vi).toMatch(/^Chưa đúng\. Em chọn: Thoi phân bào\./);
  });
});

describe('biology session flow', () => {
  it('the activity blocks the interact step until a complete sheet is checked', () => {
    expect(validateScenario(scenario).ok).toBe(true);
    let s = withPrediction(createSession(scenario, 0), { choice: 'metaphase', label: 'm', at: 1 });
    s = withStageObservation(s, b, 'metaphase', 2, label);
    expect(s.verdict).toMatchObject({ correct: 'metaphase', match: true });
    expect(blockerAt(scenario, s, 'interact')).toBe('activity');

    // An incomplete sheet cannot be checked.
    s = withAnswer(s, tasks, 'membrane', 'membrane', 3);
    expect(withMatchCheck(s, tasks, 4)).toBe(s);

    s = answerAll(s, (t) => t);
    s = withMatchCheck(s, tasks, 20);
    expect(blockerAt(scenario, s, 'interact')).toBeNull();

    // Changing an answer makes the check stale: it is dropped and must be redone.
    s = withAnswer(s, tasks, 'nucleus', 'nucleolus', 21);
    expect(engineEvidence(s).some((e) => e.key === ACTIVITY_KEY)).toBe(false);
    expect(blockerAt(scenario, s, 'interact')).toBe('activity');
    s = withMatchCheck(s, tasks, 22);
    const check = engineEvidence(s).find((e) => e.key === ACTIVITY_KEY);
    expect(check?.facts?.find((f) => f.id === 'nucleus')?.text.vi).toMatch(/^Chưa đúng/);
    // The stage verdict is untouched by the activity.
    expect(s.verdict).toMatchObject({ correct: 'metaphase', match: true });
  });

  it('only the stage the model singles out sets the verdict; other stages are kept as evidence', () => {
    let s = withPrediction(createSession(scenario, 0), { choice: 'anaphase', label: 'a', at: 1 });
    s = withStageObservation(s, b, 'anaphase', 2, label);
    expect(s.verdict).toBeNull();
    expect(s.predictionLocked).toBe(true);
    const anaphase = engineEvidence(s).find((e) => e.key === 'stage:anaphase');
    expect(anaphase?.quantities.find((q) => q.id === 'onPlane')?.value).toBe(0);
    s = withStageObservation(s, b, 'metaphase', 3, label);
    expect(s.verdict).toMatchObject({ correct: 'metaphase', match: false });
    const metaphase = engineEvidence(s).find((e) => e.key === 'stage:metaphase');
    const q = Object.fromEntries(metaphase!.quantities.map((x) => [x.id, x.value]));
    expect(q).toEqual({ chromosomes: 4, double: 4, onPlane: 4 });
    // The record describes the lesson's own cell, whatever the shared view was set to.
    expect(metaphase?.conditions[0]?.inputs[0]?.value).toBe(2 * b.pairs);
    expect(metaphase?.facts?.find((f) => f.id === 'cell')?.text.en).toBe('Animal cell');
    // Prediction locked after the first observation (POE order).
    expect(withPrediction(s, { choice: 'metaphase', label: 'm', at: 4 })).toBe(s);
  });
});
