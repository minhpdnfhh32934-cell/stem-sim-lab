import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { pickTex } from '@/core/data/dataset';
import { ENTHALPY_CARD } from './card';
import { EnthalpyBottom, EnthalpyPanel, EnthalpyStage } from './EnthalpyViews';
import { reactionEnthalpy } from './modules';
import { useEnthalpyStore } from './store';

afterEach(() => {
  act(() => {
    useEnthalpyStore.setState({ id: 'ch4-combustion' });
    useSettingsStore.setState({ locale: 'vi', uiMode: 'basic' });
  });
});

describe('Biến thiên enthalpy của phản ứng (HH10 Bài 17)', () => {
  it('methane: the two sums and ΔrH°298 = −890,2 kJ, exothermic', () => {
    const { container } = render(<EnthalpyStage />);
    expect(container).toHaveTextContent('CH₄(g) + 2O₂(g) → CO₂(g) + 2H₂O(l)ΔrH°298 = −890,2 kJ');
    expect(container).toHaveTextContent('ΣΔfH°298(sp) = 1 · (−393,5) + 2 · (−285,8) = −965,1 kJ');
    // An element's defined 0 is written "0", the book's values with their own decimal.
    expect(container).toHaveTextContent('ΣΔfH°298(cđ) = 1 · (−74,9) + 2 · (0) = −74,9 kJ');
    expect(screen.getByText('ΔrH < 0: phản ứng toả nhiệt.')).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Sơ đồ: sản phẩm thấp hơn chất đầu, ΔrH°298 = −890,2 kJ',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Minh hoạ, không theo tỉ lệ')).toBeInTheDocument();
  });

  it('CaCO3 decomposition is endothermic with the book’s values', () => {
    act(() => {
      useEnthalpyStore.setState({ id: 'caco3-decomp' });
    });
    const { container } = render(<EnthalpyStage />);
    expect(container).toHaveTextContent('ΔrH°298 = 178,3 kJ');
    expect(screen.getByText('ΔrH > 0: phản ứng thu nhiệt.')).toBeInTheDocument();
  });

  it('bottom: values and sources; Advanced adds the NIST cross-check', () => {
    const { container, rerender } = render(<EnthalpyBottom />);
    expect(container).toHaveTextContent('CH₄khí1−74,9−74,9SGK Bảng 17.1');
    expect(container).toHaveTextContent('O₂khí200đơn chất bền: 0');
    expect(container).not.toHaveTextContent('NIST (đối chiếu)');
    act(() => {
      useSettingsStore.setState({ uiMode: 'advanced' });
    });
    rerender(<EnthalpyBottom />);
    expect(container).toHaveTextContent('NIST (đối chiếu)');
    expect(container).toHaveTextContent('SGK Bảng 17.1−74,87');
  });

  it('NH4Cl: each value as its source prints it; the result to the least precise decimal', () => {
    act(() => {
      useEnthalpyStore.setState({ id: 'nh4cl-decomp' });
    });
    const { container } = render(<EnthalpyStage />);
    expect(container).toHaveTextContent('ΣΔfH°298(sp) = 1 · (−45,9) + 1 · (−92,3) = −138,2 kJ');
    expect(container).toHaveTextContent('ΣΔfH°298(cđ) = 1 · (−314,55) = −314,55 kJ');
    expect(container).toHaveTextContent('ΔrH°298 = −138,2 − (−314,55) = 176,35 ≈ 176,4 kJ');
    expect(screen.getByText('ΔrH > 0: phản ứng thu nhiệt.')).toHaveClass('chem-note');
    expect(screen.getByText('ΔrH > 0: phản ứng thu nhiệt.')).not.toHaveClass('chem-note--warn');
  });

  it('English: the sums say products and reactants', () => {
    act(() => {
      useSettingsStore.setState({ locale: 'en' });
    });
    const { container } = render(<EnthalpyStage />);
    expect(container).toHaveTextContent('ΣΔfH°298(products) = 1 · (−393.5) + 2 · (−285.8)');
    expect(container).toHaveTextContent('ΣΔfH°298(reactants) = 1 · (−74.9)');
  });

  it('a value the book lacks comes from NIST and says so', () => {
    act(() => {
      useEnthalpyStore.setState({ id: 'nh4cl-decomp' });
    });
    const { container } = render(<EnthalpyBottom />);
    expect(container).toHaveTextContent('NH₄Clrắn1−314,55−314,55NIST (JANAF)');
  });

  it('panel lists the library reactions; saves the reaction, ignores others', () => {
    render(<EnthalpyPanel />);
    expect(screen.getAllByRole('option')).toHaveLength(8);
    reactionEnthalpy.state?.set({ id: 'thermite' });
    expect(useEnthalpyStore.getState().id).toBe('thermite');
    reactionEnthalpy.state?.set({ id: 'zn-hcl' });
    expect(useEnthalpyStore.getState().id).toBe('thermite');
  });
});

describe('Science Card', () => {
  it('cites the book first, then NIST; pending', () => {
    expect(ENTHALPY_CARD.sources.map((s) => s.id)).toEqual([
      'sgk-hh10-kntt-b17',
      'codata-key-values',
      'nist-janaf',
      'curated',
    ]);
    expect(ENTHALPY_CARD.reviewStatus).toBe('pending');
  });

  it('formulas render in KaTeX without a warning', async () => {
    const katex = (await import('katex')).default;
    for (const locale of ['vi', 'en'] as const)
      for (const e of ENTHALPY_CARD.equations) {
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
