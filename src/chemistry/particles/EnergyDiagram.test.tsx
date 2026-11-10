import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { EnergyDiagram } from './EnergyDiagram';

beforeEach(() => {
  useSettingsStore.setState({ locale: 'vi' });
});

describe('EnergyDiagram', () => {
  it('is labelled a qualitative illustration and follows the activation energies', () => {
    const { container, rerender } = render(<EnergyDiagram eaf={50e3} ear={70e3} />);
    expect(screen.getByText('Hình dạng đường cong: minh họa định tính')).toBeTruthy();
    const figure = screen.getByRole('img');
    expect(figure.getAttribute('aria-label')).toContain('ΔH = −20 kJ/mol (tỏa nhiệt)');
    const curve = () => container.querySelector('.eq-energy__curve')?.getAttribute('d');
    const before = curve();
    rerender(<EnergyDiagram eaf={80e3} ear={70e3} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
      'ΔH = 10 kJ/mol (thu nhiệt)',
    );
    expect(curve()).not.toBe(before);
  });
});
