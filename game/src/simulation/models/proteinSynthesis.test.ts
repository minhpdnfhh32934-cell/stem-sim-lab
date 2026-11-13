import { describe, expect, it } from 'vitest';
import {
  aminoAcid,
  GENE,
  MUTATIONS,
  mRNA,
  proteinSynthesisModel as model,
  translate,
} from './proteinSynthesis';

// The genetic code and β-globin as textbooks give them: AUG start (Met), UAA/UAG/UGA stop;
// β-globin begins Met-Val-His-Leu-Thr-Pro-Glu-Glu-Lys; sickle cell is Glu6 → Val.

describe('protein synthesis', () => {
  it('reads the standard genetic code', () => {
    expect(aminoAcid('ATG')).toBe('M');
    expect(['TAA', 'TAG', 'TGA'].map(aminoAcid)).toEqual(['*', '*', '*']);
    expect(aminoAcid('TGG')).toBe('W');
    expect(aminoAcid('GAG')).toBe('E');
    expect(aminoAcid('GTG')).toBe('V');
    expect(aminoAcid('GGC')).toBe('G');
  });

  it('makes the start of β-globin, and the sickle-cell protein with Val in place of Glu6', () => {
    expect(translate(GENE)).toBe('MVHLTPEEKSA');
    expect(mRNA(GENE).startsWith('AUGGUGCAC')).toBe(true);
    const sickle = translate(MUTATIONS[1]!(GENE));
    expect(sickle).toBe('MVHLTPVEKSA');
    expect(sickle[6]).toBe('V'); // position 6 counted without the Met
  });

  it('tells the effects apart: silent, missense, nonsense, frameshift', () => {
    const effect = (m: number) => model.predict!({ mutation: m, stepTime: 0.4 });
    expect(effect(0)).toMatchObject({ length: 11, changed: 0, effect: 0 });
    expect(effect(1)).toMatchObject({ length: 11, changed: 1, effect: 1 });
    expect(effect(2)).toMatchObject({ length: 11, changed: 0, effect: 0 });
    expect(effect(3)).toMatchObject({ length: 6, effect: 2 });
    expect(translate(MUTATIONS[4]!(GENE))).toBe('MVHTDS'); // the shifted frame meets TGA
    expect(effect(4)).toMatchObject({ length: 6, effect: 3, bases: 34 });
  });

  it('transcribes, then translates up to the stop codon', () => {
    const inputs = { mutation: 3, stepTime: 0.4 };
    const state = new Float64Array(model.variables.length);
    model.init(inputs, state);
    for (let i = 0; i < 10000 && !model.isComplete?.(state, inputs); i++)
      model.step(state, 0.05, inputs);
    expect([state[1], state[2], state[4]]).toEqual([33, 6, 2]);
  });
});
