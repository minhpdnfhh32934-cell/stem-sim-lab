import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { setDivisionState } from '../stageIndex';
import { Mitosis3DBottom } from './panels';
import { timelineFor, useMitosis3D } from './store';
import { STAGES_3D, type CellType } from './timeline';

/**
 * The seven rows of the 3D counts table for 2n = 2p, derived by hand from the textbook table
 * (SGK Sinh học 10). Columns: stage, cells, nuclei per cell (start → end of the step),
 * chromosomes per cell, state, chromatids, centromeres, DNA molecules. Telophase is ONE cell
 * with TWO nuclei of 2n each (the 3D convention, pending teacher review); cytokinesis counts
 * one daughter cell after the division.
 */
function textbookRows(p: number): string[][] {
  const n2 = String(2 * p);
  const n4 = String(4 * p);
  return [
    ['Kì trung gian (pha G1)', '1', '1', n2, 'đơn', '0', n2, n2],
    ['Kì trung gian (sau pha S, G2)', '1', '1', n2, 'kép', n4, n2, n4],
    ['Kì đầu', '1', '1 → 0', n2, 'kép', n4, n2, n4],
    ['Kì giữa', '1', '0', n2, 'kép', n4, n2, n4],
    ['Kì sau', '1', '0', n4, 'đơn', '0', n4, n4],
    ['Kì cuối', '1', '0 → 2', n4, 'đơn', '0', n4, n4],
    ['Phân chia tế bào chất', '2', '2 → 1', n2, 'đơn', '0', n2, n2],
  ];
}

const cellsOf = (row: HTMLElement) =>
  [...row.querySelectorAll('th, td')].map((c) => c.textContent.trim());

beforeEach(() => {
  setDivisionState('mitosis', { pairs: 2, index: 0, cellType: 'animal', view3d: true, speed: 1 });
  useMitosis3D.setState({ t: 0, playing: false, selected: null, active: true });
});

describe('3D counts table (Mitosis3DBottom)', () => {
  for (const type of ['animal', 'plant'] as CellType[]) {
    it(`${type}: every row and column matches the textbook (2n = 2, 4, 6, 8, 46)`, () => {
      for (const p of [1, 2, 3, 4, 23]) {
        setDivisionState('mitosis', { pairs: p, cellType: type });
        const view = render(<Mitosis3DBottom />);
        const [head, ...rows] = screen.getAllByRole('row');
        expect(cellsOf(head!)).toEqual([
          'Kì',
          'Số tế bào',
          'Số nhân / tế bào',
          'Số NST / tế bào',
          'Trạng thái',
          'Crômatit',
          'Tâm động',
          'Phân tử ADN',
        ]);
        expect(
          rows.map((r) => cellsOf(r)),
          `${type} 2n=${String(2 * p)}`,
        ).toEqual(textbookRows(p));
        expect(
          screen.getByText(
            /^Kì cuối: 1 tế bào có 2 nhân, mỗi nhân 2n NST đơn \(cả tế bào có 4n NST đơn\)/,
          ),
        ).toBeInTheDocument();
        view.unmount();
      }
    });
  }

  it('marks the stage being shown; a click on a row goes to that stage', () => {
    const tl = timelineFor(2, 'animal');
    render(<Mitosis3DBottom />);
    const active = () =>
      screen
        .getAllByRole('row')
        .filter((r) => r.classList.contains('is-active'))
        .map((r) => cellsOf(r)[0]);
    expect(active()).toEqual(['Kì trung gian (pha G1)']);
    act(() => {
      useMitosis3D.setState({ t: tl.keyTime('anaphase') });
    });
    expect(active()).toEqual(['Kì sau']);
    act(() => {
      useMitosis3D.setState({ playing: true });
    });
    fireEvent.click(screen.getByRole('rowheader', { name: 'Kì cuối' }));
    expect(useMitosis3D.getState()).toMatchObject({ t: tl.keyTime('telophase'), playing: false });
    expect(active()).toEqual(['Kì cuối']);
  });

  it('every row can be reached and used with the keyboard', async () => {
    const user = userEvent.setup();
    const tl = timelineFor(2, 'animal');
    render(<Mitosis3DBottom />);
    const rows = screen.getAllByRole('rowheader');
    expect(rows).toHaveLength(STAGES_3D.length);
    // Each row header holds a button named like the row; Tab goes through them in order.
    const buttons = rows.map((th) => within(th).getByRole('button'));
    for (const [k, b] of buttons.entries()) {
      expect(b).toHaveAccessibleName(rows[k]!.textContent.trim());
      await user.tab();
      expect(b).toHaveFocus();
    }
    expect(buttons[0]).toHaveAttribute('aria-current', 'step');
    buttons[4]!.focus();
    await user.keyboard('{Enter}');
    expect(useMitosis3D.getState()).toMatchObject({ t: tl.keyTime('anaphase'), playing: false });
    expect(buttons[4]).toHaveAttribute('aria-current', 'step');
    buttons[2]!.focus();
    await user.keyboard(' ');
    expect(useMitosis3D.getState().t).toBe(tl.keyTime('prophase'));
  });
});
