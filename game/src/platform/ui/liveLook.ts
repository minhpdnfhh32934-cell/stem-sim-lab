import { DAY_S } from '../../world/clock';

/*
 * How the main menu looks over the live background (Phú 2026-11-18): its layout by where the view
 * has been turned to, its style by the scene's hour. Pure (tested): `liveMenu.ts` reads the
 * wallpaper's view each frame and sets what this gives as the menu's classes.
 *
 * - By the hour: day, the evening (the low golden sun and the sunset), night.
 * - By the view: behind the two (the framing: the lab over the city on the left, the panel under
 *   it), before them (turned past their left, the roof and sky behind them: the title up top, the
 *   buttons in a row along the bottom), at Linh's right side (the bare roof on the left: title and
 *   buttons down the left).
 */

export type LiveHour = 'day' | 'dusk' | 'night';
export type LiveView = 'back' | 'front' | 'side';

export interface LiveLook {
  readonly hour: LiveHour;
  readonly view: LiveView;
  /** The scene's time of day, "15:40" (its clock runs on the game's day, DAY_S long). */
  readonly clock: string;
  /** The part of the day it names: morning (5–11 h), afternoon (to 17), evening (to 20), night. */
  readonly part: 'morning' | 'afternoon' | 'evening' | 'night';
}

/** Past this much night, night; past this much gold (and not night), the evening. */
const NIGHT = 0.5;
const GOLD = 0.35;
/** Turned past these (rad, the wheel's turn is negative), before them; then at her side. */
const FRONT = -1.1;
const SIDE = -3.4;

export function liveLook(view: {
  readonly night: number;
  readonly golden: number;
  readonly clockS: number;
  readonly yaw: number;
}): LiveLook {
  const hour: LiveHour = view.night > NIGHT ? 'night' : view.golden > GOLD ? 'dusk' : 'day';
  const at: LiveView = view.yaw > FRONT ? 'back' : view.yaw > SIDE ? 'front' : 'side';
  const day = ((view.clockS % DAY_S) + DAY_S) % DAY_S;
  const minutes = Math.floor((day / DAY_S) * 1440);
  const clock = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const h = minutes / 60;
  const part =
    h >= 5 && h < 11
      ? 'morning'
      : h >= 11 && h < 17
        ? 'afternoon'
        : h >= 17 && h < 20
          ? 'evening'
          : 'night';
  return { hour, view: at, clock, part };
}
