import { useMemo } from 'react';
import type { ScienceCardData } from '@/science-card/types';
import { CSRC, L, usePublishCard } from '../common';
import { ELEMENTS_SOURCE } from '../data/elements';
import { PeriodicStage } from './PeriodicStage';

/** Stage of the periodic-table module: publishes its Science Card. */
export function PeriodicModuleStage() {
  const card = useMemo<ScienceCardData>(
    () => ({
      title: L('Bảng tuần hoàn', 'Periodic table'),
      model: L(
        'Bảng tra cứu dữ liệu nguyên tố. Không có tính toán: mọi giá trị đọc từ bảng dữ liệu có nguồn.',
        'Element data lookup. No computation: every value is read from a sourced data table.',
      ),
      equations: [],
      assumptions: [
        L(
          'La và Ac đặt ở nhóm 3; Ce–Lu và Th–Lr ở hai hàng riêng (cách trình bày thường gặp trong SGK).',
          'La and Ac in group 3; Ce–Lu and Th–Lr in separate rows (common textbook layout).',
        ),
        L(
          'Nguyên tố không có nguyên tử khối chuẩn IUPAC hiển thị số khối trong ngoặc vuông.',
          'Elements without an IUPAC standard atomic weight show a mass number in brackets.',
        ),
      ],
      confidence: 'exact',
      confidenceNote: L('Số liệu tra cứu, không tính toán.', 'Looked-up data, not computed.'),
      userIntervened: false,
      sources: [ELEMENTS_SOURCE, CSRC.iupacTable, CSRC.sgk10],
      reviewStatus: 'pending',
    }),
    [],
  );
  usePublishCard(card);
  return <PeriodicStage />;
}
