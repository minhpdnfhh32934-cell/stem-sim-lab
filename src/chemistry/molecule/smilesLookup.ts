import type { SmilesInfo } from './rdkit';

/** RDKit lookup of a typed query; every non-idle result remembers the query it belongs to. */
export type SmilesLookup =
  | { state: 'idle' }
  | { state: 'loading' | 'invalid'; query: string }
  | { state: 'ok'; query: string; info: SmilesInfo };

/**
 * What to show for the current query: a result (or a pending lookup) for another query is
 * never shown, so a structure cannot stay on screen for an unrelated search text.
 */
export function lookupFor(lookup: SmilesLookup, query: string): SmilesLookup {
  return lookup.state !== 'idle' && lookup.query === query.trim() ? lookup : { state: 'idle' };
}
