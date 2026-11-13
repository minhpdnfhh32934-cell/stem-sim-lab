/**
 * Every experiment's question bank (Phase Y-4), one file each: `questions/<experiment id>.json`.
 * The game imports it only dynamically (`Game.loadQuestions`), a chunk of its own downloaded the
 * first time a test is set — never with the lab pack, which every lab visit needs — and validates
 * it against the experiments and their models then (`addQuestionBanks`).
 */
const banks = import.meta.glob<unknown>('./questions/*.json', { eager: true, import: 'default' });

export const questionBanks: unknown[] = Object.keys(banks)
  .sort()
  .map((path) => banks[path]);
