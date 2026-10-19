import { describe, expect, it } from 'vitest';
import { freeFall } from '@/physics/projectile/scenes';
import type { StudioScenario } from '../scenario';
import { biologyMitosisMetaphase } from '../scenarios/biologyMitosisMetaphase';
import { chemistryChlorideTest } from '../scenarios/chemistryChlorideTest';
import { physicsFreeFall } from '../scenarios/physicsFreeFall';
import { checkScenario, verifyScenario } from './check';

const codes = (s: StudioScenario) => checkScenario(s, freeFall).map((i) => i.code);

describe('engine check of authored scenarios', () => {
  it('every built-in scenario runs on its engine', () => {
    for (const s of [physicsFreeFall, chemistryChlorideTest, biologyMitosisMetaphase]) {
      expect(checkScenario(s, freeFall)).toEqual([]);
    }
  });

  it('physics: start values stay in the scene range so that run B (h0 × 2) does too', () => {
    // freeFall h0 slider max is 200 m → condition A may go up to 100 m.
    expect(codes({ ...physicsFreeFall, initial: { h0: 100, v0: 0 } })).toEqual([]);
    const tooHigh = checkScenario({ ...physicsFreeFall, initial: { h0: 150, v0: 0 } }, freeFall);
    expect(tooHigh).toHaveLength(1);
    expect(tooHigh[0]?.code).toBe('initialRange');
    expect(tooHigh[0]?.params).toMatchObject({ max: 100, unit: 'm' });
    // A zero height has no ratio to compare.
    expect(codes({ ...physicsFreeFall, initial: { h0: 0, v0: 0 } })).toEqual(['initialRange']);
    expect(codes({ ...physicsFreeFall, initial: { h0: 45, v0: 0, g: 3 } })).toEqual([
      'unknownParam',
    ]);
  });

  it('physics: controls must be scene numbers and the engine reads must equal a preset', () => {
    const b = physicsFreeFall.binding;
    if (b.kind !== 'physics') throw new Error('physics');
    expect(codes({ ...physicsFreeFall, binding: { ...b, controls: ['h0', 'nope'] } })).toContain(
      'binding',
    );
    expect(codes({ ...physicsFreeFall, binding: { ...b, tMax: 30 } })).toEqual(['notPreset']);
    expect(checkScenario(physicsFreeFall, null).map((i) => i.code)).toEqual(['sceneMissing']);
  });

  it('chemistry: only library solutions, and the target must be the named precipitation', () => {
    const b = chemistryChlorideTest.binding;
    if (b.kind !== 'chemistry') throw new Error('chemistry');
    const withHcl = { ...b, inventory: [...b.inventory, 'HCl'] };
    expect(codes({ ...chemistryChlorideTest, binding: withHcl })).toEqual(['reagentNotAllowed']);
    expect(
      codes({
        ...chemistryChlorideTest,
        binding: { ...withHcl, inventory: [...b.inventory, '(('] },
      }),
    ).toEqual(['reagentNotAllowed']);
    expect(codes({ ...chemistryChlorideTest, binding: { ...b, reaction: 'hcl-naoh' } })).toEqual([
      'targetNotAllowed',
    ]);
    expect(
      codes({ ...chemistryChlorideTest, binding: { ...b, target: ['BaCl2', 'H2SO4'] } }),
    ).toEqual(['targetMismatch']);
  });

  it('biology: parts must exist in the model for the chosen cell type', () => {
    const b = biologyMitosisMetaphase.binding;
    if (b.kind !== 'biology') throw new Error('biology');
    expect(
      codes({ ...biologyMitosisMetaphase, binding: { ...b, parts: ['membrane', 'cellWall'] } }),
    ).toEqual(['bioWrongCell']);
    expect(
      codes({ ...biologyMitosisMetaphase, binding: { ...b, parts: ['membrane', 'ribosome'] } }),
    ).toEqual(['bioUnknownPart']);
  });

  it('verifyScenario runs the schema first, then loads the scene', async () => {
    await expect(verifyScenario(physicsFreeFall)).resolves.toEqual({
      ok: true,
      scenario: physicsFreeFall,
    });
    const bad = await verifyScenario({ ...physicsFreeFall, title: { vi: '' } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.issues.every((i) => i.code === 'schema')).toBe(true);
    const unknownScene = await verifyScenario({
      ...physicsFreeFall,
      binding: { ...physicsFreeFall.binding, scene: 'nope' },
    });
    expect(unknownScene.ok).toBe(false);
  });
});
