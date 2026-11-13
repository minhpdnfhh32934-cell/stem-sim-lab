import { z } from 'zod';
import { localized } from '../../core/i18n';
import { IdSchema } from '../../core/schema';

/**
 * A guided task (Phase A contract A3): data that leads the player, step by step, to objects of one
 * lab — a path on the floor and an outline on the step's objects — and notices when each step is
 * done. It shows the way; it decides nothing: every action is still the rules' (stations,
 * interaction), and a step is done only by what the world reports.
 *
 * Step objects are placement ids of the task's room (several: any of them, the path leads to the
 * nearest). A step is done when (`done.kind`):
 * - `grabbed`, `set-down`, `inspected`: one of its objects is taken up, set down, inspected;
 * - `state`: one of its objects' entity state `key` becomes `value` (a cabinet open, lights off);
 * - `setup`: the station's setup step `step` is done (its own rules decided it);
 * - `completed`: the station's run completes; `viewed`: its results are read.
 * State-like steps already true when they are reached are passed at once.
 */
const StateValue = z.union([z.boolean(), z.number(), z.string()]);

const DoneSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('grabbed') }),
  z.object({ kind: z.literal('set-down') }),
  z.object({ kind: z.literal('inspected') }),
  z.object({ kind: z.literal('state'), key: z.string().min(1), value: StateValue }),
  /** One of the station's setup steps done: `step`, or any of `or` (a step per material chosen). */
  z.object({
    kind: z.literal('setup'),
    station: IdSchema,
    step: IdSchema,
    or: z.array(IdSchema).min(1).optional(),
  }),
  z.object({ kind: z.literal('completed'), station: IdSchema }),
  z.object({ kind: z.literal('viewed'), station: IdSchema }),
]);
export type TaskDone = z.infer<typeof DoneSchema>;

export const TaskStepSchema = z.object({
  id: IdSchema,
  instruction: z.string().min(1),
  ...localized('instruction'),
  /** Placement ids in the task's room: where the path leads, what is outlined. */
  objects: z.array(IdSchema).min(1),
  done: DoneSchema,
});
export type TaskStep = z.infer<typeof TaskStepSchema>;

export const TaskDefinitionSchema = z
  .object({
    id: IdSchema,
    /** The lab room the task is offered in (its panel shows there). */
    room: IdSchema,
    title: z.string().min(1),
    description: z.string().default(''),
    ...localized('title', 'description'),
    steps: z.array(TaskStepSchema).min(1),
  })
  .superRefine(({ steps }, ctx) => {
    steps.forEach(({ id }, i) => {
      if (steps.findIndex((s) => s.id === id) !== i) {
        ctx.addIssue({ code: 'custom', path: ['steps', i, 'id'], message: 'duplicate step' });
      }
    });
  });
export type TaskDefinition = z.infer<typeof TaskDefinitionSchema>;
