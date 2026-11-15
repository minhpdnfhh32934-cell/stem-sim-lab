import { CONSTANTS_DATASET } from '@/core/constants';
import type { Source } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common';
import { ELEMENTS_SOURCE } from '../data/elements';
import { ENTHALPY_REFERENCES } from '../data/enthalpy';
import { HALOGEN_SOURCES } from '../data/halogens';
import { REACTIONS_SOURCE } from '../data/reactions';

const READER = 'https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-10.4700854983';

const SGK_B21: Source = {
  id: 'sgk-hh10-kntt-b21',
  citation:
    'SGK Hoá học 10, Kết nối tri thức với cuộc sống (NXB Giáo dục Việt Nam), Bài 21: cấu hình ns²np⁵ và số oxi hoá (tr. 106), tính chất vật lí và giải thích (tr. 107), tính oxi hoá giảm từ fluorine đến iodine (tr. 107); Bài 6: xu hướng bán kính, năng lượng ion hoá, độ âm điện trong nhóm A (tr. 35–37)',
  url: READER,
};

const SGK_B22: Source = {
  id: 'sgk-hh10-kntt-b22',
  citation:
    'SGK Hoá học 10, Kết nối tri thức với cuộc sống (NXB Giáo dục Việt Nam), Bài 22: Bảng 22.1 (tr. 112), Bảng 22.2 và tính acid của dãy hydrohalic acid (tr. 113), nhận biết ion halide bằng AgNO₃ (tr. 115)',
  url: READER,
};

const OPENSTAX_ACID: Source = {
  id: 'openstax-chem2e-14-3',
  citation:
    'P. Flowers et al., Chemistry 2e, OpenStax (CC BY 4.0), §14.3 Relative Strengths of Acids and Bases: in group 17 acid strength increases (HF < HCl < HBr < HI) as the H–A bond strength decreases; Figure 14.6, the six strong acids (HCl, HBr, HI among them)',
  url: 'https://openstax.org/books/chemistry-2e/pages/14-3-relative-strengths-of-acids-and-bases',
};

/** Science Card of "Nhóm halogen" (HH10 Bài 21; DATA_REVIEW HH10-RX-6, -8). */
export const HALOGENS_CARD: ScienceCardData = {
  title: L('Nhóm halogen', 'The halogens'),
  model: L(
    'Số liệu theo sách: bán kính nguyên tử (Hình 6.2), độ âm điện (Bảng 6.2), trạng thái, màu sắc, nhiệt độ nóng chảy và nhiệt độ sôi của đơn chất (Bảng 21.2). Sách không cho năng lượng ion hoá thứ nhất của F, Cl, Br, I: chương trình lấy giá trị NIST trong bảng nguyên tố và đổi sang kJ/mol. Từ F đến I, số lớp electron tăng nên bán kính tăng; lực hút giữa hạt nhân và electron lớp ngoài cùng giảm nên độ âm điện và năng lượng ion hoá giảm, tính oxi hoá giảm. Nhiệt độ nóng chảy, nhiệt độ sôi tăng do tương tác van der Waals giữa các phân tử và khối lượng phân tử tăng.',
    'Values as the book gives them: atomic radius (SGK Figure 6.2), electronegativity (SGK Table 6.2), state, colour, melting and boiling points of the elements (SGK Table 21.2). The book gives no first ionisation energy for F, Cl, Br, I: the program takes the NIST value of the element table and converts it to kJ/mol. From F to I the number of electron shells grows, so the radius grows; the nucleus holds the outer electrons less, so electronegativity, ionisation energy and oxidising power fall. Melting and boiling points rise because the van der Waals interactions between molecules and the molecular mass increase.',
  ),
  equations: [
    {
      tex: 'I_1\\,[\\mathrm{kJ/mol}] = I_1\\,[\\mathrm{eV}]\\cdot e\\,N_A / 1000',
      label: L(
        'Đổi năng lượng ion hoá từ eV (một nguyên tử) sang kJ/mol',
        'Ionisation energy from eV (one atom) to kJ/mol',
      ),
    },
  ],
  assumptions: [
    L(
      'Bán kính nguyên tử theo sách là một nửa khoảng cách trung bình giữa hai hạt nhân gần nhau nhất (SGK tr. 35); bảng nguyên tố của app dùng bán kính cộng hoá trị (Cordero 2008), chỉ để đối chiếu.',
      'The book’s atomic radius is half the mean distance between two nearest nuclei (SGK p. 35); the app’s element table uses covalent radii (Cordero 2008), shown only as a cross-check.',
    ),
    L(
      'Nhiệt độ nóng chảy, sôi theo Bảng 21.2 (sách dẫn chem.libretexts.org); CRC Handbook (qua mendeleev) chỉ để đối chiếu.',
      'Melting and boiling points from SGK Table 21.2 (the book cites chem.libretexts.org); the CRC Handbook (via mendeleev) is only a cross-check.',
    ),
    L(
      'Astatine và tennessine là nguyên tố phóng xạ, sách chỉ xét F, Cl, Br, I.',
      'Astatine and tennessine are radioactive; the book covers only F, Cl, Br, I.',
    ),
  ],
  validity: L('Bốn halogen F, Cl, Br, I.', 'The four halogens F, Cl, Br, I.'),
  confidence: 'exact',
  confidenceNote: L(
    'Số liệu lấy nguyên từ sách (và NIST cho năng lượng ion hoá); phần giải thích xu hướng là định tính. Đang chờ giáo viên duyệt.',
    'Values copied from the book (and NIST for the ionisation energy); the explanation of the trends is qualitative. Awaiting a teacher’s review.',
  ),
  userIntervened: false,
  sources: [
    HALOGEN_SOURCES.radius,
    HALOGEN_SOURCES.en,
    HALOGEN_SOURCES.physical,
    SGK_B21,
    ELEMENTS_SOURCE,
    CONSTANTS_DATASET.source,
  ],
  reviewStatus: 'pending',
};

