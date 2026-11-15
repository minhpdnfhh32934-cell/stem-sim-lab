import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { moleculeById, unpairedOn } from '../data/molecules';
import { MoleculePanel } from './MoleculePanel';
import { pickAtom, selectMolecule, useMoleculeStore } from './store';

afterEach(() => {
  act(() => {
    useMoleculeStore.setState({ id: 'h2o', atoms: [], bond: null });
  });
});

describe('molecule panel: an odd electron is said, not rounded away (#255 review)', () => {
  it('NO: N keeps 1 lone pair and 1 unpaired electron; H₂O has none unpaired', () => {
    const no = moleculeById('no');
    if (!no) throw new Error('no');
    expect(no.atoms.map((_, i) => unpairedOn(no, i))).toEqual([1, 0]);
    act(() => {
      selectMolecule('no');
    });
    const { container } = render(<MoleculePanel topic="vsepr" />);
    expect(container).toHaveTextContent('= 1 cặp electron tự do + 1 electron độc thân trên N.');
    act(() => {
      pickAtom(0, false);
    });
    expect(container).toHaveTextContent('1 cặp e tự do + 1 electron độc thân');
    act(() => {
      selectMolecule('h2o');
    });
    expect(container).toHaveTextContent('= 2 cặp electron tự do trên O.');
    expect(container).not.toHaveTextContent('độc thân');
  });
});
