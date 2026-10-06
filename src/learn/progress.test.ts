import { describe, expect, it } from 'vitest';
import { CATALOG } from '@/app/catalog';
import { challengesFor } from './challenges';
import { chapterProgress, earnedBadges, topicProgress } from './progress';

const empty = { visited: {}, challenges: {}, predictions: {} };

describe('progress and badges', () => {
  it('a physics topic is complete after opening, predicting and every challenge', () => {
    expect(topicProgress('freeFall', empty)).toEqual({ done: 0, total: 3, complete: false });
    const p = {
      visited: { freeFall: true as const },
      predictions: { 'freeFall.h0': false },
      challenges: { 'freeFall.t2': 1 },
    };
    // A wrong prediction still counts: trying is what matters.
    expect(topicProgress('freeFall', p).complete).toBe(true);
    const kin = CATALOG.physics.find((c) => c.id === 'kinematics');
    expect(kin && chapterProgress(kin.topics, p)).toEqual({ done: 1, total: 5 });
  });

  it('topics without activities count "opened"', () => {
    expect(topicProgress('mitosis', { ...empty, visited: { mitosis: true } }).complete).toBe(true);
  });

  it('badges reward trying and finishing — no streaks or ranks', () => {
    expect(earnedBadges(empty)).toEqual([]);
    const ids = (p: Parameters<typeof earnedBadges>[0]) => earnedBadges(p).map((b) => b.id);
    expect(ids({ ...empty, visited: { freeFall: true } })).toEqual(['firstSteps']);
    const all = { freeFall: true, periodicTable: true, mitosis: true } as const;
    expect(ids({ ...empty, visited: all })).toContain('allSubjects');
    const kin = CATALOG.physics.find((c) => c.id === 'kinematics');
    const challenges = Object.fromEntries(
      (kin?.topics ?? []).flatMap((t) => challengesFor(t.id)).map((c) => [c.id, 1]),
    );
    expect(ids({ ...empty, challenges })).toEqual(['challenger', 'chapter.kinematics']);
  });
});
