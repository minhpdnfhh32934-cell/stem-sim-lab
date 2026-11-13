import { z } from 'zod';
import { localized } from '../core/i18n';
import { ColorSchema, IdSchema } from '../core/schema';

/** Hair styles the body is drawn with. */
export const HAIR_STYLES = [
  'short',
  'ponytail',
  'spiky',
  'bob',
  'long',
  'bun',
  'curly',
  'sidePart',
  /** Drawn from its own measures (`hairDesign`): a face made from a photo (2026-11-12). */
  'photo',
] as const;

/**
 * The face's proportions (1: the drawn face as it is): the head's width and length, the jaw's
 * width, the chin's depth below the mouth, the eyes' size and how far apart they are, how low the
 * nose and the mouth sit. Made from a photo (2026-11-12) or left at 1.
 */
export const FaceShapeSchema = z.object({
  width: z.number().min(0.85).max(1.15).default(1),
  length: z.number().min(0.85).max(1.15).default(1),
  jaw: z.number().min(0.8).max(1.2).default(1),
  chin: z.number().min(0.8).max(1.2).default(1),
  eyeSize: z.number().min(0.8).max(1.25).default(1),
  eyeSpacing: z.number().min(0.88).max(1.12).default(1),
  nose: z.number().min(0.85).max(1.15).default(1),
  mouth: z.number().min(0.85).max(1.15).default(1),
});
export type FaceShape = z.infer<typeof FaceShapeSchema>;

/**
 * A hairstyle drawn from its measures (the `photo` style): how long (0 cropped, 0.45 to the jaw,
 * 0.7 to the shoulders, 1 down the back), how much fringe covers the forehead (0–1), where it is
 * parted (−1 on the left, 0 in the middle, 1 on the right), how full (0–1) and how curly (0–1).
 */
export const HairDesignSchema = z.object({
  length: z.number().min(0).max(1).default(0.3),
  fringe: z.number().min(0).max(1).default(0.6),
  parting: z.number().min(-1).max(1).default(0),
  volume: z.number().min(0).max(1).default(0.4),
  curl: z.number().min(0).max(1).default(0),
});
export type HairDesign = z.infer<typeof HairDesignSchema>;

/** A character's own pose when chosen, struck at the front of the character page. */
export const SIGNATURE_POSES = [
  'arms-crossed',
  'wave',
  'thumbs-up',
  'notes',
  'hands-on-hips',
  'presenting',
  'thinking',
  'peace',
] as const;

/** What the body wears under any PPE (presentation only). */
const ClothesSchema = z.object({
  /** Shirt or blouse (and a skirt's, when `skirt`). */
  top: ColorSchema,
  /** Trousers, or the legs' tights under a skirt. */
  bottom: ColorSchema,
  shoes: ColorSchema,
  /** The tie, or the collar's trim. */
  accent: ColorSchema,
  /**
   * A shirt's tie or trimmed collar, a sweater's round neck, a hoodie's hood, a school shirt's bow
   * (in the accent).
   */
  neck: z.enum(['tie', 'collar', 'crew', 'hood', 'bow']),
  /** The top goes on as a dress to the knee, over tights of `bottom`. */
  skirt: z.boolean(),
  // C-10 (Phú 2026-11-08, after his reference picture): what else is worn, and where skin shows.
  /** The top's sleeves: long, short (to mid upper arm), none (bare arms). */
  sleeves: z.enum(['long', 'short', 'none']).default('long'),
  /** The top ends under the bust: the midriff bare. */
  crop: z.boolean().default(false),
  /**
   * Worn over the top, in `jacketColour` with `jacketTrim` (stripes, zips, straps): an open zip
   * jacket to the hips, a short jacket ending above the waist, a sleeveless tactical vest, a knit
   * V-neck vest.
   */
  jacket: z.enum(['none', 'zip', 'cropped', 'vest', 'sweaterVest']).default('none'),
  jacketColour: ColorSchema.default('#1f2228'),
  jacketTrim: ColorSchema.default('#e6c46a'),
  /**
   * What the `bottom` colour makes below the waist (no dress): straight trousers, baggy joggers
   * gathered above the ankle, cargo trousers with side pockets, shorts, a pleated skirt.
   */
  legs: z.enum(['trousers', 'joggers', 'cargo', 'shorts', 'pleated']).default('trousers'),
  /** On legs that shorts or a skirt leave bare: nothing, tights, or stockings to mid-thigh. */
  legwear: z.enum(['none', 'tights', 'thighHighs']).default('none'),
  legwearColour: ColorSchema.default('#1f2228'),
  footwear: z
    .enum(['sneakers', 'loafers', 'heels', 'boots', 'kneeBoots', 'thighBoots'])
    .default('sneakers'),
  /** Fingerless gloves; long ones (to the upper arm, fingerless) in the trim's black. */
  gloves: z.enum(['none', 'fingerless', 'long']).default('none'),
  choker: z.boolean().default(false),
  /** A bandage wound round the right forearm. */
  bandage: z.boolean().default(false),
  /** The right knee of the trousers torn open. */
  ripped: z.boolean().default(false),
  /** A round emblem on the chest (in the accent). */
  logo: z.boolean().default(false),
  /** Colour blocks: the forearms of the sleeves and the front pocket in the accent. */
  blocks: z.boolean().default(false),
});

