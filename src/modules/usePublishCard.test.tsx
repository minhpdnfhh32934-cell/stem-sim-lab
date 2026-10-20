import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openLab, openStudio } from '@/app/topics';
import { useWorkspaceStore } from '@/app/workspaceStore';
import type { ScienceCardData } from '@/science-card/types';
import { usePublishCard } from './usePublishCard';

const card: ScienceCardData = {
  title: { vi: 'Thẻ thử', en: 'Test card' },
  model: { vi: 'Mô hình thử', en: 'Test model' },
  equations: [],
  assumptions: [],
  confidence: 'qualitative',
  userIntervened: false,
  sources: [],
};

function Publisher({ c }: { c: ScienceCardData }) {
  usePublishCard(c);
  return null;
}

describe('usePublishCard', () => {
  it('takes its card away when the view unmounts (Studio → Phòng thí nghiệm)', () => {
    openStudio();
    const view = render(<Publisher c={card} />);
    expect(useWorkspaceStore.getState().scienceCard).toBe(card);
    view.unmount();
    openLab();
    expect(useWorkspaceStore.getState().scienceCard).toBeNull();
  });

  it('leaves a newer card alone', () => {
    const other: ScienceCardData = { ...card };
    const view = render(<Publisher c={card} />);
    useWorkspaceStore.setState({ scienceCard: other });
    view.unmount();
    expect(useWorkspaceStore.getState().scienceCard).toBe(other);
  });

  it('openLab with nothing open clears a card left by another screen', () => {
    openStudio();
    useWorkspaceStore.setState({ scienceCard: card });
    openLab();
    expect(useWorkspaceStore.getState().scienceCard).toBeNull();
  });
});
