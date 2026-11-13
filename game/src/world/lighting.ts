import type { Vec3 } from '../core/math';
import type { ItemDefinition } from '../gameplay/item';
import type { RoomDefinition } from './definitions';

/**
 * How many room lights the renderer keeps (a fixed pool, so the shaders never change when a door
 * opens): `key` spots cast shadows, the `other` ones (fill, accent) do not. Every scene and every
 * pair of scenes a door joins must fit (checked at boot); a third scene left open beyond that is
 * drawn without its lights. `other` 8 since Phase T-1a (was 6): the 18 m Physics Lab's teacher
 * corner and its cabinets lay outside every cone (Phú, 2026-11-05: every lab clearly lit); two
 * more spots cost every room-lit material (Medium up), to measure on a GPU.
 */
export const LIGHT_SLOTS = { key: 4, other: 8 } as const;

/** Floor illuminance (lux-like units, as the old sun's 2.2) of each role when content omits it. */
export const DEFAULT_LUX = { key: 3, fill: 1.2, accent: 2 } as const;
/** The share of a cone that fades out at its edge, when content omits it. */
export const DEFAULT_PENUMBRA = 0.6;

const MAX_KEY_ANGLE = (75 * Math.PI) / 180;
const OTHER_ANGLES = [(20 * Math.PI) / 180, (60 * Math.PI) / 180] as const;

/** A room light as the renderer places it, in the room's (world) coordinates. */
export interface RoomLight {
  readonly roomId: string;
  readonly role: 'key' | 'fill' | 'accent';
  /** Just under the fixture's centre. */
  readonly position: Vec3;
  readonly target: Vec3;
  readonly color: string;
  /** Candela: `lux` at `target`, falling off with the square of the distance (three's decay 2). */
  readonly intensity: number;
  /** Half-angle of the cone (rad). */
  readonly angle: number;
  /** The share of the cone that fades out at its edge (three's `SpotLight.penumbra`). */
  readonly penumbra: number;
  /** Where the light ends (m): past the room it lights. */
  readonly range: number;
}

/**
 * The lights of `room`, from its `lights`: a spot under each named fixture shining down (or at
 * `target`). The key's cone reaches every corner of the room at `reachHeight` (the floor by
 * default), and the room's walls cast its shadows, so it stays in the room. A fill or accent has no shadows, so its cone is kept inside
 * the room's walls. The colour is the fixture's own unless given.
 */
export function roomLights(
  room: RoomDefinition,
  itemOf: (id: string) => ItemDefinition | undefined,
): RoomLight[] {
  const { min, max } = room.bounds;
  return room.lights.flatMap((light): RoomLight[] => {
    const fixture = room.placements.find((p) => p.id === light.fixture);
    const item = fixture && itemOf(fixture.item);
    if (!fixture || !item) return []; // never: checked at boot
    const [x, y, z] = fixture.position;
    const position: Vec3 = [x, y - 0.02, z];
    const target: Vec3 = light.target ? [...light.target] : [x, min[1], z];
    const height = Math.hypot(
      position[0] - target[0],
      position[1] - target[1],
      position[2] - target[2],
    );
    let angle: number;
    let range: number;
    if (light.role === 'key') {
      let reach = 0;
      for (const cx of [min[0], max[0]]) {
        for (const cz of [min[2], max[2]]) reach = Math.max(reach, Math.hypot(cx - x, cz - z));
      }
      angle = Math.min(Math.atan2(reach, height - (light.reachHeight ?? 0)), MAX_KEY_ANGLE);
      range = Math.hypot(reach, height) * 1.1;
    } else {
      const inside = Math.min(x - min[0], max[0] - x, z - min[2], max[2] - z);
      angle = Math.min(Math.max(Math.atan2(inside, height), OTHER_ANGLES[0]), OTHER_ANGLES[1]);
      range = (height / Math.cos(angle)) * 1.2;
    }
    const lux = light.lux ?? DEFAULT_LUX[light.role];
    return [
      {
        roomId: room.id,
        role: light.role,
        position,
        target,
        color: light.color ?? item.visual.color,
        intensity: lux * height * height,
        angle,
        penumbra: light.penumbra ?? DEFAULT_PENUMBRA,
        range,
      },
    ];
  });
}
