import { findPath, type NavGrid, nearestFree } from '../../world/navGrid';
import type { NpcActivity, NpcGesture } from './npc';

/** Seconds to sit down onto a seat from the floor beside it, and to stand up again. */
export const SETTLE_S = 0.9;
/** How far (m) in front of a seat a person stands before sitting down on it. */
const SEAT_FRONT = 0.75;

/** One stop of the day, laid out on the floor: the walk to it, then the stay. */
export interface PlannedStop {
  readonly activity: NpcActivity;
  /** Where they stand (a free cell): the activity's point, or the floor in front of the seat. */
  readonly stand: readonly [number, number];
  /** The walk from the previous stop's `stand`: x, z pairs, first the start. */
  readonly path: readonly number[];
  /** Cumulative lengths (m) along `path`, one per point. */
  readonly along: readonly number[];
  /** When (s into the day) the walk begins, the stay begins and the stop ends. */
  readonly walkS: number;
  readonly stayS: number;
  readonly endS: number;
}

/** A person's day: its stops round and round, `periodS` long. */
export interface DayPlan {
  readonly stops: readonly PlannedStop[];
  readonly periodS: number;
}

/** Where a person is and what they do at one moment (written in place: nothing allocated). */
export interface NpcPose {
  x: number;
  z: number;
  heading: number;
  /** Walking speed (m/s), 0 standing or seated. */
  speed: number;
  /** How far down onto a seat (0 standing … 1 seated). */
  sit: number;
  gesture: NpcGesture;
  /** The stop they are at or walking to. */
  stop: number;
  walking: boolean;
}

const facing = (heading: number): [number, number] => [-Math.sin(heading), -Math.cos(heading)];

/**
 * Lays a day out on `grid`: each stop's standing point (a seat's: the free floor in front of it),
 * the walk to it from the stop before (the last stop's leads back to the first), its timing at
 * `walkSpeed`. Throws when a stop has no free floor or no way to it: content to fix.
 */
export function planDay(
  grid: NavGrid,
  schedule: readonly NpcActivity[],
  walkSpeed: number,
): DayPlan {
  const stands = schedule.map((a, i) => {
    const out: [number, number] = [0, 0];
    const [fx, fz] = facing(a.heading);
    const [x, z] = a.kind === 'sit' ? [a.at[0] + fx * SEAT_FRONT, a.at[1] + fz * SEAT_FRONT] : a.at;
    if (!nearestFree(grid, x, z, 0.8, out)) {
      throw new Error(`Stop ${i} at (${a.at[0]}, ${a.at[1]}) has no free floor near it`);
    }
    return out;
  });
  const stops: PlannedStop[] = [];
  let t = 0;
  schedule.forEach((activity, i) => {
    const from = stands[(i + stands.length - 1) % stands.length] ?? [0, 0];
    const to = stands[i] ?? [0, 0];
    const path: number[] = [];
    if (findPath(grid, from[0], from[1], to[0], to[1], path) === 0) {
      throw new Error(`No way from stop ${i - 1} to stop ${i}`);
    }
    const along = [0];
    for (let k = 2; k < path.length; k += 2) {
      const d = Math.hypot(
        (path[k] ?? 0) - (path[k - 2] ?? 0),
        (path[k + 1] ?? 0) - (path[k - 1] ?? 0),
      );
      along.push((along[along.length - 1] ?? 0) + d);
    }
    const length = along[along.length - 1] ?? 0;
    const walkS = t;
    const stayS = walkS + length / walkSpeed;
    const settle = activity.kind === 'sit' ? 2 * SETTLE_S : 0;
    const endS = stayS + settle + activity.seconds;
    stops.push({ activity, stand: to, path, along, walkS, stayS, endS });
    t = endS;
  });
  return { stops, periodS: t };
}

/** Where the person is `t` s into the day (any t: the day repeats), written into `out`. */
export function poseAt(plan: DayPlan, t: number, walkSpeed: number, out: NpcPose): NpcPose {
  const day = ((t % plan.periodS) + plan.periodS) % plan.periodS;
  let i = 0;
  while (i < plan.stops.length - 1 && day >= (plan.stops[i]?.endS ?? 0)) i++;
  const stop = plan.stops[i] as PlannedStop;
  const a = stop.activity;
  out.stop = i;
  if (day < stop.stayS) {
    // Walking: along the path at walking speed, facing the way.
    const d = (day - stop.walkS) * walkSpeed;
    let k = 1;
    while (k < stop.along.length - 1 && (stop.along[k] ?? 0) < d) k++;
    const a0 = stop.along[k - 1] ?? 0;
    const a1 = stop.along[k] ?? a0;
    const f = a1 > a0 ? Math.min(1, Math.max(0, (d - a0) / (a1 - a0))) : 1;
    const x0 = stop.path[2 * (k - 1)] ?? 0;
    const z0 = stop.path[2 * (k - 1) + 1] ?? 0;
    const x1 = stop.path[2 * k] ?? x0;
    const z1 = stop.path[2 * k + 1] ?? z0;
    out.x = x0 + (x1 - x0) * f;
    out.z = z0 + (z1 - z0) * f;
    if (x1 !== x0 || z1 !== z0) out.heading = Math.atan2(-(x1 - x0), -(z1 - z0));
    out.speed = walkSpeed;
    out.sit = 0;
    out.gesture = 'idle';
    out.walking = true;
    return out;
  }
  out.walking = false;
  out.speed = 0;
  out.heading = a.heading;
  out.gesture = a.gesture;
  const stay = day - stop.stayS;
  if (a.kind !== 'sit') {
    out.x = stop.stand[0];
    out.z = stop.stand[1];
    out.sit = 0;
    return out;
  }
  // Sitting: onto the seat from the floor in front of it, the stay, then up and back again.
  const total = stop.endS - stop.stayS;
  const s =
    stay < SETTLE_S ? stay / SETTLE_S : stay > total - SETTLE_S ? (total - stay) / SETTLE_S : 1;
  const e = s * s * (3 - 2 * s);
  out.x = stop.stand[0] + (a.at[0] - stop.stand[0]) * e;
  out.z = stop.stand[1] + (a.at[1] - stop.stand[1]) * e;
  out.sit = e;
  return out;
}
