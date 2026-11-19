import { z } from 'zod';
import { localized } from '../../core/i18n';
import { IdSchema } from '../../core/schema';
import { CharacterDefinitionSchema } from '../character';

/**
 * An emergency squad (Phú 2026-11-13): who comes when a number is called on the player's phone —
 * by helicopter, through the hub's ceiling, on ropes — and what they do (`behavior`, registered in
 * code: `EmergencySystem`). Content, not code: their uniforms, livery, lines and where they come
 * in. A game, not a protocol: real services never come through a ceiling.
 */

/** A line a responder says, in English with its Vietnamese beside it. */
const LineSchema = z.object({ text: z.string().min(1), ...localized('text') });
export type SquadLine = z.infer<typeof LineSchema>;
/**
 * A line by call (Phú 2026-11-14: each call says something else): the 1st call's, the 2nd's, …;
 * past the last, the last again.
 */
const ByCall = z.array(LineSchema).min(1);

/** What each behaviour has them say (the ones it does not use may be left out). */
const LinesSchema = z.object({
  /** Landed: who they are, and what they came for. */
  arrive: ByCall,
  /** At work (the fire), or looking round with nothing to do (no fire, the police). */
  work: ByCall.optional(),
  /** The job done (the fire out). */
  done: ByCall.optional(),
  /** To the person of the world they ask (police), and that person's answer. */
  ask: ByCall.optional(),
  answer: ByCall.optional(),
  /** To the player who called for nothing: telling off, then the lesson (and the slap, fire). */
  scold: ByCall.optional(),
  lesson: ByCall.optional(),
  /**
   * No player in the hall to find (the caller in a lab, in the teacher's room): to the person of
   * the world they asked, keep an eye on the students; and what that person later tells the caller.
   */
  /** Called after a player who ran off before it was over (no slap then). */
  fled: ByCall.optional(),
  remind: ByCall.optional(),
  followUp: ByCall.optional(),
  /** Back to the ropes. */
  leave: ByCall,
});

export const SquadBehaviors = ['fire-rescue', 'police-check'] as const;

export const ResponderSquadSchema = z.object({
  id: IdSchema,
  /** The numbers that call them (digits only): 114; 113, 911. */
  numbers: z.array(z.string().regex(/^\d{2,4}$/)).min(1),
  behavior: z.enum(SquadBehaviors),
  /** Their siren as the helicopter comes in: a mechanical wail (the fire brigade), an electronic yelp. */
  siren: z.enum(['wail', 'yelp']),
  /** Their name as the subtitles show it ("Firefighter", "Police"). */
  title: z.string().min(1),
  ...localized('title'),
  /** Their helicopter's paint: body, stripe, the letters on its side, its rotor's light. */
  livery: z.object({
    body: z.string().regex(/^#[0-9a-f]{6}$/i),
    stripe: z.string().regex(/^#[0-9a-f]{6}$/i),
    lettering: z.string().min(1).max(24),
    beacon: z.string().regex(/^#[0-9a-f]{6}$/i),
  }),
  /** What they wear on the head and on the back (the renderer draws it). */
  helmet: z.enum(['fire', 'tactical']),
  pack: z.enum(['air-tank', 'radio']),
  /** The letters on the back of their jacket. */
  back: z.string().min(1).max(16),
  /**
   * Where they come in: through the ceiling of `scene` over `at` (x, z in its own coordinates),
   * the ceiling's height `ceiling` (m), the hole's radius `radius` (m).
   */
  arrival: z.object({
    scene: IdSchema,
    at: z.tuple([z.number(), z.number()]),
    ceiling: z.number().min(2).max(30),
    radius: z.number().min(1).max(6),
  }),
  /** Four of them (one per rope). */
  members: z.array(CharacterDefinitionSchema).length(4),
  lines: LinesSchema,
});
export type ResponderSquad = z.infer<typeof ResponderSquadSchema>;
