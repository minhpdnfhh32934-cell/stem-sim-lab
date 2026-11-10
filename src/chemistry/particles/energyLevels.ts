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

export type LabelId = 'reactants' | 'products' | 'dH' | 'eaf' | 'ear';

export interface LabelBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface PlacedLabel {
  x: number;
  y: number;
  anchor: 'start' | 'end';
  box: LabelBox;
}

/** 10 px text: glyph box around the baseline and a generous width per character. */
const ASCENT = 9;
const DESCENT = 3;
const CHAR_W = 6;
const AXIS_Y = 160;

/** Horizontal parts of the drawing as [y, x0, x1]: reactants + dashed reference, hump top, products. */
export function levelLines(g: { yr: number; yp: number; yq: number }): [number, number, number][] {
  return [
    [g.yr, 20, 306],
    [g.yp, 130, 190],
    [g.yq, 205, 300],
  ];
}

/**
 * Places the five labels so that none crosses a level line or another label: each label tries its
 * baselines in order (inside its span first, then above or below the lines) and keeps the first
 * free one. A span shorter than a line of text therefore gets its label outside.
 */
export function diagramLabels(
  g: { yr: number; yp: number; yq: number },
  text: Record<LabelId, string>,
): Record<LabelId, PlacedLabel> {
  const { yr, yp, yq } = g;
  const lines = levelLines(g);
  const placed: LabelBox[] = [];
  const free = (b: LabelBox) =>
    b.y0 >= 0 &&
    b.y1 <= AXIS_Y - 2 &&
    lines.every(([y, x0, x1]) => x1 < b.x0 || x0 > b.x1 || y < b.y0 - 1 || y > b.y1 + 1) &&
    placed.every((p) => p.x1 < b.x0 || p.x0 > b.x1 || p.y1 < b.y0 || p.y0 > b.y1);
  const place = (id: LabelId, x: number, anchor: 'start' | 'end', ys: number[]): PlacedLabel => {
    const w = text[id].length * CHAR_W;
    const boxAt = (y: number): LabelBox => ({
      x0: anchor === 'start' ? x : x - w,
      x1: anchor === 'start' ? x + w : x,
      y0: y - ASCENT,
      y1: y + DESCENT,
    });
    const y = ys.find((c) => free(boxAt(c))) ?? ys[0] ?? 0;
    const box = boxAt(y);
    placed.push(box);
    return { x, y, anchor, box };
  };
  const top = (a: number, b: number) => Math.min(a, b) - 6;
  const below = (a: number, b: number) => Math.max(a, b) + 13;
  const span = (a: number, b: number) => [
    (a + b) / 2 + 4,
    top(a, b),
    top(a, b) - 13,
    below(a, b),
    below(a, b) + 13,
  ];
  return {
    reactants: place('reactants', 22, 'start', [yr + 13, yr - 6, yr - 19]),
    products: place('products', 232, 'start', [
      yq + 13,
      yq - 6,
      top(yq, yr),
      top(yq, yr) - 13,
      below(yq, yr),
    ]),
    dH: place('dH', 297, 'end', span(yr, yq)),
    eaf: place('eaf', 105, 'end', span(yr, yp)),
    ear: place('ear', 220, 'start', span(yq, yp)),
  };
}