/** Science Card of "Hydrogen halide · Muối halide" (HH10 Bài 22; DATA_REVIEW HH10-RX-7, -8). */
export const HYDROGEN_HALIDES_CARD: ScienceCardData = {
  title: L('Hydrogen halide · Muối halide', 'Hydrogen halides · Halide salts'),
  model: L(
    'Độ dài và năng lượng liên kết H–X theo SGK Bảng 22.1, nhiệt độ sôi theo Bảng 22.2. Trong dãy hydrohalic acid, tính acid tăng từ hydrofluoric acid (yếu) đến hydroiodic acid (rất mạnh) (SGK tr. 113): năng lượng liên kết H–X giảm từ HF đến HI, liên kết càng kém bền thì phân tử càng dễ phân li ra H⁺ trong nước. Phản ứng nhận biết ion halide chỉ lấy từ thư viện phản ứng đã kiểm chứng.',
    'H–X bond length and bond energy from SGK Table 22.1, boiling points from SGK Table 22.2. Along the hydrohalic acids, acid strength rises from hydrofluoric acid (weak) to hydroiodic acid (very strong) (SGK p. 113): the H–X bond energy falls from HF to HI, and the weaker the bond, the more easily the molecule gives H⁺ in water. Tests for halide ions come only from the verified reaction library.',
  ),
  equations: [
    {
      tex: 'D(\\mathrm{H{-}X}) \\approx \\Delta_f H^\\circ(\\mathrm{H}) + \\Delta_f H^\\circ(\\mathrm{X}) - \\Delta_f H^\\circ(\\mathrm{HX})',
      label: L(
        'Đối chiếu năng lượng liên kết của sách bằng định luật Hess (nhiệt tạo thành của nguyên tử và HX ở thể khí, NIST CODATA)',
        'Cross-check of the book’s bond energies by Hess’s law (enthalpies of formation of the gaseous atoms and HX, NIST CODATA)',
      ),
    },
  ],
  assumptions: [
    L(
      'Màn hình dùng năng lượng liên kết của sách; giá trị Hess từ NIST chỉ để đối chiếu (bảng dưới, chế độ Nâng cao) và lệch sách dưới 2 kJ/mol.',
      'The screen uses the book’s bond energies; the Hess values from NIST are only a cross-check (bottom table, Advanced mode) and differ from the book by less than 2 kJ/mol.',
    ),
    L(
      'HF có nhiệt độ sôi cao bất thường do phân tử HF phân cực mạnh, tạo liên kết hydrogen (SGK tr. 113).',
      'HF boils unusually high because its strongly polar molecules form hydrogen bonds (SGK p. 113).',
    ),
    L(
      'Thư viện phản ứng hiện chỉ có phản ứng của AgNO₃ với NaCl; phản ứng với NaF, NaBr, NaI chưa có trong cơ sở dữ liệu đã kiểm chứng nên không hiển thị hiện tượng.',
      'The reaction library has only AgNO₃ with NaCl so far; the reactions with NaF, NaBr, NaI are not in the verified database, so no observation is shown.',
    ),
  ],
  validity: L(
    'HF, HCl, HBr, HI ở điều kiện thường; dung dịch loãng trong nước cho tính acid.',
    'HF, HCl, HBr, HI at room conditions; dilute aqueous solutions for acid strength.',
  ),
  // Copied, cited tables, as the halogens card: the explanation's qualitative side is in the note.
  confidence: 'exact',
  confidenceNote: L(
    'Số liệu lấy nguyên từ sách; mối liên hệ năng lượng liên kết – tính acid là giải thích định tính. Đang chờ giáo viên duyệt.',
    'Values copied from the book; the link between bond energy and acid strength is a qualitative explanation. Awaiting a teacher’s review.',
  ),
  userIntervened: false,
  sources: [
    HALOGEN_SOURCES.bond,
    HALOGEN_SOURCES.hxBoiling,
    SGK_B22,
    OPENSTAX_ACID,
    ENTHALPY_REFERENCES.codata,
    REACTIONS_SOURCE,
  ],
  reviewStatus: 'pending',
};
