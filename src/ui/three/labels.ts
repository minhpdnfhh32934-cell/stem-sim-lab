/**
 * Name labels beside a 3D picture (pure layout, no DOM): each label sits in a column to the left
 * or right of the subject, joined to its part by a leader line, never on another label and never
 * outside the safe area (the canvas minus the controls over it). Parts behind the camera or off
 * screen get no label; beyond `cap` labels the rest are left out (a crowd of labels hides the
 * picture). When one column is full, its least important labels move to the other column (if it
 * has room) before any label is left out. Optionally a label never covers given data (the
 * chromosomes), and its leader never crosses a subject that does not hold its part (two cells).
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
  /**
   * Screen bounds of data a label must never cover (the chromosomes): a box moves outwards past
   * them, else to the other column, else it is left out.
   */
  avoid?: readonly Rect[];
  /**
   * Screen bounds of separate subjects (cells side by side): a leader never runs across a
   * subject that does not hold its part, so a part's label stays on its own subject's side.
   */
  regions?: readonly Rect[];
  /**
   * Pixels a box keeps inside the safe area (its border never meets the stage's edge); a part
   * anywhere in the safe area still gets its label.
   */
  edge?: number;
}

type Side = 'left' | 'right';

const inside = (a: LabelAnchor, r: Rect) =>
  a.x >= r.left && a.x <= r.right && a.y >= r.top && a.y <= r.bottom;

/**
 * Whether the leader from part `a` towards the `side` column runs across a subject that does not
 * hold the part (approximated by the horizontal line at the part's height).
 */
export function crossesOtherRegion(a: LabelAnchor, side: Side, regions: readonly Rect[]): boolean {
  return regions.some(
    (r) =>
      !inside(a, r) &&
      a.y >= r.top &&
      a.y <= r.bottom &&
      (side === 'left' ? r.right <= a.x : r.left >= a.x),
  );
}

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
  area: Rect,
  o: LayoutOptions = {},
): PlacedLabel[] {
  const gap = o.gap ?? 6;
  const reach = o.reach ?? 28;
  const avoid = o.avoid ?? [];
  const regions = o.regions ?? [];
  const shown = anchors.filter((a) => a.visible && inside(a, area)).slice(0, o.cap ?? Infinity);
  /** Where the boxes go: the safe area, `edge` px inside its border. */
  const safe = o.edge ? insetRect(area, o.edge) : area;
  if (shown.length === 0) return [];
  const other = (side: Side): Side => (side === 'left' ? 'right' : 'left');
  /** A part may be labelled from `side` unless its leader would cross another subject. */
  const allowed = (a: LabelAnchor, side: Side) => !crossesOtherRegion(a, side, regions);
  // Left or right of the subject's middle (unless the leader would cross another subject); the
  // sides are kept nearly even.
  const mid = shown.reduce((s, a) => s + a.x, 0) / shown.length;
  const left: LabelAnchor[] = [];
  const right: LabelAnchor[] = [];
  for (const a of shown) {
    const near: Side = a.x < mid ? 'left' : 'right';
    const side = allowed(a, near) || !allowed(a, other(near)) ? near : other(near);
    (side === 'left' ? left : right).push(a);
  }
  const balance = (from: LabelAnchor[], to: LabelAnchor[], toSide: Side) => {
    while (from.length > to.length + 1) {
      // The one nearest the middle changes side (if its leader may go there).
      const moved = from
        .filter((a) => allowed(a, toSide))
        .sort((a, b) => Math.abs(a.x - mid) - Math.abs(b.x - mid))[0];
      if (!moved) break;
      from.splice(from.indexOf(moved), 1);
      to.push(moved);
    }
  };
  balance(left, right, 'right');
  balance(right, left, 'left');
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
  const spill = (from: LabelAnchor[], to: LabelAnchor[], toSide: Side) => {
    while (from.length > 1 && !fits(from)) {
      const movable = from.filter((a) => allowed(a, toSide));
      if (movable.length === 0) break;
      const worst = movable.reduce((w, a) => (rank(a) > rank(w) ? a : w));
      if (!fits([...to, worst])) break;
      from.splice(from.indexOf(worst), 1);
      to.push(worst);
    }
  };
  spill(left, right, 'right');
  spill(right, left, 'left');

  /** The box's x, moved outwards past every data rect it would cover; null if none is free. */
  const clear = (x: number, y: number, w: number, h: number, side: Side): number | null => {
    let cx = x;
    for (let i = 0; i <= avoid.length; i++) {
      const hit = avoid.find(
        (r) => cx < r.right + gap && r.left - gap < cx + w && y < r.bottom && r.top < y + h,
      );
      if (!hit) return cx >= safe.left - 0.5 && cx + w <= safe.right + 0.5 ? cx : null;
      cx = side === 'left' ? hit.left - gap - w : hit.right + gap;
    }
    return null;
  };

  const out: PlacedLabel[] = [];
  /** Labels that would cover data on the side they were tried on. */
  const rejected: LabelAnchor[] = [];
  const place = (group: LabelAnchor[], side: Side) => {
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
      const worst = kept.reduce((w, a) => (rank(a) > rank(w) ? a : w));
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
      const x0 =
        side === 'left'
          ? Math.max(safe.left, Math.min(edge - a.w, safe.right - a.w))
          : Math.min(safe.right - a.w, Math.max(edge, safe.left));
      const x = clear(x0, y, a.w, a.h, side);
      if (x === null) {
        rejected.push(a);
        return;
      }
      const lx = side === 'left' ? x + a.w : x;
      out.push({ id: a.id, x, y, side, ax: a.x, ay: a.y, lx, ly: y + a.h / 2 });
    });
  };
  place(left, 'left');
  place(right, 'right');
  // A label that would cover data on its side tries the other column once (if its leader may go
  // there); one that fits on neither side is left out.
  const retry = rejected.filter((a) => allowed(a, left.includes(a) ? 'right' : 'left'));
  if (retry.length > 0) {
    const nextLeft = [
      ...left.filter((a) => !retry.includes(a)),
      ...retry.filter((a) => right.includes(a)),
    ];
    const nextRight = [
      ...right.filter((a) => !retry.includes(a)),
      ...retry.filter((a) => left.includes(a)),
    ];
    out.length = 0;
    rejected.length = 0;
    place(nextLeft, 'left');
    place(nextRight, 'right');
  }
  return out;
}

