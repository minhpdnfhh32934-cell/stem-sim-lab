import { z } from 'zod';
import { localized } from '../../core/i18n';
import { IdSchema } from '../../core/schema';

/** First-person hand animations a step can show (presentation only, see the renderer). */
export const HAND_MOTIONS = [
  'wet',
  'soap',
  'rub-palms',
  'rub-backs',
  'rub-fingers',
  'rub-thumbs',
  'rinse',
  'dry',
  'sanitize',
] as const;
export type HandMotion = (typeof HAND_MOTIONS)[number];

const StateValue = z.union([z.boolean(), z.number(), z.string()]);

/** Holds while some loaded entity of `item` has entity state `key` = `value` (unset = false). */
const ConditionSchema = z.object({ item: IdSchema, key: z.string().min(1), value: StateValue });

const stepBase = {
  id: IdSchema,
  stage: IdSchema,
  /** Shown as the objective, and as the reason when an action comes too early. */
  instruction: z.string().min(1),
  ...localized('instruction'),
  hands: z.enum(HAND_MOTIONS).optional(),
};

/**
 * One step, done in order. Three ways to complete it:
 * - `wear`: the player is wearing `item` (put on from a wardrobe or dispenser);
 * - `state`: a world condition holds, e.g. the faucet is running;
 * - `perform`: the player performs `action` on an `item` (optionally for `durationS` seconds of
 *   continued attention, and only while every `requires` condition holds).
 */
export const ProcedureStepSchema = z.discriminatedUnion('kind', [
  z.object({ ...stepBase, kind: z.literal('wear'), item: IdSchema }),
  z.object({ ...stepBase, kind: z.literal('state'), condition: ConditionSchema }),
  z.object({
    ...stepBase,
    kind: z.literal('perform'),
    item: IdSchema,
    action: IdSchema,
    durationS: z.number().min(0).max(60).default(0),
    requires: z
      .array(ConditionSchema.extend({ message: z.string().min(1), ...localized('message') }))
      .default([]),
  }),
]);

/**
 * An ordered procedure done in one scene that unlocks an entrance (e.g. cleanroom entry). It is
 * an educational, simplified sequence — not a verified real-world protocol.
 */
export const ProcedureDefinitionSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    description: z.string().default(''),
    ...localized('name', 'description'),
    scene: IdSchema,
    /** Entity id `<room>/<placement>` of the door that opens only when the procedure is done. */
    entrance: z.string().min(1),
    /**
     * Doors out of the preparation area (entity ids): refused while any PPE is worn, and going
     * through one resets the procedure, so the next entry needs the whole preparation again.
     */
    exits: z.array(z.string().min(1)).default([]),
    stages: z
      .array(z.object({ id: IdSchema, label: z.string().min(1), ...localized('label') }))
      .min(1),
    /** Must still be worn when entering (taking it off again blocks the door). */
    requiredEquipment: z.array(IdSchema).default([]),
    steps: z.array(ProcedureStepSchema).min(1),
  })
  .superRefine((p, ctx) => {
    const ids = new Set<string>();
    const stages = new Set(p.stages.map((s) => s.id));
    p.steps.forEach((step, i) => {
      if (ids.has(step.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', i, 'id'],
          message: `duplicate step id "${step.id}"`,
        });
      }
      ids.add(step.id);
      if (!stages.has(step.stage)) {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', i, 'stage'],
          message: `unknown stage "${step.stage}"`,
        });
      }
    });
  });

export type ProcedureDefinition = z.infer<typeof ProcedureDefinitionSchema>;
export type ProcedureStep = ProcedureDefinition['steps'][number];
export type StateCondition = z.infer<typeof ConditionSchema>;

/** The item a step is done with: what is worn, whose state counts, or what is used. */
export function stepItem(step: ProcedureStep): string {
  return step.kind === 'state' ? step.condition.item : step.item;
}
