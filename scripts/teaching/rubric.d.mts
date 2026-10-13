/** One question of tests/teaching/teaching-eval.json. */
export interface EvalItem {
  id: string;
  subject: 'physics' | 'chemistry' | 'biology';
  type: 'concept' | 'problem' | 'missing-data' | 'misconception' | 'followup' | 'tool';
  question: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  keyFacts: string[][];
  mustNot: string[];
  expectsClarify?: boolean;
}

export interface AnswerScore {
  id: string;
  keyFacts: number;
  noKnownErrors: boolean;
  checkQuestion: boolean | null;
  asksClarification: boolean | null;
  englishShare: number;
  chars: number;
  wrong: string[];
}

/** One model answer of an evaluation run (scripts/teaching/eval-gemma.mjs). */
export interface EvalRun {
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
  checkQuestion: number | null;
  asksClarification: number | null;
  meanChars: number | null;
}

export interface RunSummary extends Summary {
  runs: number;
  failures: number;
  noFirstPiece: number;
  truncated: number;
  meanFirstPieceMs: number | null;
  medianFirstPieceMs: number | null;
  meanMs: number | null;
  meanPromptChars: number | null;
}

export function fold(text: string): string;
export function sentences(text: string): string[];
export function endsWithQuestion(answer: string): boolean;
export function asksForMissingData(answer: string): boolean;
export function englishShare(answer: string): number;
export function scoreAnswer(item: EvalItem, answer: string): AnswerScore;
export function summarize(scores: AnswerScore[]): Summary;
export function summarizeRuns(runs: EvalRun[]): RunSummary;
export function gpuRefusal(adapters: Record<string, string | null | undefined>): string | null;
