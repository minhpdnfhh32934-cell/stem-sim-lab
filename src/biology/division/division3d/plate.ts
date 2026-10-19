/**
 * Slots on an equatorial (metaphase) plate: the plane x = 0 of a spindle along x. Positions are
 * illustrative; how many slots there are is the number of things the model puts on the plate
 * (chromosomes in mitosis and meiosis II, bivalents in meiosis I).
 */
import { v3, type Vec3 } from './math';

/** Metaphase plate slots: a ring for few, a sunflower disc for many. */
export function plateLayout(n: number): { pos: Vec3; tangent: Vec3 }[] {
  const out: { pos: Vec3; tangent: Vec3 }[] = [];
  if (n <= 10) {
    const r = Math.max(1.6, (n * 2.6) / (2 * Math.PI));
    for (let i = 0; i < n; i++) {
      const a = 0.35 + (2 * Math.PI * i) / n;
      out.push({
        pos: v3(0, r * Math.cos(a), r * Math.sin(a)),
        tangent: v3(0, -Math.sin(a), Math.cos(a)),
      });
    }
    return out;
  }
  for (let i = 0; i < n; i++) {
    const r = 3 * Math.sqrt((i + 0.5) / n);
    const a = i * 2.399963;
    out.push({
      pos: v3(0, r * Math.cos(a), r * Math.sin(a)),
      tangent: v3(0, -Math.sin(a), Math.cos(a)),
    });
  }
  return out;
}
