import type { Source } from '@/core/data/dataset';

/**
 * Bibliography for the physics scenes. These are standard references that contain the
 * formulas used; exact editions/pages are to be confirmed by the reviewing teacher
 * (docs/DATA_REVIEW.md).
 */
export const SRC = {
  sgk10: {
    id: 'sgk-vl10',
    citation: 'Sách giáo khoa Vật lí 10 (Chương trình GDPT 2018), NXB Giáo dục Việt Nam',
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
  sgk10kntt: {
    id: 'sgk-vl10-kntt',
    citation:
      'Sách giáo khoa Vật lí 10, bộ Kết nối tri thức với cuộc sống (Chương trình GDPT 2018), NXB Giáo dục Việt Nam',
  },
  hallidayCircular: {
    id: 'halliday-circular',
    citation:
      'D. Halliday, R. Resnick, J. Walker — Fundamentals of Physics, Wiley — ch. 4 (chuyển động tròn đều), ch. 6 (lực hướng tâm)',
  },
  sgk11kntt: {
    id: 'sgk-vl11-kntt',
    citation:
      'Sách giáo khoa Vật lí 11, bộ Kết nối tri thức với cuộc sống (Chương trình GDPT 2018), NXB Giáo dục Việt Nam',
  },
  hallidayElectric: {
    id: 'halliday-electric',
    citation:
      'D. Halliday, R. Resnick, J. Walker — Fundamentals of Physics, Wiley — ch. 21 (định luật Coulomb), ch. 22 (điện trường), ch. 25 (tụ điện)',
  },
} satisfies Record<string, Source>;
