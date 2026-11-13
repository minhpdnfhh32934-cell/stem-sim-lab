import type { GameSystem } from '../core/SystemRunner';
import type { GameState } from '../game/GameState';

// The game's time of day (Phase V): what is seen outside the hub — its sky, the city under its
// glass — follows it; nothing indoors does (the rooms stay evenly lit) and no simulation reads it.
// A day lasts 15 minutes of play; a new game starts at 08:00. Saved (v9), so a save continues the
// same hour.

/** One game day, in seconds of play. */
export const DAY_S = 900;
/** A new game's time of day (s into the day): 08:00. */
export const NEW_GAME_S = (8 / 24) * DAY_S;
/** Sunrise and sunset (hours): the sun is up between them. */
const SUNRISE_H = 6;
const SUNSET_H = 18;
/** The sun's height at noon (rad). */
const NOON_ELEVATION = (62 * Math.PI) / 180;
/** How long dawn and dusk take (hours), centred on sunrise and sunset. */
const TWILIGHT_H = 1.5;

/** The hour (0 ≤ h < 24) at `clockS` seconds into the day. */
export const hourOf = (clockS: number): number => (24 * wrap(clockS)) / DAY_S;

/** `clockS` moved on by `dt` seconds of play, kept within one day. */
export const advance = (clockS: number, dt: number): number => wrap(clockS + dt);

/** "08:00": the time of day, to the game minute. */
export function clockText(clockS: number): string {
  const minutes = Math.floor(hourOf(clockS) * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * Daylight, 0 (night) to 1 (day): smooth through dawn and dusk, each `TWILIGHT_H` long, centred on
 * sunrise and sunset.
 */
export function daylight(clockS: number): number {
  const h = hourOf(clockS);
  const up = smooth((h - (SUNRISE_H - TWILIGHT_H / 2)) / TWILIGHT_H);
  const down = smooth((SUNSET_H + TWILIGHT_H / 2 - h) / TWILIGHT_H);
  return Math.min(up, down);
}

/**
 * How much of dawn or dusk it is, 0 to 1: 1 at sunrise and sunset, 0 a twilight's length away (the
 * warm colours of the sky).
 */
export function twilight(clockS: number): number {
  const h = hourOf(clockS);
  const off = Math.min(Math.abs(h - SUNRISE_H), Math.abs(h - SUNSET_H));
  return Math.max(0, 1 - off / TWILIGHT_H);
}

/**
 * The direction to the sun (a unit vector: x east, y up, z south): rising in the east at sunrise,
 * highest in the south at noon, setting in the west; below the horizon at night.
 */
export function sunDirection(clockS: number, out: [number, number, number]): void {
  const day = (hourOf(clockS) - SUNRISE_H) / (SUNSET_H - SUNRISE_H); // 0 sunrise … 1 sunset
  const along = Math.PI * day; // east → south → west
  const elevation = Math.sin(along) * NOON_ELEVATION;
  out[0] = Math.cos(along) * Math.cos(elevation);
  out[1] = Math.sin(elevation);
  out[2] = Math.sin(along) * Math.cos(elevation) * 0.35;
  const n = Math.hypot(out[0], out[1], out[2]);
  out[0] /= n;
  out[1] /= n;
  out[2] /= n;
}

/** Moves the time of day on while the game is played (not while paused or in the menu). */
export class ClockSystem implements GameSystem {
  readonly id = 'clock';

  constructor(private readonly state: GameState) {}

  update(dt: number): void {
    if (this.state.session.phase !== 'playing') return;
    this.state.world.clockS = advance(this.state.world.clockS, dt);
  }
}

const wrap = (s: number) => ((s % DAY_S) + DAY_S) % DAY_S;
const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
