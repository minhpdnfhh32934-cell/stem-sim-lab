import type { Source } from '@/core/data/dataset';

const READER = 'https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-sinh-hoc-12.4701665546';

/** One SH12 KNTT lesson as a source: its number, title and pages (read 17/11/2026). */
export function sgkSh12(lesson: number, title: string, pages: string): Source {
  return {
    id: `sgk-sh12-kntt-bai${lesson}`,
    citation: `SGK Sinh học 12, bộ Kết nối tri thức với cuộc sống (NXB Giáo dục Việt Nam), Bài ${lesson} “${title}”, tr. ${pages} (đọc trên taphuan.nxbgd.vn ngày 17/11/2026)`,
    url: READER,
  };
}
