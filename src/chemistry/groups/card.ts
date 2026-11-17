import type { ScienceCardData } from '@/science-card/types';
import { GROUPS_SOURCE } from './model';
import { L } from './text';

export const IA_TITLE = L('Nguyên tố nhóm IA', 'Group IA elements');
export const IIA_TITLE = L('Nguyên tố nhóm IIA', 'Group IIA elements');
export const TM_TITLE = L(
  'Đại cương về kim loại chuyển tiếp dãy thứ nhất',
  'First-row transition metals',
);

const fromBook = L(
  'Mọi số liệu là các bảng của sách; app chỉ sắp xếp, so sánh và tính theo đúng các quy tắc sách nêu.',
  'Every value is the book’s tables; the app only orders, compares and computes by the book’s rules.',
);
const pendingNote = L(
  'Xu hướng và phép tính suy đúng từ các bảng của sách; số liệu chờ giáo viên duyệt.',
  'Trends and computations follow exactly from the book’s tables; the data await teacher review.',
);

export function iaCard(): ScienceCardData {
  return {
    title: IA_TITLE,
    model: L(
      'Nguyên tố nhóm IA chỉ có một electron hóa trị ở phân lớp ns¹ và đứng đầu mỗi chu kì; thế điện cực chuẩn rất âm nên chúng dễ nhường electron, có tính khử rất mạnh và chỉ có số oxi hóa +1 trong hợp chất. Vì vậy trong tự nhiên chúng chỉ tồn tại ở dạng hợp chất. Kim loại nhóm IA mềm (liên kết kim loại yếu), nhẹ và nóng chảy ở nhiệt độ thấp.',
      'Group IA elements have one valence electron in ns¹ and start each period; their very negative standard potentials make them give up that electron easily, so they are very strong reductants, always +1 in compounds and found in nature only as compounds. They are soft (weak metallic bonding), light and low-melting.',
    ),
    equations: [
      {
        tex: '\\mathrm{M \\rightarrow M^+ + e}',
        label: L('Tính khử (tr. 109)', 'Reducing (p. 109)'),
      },
      {
        tex: '\\mathrm{2Na + 2H_2O \\rightarrow 2NaOH + H_2}',
        label: L('Với nước (tr. 92, 111)', 'With water (pp. 92, 111)'),
      },
      {
        tex: '\\mathrm{2NaHCO_3 \\xrightarrow{t^\\circ} Na_2CO_3 + CO_2 + H_2O}',
        label: L('Nhiệt phân NaHCO₃ (tr. 114)', 'Heating NaHCO₃ (p. 114)'),
      },
    ],
    assumptions: [fromBook],
    validity: L(
      'Các số liệu ở điều kiện sách nêu (Bảng 24.1, 24.2).',
      'The data as stated in Tables 24.1 and 24.2.',
    ),
    confidence: 'exact',
    confidenceNote: pendingNote,
    userIntervened: false,
    sources: [GROUPS_SOURCE],
    reviewStatus: 'pending',
  };
}

