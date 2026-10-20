import { describe, expect, it } from 'vitest';
import { useNavigationStore, type AppScreen } from '@/app/navigationStore';
import { useLogistic } from '@/biology/ecology/store';
import { openModule, useModuleStore } from '@/modules/moduleStore';
import { openTeacher, useTeacherStore } from '@/teacher/teacherStore';
import { openProjectText } from './actions';
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

  it.each<AppScreen>(['home', 'studio', 'teacher'])(
    'opening a project from the %s screen shows it in the lab',
    async (screen) => {
      if (screen === 'teacher') openTeacher();
      else useNavigationStore.getState().setScreen(screen);
      const text = JSON.stringify({
        format: 'stemsim',
        version: 1,
        app: 'x',
        savedAt: 'now',
        topicId: 'logisticGrowth',
        module: { state: { N0: 33 } },
      });
      expect(await openProjectText(text, 'p.stemsim')).toBe(true);
      expect(useNavigationStore.getState().screen).toBe('lab');
      expect(useTeacherStore.getState().open).toBe(false);
      expect(useModuleStore.getState().active?.id).toBe('logisticGrowth');
      expect(useLogistic.getState().N0).toBe(33);
    },
  );
});
