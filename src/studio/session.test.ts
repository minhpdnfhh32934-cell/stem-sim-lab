import { describe, expect, it } from 'vitest';
import { physicsFreeFall as sc } from './scenarios/physicsFreeFall';
import {
  blockerAt,
  createSession,
  engineEvidence,
  firstBlocked,
  goTo,
  learnerText,
  markComplete,
  MAX_NOTE,
  migrateStudio,
  MAX_ACTIONS,
  SessionSchema,
  withActions,
  withAiText,
  withEngine,
  withInputs,
  withLearnerText,
  withPrediction,
  type EngineEvidence,
} from './session';
import { useStudioStore } from './studioStore';

const engineRec = (at: number): EngineEvidence => ({
  id: 'engine:x',
  key: 'comparison',
  at,
  step: 'interact',
  kind: 'engine',
  model: 'phys.projectile',
  title: { vi: 'Rơi', en: 'Fall' },
  conditions: [],
  quantities: [
    {
      id: 'time_of_flight',
      label: { vi: 't', en: 't' },
      unit: 's',
      condition: 'A',
      value: 3,
      check: 3,
    },
  ],
});
const verdict = { correct: '1', correctLabel: '√2', match: true };

describe('studio session (pure)', () => {
  it('an engine record without a verdict does not unlock the next step', () => {
    let s = goTo(
      sc,
      withPrediction(createSession(sc, 1), { choice: '1', label: '√2', at: 2 }),
      'interact',
    );
    s = withEngine(s, engineRec(3), null);
    expect(blockerAt(sc, s, 'interact')).toBe('observation');
    s = withEngine(s, engineRec(4), verdict);
    expect(blockerAt(sc, s, 'interact')).toBeNull();
    // A later run that does not answer the prediction keeps the earlier verdict.
    expect(withEngine(s, { ...engineRec(5), key: 'other' }, s.verdict).verdict).toEqual(verdict);
  });

  it('keeps the subject operation log, capped, and old sessions without one still load', () => {
    const s = createSession(sc, 1);
    expect(s.actions).toEqual([]);
    const many = Array.from({ length: MAX_ACTIONS + 5 }, (_, i) => ({
      op: 'add',
      arg: 'x',
      at: i,
    }));
    const capped = withActions(s, many, 9);
    expect(capped.actions).toHaveLength(MAX_ACTIONS);
    expect(capped.actions[0]?.at).toBe(5);
    const old: Partial<typeof s> = { ...s };
    delete old.actions;
    expect(SessionSchema.parse(old).actions).toEqual([]);
  });

  it('walks the POE flow only when each step is satisfied', () => {
    let s = createSession(sc, 1);
    expect(s.step).toBe('predict');
    expect(s.inputs).toEqual(sc.initial);
    expect(blockerAt(sc, s, 'predict')).toBe('prediction');
    expect(goTo(sc, s, 'interact')).toBe(s);

    s = withPrediction(s, { choice: '1', label: '√2', at: 2 });
    s = goTo(sc, s, 'interact');
    expect(s.step).toBe('interact');
    expect(blockerAt(sc, s, 'interact')).toBe('observation');
    expect(goTo(sc, s, 'observe').step).toBe('interact');

    s = goTo(sc, withEngine(s, engineRec(3), verdict), 'observe');
    expect(s.step).toBe('observe');
    s = goTo(sc, s, 'explain');
    expect(blockerAt(sc, s, 'explain')).toBe('explanation');
    s = withLearnerText(s, 'explanation', 'Thời gian tăng chậm hơn độ cao.', 4);
    s = goTo(sc, goTo(sc, s, 'conclude'), 'conclude');
    expect(blockerAt(sc, s, 'conclude')).toBe('conclusion');
    expect(markComplete(sc, s, 5).completedAt).toBeNull();
    s = withLearnerText(s, 'conclusion', 'Tăng √2 lần.', 5);
    expect(firstBlocked(sc, s)).toBeNull();
    expect(markComplete(sc, goTo(sc, s, 'report'), 6)).toMatchObject({
      step: 'report',
      completedAt: 6,
    });
  });

  it('locks the prediction once the engine has observed', () => {
    let s = withPrediction(createSession(sc, 1), { choice: '0', label: 'x', at: 2 });
    s = withEngine(s, engineRec(3), verdict);
    expect(withPrediction(s, { choice: '2', label: 'y', at: 4 })).toBe(s);
  });

  it('new inputs drop stale engine facts and the verdict, keeping the learner notes', () => {
    let s = withPrediction(createSession(sc, 1), { choice: '1', label: 'x', at: 2 });
    s = goTo(sc, withEngine(s, engineRec(3), verdict), 'observe');
    s = withLearnerText(s, 'note', 'ghi chú', 4);
    expect(withInputs(s, { ...s.inputs }, 5)).toBe(s);
    const changed = withInputs(s, { ...s.inputs, h0: 20 }, 5);
    expect(engineEvidence(changed)).toHaveLength(0);
    expect(changed.verdict).toBeNull();
    expect(changed.step).toBe('interact');
    expect(learnerText(changed, 'note')).toBe('ghi chú');
    expect(withPrediction(changed, { choice: '3', label: 'z', at: 6 })).toBe(changed);
  });

  it('keeps engine facts, learner text and AI text apart; replaces by key/role', () => {
    let s = createSession(sc, 1);
    s = withEngine(s, engineRec(2), verdict);
    s = withEngine(s, engineRec(3), verdict);
    s = withLearnerText(s, 'explanation', 'a', 4);
    s = withLearnerText(s, 'explanation', 'b'.repeat(MAX_NOTE + 50), 5);
    s = withAiText(s, 'gemma', 'Lời giải thích của AI', 6);
    expect(s.evidence.map((e) => e.kind)).toEqual(['engine', 'learner', 'ai']);
    expect(engineEvidence(s)[0]?.at).toBe(3);
    expect(learnerText(s, 'explanation')).toHaveLength(MAX_NOTE);
    expect(withLearnerText(s, 'explanation', '', 7).evidence.map((e) => e.kind)).toEqual([
      'engine',
      'ai',
    ]);
  });
});

