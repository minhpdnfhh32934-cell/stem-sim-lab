import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { BiomoleculePanel, BiomoleculeStage } from './biomolecules/BiomoleculeViews';
import { useBiomolecules } from './biomolecules/store';
import { ElementsPanel, ElementsStage } from './elements/ElementsViews';
import { useElements } from './elements/store';
import { GrowthPanel, GrowthStage } from './microbes/GrowthViews';
import { useGrowth } from './microbes/store';
import { biomolecules, cellElements, microbeGrowth, virusStructure } from './sh10Modules';
import { VirusBottom, VirusPanel, VirusStage } from './virus/VirusViews';
import { useVirus } from './virus/store';

// The growth chart's plot library is not under test here (it needs matchMedia and a canvas).
vi.mock('@/ui/charts/uplot', () => ({
  SERIES_VARS: ['--chart-1'],
  loadUPlot: () => new Promise(() => undefined),
}));

const card = () => useWorkspaceStore.getState().scienceCard;

afterEach(() => {
  act(() => {
    useElements.setState({ view: 'elements', selected: 'C', mass: 100, dT: 1 });
    useGrowth.setState({ view: 'formula', n0: 100, g: 20, t: 180, scale: 'linear', phase: 'log' });
    useBiomolecules.setState({ group: 'protein', molecule: 'alanine', part: null, labels: null });
    useVirus.setState({ enveloped: true, selected: null, stage: 0, labels: null });
    useSettingsStore.setState({ locale: 'vi', uiMode: 'basic' });
  });
});

describe('Các nguyên tố hóa học và nước (SH10 Bài 4)', () => {
  it('eight bars of figure 4.1, the book’s sums, and a card per bar', () => {
    const { container } = render(
      <>
        <ElementsStage />
        <ElementsPanel />
      </>,
    );
    expect(container.querySelectorAll('.el-bar')).toHaveLength(8);
    expect(container).toHaveTextContent('C + H + O + N = 96%');
    expect(container).toHaveTextContent('Nguyên tố vi lượng: 0,6%');
    expect(container).toHaveTextContent('Oxygen (O)65%');
    expect(card()?.confidence).toBe('approx');
    // Carbon is open at first, with why it matters.
    expect(container).toHaveTextContent('4 electron hoá trị');
    fireEvent.click(screen.getByRole('button', { name: /Các nguyên tố vi lượng/ }));
    expect(container).toHaveTextContent('bướu cổ');
  });

  it('water: 100 g warmed by 1 °C needs 418,4 J; evaporating it ≈ 584 times more', () => {
    act(() => {
      useElements.setState({ view: 'water' });
    });
    render(
      <>
        <ElementsStage />
        <ElementsPanel />
      </>,
    );
    expect(screen.getByTestId('water-q1')).toHaveTextContent('Q₁ = m·c·ΔT = 418,4 J');
    expect(screen.getByTestId('water-q2')).toHaveTextContent('244.300 J');
    expect(screen.getByTestId('water-q2')).toHaveTextContent('gấp 584 lần Q₁');
    expect(screen.getByTestId('water-equivalent')).toHaveTextContent('584 g');
    expect(card()?.title.vi).toMatch(/^Nước/);
    fireEvent.change(screen.getByRole('slider', { name: 'Tăng nhiệt độ ΔT' }), {
      target: { value: '10' },
    });
    expect(screen.getByTestId('water-q1')).toHaveTextContent('4.184 J');
  });
});

