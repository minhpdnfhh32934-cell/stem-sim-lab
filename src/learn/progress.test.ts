import { describe, expect, it } from 'vitest';
import { CATALOG } from '@/app/catalog';
import { challengesFor } from './challenges';
import { chapterProgress, earnedBadges, topicProgress, topicStatus } from './progress';

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

  it('opening a topic marks it learned in every subject; "complete" needs every activity', () => {
    const visited = { freeFall: true, periodicTable: true, mitosis: true } as const;
    for (const topic of ['periodicTable', 'mitosis'])
      expect(topicStatus(topic, { ...empty, visited })).toMatchObject({
        state: 'opened',
        predictLeft: false,
        challengesLeft: 0,
      });
    expect(topicStatus('freeFall', empty).state).toBe('new');
    // Opened only: 1 of 3 steps, the prediction and one challenge left.
    expect(topicStatus('freeFall', { ...empty, visited })).toEqual({
      done: 1,
      total: 3,
      complete: false,
      state: 'opened',
      predictLeft: true,
      challengesLeft: 1,
    });
    const all = { visited, predictions: { 'freeFall.h0': true }, challenges: { 'freeFall.t2': 1 } };
    expect(topicStatus('freeFall', all)).toMatchObject({
      state: 'complete',
      predictLeft: false,
      challengesLeft: 0,
    });
  });

  it('a prediction made in Science Studio does not mark an unopened topic learned', () => {
    // The studio records freeFall.h0 without opening the lab topic (PhysicsSteps).
    const p = { ...empty, predictions: { 'freeFall.h0': true } };
    expect(topicStatus('freeFall', p).state).toBe('new');
    const kin = CATALOG.physics.find((c) => c.id === 'kinematics');
    expect(kin && chapterProgress(kin.topics, p)).toEqual({ done: 0, total: 5 });
  });

  it('a chapter counts its opened topics', () => {
    const kin = CATALOG.physics.find((c) => c.id === 'kinematics');
    const p = { ...empty, visited: { freeFall: true, horizontalProjectile: true } as const };
    expect(kin && chapterProgress(kin.topics, p)).toEqual({ done: 2, total: 5 });
    expect(kin && chapterProgress(kin.topics, empty)).toEqual({ done: 0, total: 5 });
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
