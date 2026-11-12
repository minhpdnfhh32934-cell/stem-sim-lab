/**
 * The orb's thin lines (#234): pairs of nearby points, computed once when the orb is built, never
 * per frame. Each point links to its `k` nearest neighbours closer than `maxDist`; a pair is kept
 * once; at most `cap` pairs, the shortest first. O(n²) over a few hundred points, once.
 */

/** Index pairs, interleaved (a, b, a, b…), each with a < b. */
export function orbPairs(
  points: Float32Array,
  k: number,
  maxDist: number,
  cap: number,
): Uint16Array {
  const n = Math.floor(points.length / 3);
  if (n > 65_536) throw new Error('orbPairs: Uint16 indices hold at most 65 536 points');
  const max2 = maxDist * maxDist;
  const found = new Map<number, number>();
  const near: { j: number; d2: number }[] = [];
  for (let i = 0; i < n; i++) {
    near.length = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dx = (points[3 * i] ?? 0) - (points[3 * j] ?? 0);
      const dy = (points[3 * i + 1] ?? 0) - (points[3 * j + 1] ?? 0);
      const dz = (points[3 * i + 2] ?? 0) - (points[3 * j + 2] ?? 0);
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 <= max2) near.push({ j, d2 });
    }
    near.sort((a, b) => a.d2 - b.d2);
    for (const { j, d2 } of near.slice(0, k)) {
      const key = Math.min(i, j) * n + Math.max(i, j);
      if (!found.has(key)) found.set(key, d2);
    }
  }
  const kept = [...found].sort((a, b) => a[1] - b[1] || a[0] - b[0]).slice(0, cap);
  const out = new Uint16Array(kept.length * 2);
  kept.forEach(([key], p) => {
    out[2 * p] = Math.floor(key / n);
    out[2 * p + 1] = key % n;
  });
  return out;
}

/** The mean spacing of `count` points spread evenly on a unit sphere (area 4π). */
export function meanSpacing(count: number): number {
  return Math.sqrt((4 * Math.PI) / Math.max(1, count));
}
