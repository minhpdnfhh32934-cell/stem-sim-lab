import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common';
import { ENTHALPY_REFERENCES } from '../data/enthalpy';
import { REACTIONS_SOURCE } from '../data/reactions';

/** Science Card of "Biến thiên enthalpy trong các phản ứng hoá học" (HH10 Bài 17; HH10-RX-4, -5). */
export const ENTHALPY_CARD: ScienceCardData = {
  title: L(
    'Biến thiên enthalpy trong các phản ứng hoá học',
    'Enthalpy changes in chemical reactions',
  ),
  model: L(
    'Biến thiên enthalpy của phản ứng được xác định bằng hiệu số giữa tổng nhiệt tạo thành các chất sản phẩm và tổng nhiệt tạo thành của các chất đầu, có nhân hệ số trong phương trình (SGK Bài 17, tr. 85). Hệ số lấy từ bộ cân bằng chính xác; nhiệt tạo thành chuẩn lấy từ SGK Bảng 17.1, chất nào bảng không có thì lấy từ NIST Chemistry WebBook. Dấu của ΔrH cho biết phản ứng toả nhiệt (ΔrH < 0) hay thu nhiệt (ΔrH > 0).',
    'The reaction’s enthalpy change is the total enthalpy of formation of the products minus that of the reactants, each multiplied by its coefficient (SGK Lesson 17, p. 85). The coefficients come from the exact balancer; standard enthalpies of formation come from SGK Bảng 17.1, and from the NIST Chemistry WebBook for species the table lacks. The sign of ΔrH tells whether the reaction releases heat (ΔrH < 0) or absorbs it (ΔrH > 0).',
  ),
  equations: [
    {
      tex: '\\Delta_r H^\\circ_{298} = \\sum_j \\nu_j\\,\\Delta_f H^\\circ_{298}(j) - \\sum_i \\nu_i\\,\\Delta_f H^\\circ_{298}(i)',
      label: L(
        'j: các chất sản phẩm, i: các chất đầu, ν: hệ số trong phương trình',
        'j: products, i: reactants, ν: coefficients in the equation',
      ),
    },
  ],
  assumptions: [
    L(
      'Điều kiện chuẩn: áp suất 1 bar (chất khí), nồng độ 1 mol/L (chất tan), 25 °C (298 K); trạng thái mỗi chất ghi như sách (ví dụ H₂O lỏng, SO₃ lỏng).',
      'Standard conditions: 1 bar (gases), 1 mol/L (solutes), 25 °C (298 K); each species in the state the book writes (e.g. liquid H₂O, liquid SO₃).',
    ),
    L(
      'Nhiệt tạo thành chuẩn của đơn chất ở dạng bền vững nhất bằng không (SGK tr. 84).',
      'The standard enthalpy of formation of an element in its most stable form is zero (SGK p. 84).',
    ),
    L(
      'Giá trị của sách được dùng trước; NIST WebBook (CODATA Key Values, nếu không có thì NIST-JANAF) chỉ dùng cho NH₄Cl(s) và Al₂O₃(s), và là nguồn đối chiếu cho các giá trị của sách (bảng dưới, chế độ Nâng cao).',
      'The book’s values come first; the NIST WebBook (CODATA Key Values, else NIST-JANAF) is used only for NH₄Cl(s) and Al₂O₃(s), and is the cross-check of the book’s values (bottom table, Advanced mode).',
    ),
    L(
      'Kết quả ghi đến số chữ số thập phân của giá trị kém chính xác nhất đã dùng.',
      'The result is given to the decimals of the least precise value used.',
    ),
    L(
      'Sơ đồ năng lượng chỉ minh hoạ chiều của ΔrH, không theo tỉ lệ.',
      'The energy diagram only shows the direction of ΔrH; it is not to scale.',
    ),
  ],
  validity: L(
    'Các phản ứng trong thư viện đã kiểm chứng có đủ nhiệt tạo thành của mọi chất, ở điều kiện chuẩn.',
    'Library reactions whose species all have an enthalpy of formation, at standard conditions.',
  ),
  confidence: 'exact',
  confidenceNote: L(
    'Phép tính đúng trên số liệu của bảng; số liệu đang chờ giáo viên duyệt.',
    'Exact arithmetic on the table’s values; the values await a teacher’s review.',
  ),
  userIntervened: false,
  sources: [
    ENTHALPY_REFERENCES.sgk,
    ENTHALPY_REFERENCES.codata,
    ENTHALPY_REFERENCES.janaf,
    REACTIONS_SOURCE,
  ],
  reviewStatus: 'pending',
};
