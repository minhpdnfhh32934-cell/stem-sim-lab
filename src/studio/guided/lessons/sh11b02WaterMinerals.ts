import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 2 "Trao đổi nước và khoáng ở thực vật" (printed pages 9–21), in SimLab's own words.
 * Checked against the pages on 17/11/2026: the three stages of water exchange (hấp thụ ở rễ, vận
 * chuyển trong thân, thoát hơi nước ở lá), the two routes into the root xylem with the Casparian
 * strip, the three forces of the xylem stream (Hình 2.5), the two-way phloem stream, Bảng 2.1
 * (macro- and micronutrients and their roles) and the effects of too little or too much nitrogen
 * (tr. 16). The prediction is built on tr. 16. SH11-GL-2.
 */
export const sh11b02WaterMinerals: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-water',
  topic: 'plantWaterMinerals',
  title: L('Trao đổi nước và khoáng ở thực vật', 'Water and mineral exchange in plants'),
  objectives: [
    L(
      'Dự đoán cây trồng phát triển thế nào khi được bón thừa nitrogen.',
      'Predict how a crop grows when it gets too much nitrogen.',
    ),
    L(
      'Xếp đúng đường đi của nước từ đất qua cây ra khí quyển; ghép các lực và cấu trúc với vai trò của chúng.',
      'Put the path of water from the soil through the plant to the air in order; match the forces and structures with their roles.',
    ),
    L(
      'Phân loại một số nguyên tố khoáng thành đa lượng và vi lượng.',
      'Sort some mineral elements into macronutrients and micronutrients.',
    ),
  ],
  hints: [
    L(
      'Nước luôn đi từ nơi có nồng độ chất tan thấp đến nơi có nồng độ chất tan cao hơn (thẩm thấu).',
      'Water always moves from where solutes are less concentrated to where they are more concentrated (osmosis).',
    ),
    L(
      'Mạch gỗ chở nước và khoáng đi lên một chiều; mạch rây chở chất hữu cơ, có thể theo hai chiều.',
      'Xylem carries water and minerals upward, one way; phloem carries organic matter, in either direction.',
    ),
  ],
  questions: [
    L(
      'Vì sao cần tưới nước và bón phân hợp lí, không nên bón quá ít hay quá nhiều?',
      'Why should a crop be watered and fertilised sensibly, neither too little nor too much?',
    ),
  ],
  expectedConclusion: L(
    'Trao đổi nước ở thực vật gồm ba giai đoạn nối tiếp: rễ hút nước (thẩm thấu vào tế bào lông hút), nước đi qua vỏ rễ vào mạch gỗ rồi lên thân, và thoát hơi nước ở lá, chủ yếu qua khí khổng. Dòng mạch gỗ được đẩy bởi áp suất rễ, kéo bởi thoát hơi nước và giữ liên tục nhờ lực liên kết; dòng mạch rây chở sucrose từ cơ quan nguồn đến cơ quan đích. Cây cần nguyên tố đa lượng và vi lượng; thiếu hay thừa khoáng đều làm cây phát triển kém, nên phải bón phân đúng loại, đúng liều lượng, đúng thời điểm và đúng cách.',
    'Water exchange in plants has three linked stages: roots take up water (by osmosis into root-hair cells), water crosses the root cortex into the xylem and rises through the stem, and leaves lose water by transpiration, mostly through stomata. Root pressure pushes the xylem stream, transpiration pulls it and cohesion keeps it continuous; the phloem stream carries sucrose from source organs to sink organs. Plants need macro- and micronutrients; too little or too much harms them, so fertiliser must be the right kind, in the right amount, at the right time and in the right way.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu cơ chế và vai trò như sách giáo khoa; SimLab không tính lượng nước hay lượng khoáng nào.',
      'The lesson gives only the mechanisms and roles, as the textbook does; SimLab computes no amount of water or minerals.',
    ),
  ],
  limits: [
    L(
      'Các bảng số liệu của sách (ảnh hưởng của nhiệt độ đến hấp thụ khoáng, lượng phân bón cho cây mía) không có trong bài học này.',
      'The book’s data tables (temperature and mineral uptake, fertiliser for sugar cane) are not part of this lesson.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 2 },
    question: L(
      'Nitrogen là thành phần của protein, nucleic acid, diệp lục. Nếu bón quá nhiều phân đạm (nitrogen) cho lúa, cây sẽ thế nào?',
      'Nitrogen is part of proteins, nucleic acids and chlorophyll. If rice gets far too much nitrogen fertiliser, how does it grow?',
    ),
    choices: [
      {
        id: 'yeu-do',
        text: L(
          'Thân lá phát triển mạnh nhưng cây yếu, dễ đổ, dễ mắc sâu bệnh',
          'Stems and leaves grow fast, but the plant is weak, falls over easily and catches pests',
        ),
      },
      {
        id: 'la-vang',
        text: L('Lá vàng, cây sinh trưởng chậm', 'Leaves turn yellow and the plant grows slowly'),
      },
      {
        id: 'tot-hon',
        text: L(
          'Càng nhiều phân, năng suất càng cao mãi',
          'The more fertiliser, the higher the yield, without limit',
        ),
      },
      { id: 'khong-doi', text: L('Không có gì thay đổi', 'Nothing changes') },
    ],
    answer: 'yeu-do',
    answerWhy: L(
      'Thừa nitrogen làm thân và lá phát triển mạnh nhưng cây yếu, dễ đổ và dễ mắc sâu bệnh. Lá vàng, sinh trưởng chậm là dấu hiệu thiếu nitrogen. Bón quá nhiều phân còn gây độc cho cây, làm ô nhiễm đất và nước, nên năng suất không tăng mãi.',
      'Too much nitrogen makes stems and leaves grow fast, but the plant is weak, falls over easily and catches pests. Yellow leaves and slow growth are signs of too little nitrogen. Far too much fertiliser also poisons the plant and pollutes soil and water, so the yield does not keep rising.',
    ),
    activities: [
      {
        kind: 'order',
        id: 'duong-nuoc',
        prompt: L(
          'Xếp đường đi của nước trong cây theo đúng thứ tự.',
          'Put the path of water through the plant in order.',
        ),
        items: [
          {
            id: 'long-hut',
            text: L(
              'Nước từ đất thẩm thấu vào tế bào lông hút của rễ',
              'Water passes from the soil into the root-hair cells by osmosis',
            ),
            why: L(
              'Dịch tế bào lông hút có nồng độ chất tan cao hơn dịch đất nên nước đi vào rễ.',
              'The root-hair cell sap holds more solute than the soil water, so water moves into the root.',
            ),
          },
          {
            id: 'vo-re',
            text: L(
              'Nước đi qua các lớp tế bào của vỏ rễ, theo con đường gian bào hoặc tế bào chất',
              'Water crosses the cell layers of the root cortex, between the cells or through them',
            ),
            why: L(
              'Ở nội bì, đai Caspary buộc nước đi qua tế bào chất, nhờ đó cây kiểm soát được khoáng đi vào.',
              'At the endodermis the Casparian strip forces water through the cells, so the plant controls which minerals enter.',
            ),
          },
          {
            id: 'mach-go',
            text: L(
              'Nước vào mạch gỗ của rễ rồi theo mạch gỗ đi lên thân',
              'Water enters the root xylem and rises through the stem in the xylem',
            ),
            why: L(
              'Mạch gỗ gồm quản bào và mạch ống nối thành ống dẫn liên tục.',
              'The xylem is made of tracheids and vessels joined into continuous tubes.',
            ),
          },
          {
            id: 'thoat-hoi',
            text: L(
              'Nước đến lá và thoát hơi ra khí quyển, chủ yếu qua khí khổng',
              'Water reaches the leaves and evaporates into the air, mostly through the stomata',
            ),
            why: L(
              'Phần lớn nước cây hút vào mất đi qua thoát hơi nước; thoát hơi nước tạo lực kéo nước lên.',
              'Most of the water a plant takes up is lost by transpiration, which pulls water upward.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'luc-cau-truc',
        prompt: L(
          'Ghép mỗi lực hoặc cấu trúc với vai trò của nó.',
          'Match each force or structure with its role.',
        ),
        pairs: [
          {
            id: 'ap-suat-re',
            left: L('Áp suất rễ', 'Root pressure'),
            right: L(
              'Đẩy nước từ rễ lên; thấy ở hiện tượng rỉ nhựa và ứ giọt',
              'Pushes water up from the root; seen as sap oozing and guttation drops',
            ),
            why: L(
              'Khi cắt ngang thân hay khi không khí rất ẩm, nước vẫn được đẩy lên từ rễ.',
              'When a stem is cut or the air is very humid, water is still pushed up from the root.',
            ),
          },
          {
            id: 'luc-keo',
            left: L('Thoát hơi nước ở lá', 'Transpiration in the leaves'),
            right: L('Tạo lực kéo nước lên phía trên', 'Pulls water upward'),
            why: L(
              'Nước bay hơi ở lá kéo cột nước trong mạch gỗ đi lên.',
              'Water evaporating from the leaves pulls the water column in the xylem upward.',
            ),
          },
          {
            id: 'lien-ket',
            left: L(
              'Lực liên kết giữa các phân tử nước và với thành mạch',
              'Cohesion of water molecules and adhesion to the vessel walls',
            ),
            right: L(
              'Giữ cho dòng nước trong mạch gỗ liên tục',
              'Keeps the water stream in the xylem unbroken',
            ),
            why: L(
              'Nhờ đó dòng mạch gỗ lên được độ cao hàng trăm mét như ở cây gỗ lớn.',
              'This lets the xylem stream reach the height of tall trees.',
            ),
          },
          {
            id: 'caspary',
            left: L('Đai Caspary', 'Casparian strip'),
            right: L(
              'Không thấm nước, buộc nước và khoáng đi qua tế bào nội bì',
              'Waterproof, it forces water and minerals through the endodermis cells',
            ),
            why: L(
              'Nhờ vậy cây kiểm soát được lượng khoáng đi vào mạch gỗ.',
              'This lets the plant control the minerals that enter the xylem.',
            ),
          },
          {
            id: 'mach-ray',
            left: L('Mạch rây', 'Phloem'),
            right: L(
              'Chở sucrose từ lá đến nơi dự trữ hoặc nơi sử dụng, theo hai chiều',
              'Carries sucrose from leaves to storage or use sites, in either direction',
            ),
            why: L(
              'Dịch mạch rây đi từ cơ quan nguồn đến cơ quan đích, xuôi chiều chênh lệch nồng độ.',
              'Phloem sap moves from source organs to sink organs, down the concentration difference.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'khoang',
        prompt: L(
          'Xếp mỗi nguyên tố khoáng vào nhóm đa lượng hoặc vi lượng.',
          'Put each mineral element under macronutrient or micronutrient.',
        ),
        groups: [
          { id: 'da', label: L('Nguyên tố đa lượng', 'Macronutrient') },
          { id: 'vi', label: L('Nguyên tố vi lượng', 'Micronutrient') },
        ],
        items: [
          {
            id: 'nitrogen',
            text: L(
              'Nitrogen: thành phần của nhiều hợp chất hữu cơ',
              'Nitrogen: part of many organic compounds',
            ),
            group: 'da',
            why: L('Cây hấp thụ ở dạng NO₃⁻ và NH₄⁺.', 'Plants take it up as NO₃⁻ and NH₄⁺.'),
          },
          {
            id: 'potassium',
            text: L(
              'Potassium: điều tiết áp suất thẩm thấu, thúc đẩy vận chuyển sản phẩm quang hợp',
              'Potassium: regulates osmotic pressure, speeds the transport of photosynthesis products',
            ),
            group: 'da',
            why: L('Cây hấp thụ ở dạng K⁺.', 'Plants take it up as K⁺.'),
          },
          {
            id: 'magnesium',
            text: L('Magnesium: thành phần của diệp lục', 'Magnesium: part of chlorophyll'),
            group: 'da',
            why: L('Cây hấp thụ ở dạng Mg²⁺.', 'Plants take it up as Mg²⁺.'),
          },
          {
            id: 'phosphorus',
            text: L(
              'Phosphorus: thành phần của nucleic acid, phospholipid, ATP',
              'Phosphorus: part of nucleic acids, phospholipids, ATP',
            ),
            group: 'da',
            why: L('Cây hấp thụ ở dạng ion phosphate.', 'Plants take it up as phosphate ions.'),
          },
          {
            id: 'iron',
            text: L(
              'Iron: thành phần của cytochrome, hoạt hóa enzyme tổng hợp diệp lục',
              'Iron: part of cytochromes, activates the enzymes that make chlorophyll',
            ),
            group: 'vi',
            why: L(
              'Cây cần rất ít nhưng không thể thiếu.',
              'Plants need very little, but cannot do without it.',
            ),
          },
          {
            id: 'zinc',
            text: L(
              'Zinc: tham gia hình thành diệp lục, hoạt hóa enzyme quang hợp, hô hấp',
              'Zinc: helps form chlorophyll, activates enzymes of photosynthesis and respiration',
            ),
            group: 'vi',
            why: L('Cây hấp thụ ở dạng Zn²⁺.', 'Plants take it up as Zn²⁺.'),
          },
          {
            id: 'molybdenum',
            text: L(
              'Molybdenum: tham gia dinh dưỡng nitrogen như cố định N₂, khử nitrate',
              'Molybdenum: takes part in nitrogen nutrition, such as fixing N₂ and reducing nitrate',
            ),
            group: 'vi',
            why: L(
              'Một nguyên tố vi lượng trong bảng của sách.',
              'A micronutrient in the book’s table.',
            ),
          },
          {
            id: 'chlorine',
            text: L(
              'Chlorine: tham gia quang phân li nước, cân bằng nước trong cây',
              'Chlorine: takes part in splitting water by light and in the plant’s water balance',
            ),
            group: 'vi',
            why: L('Cây hấp thụ ở dạng Cl⁻.', 'Plants take it up as Cl⁻.'),
          },
        ],
      },
    ],
  },
};
