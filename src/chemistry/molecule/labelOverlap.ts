/** A label's box on screen (centre, size in px) and its depth (NDC z: smaller is nearer). */
export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}

/**
 * Which labels to show so none covers another (UI-38, #70): nearer atoms keep their label, a
 * farther one closer than `gap` px to an already shown label is hidden. Labels 5 px apart still
 * read as one word ("CH"), so the gap is about one letter wide.
 */
export function visibleLabels(boxes: readonly (LabelBox | null)[], gap = 8): boolean[] {
  const order = boxes
    .map((b, i) => [b, i] as const)
    .filter((e): e is readonly [LabelBox, number] => e[0] !== null)
    .sort((a, b) => a[0].z - b[0].z);
  const shown: LabelBox[] = [];
  const out = boxes.map(() => false);
  for (const [b, i] of order) {
    const hit = shown.some(
      (s) =>
        Math.abs(s.x - b.x) < (s.w + b.w) / 2 + gap && Math.abs(s.y - b.y) < (s.h + b.h) / 2 + gap,
    );
    if (!hit) {
      shown.push(b);
      out[i] = true;
    }
  }
  return out;
}
