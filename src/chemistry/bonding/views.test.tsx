import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CONFIDENCE_LEVELS } from '@/science-card/types';
import { COVALENT_CARD, FORCES_CARD, IONIC_CARD, OCTET_CARD } from './cards';
import { CovalentBottom, CovalentPanel } from './CovalentViews';
import { ForcesBottom, ForcesPanel } from './ForcesViews';
import { IonicPanel, IonicStage } from './IonicViews';
import { covalentBond, intermolecularForces, ionicBond, octetRule } from './modules';
import { OctetPanel, OctetStage } from './OctetViews';
import { applyBonding, useBondingStore } from './store';

const DEFAULTS = {
  octet: 'h2o',
  covalent: 'c2h4',
  metal: 'Na',
  nonmetal: 'Cl',
  unit: 'C' as const,
};

afterEach(() => {
  act(() => {
    useBondingStore.setState(DEFAULTS);
  });
});

describe('Science Cards of Bài 10–13', () => {
  const cards = [OCTET_CARD, IONIC_CARD, COVALENT_CARD, FORCES_CARD];

  it('each has a model, equations, assumptions, a confidence and sources incl. the KNTT lesson', () => {
    for (const c of cards) {
      expect(c.model.vi.length).toBeGreaterThan(40);
      expect(c.equations.length).toBeGreaterThan(0);
      expect(c.assumptions.length).toBeGreaterThan(0);
      expect(CONFIDENCE_LEVELS).toContain(c.confidence);
      expect(c.sources.some((s) => s.id.startsWith('kntt-hh10-'))).toBe(true);
      expect(c.reviewStatus).toBe('pending');
      expect(c.userIntervened).toBe(false);
    }
    expect(COVALENT_CARD.confidence).toBe('qualitative');
  });

  it('no Vietnamese word inside \\text{} (labels carry the words)', () => {
    for (const c of cards)
      for (const e of c.equations) {
        const tex = typeof e.tex === 'string' ? e.tex : e.tex.vi;
        expect(tex).not.toMatch(/\\text\{[^}]*[à-ỹđ]/i);
      }
  });

  it('the thresholds are the ones of Bảng 12.1, with the Vietnamese decimal comma', () => {
    const tex = COVALENT_CARD.equations.map((e) => (typeof e.tex === 'string' ? e.tex : e.tex.vi));
    expect(tex).toContain('0 \\le |\\Delta\\chi| < 0{,}4');
    expect(tex).toContain('0{,}4 \\le |\\Delta\\chi| < 1{,}7');
    expect(tex).toContain('|\\Delta\\chi| \\ge 1{,}7');
  });

  it('every topic saves its inputs; a broken file value is ignored', () => {
    for (const m of [octetRule, ionicBond, covalentBond, intermolecularForces]) {
      expect(m.state).toBeDefined();
    }
    expect(octetRule.state?.get()).toEqual({ octet: 'h2o' });
    act(() => {
      ionicBond.state?.set({ metal: 'Fe', nonmetal: 'O' });
    });
    expect(useBondingStore.getState()).toMatchObject({ metal: 'Na', nonmetal: 'O' });
    act(() => {
      applyBonding({ octet: 'benzene', unit: 'K' });
    });
    expect(useBondingStore.getState()).toMatchObject({ octet: 'h2o', unit: 'K' });
  });
});

describe('panels', () => {
  it('octet: counts per atom and the exception found for BF₃', () => {
    const { container } = render(
      <>
        <OctetStage />
        <OctetPanel />
      </>,
    );
    expect(container).toHaveTextContent('Mọi nguyên tử đạt octet (H: 2 electron)');
    expect(container).toHaveTextContent('Tổng số electron hoá trị: 8');
    expect(screen.getByRole('row', { name: /^H ×2/ })).toHaveTextContent('2 (đạt)');
    fireEvent.click(screen.getByRole('button', { name: 'BF₃' }));
    expect(container).toHaveTextContent('Ngoại lệ — B: 6 electron (ít hơn 8)');
    expect(screen.getByRole('img', { name: /Công thức Lewis BF₃/ })).toBeInTheDocument();
  });

  it('ionic: Al and O give Al₂O₃ with noble-gas ions', () => {
    const { container } = render(
      <>
        <IonicStage />
        <IonicPanel />
      </>,
    );
    fireEvent.change(screen.getByLabelText('Kim loại'), { target: { value: 'Al' } });
    fireEvent.change(screen.getByLabelText('Phi kim'), { target: { value: 'O' } });
    expect(container).toHaveTextContent('2 × (+3) + 3 × (−2) = 0 → Al₂O₃');
    expect(container).toHaveTextContent('Al³⁺: 1s² 2s² 2p⁶');
    expect(container).toHaveTextContent('Al³⁺ (giống khí hiếm Ne)');
    expect(container).toHaveTextContent('O²⁻ (giống khí hiếm Ne)');
    fireEvent.change(screen.getByLabelText('Phi kim'), { target: { value: 'I' } });
    expect(screen.getByRole('note')).toHaveTextContent('nghiêng về cộng hoá trị phân cực');
  });

  it('covalent: σ/π totals and the HF exception in the bond table', () => {
    const { container } = render(
      <>
        <CovalentPanel />
        <CovalentBottom />
      </>,
    );
    expect(screen.getByRole('row', { name: /Liên kết σ/ })).toHaveTextContent('5');
    expect(screen.getByRole('row', { name: /Liên kết π/ })).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: 'HF' }));
    expect(container).toHaveTextContent('ion (ngoại lệ)');
    expect(container).toHaveTextContent('1,78');
  });

  it('forces: values as the sources give them, °C or K, the gaps said', () => {
    const { container } = render(
      <>
        <ForcesPanel />
        <ForcesBottom />
      </>,
    );
    expect(screen.getByRole('row', { name: /^NH₃/ })).toHaveTextContent('-33,35');
    expect(screen.getByRole('row', { name: /^NH₃/ })).toHaveTextContent('Merck Index');
    expect(screen.getByRole('row', { name: /^H₂Te/ })).toHaveTextContent(
      'Chưa có số liệu có nguồn',
    );
    expect(container).toHaveTextContent('Average of 13 values');
    // The textbook's value is shown; NIST's is named as the second source.
    const h2s = screen.getByRole('row', { name: /^H₂S\s/ });
    expect(h2s).toHaveTextContent('−60,75 °C');
    expect(h2s).toHaveTextContent('SGK: SGK Hoá học 10');
    expect(h2s).toHaveTextContent('Bảng 13.1, tr. 65');
    expect(h2s).toHaveTextContent('Nguồn thứ hai: 212.87 K (-60,28 °C) — NIST WebBook');
    expect(screen.getByRole('row', { name: /^HF/ })).toHaveTextContent('Bảng 22.2, tr. 113');
    fireEvent.click(screen.getByRole('radio', { name: 'K' }));
    expect(screen.getByRole('row', { name: /^NH₃/ })).toHaveTextContent('239,8');
  });
});
