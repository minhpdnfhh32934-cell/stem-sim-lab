import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { acidBaseTitration } from './modules';
import { useTitrationStore } from './store';
import { titrationCard } from './card';
import { TitrationPanel, TitrationStage } from './TitrationViews';

beforeEach(() => {
  useSettingsStore.setState({ locale: 'vi', uiMode: 'advanced' });
  useTitrationStore.setState({ ca: 0.1, va: 10, cb: 0.1, vb: 0, indicator: 'phenolphthalein' });
});

describe('TitrationStage', () => {
  it('dragging the NaOH volume changes the pH and the indicator colour', () => {
    const { container } = render(<TitrationStage />);
    expect(screen.getByText('1,00')).toBeTruthy();
    expect(screen.getByText(/không màu/)).toBeTruthy();
    const fill = () => container.querySelector<SVGRectElement>('.tit-solution')?.style.fill;
    const colourless = fill();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '15' } });
    expect(useTitrationStore.getState().vb).toBe(15);
    expect(screen.getByText(/hồng tím/)).toBeTruthy();
    expect(screen.getByText(/NaOH dư/)).toBeTruthy();
    expect(fill()).not.toBe(colourless);
  });

  it('keeps the added volume inside the burette range when the inputs change', () => {
    useTitrationStore.setState({ vb: 20 });
    render(<TitrationPanel />);
    fireEvent.change(screen.getByLabelText('Nồng độ NaOH C_b (mol/L)'), {
      target: { value: '0,2' },
    });
    expect(useTitrationStore.getState()).toMatchObject({ cb: 0.2, vb: 10 });
  });
});

describe('TitrationPanel in Basic mode', () => {
  it('shows only concentrations and volumes, unless the indicator was changed', () => {
    useSettingsStore.setState({ uiMode: 'basic' });
    const { rerender } = render(<TitrationPanel />);
    expect(screen.queryByLabelText('Chất chỉ thị')).toBeNull();
    useTitrationStore.setState({ indicator: 'methylOrange' });
    rerender(<TitrationPanel />);
    expect(screen.getByLabelText('Chất chỉ thị')).toBeTruthy();
  });
});

describe('titration module', () => {
  it('saves and restores its inputs through the validating setter', () => {
    const state = acidBaseTitration.state;
    if (!state) throw new Error('module has no state binding');
    useTitrationStore.setState({ vb: 7.5, indicator: 'methylRed' });
    const saved = state.get();
    useTitrationStore.setState({ ca: 0.5, vb: 0, indicator: 'phenolphthalein' });
    state.set(saved);
    expect(useTitrationStore.getState()).toMatchObject({
      ca: 0.1,
      vb: 7.5,
      indicator: 'methylRed',
    });
    state.set({ ca: 50, va: -3, indicator: 'unknown' });
    expect(useTitrationStore.getState()).toMatchObject({
      ca: 1,
      va: 1,
      indicator: 'phenolphthalein',
    });
  });

  it('Science Card formulas render in KaTeX without a warning', async () => {
    const katex = (await import('katex')).default;
    for (const locale of ['vi', 'en'] as const) {
      for (const e of titrationCard(locale).equations) {
        const warned: string[] = [];
        katex.renderToString(e.tex, {
          throwOnError: true,
          strict: (code: string) => {
            warned.push(code);
            return 'ignore';
          },
        });
        expect(warned, e.tex).toEqual([]);
      }
    }
  });
});
