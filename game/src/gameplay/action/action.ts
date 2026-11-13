import { z } from 'zod';
import type { Vec3 } from '../../core/math';
import { IdSchema, Vec3Schema } from '../../core/schema';
import { WORN_ON } from '../item';

/**
 * An action acted out (Phase H-3, contract H7): what the player's body does when an action is
 * performed — keyframes of each hand's place and pose, the lean, the moment the look of what is
 * worn changes (`swap`), the moment the acted-on thing shows in its new place (`place`), and when
 * the worn item is carried in the right hand (`carry`). Data only (`content/actions.json`); the
 * ActionSystem plays it, the views pose the body by `sampleHand`. Nothing here is a rule: the
 * action's own effect is the behaviour's, performed at once or at the sequence's `effect`.
 *
 * Times are seconds from the start. A hand's place is `at` the body (x to its right, y as a share
 * of its height, z ahead; m) or the acted-on `target` (where a hand works it, `handPoint`, plus
 * `offset` in its own frame, m). `palm`: the hand turned fingers ahead and palm down, palm up,
 * palm in (towards the body's middle); fingers up and palm out (a card held to a reader); or
 * hanging (`down`); `fingers`: open, gripping, a fist.
 */
const HandKeySchema = z.object({
  at: z.enum(['body', 'target']).default('body'),
  offset: Vec3Schema,
  palm: z.enum(['forward', 'up', 'in', 'out', 'down']).default('forward'),
  fingers: z.enum(['open', 'grip', 'fist']).default('open'),
});
export type HandKey = z.infer<typeof HandKeySchema>;

const KeySchema = z.object({
  t: z.number().min(0),
  right: HandKeySchema.optional(),
  left: HandKeySchema.optional(),
  /** How far (m along the view) the eye leans in at this key (a crouch to the floor). */
  lean: z.number().min(0).max(0.8).optional(),
  /**
   * Where the eyes look at this key (the view's pitch, degrees, below the horizon negative): down
   * at the hands working in front of the body, so that what they do is seen (Phú, 2026-11-04).
   */
  look: z.number().min(-80).max(30).optional(),
});
type Key = z.infer<typeof KeySchema>;

/**
 * What starts it: an action performed on an entity (`action`: its id; `wornOn`: only for an item
 * worn there; `below`: only for one whose centre is lower than this, m), or the hold ended
 * (`released`: how).
 */
const OnSchema = z
  .object({
    action: IdSchema.optional(),
    released: z.enum(['set-down', 'throw', 'drop']).optional(),
    wornOn: z.enum(WORN_ON).optional(),
    below: z.number().positive().optional(),
  })
  .refine(({ action, released }) => (action === undefined) !== (released === undefined), {
    message: 'an action or a release, one of them',
  });

export const ActionSequenceSchema = z
  .object({
    id: IdSchema,
    on: OnSchema,
    /** AFFORDANCE: how long it plays (s); moving and other actions wait meanwhile (D2). */
    seconds: z.number().positive().max(6),
    /**
     * Whether the player waits while it plays (D2). False for a tap pressed again and again (a
     * dial, a station's button): the hand moves, nothing waits, a new press plays it again.
     */
    waits: z.boolean().default(true),
    /**
     * Whether the player first steps up to its target when it is out of an arm's reach (the
     * sequence's clock waits meanwhile): for a hand that must really be there — under the tap, at
     * a dispenser, on the coat's hook. Not for a door or a wardrobe, which open towards the player.
     */
    stepIn: z.boolean().default(false),
    swap: z.number().min(0).optional(),
    place: z.number().min(0).optional(),
    /** The spans (from, to; s) the right hand carries its `prop` in. */
    carry: z.array(z.tuple([z.number().min(0), z.number().min(0)])).default([]),
    /**
     * What the right hand carries: the acted-on item (as a box), a key card (a door's), a glove
     * (in the acted-on item's colour: pulled from its dispenser, or peeled off), a paper towel, a
     * sheet of paper (a test, Phase Y-5).
     */
    prop: z.enum(['item', 'card', 'glove', 'towel', 'paper']).default('item'),
    /**
     * When the action takes effect (s): it is performed then, once the hand is there (water runs
     * as the handle is turned, soap comes as the hand is under the nozzle, a door opens as the card
     * touches its reader). Absent: at once, only its look waiting (`swap`, `place`).
     */
    effect: z.number().min(0).optional(),
    keys: z.array(KeySchema).min(1),
  })
  .superRefine(({ seconds, swap, place, carry, keys, effect }, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    keys.forEach(({ t }, i) => {
      if (t > seconds) issue(['keys', i, 't'], 'after its end');
      if (i > 0 && t <= (keys[i - 1]?.t ?? 0)) issue(['keys', i, 't'], 'keys go forward in time');
    });
    if (swap !== undefined && swap > seconds) issue(['swap'], 'after its end');
    if (place !== undefined && place > seconds) issue(['place'], 'after its end');
    if (effect !== undefined && effect > seconds) issue(['effect'], 'after its end');
    carry.forEach(([from, to], i) => {
      if (from >= to || to > seconds) issue(['carry', i], 'not a span in it');
    });
  });
export type ActionSequence = z.infer<typeof ActionSequenceSchema>;

const SIDES = ['left', 'right'] as const;

const smooth = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};

/** A hand at a moment of the sequence: between which keys, how far, and how much it acts. */
export interface HandSample {
  /** The keys it is between (the same key before its first and after its last). */
  from: HandKey;
  to: HandKey;
  /** How far from `from` to `to` (0–1, eased). */
  along: number;
  /** How much the sequence holds the hand (0: its own pose, 1: the keys'). */
  weight: number;
}

