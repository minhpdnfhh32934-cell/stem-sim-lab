/*
 * Second-order springs (Phase W, Phú: motion "như có linh hồn", never stiff): every joint, the
 * body's place and each reach eases after its target as a damped spring does — it gathers speed,
 * carries a little, settles — not the first-order glide that reads as robotic. `freq` (Hz) is how
 * quick; `damping` 1 settles without overshoot, below 1 overshoots a touch (arms, a loose hand).
 * Stable at any frame time (sub-steps of at most 1/120 s). Pure (tested).
 */

export interface Spring {
  x: number;
  v: number;
}

export const spring = (x = 0): Spring => ({ x, v: 0 });

export function stepSpring(
  s: Spring,
  target: number,
  freq: number,
  damping: number,
  dt: number,
): number {
  const w = 2 * Math.PI * freq;
  let left = Math.min(dt, 0.25);
  while (left > 1e-6) {
    const h = Math.min(left, 1 / 120);
    s.v += (w * w * (target - s.x) - 2 * damping * w * s.v) * h;
    s.x += s.v * h;
    left -= h;
  }
  return s.x;
}

/** An angle's spring: the target taken the short way round. */
export function stepAngle(
  s: Spring,
  target: number,
  freq: number,
  damping: number,
  dt: number,
): number {
  const d = Math.atan2(Math.sin(target - s.x), Math.cos(target - s.x));
  return stepSpring(s, s.x + d, freq, damping, dt);
}

/** Smooth noise in −1…1 (a few unrelated sines): the body's never-quite-still. */
export function wander(t: number, seed: number): number {
  return (
    0.5 * Math.sin(t * 0.37 + seed * 1.7) +
    0.3 * Math.sin(t * 0.83 + seed * 4.1) +
    0.2 * Math.sin(t * 1.91 + seed * 2.3)
  );
}
