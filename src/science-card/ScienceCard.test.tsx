import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScienceCard } from './ScienceCard';
import { loadKatex } from './katex';
import { withIntervention, type ScienceCardData } from './types';

const card: ScienceCardData = {
  title: { vi: 'Ném xiên', en: 'Oblique projectile' },
  model: { vi: 'Chất điểm, bỏ qua lực cản không khí', en: 'Point mass, no air resistance' },
  equations: [{ tex: 'y = y_0 + v_0 \\sin\\alpha\\, t - \\tfrac{1}{2} g t^2' }],
  assumptions: [{ vi: 'g không đổi', en: 'Constant g' }],
  confidence: 'exact',
  userIntervened: false,
  sources: [{ id: 'sgk', citation: 'SGK Vật lý 10' }],
};

describe('ScienceCard', () => {
  it('renders model, assumptions, sources and the confidence badge', () => {
    render(<ScienceCard card={card} />);
    expect(screen.getByText('Chất điểm, bỏ qua lực cản không khí')).toBeInTheDocument();
    expect(screen.getByText('g không đổi')).toBeInTheDocument();
    expect(screen.getByText('SGK Vật lý 10')).toBeInTheDocument();
    expect(screen.getByText('Định lượng chính xác')).toBeInTheDocument();
  });

  it('renders equations with KaTeX once loaded', async () => {
    const { container } = render(<ScienceCard card={card} />);
    await loadKatex();
    await screen.findByText((_c, el) => el?.classList.contains('katex') ?? false);
    expect(container.querySelector('.equation--display')).not.toBeNull();
  });

  it('intervention downgrades exact → approx and shows the notice (§2.5)', () => {
    const changed = withIntervention(card, true);
    expect(changed.confidence).toBe('approx');
    render(<ScienceCard card={changed} />);
    expect(screen.getByText('Đã có can thiệp — kết quả là mô phỏng số.')).toBeInTheDocument();
    expect(screen.getByText('Định lượng gần đúng')).toBeInTheDocument();
  });

  it('never upgrades a qualitative card', () => {
    expect(withIntervention({ ...card, confidence: 'qualitative' }, true).confidence).toBe(
      'qualitative',
    );
  });
});