/** What the body wears (presentation only). */
export type Clothes = z.infer<typeof ClothesSchema>;

/**
 * A playable character. Gender is presentation data only — no gameplay rule may branch on it.
 * Anything that affects play (e.g. eye height) is derived from appearance values instead.
 */
export const CharacterDefinitionSchema = z.object({
  id: IdSchema,
  displayName: z.string().min(1),
  gender: z.enum(['male', 'female', 'unspecified']),
  appearance: z.object({
    heightM: z.number().min(1.2).max(2.2),
    skinTone: ColorSchema,
    hairColor: ColorSchema,
    /** Build: shoulder and hip widths (m, outer), the body's proportions (presentation only). */
    shoulderM: z.number().min(0.3).max(0.6).default(0.41),
    hipM: z.number().min(0.25).max(0.5).default(0.35),
    /** The waist's width (m) and the chest's extra depth at the bust (m; 0: none). */
    waistM: z.number().min(0.2).max(0.45).default(0.31),
    bustM: z.number().min(0).max(0.06).default(0),
    /** Girth of the limbs, neck and torso (1: average; below slim, above heavy-set). */
    build: z.number().min(0.75).max(1.4).default(1),
    /** Muscle (0–1): shoulders, chest, arms and calves filled out. */
    muscle: z.number().min(0).max(1).default(0),
    /** A wristwatch on the left wrist; small earrings. */
    watch: z.boolean().default(false),
    earrings: z.boolean().default(false),
    /** Hair style the body is drawn with (presentation only). */
    hair: z.enum(HAIR_STYLES).default('short'),
    eyeColor: ColorSchema.default('#4a3426'),
    /** Drawn eyelashes over the upper lid. */
    lashes: z.boolean().default(false),
    /** Rosy cheeks and a little smile. */
    blush: z.boolean().default(false),
    /**
     * An alluring face (C-10, Phú): half-lidded eyes flicked up at the corners under heavier lash
     * lines, a fuller mouth with a smile on one side, deeper lips, a beauty mark under one eye.
     */
    allure: z.boolean().default(false),
    /** Clear glasses, or dark sunglasses ('shades') in a square frame. */
    glasses: z.enum(['none', 'round', 'square', 'shades']).default('none'),
    /** A short beard along the jaw, in the hair's colour. */
    beard: z.boolean().default(false),
    /** The face's proportions (made from a photo; all 1 by default). */
    face: FaceShapeSchema.prefault({}),
    /** The `photo` hairstyle's measures. */
    hairDesign: HairDesignSchema.prefault({}),
    /**
     * The face from a photo, laid on the head (Phú 2026-11-12): a small JPEG of the face (a data
     * URL), its eyes and mouth in fixed places. Kept and shared with the character; left out, the
     * face is drawn.
     */
    facePhoto: z
      .string()
      .max(10_000)
      .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/)
      .optional(),
    // prefault: the default goes through the schema, so its own defaults fill the rest.
    clothes: ClothesSchema.prefault({
      top: '#a8c8ee',
      bottom: '#4f5b6b',
      shoes: '#f2f3f4',
      accent: '#1f3d7a',
      neck: 'tie',
      skirt: false,
    }),
  }),
  outfit: z.object({ default: IdSchema }),
  /** Who they are, for the character page: a role and a line on their personality. */
  role: z.string().min(1).default('Researcher'),
  trait: z.string().min(1).default('Curious about everything.'),
  /**
   * How they are on the character page (presentation only): their pose when chosen, their place
   * in its room, whether they wear the lab coat there.
   */
  profile: z
    .object({
      pose: z.enum(SIGNATURE_POSES),
      /** Their place in the character page's room (`seating.ts`), left to right from 0. */
      seat: z.number().int().min(0),
      /** Wears the lab coat in the common room (the lab's own rules still give it in labs). */
      coat: z.boolean(),
    })
    .default({ pose: 'wave', seat: 0, coat: true }),
  metadata: z.record(z.string(), z.string()).default({}),
  ...localized('displayName', 'role', 'trait'),
});

export type CharacterDefinition = z.infer<typeof CharacterDefinitionSchema>;

/**
 * The id of the player's own character, made on the character page (one per player): kept in the
 * browser for the menu and in the save of a game played as it, never in the content.
 */
export const CUSTOM_ID = 'custom';

/** Eye height as a fraction of body height (adult average), used for camera and reach. */
export const eyeHeightOf = (character: CharacterDefinition): number =>
  character.appearance.heightM * 0.93;
