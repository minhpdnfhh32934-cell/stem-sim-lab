/**
 * Reaction energy diagram from the learner's activation energies (J/mol): reactants at 0, the
 * transition state at Eₐ,t, products at Eₐ,t − Eₐ,n = ΔH. Only these three levels are numbers; the
 * curve between them is a qualitative drawing.
 */
export type HeatKind = 'exothermic' | 'endothermic' | 'none';

export interface EnergyLevels {
  reactants: number;
  peak: number;
  products: number;
  dH: number;
  kind: HeatKind;
}

export function energyLevels(eaf: number, ear: number): EnergyLevels {
  const dH = eaf - ear;
  const kind = dH < 0 ? 'exothermic' : dH > 0 ? 'endothermic' : 'none';
  return { reactants: 0, peak: eaf, products: dH, dH, kind };
}

/**
 * SVG y (downwards) of each level inside [top, bottom] of a 320-wide drawing, and the curve
 * through them: flat reactants, a smooth hump at the transition state, flat products.
 */
export function diagramGeometry(l: EnergyLevels, top: number, bottom: number) {
  const lo = Math.min(l.reactants, l.products);
  const span = l.peak - lo || 1;
  const y = (e: number) => Math.round((bottom - ((e - lo) / span) * (bottom - top)) * 10) / 10;
  const yr = y(l.reactants);
  const yp = y(l.peak);
  const yq = y(l.products);
  const d = `M20 ${yr} L90 ${yr} C125 ${yr} 135 ${yp} 160 ${yp} C185 ${yp} 195 ${yq} 230 ${yq} L300 ${yq}`;
  return { yr, yp, yq, d };
}
