import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { pickTex } from '@/core/data/dataset';
import { isotopesOf } from '../data/isotopes';
import { COMPOSITION_CARD, ISOTOPE_CARD } from './cards';
import { CompositionBottom, CompositionPanel, CompositionStage } from './CompositionViews';
import { IsotopePanel, IsotopeStage } from './IsotopeViews';
import { atomComposition, isotopes } from './modules';
import { useCompositionStore, useIsotopeStore } from './store';

afterEach(() => {
  act(() => {
    useCompositionStore.setState({ z: 6, n: 6, electrons: 6 });
    useIsotopeStore.setState({ z: 17, average: 35.45 });
    useSettingsStore.setState({ locale: 'vi', uiMode: 'basic' });
  });
});

describe('Thành phần của nguyên tử (HH10 Bài 1)', () => {
  it('¹²C: element, A, charge, and as many dots as particles, labelled an illustration', () => {
    const { container } = render(
      <>
        <CompositionStage />
        <CompositionPanel />
      </>,
    );
    expect(
      screen.getByRole('img', { name: 'Hình minh họa: 6 proton, 6 neutron, 6 electron' }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('.atom-pic__proton')).toHaveLength(6);
    expect(container.querySelectorAll('.atom-pic__neutron')).toHaveLength(6);
    expect(container.querySelectorAll('.atom-pic__electron')).toHaveLength(6);
    expect(screen.getByText('Hình minh họa, không theo tỉ lệ')).toBeInTheDocument();
    expect(container).toHaveTextContent('C — Carbon (cacbon)');
    expect(container).toHaveTextContent('Số khối A = Z + N12');
    expect(container).toHaveTextContent('0 · nguyên tử trung hòa · ¹²₆C');
    // Covalent radius 73 pm (elements.json) over 1,2·12^(1/3) fm ≈ 2,75 fm.
    expect(container).toHaveTextContent('≈ 2,7 × 10⁴ lần');
  });

  it('a new Z lands on its most abundant isotope and keeps the charge', () => {
    render(<CompositionPanel />);
    fireEvent.change(screen.getByRole('slider', { name: 'Số electron' }), {
      target: { value: '7' },
    });
    expect(useCompositionStore.getState()).toEqual({ z: 6, n: 6, electrons: 7 });
    fireEvent.change(screen.getByRole('slider', { name: 'Số proton Z' }), {
      target: { value: '17' },
    });
    expect(useCompositionStore.getState()).toEqual({ z: 17, n: 18, electrons: 18 });
    expect(screen.getByText(/ion âm \(anion\)/)).toHaveTextContent('³⁵₁₇Cl⁻');
  });

  it('bottom: masses of the particles, and the mass defect only for a natural nuclide', () => {
    act(() => {
      useSettingsStore.setState({ uiMode: 'advanced' });
    });
    const { container, rerender } = render(<CompositionBottom />);
    expect(container).toHaveTextContent('1,67262 × 10⁻²⁷ kg');
    expect(container).toHaveTextContent('1,007276467 u');
    expect(container).toHaveTextContent('Khối lượng thực của nguyên tử ¹²₆C');
    expect(container).toHaveTextContent('lớn hơn 0,09894 u');
    expect(container).toHaveTextContent('Đó là độ hụt khối, do năng lượng liên kết hạt nhân');
    act(() => {
      useCompositionStore.setState({ n: 9 });
    });
    rerender(<CompositionBottom />);
    expect(container).toHaveTextContent('¹⁵₆C không có trong bảng đồng vị tự nhiên');
  });

  it('¹H: the difference is the electron binding, not a nuclear one', () => {
    act(() => {
      useCompositionStore.setState({ z: 1, n: 0, electrons: 1 });
    });
    const { container } = render(<CompositionBottom />);
    expect(container).toHaveTextContent('¹H không có liên kết hạt nhân');
    expect(container).not.toHaveTextContent('độ hụt khối');
  });

  it('a saved file is clamped to the sliders', () => {
    atomComposition.state?.set({ z: 99, n: -4, electrons: 1 });
    expect(useCompositionStore.getState()).toEqual({ z: 36, n: 0, electrons: 33 });
  });
});

describe('Nguyên tố hóa học và đồng vị (HH10 Bài 2)', () => {
  it('Cl: 75,8 % and 24,2 %, Ā = 35,484 from mass numbers, 35,45214 from masses', () => {
    const { container } = render(<IsotopeStage />);
    expect(container).toHaveTextContent('(35 × 75,8 + 37 × 24,2) / 100 = 35,484');
    expect(container).toHaveTextContent('35,45214');
    expect(container).toHaveTextContent('Nguyên tử khối chuẩn IUPAC (để so sánh)35,45');
    expect(container.querySelector('.chem-note')).toBeNull();
  });

  it('reverse problem: Ā = 35,5 → 75 % / 25 %; outside the mass numbers → no answer', () => {
    render(<IsotopePanel />);
    const box = screen.getByRole('textbox', { name: 'Nguyên tử khối trung bình Ā' });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: '35,5' } });
    expect(useIsotopeStore.getState().average).toBe(35.5);
    expect(screen.getByRole('row', { name: /^³⁵Cl 75 % / })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /^³⁷Cl 25 % / })).toBeInTheDocument();
    fireEvent.change(box, { target: { value: '38' } });
    expect(screen.getAllByRole('note')[0]).toHaveTextContent('Ā phải nằm giữa 35 và 37');
  });

  it('reverse problem with real masses: Cu at its IUPAC weight gives the table 69,1 %; He solves too', () => {
    act(() => {
      useIsotopeStore.setState({ z: 29, average: 63.546 });
    });
    const { rerender } = render(<IsotopePanel />);
    const cu = screen.getByRole('row', { name: /^⁶³Cu / });
    expect(cu).toHaveTextContent(/72,7 %/);
    expect(cu).toHaveTextContent(/69,152 %/);
    act(() => {
      useIsotopeStore.setState({ z: 2, average: 4.002602 });
    });
    rerender(<IsotopePanel />);
    expect(screen.getByRole('note')).toHaveTextContent('Theo số khối thì không giải được');
    expect(screen.getByRole('row', { name: /^⁴He / })).toHaveTextContent(/99,99[0-9]* %/);
  });

  it('a three-isotope element: no reverse problem; the named examples have two isotopes', () => {
    act(() => {
      useIsotopeStore.setState({ z: 26 });
    });
    render(<IsotopePanel />);
    expect(screen.getByText(/Fe có 4/)).toBeInTheDocument();
    for (const z of [17, 29, 35, 5]) expect(isotopesOf(z)?.isotopes).toHaveLength(2);
  });

  it('Ta: says its percentages miss part of 100 % and divides by their sum', () => {
    act(() => {
      useIsotopeStore.setState({ z: 73 });
    });
    const { container } = render(<IsotopeStage />);
    expect(screen.getByRole('note')).toHaveTextContent('cộng lại được 99,98799 %');
    expect(container).toHaveTextContent('(181 × 99,98799) / 99,98799 = 181');
  });

  it('a saved file: an element without natural isotopes is ignored, the average kept', () => {
    isotopes.state?.set({ z: 43, average: 99 });
    expect(useIsotopeStore.getState()).toEqual({ z: 17, average: 99 });
    isotopes.state?.set({ z: 29 });
    expect(useIsotopeStore.getState()).toEqual({ z: 29, average: 63.546 });
  });
});

