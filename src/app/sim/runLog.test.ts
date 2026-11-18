import { afterEach, describe, expect, it } from 'vitest';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { loadScene } from '@/physics/registry';
import { RUN_LOG_MAX, appendRun, runEntry, useRunLog, type RunEntry } from './runLog';
import { sim } from './runtime';
import { useSimStore } from './simStore';

const row = (n: number): RunEntry => ({
  at: n,
  changed: [{ key: 'v0', value: n }],
  answers: null,
  intervened: false,
});

afterEach(() => {
  sim.shutdown();
  useRunLog.setState({ rows: {} });
});

describe('Sổ ghi rows (#195 step 4)', () => {
  it("the answers are the lesson's own solve() for the run's parameters", async () => {
    const scene = await loadScene('obliqueProjectile');
    const params = { ...scene.defaults, g: 9.8, v0: 15 };
    const e = runEntry(scene, params, { v0: 'user', g: 'default' }, false, 'vi', 1);
    expect(e.answers).toEqual(scene.solve(params, 'vi').answers);
    // Only what the learner or the problem set is listed, with its SI value.
    expect(e.changed).toEqual([{ key: 'v0', value: 15 }]);
  });

  it('a run the mouse changed has no exact answers', async () => {
    const scene = await loadScene('obliqueProjectile');
    const e = runEntry(scene, { ...scene.defaults, g: 9.8 }, {}, true, 'vi', 1);
    expect(e).toMatchObject({ intervened: true, answers: null, changed: [] });
  });

  it('keeps the last RUN_LOG_MAX rows and skips a repeat of the last one', () => {
    let rows: RunEntry[] = [];
    for (let n = 1; n <= RUN_LOG_MAX + 5; n++) rows = appendRun(rows, row(n));
    expect(rows).toHaveLength(RUN_LOG_MAX);
    expect(rows[0]?.at).toBe(6);
    // A second pause of the same run (same inputs, later time) adds nothing.
    expect(appendRun(rows, { ...row(RUN_LOG_MAX + 5), at: 999 }).at(-1)?.at).toBe(RUN_LOG_MAX + 5);
    // Another run (a new value) is a new row.
    expect(appendRun(rows, row(999)).at(-1)?.at).toBe(999);
  });

  it('a run that stops adds a row for its lesson; leaving the run running adds none', async () => {
    await sim.open('obliqueProjectile', { params: { v0: 12 }, sources: { v0: 'user' } });
    const id = useSimStore.getState().scene?.id ?? '';
    useWorkspaceStore.setState({ speed: 1 });
    sim.togglePlay();
    for (let i = 0; i < 30; i++) sim.tick(1 / 60);
    expect(useRunLog.getState().rows[id] ?? []).toHaveLength(0);
    sim.togglePlay(); // pause
    const rows = useRunLog.getState().rows[id] ?? [];
    expect(rows).toHaveLength(1);
    const { scene, params } = useSimStore.getState();
    expect(rows[0]?.answers).toEqual(scene?.solve(params, 'vi').answers);
    expect(rows[0]?.changed).toContainEqual({ key: 'v0', value: 12 });
  });

  it('a run changed live (g mid-run) is logged as intervened, even when reset stops it', async () => {
    await sim.open('obliqueProjectile');
    const id = useSimStore.getState().scene?.id ?? '';
    useWorkspaceStore.setState({ speed: 1 });
    sim.togglePlay();
    for (let i = 0; i < 30; i++) sim.tick(1 / 60);
    sim.setParam('g', 20);
    for (let i = 0; i < 12; i++) sim.tick(1 / 60);
    sim.reset();
    const last = (useRunLog.getState().rows[id] ?? []).at(-1);
    expect(last).toMatchObject({ intervened: true, answers: null });
  });
});
