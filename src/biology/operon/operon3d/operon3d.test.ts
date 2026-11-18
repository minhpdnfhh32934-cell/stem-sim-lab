import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { operon, type OperonInput } from '../model';
import { REGIONS, middle, placement, region } from './layout';
import { buildOperonScene } from './scene';

const texts = {
  repressor: 'R',
  polymerase: 'pol',
  allolactose: 'al',
  lactose: 'lac',
  mrna: 'mRNA',
  broken: 'x',
};
const ALL: OperonInput[] = [];
for (const lactose of [false, true])
  for (const lacI of ['normal', 'broken'] as const)
    for (const operator of ['normal', 'broken'] as const) ALL.push({ lactose, lacI, operator });

describe('lac operon 3D', () => {
  it('the regions in the book’s order, end to end', () => {
    expect(REGIONS.map((r) => r.id)).toEqual(['lacI', 'gap', 'P', 'O', 'lacZ', 'lacY', 'lacA']);
    REGIONS.forEach((r, i) => {
      expect(r.to).toBeGreaterThan(r.from);
      if (i > 0) expect(r.from).toBe(REGIONS[i - 1]?.to);
    });
  });

  it('every input: what is bound, free or transcribed is the model’s', () => {
    for (const input of ALL) {
      const r = operon(input);
      const p = placement(input, r);
      expect(p.repressor === null).toBe(input.lacI === 'broken');
      expect(p.repressor?.onOperator ?? false).toBe(r.repressorOnOperator);
      if (p.repressor?.onOperator) expect(p.repressor.at[0]).toBe(middle('O'));
      expect(p.allolactoseBound).toBe(r.allolactoseOnRepressor && input.lacI === 'normal');
      expect(p.lactoseFree > 0).toBe(input.lactose);
      expect(p.polymerase.onGenes).toBe(r.transcribed);
      const x = p.polymerase.at[0];
      if (r.transcribed) expect(x).toBeGreaterThanOrEqual(region('lacZ').from);
      else expect(x).toBe(middle('P'));
      expect(p.mrna).toBe(r.transcribed);
      expect(p.broken.includes('lacI')).toBe(input.lacI === 'broken');
      expect(p.broken.includes('O')).toBe(input.operator === 'broken');
    }
  });

  it('the scene for each input, and frees everything', () => {
    for (const input of ALL) {
      const { kit, track, start } = testKit();
      const sc = buildOperonScene(kit, { input, result: operon(input), texts });
      const r = operon(input);
      expect(sc.state().polymeraseOnGenes).toBe(r.transcribed);
      expect(kit.scene.getObjectByName('operon-repressor') === undefined).toBe(
        input.lacI === 'broken',
      );
      expect(kit.scene.getObjectByName('operon-mrna') !== undefined).toBe(r.transcribed);
      expectAllFreed(kit, track, start);
    }
  });
});
