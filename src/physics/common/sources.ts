import type { Source } from '@/core/data/dataset';

/**
 * Bibliography for the physics scenes. These are standard references that contain the
 * formulas used; exact editions/pages are to be confirmed by the reviewing teacher
 * (docs/DATA_REVIEW.md).
 */
export const SRC = {
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
