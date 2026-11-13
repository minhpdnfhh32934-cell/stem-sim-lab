import { z } from 'zod';
import { localized } from '../core/i18n';
import { ColorSchema, IdSchema, Vec3Schema } from '../core/schema';
import { heldBelow } from '../simulation/liquid';
import { PROPS } from './props';

export const ITEM_CATEGORIES = [
  'furniture',
  'structure',
  'equipment',
  'tool',
  'material',
  'sample',
  'ppe',
] as const;

/**
 * Surface look of a placeholder primitive: matte (the default, as before) · satin · metal (bare
 * steel) · glass (see-through) · light (glows, e.g. ceiling panels) · painted (painted or
 * powder-coated metal, e.g. stands and frames) · plastic (laminate, moulded parts) · rubber
 * (knobs, pads).
 */
export const MATERIALS = [
  'matte',
  'satin',
  'metal',
  'glass',
  'light',
  'painted',
  'plastic',
  'rubber',
] as const;

/** Where PPE is worn; decides how wearing it shows (sleeves, hands, goggles view, shield). */
export const WORN_ON = ['body', 'hands', 'eyes', 'face'] as const;
/** Kinds of physical-lab vessel the renderer can draw (`container.vessel`). */
export const VESSELS = [
  'pipette',
  'volumetric-flask',
  'reagent-bottle',
  'wash-bottle',
  'cuvette',
  'burette',
  'conical-flask',
  'dropper-bottle',
] as const;
export type WornOn = (typeof WORN_ON)[number];

const Size = z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]);

/**
 * A vessel that holds liquid in the physical lab (`docs/physical-lab-architecture.md` §2.2).
 * Its contents are not item data: the placement gives the first (`material`, `fill`), the game
 * state the current (`GameState.world.containers`). Points are in its frame from its centre.
 */
const ContainerSchema = z.object({
  /** Brim volume (mL): geometry. */
  capacityMl: z.number().positive(),
  /** The mark of volumetric glassware (mL): it takes liquid up to here. Default: the brim. */
  fillLimitMl: z.number().positive().optional(),
  /** Inner lathe profile [radius, height] (m), bottom up: level mapping and drawing. */
  profile: z
    .array(z.tuple([z.number().nonnegative(), z.number()]))
    .min(2)
    .optional(),
  /** Its opening, where poured liquid is received. None: it receives nothing. */
  mouth: z
    .object({
      center: Vec3Schema,
      radius: z.number().positive(),
      /**
       * AFFORDANCE: how far (m) a spout may be off the mouth's centre and still pour in, an
       * aim help with no scientific effect. Provisional, to be tuned in a manual player
       * session (time to hit the mouth). Default: `radius`.
       */
      captureRadius: z.number().positive().optional(),
    })
    .optional(),
  /** It pours while held: tipped past `minTiltDeg`, or squeezed (a wash bottle's nozzle). */
  pour: z
    .object({
      /** Where liquid leaves it (a wash bottle: the nozzle tip). */
      spout: Vec3Schema,
      trigger: z.enum(['tilt', 'squeeze']),
      minTiltDeg: z.number().min(0).max(150).default(70),
      /** Below 150°, where a closed vessel's turn counts as an inversion. */
      fullTiltDeg: z.number().positive().max(149).default(115),
      /** AFFORDANCE: pacing (mL/s at full tilt or squeeze), never a model input. */
      rateMlPerS: z.number().positive(),
    })
    .refine((p) => p.fullTiltDeg > p.minTiltDeg, {
      message: 'fullTiltDeg must be above minTiltDeg',
      path: ['fullTiltDeg'],
    })
    .optional(),
  /** A volumetric pipette: it fills to, and delivers, exactly this (mL). */
  measured: z.object({ volumeMl: z.number().positive() }).optional(),
  /**
   * A dropper bottle: E over a vessel's mouth lets `count` drops of `volumeMl` each fall into it.
   * SPEC GAP: no definition gives a drop's volume; it is bookkeeping (the level drawn), and no
   * model reads it (an indicator's volume is not a titration input).
   */
  drops: z.object({ volumeMl: z.number().positive(), count: z.int().positive() }).optional(),
  /**
   * A burette's stopcock: while open, and the burette held in its clamp, liquid runs from `tip`
   * into the vessel below at the rate its experiment's model takes (no rate here: one source).
   */
  tap: z.object({ tip: Vec3Schema }).optional(),
  /** It has a stopper or cap (entity state `closed`). */
  closable: z.boolean().default(false),
  /**
   * What kind of vessel it looks like (render/vessels.ts: a pipette's bulb print, a bottle's cap
   * and label, a flask's print and stopper, a wash bottle's tube, a square cuvette). Presentation
   * only: no rule or model reads it.
   */
  vessel: z.enum(VESSELS).optional(),
});

