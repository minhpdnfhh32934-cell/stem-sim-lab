import { describe, expect, it } from 'vitest';
import { CATALOG } from '@/app/catalog';
import { CURRICULUM } from '@/app/curriculum';
import { hasModule } from '@/modules/registry';
import { validateScenario, type StudioScenario } from '../scenario';
import { builtInScenarios } from '../scenarios';
import { MAX_ACTIONS } from '../session';
import { knttLesson } from './card';
import { ANSWER_OP } from './check';
import { GUIDED_LESSONS, guidedScenarios } from './lessons';
import { guidedProblems, type GuidedBinding } from './schema';
import { GUIDED_TOPICS } from './topics';

const lessons = guidedScenarios();
const bindingOf = (s: StudioScenario) => s.binding as GuidedBinding;

/** Every `{ vi, en }` text inside a value. */
function texts(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) for (const v of value) texts(v, out);
  else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.vi === 'string' && typeof o.en === 'string') out.push(o.vi, o.en);
    else for (const v of Object.values(o)) texts(v, out);
  }
  return out;
}

describe('guided textbook lessons (SH10, HH11, SH11; #255)', () => {
  it('all thirty are valid guided lessons, pending a teacher, one per guided topic', () => {
    expect(GUIDED_LESSONS).toHaveLength(39);
    expect(lessons).toHaveLength(39);
    for (const s of lessons) {
      expect(s.binding.kind).toBe('guided');
      expect(s.review_status).toBe('pending');
    }
    expect(lessons.map((s) => s.topic).sort()).toEqual([...GUIDED_TOPICS].sort());
    expect(new Set(lessons.map((s) => s.id)).size).toBe(39);
  });

  it('each follows a theory lesson of the book, and its topic is placed on that lesson', () => {
    for (const s of lessons) {
      const { book, lesson } = bindingOf(s).kntt;
      const l = knttLesson({ book, lesson });
      expect(l, s.id).not.toBeNull();
      const entry = CURRICULUM.books
        .find((b) => b.id === book)
        ?.chapters.flatMap((c) => c.lessons)
        .find((x) => x.number === lesson);
      expect(entry?.kind, s.id).toBe('theory');
      expect(
        CURRICULUM.items.some(
          (p) => p.topic === s.topic && p.book === book && p.lessons.includes(lesson),
        ),
        s.topic,
      ).toBe(true);
    }
  });

  it('every topic is an available topic of its lesson’s subject, with its own module', () => {
    for (const s of lessons) {
      const topics = CATALOG[s.subject].flatMap((c) => c.topics);
      expect(hasModule(s.topic), s.topic).toBe(true);
      expect(topics.find((t) => t.id === s.topic)?.status, s.topic).toBe('available');
    }
    expect(lessons.filter((s) => s.subject === 'biology')).toHaveLength(28);
    expect(lessons.filter((s) => s.subject === 'chemistry').map((s) => s.topic)).toEqual([
      'organicSeparation',
      'soapDetergent',
      'monosaccharides',
      'disaccharides',
      'polysaccharides',
    ]);
  });

  it('stays out of the built-in scenarios (their lists and counts do not change)', () => {
    const ids = new Set(builtInScenarios().map((s) => s.id));
    expect(lessons.some((s) => ids.has(s.id))).toBe(false);
  });

  it('no lesson text holds a number: numbers come only from code', () => {
    for (const raw of GUIDED_LESSONS) {
      for (const text of texts(raw)) expect(text, text).not.toMatch(/[0-9]/);
    }
  });

  it('every possible answer fits one action, and a whole sheet fits the action log', () => {
    for (const s of lessons) {
      let rows = 0;
      for (const a of bindingOf(s).activities) {
        const ids = a.kind === 'match' ? a.pairs.map((p) => p.id) : a.items.map((i) => i.id);
        const values =
          a.kind === 'order'
            ? a.items.map((_, i) => String(i))
            : a.kind === 'match'
              ? a.pairs.map((p) => p.id)
              : a.groups.map((g) => g.id);
        rows += ids.length;
        for (const row of ids) {
          for (const value of values) {
            expect(`${a.id}:${row}=${value}`.length).toBeLessThanOrEqual(80);
          }
        }
      }
      expect(ANSWER_OP.length).toBeLessThanOrEqual(40);
      expect(rows, s.id).toBeLessThanOrEqual(MAX_ACTIONS);
    }
  });

  it('rejects broken copies', () => {
    const base = lessons[0];
    if (!base) throw new Error('no lesson');
    const b = bindingOf(base);
    const valid = (binding: unknown) => validateScenario({ ...base, binding }).ok;
    const first = b.choices[0];
    if (!first) throw new Error('no choice');
    expect(valid(b)).toBe(true);
    // Shape: ids, lesson number, at least one activity.
    expect(valid({ ...b, answer: 'an-id-that-is-far-too-long' })).toBe(false);
    expect(valid({ ...b, kntt: { book: 'SH10', lesson: 0 } })).toBe(false);
    expect(valid({ ...b, activities: [] })).toBe(false);
    // Meaning: each problem is named, and any problem makes the lesson invalid.
    expect(guidedProblems({ ...b, choices: [first, first] })).toContain('choices: duplicate id');
    expect(guidedProblems({ ...b, answer: 'nope' })).toContain('answer: not a choice');
    expect(valid({ ...b, answer: 'nope' })).toBe(false);
    const a0 = b.activities[0];
    if (!a0) throw new Error('no activity');
    expect(guidedProblems({ ...b, activities: [a0, a0] })).toContain('activities: duplicate id');

    const all = lessons.map(bindingOf).flatMap((x) => x.activities);
    const sort = all.find((a) => a.kind === 'sort');
    const match = all.find((a) => a.kind === 'match');
    if (sort?.kind !== 'sort' || match?.kind !== 'match') throw new Error('fixtures');
    const [item, ...rest] = sort.items;
    if (!item) throw new Error('no item');
    const at = (id: string) => `activities.${id}`;
    expect(
      guidedProblems({
        ...b,
        activities: [{ ...sort, items: [{ ...item, group: 'nope' }, ...rest] }],
      }),
    ).toContain(`${at(sort.id)}: unknown group`);
    const extra = { id: 'extra', label: { vi: 'Nhóm thừa', en: 'Extra group' } };
    expect(
      guidedProblems({ ...b, activities: [{ ...sort, groups: [...sort.groups, extra] }] }),
    ).toContain(`${at(sort.id)}: empty group`);
    const [p, q, ...others] = match.pairs;
    if (!p || !q) throw new Error('no pairs');
    expect(
      guidedProblems({
        ...b,
        activities: [{ ...match, pairs: [p, { ...q, right: p.right }, ...others] }],
      }),
    ).toContain(`${at(match.id)}: two identical right-hand texts`);
    // Equal texts would give two controls the same accessible name (one language is enough).
    expect(
      guidedProblems({
        ...b,
        activities: [{ ...match, pairs: [p, { ...q, left: { ...q.left, en: p.left.en } }] }],
      }),
    ).toContain(`${at(match.id)}: two identical left-hand texts`);
    const [i2] = rest;
    if (!i2) throw new Error('no second item');
    expect(
      guidedProblems({
        ...b,
        activities: [{ ...sort, items: [item, { ...i2, text: item.text }] }],
      }),
    ).toContain(`${at(sort.id)}: two identical item texts`);
    const [g0, g1, ...groups] = sort.groups;
    if (!g0 || !g1) throw new Error('no groups');
    expect(
      guidedProblems({
        ...b,
        activities: [
          { ...sort, groups: [g0, { ...g1, label: { ...g1.label, vi: g0.label.vi } }, ...groups] },
        ],
      }),
    ).toContain(`${at(sort.id)}: two identical group labels`);
    const order = all.find((a) => a.kind === 'order');
    if (order?.kind !== 'order') throw new Error('no order');
    const [o0, o1, ...os] = order.items;
    if (!o0 || !o1) throw new Error('no order items');
    expect(
      guidedProblems({
        ...b,
        activities: [{ ...order, items: [o0, { ...o1, text: o0.text }, ...os] }],
      }),
    ).toContain(`${at(order.id)}: two identical item texts`);
    expect(guidedProblems({ ...b, activities: [sort, match, order] })).toEqual([]);
    // Every lesson passes the same checks.
    for (const s of lessons) expect(guidedProblems(bindingOf(s)), s.id).toEqual([]);
  });
});
