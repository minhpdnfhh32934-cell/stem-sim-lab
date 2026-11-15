import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { pickTex } from '@/core/data/dataset';
import { PERIOD_TRENDS_CARD } from './card';
import { periodTrends } from './modules';
import { PeriodTrendBottom, PeriodTrendPanel, PeriodTrendStage } from './PeriodTrendViews';
import { usePeriodTrendStore } from './store';

afterEach(() => {
  act(() => {
    usePeriodTrendStore.setState({ z: 11 });
    useSettingsStore.setState({ locale: 'vi' });
  });
});

describe('Oxide và hydroxide trong chu kì 3 (HH10 Bài 7)', () => {
  it('seven cards Na…Cl with formulas and the book’s character words', () => {
    const { container } = render(<PeriodTrendStage />);
    const cards = container.querySelectorAll('.p3-card');
    expect(cards).toHaveLength(7);
    expect(cards[0]).toHaveTextContent('NaIA · +1Na₂Obasic oxideNaOHbase mạnh');
    expect(cards[2]).toHaveTextContent(
      'AlIIIA · +3Al₂O₃oxide lưỡng tínhAl(OH)₃hydroxide lưỡng tính',
    );
    expect(cards[6]).toHaveTextContent('ClVIIA · +7Cl₂O₇acidic oxideHClO₄acid rất mạnh');
    expect(screen.getByText('Chiều giảm tính base và tăng tính acid')).toBeInTheDocument();
  });

  it('clicking a card shows how its formulas follow from the group', () => {
    render(
      <>
        <PeriodTrendStage />
        <PeriodTrendPanel />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: /^S\s?VIA/ }));
    expect(usePeriodTrendStore.getState().z).toBe(16);
    expect(screen.getByText('Nhóm VIA → +6')).toBeInTheDocument();
    expect(
      screen.getByText(/n = 6 chẵn: 1 nguyên tử S, n : 2 = 3 nguyên tử O/),
    ).toBeInTheDocument();
    expect(screen.getByText(/công thức acid theo SGK Bảng 7.1/)).toBeInTheDocument();
    expect(
      screen.getByText('Kiểm tra: với H +1, O −2 thì S có số oxi hoá +6 trong H₂SO₄.'),
    ).toBeInTheDocument();
  });

  it('bottom: the book’s Bảng 7.2 with the selected row marked', () => {
    const { container } = render(<PeriodTrendBottom />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(7);
    expect(container.querySelector('tr.is-active')).toHaveTextContent('Na');
  });

  it('saves the element; ignores one outside period 3', () => {
    periodTrends.state?.set({ z: 15 });
    expect(usePeriodTrendStore.getState().z).toBe(15);
    periodTrends.state?.set({ z: 26 });
    expect(usePeriodTrendStore.getState().z).toBe(15);
  });
});

describe('Science Card', () => {
  it('cites the book and the cross-check, qualitative, pending', () => {
    expect(PERIOD_TRENDS_CARD.sources.map((s) => s.id)).toEqual(
      expect.arrayContaining(['sgk-hh10-kntt-b7', 'libretexts-period3-oxides', 'mendeleev']),
    );
    expect(PERIOD_TRENDS_CARD.confidence).toBe('qualitative');
    expect(PERIOD_TRENDS_CARD.reviewStatus).toBe('pending');
  });

  it('formulas render in KaTeX without a warning', async () => {
    const katex = (await import('katex')).default;
    for (const locale of ['vi', 'en'] as const)
      for (const e of PERIOD_TRENDS_CARD.equations) {
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
