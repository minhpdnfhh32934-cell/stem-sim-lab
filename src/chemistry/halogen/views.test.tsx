import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { pickTex } from '@/core/data/dataset';
import { useStudioStore } from '@/studio/studioStore';
import { HALOGENS_CARD, HYDROGEN_HALIDES_CARD } from './cards';
import { outerShell } from './format';
import { HalogenPanel, HalogenStage } from './HalogenViews';
import {
  HydrogenHalideBottom,
  HydrogenHalidePanel,
  HydrogenHalideStage,
} from './HydrogenHalideViews';
import { halogens, hydrogenHalides } from './modules';
import { useHalogenStore } from './store';

afterEach(() => {
  act(() => {
    useHalogenStore.setState({ z: 17, property: 'radius' });
    useSettingsStore.setState({ locale: 'vi', uiMode: 'basic' });
  });
});

describe('Nhóm halogen (HH10 Bài 21)', () => {
  it('four cards with the book’s values and NIST I₁ in kJ/mol', () => {
    const { container } = render(<HalogenStage />);
    const cards = container.querySelectorAll('.hal-card');
    expect(cards).toHaveLength(4);
    expect(cards[0]).toHaveTextContent('F2s² 2p⁵F₂ · Khí · Lục nhạtr72 pmχ3,98');
    expect(cards[0]).toHaveTextContent('tnc−219,6 °Cts−188,1 °C');
    expect(cards[2]).toHaveTextContent('Br₂ · Lỏng · Nâu đỏ');
    // Cl: 12,9676 eV × 96,4853 kJ/mol per eV ≈ 1 251 kJ/mol (4 significant digits).
    expect(cards[1]).toHaveTextContent('I₁1.251 kJ/mol');
    expect(screen.getByText(/Tính oxi hóa giảm dần từ fluorine đến iodine/)).toBeInTheDocument();
  });

  it('English: m.p. and b.p.; the pick button holds only the header, the facts sit beside it', () => {
    act(() => {
      useSettingsStore.setState({ locale: 'en' });
    });
    const { container } = render(<HalogenStage />);
    expect(container.querySelector('.hal-card')).toHaveTextContent('m.p.−219.6 °Cb.p.−188.1 °C');
    expect(container).not.toHaveTextContent('tnc');
    expect(container.querySelector('button dl')).toBeNull();
    expect(
      screen.getByRole('button', { name: /^F ?2s² 2p⁵ ?F₂ · Gas · Pale green$/ }),
    ).toBeInTheDocument();
  });

  it('outer shell from the element table', () => {
    expect([9, 17, 35, 53].map(outerShell)).toEqual(['2s² 2p⁵', '3s² 3p⁵', '4s² 4p⁵', '5s² 5p⁵']);
  });

  it('panel: the oxidation numbers the book states; Advanced compares other sources', () => {
    const { container, rerender } = render(<HalogenPanel />);
    expect(container).toHaveTextContent('số oxi hóa đặc trưng trong hợp chất là −1');
    expect(container).not.toHaveTextContent('Đối chiếu nguồn khác');
    act(() => {
      useSettingsStore.setState({ uiMode: 'advanced' });
    });
    rerender(<HalogenPanel />);
    // Cl: book radius 100 pm vs covalent 102 pm; t_nc −101,0 vs CRC −101,5 °C.
    expect(container).toHaveTextContent('r (pm)100102');
    expect(container).toHaveTextContent('tnc (°C)−101,0−101,5');
    fireEvent.change(screen.getByRole('combobox', { name: 'Đồ thị' }), {
      target: { value: 'boiling' },
    });
    expect(useHalogenStore.getState().property).toBe('boiling');
  });

  it('saves the halogen and the chart; ignores unknown values', () => {
    halogens.state?.set({ z: 35, property: 'en' });
    expect(useHalogenStore.getState()).toEqual({ z: 35, property: 'en' });
    halogens.state?.set({ z: 8, property: 'colour' });
    expect(useHalogenStore.getState()).toEqual({ z: 35, property: 'en' });
  });
});

describe('Hydrogen halide · Muối halide (HH10 Bài 22)', () => {
  it('bond energies from the book, acid trend, and only the library’s AgCl test', () => {
    render(<HydrogenHalideStage />);
    expect(screen.getByText('569 kJ/mol')).toBeInTheDocument();
    expect(screen.getByText('299 kJ/mol')).toBeInTheDocument();
    expect(screen.getByText(/tính acid tăng từ hydrofluoric acid \(yếu\)/)).toBeInTheDocument();
    expect(screen.getByText('Kết tủa trắng AgCl (dùng nhận biết ion Cl⁻).')).toBeInTheDocument();
    for (const x of ['F', 'Br', 'I'])
      expect(
        screen.getByText(
          `Phản ứng của AgNO₃ với Na${x} chưa có trong cơ sở dữ liệu đã kiểm chứng.`,
        ),
      ).toBeInTheDocument();
  });

  it('links the Science Studio lesson on Cl⁻ instead of repeating it', () => {
    render(<HydrogenHalideStage />);
    fireEvent.click(screen.getByRole('button', { name: 'Làm thí nghiệm trong Science Studio' }));
    expect(useStudioStore.getState()).toMatchObject({
      tab: 'chemistry',
      picked: { chemistry: 'chemistry.chloride-silver-nitrate' },
    });
  });

  it('Advanced: the Hess cross-check next to the book’s values', () => {
    act(() => {
      useSettingsStore.setState({ uiMode: 'advanced' });
    });
    const { container } = render(
      <>
        <HydrogenHalidePanel />
        <HydrogenHalideBottom />
      </>,
    );
    expect(container).toHaveTextContent('Năng lượng liên kết (SGK)432 kJ/mol');
    // CODATA: 217,998 + 121,301 − (−92,31) = 431,609 kJ/mol.
    expect(container).toHaveTextContent('= 431,609 kJ/mol');
    expect(container).toHaveTextContent('HCl12743284,9431,609'.replace('84,9', '−84,9'));
    hydrogenHalides.state?.set({ z: 9 });
    expect(useHalogenStore.getState().z).toBe(9);
  });
});

describe('Science Cards', () => {
  it('cite the book’s tables and the other sources; pending', () => {
    expect(HALOGENS_CARD.sources.map((s) => s.id)).toEqual(
      expect.arrayContaining([
        'sgk-hh10-hinh-6-2',
        'sgk-hh10-bang-6-2',
        'sgk-hh10-bang-21-2',
        'mendeleev',
      ]),
    );
    expect(HYDROGEN_HALIDES_CARD.sources.map((s) => s.id)).toEqual(
      expect.arrayContaining(['sgk-hh10-bang-22-1', 'openstax-chem2e-14-3', 'codata-key-values']),
    );
    expect(HALOGENS_CARD.reviewStatus).toBe('pending');
    expect(HYDROGEN_HALIDES_CARD.reviewStatus).toBe('pending');
  });

  it('formulas render in KaTeX without a warning', async () => {
    const katex = (await import('katex')).default;
    for (const card of [HALOGENS_CARD, HYDROGEN_HALIDES_CARD])
      for (const locale of ['vi', 'en'] as const)
        for (const e of card.equations) {
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
