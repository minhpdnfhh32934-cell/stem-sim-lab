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

export function fold(text: string): string;
export function endsWithQuestion(answer: string): boolean;
export function asksForMissingData(answer: string): boolean;
export function englishShare(answer: string): number;
export function scoreAnswer(item: EvalItem, answer: string): AnswerScore;
export function summarize(scores: AnswerScore[]): {
  n: number;
  keyFacts: number | null;
  noKnownErrors: number | null;
  checkQuestion: number | null;
  asksClarification: number | null;
  meanChars: number | null;
};
