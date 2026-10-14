/** One question of tests/teaching/teaching-eval.json. */
export interface EvalItem {
  id: string;
  subject: 'physics' | 'chemistry' | 'biology';
  type:
    | 'concept'
    | 'problem'
    | 'missing-data'
    | 'misconception'
    | 'followup'
    | 'tool'
    | 'steps'
    | 'trap';
  question: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  keyFacts: string[][];
  mustNot: string[];
  expectsClarify?: boolean;
  /** Missing-data items: each group names one missing quantity (asked for in a data request). */
  missing?: string[][];
  /** Unit pattern of the asked quantity: a new number followed by it is a numeric answer. */
  answerUnit?: string;
  /** Numbers a correct answer may write although the question does not contain them. */
  allowNumbers?: string[];
  /** Ordered stages of keyFacts indices (facts inside one stage in any order). */
  steps?: number[][];
  /** Trap items: keyFacts[0] is the explicit correction of a false premise. */
  trap?: { note: string; premise: boolean };
  /** Exact computation, for reviewers. */
  derivation?: string;
  /** What a good answer does, for reviewers. */
  expected?: string;
  review_status?: 'pending' | 'verified';
}

export interface AnswerScore {
  id: string;
  keyFacts: number;
  /** Hit of every keyFacts group, in order (paired tests). */
  facts: boolean[];
  noKnownErrors: boolean;
  /** Every key fact and no known error. */
  correct: boolean;
  /** The last sentence is a question (every item). */
  endsWithQuestion: boolean;
  /** endsWithQuestion on concept and misconception items; null on the others. */
  checkQuestion: boolean | null;
  asksClarification: boolean | null;
  namesMissing: boolean | null;
  steps: number | null;
  trapHandled: boolean | null;
  englishShare: number;
  foreignScript: number;
  mangled: string[];
  chars: number;
  wrong: string[];
  invented: string[];
}

/** The app build an evaluation ran against (scripts/teaching/eval-gemma.mjs). */
export interface Build {
  /** git rev-parse HEAD of the repository the script ran in. */
  commit: string | null;
  /** Tracked files differed from that commit. */
  dirty: boolean | null;
  /** SHA-256 of /src/teacher/chat/chatService.ts as the server under --base served it. */
  chatServiceSha256: string;
  model: string;
}

/** One model answer of an evaluation run (scripts/teaching/eval-gemma.mjs). */
export interface EvalRun {
  id?: string;
  model?: string | undefined;
  build?: Build | undefined;
  variant?: string;
  decoding?: string;
  temperature?: number;
  repeat?: number;
  ok: boolean;
  answer: string;
  /** Time to the first piece of the answer; null/absent when none was seen. */
  firstMs?: number | null;
  ms: number;
  promptChars: number;
  truncated?: boolean;
  score: AnswerScore;
}

export interface Summary {
  n: number;
  keyFacts: number | null;
  noKnownErrors: number | null;
  correct: number | null;
  checkQuestion: number | null;
  asksClarification: number | null;
  namesMissing: number | null;
  steps: number | null;
  trapHandled: number | null;
  foreignScript: number | null;
  foreignScriptAnswers: number | null;
  mangledTerms: number | null;
  meanChars: number | null;
}

export interface RunSummary extends Summary {
  runs: number;
  items: number;
  failures: number;
  noFirstPiece: number;
  truncated: number;
  meanFirstPieceMs: number | null;
  medianFirstPieceMs: number | null;
  meanMs: number | null;
  medianMs: number | null;
  meanPromptChars: number | null;
}

export interface PairedComparison {
  items: number;
  wins: number;
  losses: number;
  ties: number;
  meanDiff: number | null;
  signP: number;
  /** Per question: which configuration more often answered correctly (McNemar's table). */
  correct: { both: number; onlyA: number; onlyB: number; neither: number };
  mcnemarP: number;
  /** Key-fact groups paired by question and repeat: a description, not a test. */
  groups: { both: number; onlyA: number; onlyB: number; neither: number };
}

export function fold(text: string): string;
export function sentences(text: string): string[];
export function endsWithQuestion(answer: string): boolean;
export function numberReadings(token: string): number[];
export function inventedNumbers(item: Partial<EvalItem>, answer: string): string[];
export function asksForMissingData(answer: string, item?: Partial<EvalItem>): boolean;
export function namesMissing(item: EvalItem, answer: string): boolean | null;
export function stepsInOrder(item: EvalItem, answer: string): number | null;
export function opensWithAgreement(answer: string): boolean;
export function trapHandled(item: EvalItem, answer: string): boolean | null;
export function englishShare(answer: string): number;
export function foreignScript(answer: string): number;
export function questionTerms(item: Partial<EvalItem>): string[][];
export function mangledTerms(item: Partial<EvalItem>, answer: string): string[];
export function scoreAnswer(item: EvalItem, answer: string): AnswerScore;
export function summarize(scores: AnswerScore[]): Summary;
export function summarizeRuns(runs: EvalRun[]): RunSummary;
/** A saved evaluation file. */
export interface SavedEval {
  model?: string;
  build?: Build;
  results?: EvalRun[];
}

export function groupKey(
  run: Pick<EvalRun, 'model' | 'variant' | 'decoding' | 'temperature'>,
): string;
export function fileRuns(saved: SavedEval, file: string): (EvalRun & { file: string })[];
export function buildConflicts(runs: EvalRun[]): { key: string; builds: string[] }[];
export function skipRefusal(saved: SavedEval, now: { model: string; build: Build }): string | null;
export function servedPromptVariant(source: string): 'current' | 'improved';
export function variantRefusal(variants: string[], source: string): string | null;
export function stopsRun(error: string): boolean;
export function signTestP(wins: number, losses: number): number;
export function mcnemarP(onlyA: number, onlyB: number): number;
export function numberRepeats<T extends EvalRun>(runs: T[]): T[];
export function pairedComparison(a: EvalRun[], b: EvalRun[]): PairedComparison;
export function gpuRefusal(adapters: Record<string, string | null | undefined>): string | null;
