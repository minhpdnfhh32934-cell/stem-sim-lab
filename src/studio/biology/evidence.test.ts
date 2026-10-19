import { describe, expect, it, vi } from 'vitest';
import { translate } from '@/app/i18n';
import { timelineFor } from '@/biology/division/mitosis3d/store';
import { stageEvidence } from './evidence';

// The 3D model's descriptions marked as reviewed: the record and its visible fact must agree.
vi.mock('@/biology/division/mitosis3d/components', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/biology/division/mitosis3d/components')>();
  return {
    ...real,
    card3d: (cellType: Parameters<typeof real.card3d>[0]) => ({
      ...real.card3d(cellType),
      reviewStatus: 'verified' as const,
    }),
  };
});

describe('biology stage record', () => {
  it('takes the visible review fact from the data, as the record does', () => {
    const rec = stageEvidence(timelineFor(2, 'animal'), 'metaphase', 'animal', 1);
    expect(rec.review_status).toBe('verified');
    const review = rec.facts?.find((f) => f.id === 'review');
    expect(review?.text).toEqual({
      vi: translate('vi', 'studio.bio.verified'),
      en: translate('en', 'studio.bio.verified'),
    });
  });
});
