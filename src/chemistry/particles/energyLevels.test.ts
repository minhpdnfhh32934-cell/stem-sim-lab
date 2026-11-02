import { describe, expect, it } from 'vitest';
import { diagramGeometry, energyLevels } from './energyLevels';

describe('reaction energy diagram', () => {
  it('ΔH = Eₐ,t − Eₐ,n, negative for an exothermic and positive for an endothermic reaction', () => {
    expect(energyLevels(50e3, 70e3)).toEqual({
      reactants: 0,
      peak: 50e3,
      products: -20e3,
      dH: -20e3,
      kind: 'exothermic',
    });
    expect(energyLevels(80e3, 30e3)).toMatchObject({
      dH: 50e3,
      products: 50e3,
      kind: 'endothermic',
    });
    expect(energyLevels(40e3, 40e3)).toMatchObject({ dH: 0, kind: 'none' });
  });

  it('draws the transition state on top and the products below the reactants when exothermic', () => {
    const g = diagramGeometry(energyLevels(50e3, 70e3), 20, 150);
    // SVG y grows downwards: peak highest (smallest y), products lowest.
    expect(g.yp).toBe(20);
    expect(g.yq).toBe(150);
    expect(g.yr).toBeGreaterThan(g.yp);
    expect(g.yr).toBeLessThan(g.yq);
    // Heights keep the ratio of the energies: Eₐ,t : Eₐ,n = 50 : 70.
    expect((g.yr - g.yp) / (g.yq - g.yp)).toBeCloseTo(50 / 70, 2);
  });

  it('changing an activation energy changes both the numbers and the drawing', () => {
    const a = energyLevels(50e3, 70e3);
    const b = energyLevels(80e3, 70e3);
    expect(b.dH - a.dH).toBe(30e3);
    expect(diagramGeometry(b, 20, 150).d).not.toBe(diagramGeometry(a, 20, 150).d);
    expect(diagramGeometry(b, 20, 150).yq).toBeLessThan(diagramGeometry(b, 20, 150).yr);
  });

  it('stays finite when both activation energies are zero', () => {
    const g = diagramGeometry(energyLevels(0, 0), 20, 150);
    expect([g.yr, g.yp, g.yq]).toEqual([150, 150, 150]);
  });
});
