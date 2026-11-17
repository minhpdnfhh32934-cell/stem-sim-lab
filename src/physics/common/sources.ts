import type { Source } from '@/core/data/dataset';

/**
 * Bibliography for the physics scenes. These are standard references that contain the
 * formulas used; exact editions/pages are to be confirmed by the reviewing teacher
 * (docs/DATA_REVIEW.md).
 */
export const SRC = {
  // The book as a whole, for the Sources page; each card cites its own lessons and pages (sgk10).
  sgk10kntt: {
    id: 'sgk-vl10-kntt',
    citation:
      'Sách giáo khoa Vật lí 10, bộ Kết nối tri thức với cuộc sống, NXB Giáo dục Việt Nam (bài và trang ghi trên Thẻ Khoa học của từng bài)',
  },
  sgk11: {
    id: 'sgk-vl11',
    citation: 'Sách giáo khoa Vật lí 11 (Chương trình GDPT 2018), NXB Giáo dục Việt Nam — Dao động',
  },
  halliday: {
    id: 'halliday',
    citation: 'D. Halliday, R. Resnick, J. Walker — Fundamentals of Physics, Wiley',
  },
  landau: {
    id: 'landau-mechanics',
    citation:
      'L. D. Landau, E. M. Lifshitz — Mechanics (Course of Theoretical Physics, Vol. 1), §11: chu kì con lắc qua tích phân elliptic',
  },
  hairer: {
    id: 'hairer-wanner',
    citation:
      'E. Hairer, S. P. Nørsett, G. Wanner — Solving Ordinary Differential Equations I, Springer (Dormand–Prince 5(4))',
  },
  verlet: {
    id: 'swope-1982',
    citation:
      'W. C. Swope, H. C. Andersen, P. H. Berens, K. R. Wilson — J. Chem. Phys. 76, 637 (1982) (Velocity Verlet)',
  },
  codata: {
    id: 'codata',
    citation: 'CODATA 2022 (NIST) — hằng số vật lý',
  },
  hallidayCircular: {
    id: 'halliday-circular',
    citation:
      'D. Halliday, R. Resnick, J. Walker — Fundamentals of Physics, Wiley — ch. 4 (chuyển động tròn đều), ch. 6 (lực hướng tâm)',
  },
  sgk11knttWaves: {
    id: 'sgk-vl11-kntt-song',
    citation:
      'Sách giáo khoa Vật lí 11, bộ Kết nối tri thức với cuộc sống (Chương trình GDPT 2018), NXB Giáo dục Việt Nam — Sóng',
  },
  hallidayWaves: {
    id: 'halliday-waves',
    citation:
      'D. Halliday, R. Resnick, J. Walker — Fundamentals of Physics, Wiley — ch. 16 (sóng trên dây, sóng dừng)',
  },
  hallidayInterference: {
    id: 'halliday-interference',
    citation:
      'D. Halliday, R. Resnick, J. Walker — Fundamentals of Physics, Wiley — ch. 17 (giao thoa theo hiệu đường đi, phách)',
  },
  sgk11kntt: {
    id: 'sgk-vl11-kntt',
    citation:
      'Sách giáo khoa Vật lí 11, bộ Kết nối tri thức với cuộc sống (Chương trình GDPT 2018), NXB Giáo dục Việt Nam',
  },
  hallidayElectric: {
    id: 'halliday-electric',
    citation:
      'D. Halliday, R. Resnick, J. Walker — Fundamentals of Physics, Wiley — ch. 21 (định luật Coulomb), ch. 22 (điện trường), ch. 24 (điện thế), ch. 25 (tụ điện)',
  },
  hallidayEm: {
    id: 'halliday-em',
    citation:
      'D. Halliday, R. Resnick, J. Walker — Fundamentals of Physics, Wiley — ch. 33 (sóng điện từ, thang sóng điện từ)',
  },
  hallidayCircuits: {
    id: 'halliday-circuits',
    citation:
      'D. Halliday, R. Resnick, J. Walker — Fundamentals of Physics, Wiley — ch. 26 (dòng điện, điện trở), ch. 27 (mạch điện, suất điện động, điện trở trong)',
  },
  hallidayDrag: {
    id: 'halliday-drag',
    citation:
      'D. Halliday, R. Resnick, J. Walker — Fundamentals of Physics, Wiley — ch. 6 (lực cản, tốc độ giới hạn), ch. 14 (lực đẩy Archimedes)',
  },
  lamb: {
    id: 'lamb-hydrodynamics',
    citation:
      'H. Lamb — Hydrodynamics, 6th ed. (1932), ch. VI: quả cầu chuyển động trong chất lỏng lí tưởng có khối lượng kèm theo bằng nửa khối lượng chất lỏng bị chiếm chỗ',
  },
  isa: {
    id: 'iso-2533',
    citation:
      'ISO 2533:1975 Standard Atmosphere — không khí ở mực nước biển, 15 °C: ρ = 1,225 kg/m³, μ = 1,7894·10⁻⁵ Pa·s',
  },
  iapwsWater: {
    id: 'iapws-water',
    citation:
      'IAPWS 2008 (độ nhớt) và IAPWS-95 (khối lượng riêng, nguồn thứ hai sau SGK) — nước ở 20 °C, 101 325 Pa: μ = 1,0016 mPa·s, ρ = 998,21 kg/m³ (SGK Vật lí 10 Bảng 34.2 ghi 999 kg/m³, giá trị app dùng)',
  },
  hoerner: {
    id: 'hoerner-drag',
    citation:
      'S. F. Hoerner — Fluid-Dynamic Drag (1965): hệ số cản của quả cầu nhẵn gần như không đổi (≈ 0,47) khi 10³ < Re < 2·10⁵',
  },
} satisfies Record<string, Source>;

