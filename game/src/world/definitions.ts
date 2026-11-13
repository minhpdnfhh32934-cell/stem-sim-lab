import { z } from 'zod';
import { localized } from '../core/i18n';
import { ColorSchema, IdSchema, Vec3Schema } from '../core/schema';

export const ParamValueSchema = z.union([z.string(), z.number(), z.boolean()]);
export type ParamValue = z.infer<typeof ParamValueSchema>;

/** One object placed in a room. Its entity id is `<room id>/<placement id>`, stable for saves. */
export const PlacementSchema = z.object({
  id: IdSchema,
  item: IdSchema,
  position: Vec3Schema,
  rotationY: z.number().default(0),
  /** Per-instance behaviour parameters, validated against each behaviour's schema. */
  params: z.record(z.string(), ParamValueSchema).default({}),
  /** Translations of its text parameters (a door's or a control's `label`). */
  ...localized('label'),
});

/** north = −z, south = +z, east = +x, west = −x. */
export const WALLS = ['west', 'east', 'north', 'south'] as const;
export type Wall = (typeof WALLS)[number];

/**
 * A doorway-sized gap in one wall, from the floor up to `height`. The room on the other side
 * lists the same opening on its facing wall (checked at load), so each room's geometry is
 * complete on its own.
 */
export const OpeningSchema = z.object({
  wall: z.enum(WALLS),
  /** World coordinate of the opening's centre along the wall: x on north/south, z on east/west. */
  center: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

/** What a room's floor is laid with: its footsteps' sound (Phase S). */
export const FLOORS = ['vinyl', 'wood', 'tile', 'stone', 'concrete'] as const;
export type Floor = (typeof FLOORS)[number];

/**
 * How a room is dressed (Phase U): its walls' modelled cladding and decoration, drawn by the
 * renderer's style of that name (`platform/render/dress`). `plain`: the painted shell only.
 */
export const ROOM_STYLES = ['plain', 'starship-deck', 'orbital-module', 'greenhouse'] as const;
export type RoomStyle = (typeof ROOM_STYLES)[number];

export const RoomDefinitionSchema = z.object({
  id: IdSchema,
  displayName: z.string().min(1),
  ...localized('displayName'),
  bounds: z
    .object({ min: Vec3Schema, max: Vec3Schema })
    .refine((b) => b.min.every((v, i) => v < (b.max[i] ?? -Infinity)), 'min must be < max'),
  floorColor: ColorSchema.default('#9aa3ab'),
  wallColor: ColorSchema.default('#dfe5ea'),
  floor: z.enum(FLOORS).default('vinyl'),
  style: z.enum(ROOM_STYLES).default('plain'),
  /**
   * A glass area in the floor over a city far below (Phase V, the hub): its x and z ranges in the
   * room's coordinates, inside its bounds. Drawn under High and Ultra only; walked on as floor.
   */
  glassFloor: z
    .object({ x: z.tuple([z.number(), z.number()]), z: z.tuple([z.number(), z.number()]) })
    .refine((g) => g.x[0] < g.x[1] && g.z[0] < g.z[1], 'each range must run low to high')
    .optional(),
  /**
   * A darkened room (Phase T-1a: the optics room, where interference and ray optics need the
   * dark): lit by a dim fill only, no key light and so no shadows of its own.
   */
  dark: z.boolean().default(false),
  /** The sound of the room's air (a sound id of the audio bank, `content/sounds.json`). */
  ambience: IdSchema.optional(),
  openings: z.array(OpeningSchema).default([]),
  placements: z.array(PlacementSchema).default([]),
  /**
   * The room's own light (world/lighting.ts): a spot under each named fixture (a placement of
   * a glowing item) shining down, or at `target`. One `key` per room casts its shadows; `fill`
   * and `accent` light without them. `lux`: illuminance at the target; the colour is the
   * fixture's unless given. `penumbra` (0–1, default 0.6): the share of the cone that fades out at
   * its edge. `reachHeight` (m above the floor, key only, default 0): the key's cone reaches every
   * corner of the room at this height — a lab's bench tops, not only its floor (lighting polish).
   */
  lights: z
    .array(
      z.object({
        fixture: IdSchema,
        role: z.enum(['key', 'fill', 'accent']),
        lux: z.number().positive().optional(),
        target: Vec3Schema.optional(),
        color: ColorSchema.optional(),
        penumbra: z.number().min(0).max(1).optional(),
        reachHeight: z.number().min(0).optional(),
      }),
    )
    .default([]),
});

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be #rrggbb');

export const LAB_TYPES = ['physics', 'chemistry', 'biology', 'interdisciplinary'] as const;
export type LabType = (typeof LAB_TYPES)[number];

export const LaboratoryDefinitionSchema = z.object({
  id: IdSchema,
  displayName: z.string().min(1),
  ...localized('displayName'),
  type: z.enum(LAB_TYPES),
  rooms: z.array(IdSchema).min(1),
  equipment: z.array(IdSchema).default([]),
  experiments: z.array(IdSchema).default([]),
  /** The lab's colour in its experiment workspaces (#rrggbb); the interface accent otherwise. */
  accent: HexColorSchema.optional(),
  /** The surface its workspaces' stage is drawn on (#rrggbb); the dark chrome otherwise. */
  stage: HexColorSchema.optional(),
});

/** A loadable unit: either a UI-only menu or a set of rooms the player walks around in. */
export const SceneDefinitionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('menu'),
    id: IdSchema,
    displayName: z.string().min(1),
    ...localized('displayName'),
  }),
  z.object({
    kind: z.literal('world'),
    id: IdSchema,
    displayName: z.string().min(1),
    ...localized('displayName'),
    rooms: z.array(IdSchema).min(1),
    spawn: z.object({ position: Vec3Schema, yaw: z.number().default(0) }),
    /** enhanced: shadows and environment reflections (the Physics Lab); basic: as before. */
    lighting: z.enum(['basic', 'enhanced']).default('basic'),
  }),
]);

export type Placement = z.infer<typeof PlacementSchema>;
export type Opening = z.infer<typeof OpeningSchema>;
export type RoomDefinition = z.infer<typeof RoomDefinitionSchema>;
export type LaboratoryDefinition = z.infer<typeof LaboratoryDefinitionSchema>;
export type SceneDefinition = z.infer<typeof SceneDefinitionSchema>;
