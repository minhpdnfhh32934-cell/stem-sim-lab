import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { selectCrystal, useCrystalStore } from './store';
import { CrystalPanel } from './views';

afterEach(() => {
  act(() => {
    useCrystalStore.setState({ id: 'bcc' });
  });
});

describe('crystal panel (#54 item 8)', () => {
  it('shows the counts the textbook way, the coordination and the packing fraction', () => {
    const { container } = render(<CrystalPanel />);
    expect(screen.getByRole('radio', { name: 'Tâm khối' })).toBeChecked();
    expect(container).toHaveTextContent('8 × 1/8 + 1 = 2 nguyên tử kim loại');
    expect(container).toHaveTextContent('Số phối trí8');
    expect(container).toHaveTextContent('68,0 %');
    fireEvent.click(screen.getByRole('radio', { name: 'NaCl' }));
    expect(container).toHaveTextContent('12 × 1/4 + 1 = 4 ion Na⁺');
    expect(container).toHaveTextContent('8 × 1/8 + 6 × 1/2 = 4 ion Cl⁻');
    expect(container).toHaveTextContent('6 : 6');
    expect(container).toHaveTextContent('cần bán kính hai ion');
    fireEvent.click(screen.getByRole('radio', { name: 'Lục phương' }));
    expect(container).toHaveTextContent('12 × 1/6 + 2 × 1/2 + 3 = 6');
    expect(container).toHaveTextContent('74,0 %');
  });

  it('a saved file with an unknown structure is ignored', () => {
    selectCrystal('diamond');
    expect(useCrystalStore.getState().id).toBe('bcc');
    selectCrystal('fcc');
    expect(useCrystalStore.getState().id).toBe('fcc');
  });
});
