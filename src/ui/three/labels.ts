/**
 * Name labels beside a 3D picture (pure layout, no DOM): each label sits in a column to the left
 * or right of the subject, joined to its part by a leader line, never on another label and never
 * outside the safe area (the canvas minus the controls over it). Parts behind the camera or off
 * screen get no label; beyond `cap` labels the rest are left out (a crowd of labels hides the
 * picture). When one column is full, its least important labels move to the other column (if it
 * has room) before any label is left out.
 */

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface LabelAnchor {
  id: string;
  /** Where the part is on the canvas (px), and whether it can be seen from the camera. */
  x: number;
  y: number;
  visible: boolean;
  /** Size of the label box (px). */
  w: number;
  h: number;
}

export interface PlacedLabel {
  id: string;
  /** Top-left corner of the label box. */
  x: number;
  y: number;
  side: 'left' | 'right';
  /** Leader line: from the part (ax, ay) to the label's near edge (lx, ly). */
  ax: number;
  ay: number;
  lx: number;
  ly: number;
}

export interface LayoutOptions {
  /** Most labels shown (in the anchors' order of priority). */
  cap?: number;
  /** Space between two labels, and between a label column and the parts (px). */
  gap?: number;
  reach?: number;
}

const inside = (a: LabelAnchor, r: Rect) =>
  a.x >= r.left && a.x <= r.right && a.y >= r.top && a.y <= r.bottom;

/** Stacks boxes (sorted by wanted top) inside [top, bottom] without overlaps; null if no room. */
function stack(
  wanted: { y: number; h: number }[],
  top: number,
  bottom: number,
  gap: number,
): number[] | null {
  const ys = wanted.map((w) => w.y);
  // Downwards: each box below the previous one.
  for (let i = 0; i < ys.length; i++) {
    const prev = i > 0 ? (ys[i - 1] ?? top) + (wanted[i - 1]?.h ?? 0) + gap : top;
    ys[i] = Math.max(ys[i] ?? top, prev);
  }
  // Upwards from the bottom edge: boxes pushed out of the area come back up.
  for (let i = ys.length - 1; i >= 0; i--) {
    const h = wanted[i]?.h ?? 0;
    const next = i < ys.length - 1 ? (ys[i + 1] ?? bottom) - gap : bottom;
    ys[i] = Math.min(ys[i] ?? top, next - h);
  }
  return (ys[0] ?? top) < top - 0.5 ? null : ys;
}

export function layoutLabels(
  anchors: readonly LabelAnchor[],
  safe: Rect,
  o: LayoutOptions = {},
): PlacedLabel[] {
  const gap = o.gap ?? 6;
  const reach = o.reach ?? 28;
  const shown = anchors.filter((a) => a.visible && inside(a, safe)).slice(0, o.cap ?? Infinity);
  if (shown.length === 0) return [];
  // Left or right of the subject's middle; the sides are kept nearly even.
  const mid = shown.reduce((s, a) => s + a.x, 0) / shown.length;
  const left = shown.filter((a) => a.x < mid);
  const right = shown.filter((a) => a.x >= mid);
  const balance = (from: LabelAnchor[], to: LabelAnchor[]) => {
    while (from.length > to.length + 1) {
      // The one nearest the middle changes side.
      from.sort((a, b) => Math.abs(a.x - mid) - Math.abs(b.x - mid));
      const moved = from.shift();
      if (moved) to.push(moved);
    }
  };
  balance(left, right);
  balance(right, left);
  const order = anchors.map((a) => a.id);
  const rank = (a: LabelAnchor) => order.indexOf(a.id);
  /** Whether a column of these labels fits the safe area's height. */
  const fits = (group: readonly LabelAnchor[]) =>
    group.length === 0 ||
    stack(
      [...group].sort((a, b) => a.y - b.y).map((a) => ({ y: a.y - a.h / 2, h: a.h })),
      safe.top,
      safe.bottom,
      gap,
    ) !== null;
  /** A full column hands its least important labels to the other one while that has room. */
  const spill = (from: LabelAnchor[], to: LabelAnchor[]) => {
    while (from.length > 1 && !fits(from)) {
      const worst = from.reduce((w, a) => (rank(a) > rank(w) ? a : w));
      if (!fits([...to, worst])) break;
      from.splice(from.indexOf(worst), 1);
      to.push(worst);
    }
  };
  spill(left, right);
  spill(right, left);
  const out: PlacedLabel[] = [];
  const place = (group: LabelAnchor[], side: 'left' | 'right') => {
    if (group.length === 0) return;
    group.sort((a, b) => a.y - b.y);
    const edge =
      side === 'left'
        ? Math.min(...group.map((a) => a.x)) - reach
        : Math.max(...group.map((a) => a.x)) + reach;
    let kept = group;
    let ys = stack(
      kept.map((a) => ({ y: a.y - a.h / 2, h: a.h })),
      safe.top,
      safe.bottom,
      gap,
    );
    // Not enough height: the lowest-priority labels go first.
    while (!ys && kept.length > 1) {
      const order = anchors.map((a) => a.id);
      const worst = kept.reduce((w, a) => (order.indexOf(a.id) > order.indexOf(w.id) ? a : w));
      kept = kept.filter((a) => a !== worst);
      ys = stack(
        kept.map((a) => ({ y: a.y - a.h / 2, h: a.h })),
        safe.top,
        safe.bottom,
        gap,
      );
    }
    if (!ys) return;
    kept.forEach((a, i) => {
      const y = ys[i] ?? a.y;
      const x =
        side === 'left'
          ? Math.max(safe.left, Math.min(edge - a.w, safe.right - a.w))
          : Math.min(safe.right - a.w, Math.max(edge, safe.left));
      const lx = side === 'left' ? x + a.w : x;
      out.push({ id: a.id, x, y, side, ax: a.x, ay: a.y, lx, ly: y + a.h / 2 });
    });
  };
  place(left, 'left');
  place(right, 'right');
  return out;
}

/** True when two placed labels' boxes overlap (for tests and checks). */
export function overlaps(
  a: PlacedLabel,
  b: PlacedLabel,
  size: (id: string) => { w: number; h: number },
): boolean {
  const sa = size(a.id);
  const sb = size(b.id);
  return a.x < b.x + sb.w && b.x < a.x + sa.w && a.y < b.y + sb.h && b.y < a.y + sa.h;
}
