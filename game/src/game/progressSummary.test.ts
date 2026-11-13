import { describe, expect, it } from 'vitest';
import { progressSummary } from './progressSummary';
import { bootTestGame } from './testing';

describe('the hub progress board’s summary (from the save alone)', () => {
  it('a new game: nothing done, the first topic’s first experiment next', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    await game.loadLab();
    const s = progressSummary(game.content, game.state.progression);
    expect(s.subjects.map((x) => [x.subject, x.done])).toEqual([
      ['physics', 0],
      ['chemistry', 0],
      ['biology', 0],
    ]);
    expect(s.subjects.reduce((n, x) => n + x.total, 0)).toBe(s.experiments.total);
    expect(s.experiments.total).toBe(game.content.experiments.all().length);
    expect([s.topicsDone, s.topicsStarted, s.marks, s.papers, s.average, s.best]).toEqual([
      [],
      0,
      [],
      0,
      null,
      null,
    ]);
    const first = game.content.topics.all()[0]!;
    expect(s.next?.topic.id).toBe(first.id);
    expect(s.next?.experiment.id).toBe(first.experiments[0]);
    game.dispose();
  });

  it('counts experiments by subject, topics done or started, marks and tasks; the next one on', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    await game.loadLab();
    const kinematics = game.content.topics.get('kinematics');
    const p = game.state.progression;
    p.completedExperiments.push(...kinematics.experiments, 'titration-unknown-id', 'osmosis');
    p.scores.push(
      ...[6, 7.5, 9, 4, 8, 10, 5, 6, 7, 8, 9].map((score, i) => ({
        paper: i + 1,
        experiments: ['free-fall'],
        points: score,
        max: 10,
        score,
      })),
    );
    const task = game.content.tasks.all()[0]!;
    p.tasks.done.push(task.id, 'no-such-task');
    const s = progressSummary(game.content, p);
    const physics = kinematics.experiments.length;
    expect(s.subjects.map((x) => [x.subject, x.done])).toEqual([
      ['physics', physics],
      ['chemistry', 0],
      ['biology', 1],
    ]);
    expect(s.experiments.done).toBe(physics + 1); // an id no experiment has is not counted
    expect(s.topicsDone.map((t) => t.id)).toContain('kinematics');
    expect(s.topicsStarted).toBeGreaterThanOrEqual(s.topicsDone.length + 1); // osmosis's topic
    expect(s.marks).toEqual([7.5, 9, 4, 8, 10, 5, 6, 7, 8, 9]); // the latest ten, oldest first
    expect(s.papers).toBe(11);
    expect(s.average).toBeCloseTo(79.5 / 11, 10);
    expect(s.best).toBe(10);
    expect(s.tasks).toEqual({ done: 1, total: game.content.tasks.all().length });
    expect(kinematics.experiments).not.toContain(s.next?.experiment.id);
    game.dispose();
  });
});
