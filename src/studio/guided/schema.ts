import { z } from 'zod';
import { LocalizedTextSchema } from '@/core/data/dataset';

/**
 * A descriptive textbook lesson as a guided Science Studio lesson (user decision 14/11/2026,
 * #255): no simulation, only a prediction and one to three checked activities (put in order,
 * match, sort). Every text is SimLab's wording of the lesson (terms and some short phrases follow
 * the book); the answer key is the lesson data itself, so the check never invents anything.
 *
 * Ids are short so that one saved answer ("activity:row=value") fits an action's 80 characters.
 */
export const GuidedIdSchema = z.string().regex(/^[a-z0-9-]{1,20}$/, 'short lowercase id');

const Text = LocalizedTextSchema;
const Id = GuidedIdSchema;

const OrderSchema = z.object({
  kind: z.literal('order'),
  id: Id,
  prompt: Text,
  /** Listed in the correct order. */
  items: z
    .array(z.object({ id: Id, text: Text, why: Text }))
    .min(3)
    .max(8),
});

const MatchSchema = z.object({
  kind: z.literal('match'),
  id: Id,
  prompt: Text,
  /** Each left text goes with its own right text. */
  pairs: z
    .array(z.object({ id: Id, left: Text, right: Text, why: Text }))
    .min(3)
    .max(6),
});

const SortSchema = z.object({
  kind: z.literal('sort'),
  id: Id,
  prompt: Text,
  groups: z
    .array(z.object({ id: Id, label: Text }))
    .min(2)
    .max(4),
  items: z
    .array(z.object({ id: Id, text: Text, group: Id, why: Text }))
    .min(4)
    .max(8),
});

export const GuidedActivitySchema = z.discriminatedUnion('kind', [
  OrderSchema,
  MatchSchema,
  SortSchema,
]);
export type GuidedActivity = z.infer<typeof GuidedActivitySchema>;

export const GuidedBindingSchema = z.object({
  kind: z.literal('guided'),
  /** The textbook lesson (`data/curriculum_kntt.json`): the card's citation is built from it. */
  kntt: z.object({ book: z.string().min(1), lesson: z.number().int().positive() }),
  /** The prediction question and its choices; `answer` is the right choice's id. */
  question: Text,
  choices: z
    .array(z.object({ id: Id, text: Text }))
    .min(2)
    .max(4),
  answer: Id,
  answerWhy: Text,
  activities: z.array(GuidedActivitySchema).min(1).max(3),
});
export type GuidedBinding = z.infer<typeof GuidedBindingSchema>;

function duplicates(ids: readonly string[]): boolean {
  return new Set(ids).size !== ids.length;
}

/** Two equal texts (in either language) would give two controls the same accessible name. */
function sameText(texts: readonly { vi: string; en: string }[]): boolean {
  return duplicates(texts.map((t) => t.vi)) || duplicates(texts.map((t) => t.en));
}

/** What makes a guided binding unusable even though every field has the right shape. */
export function guidedProblems(b: GuidedBinding): string[] {
  const out: string[] = [];
  if (duplicates(b.choices.map((c) => c.id))) out.push('choices: duplicate id');
  if (!b.choices.some((c) => c.id === b.answer)) out.push('answer: not a choice');
  if (duplicates(b.activities.map((a) => a.id))) out.push('activities: duplicate id');
  for (const a of b.activities) {
    const at = `activities.${a.id}`;
    if (a.kind === 'order') {
      if (duplicates(a.items.map((i) => i.id))) out.push(`${at}: duplicate item id`);
      if (sameText(a.items.map((i) => i.text))) out.push(`${at}: two identical item texts`);
    } else if (a.kind === 'match') {
      if (duplicates(a.pairs.map((p) => p.id))) out.push(`${at}: duplicate pair id`);
      if (sameText(a.pairs.map((p) => p.left))) out.push(`${at}: two identical left-hand texts`);
      // Two equal right-hand texts would make a right answer look wrong.
      if (sameText(a.pairs.map((p) => p.right))) out.push(`${at}: two identical right-hand texts`);
    } else {
      if (duplicates(a.groups.map((g) => g.id))) out.push(`${at}: duplicate group id`);
      if (sameText(a.groups.map((g) => g.label))) out.push(`${at}: two identical group labels`);
      if (duplicates(a.items.map((i) => i.id))) out.push(`${at}: duplicate item id`);
      if (sameText(a.items.map((i) => i.text))) out.push(`${at}: two identical item texts`);
      const groups = new Set(a.groups.map((g) => g.id));
      if (a.items.some((i) => !groups.has(i.group))) out.push(`${at}: unknown group`);
      if (a.groups.some((g) => !a.items.some((i) => i.group === g.id))) {
        out.push(`${at}: empty group`);
      }
    }
  }
  return out;
}
