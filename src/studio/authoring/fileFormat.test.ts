import { describe, expect, it } from 'vitest';
import { builtInScenarios } from '../scenarios';
import { physicsFreeFall } from '../scenarios/physicsFreeFall';
import {
  asTeacherContent,
  exportScenario,
  parseScenarioFile,
  SCENARIO_FILE_FORMAT,
} from './fileFormat';
import { MAX_FILE_CHARS, MAX_FILE_KB } from './limits';

describe('scenario files', () => {
  it('round-trips every scenario through export → import', () => {
    for (const s of builtInScenarios()) {
      const teacher = asTeacherContent({ ...s, id: `teacher.${s.id}` });
      expect(parseScenarioFile(exportScenario(teacher))).toEqual({ ok: true, scenario: teacher });
    }
  });

  it('rejects text that is not JSON, or JSON that is not a scenario file', () => {
    expect(parseScenarioFile('{ "format": ')).toEqual({ ok: false, issues: [{ code: 'badJson' }] });
    expect(parseScenarioFile('')).toEqual({ ok: false, issues: [{ code: 'badJson' }] });
    for (const text of ['[]', '42', 'null', '{"format":"other","version":1,"scenario":{}}']) {
      expect(parseScenarioFile(text)).toEqual({ ok: false, issues: [{ code: 'notScenarioFile' }] });
    }
    const v2 = JSON.stringify({
      format: SCENARIO_FILE_FORMAT,
      version: 2,
      scenario: physicsFreeFall,
    });
    expect(parseScenarioFile(v2).ok).toBe(false);
  });

  it('refuses an oversized file before parsing it, even when it is valid JSON', () => {
    const padded = `${exportScenario(physicsFreeFall)}${' '.repeat(MAX_FILE_CHARS)}`;
    expect(parseScenarioFile(padded)).toEqual({
      ok: false,
      issues: [{ code: 'tooLarge', params: { kb: MAX_FILE_KB } }],
    });
  });

  it('lists schema problems with their paths', () => {
    const broken = JSON.stringify({
      format: SCENARIO_FILE_FORMAT,
      version: 1,
      scenario: { ...physicsFreeFall, objectives: [], binding: { kind: 'physics' } },
    });
    const r = parseScenarioFile(broken);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const details = r.issues.map((i) => {
      const d = i.params?.detail;
      return typeof d === 'string' ? d : '';
    });
    expect(r.issues.every((i) => i.code === 'schema')).toBe(true);
    expect(details.some((d) => d.startsWith('objectives'))).toBe(true);
    expect(details.some((d) => d.startsWith('binding'))).toBe(true);
  });

  it('a bare scenario is accepted; imported text is always unreviewed teacher content', () => {
    const r = parseScenarioFile(JSON.stringify({ ...physicsFreeFall, review_status: 'verified' }));
    expect(r.ok && [r.scenario.author, r.scenario.review_status]).toEqual(['teacher', 'pending']);
  });

  it('a file cannot smuggle measured values into a physics binding', () => {
    const r = parseScenarioFile(
      JSON.stringify({
        ...physicsFreeFall,
        binding: { ...physicsFreeFall.binding, measures: [{ answer: 'time_of_flight', value: 3 }] },
      }),
    );
    expect(r.ok).toBe(false);
  });
});
