import type { Source } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common';
import { ELEMENTS_SOURCE } from '../data/elements';
import { HYDRIDES_SOURCE } from '../data/hydrides';
import { IONS_SECOND_SOURCE, IONS_SOURCE } from '../data/ions';
import { MOLECULES_SOURCE } from '../data/molecules';

const READER = 'https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-10.4700854983';
const kntt = (id: string, lesson: string): Source => ({
  id: `kntt-hh10-${id}`,
  citation: `SGK Hóa học 10 “Kết nối tri thức với cuộc sống”, NXB Giáo dục Việt Nam — ${lesson} (bản đọc trên trang tập huấn NXBGD, đọc ngày 15/11/2026)`,
  url: READER,
});
/** Lesson pages as printed in the book (chapter 3, "Liên kết hóa học"). */
export const KNTT = {
  b10: kntt('b10', 'Bài 10 Quy tắc octet, tr. 49–50 (Bảng 10.1; “Em có biết”: PCl₅)'),
  b11: kntt('b11', 'Bài 11 Liên kết ion, tr. 51–54'),
  b12: kntt(
    'b12',
    'Bài 12 Liên kết cộng hóa trị, tr. 55–63 (Bảng 12.1 tr. 59; liên kết σ, π tr. 60–61)',
  ),
  b13: kntt(
    'b13',
    'Bài 13 Liên kết hydrogen và tương tác van der Waals, tr. 64–67 (Bảng 13.1 tr. 65: nhiệt độ sôi H₂O, H₂S, CH₄)',
  ),
  b22: kntt(
    'b22',
    'Bài 22 Hydrogen halide. Muối halide, Bảng 22.2 tr. 113: nhiệt độ sôi HF, HCl, HBr, HI',
  ),
} satisfies Record<string, Source>;

const PICTURE = L(
  'Hình vẽ kiểu Lewis là minh họa: vị trí nguyên tử lấy từ tọa độ 2D của dữ liệu cấu trúc (RDKit), không phải hình học thật của phân tử.',
  'The Lewis-style drawing is an illustration: atom positions are the structure data’s 2D depiction (RDKit), not the real molecular geometry.',
);

export const OCTET_CARD: ScienceCardData = {
  title: L('Quy tắc octet', 'The octet rule'),
  model: L(
    'Đếm electron quanh mỗi nguyên tử trên công thức Lewis của dữ liệu cấu trúc (bậc liên kết, điện tích hình thức). Mỗi cặp electron dùng chung tính cho cả hai nguyên tử. Chương trình so tổng với 8 (với H là 2, như He) và tự đánh dấu ngoại lệ.',
    'Electrons around each atom are counted on the Lewis structure of the structure data (bond orders, formal charges). Each shared pair counts for both atoms. The program compares the total with 8 (2 for H, like He) and marks the exceptions itself.',
  ),
  equations: [
    {
      tex: 'E = V - q - \\textstyle\\sum b',
      label: L(
        'E: electron riêng của nguyên tử (V: electron hóa trị, q: điện tích hình thức, Σb: tổng bậc liên kết)',
        'E: non-bonding electrons of the atom (V: valence electrons, q: formal charge, Σb: sum of bond orders)',
      ),
    },
    {
      tex: 'N = 2\\textstyle\\sum b + E',
      label: L(
        'Electron quanh nguyên tử; octet khi N = 8 (H: N = 2)',
        'Electrons around the atom; octet when N = 8 (H: N = 2)',
      ),
    },
  ],
  assumptions: [
    L(
      'Số electron hóa trị của nguyên tố nhóm A bằng số thứ tự nhóm (SGK Bảng 10.1), nhóm lấy từ bảng tuần hoàn của app.',
      'A group A element has as many valence electrons as its group number (SGK Table 10.1); the group comes from the app’s periodic table.',
    ),
    L(
      'Mỗi chất dùng một công thức Lewis (một dạng cộng hưởng) sinh từ SMILES bằng RDKit.',
      'Each species uses one Lewis structure (one resonance form) generated from SMILES by RDKit.',
    ),
    PICTURE,
  ],
  validity: L(
    'Theo SGK, quy tắc octet chỉ đúng với các nguyên tố chu kì 2 và một số nguyên tử kim loại, phi kim điển hình; ngoài ra có các ngoại lệ (ví dụ PCl₅).',
    'Per the textbook, the octet rule holds only for period-2 elements and some typical metals and non-metals; there are exceptions (e.g. PCl₅).',
  ),
  confidence: 'exact',
  confidenceNote: L(
    'Phép đếm đúng trên công thức Lewis đã chọn; hình vẽ là minh họa.',
    'The count is exact on the chosen Lewis structure; the drawing is an illustration.',
  ),
  userIntervened: false,
  sources: [KNTT.b10, MOLECULES_SOURCE, ELEMENTS_SOURCE],
  reviewStatus: 'pending',
};

