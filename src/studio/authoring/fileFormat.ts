import { validateScenario, type StudioScenario } from '../scenario';
import type { AuthorIssue } from './check';
import { MAX_FILE_CHARS, MAX_FILE_KB } from './limits';

/**
 * Scenario files: a small JSON envelope around one scenario. Import accepts the envelope or a
 * bare scenario object; either way the schema check runs, and the engine check follows in the
 * store. Imported text is always teacher content that nobody has reviewed in this app.
 */
export const SCENARIO_FILE_FORMAT = 'stemsim.studio-scenario';
export const SCENARIO_FILE_VERSION = 1;
export const SCENARIO_FILE_EXT = 'json';

export interface ScenarioFile {
  format: typeof SCENARIO_FILE_FORMAT;
  version: typeof SCENARIO_FILE_VERSION;
  scenario: StudioScenario;
}

export function exportScenario(s: StudioScenario): string {
  const file: ScenarioFile = {
    format: SCENARIO_FILE_FORMAT,
    version: SCENARIO_FILE_VERSION,
    scenario: s,
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export type ParsedFile =
  { ok: true; scenario: StudioScenario } | { ok: false; issues: AuthorIssue[] };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Marks any accepted scenario as teacher content waiting for review. */
export function asTeacherContent(s: StudioScenario): StudioScenario {
  return { ...s, author: 'teacher', review_status: 'pending' };
}

export function parseScenarioFile(text: string): ParsedFile {
  // Checked before parsing: a huge file is refused without building it in memory first.
  if (text.length > MAX_FILE_CHARS) {
    return { ok: false, issues: [{ code: 'tooLarge', params: { kb: MAX_FILE_KB } }] };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, issues: [{ code: 'badJson' }] };
  }
  if (!isObject(data)) return { ok: false, issues: [{ code: 'notScenarioFile' }] };
  let candidate: unknown = data;
  if ('format' in data) {
    if (data.format !== SCENARIO_FILE_FORMAT || data.version !== SCENARIO_FILE_VERSION) {
      return { ok: false, issues: [{ code: 'notScenarioFile' }] };
    }
    candidate = data.scenario;
  }
  const r = validateScenario(candidate);
  if (!r.ok) {
    return {
      ok: false,
      issues: r.errors.map((detail) => ({ code: 'schema', params: { detail } })),
    };
  }
  return { ok: true, scenario: asTeacherContent(r.scenario) };
}