describe('Sinh trưởng của quần thể vi khuẩn (SH10 Bài 21)', () => {
  it('formula view: n and Nₜ from the sliders, exact card; examples set g', () => {
    const { container } = render(
      <>
        <GrowthStage />
        <GrowthPanel />
      </>,
    );
    expect(screen.getByTestId('mg-n')).toHaveTextContent('n = t/g = 180/20 = 9');
    expect(screen.getByTestId('mg-nt')).toHaveTextContent('Nₜ = 100 × 29 = 51.200 tế bào');
    expect(card()?.confidence).toBe('exact');
    fireEvent.click(screen.getByRole('button', { name: /Vi khuẩn lao/ }));
    expect(useGrowth.getState().g).toBe(720);
    expect(screen.getByTestId('mg-n')).toHaveTextContent('= 0,25');
    expect(container).toHaveTextContent('Công thức');
  });

  it('four phases: an illustration with a qualitative card and the book’s texts', () => {
    render(<GrowthStage />);
    fireEvent.click(screen.getByRole('radio', { name: 'Bốn pha (minh họa)' }));
    expect(card()?.confidence).toBe('qualitative');
    expect(
      screen.getByRole('img', { name: /Hình minh họa đường cong sinh trưởng/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pha suy vong' }));
    expect(screen.getByText(/ngày càng giảm/)).toBeInTheDocument();
  });
});

describe('Các phân tử sinh học (SH10 Bài 5)', () => {
  it('2D picture without WebGL; the group, monomer, formula, CID and parts', () => {
    const { container } = render(
      <>
        <BiomoleculeStage />
        <BiomoleculePanel />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Alanine (L-alanine)' })).toBeInTheDocument();
    expect(screen.getByTestId('biomol-formula')).toHaveTextContent(
      'CH3CH(NH2)COOH · M = 89,09 g/mol · PubChem CID 5950',
    );
    expect(container).toHaveTextContent('Đơn phân: Amino acid');
    fireEvent.click(screen.getByRole('button', { name: 'Nhóm amino (–NH₂)' }));
    expect(useBiomolecules.getState().part).toBe('amino');
    fireEvent.click(screen.getByRole('radio', { name: 'Lipid' }));
    expect(useBiomolecules.getState()).toMatchObject({ molecule: 'palmitic', part: null });
    expect(container).toHaveTextContent('Không cấu tạo theo nguyên tắc đa phân');
    fireEvent.click(screen.getByRole('radio', { name: 'Glycerol' }));
    expect(card()?.model.vi).toContain('CID 753');
  });
});

describe('Khái quát về virus (SH10 Bài 24)', () => {
  it('parts list follows the envelope switch; a part opens its card', () => {
    render(
      <>
        <VirusStage />
        <VirusPanel />
      </>,
    );
    expect(card()?.confidence).toBe('qualitative');
    expect(
      screen.getByRole('img', { name: 'Hình minh họa virus có vỏ ngoài' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gai glycoprotein' }));
    expect(screen.getByText(/bám vào tế bào chủ/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Không có vỏ ngoài' }));
    expect(screen.queryByRole('button', { name: 'Gai glycoprotein' })).toBeNull();
    expect(useVirus.getState().selected).toBeNull();
    expect(
      screen.getByRole('img', { name: 'Hình minh họa virus không có vỏ ngoài' }),
    ).toBeInTheDocument();
  });

  it('five stages, one at a time, with previous / next', () => {
    render(<VirusBottom />);
    expect(screen.getByText(/Giai đoạn 1: Hấp phụ\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Giai đoạn trước' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Giai đoạn sau' }));
    expect(screen.getByText(/Giai đoạn 2: Xâm nhập\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '5. Giải phóng' }));
    expect(screen.getByText(/thoát ra khỏi tế bào chủ/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Giai đoạn sau' })).toBeDisabled();
  });
});

describe('saved files (.stemsim)', () => {
  it('each lesson saves its inputs and restores only valid ones', () => {
    expect(cellElements.state?.get()).toEqual({ view: 'elements', mass: 100, dT: 1 });
    expect(microbeGrowth.state?.get()).toEqual({
      view: 'formula',
      n0: 100,
      g: 20,
      t: 180,
      scale: 'linear',
      phase: 'log',
    });
    biomolecules.state?.set({ group: 'nucleicAcid', molecule: 'damp' });
    expect(useBiomolecules.getState()).toMatchObject({ group: 'nucleicAcid', molecule: 'damp' });
    virusStructure.state?.set({ enveloped: false, stage: 7 });
    expect(useVirus.getState()).toMatchObject({ enveloped: false, stage: 4 });
    microbeGrowth.state?.set({ g: 1e9, t: 60 });
    expect(useGrowth.getState()).toMatchObject({ g: 20, t: 60 });
  });
});