export const IONIC_CARD: ScienceCardData = {
  title: L('Liên kết ion', 'Ionic bond'),
  model: L(
    'Nguyên tử kim loại nhường electron thành ion dương, nguyên tử phi kim nhận electron thành ion âm. Điện tích ion theo SGK (Bài 11 tr. 51): bằng số electron nhường hoặc nhận, để ion có cấu hình của khí hiếm gần nhất; ion nào sách in sẵn (tr. 51–52) thì lấy từ sách, các ion khác theo danh sách OpenStax Hình 2.29, khớp quy tắc của sách. Cấu hình electron của ion suy từ cấu hình nguyên tử trong bảng dữ liệu (bớt electron ở lớp ngoài cùng, hoặc thêm vào phân lớp p ngoài cùng) rồi so với cấu hình khí hiếm trong bảng. Công thức hợp chất: tổng điện tích bằng 0.',
    'The metal atom gives electrons and becomes a positive ion, the non-metal atom takes electrons and becomes a negative ion. Ion charges follow the textbook (Lesson 11, p. 51): the number of electrons given or taken, so that the ion has the configuration of the nearest noble gas; the ions the book prints (pp. 51–52) come from the book, the others from the OpenStax Figure 2.29 list, which agrees with the book’s rule. The ion’s configuration is derived from the atom’s configuration in the data table (electrons removed from the outermost shell, or added to the outermost p subshell) and compared with the noble gas configuration in the table. Compound formula: total charge zero.',
  ),
  equations: [
    {
      tex: 'x \\cdot a = y \\cdot b',
      label: L(
        'Hợp chất MₓXᵧ của ion Mᵃ⁺ và Xᵇ⁻: x, y nhỏ nhất (x·a là bội chung nhỏ nhất của a và b)',
        'Compound MₓXᵧ of the ions Mᵃ⁺ and Xᵇ⁻: smallest x, y (x·a is the least common multiple of a and b)',
      ),
    },
  ],
  assumptions: [
    L(
      'Mô hình ion lí tưởng: electron chuyển hẳn từ kim loại sang phi kim.',
      'Ideal ionic model: the electrons move completely from the metal to the non-metal.',
    ),
    L(
      'Công thức chỉ là kết quả cân bằng điện tích; mô hình không cho biết hợp chất đó có bền hay điều chế được không.',
      'The formula is only the charge balance; the model does not tell whether the compound is stable or can be made.',
    ),
    L(
      'Hiệu độ âm điện Pauling được so với ngưỡng của SGK Bảng 12.1: dưới 1,7 thì liên kết nghiêng về cộng hóa trị phân cực.',
      'The Pauling electronegativity difference is compared with the thresholds of SGK Table 12.1: below 1.7 the bond leans to polar covalent.',
    ),
    L(
      'Bảng ion giữ các nhóm 1, 2, 13, 15–17; bỏ các nguyên tố á kim (As, Te) và không có đồng vị bền (Fr, Ra, At). SGK in sẵn ion của Li, Na, K, Be, Mg, Ca, Al, O, S, F, Cl, Br; ion của Rb, Cs, Sr, Ba, N, P, Se, I lấy theo OpenStax.',
      'The ion table keeps groups 1, 2, 13, 15–17; metalloids (As, Te) and elements without a stable isotope (Fr, Ra, At) are left out. The textbook prints the ions of Li, Na, K, Be, Mg, Ca, Al, O, S, F, Cl, Br; those of Rb, Cs, Sr, Ba, N, P, Se, I follow OpenStax.',
    ),
  ],
  validity: L(
    'Ion đơn nguyên tử của nguyên tố nhóm A có một điện tích thường gặp.',
    'Monatomic ions of group A elements with one common charge.',
  ),
  confidence: 'exact',
  confidenceNote: L(
    'Điện tích và cấu hình tra từ bảng dữ liệu; công thức tính đúng từ cân bằng điện tích. Loại liên kết là dự đoán theo ngưỡng của SGK (Bảng 12.1), có ngoại lệ.',
    'Charges and configurations are looked up from data tables; the formula is computed exactly from the charge balance. The bond type is a prediction from the textbook’s thresholds (Table 12.1), with exceptions.',
  ),
  userIntervened: false,
  sources: [KNTT.b11, IONS_SOURCE, IONS_SECOND_SOURCE, ELEMENTS_SOURCE],
  reviewStatus: 'pending',
};

