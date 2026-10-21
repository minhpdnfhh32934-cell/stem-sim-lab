import { describe, expect, it } from 'vitest';
import { poeFor } from '@/learn/poe';
import { lessonForPoe, lessonsForTopic } from './lessons';
import type { StudioScenario } from './scenario';
import { builtInScenarios } from './scenarios';

const ids = (list: StudioScenario[]) => list.map((s) => s.id);

describe('lab view of the Science Studio lessons', () => {
  it('each built-in lesson is found under its own catalog topic only', () => {
    expect(ids(lessonsForTopic('freeFall', []))).toEqual(['physics.free-fall-height']);
    expect(ids(lessonsForTopic('reactionLibrary', []))).toEqual([
      'chemistry.chloride-silver-nitrate',
    ]);
    expect(ids(lessonsForTopic('mitosis', []))).toEqual(['biology.mitosis-equator']);
    // Every built-in lesson appears exactly once over its topics (no copy, none lost).
    const topics = [...new Set(builtInScenarios().map((s) => s.topic))];
    const found = topics.flatMap((t) => ids(lessonsForTopic(t, [])));
    expect(found.sort()).toEqual(ids(builtInScenarios()).sort());
  });

  it('a topic without a lesson, or no topic, has none', () => {
    expect(lessonsForTopic('horizontalProjectile', [])).toEqual([]);
    expect(lessonsForTopic('periodicTable', [])).toEqual([]);
    expect(lessonsForTopic(null, [])).toEqual([]);
  });

  it("a teacher's lesson follows the built-in ones of the same topic", () => {
    const base = builtInScenarios().find((s) => s.topic === 'reactionLibrary');
    if (!base) throw new Error('missing chemistry lesson');
    const mine = { ...base, id: 'teacher.my-lesson', author: 'teacher' as const };
    expect(ids(lessonsForTopic('reactionLibrary', [mine]))).toEqual([
      'chemistry.chloride-silver-nitrate',
      'teacher.my-lesson',
    ]);
    expect(lessonsForTopic('freeFall', [mine]).map((s) => s.id)).not.toContain('teacher.my-lesson');
  });

  it('the lab POE a lesson runs is matched by binding.poe, never by name', () => {
    const lessons = lessonsForTopic('freeFall', []);
    const poe = poeFor('freeFall');
    expect(poe?.id).toBe('freeFall.h0');
    expect(lessonForPoe(poe?.id, lessons)?.id).toBe('physics.free-fall-height');
    // Another topic's POE, an unknown id or no POE: no lesson.
    expect(lessonForPoe(poeFor('horizontalProjectile')?.id, lessons)).toBeNull();
    expect(lessonForPoe('freeFall.unknown', lessons)).toBeNull();
    expect(lessonForPoe(undefined, lessons)).toBeNull();
    // Chemistry and biology lessons hold no lab POE.
    expect(lessonForPoe('freeFall.h0', lessonsForTopic('reactionLibrary', []))).toBeNull();
  });
});
