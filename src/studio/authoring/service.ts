import { translate } from '@/app/i18n';
import { openTextFile, saveFile, slugify } from '@/app/project/fileio';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { StudioScenario } from '../scenario';
import { builtInScenarios } from '../scenarios';
import { useStudioStore } from '../studioStore';
import { useAuthoringStore, type AuthoringState } from './authoringStore';
import { verifyScenario, type AuthorIssue } from './check';
import { duplicateOf, importId, scenarioId } from './collection';
import { draftIssues, fromDraft, type AuthorDraft } from './draft';
import {
  asTeacherContent,
  exportScenario,
  parseScenarioFile,
  SCENARIO_FILE_EXT,
} from './fileFormat';
import { MAX_AUTHORED, sizeIssues } from './limits';

/** Authoring actions: verify (schema + size + engines), then store. Nothing leaves the machine. */
export type SaveResult =
  { ok: true; scenario: StudioScenario } | { ok: false; issues: AuthorIssue[] };

function takenIds(except?: string): Set<string> {
  const ids = new Set<string>(builtInScenarios().map((s) => s.id));
  for (const s of useAuthoringStore.getState().scenarios) ids.add(s.id);
  if (except) ids.delete(except);
  return ids;
}

/** A new lesson (an id not stored yet) must fit under the lesson count cap. */
function roomFor(id: string): AuthorIssue[] {
  const list = useAuthoringStore.getState().scenarios;
  return list.length >= MAX_AUTHORED && !list.some((s) => s.id === id)
    ? [{ code: 'tooMany', params: { max: MAX_AUTHORED } }]
    : [];
}

/**
 * Applies one change to the stored list. localStorage can refuse the write (quota full, storage
 * blocked); zustand's persist has already changed memory by then, so the previous list is put
 * back and the teacher is told, rather than showing a lesson that is gone after a restart.
 */
function commit(change: (st: AuthoringState) => void): AuthorIssue[] {
  const before = useAuthoringStore.getState().scenarios;
  try {
    change(useAuthoringStore.getState());
    return [];
  } catch {
    try {
      useAuthoringStore.setState({ scenarios: before });
    } catch {
      // Memory is restored before the write is tried; storage still holds the last good list.
    }
    return [{ code: 'storageFull' }];
  }
}

/** Drops the learner session of a changed or deleted lesson (the lesson itself is already saved). */
function forgetSession(id: string): void {
  try {
    useStudioStore.getState().forget(id);
  } catch {
    // Memory is cleared before the write is tried, so this run starts over; only the stored copy
    // of the old session can come back after a restart.
  }
}

async function store(candidate: StudioScenario): Promise<SaveResult> {
  const blocked = [...roomFor(candidate.id), ...sizeIssues(candidate)];
  if (blocked.length > 0) return { ok: false, issues: blocked };
  const checked = await verifyScenario(candidate);
  if (!checked.ok) return checked;
  const scenario = asTeacherContent(checked.scenario);
  const failed = commit((st) => {
    st.put(scenario);
  });
  return failed.length > 0 ? { ok: false, issues: failed } : { ok: true, scenario };
}

export async function saveDraft(d: AuthorDraft): Promise<SaveResult> {
  const formIssues = draftIssues(d);
  if (formIssues.length > 0) return { ok: false, issues: formIssues };
  const id = d.id ?? scenarioId(d.base.subject, d.title.vi, takenIds());
  const r = await store(fromDraft(d, id));
  // An edited lesson starts over: an old session may hold inputs the new version does not have.
  if (r.ok) forgetSession(id);
  return r;
}

/** null = no stored lesson with this id. */
export function duplicateScenario(id: string): SaveResult | null {
  const source = useAuthoringStore.getState().scenarios.find((s) => s.id === id);
  if (!source) return null;
  const copy = duplicateOf(source, takenIds());
  const blocked = roomFor(copy.id);
  if (blocked.length > 0) return { ok: false, issues: blocked };
  const failed = commit((st) => {
    st.put(copy);
  });
  return failed.length > 0 ? { ok: false, issues: failed } : { ok: true, scenario: copy };
}

/** Empty = deleted. */
export function deleteScenario(id: string): AuthorIssue[] {
  const failed = commit((st) => {
    st.remove(id);
  });
  if (failed.length === 0) forgetSession(id);
  return failed;
}

export function previewScenario(s: StudioScenario): void {
  useStudioStore.getState().openScenario(s.subject, s.id);
}

export async function importScenarioText(text: string): Promise<SaveResult> {
  const parsed = parseScenarioFile(text);
  if (!parsed.ok) return parsed;
  return store({ ...parsed.scenario, id: importId(parsed.scenario, takenIds()) });
}

/** Native "Open" dialog in the desktop app, a file picker in the browser; null = cancelled. */
export async function importScenarioFile(): Promise<SaveResult | null> {
  const locale = useSettingsStore.getState().locale;
  let file: Awaited<ReturnType<typeof openTextFile>>;
  try {
    file = await openTextFile(translate(locale, 'studio.authoring.fileFilter'), [
      SCENARIO_FILE_EXT,
    ]);
  } catch {
    // The desktop app refuses unreadable files and files over its own open limit.
    return { ok: false, issues: [{ code: 'readFailed' }] };
  }
  return file ? importScenarioText(file.text) : null;
}

export async function exportScenarioFile(s: StudioScenario): Promise<string | null> {
  const locale = useSettingsStore.getState().locale;
  return saveFile({
    name: `${slugify(s.title.vi)}.${SCENARIO_FILE_EXT}`,
    filterName: translate(locale, 'studio.authoring.fileFilter'),
    extensions: [SCENARIO_FILE_EXT],
    contents: exportScenario(s),
  });
}