export const COVALENT_CARD: ScienceCardData = {
  title: L('Liên kết cộng hóa trị', 'Covalent bond'),
  model: L(
    'Loại liên kết dự đoán từ hiệu độ âm điện Pauling theo Bảng 12.1 của SGK. Số liên kết σ và π đếm từ bậc liên kết trong dữ liệu cấu trúc: liên kết đơn là một liên kết σ; liên kết đôi gồm một σ và một π; liên kết ba gồm một σ và hai π.',
    'The bond type is predicted from the Pauling electronegativity difference with the textbook’s Table 12.1. The σ and π bonds are counted from the bond orders of the structure data: a single bond is one σ bond; a double bond is one σ and one π; a triple bond is one σ and two π.',
  ),
  equations: [
    {
      tex: '\\Delta\\chi = |\\chi_A - \\chi_B|',
      label: L('Hiệu độ âm điện', 'Electronegativity difference'),
    },
    {
      tex: { vi: '0 \\le |\\Delta\\chi| < 0{,}4', en: '0 \\le |\\Delta\\chi| < 0.4' },
      label: L('Cộng hóa trị không phân cực', 'Non-polar covalent'),
    },
    {
      tex: { vi: '0{,}4 \\le |\\Delta\\chi| < 1{,}7', en: '0.4 \\le |\\Delta\\chi| < 1.7' },
      label: L('Cộng hóa trị phân cực', 'Polar covalent'),
    },
    {
      tex: { vi: '|\\Delta\\chi| \\ge 1{,}7', en: '|\\Delta\\chi| \\ge 1.7' },
      label: L('Ion', 'Ionic'),
    },
  ],
  assumptions: [
    L(
      'Ngưỡng của Bảng 12.1 có ngoại lệ, SGK nêu ví dụ HF và MnI₂: HF có |Δχ| = 1,78 nhưng là phân tử cộng hóa trị; app đánh dấu những trường hợp như vậy.',
      'Table 12.1’s thresholds have exceptions; the textbook names HF and MnI₂: HF has |Δχ| = 1.78 but is a covalent molecule; the app marks such cases.',
    ),
    L(
      'Độ âm điện Pauling lấy từ bảng tuần hoàn của app, đọc đến 2 chữ số thập phân.',
      'Pauling electronegativities come from the app’s periodic table, read to 2 decimals.',
    ),
    PICTURE,
  ],
  confidence: 'qualitative',
  confidenceNote: L(
    'Số liên kết σ, π đếm đúng từ dữ liệu; loại liên kết là dự đoán theo ngưỡng, có ngoại lệ.',
    'The σ and π counts are exact from the data; the bond type is a threshold prediction with exceptions.',
  ),
  userIntervened: false,
  sources: [KNTT.b12, MOLECULES_SOURCE, ELEMENTS_SOURCE],
  reviewStatus: 'pending',
};

