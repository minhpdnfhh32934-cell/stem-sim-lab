import { describe, expect, it } from 'vitest';
import { scenarioSteps, validateScenario, type StudioScenario } from './scenario';
import { builtInScenarios, scenariosFor } from './scenarios';
import { physicsFreeFall } from './scenarios/physicsFreeFall';
import { chemistryChlorideTest } from './scenarios/chemistryChlorideTest';
import { biologyMitosisMetaphase } from './scenarios/biologyMitosisMetaphase';

const clone = (): StudioScenario => structuredClone(physicsFreeFall);

describe('studio scenario schema', () => {
  it('accepts every built-in scenario and keeps them all', () => {
    for (const s of [physicsFreeFall, chemistryChlorideTest, biologyMitosisMetaphase])
      expect(validateScenario(s)).toEqual({ ok: true, scenario: s });
    expect(builtInScenarios()).toHaveLength(3);
    expect(scenariosFor('biology').map((s) => s.id)).toEqual(['biology.mitosis-equator']);
    expect(scenariosFor('physics').map((s) => s.id)).toEqual(['physics.free-fall-height']);
    expect(scenariosFor('chemistry').map((s) => s.id)).toEqual([
      'chemistry.chloride-silver-nitrate',
    ]);
  });

  it('new teaching text waits for a teacher (review_status pending)', () => {
    expect(physicsFreeFall.review_status).toBe('pending');
  });

  it('rejects missing or malformed fields with readable paths', () => {
    const r = validateScenario({ ...clone(), objectives: [], id: 'Bad Id' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.startsWith('objectives'))).toBe(true);
      expect(r.errors.some((e) => e.startsWith('id'))).toBe(true);
    }
    expect(validateScenario(null).ok).toBe(false);
    expect(validateScenario({ ...clone(), schemaVersion: 2 }).ok).toBe(false);
  });

  it('rejects steps out of POE order and completion rules without their step', () => {
    expect(validateScenario({ ...clone(), steps: ['interact', 'predict'] }).ok).toBe(false);
    const noExplain = { ...clone(), steps: ['predict', 'interact', 'observe', 'conclude'] };
    const r = validateScenario(noExplain);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toContain('needs step explain');
  });

  it('rejects a binding of another subject and controls without a start value', () => {
    expect(validateScenario({ ...clone(), subject: 'chemistry' }).ok).toBe(false);
    const s = clone();
    s.initial = { v0: 0 };
    const r = validateScenario(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toContain('initial.h0');
  });

  it('never carries measured values: a physics binding names engine reads, not numbers', () => {
    const r = validateScenario({
      ...clone(),
      binding: { ...physicsFreeFall.binding, measures: [{ answer: 'time_of_flight', value: 3 }] },
    });
    expect(r.ok).toBe(false);
  });

  it('lists the steps in flow order', () => {
    expect(scenarioSteps(physicsFreeFall)).toEqual([
      'predict',
      'interact',
      'observe',
      'explain',
      'conclude',
      'report',
    ]);
  });
});