describe('Science Cards', () => {
  it('cite their data and say what is approximate', () => {
    expect(COMPOSITION_CARD.confidence).toBe('approx');
    expect(COMPOSITION_CARD.sources.map((s) => s.id)).toEqual(
      expect.arrayContaining(['codata', 'krane-nuclear', 'mendeleev', 'ciaaw-atomic-masses']),
    );
    expect(COMPOSITION_CARD.assumptions.map((a) => a.vi).join(' ')).toContain(
      'sách giáo khoa bỏ qua',
    );
    expect(ISOTOPE_CARD.confidence).toBe('exact');
    expect(ISOTOPE_CARD.sources.map((s) => s.id)).toEqual(
      expect.arrayContaining(['ciaaw-atomic-masses', 'nubase2020', 'mendeleev']),
    );
    expect(COMPOSITION_CARD.reviewStatus).toBe('pending');
    expect(ISOTOPE_CARD.reviewStatus).toBe('pending');
  });

  it('formulas render in KaTeX without a warning', async () => {
    const katex = (await import('katex')).default;
    for (const card of [COMPOSITION_CARD, ISOTOPE_CARD]) {
      for (const locale of ['vi', 'en'] as const) {
        for (const e of card.equations) {
          const warned: string[] = [];
          katex.renderToString(pickTex(e.tex, locale), {
            throwOnError: true,
            strict: (code: string) => {
              warned.push(code);
              return 'ignore';
            },
          });
          expect(warned, pickTex(e.tex, locale)).toEqual([]);
        }
      }
    }
  });
});