/**
 * The hand `side` at `t` (s), into `out`; false when the sequence does not move it. It eases from
 * its own pose to its first key over the time before it, follows its keys, and eases back from its
 * last one over the time left.
 */
export function sampleHand(
  sequence: ActionSequence,
  side: 'left' | 'right',
  t: number,
  out: HandSample,
): boolean {
  let first = -1;
  let last = -1;
  const { keys } = sequence;
  for (let i = 0; i < keys.length; i++) {
    if (!keys[i]?.[side]) continue;
    if (first < 0) first = i;
    last = i;
  }
  const head = keys[first];
  const tail = keys[last];
  const a = head?.[side];
  const z = tail?.[side];
  if (!head || !tail || !a || !z) return false;
  out.weight =
    t < head.t
      ? smooth(head.t > 0 ? t / head.t : 1)
      : t > tail.t
        ? 1 - smooth((t - tail.t) / Math.max(sequence.seconds - tail.t, 1e-6))
        : 1;
  out.from = a;
  out.to = a;
  out.along = 0;
  if (t <= head.t) return true;
  if (t >= tail.t) {
    out.from = z;
    out.to = z;
    return true;
  }
  // The keys of this hand on either side of t.
  let previous = head;
  for (let i = first + 1; i <= last; i++) {
    const key = keys[i];
    const hand = key?.[side];
    if (!key || !hand) continue;
    if (t <= key.t) {
      out.from = previous[side] ?? a;
      out.to = hand;
      out.along = smooth((t - previous.t) / Math.max(key.t - previous.t, 1e-6));
      return true;
    }
    previous = key;
  }
  return true;
}

/** A keyed value at `t`: from 0 at the start through its keys, eased, back to 0 at the end. */
function eased(sequence: ActionSequence, t: number, pick: (key: Key) => number | undefined) {
  let at = 0;
  let value = 0;
  for (const key of sequence.keys) {
    const v = pick(key);
    if (v === undefined) continue;
    if (t <= key.t) return value + (v - value) * smooth((t - at) / Math.max(key.t - at, 1e-6));
    at = key.t;
    value = v;
  }
  const rest = sequence.seconds - at;
  return rest > 0 ? value * (1 - smooth((t - at) / rest)) : 0;
}
const LEAN = (key: Key) => key.lean;
/** AFFORDANCE: seconds the eyes take to go down to the hands before their first look, and back up. */
const LOOK_S = 0.5;

/** The lean (m) the sequence asks at `t`: its keys' leans, eased between them and to 0 at the ends. */
export function sampleLean(sequence: ActionSequence, t: number): number {
  return eased(sequence, t, LEAN);
}

/**
 * How much the eyes follow the sequence's `look` at `t` (0–1: from where the player looks, down
 * over LOOK_S before its first look, back up over LOOK_S after its last), and the pitch (rad) they
 * look at then.
 */
export function sampleLook(
  sequence: ActionSequence,
  t: number,
  out: { weight: number; pitch: number },
) {
  let previous: Key | null = null;
  out.weight = 0;
  for (const key of sequence.keys) {
    if (key.look === undefined) continue;
    if (t <= key.t) {
      const lead = Math.min(LOOK_S, key.t);
      out.weight = previous || lead <= 0 ? 1 : smooth((t - (key.t - lead)) / lead);
      const from = previous?.look ?? key.look;
      const along = previous ? smooth((t - previous.t) / Math.max(key.t - previous.t, 1e-6)) : 1;
      out.pitch = ((from + (key.look - from) * along) * Math.PI) / 180;
      return out;
    }
    previous = key;
  }
  out.pitch = ((previous?.look ?? 0) * Math.PI) / 180;
  const rest = Math.min(LOOK_S, sequence.seconds - (previous?.t ?? 0));
  out.weight = previous && rest > 0 ? 1 - smooth((t - previous.t) / rest) : 0;
  return out;
}

/** Whether the item is drawn in the right hand at `t`. */
export function carrying(sequence: ActionSequence, t: number): boolean {
  for (const [from, to] of sequence.carry) if (t >= from && t < to) return true;
  return false;
}

/**
 * How much the sequence's hands work at its target at `t` (0–1): the largest weight of a hand
 * between keys at the target (the player leans in to it only then).
 */
export function atTarget(sequence: ActionSequence, t: number, scratch: HandSample): number {
  let most = 0;
  for (const side of SIDES) {
    if (!sampleHand(sequence, side, t, scratch)) continue;
    const { from, to, along, weight } = scratch;
    const share = (from.at === 'target' ? 1 - along : 0) + (to.at === 'target' ? along : 0);
    most = Math.max(most, weight * share);
  }
  return most;
}

/** Whether the sequence's hands go to its target first (the first key that moves a hand is there). */
export function startsAtTarget(sequence: ActionSequence): boolean {
  for (const key of sequence.keys) {
    if (!key.left && !key.right) continue;
    return key.left?.at === 'target' || key.right?.at === 'target';
  }
  return false;
}

/** A world point `offset` from the target's centre (`at: 'target'`), into `out`. */
export function targetPoint(centre: Readonly<Vec3>, offset: Readonly<Vec3>, out: Vec3): Vec3 {
  out[0] = centre[0] + offset[0];
  out[1] = centre[1] + offset[1];
  out[2] = centre[2] + offset[2];
  return out;
}
