import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ScienceCard } from './ScienceCard';
import { loadKatex } from './katex';
import { DRIFT_WARN, withDrift, withIntervention, type ScienceCardData } from './types';

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

  it('Basic mode folds the details but keeps model, confidence and intervention in view', async () => {
    const user = userEvent.setup();
    const { container } = render(<ScienceCard card={withIntervention(card, true)} collapsible />);
    expect(screen.getByText('Chất điểm, bỏ qua lực cản không khí')).toBeVisible();
    expect(screen.getByText('Định lượng gần đúng')).toBeVisible();
    expect(screen.getByText('Đã có can thiệp — kết quả là mô phỏng số.')).toBeVisible();
    const more = container.querySelector('details');
    expect(more).not.toHaveAttribute('open');
    // Folded, not removed: assumptions and sources are one click away.
    expect(screen.getByText('SGK Vật lý 10')).toBeInTheDocument();
    await user.click(screen.getByText('Phương trình, giả định và nguồn'));
    expect(more).toHaveAttribute('open');
  });

  it('never upgrades a qualitative card', () => {
    expect(withIntervention({ ...card, confidence: 'qualitative' }, true).confidence).toBe(
      'qualitative',
    );
  });
});

describe('energy drift on the card (#205 C2)', () => {
  it('leaves the card unchanged up to DRIFT_WARN', () => {
    expect(withDrift(card, 0)).toBe(card);
    expect(withDrift(card, DRIFT_WARN)).toBe(card);
  });

  it('above it: exact becomes approx, the error is at least the drift, the card says so', () => {
    const drifted = withDrift({ ...card, estimatedError: 1e-12 }, 3e-9);
    expect(drifted.confidence).toBe('approx');
    expect(drifted.estimatedError).toBe(3e-9);
    expect(drifted.energyDrift).toBe(3e-9);
    expect(withDrift({ ...card, estimatedError: 0.01 }, 3e-9).estimatedError).toBe(0.01);
    expect(withDrift({ ...card, confidence: 'qualitative' }, 3e-9).confidence).toBe('qualitative');
    render(<ScienceCard card={drifted} />);
    expect(screen.getByRole('note')).toHaveTextContent('Năng lượng đã lệch 3·10⁻⁹ so với lúc đầu');
    expect(screen.getByText('Định lượng gần đúng')).toBeInTheDocument();
  });
});
