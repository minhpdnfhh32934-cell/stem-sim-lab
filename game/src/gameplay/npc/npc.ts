import { z } from 'zod';
import { localized } from '../../core/i18n';
import { IdSchema } from '../../core/schema';
import { CharacterDefinitionSchema } from '../character';

/** What a person does with their hands and head where they are (the renderer's actor plays it). */
export const NPC_GESTURES = ['idle', 'read', 'drink', 'wait', 'talk', 'listen', 'write'] as const;
export type NpcGesture = (typeof NPC_GESTURES)[number];

/**
 * One stop of a person's day, in their scene's coordinates (m, on the floor): stand at `at`
 * facing `heading`, or sit on the seat there (a bench: they walk to the free floor beside it, then
 * sit), doing `gesture` for `seconds`. Heading (rad): 0 faces −z, π/2 faces −x, π faces +z.
 */
const ActivitySchema = z.object({
  kind: z.enum(['stand', 'sit']),
  at: z.tuple([z.number(), z.number()]),
  heading: z.number(),
  seconds: z.number().positive().max(600),
  gesture: z.enum(NPC_GESTURES),
});
export type NpcActivity = z.infer<typeof ActivitySchema>;

/** A line a person says, in English with its Vietnamese beside it. */
const LineSchema = z.object({ text: z.string().min(1), ...localized('text') });
export type NpcLine = z.infer<typeof LineSchema>;

/**
 * A choice the person offers when talked to. `behavior` names what does it (registered in code
 * by the phase that builds it); a `planned` one is shown disabled, "coming soon", and does nothing.
 */
const OptionSchema = z.object({
  id: IdSchema,
  label: z.string().min(1),
  ...localized('label'),
  behavior: IdSchema,
  planned: z.boolean().default(false),
});
export type NpcOption = z.infer<typeof OptionSchema>;

/** A choice's words (what the player says), in English with its Vietnamese beside it. */
const ChoiceSchema = z.object({ label: z.string().min(1), ...localized('label') });
export type NpcChoiceText = z.infer<typeof ChoiceSchema>;

/**
 * What a teacher says around explaining a simulation (Phase Y-2): asking which, while the player
 * leads them, the lecture's first line (`{experiment}`), each part (`{name}`, `{role}`), the
 * question after it, and the answers the player can give. At the board (Y-3): before what is
 * given, the answer (`{answer}`), asking for another example or saying it was the last.
 */
const LessonSchema = z.object({
  ask: LineSchema,
  waiting: LineSchema,
  cancel: LineSchema,
  intro: LineSchema,
  part: LineSchema,
  outro: LineSchema,
  thanks: LineSchema,
  given: LineSchema,
  answer: LineSchema,
  more: LineSchema,
  last: LineSchema,
  choices: z.object({
    keepGoing: ChoiceSchema,
    never: ChoiceSchema,
    board: ChoiceSchema,
    noBoard: ChoiceSchema,
    another: ChoiceSchema,
    enough: ChoiceSchema,
  }),
});
export type NpcLesson = z.infer<typeof LessonSchema>;

/**
 * What a teacher says around a test (Phase Y-5): asking what it should cover, no questions for
 * that, going to write it, busy writing, calling the player, handing it over (or a full bag),
 * marking it and its result (`{score}`), a paper with nothing answered, one already marked; the
 * answers the player gives; and the item a paper is (`paperItem`, carried only in the bag).
 */
/** Where a person's hand writes on their desk, standing at the first stop of their day (m ahead, m up). */
const DeskSchema = z.object({
  forward: z.number().min(0.2).max(1.2),
  height: z.number().min(0.4).max(1.6),
});
export type NpcDesk = z.infer<typeof DeskSchema>;

const TestLinesSchema = z.object({
  paperItem: IdSchema,
  /** The test is written (and marked) there: his hand on it, not raised as at a board. */
  desk: DeskSchema.optional(),
  setup: LineSchema,
  none: LineSchema,
  wait: LineSchema,
  busy: LineSchema,
  ready: LineSchema,
  give: LineSchema,
  full: LineSchema,
  handIn: LineSchema,
  /** Holding a paper out, talked to; marking one; a marked one held out. */
  offering: LineSchema,
  marking: LineSchema,
  markedReady: LineSchema,
  result: LineSchema,
  blank: LineSchema,
  marked: LineSchema,
  choices: z.object({ write: ChoiceSchema, cancel: ChoiceSchema }),
});
export type NpcTestLines = z.infer<typeof TestLinesSchema>;

/**
 * A person of the world who is not the player (Phase Y): who they are (their body and clothes,
 * as a playable character's), how they are called ("Mr. Quang"), the scene they live in, their
 * day (stops walked between, round and round), what they say and what they offer when talked to.
 */
export const NpcDefinitionSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  ...localized('title'),
  character: CharacterDefinitionSchema,
  scene: IdSchema,
  /** Walking speed (m/s). */
  walkSpeed: z.number().positive().max(3).default(1.1),
  schedule: z.array(ActivitySchema).min(1),
  greetings: z.array(LineSchema).min(1),
  farewells: z.array(LineSchema).min(1),
  options: z.array(OptionSchema),
  /** A teacher's words for explaining a simulation (the `explain-simulation` behaviour). */
  lesson: LessonSchema.optional(),
  /** A teacher's words around a test (the `give-test` behaviour, Phase Y-5). */
  test: TestLinesSchema.optional(),
});
export type NpcDefinition = z.infer<typeof NpcDefinitionSchema>;
