import type { Reading } from './cache';

/**
 * The words the AI wrote in a problem reading, for the output filter: quotes, questions,
 * assumptions, clarifications and unsupported parts. Numbers are left out on purpose: a
 * serialized value such as 0.523598776 is not text the learner reads, and the code checks every
 * number against the problem anyway (MASTER_PROMPT §2.1).
 */
export function readingText(reading: Reading): string {
  const x = reading.extraction;
  return [
    ...reading.unsupported_parts,
    ...x.quantities.map((q) => q.quote),
    ...x.questions,
    ...x.assumptions,
    ...x.clarifications,
    ...x.unsupported_parts,
  ].join('\n');
}
