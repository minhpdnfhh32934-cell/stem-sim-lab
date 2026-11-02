import { describe, expect, it } from 'vitest';
import { diagramGeometry, diagramLabels, energyLevels, levelLines } from './energyLevels';

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

describe('energy diagram labels', () => {
  const TEXTS = {
    vi: {
      reactants: 'Chất đầu',
      products: 'Sản phẩm',
      dH: 'ΔH',
      eaf: 'Eₐ(thuận)',
      ear: 'Eₐ(nghịch)',
    },
    en: {
      reactants: 'Reactants',
      products: 'Products',
      dH: 'ΔH',
      eaf: 'Eₐ(forward)',
      ear: 'Eₐ(reverse)',
    },
  };
  // kJ/mol pairs (forward, reverse), including those where labels used to sit on a level line.
  const PAIRS = [
    [50, 50],
    [5, 70],
    [70, 5],
    [0, 70],
    [0, 300],
    [70, 0],
    [300, 0],
    [50, 52],
    [52, 50],
    [50, 70],
    [80, 30],
    [0, 0],
    [300, 300],
    [1, 300],
    [300, 1],
    [150, 150],
  ] as const;

  it('never puts a label on a level line, on another label or outside the drawing', () => {
    for (const [eaf, ear] of PAIRS) {
      const g = diagramGeometry(energyLevels(eaf * 1e3, ear * 1e3), 22, 146);
      for (const [locale, text] of Object.entries(TEXTS)) {
        const boxes = Object.values(diagramLabels(g, text)).map((l) => l.box);
        const where = `${String(eaf)}/${String(ear)} ${locale}`;
        for (const b of boxes) {
          expect(b.y0, where).toBeGreaterThanOrEqual(0);
          expect(b.y1, where).toBeLessThanOrEqual(158);
          for (const [y, x0, x1] of levelLines(g)) {
            const crosses = x1 >= b.x0 && x0 <= b.x1 && y >= b.y0 - 1 && y <= b.y1 + 1;
            expect(crosses, `${where}: line y=${String(y)}`).toBe(false);
          }
        }
        boxes.forEach((a, i) => {
          boxes.slice(i + 1).forEach((b) => {
            const overlap = a.x1 >= b.x0 && b.x1 >= a.x0 && a.y1 >= b.y0 && b.y1 >= a.y0;
            expect(overlap, `${where}: labels overlap`).toBe(false);
          });
        });
      }
    }
  });

  it('keeps a span label inside its span when there is room (default 50/70)', () => {
    const g = diagramGeometry(energyLevels(50e3, 70e3), 22, 146);
    const l = diagramLabels(g, TEXTS.vi);
    expect(l.eaf.y).toBe((g.yr + g.yp) / 2 + 4);
    expect(l.ear.y).toBe((g.yq + g.yp) / 2 + 4);
  });
});
