/*
 * Keyframes for the two's movements (Phase W): a track is a list of [time, value] keys; between two
 * keys the value eases in and out (smoothstep), so a movement starts and ends softly, and a key
 * held twice in a row is a pause. Steps of a walk are keys of where each foot lands; between them
 * the foot swings over in an arc. Pure (tested).
 */

export type Track = readonly (readonly [number, number])[];

export const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** A track's value at time `t` (held before the first key and after the last). */
export function at(track: Track, t: number): number {
  const first = track[0];
  if (!first) return 0;
  if (t <= first[0]) return first[1];
  for (let i = 1; i < track.length; i++) {
    const k = track[i];
    const p = track[i - 1];
    if (!k || !p) break;
    if (t <= k[0]) return p[1] + (k[1] - p[1]) * smooth((t - p[0]) / Math.max(1e-6, k[0] - p[0]));
  }
  return track[track.length - 1]?.[1] ?? first[1];
}

/** A foot's walk: where it stands at first, then each step — when it lifts, lands, and where. */
export interface Steps {
  readonly start: readonly [number, number, number];
  readonly steps: readonly {
    readonly from: number;
    readonly to: number;
    readonly at: readonly [number, number, number];
    /** This step's own lift (m): a step up onto something lifts higher. */
    readonly lift?: number;
  }[];
  /** How high the foot lifts mid-step (m). */
  readonly lift: number;
}

/** Where the foot is at `t` (writes x, y, z into `out`); its lift (0–1) is returned. */
export function footAt(s: Steps, t: number, out: { x: number; y: number; z: number }): number {
  let from = s.start;
  for (const step of s.steps) {
    if (t < step.from) break;
    if (t < step.to) {
      const u = (t - step.from) / (step.to - step.from);
      const e = smooth(u);
      out.x = from[0] + (step.at[0] - from[0]) * e;
      out.y = from[1] + (step.at[1] - from[1]) * e + (step.lift ?? s.lift) * Math.sin(Math.PI * u);
      out.z = from[2] + (step.at[2] - from[2]) * e;
      return Math.sin(Math.PI * u);
    }
    from = step.at;
  }
  out.x = from[0];
  out.y = from[1];
  out.z = from[2];
  return 0;
}