export const FORCES_CARD: ScienceCardData = {
  title: L(
    'Liên kết hydrogen và tương tác van der Waals',
    'Hydrogen bonds and van der Waals forces',
  ),
  model: L(
    'Nhiệt độ sôi thường của các hydride nhóm IVA–VIIA theo chu kì. Chất nào SGK ghi thì lấy số của SGK (Bảng 13.1: H₂O, H₂S, CH₄; Bảng 22.2: HF, HCl, HBr, HI); chất SGK không ghi thì lấy NIST WebBook hoặc PubChem. App không mô phỏng lực giữa các phân tử: phần giải thích là định tính.',
    'Normal boiling points of the group IVA–VIIA hydrides by period. Where the textbook gives a value it is used (Table 13.1: H₂O, H₂S, CH₄; Table 22.2: HF, HCl, HBr, HI); the others come from the NIST WebBook or PubChem. The app does not simulate the forces between molecules: the explanation is qualitative.',
  ),
  equations: [
    {
      tex: { vi: 'T = t + 273{,}15', en: 'T = t + 273.15' },
      label: L('Đổi nhiệt độ: T (K), t (°C)', 'Temperature conversion: T (K), t (°C)'),
    },
  ],
  assumptions: [
    L(
      'Từ chu kì 3 trở đi, trong mỗi nhóm phân tử càng lớn (càng nhiều electron) thì tương tác van der Waals càng mạnh, nhiệt độ sôi càng cao.',
      'From period 3 on, within each group the larger the molecule (the more electrons), the stronger the van der Waals forces and the higher the boiling point.',
    ),
    L(
      'NH₃, H₂O, HF sôi cao bất thường so với xu hướng đó: giữa các phân tử có liên kết hydrogen, vì nguyên tử H liên kết với nguyên tử có độ âm điện lớn (N, O, F) còn cặp electron hóa trị chưa liên kết. CH₄ không có liên kết hydrogen nên không có điểm bất thường.',
      'NH₃, H₂O and HF boil unusually high against that trend: there are hydrogen bonds between their molecules, because H is bonded to a very electronegative atom (N, O, F) that still has a non-bonding pair. CH₄ has no hydrogen bonds, so it shows no anomaly.',
    ),
    L(
      'SnH₄ và H₂Te: SGK, NIST WebBook và PubChem đều không ghi nhiệt độ sôi (đọc ngày 15–16/11/2026), biểu đồ để trống, không ước lượng.',
      'SnH₄ and H₂Te: the textbook, the NIST WebBook and PubChem give no boiling point (read 15–16/11/2026); the chart leaves a gap, nothing is estimated.',
    ),
    L(
      'Với các chất có trong SGK, số của NIST WebBook (CH₄, H₂O, H₂S, HF) hoặc PubChem (HCl, HBr, HI) được ghi là nguồn thứ hai ở bảng số liệu; vài số lệch nhau đôi chút (ví dụ H₂S, CH₄). SGK ghi H₂S −60,75 °C ở Bảng 13.1 nhưng −60,28 °C ở câu hỏi mở đầu Bài 13 (tr. 64): app theo số của bảng.',
      'For the hydrides in the textbook, the NIST WebBook value (CH₄, H₂O, H₂S, HF) or the PubChem one (HCl, HBr, HI) is written as a second source in the data table; a few differ slightly (e.g. H₂S, CH₄). The textbook gives H₂S −60.75 °C in Table 13.1 but −60.28 °C in the question opening Lesson 13 (p. 64): the app follows the table.',
    ),
  ],
  validity: L('Áp suất 1 atm (nhiệt độ sôi thường).', 'At 1 atm (normal boiling point).'),
  confidence: 'exact',
  confidenceNote: L(
    'Số liệu hiện đúng như nguồn ghi (SGK trước); nhận xét “bất thường” do code so số liệu; lời giải thích là định tính.',
    'The values are shown as the sources give them (textbook first); the “anomaly” is found by comparing the data; the explanation is qualitative.',
  ),
  userIntervened: false,
  sources: [KNTT.b13, KNTT.b22, HYDRIDES_SOURCE],
  reviewStatus: 'pending',
};
