import { describe, expect, it } from 'vitest';
import { lookupFor, type SmilesLookup } from './smilesLookup';

const propanol: SmilesLookup = {
  state: 'ok',
  query: 'CCCO',
  info: { canonical: 'CCCO', formula: 'C3H8O', molarMass: 60.1, svg: '<svg/>' },
};

describe('SMILES lookup shown for a query', () => {
  it('shows the result for its own query', () => {
    expect(lookupFor(propanol, ' CCCO ')).toBe(propanol);
  });
  it('never keeps another query’s structure (e.g. text that is not SMILES)', () => {
    expect(lookupFor(propanol, 'CCCO x')).toEqual({ state: 'idle' });
    expect(lookupFor(propanol, 'rượu lạ')).toEqual({ state: 'idle' });
    expect(lookupFor({ state: 'loading', query: 'CCO' }, 'CCCO')).toEqual({ state: 'idle' });
  });
});
