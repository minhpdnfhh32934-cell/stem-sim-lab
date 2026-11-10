import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MOLECULES, moleculeById } from '../data/molecules';
import { GroupFilter } from './GroupFilter';
import { useMoleculeStore } from './store';

afterEach(() => {
  act(() => {
    useMoleculeStore.setState({ group: null, id: 'h2o' });
  });
});

describe('organic molecules and their functional groups (#54 item 11)', () => {
  it('the library has ~20 more organic molecules, benzene among them, all pending review', () => {
    const organic = MOLECULES.filter((m) => m.category === 'organic');
    expect(organic.length).toBeGreaterThanOrEqual(49);
    expect(moleculeById('c6h6')?.groups).toEqual(['arene']);
    for (const m of organic) {
      expect(m.groups?.length, m.id).toBeGreaterThan(0);
      expect(m.review_status).toBe('pending');
    }
    for (const m of MOLECULES.filter((x) => x.category !== 'organic'))
      expect(m.groups, m.id).toBeUndefined();
  });

  it('groups come from the structure (SMARTS in the data script)', () => {
    expect(moleculeById('phenol')?.groups).toEqual(['arene', 'phenol']);
    expect(moleculeById('etac')?.groups).toEqual(['ester']);
    expect(moleculeById('alanine')?.groups).toEqual(['acid', 'amine']);
    expect(moleculeById('urea')?.groups).toEqual(['amide']);
    expect(moleculeById('cyclohexane')?.groups).toEqual(['alkane']);
  });

  it('the filter lists the molecules of a group and opens one', () => {
    render(<GroupFilter />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Lọc theo nhóm chức' }), {
      target: { value: 'ester' },
    });
    const list = screen.getByRole('group', { name: 'Phân tử có nhóm chức này' });
    const names = within(list)
      .getAllByRole('button')
      .map((b) => b.getAttribute('title'));
    expect(names).toEqual(['Ethyl ethanoate (ethyl acetate)', 'Methyl ethanoate (methyl acetate)']);
    fireEvent.click(within(list).getByRole('button', { name: 'CH₃COOCH₃' }));
    expect(useMoleculeStore.getState().id).toBe('meac');
  });
});
