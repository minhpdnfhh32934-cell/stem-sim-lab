import { describe, expect, it } from 'vitest';
import { MEMBERS } from './model';
import { memberAt, moleculeFor } from './molecule3d';

describe('hydrocarbons in 3D: the molecule of the chosen member', () => {
  it('each straight member found in molecules.json has the same formula', () => {
    for (const m of MEMBERS.filter((x) => x.straight)) {
      const mol = moleculeFor(m);
      if (mol) expect(mol.formula).toBe(m.formula);
    }
  });

  it('the book’s first members have 3D coordinates; long chains do not (none are made up)', () => {
    const shown = (cls: Parameters<typeof memberAt>[0], n: number) =>
      moleculeFor(memberAt(cls, n))?.id;
    expect(shown('alkane', 1)).toBe('ch4');
    expect(shown('alkane', 3)).toBe('c3h8');
    expect(shown('alkene', 4)).toBe('but1ene');
    expect(shown('alkyne', 3)).toBe('propyne');
    expect(shown('arene', 6)).toBe('c6h6');
    expect(shown('arene', 7)).toBe('toluene');
    expect(shown('alkane', 7)).toBeUndefined();
    expect(memberAt('alkane', 7)?.name).toBe('heptane');
  });
});
