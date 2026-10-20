import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { mitosis } from '../modules';
import { DivisionBottom, DivisionPanel } from './DivisionViews';
import { STAGES } from './division';
import { setDivisionState } from './stageIndex';
import { PAIR_CHOICES, cardFor, useDivisionStore } from './state';

beforeEach(() => {
  setDivisionState('mitosis', { pairs: 2, index: 0, playing: false });
});

describe('2n selector', () => {
  it('offers 2n = 2, 4, 6, 8 only: the 3D picture is not drawn for larger sets', () => {
    expect([...PAIR_CHOICES]).toEqual([1, 2, 3, 4]);
    render(<DivisionPanel kind="mitosis" />);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '2n = 2',
      '2n = 4',
      '2n = 6',
      '2n = 8',
    ]);
    // A file asking for 2n = 46 (or any 2n outside the selector) keeps the current 2n.
    for (const pairs of [0, 5, 23]) {
      mitosis.state!.set({ pairs });
      expect(useDivisionStore.getState().pairs).toBe(2);
    }
    for (const pairs of PAIR_CHOICES) {
      mitosis.state!.set({ pairs });
      expect(useDivisionStore.getState().pairs).toBe(pairs);
    }
  });
});

describe('2D counts table', () => {
  it('every row can be reached and used with the keyboard', async () => {
    const user = userEvent.setup();
    render(<DivisionBottom kind="mitosis" />);
    const rows = screen.getAllByRole('rowheader');
    expect(rows).toHaveLength(STAGES.mitosis.length);
    const buttons = rows.map((th) => within(th).getByRole('button'));
    for (const b of buttons) {
      await user.tab();
      expect(b).toHaveFocus();
    }
    expect(buttons[0]).toHaveAttribute('aria-current', 'step');
    buttons[3]!.focus();
    await user.keyboard('{Enter}');
    expect(useDivisionStore.getState()).toMatchObject({ index: 3, playing: false });
    expect(buttons[3]).toHaveAttribute('aria-current', 'step');
  });
});

describe('Science Card of a division', () => {
  it('mitosis states only mitotic rules; meiosis keeps its own', () => {
    const mitosisCard = cardFor('mitosis');
    for (const text of [mitosisCard.model.vi, mitosisCard.model.en]) {
      expect(text).not.toMatch(/kì đầu I|kì sau I|kì sau II|trao đổi chéo|tiếp hợp/);
      expect(text).not.toMatch(/prophase I|anaphase I|crossing over|synapsis/);
    }
    expect(mitosisCard.model.vi).toContain('tách crômatit chị em ở kì sau');
    const meiosisCard = cardFor('meiosis');
    expect(meiosisCard.model.vi).toContain('trao đổi chéo ở kì đầu I');
    expect(meiosisCard.model.vi).toContain('kì sau II');
    expect(meiosisCard.model.vi).not.toContain('nguyên phân');
  });
});
