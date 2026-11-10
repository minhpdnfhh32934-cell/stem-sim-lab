import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { scenariosFor } from '../scenarios';
import { createSession, type StudioSession } from '../session';
import { ReportOrigins } from './ReportOrigins';

describe('"Báo cáo" with origin chips (docs/BENCH_DESIGN.md §9.7, §11)', () => {
  const scenario = scenariosFor('physics')[0];
  if (!scenario) throw new Error('no physics scenario');

  it('each item says where it comes from: SimLab tính, Bạn ghi, AI hỗ trợ', () => {
    const base = createSession(scenario, 0);
    const session: StudioSession = {
      ...base,
      prediction: { choice: 'a', label: 'Gấp đôi', at: 1 },
      evidence: [
        {
          id: 'e1',
          at: 2,
          step: 'interact',
          kind: 'engine',
          key: 'run',
          model: 'phys.projectile',
          title: { vi: 'Hai lần thả', en: 'Two drops' },
          conditions: [],
          quantities: [
            {
              id: 'tFall',
              label: { vi: 'Thời gian rơi', en: 'Fall time' },
              unit: 's',
              condition: 'A',
              value: 1.43,
              check: null,
            },
          ],
        },
        {
          id: 'l1',
          at: 3,
          step: 'explain',
          kind: 'learner',
          role: 'explanation',
          text: 'Vì h lớn hơn.',
        },
        { id: 'a1', at: 4, step: 'explain', kind: 'ai', provider: 'gemini', text: 'Gợi ý của AI' },
      ],
    };
    render(<ReportOrigins scenario={scenario} session={session} />);
    expect(screen.getByText('Gấp đôi')).toBeInTheDocument();
    expect(screen.getAllByText('Bạn ghi')).toHaveLength(2);
    expect(screen.getByText('SimLab tính')).toBeInTheDocument();
    expect(screen.getByText(/Thời gian rơi \(A\) = 1,43 s/)).toBeInTheDocument();
    // AI text is not repeated here (it carries its label where it was written): a count only.
    expect(screen.queryByText('Gợi ý của AI')).toBeNull();
    expect(screen.getByText(/Có 1 ghi chú do AI hỗ trợ/)).toBeInTheDocument();
    expect(screen.getByText('AI hỗ trợ')).toBeInTheDocument();
    // Nothing concluded yet.
    expect(screen.getAllByText('Chưa có')).toHaveLength(1);
  });
});
