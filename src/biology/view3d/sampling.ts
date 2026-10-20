/**
 * How many figures a 3D view draws for the model's numbers (pure). When a population is larger
 * than the tier can draw, one figure stands for k individuals, with k a "nice" step (1, 2 or 5 ×
 * 10ᵐ, easy to read on the chip "1 hình = k cá thể"); the figures of several classes (genotypes,
 * prey and predators…) are shared out by the largest-remainder method, so they always add up to
 * the rounded total — no class gains or loses a figure from rounding each one alone. The chips
 * next to the picture always show the model's exact numbers.
 */

/** The smallest nice step k (1, 2, 5, 10, 20, 50…) with ⌈total / k⌉ ≤ cap. */
export function drawScale(total: number, cap: number): number {
  const n = Math.max(0, total);
  const c = Math.max(1, Math.floor(cap));
  if (n <= c) return 1;
  for (let m = 0; m < 16; m++) {
    for (const f of [1, 2, 5]) {
      const k = f * 10 ** m;
      if (Math.ceil(n / k) <= c) return k;
    }
  }
  return 10 ** 16;
}

/**
 * Figures per class for `counts` at one figure per `k` individuals: whole numbers that add up to
 * round(Σ counts / k), each class getting its share's whole part plus one for the largest
 * remainders (ties: the earlier class).
 */
export function apportion(counts: readonly number[], k: number): number[] {
  const step = Math.max(1e-12, k);
  const quotas = counts.map((c) => Math.max(0, c) / step);
  const total = Math.round(quotas.reduce((s, q) => s + q, 0));
  const out = quotas.map((q) => Math.floor(q));
  let left = total - out.reduce((s, v) => s + v, 0);
  const order = quotas
    .map((q, i) => ({ i, r: q - Math.floor(q) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i] = (out[i] ?? 0) + 1;
    left--;
  }
  return out;
}
