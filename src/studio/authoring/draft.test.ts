import { describe, expect, it } from 'vitest';
import { REACTIONS } from '@/chemistry/data/reactions';
import { freeFall } from '@/physics/projectile/scenes';
import { validateScenario, type StudioScenario } from '../scenario';
import { builtInScenarios } from '../scenarios';
import {
  withCellType,
  withControl,
  withInitial,
  withPart,
  withReagent,
  withSwappedTarget,
  withTarget,
} from './bindingDraft';
import { chemistryReagents, chemistryTargets, physicsPresets } from './choices';
import { draftIssues, fromDraft, listItems, newDraft, parseSources, toDraft } from './draft';
import { asTeacherContent } from './fileFormat';

const builtIn = (subject: StudioScenario['subject']): StudioScenario => {
  const s = builtInScenarios().find((x) => x.subject === subject);
  if (!s) throw new Error(subject);
  return s;
};

describe('authoring draft', () => {
  it('a built-in scenario survives draft → scenario unchanged, apart from the teacher label', () => {
    for (const s of builtInScenarios()) {
      const back = fromDraft(toDraft(s, s.id), s.id);
      expect(back).toEqual(asTeacherContent(s));
      expect(validateScenario(back).ok).toBe(true);
    }
  });

  it('a new draft keeps the engine binding but no teacher text, and says what is missing', () => {
    for (const subject of ['physics', 'chemistry', 'biology'] as const) {
      const d = newDraft(subject);
      expect(d).not.toBeNull();
      if (!d) continue;
      expect(d.binding).toEqual(builtIn(subject).binding);
      const codes = draftIssues(d).map((i) => i.code);
      expect(codes).toEqual(
        expect.arrayContaining(['titleRequired', 'objectiveRequired', 'conclusionRequired']),
      );
      expect(codes.includes('questionRequired')).toBe(subject !== 'physics');
    }
  });

  it('English lines fall back to Vietnamese; extra English lines are an error', () => {
    expect(listItems({ vi: 'a\n\nb', en: 'A' })).toEqual([
      { vi: 'a', en: 'A' },
      { vi: 'b', en: 'b' },
    ]);
    const d = toDraft(builtIn('physics'), null);
    const codes = draftIssues({ ...d, hints: { vi: 'một', en: 'one\ntwo' } }).map((i) => i.code);
    expect(codes).toContain('enLines');
  });

  it('parses sources one per line and rejects a broken link', () => {
    const r = parseSources('SGK Vật lí 10 | https://example.org/vl10\n\nGhi chép lớp');
    expect(r.sources).toEqual([
      { id: 'teacher-1', citation: 'SGK Vật lí 10', url: 'https://example.org/vl10' },
      { id: 'teacher-2', citation: 'Ghi chép lớp' },
    ]);
    expect(r.badLines).toEqual([]);
    expect(parseSources('Bài báo | https://').badLines).toEqual([1]);
    expect(
      draftIssues({ ...toDraft(builtIn('physics'), null), sources: 'A | http://' }),
    ).toContainEqual({
      code: 'sourceUrl',
      params: { line: 1 },
    });
  });

  it('rejects a minimum explanation length outside 0…2000', () => {
    const d = toDraft(builtIn('physics'), null);
    expect(draftIssues({ ...d, explanationMinChars: 2001 }).map((i) => i.code)).toContain(
      'minChars',
    );
    expect(draftIssues({ ...d, explanationMinChars: 1.5 }).map((i) => i.code)).toContain(
      'minChars',
    );
  });
});

describe('binding edits pick only engine choices', () => {
  it('physics presets come from built-in scenarios; a new control starts at the scene default', () => {
    expect(physicsPresets().map((p) => p.binding.scene)).toEqual(['freeFall']);
    let d = toDraft(builtIn('physics'), null);
    d = withControl(d, freeFall, 'm', true);
    expect(d.binding.kind === 'physics' && d.binding.controls).toEqual(['h0', 'm']);
    expect(d.initial.m).toBe(freeFall.defaults.m);
    d = withInitial(d, 'v0', null);
    expect('v0' in d.initial).toBe(false);
    // A control keeps an (invalid) value so the form can say it is not a number.
    d = withInitial(d, 'h0', null);
    expect(Number.isNaN(d.initial.h0)).toBe(true);
    expect(draftIssues(d).map((i) => i.code)).toContain('initialNumber');
    d = withControl(withControl(d, freeFall, 'h0', false), freeFall, 'm', false);
    expect(draftIssues(d).map((i) => i.code)).toContain('controlsRequired');
  });

  it('chemistry targets are precipitation records; their solutions stay on the rack', () => {
    expect(chemistryTargets().every((r) => r.category === 'precipitation')).toBe(true);
    expect(chemistryReagents()).toEqual(['AgNO3', 'NaCl', 'BaCl2', 'H2SO4']);
    let d = toDraft(builtIn('chemistry'), null);
    expect(withReagent(d, 'NaCl', false)).toBe(d);
    const baso4 = REACTIONS.find((r) => r.id === 'baso4');
    if (!baso4) throw new Error('baso4');
    d = withReagent(withReagent(d, 'BaCl2', false), 'H2SO4', false);
    d = withTarget(d, baso4);
    const b = d.binding;
    expect(b.kind === 'chemistry' && [b.reaction, b.target, b.inventory]).toEqual([
      'baso4',
      ['BaCl2', 'H2SO4'],
      ['NaCl', 'AgNO3', 'BaCl2', 'H2SO4'],
    ]);
    const swapped = withSwappedTarget(d).binding;
    expect(swapped.kind === 'chemistry' && swapped.target).toEqual(['H2SO4', 'BaCl2']);
  });

  it('biology parts follow the cell type', () => {
    let d = toDraft(builtIn('biology'), null);
    d = withPart(d, 'centrosome', true);
    d = withCellType(d, 'plant');
    const b = d.binding;
    expect(b.kind === 'biology' && b.parts.includes('centrosome')).toBe(false);
    expect(b.kind === 'biology' && b.cellType).toBe('plant');
  });
});
