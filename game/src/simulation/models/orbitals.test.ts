import { describe, expect, it } from 'vitest';
import { BOHR_PM, mostProbableRadius, orbitalsModel as model, radialDensity } from './orbitals';

// Hydrogen's orbitals against the textbook: each P = r²R² integrates to 1; the most probable
// radius is a₀ (1s), (3 + √5)a₀ (2s, its larger peak), 4a₀ (2p), 9a₀ (3d); ⟨r⟩ = (a₀/2)(3n² − l(l+1)).

const run = (orbital: number) => {
  const inputs = { orbital, maxRadius: 40, scanTime: 20 };
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 1e6 && !model.isComplete?.(state, inputs); i++)
    model.step(state, 0.005, inputs);
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
};

const NL = [
  [1, 0],
  [2, 0],
  [2, 1],
  [3, 0],
  [3, 1],
  [3, 2],
] as const;

describe('hydrogen orbitals', () => {
  it.each(NL)('normalises n = %i, l = %i: ∫P dr = 1', (n, l) => {
    let area = 0;
    const d = 0.001;
    for (let rho = d / 2; rho < 80; rho += d) area += radialDensity(n, l, rho) * d;
    expect(area).toBeCloseTo(1, 6);
  });

  it('peaks where the textbook says', () => {
    expect(mostProbableRadius(1, 0)).toBeCloseTo(1, 6);
    expect(mostProbableRadius(2, 0)).toBeCloseTo(3 + Math.sqrt(5), 6);
    expect(mostProbableRadius(2, 1)).toBeCloseTo(4, 6);
    expect(mostProbableRadius(3, 2)).toBeCloseTo(9, 6);
  });

  it('scans: the electron is all inside 40 a₀, ⟨r⟩ as theory, the radial nodes counted', () => {
    for (const [code, [n, l]] of NL.entries()) {
      const end = run(code);
      const theory = model.predict!({ orbital: code, maxRadius: 40, scanTime: 20 });
      expect(end.inside).toBeCloseTo(100, 2);
      expect((end.meanRadius ?? 0) / (theory.meanRadius ?? 1)).toBeCloseTo(1, 3);
      expect(end.radialNodes).toBe(n - l - 1);
      expect(Math.abs((end.peakRadius ?? 0) - (theory.peakRadius ?? 0))).toBeLessThan(
        0.05 * BOHR_PM,
      );
    }
    expect(model.predict!({ orbital: 5, maxRadius: 40, scanTime: 20 }).angularNodes).toBe(2);
  });
});
