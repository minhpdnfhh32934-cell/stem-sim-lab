/**
 * Pure helpers of the biology 3D views (no three.js): where illustrative figures go, and how
 * many figures stand for a number of individuals.
 */

export type Vec3 = [number, number, number];

/**
 * Deterministic, well spread points in a disc of radius r on the plane y (Vogel's sunflower
 * spiral from the centre out, jittered). Built once for a capacity, the first n of them show n
 * individuals: when n grows, new ones are added at the edge and nobody moves. Illustrative
 * positions only.
 */
export function discPoints(count: number, r: number, y: number, seed = 1): Vec3[] {
  const out: Vec3[] = [];
  let s = 1 + Math.abs(Math.floor(seed)) * 7919;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const rr = r * Math.sqrt((i + 0.5) / Math.max(1, count));
    const a = i * golden;
    const j = (r / Math.sqrt(Math.max(1, count))) * 0.3;
    out.push([rr * Math.cos(a) + (rand() - 0.5) * j, y, rr * Math.sin(a) + (rand() - 0.5) * j]);
  }
  return out;
}

/**
 * How many objects to draw for `count` individuals when at most `max` can be drawn: one per
 * individual, or one per `per` individuals (rounded; the view says so).
 */
export function representative(count: number, max: number): { shown: number; per: number } {
  const n = Math.max(0, Math.round(count));
  if (n <= max) return { shown: n, per: 1 };
  const per = Math.ceil(n / max);
  return { shown: Math.round(n / per), per };
}
