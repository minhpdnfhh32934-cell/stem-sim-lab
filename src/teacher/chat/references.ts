/** Excerpts as fenced, labelled blocks for a prompt (audit SEC-04). */

/** Where an excerpt comes from: its label and how far the AI may trust it (audit SEC-04). */
export type ExcerptKind = 'library' | 'imported' | 'web';

export function excerptKind(id: string): ExcerptKind {
  if (id.startsWith('builtin:')) return 'library';
  if (id.startsWith('web:')) return 'web';
  return 'imported';
}

/**
 * Untrusted text cannot close its own block or open a fake one. Repeated until nothing changes:
 * one pass could rebuild a tag from its pieces ('</refe<reference>rence>' → '</reference>'), and
 * a '<' left in front of "reference" (an unfinished tag) is dropped too.
 */
function fenced(text: string): string {
  let out = text;
  for (;;) {
    const next = out
      .replace(/<\s*\/?\s*reference\b[^>]*>/gi, '')
      .replace(/<(?=\s*\/?\s*reference)/gi, '');
    if (next === out) return out;
    out = next;
  }
}

function attribute(value: string): string {
  return value.replace(/["<>\r\n]/g, ' ').slice(0, 160);
}

/** The excerpts as delimited blocks (audit SEC-04: never mixed into the instructions). */
export function referenceBlocks(
  notes: readonly { id: string; name: string; text: string }[],
): string {
  return notes
    .map(
      (n) =>
        `<reference kind="${excerptKind(n.id)}" name="${attribute(n.name)}">\n${fenced(n.text)}\n</reference>`,
    )
    .join('\n');
}
