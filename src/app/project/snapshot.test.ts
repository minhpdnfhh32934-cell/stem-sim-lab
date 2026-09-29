import { describe, expect, it } from 'vitest';
import { useLogistic } from '@/biology/ecology/store';
import { openModule, useModuleStore } from '@/modules/moduleStore';
import { parseSnapshot, restoreSnapshot, serializeSnapshot, takeSnapshot } from './snapshot';

describe('.stemsim snapshots', () => {
  it('rejects broken, foreign and unknown-topic files', () => {
    expect(parseSnapshot('{oops')).toEqual({ ok: false, error: 'json' });
    expect(parseSnapshot('{"format":"other"}')).toEqual({ ok: false, error: 'format' });
    const unknown = {
      format: 'stemsim',
      version: 1,
      app: 'x',
      savedAt: 'now',
      topicId: 'warpDrive',
    };
    expect(parseSnapshot(JSON.stringify(unknown))).toEqual({ ok: false, error: 'topic' });
  });

  it('round-trips a module topic: save, change, restore', async () => {
    await openModule('logisticGrowth');
    expect(useModuleStore.getState().active?.id).toBe('logisticGrowth');
    useLogistic.setState({ N0: 42, r: 1.25 });
    const snap = takeSnapshot();
    expect(snap?.topicId).toBe('logisticGrowth');
    expect(snap?.module?.state).toMatchObject({ N0: 42, r: 1.25 });

    const text = serializeSnapshot(snap!);
    useLogistic.setState({ N0: 7, r: 0.1 });
    const parsed = parseSnapshot(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) await restoreSnapshot(parsed.snapshot);
    expect(useLogistic.getState()).toMatchObject({ N0: 42, r: 1.25 });
  });

  it('ignores unknown or mistyped inputs in a module snapshot', async () => {
    const text = JSON.stringify({
      format: 'stemsim',
      version: 1,
      app: 'x',
      savedAt: 'now',
      topicId: 'logisticGrowth',
      module: { state: { N0: 'lots', K: 500, evil: true } },
    });
    const parsed = parseSnapshot(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) await restoreSnapshot(parsed.snapshot);
    expect(useLogistic.getState().K).toBe(500);
    expect(typeof useLogistic.getState().N0).toBe('number');
    expect(useLogistic.getState()).not.toHaveProperty('evil');
  });
});
