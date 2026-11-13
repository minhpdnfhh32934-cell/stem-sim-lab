import type { RoomDefinition, RoomStyle } from '../../../world/definitions';
import type { DressPart, SizeOf } from './frame';
import { greenhouse } from './greenhouse';
import { orbitalModule } from './orbital';
import { starshipDeck } from './starship';

export type { DressPart, SizeOf } from './frame';

/** Each room style's dresser (Phase U); `plain` has none. Styles still to come draw nothing. */
const STYLES: Partial<Record<RoomStyle, (room: RoomDefinition, sizeOf: SizeOf) => DressPart[]>> = {
  'starship-deck': starshipDeck,
  'orbital-module': orbitalModule,
  greenhouse,
};

/**
 * A room's dressing in its style: its modelled cladding and decoration in world coordinates, one
 * merged geometry per finish (a draw each). Decoration only: nothing here blocks or is touched.
 */
export function dressRoom(room: RoomDefinition, sizeOf: SizeOf): DressPart[] {
  return STYLES[room.style]?.(room, sizeOf) ?? [];
}
