import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { L } from './common';
import { LotkaVolterraPanel } from './ecology/EcologyViews';
import { useLv } from './ecology/store';
import { MichaelisMentenPanel } from './enzyme/EnzymeViews';
import { DriftPanel, MendelPanel } from './genetics/GeneticsViews';
import { DiffusionOsmosisPanel } from './transport/TransportViews';
import { Segmented } from './ui';

const OPTIONS = [
  { id: 'a', label: L('Một', 'One') },
  { id: 'b', label: L('Hai', 'Two') },
  { id: 'c', label: L('Ba', 'Three') },
];

function Controlled({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState('a');
  return (
    <>
      <button type="button">before</button>
      <Segmented
        label={L('Chọn', 'Pick')}
        value={value}
        options={OPTIONS}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
      <button type="button">after</button>
    </>
  );
}

describe('Segmented (radio group)', () => {
  it('one tab stop: Tab reaches the checked radio only', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.tab();
    expect(screen.getByRole('button', { name: 'before' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Một' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Hai' })).toHaveAttribute('tabindex', '-1');
  });

  it('arrow keys move the focus and the choice, wrapping around; Home and End jump', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    screen.getByRole('radio', { name: 'Một' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Hai' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Hai' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Ba' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Một' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Ba' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', { name: 'Hai' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('radio', { name: 'Một' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{End}');
    expect(screen.getByRole('radio', { name: 'Ba' })).toHaveAttribute('aria-checked', 'true');
    expect(onChange.mock.calls.map((c) => c[0] as string)).toEqual([
      'b',
      'c',
      'a',
      'c',
      'b',
      'a',
      'c',
    ]);
    // The checked radio is the group's only tab stop.
    expect(screen.getByRole('radio', { name: 'Ba' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Một' })).toHaveAttribute('tabindex', '-1');
  });

  it('a click still chooses', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Ba' }));
    expect(onChange).toHaveBeenCalledWith('c');
    expect(screen.getByRole('radio', { name: 'Ba' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('slider labels of the population lessons (UI-50)', () => {
  it('every slider reads "label: value"; the Greek symbol follows the name', () => {
    const drift = render(<DriftPanel />);
    const driftNames = screen.getAllByRole('slider').map((s) => s.closest('label')?.textContent);
    expect(driftNames).toContain('Kích thước quần thể N: 50');
    expect(driftNames).toContain('Tần số ban đầu p₀: 0,5');
    drift.unmount();
    render(<LotkaVolterraPanel />);
    const lv = screen.getAllByRole('slider').map((s) => s.closest('label')?.textContent ?? '');
    expect(lv.every((t) => /: \S/.test(t))).toBe(true);
    expect(lv.some((t) => t.startsWith('Tốc độ chết của vật ăn thịt (γ): '))).toBe(true);
  });
});

describe('Basic mode in the biology panels', () => {
  afterEach(() => {
    useSettingsStore.setState({ uiMode: 'basic' });
    useLv.setState(useLv.getInitialState());
  });

  it('secondary controls wait behind "Thêm thông số"; Advanced shows them all', async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({ uiMode: 'basic' });
    const view = render(<LotkaVolterraPanel />);
    expect(screen.queryByText(/Con mồi ban đầu x₀/)).toBeNull();
    expect(screen.queryByText(/Vật ăn thịt ban đầu y₀/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Thêm thông số (2)' }));
    expect(screen.getByText(/Con mồi ban đầu x₀/)).toBeInTheDocument();
    view.unmount();
    act(() => {
      useSettingsStore.setState({ uiMode: 'advanced' });
    });
    render(<LotkaVolterraPanel />);
    expect(screen.getByText(/Vật ăn thịt ban đầu y₀/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm thông số/ })).toBeNull();
  });

  it('a value the learner changed is never hidden in Basic mode', () => {
    useSettingsStore.setState({ uiMode: 'basic' });
    act(() => {
      useLv.setState({ x0: 40 });
    });
    render(<LotkaVolterraPanel />);
    expect(screen.getByText(/Con mồi ban đầu x₀/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm thông số/ })).toBeNull();
  });

  it('every biology panel with more than five controls has a Basic view', () => {
    useSettingsStore.setState({ uiMode: 'basic' });
    for (const Panel of [
      LotkaVolterraPanel,
      MichaelisMentenPanel,
      DiffusionOsmosisPanel,
      MendelPanel,
    ]) {
      const view = render(<Panel />);
      expect(screen.getByRole('button', { name: /Thêm thông số/ })).toBeInTheDocument();
      view.unmount();
    }
  });
});
