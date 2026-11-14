import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { ElementDetails } from './ElementDetails';
import { ElementPicker } from './ElementPicker';
import { PeriodicStage } from './PeriodicStage';
import { selectElement } from './store';

const setLocale = (locale: 'vi' | 'en') => {
  act(() => {
    useSettingsStore.setState({ locale });
  });
};

afterEach(() => {
  cleanup();
  setLocale('vi');
});

describe('element names: the Vietnamese name is added only in Vietnamese', () => {
  it('in the element list', () => {
    setLocale('vi');
    render(<ElementPicker max={2} />);
    expect(screen.getByRole('option', { name: /^1 · H — Hydrogen \(hiđro\)$/ })).toBeTruthy();
    cleanup();
    setLocale('en');
    render(<ElementPicker max={2} />);
    expect(screen.getByRole('option', { name: /^1 · H — Hydrogen$/ })).toBeTruthy();
    expect(screen.getByRole('combobox').textContent).not.toMatch(/hiđro|heli/);
  });

  it('on the element card and in the periodic table’s tooltip', () => {
    act(() => {
      selectElement(6);
    });
    setLocale('vi');
    const vi = render(
      <>
        <ElementDetails />
        <PeriodicStage />
      </>,
    );
    expect(vi.container.querySelector('.el-card__name')?.textContent).toBe('Carbon (cacbon)');
    expect(
      vi.container.querySelector('[aria-label="6 C Carbon"]')?.getAttribute('data-tip'),
    ).toMatch(/^Carbon \(cacbon\) · Z = 6/);
    cleanup();
    setLocale('en');
    const en = render(
      <>
        <ElementDetails />
        <PeriodicStage />
      </>,
    );
    expect(en.container.querySelector('.el-card__name')?.textContent).toBe('Carbon');
    expect(
      en.container.querySelector('[aria-label="6 C Carbon"]')?.getAttribute('data-tip'),
    ).toMatch(/^Carbon · Z = 6/);
  });
});
