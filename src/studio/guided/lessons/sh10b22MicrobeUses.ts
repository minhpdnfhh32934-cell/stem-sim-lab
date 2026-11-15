import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH10 KNTT Bài 22 "Vai trò và ứng dụng của vi sinh vật" (printed pages 131–137), in SimLab's own
 * words. Checked against the pages on 16/11/2026: the roles of H 22.1 (for nature, for people) and
 * the harm the lesson names, and the four fields of part II.2 (nông nghiệp, chế biến thực phẩm,
 * y dược, xử lí chất thải) with only the lesson's own examples. Yoghurt as the lactic example is
 * the lesson's (p. 133). H 22.1's "autotrophs make O₂" is narrowed to photosynthetic microbes such as
 * vi khuẩn lam and tảo (Bài 20, Bảng 20): the book itself says quang khử bacteria give off no O₂
 * (Bài 14, p. 91), and chemoautotrophs (Bài 20) make none either. Biogas is waste treatment, as on
 * p. 134. SH10-GL-7.
 */
export const sh10b22MicrobeUses: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh10-microbe-uses',
  topic: 'microbeApplications',
  title: L('Vi sinh vật quanh ta: vai trò và ứng dụng', 'Microbes around us: their roles and uses'),
  objectives: [
    L('Dự đoán vì sao sữa chua có vị chua.', 'Predict why yoghurt tastes sour.'),
    L(
      'Ghép mỗi nhóm vi sinh vật với vai trò của nó trong tự nhiên và với con người.',
      'Match each group of microbes with its role in nature and for people.',
    ),
    L(
      'Xếp mỗi ứng dụng của vi sinh vật vào đúng lĩnh vực.',
      'Put each use of microbes in the right field.',
    ),
  ],
  hints: [
    L(
      'Nghĩ xem vi sinh vật nào biến đường trong sữa thành một chất có vị chua.',
      'Think about which microbe turns the sugar in milk into a sour substance.',
    ),
    L(
      'Ứng dụng nào giúp cây trồng thì thuộc nông nghiệp; ứng dụng nào làm ra thuốc thì thuộc y dược; ứng dụng nào phân giải chất thải thì thuộc xử lí chất thải.',
      'A use that helps crops belongs to farming; a use that makes medicines belongs to medicine; a use that breaks down waste belongs to waste treatment.',
    ),
  ],
  questions: [
    L(
      'Vì sao không nên nói mọi vi sinh vật đều có hại và cần tiêu diệt hết?',
      'Why is it wrong to say that all microbes are harmful and should all be killed?',
    ),
    L(
      'Nhờ đặc điểm nào mà vi sinh vật được dùng nhiều trong sản xuất?',
      'Which features of microbes make them so useful in production?',
    ),
  ],
  expectedConclusion: L(
    'Vi sinh vật có vai trò rất lớn: chúng phân giải xác sinh vật và chất thải để vật chất quay vòng trong tự nhiên và làm giàu đất; vi sinh vật quang hợp như vi khuẩn lam, tảo tạo O₂ và chất dinh dưỡng; vi sinh vật cộng sinh giúp con người tiêu hoá. Con người dùng vi sinh vật trong nông nghiệp, chế biến thực phẩm, y dược và xử lí chất thải. Bên cạnh đó, một số vi sinh vật gây bệnh và làm hỏng thực phẩm.',
    'Microbes matter a great deal: they break down dead bodies and waste so matter keeps cycling in nature and the soil gets richer; photosynthetic microbes such as cyanobacteria and algae make O₂ and food; microbes living in partnership help people digest. People use microbes in farming, food processing, medicine and waste treatment. Some microbes, however, cause disease and spoil food.',
  ),
  sources: [],
  assumptions: [
    L(
      'Chỉ dùng các ví dụ mà bài học trong sách nêu; còn nhiều ứng dụng khác chưa kể ở đây.',
      'Only the examples the textbook lesson gives are used; many other uses are not listed here.',
    ),
  ],
  limits: [
    L(
      'Bài chỉ giới thiệu ứng dụng ở mức sách giáo khoa, không phải hướng dẫn tự làm thực phẩm lên men, thuốc hay chế phẩm.',
      'The lesson only introduces uses at textbook level; it is not a guide to making fermented food, medicines or products yourself.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH10', lesson: 22 },
    question: L(
      'Sữa chua có vị chua. Theo em, vị chua đó chủ yếu do đâu mà có?',
      'Yoghurt tastes sour. What do you think mainly causes the sour taste?',
    ),
    choices: [
      { id: 'duong-sua', text: L('Đường có sẵn trong sữa', 'The sugar already in the milk') },
      {
        id: 'lactic',
        text: L(
          'Vi khuẩn lactic lên men đường thành lactic acid',
          'Lactic bacteria ferment sugar into lactic acid',
        ),
      },
      {
        id: 'nam-men',
        text: L('Nấm men lên men đường thành ethanol', 'Yeast ferments sugar into ethanol'),
      },
    ],
    answer: 'lactic',
    answerWhy: L(
      'Sữa chua là sản phẩm lên men của vi khuẩn lactic: chúng biến đường glucose thành lactic acid, chất làm sữa có vị chua. Đường trong sữa có vị ngọt, không chua. Nấm men tạo ethanol là cách làm bánh mì, bia, rượu.',
      'Yoghurt is a product of lactic bacteria: they turn glucose into lactic acid, which makes the milk sour. The sugar in milk tastes sweet, not sour. Yeast making ethanol is how bread, beer and wine are made.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'vai-tro',
        prompt: L(
          'Ghép mỗi nhóm vi sinh vật với vai trò của nó.',
          'Match each group of microbes with its role.',
        ),
        pairs: [
          {
            id: 'phan-giai',
            left: L('Vi sinh vật phân giải', 'Decomposing microbes'),
            right: L(
              'Biến xác sinh vật và chất thải thành chất khoáng, giúp vật chất quay vòng trong tự nhiên',
              'Turn dead bodies and waste into minerals, so matter keeps cycling in nature',
            ),
            why: L(
              'Nhờ chúng, chất trong xác và chất thải trở lại đất làm chất dinh dưỡng cho cây.',
              'Thanks to them, the substances in dead bodies and waste go back to the soil as food for plants.',
            ),
          },
          {
            id: 'co-dinh-dam',
            left: L('Vi sinh vật cố định đạm', 'Nitrogen-fixing microbes'),
            right: L(
              'Biến N₂ trong không khí thành NH₃, làm giàu chất đạm cho đất',
              'Turn N₂ from the air into NH₃, adding nitrogen to the soil',
            ),
            why: L(
              'Cây không dùng được N₂ trong không khí; nhờ các vi sinh vật này mà đất có thêm đạm cho cây.',
              'Plants cannot use the N₂ in the air; these microbes give the soil nitrogen that plants can use.',
            ),
          },
          {
            id: 'tu-duong',
            left: L(
              'Vi sinh vật tự dưỡng quang hợp như vi khuẩn lam, tảo',
              'Photosynthetic autotrophic microbes such as cyanobacteria and algae',
            ),
            right: L(
              'Tạo ra O₂ và chất dinh dưỡng cho các sinh vật dị dưỡng',
              'Make O₂ and food for heterotrophic living things',
            ),
            why: L(
              'Chúng tự tạo chất hữu cơ nhờ quang hợp và thải O₂, nên là nguồn thức ăn và O₂ cho nhiều sinh vật khác. Không phải vi sinh vật tự dưỡng nào cũng thải O₂: vi khuẩn quang khử và vi khuẩn hoá tự dưỡng tạo chất hữu cơ mà không thải O₂.',
              'They make their own organic matter by photosynthesis and give off O₂, so they feed many other living things and give them O₂. Not every autotrophic microbe gives off O₂: bacteria whose photosynthesis releases no O₂, and chemoautotrophic bacteria, make organic matter without giving off O₂.',
            ),
          },
          {
            id: 'cong-sinh',
            left: L(
              'Vi sinh vật cộng sinh trong cơ thể người',
              'Microbes living in partnership inside the human body',
            ),
            right: L(
              'Giúp tiêu hoá, tăng miễn dịch và tạo một số vitamin',
              'Help digestion, strengthen immunity and make some vitamins',
            ),
            why: L(
              'Cả hai bên cùng có lợi: vi sinh vật có chỗ sống, con người được giúp tiêu hoá và chống bệnh.',
              'Both sides gain: the microbes get a place to live, and people get help with digestion and fighting disease.',
            ),
          },
          {
            id: 'gay-benh',
            left: L('Vi sinh vật gây bệnh', 'Disease-causing microbes'),
            right: L(
              'Gây bệnh cho người, vật nuôi và cây trồng',
              'Cause disease in people, farm animals and crops',
            ),
            why: L(
              'Đây là mặt có hại của vi sinh vật; chúng còn làm hỏng thực phẩm và đồ dùng.',
              'This is the harmful side of microbes; they also spoil food and household things.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'linh-vuc',
        prompt: L(
          'Xếp mỗi ứng dụng của vi sinh vật vào đúng lĩnh vực.',
          'Put each use of microbes in the right field.',
        ),
        groups: [
          { id: 'nong-nghiep', label: L('Nông nghiệp', 'Farming') },
          { id: 'thuc-pham', label: L('Chế biến thực phẩm', 'Food processing') },
          { id: 'y-duoc', label: L('Y dược', 'Medicine') },
          { id: 'chat-thai', label: L('Xử lí chất thải', 'Waste treatment') },
        ],
        items: [
          {
            id: 'phan-bon',
            text: L('Phân bón vi sinh', 'Microbial fertiliser'),
            group: 'nong-nghiep',
            why: L(
              'Vi sinh vật trong phân bón làm giàu đất và giúp cây hút chất dễ hơn, ít gây ô nhiễm hơn phân hoá học.',
              'The microbes in it enrich the soil and help plants take up nutrients, with less pollution than chemical fertiliser.',
            ),
          },
          {
            id: 'tru-sau',
            text: L('Thuốc trừ sâu vi sinh', 'Microbial insecticide'),
            group: 'nong-nghiep',
            why: L(
              'Dùng vi sinh vật kìm hãm sâu, bệnh hại cây trồng thay cho thuốc hoá học.',
              'Microbes that hold back crop pests and diseases are used instead of chemicals.',
            ),
          },
          {
            id: 'sua-chua',
            text: L('Làm sữa chua nhờ vi khuẩn lactic', 'Making yoghurt with lactic bacteria'),
            group: 'thuc-pham',
            why: L(
              'Vi khuẩn lactic lên men đường thành lactic acid, tạo ra món ăn mới.',
              'Lactic bacteria ferment sugar into lactic acid, making a new food.',
            ),
          },
          {
            id: 'banh-mi',
            text: L('Làm bánh mì nhờ nấm men', 'Making bread with yeast'),
            group: 'thuc-pham',
            why: L(
              'Nấm men lên men đường, sinh ra khí CO₂ làm bánh nở xốp.',
              'Yeast ferments sugar and gives off CO₂, which makes the bread rise.',
            ),
          },
          {
            id: 'khang-sinh',
            text: L('Sản xuất thuốc kháng sinh, vaccine', 'Making antibiotics and vaccines'),
            group: 'y-duoc',
            why: L(
              'Chất do vi sinh vật tạo ra được dùng làm thuốc chữa và phòng bệnh.',
              'Substances made by microbes are used as medicines to treat and prevent disease.',
            ),
          },
          {
            id: 'insulin',
            text: L(
              'Tạo insulin nhờ vi khuẩn, nấm men được chuyển gene',
              'Making insulin with gene-modified bacteria and yeast',
            ),
            group: 'y-duoc',
            why: L(
              'Vi sinh vật mang gene của người làm ra insulin để chữa bệnh.',
              'Microbes carrying a human gene make insulin used as a medicine.',
            ),
          },
          {
            id: 'nuoc-thai',
            text: L('Bể xử lí nước thải bằng vi sinh vật', 'Wastewater tanks that use microbes'),
            group: 'chat-thai',
            why: L(
              'Vi sinh vật trong bể phân giải chất thải trong nước, làm nước bớt ô nhiễm.',
              'The microbes in the tanks break down the waste in the water, so it pollutes less.',
            ),
          },
          {
            id: 'biogas',
            text: L(
              'Ủ chất thải chăn nuôi để tạo khí biogas',
              'Breaking down farm-animal waste to make biogas',
            ),
            group: 'chat-thai',
            why: L(
              'Vi sinh vật phân giải chất thải trong bể kín, tạo khí đốt và làm môi trường bớt ô nhiễm.',
              'Microbes break down the waste in a closed tank, giving fuel gas and less pollution.',
            ),
          },
        ],
      },
    ],
  },
};
