import type { Question, QuestionLevel, QuestionSet, QuestionType } from './questions';

/** What a test asks for (Phase Y-4, the teacher's third choice): which, how many, of what kind. */
export interface PaperRequest {
  /** Experiments it covers (any subjects): ids of their question banks. */
  readonly experiments: readonly string[];
  readonly count: number;
  readonly types: readonly QuestionType[];
  readonly levels: readonly QuestionLevel[];
  /** The paper's own draw: the same seed, the same paper. */
  readonly seed: number;
}

/** One question on a paper: which, and for a choice question the order its options are printed. */
export interface PaperItem {
  readonly experiment: string;
  readonly question: string;
  /** Printed option i is the bank's option `order[i]` (choice questions; empty otherwise). */
  readonly order: readonly number[];
}

/**
 * The player's answers, by item: the printed option chosen (0–3, or null), or each statement's
 * true/false (null not answered). Answers can be changed until the paper is handed in.
 */
export type PaperAnswer = number | null | readonly (boolean | null)[];

/** A paper marked: its points of the most it could have, out of 10, and per skill. */
export interface PaperGrade {
  readonly points: number;
  readonly max: number;
  /** Out of 10, to two decimals (as THPT papers are). */
  readonly score: number;
  readonly items: readonly {
    readonly points: number;
    readonly max: number;
    readonly right: number;
  }[];
  /** Per skill tested: how many of its questions were fully right, of how many. */
  readonly skills: readonly {
    readonly experiment: string;
    readonly skill: string;
    readonly right: number;
    readonly total: number;
  }[];
}

/** THPT 2025: a choice question 0.25; true/false 0.1, 0.25, 0.5, 1 for 1, 2, 3, 4 statements right. */
export const CHOICE_POINTS = 0.25;
export const TRUE_FALSE_POINTS = [0, 0.1, 0.25, 0.5, 1] as const;

/**
 * A paper for `request` from the banks: questions of the chosen experiments, types and levels,
 * drawn in turn from each experiment (so every one is asked about), the choice questions first
 * (part I) then the true/false ones (part II), as THPT papers are; each choice question's options
 * in their own order. Deterministic in `request.seed`. Fewer questions than asked when the banks
 * hold no more; a reason (no paper) when none match.
 */
export function composePaper(
  banks: ReadonlyMap<string, QuestionSet> | { tryGet(id: string): QuestionSet | undefined },
  request: PaperRequest,
): readonly PaperItem[] | string {
  const get = (id: string) => ('tryGet' in banks ? banks.tryGet(id) : banks.get(id));
  const random = mulberry32(request.seed);
  // Each experiment's matching questions, shuffled.
  const pools = request.experiments.map((experiment) => {
    const questions = (get(experiment)?.questions ?? []).filter(
      (q) => request.types.includes(q.type) && request.levels.includes(q.level),
    );
    return { experiment, questions: shuffle(questions, random) };
  });
  const chosen: { experiment: string; question: Question }[] = [];
  for (let round = 0; chosen.length < request.count; round++) {
    let added = false;
    for (const pool of pools) {
      const q = pool.questions[round];
      if (!q || chosen.length >= request.count) continue;
      chosen.push({ experiment: pool.experiment, question: q });
      added = true;
    }
    if (!added) break;
  }
  if (chosen.length === 0) return 'No question matches these choices.';
  const parts = [
    ...chosen.filter((c) => c.question.type === 'choice'),
    ...chosen.filter((c) => c.question.type === 'true-false'),
  ];
  return parts.map(({ experiment, question }) => ({
    experiment,
    question: question.id,
    order: question.type === 'choice' ? shuffle([0, 1, 2, 3], random) : [],
  }));
}

/** Marks `answers` (by item) to `paper`: THPT 2025's points, out of 10, and per skill. */
export function gradePaper(
  banks: ReadonlyMap<string, QuestionSet> | { tryGet(id: string): QuestionSet | undefined },
  paper: readonly PaperItem[],
  answers: readonly PaperAnswer[],
): PaperGrade {
  const get = (id: string) => ('tryGet' in banks ? banks.tryGet(id) : banks.get(id));
  const skills = new Map<
    string,
    { experiment: string; skill: string; right: number; total: number }
  >();
  const items = paper.map((item, i) => {
    const question = get(item.experiment)?.questions.find((q) => q.id === item.question);
    if (!question) return { points: 0, max: 0, right: 0 };
    const answer = answers[i] ?? null;
    let points: number;
    let max: number;
    let right: number;
    if (question.type === 'choice') {
      const printed = typeof answer === 'number' ? answer : null;
      const chosen = printed === null ? null : (item.order[printed] ?? null);
      right = chosen !== null && question.options[chosen]?.correct === true ? 1 : 0;
      points = right * CHOICE_POINTS;
      max = CHOICE_POINTS;
    } else {
      const marks = Array.isArray(answer) ? answer : [];
      right = question.statements.filter((s, k) => marks[k] === s.true).length;
      points = TRUE_FALSE_POINTS[right] ?? 0;
      max = 1;
    }
    const whole = points === max;
    for (const skill of question.skills) {
      const key = `${item.experiment}/${skill}`;
      const tally = skills.get(key) ?? { experiment: item.experiment, skill, right: 0, total: 0 };
      tally.total++;
      if (whole) tally.right++;
      skills.set(key, tally);
    }
    return { points, max, right };
  });
  const points = round(items.reduce((sum, item) => sum + item.points, 0));
  const max = round(items.reduce((sum, item) => sum + item.max, 0));
  return {
    points,
    max,
    score: max > 0 ? Math.round((1000 * points) / max) / 100 : 0,
    items,
    skills: [...skills.values()],
  };
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/** A seeded generator (mulberry32): uniform in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A shuffled copy (Fisher–Yates). */
function shuffle<T>(list: readonly T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
