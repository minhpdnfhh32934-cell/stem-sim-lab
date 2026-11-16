import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { pickTex } from '@/core/data/dataset';
import { REDOX_CARD } from './card';
import { redox } from './modules';
import { RedoxBottom, RedoxPanel, RedoxStage } from './RedoxViews';
import { useRedoxStore } from './store';

afterEach(() => {
  act(() => {
    useRedoxStore.setState({ id: 'fe2o3-co', equation: '' });
    useSettingsStore.setState({ locale: 'vi', uiMode: 'basic' });
  });
});

describe('Phản ứng oxi hóa – khử (HH10 Bài 15)', () => {
  it('Fe2O3 + 3CO: oxidation numbers above the symbols, agents and 6 electrons', () => {
    render(<RedoxStage />);
    expect(screen.getByRole('group', { name: 'Fe₂O₃: Fe +3, O −2' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '3CO: C +2, O −2' })).toBeInTheDocument();
    const facts = screen.getByText('Chất khử (chất nhường electron)').parentElement;
    expect(facts).toHaveTextContent('Chất khử (chất nhường electron)CO');
    expect(facts).toHaveTextContent('Chất oxi hóa (chất nhận electron)Fe₂O₃');
    expect(facts).toHaveTextContent('= 6');
    // Bước 3 of the book: 3 × (C⁺² → C⁺⁴ + 2e), 2 × (Fe⁺³ + 3e → Fe⁰).
    expect(facts).toHaveTextContent('3 ×+2C→+4C+ 2e');
    expect(facts).toHaveTextContent('2 ×+3Fe+ 3e→0Fe');
  });

  it('a library reaction the rules cannot decide says so and names the species', () => {
    act(() => {
      useRedoxStore.setState({ id: 'fe-cuso4' });
    });
    render(<RedoxStage />);
    expect(screen.getByText(/Quy tắc xác định số oxi hóa chưa đủ cho/)).toBeInTheDocument();
    expect(screen.getByText(/CuSO₄: còn hai nguyên tố chưa biết \(Cu, S\)/)).toBeInTheDocument();
    // The "?" marks are hidden from screen readers; the label says the numbers are undecided.
    expect(
      screen.getByRole('group', { name: 'CuSO₄: chưa xác định số oxi hóa' }),
    ).toBeInTheDocument();
  });

  it('a reaction that is not redox', () => {
    act(() => {
      useRedoxStore.setState({ id: 'caco3-decomp' });
    });
    render(<RedoxStage />);
    expect(screen.getByText(/không phải phản ứng oxi hóa – khử/)).toBeInTheDocument();
  });

  it('Advanced: a typed equation outside the library gets the warning; a library one opens', () => {
    act(() => {
      useSettingsStore.setState({ uiMode: 'advanced' });
    });
    render(<RedoxPanel />);
    const box = screen.getByRole('textbox', { name: 'Tìm phương trình' });
    fireEvent.change(box, { target: { value: 'Fe + Cl2 -> FeCl3' } });
    expect(screen.getByText(/chưa có trong cơ sở dữ liệu đã kiểm chứng/)).toBeInTheDocument();
    // The exact reverse of a reversible library reaction is in the library, not missing.
    fireEvent.change(box, { target: { value: '2NH3 -> N2 + 3H2' } });
    expect(screen.queryByText(/chưa có trong cơ sở dữ liệu đã kiểm chứng/)).toBeNull();
    expect(screen.getByText(/chiều nghịch của phản ứng thuận nghịch/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mở phản ứng này' }));
    expect(useRedoxStore.getState().id).toBe('haber');
    fireEvent.change(box, { target: { value: 'Zn + HCl -> ZnCl2 + H2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mở phản ứng này' }));
    expect(useRedoxStore.getState().id).toBe('zn-hcl');
  });

  it('Basic mode has no typed equation; the reaction list is grouped by verdict', () => {
    render(<RedoxPanel />);
    expect(screen.queryByRole('textbox')).toBeNull();
    const groups = [...document.querySelectorAll('optgroup')].map((g) => g.label);
    expect(groups).toEqual([
      'Phản ứng oxi hóa – khử',
      'Không phải oxi hóa – khử',
      'Quy tắc chưa đủ để xác định',
    ]);
  });

  it('bottom: every species with its numbers or the reason the rules stop', () => {
    act(() => {
      useRedoxStore.setState({ id: 'h2o2-decomp' });
    });
    const { container } = render(<RedoxBottom />);
    expect(container).toHaveTextContent('O là −1 (peroxide)');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('saves the reaction and the typed equation; ignores unknown ids', () => {
    redox.state?.set({ id: 'ostwald', equation: 'NH3 + O2 -> NO + H2O' });
    expect(useRedoxStore.getState()).toEqual({
      id: 'ostwald',
      equation: 'NH3 + O2 -> NO + H2O',
    });
    redox.state?.set({ id: 'no-such-reaction' });
    expect(useRedoxStore.getState().id).toBe('ostwald');
  });
});

describe('Science Card', () => {
  it('cites the book and the exceptions’ source, and is pending', () => {
    expect(REDOX_CARD.sources.map((s) => s.id)).toEqual(
      expect.arrayContaining(['sgk-hh10-kntt-b15', 'openstax-chem2e-4-2', 'curated']),
    );
    expect(REDOX_CARD.model.vi).toContain('điện tích quy ước');
    expect(REDOX_CARD.reviewStatus).toBe('pending');
  });

  it('formulas render in KaTeX without a warning', async () => {
    const katex = (await import('katex')).default;
    for (const locale of ['vi', 'en'] as const)
      for (const e of REDOX_CARD.equations) {
        const warned: string[] = [];
        katex.renderToString(pickTex(e.tex, locale), {
          throwOnError: true,
          strict: (code: string) => {
            warned.push(code);
            return 'ignore';
          },
        });
        expect(warned).toEqual([]);
      }
  });
});
