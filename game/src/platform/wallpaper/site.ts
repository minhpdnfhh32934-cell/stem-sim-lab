import { PERIOD, STREET } from '../render/city/layout';
import { CITY_DEPTH, CITY_RINGS } from '../render/city/CityView';

/*
 * Where the wallpaper stands (Phase W, Phú 2026-11-17): in the game's own city, the small one seen
 * through the hub's glass floor (`render/city`), with SimLab floating over its middle as in the
 * game — its floor CITY_DEPTH (120 m) over the street under the glass. Our tower stands just past
 * the city's south edge, across its last street, taller than anything round it, looking north;
 * the lab ahead on the left, a little over the roof, so its flat underside is seen (Phú). The roof's frame: its floor y = 0, the ledge along x at z = 0, north (the city) −z.
 */

/** The roof over the street (m): under the lab's floor (120 m), so the whole lab is seen (Phú). */
export const ROOF_HEIGHT = 100;
/** Our tower's footprint in the roof's frame (m). */
export const TOWER = { x0: -16, x1: 16, z0: -0.3, z1: 30 } as const;
/** The city's origin (the street straight under the hub glass's centre) in the roof's frame. */
export const CITY_ORIGIN = { x: -100, y: -ROOF_HEIGHT, z: -351 } as const;
/** The hub hall's centre on its floor, in the roof's frame (the glass's centre is 3 m north of it). */
export const LAB_AT = {
  x: CITY_ORIGIN.x,
  y: CITY_ORIGIN.y + CITY_DEPTH,
  z: CITY_ORIGIN.z + 3,
} as const;
/** How far the game's city reaches from its origin (m): its rings of blocks and the last street. */
export const CITY_REACH = CITY_RINGS.full.rings * PERIOD + STREET / 2;

/** The bearing (rad, + to the left of −z) from the roof's frame origin to a point. */
export function bearingTo(x: number, z: number): number {
  return Math.atan2(-x, -z);
}
