import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 25 "Sinh sản ở thực vật" (printed pages 159–166), in SimLab's own words. Checked
 * against the pages on 17/11/2026: natural vegetative reproduction (Hình 25.1: khoai tây, gừng,
 * hành, thuốc bỏng, rau má), spores (rêu, dương xỉ), the artificial methods (giâm cành: sắn, mía,
 * hoa hồng; chiết cành: nhãn, vải, ổi, bưởi, cam; ghép: cam, chanh trên gốc bưởi; in vitro, Hình
 * 25.6), the flower's parts (Hình 25.7) and the three stages of sexual reproduction. SH11-GL-18.
 */
export const sh11b25PlantReproduction: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-plantrepro',
  topic: 'plantReproduction',
  title: L('Sinh sản ở thực vật', 'Reproduction in plants'),
  objectives: [
    L(
      'Dự đoán đặc điểm của cây con mọc từ cành chiết.',
      'Predict the features of a plant grown from an air-layered branch.',
    ),
    L(
      'Xếp đúng các bước nhân giống in vitro; ghép mỗi phương pháp nhân giống vô tính với đặc điểm của nó.',
      'Put the steps of in vitro propagation in order; match each method of asexual propagation with its features.',
    ),
    L(
      'Ghép các bộ phận của hoa với vai trò của chúng.',
      'Match the parts of a flower with their roles.',
    ),
  ],
  hints: [
    L(
      'Nhân giống vô tính tạo cây con mang đặc điểm của cây mẹ, vì không có giảm phân và thụ tinh.',
      'Asexual propagation gives plants with the parent’s features, because there is no meiosis or fertilisation.',
    ),
    L(
      'Sinh sản hữu tính ở thực vật có hoa gồm: hình thành hạt phấn và túi phôi; thụ phấn và thụ tinh; hình thành hạt và quả.',
      'Sexual reproduction in flowering plants has three stages: pollen and embryo sac form; pollination and fertilisation; seeds and fruit form.',
    ),
  ],
  questions: [
    L(
      'Để bảo tồn những cây trồng quý hiếm có nguy cơ tuyệt chủng nên dùng phương pháp nhân giống nào? Vì sao?',
      'Which propagation method suits rare, endangered crop plants? Why?',
    ),
  ],
  expectedConclusion: L(
    'Thực vật sinh sản vô tính bằng sinh sản sinh dưỡng (từ củ, thân, rễ, lá) hoặc bằng bào tử; con người nhân giống vô tính bằng giâm cành, chiết cành, ghép và nuôi cấy in vitro, tạo cây con giữ đặc điểm tốt của cây mẹ. Nhân giống in vitro có hệ số nhân giống cao, tiến hành quanh năm, tạo cây sạch bệnh. Hoa gồm bộ phận bất thụ (lá đài, cánh hoa) và bộ phận sinh sản (nhị, nhụy). Sinh sản hữu tính ở thực vật có hoa gồm hình thành hạt phấn và túi phôi, thụ phấn và thụ tinh, hình thành hạt và quả.',
    'Plants reproduce asexually by vegetative reproduction (from tubers, stems, roots, leaves) or by spores; people propagate them by cuttings, air layering, grafting and in vitro culture, keeping the parent’s good features. In vitro propagation multiplies plants fast, all year, and gives disease-free plants. A flower has sterile parts (sepals, petals) and reproductive parts (stamens, pistil). Sexual reproduction in flowering plants is: pollen and embryo sac form, pollination and fertilisation, seeds and fruit form.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các phương pháp và quá trình như sách giáo khoa.',
      'The lesson gives only the methods and processes, as the textbook does.',
    ),
  ],
  limits: [
    L(
      'Chi tiết giảm phân, nguyên phân hình thành hạt phấn, túi phôi và thụ tinh kép không có trong bài học này.',
      'The details of the divisions that form pollen and the embryo sac, and double fertilisation, are not part of this lesson.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 25 },
    question: L(
      'Người ta chiết một cành bưởi cho quả ngon rồi đem trồng. Cây mọc từ cành chiết sẽ cho quả thế nào?',
      'A branch of a pomelo tree with good fruit is air-layered and planted. What fruit will the new tree give?',
    ),
    choices: [
      { id: 'giong-me', text: L('Giống cây mẹ', 'Like the parent tree') },
      { id: 'khac-me', text: L('Khác hẳn cây mẹ', 'Quite unlike the parent tree') },
      { id: 'kem-hon', text: L('Luôn kém hơn cây mẹ', 'Always worse than the parent tree') },
      { id: 'khong-qua', text: L('Không bao giờ ra quả', 'It never fruits') },
    ],
    answer: 'giong-me',
    answerWhy: L(
      'Chiết cành là nhân giống vô tính: cành chiết ra rễ rồi thành cây mới, không có giảm phân và thụ tinh, nên cây con giữ các đặc điểm của cây mẹ, như quả ngon.',
      'Air layering is asexual propagation: the branch grows roots and becomes a new tree with no meiosis or fertilisation, so it keeps the parent’s features, such as good fruit.',
    ),
    activities: [
      {
        kind: 'order',
        id: 'in-vitro',
        prompt: L(
          'Xếp các bước nhân giống in vitro theo đúng thứ tự.',
          'Put the steps of in vitro propagation in order.',
        ),
        items: [
          {
            id: 'chon',
            text: L('Chọn vật liệu nuôi cấy', 'Choose the material to culture'),
            why: L(
              'Có thể là mô lá, thân, rễ, đỉnh sinh trưởng, hạt phấn.',
              'It can be leaf, stem or root tissue, a growing tip or pollen.',
            ),
          },
          {
            id: 'khu-trung',
            text: L('Khử trùng vật liệu', 'Sterilise the material'),
            why: L('Bằng hóa chất và tác nhân vật lí.', 'With chemicals and physical agents.'),
          },
          {
            id: 'tao-choi',
            text: L('Nuôi cấy tạo chồi', 'Culture it to form shoots'),
            why: L(
              'Môi trường có chất kích thích tạo chồi.',
              'The medium contains a shoot-forming stimulant.',
            ),
          },
          {
            id: 'ra-re',
            text: L('Ra rễ, tạo cây hoàn chỉnh', 'Grow roots to make whole plants'),
            why: L(
              'Chồi đạt chuẩn được chuyển sang môi trường kích thích ra rễ.',
              'Good shoots move to a root-forming medium.',
            ),
          },
          {
            id: 'trong',
            text: L('Trồng cây trong vườn ươm', 'Plant them in a nursery'),
            why: L(
              'Cây con thích ứng dần với điều kiện tự nhiên.',
              'The young plants gradually adapt to natural conditions.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'phuong-phap',
        prompt: L(
          'Ghép mỗi phương pháp nhân giống với đặc điểm của nó.',
          'Match each propagation method with its features.',
        ),
        pairs: [
          {
            id: 'giam',
            left: L('Giâm cành', 'Cuttings'),
            right: L(
              'Dùng đoạn cành bánh tẻ tạo cây hoàn chỉnh, ví dụ sắn, mía, hoa hồng',
              'A semi-mature stem piece grows into a whole plant, as in cassava, sugar cane, roses',
            ),
            why: L(
              'Tạo nhiều cây con đồng đều trong thời gian ngắn.',
              'It makes many uniform plants quickly.',
            ),
          },
          {
            id: 'chiet',
            left: L('Chiết cành', 'Air layering'),
            right: L(
              'Cho cành ra rễ ngay trên cây mẹ rồi mới cắt đem trồng, ví dụ nhãn, vải, bưởi',
              'The branch roots while still on the parent, then is cut and planted, as in longan, lychee, pomelo',
            ),
            why: L(
              'Tỉ lệ sống cao nhưng hệ số nhân giống thấp.',
              'High survival but few plants per parent.',
            ),
          },
          {
            id: 'ghep',
            left: L('Ghép', 'Grafting'),
            right: L(
              'Ghép cành hoặc mắt lên gốc cây khác, ví dụ cam, chanh trên gốc bưởi',
              'A branch or bud is joined onto another rootstock, as in orange or lemon on pomelo',
            ),
            why: L(
              'Kết hợp đặc tính tốt của cành ghép và gốc ghép.',
              'It combines the good features of scion and rootstock.',
            ),
          },
          {
            id: 'in-vitro',
            left: L('Nhân giống in vitro', 'In vitro propagation'),
            right: L(
              'Nuôi cấy mô, tế bào; hệ số nhân giống cao, cây sạch bệnh',
              'Tissue and cell culture; very many plants, disease-free',
            ),
            why: L(
              'Tiến hành được quanh năm, bảo quản giống lâu dài.',
              'It works all year and keeps stocks for a long time.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'hoa',
        prompt: L(
          'Ghép mỗi bộ phận của hoa với vai trò của nó.',
          'Match each part of a flower with its role.',
        ),
        pairs: [
          {
            id: 'la-dai',
            left: L('Lá đài', 'Sepals'),
            right: L(
              'Bao bọc, che chở chồi hoa trước khi hoa nở',
              'Wrap and protect the flower bud before it opens',
            ),
            why: L('Thường có màu lục.', 'Usually green.'),
          },
          {
            id: 'canh-hoa',
            left: L('Cánh hoa', 'Petals'),
            right: L(
              'Màu sắc sặc sỡ, thu hút côn trùng thụ phấn',
              'Bright colours that attract pollinating insects',
            ),
            why: L(
              'Lá đài và cánh hoa là bộ phận bất thụ.',
              'Sepals and petals are the sterile parts.',
            ),
          },
          {
            id: 'nhi',
            left: L('Nhị', 'Stamen'),
            right: L('Bao phấn sinh ra hạt phấn', 'Its anther makes the pollen'),
            why: L('Gồm chỉ nhị và bao phấn.', 'Made of a filament and an anther.'),
          },
          {
            id: 'nhuy',
            left: L('Nhụy', 'Pistil'),
            right: L(
              'Bầu nhụy chứa noãn, nơi hình thành túi phôi',
              'Its ovary holds the ovules, where the embryo sac forms',
            ),
            why: L('Gồm núm nhụy, vòi nhụy, bầu nhụy.', 'Made of stigma, style and ovary.'),
          },
        ],
      },
    ],
  },
};