/**
 * Data-only description of a kind of object. Behaviour comes from the interaction behaviours
 * listed in `interactions` (ids from the behaviour registry), never from code that checks ids.
 * Weight is not stored: it is derived as mass × gravity where a system needs it.
 */
export const ItemDefinitionSchema = z
  .object({
    id: IdSchema,
    displayName: z.string().min(1),
    description: z.string().default(''),
    ...localized('displayName', 'description'),
    category: z.enum(ITEM_CATEGORIES),
    tags: z.array(z.string().min(1)).default([]),
    physical: z.object({
      /** Authoritative mass; the collider's density is derived from it and the shape volume. */
      massKg: z.number().positive(),
      /**
       * static: immovable collider · dynamic: simulated by gravity and contacts · kinematic: moved by
       * the game, pushing what it meets (a walk-through door's leaf: only with `door`) · none: visual
       * only.
       */
      body: z.enum(['static', 'dynamic', 'kinematic', 'none']).default('static'),
      friction: z.number().min(0).max(2).default(0.5),
      restitution: z.number().min(0).max(1).default(0.2),
      linearDamping: z.number().min(0).max(10).default(0),
      angularDamping: z.number().min(0).max(10).default(0.05),
      /** Continuous collision detection, for small objects that can move fast enough to tunnel. */
      ccd: z.boolean().default(false),
      /** May be thrown while held (items opt into holding with the `grab` interaction). */
      throwable: z.boolean().default(false),
      /**
       * How it is held and let go (glassware: a container's). free: as any object — held at the
       * orientation it was grabbed in, dropped where it is held · set-down: held upright (it
       * keeps its heading as the view turns, tilted on demand), and only set down at an aimed,
       * checked spot, never dropped or thrown · upright: as set-down, and at rest it may turn
       * about +y but never topples (a let-go that leaves it tipped is stood up first).
       */
      handling: z.enum(['free', 'set-down', 'upright']).default('free'),
    }),
    interactions: z.array(IdSchema).default([]),
    /**
     * Where a hand works it (Phase H-3; drawn only: no rule reads it), from its centre in its own
     * frame: a faucet's handle, under a dispenser's nozzle, under a basin's tap, a bin's opening.
     * An action acted out on it reaches there, and the player leans in to it. Absent: its centre
     * (a walk-through door: its card reader, `gameplay/action/handPoint.ts`).
     */
    handAt: Vec3Schema.optional(),
    /**
     * Where a person holds it (Phase H-2; drawn only: no rule or model reads it). The right hand
     * closes at `at` (from the item's centre, in its frame), `radius` m from that point across the
     * view (default: the item's half width there); with `other`, the left hand closes there too —
     * both hands, for long or heavy items. `pose`: the fingers wrap round it or pinch it.
     */
    grip: z
      .object({
        at: Vec3Schema.default([0, 0, 0]),
        other: Vec3Schema.optional(),
        radius: z.number().positive().optional(),
        pose: z.enum(['wrap', 'pinch']).default('wrap'),
      })
      .optional(),
    /** PPE: where it is worn. Worn, it shows in its `visual.color` (e.g. blue gloves). */
    wornOn: z.enum(WORN_ON).optional(),
    /**
     * PPE used once (nitrile gloves): once worn it is used, so it is never taken off where it came
     * from (a dispenser) — it is discarded into a waste bin (the `waste-bin` behaviour).
     */
    disposable: z.boolean().default(false),
    /**
     * Can be carried in the inventory: put away from the hands, up to `stack` in a slot.
     * `decorative`: nothing in the lab uses it (no experiment, no procedure), and it is shown so.
     * `virtual`: only ever in the bag (Phase Y-5, a test paper): given to the player, never placed
     * in a room, held or taken out — each instance is known by its own id.
     * `ruled`: a sheet with ruled lines (a test paper): its picture in a slot shows them.
     */
    inventory: z
      .object({
        stack: z.number().int().min(1).max(64).default(1),
        decorative: z.boolean().default(false),
        virtual: z.boolean().default(false),
        ruled: z.boolean().default(false),
      })
      .optional(),
    /**
     * A walk-through door's leaf: with the door of another scene that is its arrival, back to back
     * through their wall, it slides `travel` m along its own +x when the pair opens (in `openS` s)
     * and back when it closes (`closeS` s), the doorway behind it open in both walls. The DoorSystem
     * decides when; physics moves it (`physical.body` "kinematic").
     */
    door: z
      .object({
        travel: z.number().positive(),
        openS: z.number().positive(),
        closeS: z.number().positive(),
      })
      .optional(),
    /**
     * A sliding leaf of a door between two rooms of one scene (Phase U, Phú: a starship's door, two
     * leaves parting from the middle): it slides `travel` m along its own +x as it opens (in
     * `openS` s) and back (`closeS` s). It opens by itself while the player is within `near` m of
     * its meeting edge (its −x edge, the doorway's middle) and closes once they have gone, never
     * onto the player or an object in the doorway. The SlidingSystem decides; physics moves it
     * (`physical.body` "kinematic").
     */
    slider: z
      .object({
        travel: z.number().positive(),
        openS: z.number().positive(),
        closeS: z.number().positive(),
        near: z.number().positive().default(2),
      })
      .optional(),
    /**
     * Hinged leaves (UX3.1: a cabinet's doors, the washroom door) that swing `angleDeg` open in
     * `swingS` s while the item's `open` state is true (the HingeSystem decides, eased; physics
     * turns each leaf's kinematic body; the prop's leaf parts are drawn turned alike). Leaves and
     * `carcass` are boxes in the item's frame from its centre, closed: `carcass` the item's own
     * colliders (none: only its leaves are solid), `hinge` each leaf's hinge line (x, z), `opens`
     * the sign of its opening turn about +y (its free edge moves to the item's +z). Needs
     * `physical.body` "static".
     */
    hinged: z
      .object({
        angleDeg: z.number().positive().max(180),
        swingS: z.number().positive(),
        leaves: z
          .array(
            z.object({
              center: Vec3Schema,
              size: Size,
              hinge: z.tuple([z.number(), z.number()]),
              opens: z.union([z.literal(1), z.literal(-1)]),
            }),
          )
          .min(1)
          .max(2),
        carcass: z.array(z.object({ center: Vec3Schema, size: Size })).default([]),
      })
      .optional(),
    /**
     * Projectile launchers: the launch point (`muzzle`, from the item's base centre in its own
     * frame; +x is the launch direction) is also the barrel's pivot, so the launch height does not
     * change with the angle. The barrel (drawn from this) reaches back from it.
     */
    launcher: z
      .object({
        muzzle: Vec3Schema,
        barrelLength: z.number().positive(),
        barrelDiameter: z.number().positive(),
      })
      .optional(),
    /**
     * Pendulum stands: the `pivot` (from the item's base centre in its own frame) and the bob that
     * hangs from it on a light rigid rod. It swings in the item's x–y plane (positive angles towards
     * +x). The bob is part of the apparatus — drawn from the experiment, no physics body; its mass
     * only enters the energies.
     */
    pendulum: z
      .object({
        pivot: Vec3Schema,
        bobRadius: z.number().positive(),
        bobMass: z.number().positive(),
      })
      .optional(),
    /**
     * Free-fall towers: the item's box is the column; `landing` is where the ball's lowest point
     * meets the floor (from the item's base centre in its own frame), straight below the release
     * clamp. Like the bob, the ball is part of the apparatus — drawn from the experiment, no physics
     * body.
     */
    dropTower: z
      .object({
        landing: Vec3Schema,
        ballRadius: z.number().positive(),
      })
      .optional(),
    /**
     * Spring stands: the `hook` the spring hangs from (from the item's base centre in its own
     * frame), the spring's `naturalLength`, its `elasticLimit` (the most extension, m, it takes and
     * stays elastic) and the side of the `weight` that hangs from it. Like the bob, the spring and
     * the weight are part of the apparatus — drawn from the experiment, no physics body.
     */
    springStand: z
      .object({
        hook: Vec3Schema,
        naturalLength: z.number().positive(),
        elasticLimit: z.number().positive(),
        weight: z.number().positive(),
      })
      .optional(),
    /**
     * Bench apparatus (a circuit board, an optics bench, a burette, a heating plate…): drawn by
     * the renderer's bench model `model` (its render key, kebab-case:
     * `platform/render/bench/registry.ts`), its moving parts posed from the experiment — no
     * physics body but the item's box. `top` is where the rig stands (from the item's base
     * centre in its own frame), e.g. the middle of a bench top.
     */
    bench: z.object({ model: IdSchema, top: Vec3Schema }).optional(),
    /**
     * A part for the free circuit bench (`gameplay/circuit`): plugged between two neighbouring
     * holes of a circuit board, its `kind` decides what it is in the circuit. `ohms`: a resistor's
     * or fuse's resistance, a cell's internal resistance, a rheostat's full track, a meter's own;
     * `volts`/`watts`: a lamp's rating, `volts` a cell's EMF; `amps`: a fuse's rating or a meter's
     * range; `range` a voltmeter's (V); `ratedWatts`: what a resistor may dissipate.
     * `heat`: how it heats (Phase E-2, `simulation/circuitHeat`: heat capacity J/K, thermal
     * resistance K/W, the rises in K at which it smokes, fails open and catches fire); `life`: a
     * lamp's rated life (s) at its rated voltage.
     */
    circuit: z
      .object({
        kind: z.enum([
          'resistor',
          'lamp',
          'cell',
          'switch',
          'rheostat',
          'fuse',
          'ammeter',
          'voltmeter',
        ]),
        ohms: z.number().positive().optional(),
        volts: z.number().positive().optional(),
        watts: z.number().positive().optional(),
        amps: z.number().positive().optional(),
        ratedWatts: z.number().positive().optional(),
        heat: z
          .object({
            capacity: z.number().positive(),
            resistance: z.number().positive(),
            smoke: z.number().positive().optional(),
            fail: z.number().positive().optional(),
            ignite: z.number().positive().optional(),
          })
          .optional(),
        life: z.number().positive().optional(),
      })
      .optional(),
    /**
     * It burns (Phase E-2, `gameplay/fire`): a fire near it for `ignitionS` seconds (weighted by
     * the fire's size) sets it alight. Illustrative: no fire-safety model.
     */
    burns: z.object({ ignitionS: z.number().positive() }).optional(),
    /**
     * Furniture to rest on (Phase F-1): `sit` (a bench, a chair) or `lie` (a bed), its places
     * (`at`, from its centre in its frame: a seat's top, a mattress's top at the pillow) and, for
     * a bed, `yaw` the way the body lies (from the head, in its frame).
     */
    rest: z
      .object({
        kind: z.enum(['sit', 'lie']),
        spots: z.array(z.object({ at: Vec3Schema, yaw: z.number().optional() })).min(1),
      })
      .optional(),
    /** Held this far (m) to the right of the view and lower: [right, down] (an extinguisher). */
    heldAside: z.tuple([z.number(), z.number().nonnegative()]).optional(),
    /**
     * A portable extinguisher (Phase E-2): held, the left mouse button sprays it for `seconds` in
     * all, reaching `range` m.
     */
    extinguisher: z
      .object({ seconds: z.number().positive(), range: z.number().positive() })
      .optional(),
    /**
     * A circuit board with its own bench supply (`gameplay/circuit`): `cols` × `rows` holes
     * `pitch` m apart on its top face, the grid centred at `gridAt` (x, z in its frame); the
     * supply's + and − posts at `posts` (x, z each) and its panel (aimed at to set it) at
     * `panel` [x0, z0, x1, z1]. The supply gives 0 to `maxVolts` in `step`s, at most `limit` A.
     */
    circuitBoard: z
      .object({
        cols: z.number().int().min(2).max(16),
        rows: z.number().int().min(2).max(12),
        pitch: z.number().positive(),
        gridAt: z.tuple([z.number(), z.number()]),
        posts: z.tuple([z.tuple([z.number(), z.number()]), z.tuple([z.number(), z.number()])]),
        panel: z.tuple([z.number(), z.number(), z.number(), z.number()]),
        maxVolts: z.number().positive(),
        step: z.number().positive(),
        limit: z.number().positive(),
      })
      .optional(),
    /**
     * A static item's own colliders, boxes in its frame from its centre (none: its visual box),
     * so a low part beside a tall one is a real surface (a tile beside an instrument). A hinged
     * item's are its `carcass`.
     */
    colliders: z
      .array(z.object({ center: Vec3Schema, size: Size }))
      .min(1)
      .optional(),
    /**
     * Places on a static item that a set-down snaps into (a tile, a slot): `center` (its frame,
     * from its centre) on the top face of one of its `colliders`; an object set down within
     * `radius` m of it goes there if its item has one of the `accepts` tags, and is refused if not.
     */
    seats: z
      .array(
        z.object({
          id: IdSchema,
          center: Vec3Schema,
          radius: z.number().positive(),
          accepts: z.array(z.string().min(1)).min(1),
        }),
      )
      .min(1)
      .optional(),
    /**
     * Clamps that hold a vessel off any surface (a retort stand's burette clamp): E while holding
     * an item with one of the `accepts` tags puts it there, upright, its centre at `center` (in
     * this item's frame); it stays until taken out. A clamp that slides on its rod has a `lowered`
     * centre too: it starts there (a burette filled below the eye) and is raised to `center`. The
     * rule is its station's (StationSystem).
     */
    clamps: z
      .array(
        z.object({
          id: IdSchema,
          center: Vec3Schema,
          lowered: Vec3Schema.optional(),
          accepts: z.array(z.string().min(1)).min(1),
        }),
      )
      .min(1)
      .optional(),
    container: ContainerSchema.optional(),
    visual: z
      .object({
        /** Placeholder primitive until real models exist (Phase 14). Also the collider shape. */
        shape: z.enum(['box', 'sphere', 'cylinder']),
        /** Full extents in metres. Sphere: diameter on every axis; cylinder: x = z = diameter. */
        size: Size,
        color: ColorSchema,
        /**
         * While its `open` state is true, its collider and interaction box are this box instead of
         * the whole item (`center` from the item's centre, in its own frame): a cabinet's back once
         * its doors swing open, so what is inside can be reached. The item never moves.
         */
        openBox: z.object({ center: Vec3Schema, size: Size }).optional(),
        /**
         * A stream (e.g. water) falling `length` m from `from` (its spout's mouth, from the item's
         * centre in its own frame; default the bottom centre) onto what is below, drawn while its
         * `running` state is true.
         */
        stream: z
          .object({
            length: z.number().positive(),
            color: ColorSchema,
            from: Vec3Schema.optional(),
          })
          .optional(),
        material: z.enum(MATERIALS).default('matte'),
        /** Fixed text printed on the front (+z) face, e.g. a sign; lines split by "\n". */
        label: z
          .object({
            text: z.string().min(1),
            color: ColorSchema.default('#1d2731'),
            background: ColorSchema.default('#f4f6f8'),
            ...localized('text'),
          })
          .optional(),
        /** A live display on the front face, drawn from the station named by the placement. */
        screen: z.enum(['status', 'graph']).optional(),
        /**
         * A see-through glass display shown only near the player (Phú, Phase T-1a): `rise`
         * rolls up out of its slot (a results screen), `overhead` fades in tilted down towards
         * the player (an instruction panel hung over its station). Shown within `radius` m (on
         * the floor), gone past it plus 0.4 m. Drawing only: aiming and actions are unchanged.
         */
        reveal: z
          .object({
            kind: z.enum(['rise', 'overhead']),
            radius: z.number().positive().default(3),
          })
          .optional(),
        /**
         * A station control drawn as a model inside the box (`platform/render/consoleModel.ts`)
         * instead of the plain primitive; the box stays the collider and the interaction box.
         */
        model: z.enum(['desk', 'push-button', 'knob', 'display']).optional(),
        /**
         * Furniture or architecture drawn as a model inside the box (`platform/render/props`)
         * instead of the plain primitive; the box stays the collider and the aim box.
         */
        prop: z.enum(PROPS).optional(),
      })
      .refine(
        ({ shape, size: [w, h, d] }) =>
          shape === 'box' || (shape === 'sphere' ? w === h && w === d : w === d),
        {
          message: 'sphere needs equal size on every axis; cylinder needs equal x and z',
          path: ['size'],
        },
      )
      .refine(({ prop, model }) => !(prop && model), {
        message: 'a prop or a control model, not both',
        path: ['prop'],
      }),
  })
  // Only a door leaf is moved by the game, and a door leaf only by it.
  .superRefine(
    (
      {
        physical,
        door,
        slider,
        hinged,
        colliders,
        seats,
        container,
        interactions,
        visual,
        grip,
        handAt,
      },
      ctx,
    ) => {
      const issue = (path: (string | number)[], message: string) =>
        ctx.addIssue({ code: 'custom', path, message });
      const [w, h, d] = visual.size;
      for (const key of ['at', 'other'] as const) {
        const p = grip?.[key];
        if (p && (Math.abs(p[0]) > w / 2 || Math.abs(p[1]) > h / 2 || Math.abs(p[2]) > d / 2)) {
          issue(['grip', key], 'outside the item box');
        }
      }
      // A hand point is on it or just by it (under a nozzle): within 0.3 m of its box.
      if (handAt && handAt.some((v, i) => Math.abs(v) > (visual.size[i] ?? 0) / 2 + 0.3)) {
        issue(['handAt'], 'more than 0.3 m outside the item box');
      }
      if (grip && (physical.body !== 'dynamic' || !interactions.includes('grab'))) {
        issue(['grip'], '"grip" needs a dynamic body and "grab"');
      }
      if (physical.handling !== 'free' && (physical.body !== 'dynamic' || physical.throwable)) {
        issue(['physical', 'handling'], `"${physical.handling}" needs a dynamic, unthrowable body`);
      }
      if (container) containerProblems(container, physical, interactions, visual.size, issue);
      if (colliders && (physical.body !== 'static' || hinged)) {
        issue(['colliders'], '"colliders" needs physical.body "static" (a hinged item: "carcass")');
      }
      seats?.forEach(({ id, center: [x, y, z] }, i) => {
        if (seats.findIndex((s) => s.id === id) !== i) issue(['seats', i, 'id'], 'duplicate seat');
        // On top of one of its colliders (± 1 mm), inside that box's footprint.
        const onTop = colliders?.some(
          ({ center: [cx, cy, cz], size: [w, h, d] }) =>
            Math.abs(y - (cy + h / 2)) <= 0.001 &&
            Math.abs(x - cx) <= w / 2 &&
            Math.abs(z - cz) <= d / 2,
        );
        if (!onTop)
          issue(['seats', i, 'center'], 'a seat needs the top face of one of "colliders"');
      });
      if (hinged && physical.body !== 'static') {
        ctx.addIssue({
          code: 'custom',
          path: ['hinged'],
          message: '"hinged" needs physical.body "static"',
        });
      }
      if (physical.body === 'kinematic' && !door && !slider) {
        ctx.addIssue({
          code: 'custom',
          path: ['physical', 'body'],
          message: '"kinematic" needs "door" or "slider"',
        });
      } else if ((door || slider) && physical.body !== 'kinematic') {
        ctx.addIssue({
          code: 'custom',
          path: [door ? 'door' : 'slider'],
          message: `"${door ? 'door' : 'slider'}" needs physical.body "kinematic"`,
        });
      }
      if (door && slider) {
        ctx.addIssue({ code: 'custom', path: ['slider'], message: 'a door or a slider, not both' });
      }
    },
  );

