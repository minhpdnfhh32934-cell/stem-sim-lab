import type { Params } from '../types';

/**
 * A light ring on a smooth horizontal table pulled by two or three horizontal forces
 * (VL10 Bài 13: tổng hợp và phân tích lực, cân bằng lực). Seen from above: x to the right,
 * y up the page. The ring stays at rest only when the forces balance; otherwise it moves with
 * a = R/m along the resultant.
 */
export interface ForceSet {
  /** Magnitudes (N). */
  F: number[];
  /** Directions (rad), measured from +x counter-clockwise. */
  a: number[];
  m: number;
}

export function forceSet(p: Params): ForceSet {
  const three = Math.round(p.count ?? 3) === 3;
  const F = [p.F1 ?? 3, p.F2 ?? 4];
  const a = [p.a1 ?? 0, p.a2 ?? Math.PI / 2];
  if (three) {
    F.push(p.F3 ?? 4);
    a.push(p.a3 ?? (-127 * Math.PI) / 180);
  }
  return { F, a, m: p.m ?? 1 };
}

/** Resultant by components: R = ΣF (N). */
export function resultant(s: ForceSet): { x: number; y: number; size: number; angle: number } {
  let x = 0;
  let y = 0;
  s.F.forEach((F, i) => {
    const a = s.a[i] ?? 0;
    x += F * Math.cos(a);
    y += F * Math.sin(a);
  });
  return { x, y, size: Math.hypot(x, y), angle: Math.atan2(y, x) };
}

/**
 * Independent size of the resultant from the forces' sizes and the angles between them only
 * (no components): R² = ΣFᵢ² + 2Σ_{i<j} FᵢFⱼcos(αᵢ − αⱼ). For two forces it is the textbook
 * R² = F₁² + F₂² + 2F₁F₂cos α.
 */
export function resultantByAngles(s: ForceSet): number {
  let r2 = 0;
  for (let i = 0; i < s.F.length; i++) {
    const Fi = s.F[i] ?? 0;
    r2 += Fi * Fi;
    for (let j = i + 1; j < s.F.length; j++)
      r2 += 2 * Fi * (s.F[j] ?? 0) * Math.cos((s.a[i] ?? 0) - (s.a[j] ?? 0));
  }
  return Math.sqrt(Math.max(0, r2));
}

/** The ring is at rest when the resultant is below this (N): rounding of balanced forces. */
export const BALANCED = 1e-9;

/** Run length: until the ring has moved 1.5 m (at most 3 s); 2 s when it stays at rest. */
export function runLength(s: ForceSet): number {
  const a = resultant(s).size / s.m;
  return a < BALANCED ? 2 : Math.min(3, Math.sqrt((2 * 1.5) / a));
}