describe('studio persistence', () => {
  it('migrates v0 (array of sessions, no tab) and drops broken records', () => {
    const good = createSession(sc, 1);
    const out = migrateStudio({ sessions: [good, { scenarioId: 'x', step: 'fly' }] }, 0);
    expect(out.tab).toBe('physics');
    expect(Object.keys(out.sessions)).toEqual([sc.id]);
    expect(migrateStudio('garbage', 0)).toEqual({ tab: 'physics', sessions: {}, picked: {} });
    expect(migrateStudio({ tab: 'biology', sessions: { [sc.id]: good } }, 1).tab).toBe('biology');
    expect(migrateStudio({ tab: 'nope' }, 1).tab).toBe('physics');
  });

  it('rehydrates stemsim.studio through the store, old version and damaged data alike', async () => {
    const good = createSession(sc, 1);
    localStorage.setItem(
      'stemsim.studio',
      JSON.stringify({ state: { sessions: [good] }, version: 0 }),
    );
    await useStudioStore.persist.rehydrate();
    expect(useStudioStore.getState().sessions[sc.id]?.scenarioId).toBe(sc.id);

    localStorage.setItem(
      'stemsim.studio',
      JSON.stringify({ state: { tab: 'chemistry', sessions: { a: { bad: true } } }, version: 1 }),
    );
    await useStudioStore.persist.rehydrate();
    expect(useStudioStore.getState().tab).toBe('chemistry');
    expect(useStudioStore.getState().sessions).toEqual({});
  });

  it('resumes after a reload: the session, its step and evidence, and the lesson shown', async () => {
    useStudioStore.setState({ sessions: {}, picked: {} });
    const store = useStudioStore.getState();
    store.openScenario('physics', sc.id);
    store.update(sc, (s) => withPrediction(s, { choice: '1', label: '√2', at: 2 }));
    store.update(sc, (s) => withEngine(s, engineRec(3), verdict));
    store.update(sc, (s) =>
      withLearnerText(s, 'explanation', 'Vì t tỉ lệ với căn bậc hai của h', 4),
    );
    store.update(sc, (s) => goTo(sc, s, 'explain'));
    const before = useStudioStore.getState().sessions[sc.id];
    expect(before?.step).toBe('explain');

    // A reload: memory is gone, only localStorage remains (setState also writes, so put it back).
    const saved = localStorage.getItem('stemsim.studio');
    useStudioStore.setState({ sessions: {}, picked: {}, tab: 'chemistry' });
    if (saved !== null) localStorage.setItem('stemsim.studio', saved);
    await useStudioStore.persist.rehydrate();

    const after = useStudioStore.getState();
    expect(after.sessions[sc.id]).toEqual(before);
    expect(after.picked.physics).toBe(sc.id);
    expect(after.tab).toBe('physics');

    // A damaged lesson choice is dropped; the sessions are kept.
    localStorage.setItem(
      'stemsim.studio',
      JSON.stringify({
        state: { tab: 'physics', sessions: { [sc.id]: before }, picked: { physics: 5 } },
        version: 1,
      }),
    );
    await useStudioStore.persist.rehydrate();
    expect(useStudioStore.getState().picked).toEqual({});
    expect(useStudioStore.getState().sessions[sc.id]).toEqual(before);
  });

  it('update() starts a session on first use and restart() resets it', () => {
    useStudioStore.setState({ sessions: {} });
    useStudioStore.getState().update(sc, (s) => withLearnerText(s, 'note', 'n', 2));
    const stored = useStudioStore.getState().sessions[sc.id] ?? createSession(sc, 0);
    expect(learnerText(stored, 'note')).toBe('n');
    useStudioStore.getState().restart(sc);
    expect(useStudioStore.getState().sessions[sc.id]?.evidence).toEqual([]);
  });
});