export function iiaCard(): ScienceCardData {
  return {
    title: IIA_TITLE,
    model: L(
      'Nguyên tố nhóm IIA có hai electron hóa trị ở phân lớp ns², có tính khử mạnh (chỉ kém nhóm IA) và có số oxi hóa +2 trong hợp chất. Từ Be đến Ba, bán kính nguyên tử tăng; mức độ phản ứng với nước tăng (từ Mg đến Ba), độ tan của hydroxide tăng và độ bền nhiệt của muối carbonate, nitrate tăng. Độ tan (g/100 g nước) được phân loại: không quá 0,01 là chất không tan, không quá 1 là chất ít tan, lớn hơn là chất dễ tan.',
      'Group IIA elements have two valence electrons in ns², are strong reductants (just behind group IA) and are +2 in compounds. From Be to Ba the atomic radius grows, the reaction with water gets stronger (from Mg to Ba), the hydroxides dissolve more and the carbonates and nitrates get more stable to heat. Solubility (g/100 g water) is classed: up to 0.01 insoluble, up to 1 slightly soluble, above that soluble.',
    ),
    equations: [
      {
        tex: '\\mathrm{M \\rightarrow M^{2+} + 2e}',
        label: L('Tính khử (tr. 117)', 'Reducing (p. 117)'),
      },
      {
        tex: '\\mathrm{MCO_3 \\xrightarrow{t^\\circ} MO + CO_2}',
        label: L('Nhiệt phân muối carbonate (tr. 121)', 'Heating carbonates (p. 121)'),
      },
      {
        tex: '\\mathrm{CaCO_3 + CO_2 + H_2O \\rightleftharpoons Ca(HCO_3)_2}',
        label: L('Đá vôi tan trong nước có CO₂ (tr. 121)', 'Limestone in water with CO₂ (p. 121)'),
      },
    ],
    assumptions: [
      fromBook,
      L(
        'Độ tan đo ở 20 °C, riêng Ca(NO₃)₂ ở 30 °C như chú thích của sách.',
        'Solubilities are at 20 °C, Ca(NO₃)₂ at 30 °C as the book’s footnote says.',
      ),
    ],
    validity: L(
      'Các số liệu ở điều kiện sách nêu (Bảng 25.1, 25.2, tr. 119–122).',
      'The data as stated in Tables 25.1, 25.2 and pp. 119–122.',
    ),
    confidence: 'exact',
    confidenceNote: pendingNote,
    userIntervened: false,
    sources: [GROUPS_SOURCE],
    reviewStatus: 'pending',
  };
}

export function tmCard(): ScienceCardData {
  return {
    title: TM_TITLE,
    model: L(
      'Các nguyên tố từ Sc (Z = 21) đến Cu (Z = 29) là kim loại chuyển tiếp dãy thứ nhất: số electron ở phân lớp 3d tăng dần, phân lớp 4s thường có 2 electron (trừ Cr và Cu). Khi tạo ion, nguyên tử nhường electron ở phân lớp 4s trước rồi đến 3d. Có nhiều electron hóa trị ở 3d và 4s nên chúng có nhiều số oxi hóa. Chúng khó nóng chảy, thường cứng, dẫn điện, dẫn nhiệt tốt và có khối lượng riêng lớn. Nồng độ FeSO₄ được xác định bằng chuẩn độ với dung dịch KMnO₄ trong môi trường acid.',
      'The elements from Sc (Z = 21) to Cu (Z = 29) are the first-row transition metals: the 3d subshell fills up while 4s usually holds 2 electrons (not Cr and Cu). Forming ions, the atom loses its 4s electrons first, then 3d. With many valence electrons in 3d and 4s they show many oxidation states. They melt high, are usually hard, conduct well and are dense. FeSO₄ is measured by titration with acidified KMnO₄.',
    ),
    equations: [
      {
        tex: '\\mathrm{10FeSO_4 + 2KMnO_4 + 8H_2SO_4 \\rightarrow 5Fe_2(SO_4)_3 + K_2SO_4 + 2MnSO_4 + 8H_2O}',
        label: L(
          'Chuẩn độ FeSO₄ bằng thuốc tím (tr. 132)',
          'Titrating FeSO₄ with permanganate (p. 132)',
        ),
      },
      {
        tex: 'C_{FeSO_4} = \\dfrac{5\\,C_{KMnO_4} V_{KMnO_4}}{V_{FeSO_4}}',
        label: L('Từ tỉ lệ mol 5 : 1', 'From the 5 : 1 mole ratio'),
      },
    ],
    assumptions: [
      fromBook,
      L(
        'Cấu hình electron của ion suy từ Bảng 27.1: bỏ electron 4s trước, rồi 3d (tr. 131).',
        'Ion configurations come from Table 27.1: 4s electrons go first, then 3d (p. 131).',
      ),
    ],
    validity: L(
      'Độ dẫn điện, dẫn nhiệt so với thủy ngân (Hg = 1); độ cứng theo thang kim cương = 10 (Bảng 27.2).',
      'Conductivities relative to mercury (Hg = 1); hardness on the diamond = 10 scale (Table 27.2).',
    ),
    confidence: 'exact',
    confidenceNote: pendingNote,
    userIntervened: false,
    sources: [GROUPS_SOURCE],
    reviewStatus: 'pending',
  };
}
