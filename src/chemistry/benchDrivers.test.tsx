import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BenchContext } from '@/app/bench/shellMode';
import { PeriodicDriver } from './periodic/PeriodicDriver';
import { selectElement, usePeriodicStore } from './periodic/store';
import { ReactionDriver } from './reaction/ReactionDriver';
import { ReactionStage } from './reaction/ReactionStage';
import { selectReaction, useReactionStore } from './reaction/store';
import { TitrationDriver } from './titration/TitrationDriver';
import { setTitration, useTitrationStore } from './titration/store';
import { bohrModel, electronConfiguration, orbitals } from './atom/modules';
import { OrbitalDriver } from './atom/OrbitalDriver';
import { stepN, useOrbitalStore } from './atom/orbitalStore';
import { Molecule3dDriver } from './molecule/MoleculeDriver';
import { useMoleculeStore } from './molecule/store';
import { equationBalancing } from './reaction/modules';
import { ReactionPanel } from './reaction/ReactionPanel';

// The mechanism viewer draws with WebGL, which jsdom lacks; the player is what is tested here.
vi.mock('./reaction/MechanismViewer', () => ({ MechanismViewer: () => null }));

afterEach(() => {
  act(() => {
    selectReaction('neutralization');
    setTitration({ vb: 0 });
    selectElement(6);
    useReactionStore.setState({ speed: 1, equation: 'Fe + O2 -> Fe2O3' });
    useOrbitalStore.setState({ n: 2, orbital: 'pz' });
    useMoleculeStore.setState({ spin: false });
  });
});

const bench = (node: React.ReactNode) => (
  <BenchContext.Provider value={true}>{node}</BenchContext.Provider>
);

describe('chemistry on the bench edge (docs/BENCH_DESIGN.md §9.5, §9.10)', () => {
  it('the mechanism player: next / previous step, reset, "Bước i/n"', () => {
    act(() => {
      selectReaction('neutralization');
    });
    render(<ReactionDriver />);
    const group = screen.getByRole('group', { name: 'Điều khiển các bước' });
    expect(group).toHaveTextContent('Bước 1/');
    fireEvent.click(screen.getByRole('button', { name: 'Bước sau' }));
    expect(useReactionStore.getState().t).toBe(1);
    expect(group).toHaveTextContent('Bước 2/');
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại' }));
    expect(useReactionStore.getState().t).toBe(0);
  });

  it('a reaction without a mechanism has nothing to play', () => {
    act(() => {
      selectReaction('h2-o2');
    });
    render(<ReactionDriver />);
    expect(screen.getByRole('button', { name: 'Chạy' })).toBeDisabled();
    expect(screen.getByRole('slider', { name: 'Tiến trình phản ứng' })).toBeDisabled();
  });

  it('the stage leaves its player to the bench edge', () => {
    act(() => {
      selectReaction('neutralization');
    });
    const { unmount } = render(<ReactionStage />);
    expect(screen.getByRole('group', { name: 'Điều khiển cơ chế' })).toBeInTheDocument();
    unmount();
    render(
      <BenchContext.Provider value={true}>
        <ReactionStage />
      </BenchContext.Provider>,
    );
    expect(screen.queryByRole('group', { name: 'Điều khiển cơ chế' })).toBeNull();
  });

  it('titration: D0 adds NaOH (the one filled control), D1 removes it, D3 empties the burette', () => {
    render(<TitrationDriver />);
    const add = screen.getByRole('button', { name: /^Nhỏ thêm .* mL NaOH$/ });
    expect(add).toHaveClass('bench-play');
    fireEvent.click(add);
    fireEvent.click(add);
    const two = useTitrationStore.getState().vb;
    expect(two).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /^Rút bớt .* mL NaOH$/ }));
    expect(useTitrationStore.getState().vb).toBeCloseTo(two / 2, 9);
    // The drop size is the learner's: 0,1 mL first, 1 mL on the speed slot's second step.
    expect(two).toBeCloseTo(0.2, 9);
    fireEvent.click(screen.getByRole('radio', { name: '1 mL' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nhỏ thêm 1 mL NaOH' }));
    expect(useTitrationStore.getState().vb).toBeCloseTo(1.1, 9);
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại' }));
    expect(useTitrationStore.getState().vb).toBe(0);
  });

  it('periodic table: the element stepper reads the data ("26 · Fe · Sắt")', () => {
    act(() => {
      selectElement(26);
    });
    render(<PeriodicDriver />);
    expect(screen.getByText('26 · Fe · Sắt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nguyên tố sau' }));
    expect(usePeriodicStore.getState().selected).toBe(27);
    expect(document.querySelector('.bench-play')).toBeNull();
  });

  it('electron configuration and Bohr step through the elements like the periodic table', () => {
    expect(electronConfiguration.Driver).toBe(PeriodicDriver);
    expect(bohrModel.Driver).toBe(PeriodicDriver);
    expect(orbitals.Driver).toBe(OrbitalDriver);
  });

  it('orbitals: "‹ n = 2 ›" keeps l < n (a p orbital becomes s at n = 1)', () => {
    expect(stepN(2, 'pz', -1)).toEqual({ n: 1, orbital: 's' });
    expect(stepN(2, 'pz', 1)).toEqual({ n: 3, orbital: 'pz' });
    expect(stepN(6, 'dz2', 1)).toEqual({ n: 6, orbital: 'dz2' });
    render(<OrbitalDriver />);
    expect(screen.getByText('n = 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Giảm n' }));
    expect(useOrbitalStore.getState()).toMatchObject({ n: 1, orbital: 's' });
    expect(screen.getByRole('button', { name: 'Giảm n' })).toBeDisabled();
  });

  it('molecules: "Tự xoay" is off until pressed', () => {
    render(<Molecule3dDriver />);
    const spin = screen.getByRole('button', { name: 'Tự xoay' });
    fireEvent.click(spin);
    expect(useMoleculeStore.getState().spin).toBe(true);
  });

  it('the mechanism plays at 0,5× · 1× · 2× (1× until changed)', () => {
    act(() => {
      selectReaction('sn2-ch3br');
    });
    render(<ReactionDriver />);
    expect(screen.getByRole('radio', { name: '1×' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: '2×' }));
    expect(useReactionStore.getState().speed).toBe(2);
  });

  it('the reaction tray: equations and "Có cơ chế" per row; another reaction goes to the balancer', () => {
    render(bench(<ReactionPanel />));
    const rows = within(screen.getByRole('listbox', { name: 'Phản ứng' })).getAllByRole('option');
    expect(rows.length).toBeGreaterThan(30);
    expect(rows.some((r) => r.textContent.includes('Có cơ chế'))).toBe(true);
    expect(rows.filter((r) => !/→|⇌/.test(r.textContent)).map((r) => r.textContent)).toEqual([]);
    const field = screen.getByRole('textbox', { name: 'Viết phản ứng khác' });
    fireEvent.change(field, { target: { value: 'Fe + Cl2 -> FeCl3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra' }));
    expect(useReactionStore.getState().equation).toBe('Fe + Cl2 -> FeCl3');
  });

  it('the balancer asks the bench for a folded tray (it has none to work in)', () => {
    expect(equationBalancing.trayStartsFolded).toBe(true);
  });
});
