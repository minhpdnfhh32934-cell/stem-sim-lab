/**
 * The drawn shape of the electromagnetic wave (pure, no three.js): two wavelengths along +x, E⃗
 * along y and B⃗ along z, in phase and perpendicular to each other and to the direction of
 * travel (SGK Vật lí 11 KNTT Bài 11, tr. 44). The amplitude and the slowed-down motion are
 * illustration; λ and f are the lesson's numbers.
 */
export type Vec3 = [number, number, number];

/** Seconds the drawing takes for one oscillation (slowed down: an illustration). */
export const SHOWN_PERIOD = 2;
/** Wavelengths drawn, their length in the scene and the drawn amplitude (world units). */
export const WAVES = 2;
export const SPAN = 6;
export const AMP = 1.2;

/** x of the point u wavelengths from the start of the drawn part. */
export const xAt = (u: number) => -SPAN / 2 + (u / WAVES) * SPAN;

/** E⃗ and B⃗ (drawn vectors) at u wavelengths and phase φ (rad): the wave sin(2πu − φ). */
export function fieldsAt(u: number, phase: number): { e: Vec3; b: Vec3 } {
  const v = AMP * Math.sin(2 * Math.PI * u - phase);
  return { e: [0, v, 0], b: [0, 0, v] };
}

/** The phase after t seconds of the slowed-down motion. */
export const phaseAt = (t: number) => (2 * Math.PI * t) / SHOWN_PERIOD;
