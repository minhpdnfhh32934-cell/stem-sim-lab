import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { sgkVl12 } from '../common/sources';
import { MAGNETISM_SOURCE } from '../magnetic/model';

export const L = (vi: string, en: string): LocalizedText => ({ vi, en });

export const TITLE = L(
  'Cảm ứng điện từ và máy phát điện xoay chiều',
  'Electromagnetic induction and the AC generator',
);

export function inductionCard(): ScienceCardData {
  return {
    title: TITLE,
    model: L(
      'Từ thông qua một vòng dây diện tích S đặt trong từ trường đều B là Φ = BS cosα, với α là góc giữa vectơ B và vectơ pháp tuyến n của mặt vòng dây. Khi từ thông qua cuộn dây kín N vòng biến thiên, trong cuộn dây xuất hiện suất điện động cảm ứng e = −N ΔΦ/Δt; dấu trừ thể hiện định luật Lenz. Khung dây quay đều với tốc độ góc ω quanh trục vuông góc với B có từ thông biến thiên điều hòa, sinh ra suất điện động xoay chiều e = E₀cos(ωt + φ₀) với E₀ = NBSω.',
      'The flux through one turn of area S in a uniform field B is Φ = BS cosα, α being the angle between B and the turn’s normal n. When the flux through a closed coil of N turns changes, an e.m.f. e = −N ΔΦ/Δt appears; the minus sign is Lenz’s law. A coil turning steadily at ω about an axis perpendicular to B sees a sinusoidal flux and gives an alternating e.m.f. e = E₀cos(ωt + φ₀) with E₀ = NBSω.',
    ),
    equations: [
      { tex: '\\Phi = BS\\cos\\alpha', label: L('Từ thông (16.1)', 'Magnetic flux (16.1)') },
      {
        tex: 'e_c = -N\\dfrac{\\Delta\\Phi}{\\Delta t}',
        label: L('Định luật Faraday và Lenz (tr. 70)', 'Faraday’s and Lenz’s laws (p. 70)'),
      },
      {
        tex: 'e = E_0\\cos(\\omega t + \\varphi_0),\\quad E_0 = NBS\\omega',
        label: L('Suất điện động xoay chiều (17.1)', 'Alternating e.m.f. (17.1)'),
      },
      {
        tex: 'T = \\dfrac{2\\pi}{\\omega},\\quad f = \\dfrac{\\omega}{2\\pi}',
        label: L('Chu kì, tần số (tr. 72)', 'Period, frequency (p. 72)'),
      },
      {
        tex: 'E = \\dfrac{E_0}{\\sqrt{2}}',
        label: L('Giá trị hiệu dụng (17.4), (17.5)', 'Effective value (17.4), (17.5)'),
      },
    ],
    assumptions: [
      L(
        'Từ trường đều; khung dây phẳng, mọi vòng dây có cùng diện tích S và cùng góc α; trục quay vuông góc với B, khung quay đều.',
        'Uniform field; a flat coil whose turns all have area S and angle α; the axis is perpendicular to B and the coil turns steadily.',
      ),
      L(
        'Ở phần "Từ thông", suất điện động là giá trị trung bình trong khoảng Δt.',
        'In “Flux” the e.m.f. is the mean value over Δt.',
      ),
      L(
        'Ba pha: ba cuộn dây lệch nhau 120°, suất điện động lệch pha nhau 2π/3 như ví dụ của sách (tr. 77).',
        'Three-phase: three coils 120° apart, e.m.f.s 2π/3 out of phase as in the book’s example (p. 77).',
      ),
      L(
        'Sách không cho ví dụ bằng số ở Bài 16, 17: các số mặc định chỉ để minh họa.',
        'The book gives no worked numbers for lessons 16 and 17: the default values are illustrations.',
      ),
    ],
    validity: L(
      'Từ trường đều, khung dây cứng quay đều; bỏ qua điện trở và độ tự cảm của cuộn dây.',
      'Uniform field, a rigid coil turning steadily; the coil’s resistance and self-inductance are ignored.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Các hệ thức là chính xác trong điều kiện trên; câu chữ chờ giáo viên duyệt.',
      'The relations are exact under these conditions; the wording awaits teacher review.',
    ),
    userIntervened: false,
    sources: [sgkVl12(16), sgkVl12(17), MAGNETISM_SOURCE],
    reviewStatus: 'pending',
  };
}
