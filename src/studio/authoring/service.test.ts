import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioScenario } from '../scenario';
import { physicsFreeFall } from '../scenarios/physicsFreeFall';
import { createSession } from '../session';
import { useStudioStore } from '../studioStore';
import { useAuthoringStore } from './authoringStore';
import { importId, migrateAuthored, scenarioId } from './collection';
import { newDraft, toDraft } from './draft';
import { asTeacherContent, exportScenario } from './fileFormat';
import { MAX_AUTHORED } from './limits';
import {
  deleteScenario,
  duplicateScenario,
  importScenarioText,
  previewScenario,
  saveDraft,
} from './service';

const teacherFall = (id = 'teacher.physics.roi'): StudioScenario =>
  asTeacherContent({ ...physicsFreeFall, id });

beforeEach(() => {
  useAuthoringStore.setState({ scenarios: [] });
  useStudioStore.setState({ tab: 'authoring', sessions: {}, picked: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Makes every localStorage write fail the way a full quota does. */
function fillStorage() {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('quota', 'QuotaExceededError');
  });
}

describe('scenario ids and stored records', () => {
  it('teacher ids never collide with built-in or existing ids', () => {
    const taken = new Set(['teacher.physics.roi-tu-do', physicsFreeFall.id]);
    expect(scenarioId('physics', 'Rơi tự do', taken)).toBe('teacher.physics.roi-tu-do-2');
    // A built-in id is never kept: the copy gets a teacher id from its title.
    expect(importId(physicsFreeFall, taken)).toBe(
      'teacher.physics.roi-tu-do-tha-tu-do-cao-gap-doi',
    );
    expect(importId(teacherFall('teacher.physics.x'), taken)).toBe('teacher.physics.x');
  });

  it('stored records are validated on load; broken, duplicate or non-teacher ones are dropped', () => {
    const good = teacherFall();
    expect(
      migrateAuthored({ scenarios: [good, good, { ...good, id: 'x' }, physicsFreeFall, 42] }),
    ).toEqual({ scenarios: [good] });
    expect(migrateAuthored(null)).toEqual({ scenarios: [] });
  });
});

describe('authoring service', () => {
  it('saves a complete draft under a new teacher id; an incomplete one is refused', async () => {
    const empty = newDraft('chemistry');
    if (!empty) throw new Error('template');
    const refused = await saveDraft(empty);
    expect(refused.ok).toBe(false);
    expect(useAuthoringStore.getState().scenarios).toEqual([]);

    const r = await saveDraft({
      ...empty,
      title: { vi: 'Thử ion clorua', en: '' },
      objectives: { vi: 'Nhận biết ion clorua', en: '' },
      expectedConclusion: { vi: 'Có kết tủa trắng.', en: '' },
      question: { vi: 'Có kết tủa không?', en: '' },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.scenario.id).toBe('teacher.chemistry.thu-ion-clorua');
    expect(r.scenario.title).toEqual({ vi: 'Thử ion clorua', en: 'Thử ion clorua' });
    expect([r.scenario.author, r.scenario.review_status]).toEqual(['teacher', 'pending']);
    expect(useAuthoringStore.getState().scenarios).toEqual([r.scenario]);
  });

  it('an engine problem blocks saving (start value out of the scene range)', async () => {
    const d = toDraft(physicsFreeFall, null);
    const r = await saveDraft({
      ...d,
      title: { vi: 'Rơi', en: '' },
      objectives: { vi: 'Đo', en: '' },
      expectedConclusion: { vi: 'Kết luận', en: '' },
      initial: { h0: 180, v0: 0 },
    });
    expect(!r.ok && r.issues.map((i) => i.code)).toEqual(['initialRange']);
  });

  it('editing keeps the id and restarts the learner session; delete removes both', async () => {
    const s = teacherFall();
    useAuthoringStore.getState().put(s);
    useStudioStore.setState({ sessions: { [s.id]: createSession(s, 1) } });
    const r = await saveDraft({ ...toDraft(s, s.id), title: { vi: 'Rơi tự do (sửa)', en: '' } });
    expect(r.ok && r.scenario.id).toBe(s.id);
    expect(useStudioStore.getState().sessions[s.id]).toBeUndefined();
    expect(useAuthoringStore.getState().scenarios).toHaveLength(1);

    const copy = duplicateScenario(s.id);
    const copyId = copy?.ok ? copy.scenario.id : null;
    expect(copyId).toBe('teacher.physics.roi-tu-do-sua-ban-sao');
    expect(useAuthoringStore.getState().scenarios).toHaveLength(2);
    expect(deleteScenario(s.id)).toEqual([]);
    expect(useAuthoringStore.getState().scenarios.map((x) => x.id)).toEqual([copyId]);
  });

  it('imports a valid file, refuses bad JSON and engine-inconsistent files', async () => {
    expect(await importScenarioText('not json')).toEqual({
      ok: false,
      issues: [{ code: 'badJson' }],
    });
    const outOfRange = exportScenario({ ...teacherFall(), initial: { h0: 500, v0: 0 } });
    const bad = await importScenarioText(outOfRange);
    expect(!bad.ok && bad.issues.map((i) => i.code)).toEqual(['initialRange']);
    expect(useAuthoringStore.getState().scenarios).toEqual([]);

    const ok = await importScenarioText(exportScenario(teacherFall()));
    expect(ok).toEqual({ ok: true, scenario: teacherFall() });
    // Importing the same file again never overwrites: the copy gets a new id.
    const again = await importScenarioText(exportScenario(teacherFall()));
    expect(again.ok && again.scenario.id).toBe('teacher.physics.roi-tu-do-tha-tu-do-cao-gap-doi');
    expect(useAuthoringStore.getState().scenarios).toHaveLength(2);
  });

  it('refuses a new lesson once the count cap is reached; editing a stored one still works', async () => {
    const stored = Array.from({ length: MAX_AUTHORED }, (_, i) =>
      teacherFall(`teacher.physics.n${String(i)}`),
    );
    useAuthoringStore.setState({ scenarios: stored });
    const r = await importScenarioText(exportScenario(teacherFall('teacher.physics.new')));
    expect(r).toEqual({ ok: false, issues: [{ code: 'tooMany', params: { max: MAX_AUTHORED } }] });
    expect(duplicateScenario('teacher.physics.n0')).toEqual(r);
    const first = stored[0];
    if (!first) throw new Error('stored');
    const edit = await saveDraft({ ...toDraft(first, first.id), title: { vi: 'Sửa', en: '' } });
    expect(edit.ok).toBe(true);
    expect(useAuthoringStore.getState().scenarios).toHaveLength(MAX_AUTHORED);
  });

  it('preview opens the scenario in its own studio tab', () => {
    const s = teacherFall();
    previewScenario(s);
    expect(useStudioStore.getState().tab).toBe('physics');
    expect(useStudioStore.getState().picked.physics).toBe(s.id);
  });
});

describe('storage failures', () => {
  it('a refused write keeps the previous list and reports storageFull', async () => {
    const s = teacherFall();
    useAuthoringStore.getState().put(s);
    fillStorage();
    const full = { ok: false, issues: [{ code: 'storageFull' }] };
    expect(await importScenarioText(exportScenario(teacherFall('teacher.physics.b')))).toEqual(
      full,
    );
    expect(await saveDraft({ ...toDraft(s, null), title: { vi: 'Bài mới', en: '' } })).toEqual(
      full,
    );
    expect(duplicateScenario(s.id)).toEqual(full);
    expect(deleteScenario(s.id)).toEqual(full.issues);
    expect(useAuthoringStore.getState().scenarios).toEqual([s]);
  });

  it('a stored lesson is still kept when only clearing its old session fails', async () => {
    const s = teacherFall();
    useAuthoringStore.getState().put(s);
    vi.spyOn(useStudioStore.getState(), 'forget').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const r = await saveDraft({ ...toDraft(s, s.id), title: { vi: 'Sửa', en: '' } });
    expect(r.ok).toBe(true);
    expect(useAuthoringStore.getState().scenarios[0]?.title.vi).toBe('Sửa');
  });
});
