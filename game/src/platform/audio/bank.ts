import { z } from 'zod';
import { formatIssues, IdSchema } from '../../core/schema';
import { MATERIALS } from '../../gameplay/item';
import { FLOORS } from '../../world/definitions';

/**
 * The sound bank (`content/sounds.json`, Phase S): every sound the game makes, recorded (files
 * in `public/audio`, several takes) or made in code (a recipe, `synth.ts`), with its volume, the
 * spread of its pitch, the mixer bus it plays on and how far it carries. The code names moments
 * (`CUES`: a door opening, a click); the bank says which sound each one is.
 */

const Envelope = {
  /** Start (s) within the sound. */
  at: z.number().min(0).default(0),
  /** Length (s); the sound's end if left out. */
  for: z.number().positive().optional(),
  attack: z.number().min(0).default(0.004),
  release: z.number().min(0).default(0.02),
  gain: z.number().min(0).max(2).default(1),
};

const ToneLayerSchema = z.object({
  tone: z.enum(['sine', 'triangle', 'square', 'sawtooth']),
  hz: z.number().positive(),
  /** Glides to this pitch by the layer's end (exponentially). */
  toHz: z.number().positive().optional(),
  ...Envelope,
});

const NoiseLayerSchema = z.object({
  noise: z.enum(['white', 'pink', 'brown']),
  filter: z
    .object({
      type: z.enum(['lowpass', 'highpass', 'bandpass']),
      hz: z.number().positive(),
      q: z.number().positive().default(0.707),
    })
    .optional(),
  /** A slow swell of the level (a fan's beat): `depth` 0–1 at `hz`. */
  wobble: z.object({ hz: z.number().positive(), depth: z.number().min(0).max(1) }).optional(),
  ...Envelope,
});

export const SynthSchema = z.object({
  seconds: z.number().positive().max(30),
  /** Played round and round (a room's air): its end meets its start. */
  loop: z.boolean().default(false),
  layers: z.array(z.union([ToneLayerSchema, NoiseLayerSchema])).min(1),
});

export const SoundSchema = z
  .object({
    id: IdSchema,
    bus: z.enum(['effects', 'room', 'interface']),
    volume: z.number().min(0).max(2).default(1),
    /** Each play's pitch is shifted at random by up to this share (0.05: ±5 %). */
    pitch: z.number().min(0).max(0.5).default(0),
    /** Heard from where it happens (3D), or everywhere alike (the interface, a room's air). */
    positional: z.boolean().default(true),
    /** Full volume within `distance[0]` m, quieter beyond, silent past `distance[1]` m. */
    distance: z.tuple([z.number().positive(), z.number().positive()]).default([1, 25]),
    /** Recorded takes (paths under `public/audio`), one picked at random each time. */
    files: z
      .array(z.string().regex(/^[a-z0-9/-]+\.ogg$/))
      .min(1)
      .optional(),
    synth: SynthSchema.optional(),
  })
  .refine((s) => (s.files === undefined) !== (s.synth === undefined), {
    message: 'a sound is recorded (files) or made in code (synth), one of the two',
  });

/** The moments the code plays a sound at; the bank names each one's sound. */
export const CUES = [
  'card-accepted',
  'card-refused',
  'door-opening',
  'door-closing',
  'door-closed',
  'hinge-open',
  'hinge-close',
  'switch',
  'run-start',
  'slide-open',
  'slide-close',
  'ui-click',
  'ui-step',
  'ui-task',
  'ui-refused',
  // Phase E-2: the circuit bench and fire
  'spark',
  'fire',
  'spray',
  'alarm',
  'siren',
] as const;
export type Cue = (typeof CUES)[number];

export const BankSchema = z
  .object({
    sounds: z.array(SoundSchema),
    cues: z.record(z.enum(CUES), IdSchema),
    /** A footstep's sound on each kind of floor. */
    footsteps: z.record(z.enum(FLOORS), IdSchema),
    /** What an object knocks like when it strikes something, by its look (item `visual.material`). */
    impacts: z.record(z.enum(MATERIALS), IdSchema),
  })
  .superRefine((bank, ctx) => {
    const ids = new Set<string>();
    for (const s of bank.sounds) {
      if (ids.has(s.id)) ctx.addIssue({ code: 'custom', message: `duplicate sound "${s.id}"` });
      ids.add(s.id);
    }
    const needs = [
      ...Object.entries(bank.cues),
      ...Object.entries(bank.footsteps),
      ...Object.entries(bank.impacts),
    ];
    for (const [moment, id] of needs) {
      if (!ids.has(id)) ctx.addIssue({ code: 'custom', message: `${moment}: no sound "${id}"` });
    }
    for (const cue of CUES) {
      if (!(cue in bank.cues)) ctx.addIssue({ code: 'custom', message: `no sound for "${cue}"` });
    }
    for (const floor of FLOORS) {
      if (!(floor in bank.footsteps)) {
        ctx.addIssue({ code: 'custom', message: `no footstep on "${floor}"` });
      }
    }
    for (const material of MATERIALS) {
      if (!(material in bank.impacts)) {
        ctx.addIssue({ code: 'custom', message: `no impact for "${material}"` });
      }
    }
  });

export type Synth = z.infer<typeof SynthSchema>;
export type ToneLayer = z.infer<typeof ToneLayerSchema>;
export type NoiseLayer = z.infer<typeof NoiseLayerSchema>;
export type Sound = z.infer<typeof SoundSchema>;
export type Bank = z.infer<typeof BankSchema>;

/** The bank, validated; a list of what is wrong with it otherwise. */
export function parseBank(raw: unknown): { bank: Bank } | { problems: string } {
  const result = BankSchema.safeParse(raw);
  return result.success
    ? { bank: result.data }
    : { problems: formatIssues(result.error).join('; ') };
}
