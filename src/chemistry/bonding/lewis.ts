import type { Molecule } from '../data/molecules';
import { octetCounts } from './octet';

/** One electron group drawn beside an atom: a lone pair (2 dots) or an unpaired electron. */
export interface DotGroup {
  /** Direction from the atom, radians, y up. */
  angle: number;
  electrons: 1 | 2;
}

export interface LewisLayout {
  /** Atom centres in px (y down, SVG), with a margin around the drawing. */
  points: { x: number; y: number }[];
  width: number;
  height: number;
  /** Electron groups of each atom (from `octetCounts`). */
  dots: DotGroup[][];
}

const BOND_PX = 72;
const MARGIN = 44;
/** Candidate directions every 15°; the four sides come first so ties fall on them. */
const CANDIDATES = [0, 90, 180, 270, ...Array.from({ length: 24 }, (_, k) => k * 15)].map(
  (d) => (d * Math.PI) / 180,
);

const gap = (a: number, b: number) => {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return Math.min(d, 2 * Math.PI - d);
};

/**
 * Places k electron groups around an atom, each as far as possible from its bonds and from the
 * groups already placed (greedy; deterministic). Illustration only.
 */
export function placeGroups(bondAngles: readonly number[], k: number): number[] {
  const taken = [...bondAngles];
  const out: number[] = [];
  for (let i = 0; i < k; i++) {
    let best = CANDIDATES[0] ?? 0;
    let bestGap = -1;
    for (const c of CANDIDATES) {
      const g = taken.length ? Math.min(...taken.map((t) => gap(c, t))) : Math.PI;
      if (g > bestGap + 1e-9) {
        best = c;
        bestGap = g;
      }
    }
    out.push(best);
    taken.push(best);
  }
  return out;
}

/** Lewis-style drawing of the structure: the data's 2D depiction scaled to 72 px bonds. */
export function lewisLayout(m: Molecule): LewisLayout {
  const lengths = m.bonds.map((b) => {
    const p = m.atoms[b.a]?.xy ?? [0, 0];
    const q = m.atoms[b.b]?.xy ?? [0, 0];
    return Math.hypot(p[0] - q[0], p[1] - q[1]);
  });
  const unit = lengths.length ? Math.min(...lengths) : 1;
  const s = BOND_PX / (unit || 1);
  const xs = m.atoms.map((a) => a.xy[0] * s);
  const ys = m.atoms.map((a) => -a.xy[1] * s);
  const x0 = Math.min(...xs) - MARGIN;
  const y0 = Math.min(...ys) - MARGIN;
  const points = xs.map((x, i) => ({ x: x - x0, y: (ys[i] ?? 0) - y0 }));
  const counts = octetCounts(m);
  const dots = m.atoms.map((_, i) => {
    const here = points[i] ?? { x: 0, y: 0 };
    const bondAngles = m.bonds
      .filter((b) => b.a === i || b.b === i)
      .map((b) => {
        const there = points[b.a === i ? b.b : b.a] ?? here;
        return Math.atan2(-(there.y - here.y), there.x - here.x);
      });
    const c = counts[i];
    if (!c) return [];
    const angles = placeGroups(bondAngles, c.lonePairs + c.unpaired);
    return angles.map((angle, k): DotGroup => ({ angle, electrons: k < c.lonePairs ? 2 : 1 }));
  });
  return {
    points,
    width: Math.max(...xs) - x0 + MARGIN,
    height: Math.max(...ys) - y0 + MARGIN,
    dots,
  };
}
