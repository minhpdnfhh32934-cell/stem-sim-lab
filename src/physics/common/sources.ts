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
      'IAPWS-95 (khối lượng riêng) và IAPWS 2008 (độ nhớt) — nước ở 20 °C, 101 325 Pa: ρ = 998,21 kg/m³, μ = 1,0016 mPa·s',
  },
  hoerner: {
    id: 'hoerner-drag',
    citation:
      'S. F. Hoerner — Fluid-Dynamic Drag (1965): hệ số cản của quả cầu nhẵn gần như không đổi (≈ 0,47) khi 10³ < Re < 2·10⁵',
  },
} satisfies Record<string, Source>;