/**
 * Vật lí 10 (Kết nối tri thức với cuộc sống) theory lessons with a SimLab topic: [title, first
 * page, last page], read in the publisher's e-book (taphuan.nxbgd.vn, 15/11/2026). The book comes
 * first (user rule 15/11/2026): every VL10 Science Card cites its lessons' pages through `sgk10`.
 * `sources.test.ts` checks titles and pages against data/curriculum_kntt.json (the table of contents).
 */
export const VL10_LESSONS: Readonly<Record<number, readonly [string, number, number]>> = {
  4: ['Độ dịch chuyển và quãng đường đi được', 21, 25],
  5: ['Tốc độ và vận tốc', 26, 29],
  7: ['Đồ thị độ dịch chuyển – thời gian', 34, 36],
  8: ['Chuyển động biến đổi. Gia tốc', 37, 39],
  9: ['Chuyển động thẳng biến đổi đều', 40, 43],
  10: ['Sự rơi tự do', 44, 46],
  12: ['Chuyển động ném', 49, 55],
  13: ['Tổng hợp và phân tích lực. Cân bằng lực', 56, 59],
  14: ['Định luật 1 Newton', 60, 62],
  15: ['Định luật 2 Newton', 63, 66],
  16: ['Định luật 3 Newton', 67, 68],
  17: ['Trọng lực và lực căng', 69, 71],
  18: ['Lực ma sát', 72, 76],
  19: ['Lực cản và lực nâng', 77, 79],
  21: ['Moment lực. Cân bằng của vật rắn', 83, 85],
  23: ['Năng lượng. Công cơ học', 91, 95],
  24: ['Công suất', 96, 98],
  25: ['Động năng, thế năng', 99, 101],
  26: ['Cơ năng và định luật bảo toàn cơ năng', 102, 105],
  27: ['Hiệu suất', 106, 109],
  28: ['Động lượng', 110, 112],
  29: ['Định luật bảo toàn động lượng', 113, 115],
  31: ['Động học của chuyển động tròn đều', 120, 122],
  32: ['Lực hướng tâm và gia tốc hướng tâm', 123, 127],
  33: ['Biến dạng của vật rắn', 128, 130],
  34: ['Khối lượng riêng. Áp suất chất lỏng', 131, 135],
};

/** The source of Vật lí 10 KNTT lesson `n`, with its pages. */
export function sgk10(n: number): Source {
  const lesson = VL10_LESSONS[n];
  if (!lesson) throw new Error(`Vật lí 10 lesson ${String(n)} is not in VL10_LESSONS`);
  const [title, from, to] = lesson;
  return {
    id: `sgk-vl10-kntt-b${String(n)}`,
    citation: `Sách giáo khoa Vật lí 10, bộ Kết nối tri thức với cuộc sống, NXB Giáo dục Việt Nam — Bài ${String(n)} “${title}”, tr. ${String(from)}–${String(to)}`,
  };
}

/**
 * Vật lí 11 (Kết nối tri thức với cuộc sống) theory lessons: [title, first page, last page], from
 * the table of contents (data/curriculum_kntt.json; the last page is the page before the next
 * lesson), read in the publisher's e-book (taphuan.nxbgd.vn, 16/11/2026). `sgkVl11` cites them.
 */
