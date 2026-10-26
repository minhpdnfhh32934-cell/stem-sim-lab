/**
 * Electrostatics in vacuum or air (ε = 1), SI units, drawn in the plane z = 0 of the 3D field:
 *   point charges  Eᵢ = k qᵢ (r − rᵢ)/|r − rᵢ|³,  E = Σ Eᵢ (superposition),  V = Σ k qᵢ/|r − rᵢ|;
 *   force on a test charge  F = q₀ E;
 *   ideal parallel-plate capacitor  E = U/d between the plates, 0 outside (edge effects ignored).
 * k defaults to 1/(4πε₀) (`C.kC`); a problem may state its own ("lấy k = 9.10⁹").
 * Sources: SGK Vật lí 11 (Lực tương tác giữa các điện tích, điện trường, điện trường đều);
 * Halliday–Resnick–Walker ch. 21–24.
 */
export interface PointCharge {
  /** Charge (C), with its sign. */
  q: number;
  x: number;
  y: number;
}

/** Field E (V/m) at (x, y). Undefined at a charge itself: callers keep away from them. */
export function fieldAt(
  charges: readonly PointCharge[],
  k: number,
  x: number,
  y: number,
): [number, number] {
  let ex = 0;
  let ey = 0;
  for (const c of charges) {
    const dx = x - c.x;
    const dy = y - c.y;
    const r2 = dx * dx + dy * dy;
    const s = (k * c.q) / (r2 * Math.sqrt(r2));
    ex += s * dx;
    ey += s * dy;
  }
  return [ex, ey];
}

/** Potential V (V) at (x, y), zero at infinity. */
export function potentialAt(
  charges: readonly PointCharge[],
  k: number,
  x: number,
  y: number,
): number {
  let v = 0;
  for (const c of charges) v += (k * c.q) / Math.hypot(x - c.x, y - c.y);
  return v;
}

/** Force (N) on a test charge q₀ (C) in the field E. */
export const forceOn = (q0: number, [ex, ey]: readonly [number, number]): [number, number] => [
  q0 * ex,
  q0 * ey,
];

export interface Plates {
  /** U = V₊ − V₋ (V). */
  U: number;
  /** Gap between the plates (m). */
  d: number;
  /** Length of each plate (m). */
  w: number;
}

/**
 * Ideal capacitor centred at the origin with plates parallel to the x-axis, the + plate at
 * y = d/2: E = (0, −U/d) between the plates, 0 everywhere else.
 */
export function plateField(p: Plates, x: number, y: number): [number, number] {
  const inside = Math.abs(y) < p.d / 2 && Math.abs(x) <= p.w / 2;
  return inside ? [0, -p.U / p.d] : [0, 0];
}