export type ItemDefinition = z.infer<typeof ItemDefinitionSchema>;
export type ContainerDefinition = NonNullable<ItemDefinition['container']>;

/**
 * A container's own rules: one that pours or measures is carried glassware (dynamic, held upright,
 * `grab`); one that only receives may stand on a static item (a colorimeter's cuvette). Its mark
 * is within its brim, its points inside its box, and its profile holds its brim volume.
 */
function containerProblems(
  c: z.output<typeof ContainerSchema>,
  physical: { body: string; handling: string },
  interactions: readonly string[],
  size: readonly [number, number, number],
  issue: (path: (string | number)[], message: string) => void,
): void {
  if ((c.pour || c.measured) && (physical.body !== 'dynamic' || !interactions.includes('grab'))) {
    issue(['container'], 'a container that pours or measures needs a dynamic body and "grab"');
  }
  if (physical.body === 'dynamic' && physical.handling === 'free') {
    issue(['physical', 'handling'], 'a carried container is held upright: not "free"');
  }
  if (c.fillLimitMl !== undefined && c.fillLimitMl > c.capacityMl) {
    issue(['container', 'fillLimitMl'], 'the mark must be within the brim (capacityMl)');
  }
  if (c.measured && c.measured.volumeMl > c.capacityMl) {
    issue(['container', 'measured'], 'it cannot measure more than it holds');
  }
  const inside = ([x, y, z]: readonly number[]) =>
    Math.abs(x ?? 0) <= size[0] / 2 + 0.001 &&
    Math.abs(y ?? 0) <= size[1] / 2 + 0.001 &&
    Math.abs(z ?? 0) <= size[2] / 2 + 0.001;
  if (c.mouth && !inside(c.mouth.center)) issue(['container', 'mouth'], 'outside the item box');
  if (c.pour && !inside(c.pour.spout))
    issue(['container', 'pour', 'spout'], 'outside the item box');
  if (c.tap && !inside(c.tap.tip)) issue(['container', 'tap', 'tip'], 'outside the item box');
  if (c.mouth?.captureRadius !== undefined && c.mouth.captureRadius < c.mouth.radius) {
    issue(['container', 'mouth', 'captureRadius'], 'smaller than the mouth itself');
  }
  if (c.profile) {
    const held = heldBelow(c.profile);
    if ((held[held.length - 1] ?? 0) < c.capacityMl - 1e-6) {
      issue(['container', 'profile'], `its inside holds less than ${c.capacityMl} mL`);
    }
  }
}
