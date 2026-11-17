import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { ELEMENTS_SOURCE } from '../data/elements';
import { ESTER_SOURCE } from './model';

export const L = (vi: string, en: string): LocalizedText => ({ vi, en });

export const TITLE = L('Ester và chất béo', 'Esters and fats');

export function esterCard(): ScienceCardData {
  return {
    title: TITLE,
    model: L(
      'Thay nhóm –OH của nhóm carboxyl bằng nhóm –OR′ thì được ester RCOOR′; tên gọi gồm tên gốc R′ và tên gốc carboxylic acid. Ester bị thủy phân trong môi trường acid (phản ứng thuận nghịch) hoặc môi trường base (một chiều, gọi là phản ứng xà phòng hóa), và được điều chế bằng phản ứng ester hóa giữa carboxylic acid và alcohol. Chất béo là triester của glycerol với acid béo; xà phòng hóa chất béo cho glycerol và muối của acid béo (xà phòng), hydrogen hóa chất béo không no cho chất béo no.',
      'Replacing the –OH of a carboxyl group with –OR′ gives an ester RCOOR′, named after R′ and then the acid’s anion. Esters are hydrolysed in acid (reversibly) or by a base (one way: saponification) and made by esterifying a carboxylic acid with an alcohol. Fats are triesters of glycerol with fatty acids; saponifying a fat gives glycerol and the fatty acids’ salts (soap), and hydrogenating an unsaturated fat gives a saturated one.',
    ),
    equations: [
      {
        tex: "\\mathrm{RCOOH + R'OH \\rightleftharpoons RCOOR' + H_2O}",
        label: L('Ester hóa (xúc tác H₂SO₄ đặc)', 'Esterification (conc. H₂SO₄ catalyst)'),
      },
      {
        tex: "\\mathrm{RCOOR' + NaOH \\rightarrow RCOONa + R'OH}",
        label: L('Thủy phân trong môi trường base', 'Hydrolysis by a base'),
      },
      {
        tex: '\\mathrm{(RCOO)_3C_3H_5 + 3NaOH \\rightarrow C_3H_5(OH)_3 + 3RCOONa}',
        label: L('Xà phòng hóa chất béo', 'Saponification of a fat'),
      },
      {
        tex: 'H = \\dfrac{m_{tt}}{m_{lt}}\\cdot 100\\%',
        label: L(
          'Hiệu suất (m_tt: khối lượng thực tế, m_lt: khối lượng lí thuyết)',
          'Yield (m_tt: actual mass, m_lt: theoretical mass)',
        ),
      },
    ],
    assumptions: [
      L(
        'Tên gọi, ví dụ và câu hỏi theo Bài 1, 2 của sách; danh sách đồng phân gồm các ester no, đơn chức, mạch hở có không quá 5 nguyên tử C.',
        'Names, examples and questions follow lessons 1 and 2 of the book; the isomer list holds the saturated, open-chain esters with at most 5 carbon atoms.',
      ),
      L(
        'Khối lượng mol tính theo nguyên tử khối chuẩn trong dữ liệu nguyên tố của SimLab, vì sách Hóa học 12 không in bảng nguyên tử khối.',
        'Molar masses use the standard atomic weights of SimLab’s element data, since the chemistry book prints no table of them.',
      ),
      L(
        'Xà phòng hóa và hydrogen hóa được coi là xảy ra hoàn toàn; hiệu suất ester hóa tính theo chất phản ứng hết.',
        'Saponification and hydrogenation are taken as complete; the esterification yield is based on the limiting reagent.',
      ),
    ],
    validity: L(
      'Ester đơn chức RCOOR′ và chất béo tạo từ bốn acid béo trong sách (palmitic, stearic, oleic, linoleic).',
      'Simple esters RCOOR′ and fats made from the book’s four fatty acids (palmitic, stearic, oleic, linoleic).',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Tính theo hệ số phương trình là chính xác; số liệu lấy từ sách, chờ giáo viên duyệt.',
      'Calculations from the equations are exact; the data come from the book, awaiting teacher review.',
    ),
    userIntervened: false,
    sources: [ESTER_SOURCE, ELEMENTS_SOURCE],
    reviewStatus: 'pending',
  };
}
