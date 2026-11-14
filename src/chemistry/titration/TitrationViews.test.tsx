import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { acidBaseTitration } from './modules';
import { addedVolume, setTitration, useTitrationStore } from './store';
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
    fireEvent.change(screen.getByRole('slider'), { target: { value: '12' } });
    expect(useTitrationStore.getState().vb).toBe(12);
    expect(screen.getByText(/hồng tím/)).toBeTruthy();
    expect(screen.getByText(/NaOH dư/)).toBeTruthy();
    expect(fill()).not.toBe(colourless);
  });

  it('keeps the NaOH added while a new HCl volume is typed digit by digit', () => {
    useTitrationStore.setState({ vb: 15 });
    render(<TitrationPanel />);
    const field = screen.getByLabelText('Thể tích HCl (mL)');
    fireEvent.change(field, { target: { value: '2' } });
    expect(useTitrationStore.getState().vb).toBe(15);
    expect(addedVolume(useTitrationStore.getState())).toBe(4);
    fireEvent.change(field, { target: { value: '25' } });
    expect(useTitrationStore.getState()).toMatchObject({ va: 25, vb: 15 });
  });

  it('says "at the equivalence point" only at V_eq, not near it after a concentration change', () => {
    render(<TitrationStage />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '10' } });
    expect(screen.getByText(/Tại điểm tương đương/)).toBeTruthy();
    act(() => {
      setTitration({ vb: 11.11 });
      setTitration({ cb: 0.09 });
    });
    expect(screen.queryByText(/Tại điểm tương đương/)).toBeNull();
    expect(screen.getByText(/HCl còn dư/)).toBeTruthy();
  });

  it('prints pH 0,00 (not −0,00) for 1 mol/L HCl, and small volumes with their digits', () => {
    useTitrationStore.setState({ ca: 1, va: 10, cb: 1, vb: 0 });
    const { unmount } = render(<TitrationStage />);
    expect(screen.getByText('0,00')).toBeTruthy();
    unmount();
    useTitrationStore.setState({ ca: 0.001, va: 1, cb: 1, vb: 0 });
    render(<TitrationStage />);
    expect(screen.getByText(/= 0,001000 mL/)).toBeTruthy();
  });

  it('labels the figure as an illustration and names the two nudge buttons apart', () => {
    render(<TitrationStage />);
    expect(screen.getByText('Hình và màu minh họa, không theo tỉ lệ')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm 0,1 mL NaOH' }));
    expect(useTitrationStore.getState().vb).toBeCloseTo(0.1, 12);
    fireEvent.click(screen.getByRole('button', { name: 'Bớt 0,1 mL NaOH' }));
    expect(useTitrationStore.getState().vb).toBeCloseTo(0, 12);
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

  it('Science Card shows pKw with enough digits to tell it from the textbook 14', () => {
    expect(titrationCard('vi').assumptions[0]?.vi).toContain('pKw = 13,9969');
    expect(titrationCard('en').assumptions[0]?.en).toContain('pKw = 13.9969');
  });

  it('names the equivalence volume in the learner’s language (V_tđ / V_eq)', () => {
    const { container, unmount } = render(<TitrationStage />);
    expect(container.textContent).toContain('Vtđ = 10,00 mL');
    expect(titrationCard('vi').equations.some((e) => e.tex.includes('tđ'))).toBe(true);
    unmount();
    act(() => {
      useSettingsStore.setState({ locale: 'en' });
    });
    const en = render(<TitrationStage />);
    expect(en.container.textContent).toContain('Veq = 10.00 mL');
    expect(en.container.textContent).not.toContain('tđ');
    expect(
      titrationCard('en')
        .equations.map((e) => e.tex)
        .join(' '),
    ).not.toContain('tđ');
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
