/*
 * The wallpaper's day (Phase W-6), a loop of seven minutes: three of afternoon running into a
 * golden evening, forty seconds of sunset, the rest of night, half a minute of dawn. At sunset Khoa
 * sits down by Linh on the ledge and she leans her head on his shoulder and hugs him (Phú
 * 2026-11-17); they change into their night clothes there (the scan), and some time into the night
 * he gets up and goes back to his place. Raids come every few minutes, never while the two sit
 * together. Pure (tested): `Wallpaper.ts` turns it into sky, light and the city's clock.
 */

import { DAY_S } from '../../world/clock';

export const CYCLE = { day: 180, dusk: 40, night: 170, dawn: 30 } as const;
export const LOOP = CYCLE.day + CYCLE.dusk + CYCLE.night + CYCLE.dawn;

/** How long Khoa takes to step up onto the ledge and sit down by Linh (s), and to settle into their hug. */
export const SIT_IN = 7.2;
export const HUG_EASE = 1.6;
/**
 * When Khoa goes to sit by Linh, and when he lets go to get up (s into the loop); `settle` is how
 * long letting go and getting up take, after `until`.
 */
export const TOGETHER = { from: 140, settle: HUG_EASE + SIT_IN, until: 252 } as const;
/** When the clothes change (the scan's middle) and how long the scan takes (s into the loop). */
export const SCAN_DUSK = 212;
export const SCAN_DAWN = 402;
export const SCAN_S = 6;

export interface Hour {
  /** 0 full day … 1 full night. */
  night: number;
  /** The sun's height (rad; negative under the horizon) and its azimuth (rad: 0 behind the two, +z; a quarter turn to their left, −x; half a turn ahead, −z). */
  elevation: number;
  azimuth: number;
  /** 0 … 1: how golden the light is (low sun). */
  golden: number;
  /** 0 day clothes … 1 night clothes (the scan's progress). */
  outfit: number;
  /** The game clock (s) for the city's lights: its windows, lamps and traffic follow it. */
  clockS: number;
}

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const deg = Math.PI / 180;
const at = (hours: number) => (hours / 24) * DAY_S;

/** The hour at `t` seconds since the wallpaper started (any t ≥ 0), written into `out`. */
export function hourAt(t: number, out: Hour): Hour {
  const s = ((t % LOOP) + LOOP) % LOOP;
  const duskAt = CYCLE.day;
  const nightAt = duskAt + CYCLE.dusk;
  const dawnAt = nightAt + CYCLE.night;
  if (s < duskAt) {
    // The afternoon: the sun from behind them on the left, swinging round ahead of them as it
    // sinks, to set behind the lab (in the picture, the lab dark against it).
    const u = s / CYCLE.day;
    out.elevation = (38 - 28 * u) * deg;
    out.azimuth = (40 + 95 * u) * deg;
    out.night = 0;
    out.clockS = at(15 + 2.6 * u);
  } else if (s < nightAt) {
    const u = (s - duskAt) / CYCLE.dusk;
    out.elevation = (10 - 18 * u) * deg;
    out.azimuth = (135 + 15 * u) * deg;
    // The sun goes down in red and gold first; the dark comes after it.
    out.night = smooth((u - 0.35) / 0.65);
    out.clockS = at(17.6 + 2.4 * u);
  } else if (s < dawnAt) {
    const u = (s - nightAt) / CYCLE.night;
    out.elevation = -8 * deg;
    out.azimuth = 150 * deg;
    out.night = 1;
    out.clockS = at(20 + 4 * u);
  } else {
    // Dawn folds back into the afternoon: the night lifts with the sun already where it starts.
    const u = (s - dawnAt) / CYCLE.dawn;
    out.elevation = (-8 + 46 * smooth(u)) * deg;
    out.azimuth = 40 * deg;
    out.night = 1 - smooth(u / 0.85);
    out.clockS = at(5 + 2 * u);
  }
  out.golden = smooth((22 * deg - out.elevation) / (16 * deg)) * (1 - out.night);
  // The clothes: the scan up their bodies at dusk, down again at dawn.
  if (s < SCAN_DUSK - SCAN_S / 2) out.outfit = 0;
  else if (s < SCAN_DUSK + SCAN_S / 2) out.outfit = (s - SCAN_DUSK + SCAN_S / 2) / SCAN_S;
  else if (s < SCAN_DAWN - SCAN_S / 2) out.outfit = 1;
  else if (s < SCAN_DAWN + SCAN_S / 2) out.outfit = 1 - (s - SCAN_DAWN + SCAN_S / 2) / SCAN_S;
  else out.outfit = 0;
  return out;
}

/** Seconds into the together scene at `t` (−1 when they are apart): 0…SIT_IN he comes to sit. */
export function togetherAt(t: number): number {
  const s = ((t % LOOP) + LOOP) % LOOP;
  return s >= TOGETHER.from && s < TOGETHER.until + TOGETHER.settle ? s - TOGETHER.from : -1;
}

/** Whether a raid may start at `t`: its 90 s never overlap the two sitting together. */
export function raidAllowed(t: number): boolean {
  const s = ((t % LOOP) + LOOP) % LOOP;
  return s + 95 < TOGETHER.from || s > TOGETHER.until + TOGETHER.settle;
}
