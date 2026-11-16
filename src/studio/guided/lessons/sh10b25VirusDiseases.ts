import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH10 KNTT Bài 25 "Một số bệnh do virus và các thành tựu nghiên cứu ứng dụng virus" (printed
 * pages 145–154), in SimLab's own words. Checked against the pages on 16/11/2026: HIV's three
 * routes (blood, sex, mother to child, p. 148: the book names the placenta and breast milk; the
 * WHO fact sheet adds delivery, cited as a second source), flu by droplets and secretions
 * (p. 150), plant viruses spread horizontally (insects such as the brown planthopper with rice stripe virus, tools,
 * rubbing leaves) and vertically (sexual or asexual reproduction, p. 151), and the uses of part III
 * (vaccines, virus insecticides, vectors, gene therapy, phages against bacteria). Only diseases the
 * lesson names. Textbook level, not medical advice. The book names the brown planthopper (rầy nâu)
 * as the rice stripe virus's vector; plant-virology papers name the small brown planthopper,
 * Laodelphax striatellus (He et al., Sci. Rep. 6, 21376, 2016): the lesson keeps the book's word and
 * a limit names the other source, as the "follow the textbook" rule asks. SH10-GL-8.
 */
export const sh10b25VirusDiseases: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh10-virus-diseases',
  topic: 'virusDiseases',
  title: L(
    'Bệnh do virus: lây thế nào, phòng ra sao, và virus giúp ích gì?',
    'Virus diseases: how they spread, how to prevent them, and how viruses help us',
  ),
  objectives: [
    L(
      'Dự đoán virus cúm lây từ người này sang người khác bằng cách nào.',
      'Predict how the flu virus passes from one person to another.',
    ),
    L(
      'Ghép mỗi bệnh do virus với con đường lây chính của nó.',
      'Match each virus disease with its main route of spread.',
    ),
    L(
      'Phân biệt virus thực vật truyền theo hàng ngang và theo hàng dọc.',
      'Tell apart plant viruses spreading horizontally and vertically.',
    ),
    L(
      'Ghép mỗi thành tựu với cách con người dùng virus.',
      'Match each achievement with the way people use viruses.',
    ),
  ],
  hints: [
    L(
      'Để ý con đường lây quyết định cách phòng: bệnh lây qua giọt bắn thì đeo khẩu trang, bệnh lây qua máu thì không dùng chung kim tiêm.',
      'Notice that the route decides the prevention: for droplets wear a mask, for blood never share needles.',
    ),
    L(
      'Truyền theo hàng dọc là đi từ cây mẹ sang cây con; hàng ngang là từ cây này sang cây khác.',
      'Vertical spread goes from a parent plant to its young; horizontal spread goes from one plant to another.',
    ),
  ],
  questions: [
    L(
      'Vì sao biết con đường lây của một bệnh giúp ta phòng bệnh tốt hơn?',
      'Why does knowing how a disease spreads help us prevent it?',
    ),
    L(
      'Vì sao thuốc trừ sâu từ virus được xem là tốt hơn thuốc hóa học ở một số mặt?',
      'Why are virus insecticides seen as better than chemical ones in some ways?',
    ),
  ],
  expectedConclusion: L(
    'Mỗi bệnh do virus lây theo những con đường riêng: HIV qua máu, quan hệ tình dục và từ mẹ sang con; virus cúm qua giọt dịch khi hắt hơi và dịch tiết; virus thực vật truyền ngang từ cây này sang cây khác (côn trùng, dụng cụ, vết thương) hoặc truyền dọc từ cây mẹ sang cây con. Biết con đường lây thì biết cách phòng. Con người còn dùng virus để làm vaccine, thuốc trừ sâu, vector chuyển gene và liệu pháp gene.',
    'Each virus disease spreads by its own routes: HIV through blood, sex and from mother to child; the flu virus through droplets from sneezes and body fluids; plant viruses horizontally from plant to plant (insects, tools, wounds) or vertically from parent plant to young plant. Knowing the route tells us how to prevent it. People also use viruses to make vaccines, insecticides, gene vectors and gene therapy.',
  ),
  sources: [
    {
      id: 'who-hiv-aids',
      citation:
        'World Health Organization — HIV and AIDS, fact sheet, 27 July 2026: “HIV can also be transmitted to a child during pregnancy and delivery.” (mẹ truyền HIV cho con cả khi sinh)',
      url: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
    },
    {
      id: 'he-2016-rsv-sbph',
      citation:
        'D.-C. He, J. Zhan, Z.-B. Cheng, L.-H. Xie — Viruliferous rate of small brown planthopper is a good indicator of rice stripe disease epidemics, Scientific Reports 6 (2016) 21376 (vector của virus sọc lá lúa: rầy nâu nhỏ Laodelphax striatellus)',
      url: 'https://doi.org/10.1038/srep21376',
    },
  ],
  assumptions: [
    L(
      'Chỉ dùng các bệnh và ví dụ mà bài học trong sách nêu.',
      'Only the diseases and examples the textbook lesson gives are used.',
    ),
  ],
  limits: [
    L(
      'Nội dung ở mức sách giáo khoa, không phải lời khuyên y tế. Khi lo lắng về sức khỏe, hãy hỏi bác sĩ hoặc nhân viên y tế.',
      'Textbook-level content, not medical advice. If you are worried about your health, ask a doctor or a health worker.',
    ),
    L(
      'Bài ghi rầy nâu truyền virus sọc lá lúa, đúng như sách giáo khoa. Tài liệu chuyên ngành về bệnh cây ghi loài truyền virus này là rầy nâu nhỏ (Laodelphax striatellus), một loài khác với rầy nâu; nguồn ở mục Nguồn.',
      'The lesson says brown planthoppers spread rice stripe virus, as the textbook does. Plant-disease research names the small brown planthopper (Laodelphax striatellus), a different species, as this virus’s carrier; see Sources.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH10', lesson: 25 },
    question: L(
      'Một bạn bị cúm hắt hơi trong lớp. Theo em, virus cúm dễ lây sang người khác nhất bằng cách nào?',
      'A classmate with flu sneezes in class. How do you think the flu virus most easily reaches other people?',
    ),
    choices: [
      {
        id: 'giot-dich',
        text: L(
          'Qua các giọt dịch bắn ra khi hắt hơi, ho',
          'Through the droplets sprayed out by sneezing and coughing',
        ),
      },
      { id: 'mau', text: L('Chỉ qua đường máu', 'Only through blood') },
      {
        id: 'con-trung',
        text: L('Qua côn trùng chích hút', 'Through sap- or blood-sucking insects'),
      },
    ],
    answer: 'giot-dich',
    answerWhy: L(
      'Virus cúm sống ở niêm mạc đường hô hấp, nên lây qua giọt dịch khi hắt hơi, dịch tiết và các bề mặt dính dịch tiết. Vì vậy nên đeo khẩu trang và rửa tay thường xuyên. Đường máu là con đường lây của HIV; côn trùng chích hút là cách lây của nhiều virus thực vật.',
      'The flu virus lives in the lining of the airways, so it spreads through droplets from sneezes, body fluids and surfaces with those fluids on them. That is why masks and frequent hand-washing help. Blood is a route of HIV; sucking insects spread many plant viruses.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'duong-lay',
        prompt: L(
          'Ghép mỗi bệnh do virus với con đường lây chính của nó.',
          'Match each virus disease with its main route of spread.',
        ),
        pairs: [
          {
            id: 'aids',
            left: L('AIDS (do HIV)', 'AIDS (caused by HIV)'),
            right: L(
              'Qua đường máu, quan hệ tình dục và từ mẹ sang con',
              'Through blood, sex and from mother to child',
            ),
            why: L(
              'HIV lây khi máu hay dịch tiết của người nhiễm vào cơ thể, kể cả khi dùng chung kim tiêm. Mẹ nhiễm HIV có thể truyền cho con qua nhau thai và qua sữa mẹ, như sách viết; Tổ chức Y tế Thế giới ghi thêm: cả khi sinh.',
              'HIV spreads when blood or body fluids of an infected person enter the body, including shared needles. An infected mother can pass it to her baby through the placenta and breast milk, as the book says; the World Health Organization adds: also during delivery.',
            ),
          },
          {
            id: 'cum',
            left: L('Cúm', 'Flu'),
            right: L(
              'Qua giọt dịch khi hắt hơi, dịch tiết và bề mặt dính dịch tiết',
              'Through droplets from sneezes, body fluids and surfaces with those fluids on them',
            ),
            why: L(
              'Virus cúm nhân lên ở niêm mạc đường hô hấp nên theo giọt bắn ra ngoài và vào người khác.',
              'The flu virus multiplies in the lining of the airways, so it leaves in droplets and enters other people.',
            ),
          },
          {
            id: 'soc-la-lua',
            left: L('Bệnh sọc lá lúa', 'Rice stripe disease'),
            right: L(
              'Do rầy nâu chích hút nhựa cây bệnh rồi truyền sang cây lúa lành',
              'Brown planthoppers suck sap from a sick plant, then pass the virus to healthy rice',
            ),
            why: L(
              'Côn trùng chích hút làm tổn thương thành tế bào cây, mở đường cho virus vào cây lành. Tài liệu chuyên ngành ghi loài truyền virus này là rầy nâu nhỏ, một loài khác với rầy nâu; xem Thẻ Khoa học.',
              'Sucking insects damage the plant cell wall, opening a way for the virus into the healthy plant. Plant-disease research names a different species, the small brown planthopper, as this virus’s carrier; see the Science Card.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'ngang-doc',
        prompt: L(
          'Virus thực vật lan theo hàng ngang hay hàng dọc? Xếp mỗi trường hợp vào đúng nhóm.',
          'Does a plant virus spread horizontally or vertically? Put each case in the right group.',
        ),
        groups: [
          {
            id: 'ngang',
            label: L(
              'Truyền theo hàng ngang (từ cây này sang cây khác)',
              'Horizontal (from one plant to another)',
            ),
          },
          {
            id: 'doc',
            label: L(
              'Truyền theo hàng dọc (từ cây mẹ sang cây con)',
              'Vertical (from parent plant to young plant)',
            ),
          },
        ],
        items: [
          {
            id: 'ray-nau',
            text: L(
              'Rầy nâu hút nhựa cây lúa bệnh rồi hút cây lúa lành',
              'A brown planthopper feeds on a sick rice plant, then on a healthy one',
            ),
            group: 'ngang',
            why: L(
              'Virus đi từ cây bệnh sang một cây khác nhờ côn trùng.',
              'The virus goes from the sick plant to another plant, carried by the insect.',
            ),
          },
          {
            id: 'dung-cu',
            text: L(
              'Kéo cắt tỉa cây bệnh rồi cắt tiếp cây lành',
              'Pruning shears cut a sick plant, then a healthy one',
            ),
            group: 'ngang',
            why: L(
              'Dụng cụ dính nhựa cây bệnh mang virus vào vết cắt của cây khác.',
              'The tool carries sap from the sick plant into the cut of another plant.',
            ),
          },
          {
            id: 'co-xat',
            text: L(
              'Lá cây bệnh cọ xát, làm giập lá cây bên cạnh',
              'Leaves of a sick plant rub against and bruise the leaves next to it',
            ),
            group: 'ngang',
            why: L(
              'Virus đi qua chỗ tổn thương sang cây bên cạnh.',
              'The virus passes through the wound into the plant next to it.',
            ),
          },
          {
            id: 'an-la',
            text: L(
              'Côn trùng ăn lá cây bệnh rồi ăn lá cây lành',
              'An insect eats leaves of a sick plant, then of a healthy one',
            ),
            group: 'ngang',
            why: L(
              'Côn trùng ăn lá cũng có thể mang virus từ cây này sang cây khác.',
              'Leaf-eating insects can also carry the virus from one plant to another.',
            ),
          },
          {
            id: 'hat',
            text: L(
              'Cây con mọc từ hạt của cây mẹ bị bệnh',
              'A young plant grows from a seed of a sick parent plant',
            ),
            group: 'doc',
            why: L(
              'Virus đi theo con đường sinh sản hữu tính từ cây mẹ sang cây con.',
              'The virus follows sexual reproduction from the parent plant to the young one.',
            ),
          },
          {
            id: 'giam-canh',
            text: L(
              'Cây con giâm từ cành của cây mẹ bị bệnh',
              'A young plant grown from a cutting of a sick parent plant',
            ),
            group: 'doc',
            why: L(
              'Virus đi theo con đường sinh sản vô tính từ cây mẹ sang cây con.',
              'The virus follows asexual reproduction from the parent plant to the young one.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'ung-dung',
        prompt: L(
          'Ghép mỗi thành tựu với cách con người dùng virus.',
          'Match each achievement with the way people use viruses.',
        ),
        pairs: [
          {
            id: 'vaccine',
            left: L('Vaccine', 'Vaccines'),
            right: L(
              'Một cách làm vaccine: biến đổi chủng virus gây bệnh rồi tiêm để cơ thể tạo kháng thể',
              'One way to make a vaccine: change a disease-causing strain of the virus, then inject it so the body makes antibodies',
            ),
            why: L(
              'Khi gặp virus thật, cơ thể đã có kháng thể nên chống lại nhanh hơn.',
              'When the real virus comes, the body already has antibodies and fights back faster.',
            ),
          },
          {
            id: 'tru-sau',
            left: L('Thuốc trừ sâu từ virus', 'Virus insecticides'),
            right: L(
              'Virus làm chết loài sâu hại nhưng không hại côn trùng có ích',
              'A virus kills the pest insect but not useful insects',
            ),
            why: L(
              'Virus chỉ tấn công đúng loài sâu hại, nên ưu việt hơn hóa chất diệt côn trùng.',
              'The virus attacks only that pest, so it is better than chemical insect killers.',
            ),
          },
          {
            id: 'vector',
            left: L('Vector trong công nghệ di truyền', 'Vectors in genetic engineering'),
            right: L(
              'Bỏ gene có hại của virus, gắn gene có lợi rồi đưa vào tế bào để tạo giống mới',
              'Remove the virus’s harmful genes, add a useful gene and put it into cells to make new varieties',
            ),
            why: L(
              'Một số virus có thể cài hệ gene của chúng vào hệ gene của tế bào chủ, nên được dùng làm vector mang gene có lợi vào tế bào.',
              'Some viruses can insert their genome into the host cell’s genome, so they are used as vectors that carry a useful gene into the cell.',
            ),
          },
          {
            id: 'lieu-phap',
            left: L('Liệu pháp gene', 'Gene therapy'),
            right: L(
              'Virus đưa gene lành vào tế bào của người bệnh thay cho gene bệnh',
              'A virus carries a healthy gene into a patient’s cells in place of a faulty gene',
            ),
            why: L(
              'Tế bào mang gene lành được nhân lên rồi đưa trở lại cơ thể người bệnh.',
              'Cells with the healthy gene are multiplied and put back into the patient’s body.',
            ),
          },
          {
            id: 'thuc-khuan',
            left: L('Dùng thể thực khuẩn', 'Using bacteriophages'),
            right: L(
              'Virus của vi khuẩn tiêu diệt vi khuẩn gây bệnh hoặc làm hỏng rau quả',
              'Viruses of bacteria kill bacteria that cause disease or spoil fruit and vegetables',
            ),
            why: L(
              'Khi nhiều vi khuẩn kháng thuốc kháng sinh, cách dùng thể thực khuẩn lại được quan tâm.',
              'With more and more bacteria resisting antibiotics, phages are getting attention again.',
            ),
          },
        ],
      },
    ],
  },
};