/** Pixels a label box keeps from the stage's edge (its border never meets the edge). */
export const LABEL_EDGE = 4;

/** `r` shrunk by `by` px on every side (labels kept a few pixels inside the stage's edge). */
export function insetRect(r: Rect, by: number): Rect {
  return { left: r.left + by, top: r.top + by, right: r.right - by, bottom: r.bottom - by };
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

/** True when a placed label's box covers rectangle `r` (for tests and checks). */
export function boxCovers(p: PlacedLabel, size: { w: number; h: number }, r: Rect): boolean {
  return p.x < r.right && r.left < p.x + size.w && p.y < r.bottom && r.top < p.y + size.h;
}

/**
 * True when a label's leader runs across rectangle `r` (a subject) that does not hold its part
 * (for tests and checks): the segment from the part to the box is clipped to `r`.
 */
export function leaderCrosses(p: PlacedLabel, r: Rect): boolean {
  if (p.ax >= r.left && p.ax <= r.right && p.ay >= r.top && p.ay <= r.bottom) return false;
  const dx = p.lx - p.ax;
  const dy = p.ly - p.ay;
  let t0 = 0;
  let t1 = 1;
  // Liang–Barsky: each edge narrows the part of the segment inside the rectangle.
  const edges: [number, number][] = [
    [-dx, p.ax - r.left],
    [dx, r.right - p.ax],
    [-dy, p.ay - r.top],
    [dy, r.bottom - p.ay],
  ];
  for (const [q, d] of edges) {
    if (q === 0) {
      if (d < 0) return false;
      continue;
    }
    const t = d / q;
    if (q < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
}