export const VL11_LESSONS: Readonly<Record<number, readonly [string, number, number]>> = {
  1: ['Dao động điều hoà', 6, 9],
  2: ['Mô tả dao động điều hoà', 10, 13],
  3: ['Vận tốc, gia tốc trong dao động điều hoà', 14, 16],
  5: ['Động năng. Thế năng. Sự chuyển hoá năng lượng trong dao động điều hoà', 20, 23],
  6: ['Dao động tắt dần. Dao động cưỡng bức. Hiện tượng cộng hưởng', 24, 27],
  8: ['Mô tả sóng', 32, 36],
  9: ['Sóng ngang. Sóng dọc. Sự truyền năng lượng của sóng cơ', 37, 40],
  11: ['Sóng điện từ', 44, 47],
  12: ['Giao thoa sóng', 48, 51],
  13: ['Sóng dừng', 52, 54],
  16: ['Lực tương tác giữa các điện tích', 61, 64],
  17: ['Khái niệm điện trường', 65, 70],
  18: ['Điện trường đều', 71, 75],
  19: ['Thế năng điện', 76, 78],
  20: ['Điện thế', 79, 82],
  21: ['Tụ điện', 83, 90],
  22: ['Cường độ dòng điện', 91, 94],
  23: ['Điện trở. Định luật Ohm', 95, 101],
  24: ['Nguồn điện', 102, 105],
  25: ['Năng lượng và công suất điện', 106, 110],
};

/** The source of Vật lí 11 KNTT lesson `n`, with its pages. */
export function sgkVl11(n: number): Source {
  const lesson = VL11_LESSONS[n];
  if (!lesson) throw new Error(`Vật lí 11 lesson ${String(n)} is not in VL11_LESSONS`);
  const [title, from, to] = lesson;
  return {
    id: `sgk-vl11-kntt-b${String(n)}`,
    citation: `Sách giáo khoa Vật lí 11, bộ Kết nối tri thức với cuộc sống, NXB Giáo dục Việt Nam — Bài ${String(n)} “${title}”, tr. ${String(from)}–${String(to)}`,
  };
}

/**
 * Vật lí 12 (Kết nối tri thức với cuộc sống) theory lessons: [title, first page, last page], from
 * the table of contents (data/curriculum_kntt.json; the last page is the page before the next
 * lesson), read in the publisher's e-book (taphuan.nxbgd.vn, 17/11/2026). `sgkVl12` cites them.
 */
export const VL12_LESSONS: Readonly<Record<number, readonly [string, number, number]>> = {
  1: ['Cấu trúc của chất. Sự chuyển thể', 6, 9],
  2: ['Nội năng. Định luật I của nhiệt động lực học', 10, 14],
  3: ['Nhiệt độ. Thang nhiệt độ – nhiệt kế', 15, 19],
  4: ['Nhiệt dung riêng', 20, 23],
  5: ['Nhiệt nóng chảy riêng', 24, 26],
  6: ['Nhiệt hoá hơi riêng', 27, 29],
  8: ['Mô hình động học phân tử chất khí', 34, 36],
  9: ['Định luật Boyle', 37, 40],
  10: ['Định luật Charles', 41, 44],
  11: ['Phương trình trạng thái của khí lí tưởng', 45, 47],
  12: [
    'Áp suất khí theo mô hình động học phân tử. Quan hệ giữa động năng phân tử và nhiệt độ',
    48,
    51,
  ],
  14: ['Từ trường', 56, 60],
  15: ['Lực từ tác dụng lên dây dẫn mang dòng điện. Cảm ứng từ', 61, 65],
  16: ['Từ thông. Hiện tượng cảm ứng điện từ', 66, 71],
  17: ['Máy phát điện xoay chiều', 72, 77],
  18: ['Ứng dụng hiện tượng cảm ứng điện từ', 78, 81],
  19: ['Điện từ trường. Mô hình sóng điện từ', 82, 85],
  21: ['Cấu trúc hạt nhân', 91, 95],
  22: ['Phản ứng hạt nhân và năng lượng liên kết', 96, 103],
  23: ['Hiện tượng phóng xạ', 104, 113],
  24: ['Công nghiệp hạt nhân', 114, 118],
};

/** The source of Vật lí 12 KNTT lesson `n`, with its pages. */
export function sgkVl12(n: number): Source {
  const lesson = VL12_LESSONS[n];
  if (!lesson) throw new Error(`Vật lí 12 lesson ${String(n)} is not in VL12_LESSONS`);
  const [title, from, to] = lesson;
  return {
    id: `sgk-vl12-kntt-b${String(n)}`,
    citation: `Sách giáo khoa Vật lí 12, bộ Kết nối tri thức với cuộc sống, NXB Giáo dục Việt Nam — Bài ${String(n)} “${title}”, tr. ${String(from)}–${String(to)}`,
  };
}

/** The oscillation lessons a pendulum card cites (Vật lí 11 Bài 1, 2, 3, 5, 6). */
export const VL11_OSCILLATION = [1, 2, 3, 5, 6] as const;
