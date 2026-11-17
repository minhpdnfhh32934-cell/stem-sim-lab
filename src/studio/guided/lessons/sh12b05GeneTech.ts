import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH12 KNTT Bài 5 "Công nghệ gene" (printed pages 27–31), in SimLab's own words. Checked against
 * the pages on 17/11/2026: recombinant DNA, its principle and Hình 5.1 (restriction enzymes,
 * plasmid vector, ligase), human insulin made by bacteria (tr. 28), genetically modified animals
 * (Hình 5.2) and plants (gene gun), golden rice, Bt cotton, antithrombin sheep, fast-growing
 * salmon, and the concerns (tr. 30). SH12-GL-2.
 */
export const sh12b05GeneTech: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'biology',
  id: 'guided.sh12-gene-technology',
  topic: 'geneTechnology',
  title: L('Công nghệ gene', 'Gene technology'),
  objectives: [
    L(
      'Dự đoán vi khuẩn mang gene insulin của người sẽ tạo ra sản phẩm gì.',
      'Predict what bacteria carrying the human insulin gene make.',
    ),
    L(
      'Sắp xếp các bước tạo DNA tái tổ hợp; ghép mỗi sinh vật biến đổi gene với gene được chuyển.',
      'Put the steps of making recombinant DNA in order; match each modified organism with its gene.',
    ),
    L(
      'Phân biệt cách tạo động vật và thực vật biến đổi gene.',
      'Tell how modified animals and plants are made.',
    ),
  ],
  hints: [
    L(
      'DNA tái tổ hợp gồm gene cần chuyển gắn vào một vector (thường là plasmid).',
      'Recombinant DNA is the gene joined into a vector (usually a plasmid).',
    ),
    L(
      'Enzyme cắt giới hạn cắt DNA, enzyme ligase nối các đoạn DNA lại.',
      'Restriction enzymes cut DNA; ligase joins the pieces.',
    ),
  ],
  questions: [
    L(
      'Vì sao nhiều nước yêu cầu ghi rõ trên bao bì sản phẩm là thực phẩm biến đổi gene?',
      'Why do many countries require genetically modified food to be labelled?',
    ),
  ],
  expectedConclusion: L(
    'Công nghệ DNA tái tổ hợp tạo phân tử DNA từ hai nguồn khác nhau (thường từ hai loài) rồi chuyển vào tế bào nhận để tạo ra nhiều sản phẩm protein của gene chuyển. Gene cần chuyển và vector được cắt bằng enzyme cắt giới hạn, nối bằng enzyme ligase rồi đưa vào tế bào nhận. Tạo động vật biến đổi gene cần thêm công nghệ thụ tinh nhân tạo (tiêm gene vào trứng vừa thụ tinh); tạo cây chuyển gene cần thêm công nghệ nuôi cấy tế bào để tái sinh thành cây. Công nghệ gene mang lại nhiều thành tựu nhưng cũng gây quan ngại về sức khỏe, môi trường và đạo đức sinh học.',
    'Recombinant DNA technology makes DNA from two sources (usually two species) and puts it into a host cell so that it makes the gene’s protein in quantity. The gene and the vector are cut with restriction enzymes, joined with ligase and put into the host. Modified animals also need in vitro fertilisation (the gene injected into a just-fertilised egg); modified plants need cell culture to grow whole plants. Gene technology brings many achievements but also raises concerns about health, the environment and bioethics.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu nguyên lí và thành tựu như sách giáo khoa.',
      'The lesson gives the principles and achievements as the textbook does.',
    ),
  ],
  limits: [
    L('Bài không dựng lại thí nghiệm chuyển gene.', 'The lesson does not rebuild a gene transfer.'),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH12', lesson: 5 },
    question: L(
      'Gene quy định hormone insulin của người được gắn vào plasmid rồi chuyển vào vi khuẩn. Vi khuẩn chuyển gene tạo ra gì?',
      'The human insulin gene is put into a plasmid and then into bacteria. What do the bacteria make?',
    ),
    choices: [
      { id: 'insulin-nguoi', text: L('Hormone insulin của người', 'Human insulin') },
      {
        id: 'insulin-vk',
        text: L('Một loại insulin của riêng vi khuẩn', 'A bacterial insulin of their own'),
      },
      { id: 'khong', text: L('Không tạo ra protein nào', 'No protein at all') },
      {
        id: 'te-bao-nguoi',
        text: L('Vi khuẩn biến thành tế bào người', 'The bacteria turn into human cells'),
      },
    ],
    answer: 'insulin-nguoi',
    answerWhy: L(
      'Gene chuyển được phiên mã và dịch mã trong tế bào vi khuẩn, tạo ra hormone insulin của người; sản phẩm được tách chiết và xử lí hóa học để tạo insulin có chức năng.',
      'The transferred gene is transcribed and translated in the bacteria, making human insulin; the product is extracted and chemically treated into working insulin.',
    ),
    activities: [
      {
        kind: 'order',
        id: 'tai-to-hop',
        prompt: L(
          'Sắp xếp các bước tạo vi khuẩn mang DNA tái tổ hợp.',
          'Put the steps of making bacteria with recombinant DNA in order.',
        ),
        items: [
          {
            id: 'tach',
            text: L('Tách chiết gene cần chuyển và plasmid', 'Extract the gene and a plasmid'),
            why: L('Chuẩn bị hai nguồn DNA.', 'Two sources of DNA are prepared.'),
          },
          {
            id: 'cat',
            text: L(
              'Dùng enzyme cắt giới hạn cắt gene và plasmid',
              'Cut the gene and the plasmid with a restriction enzyme',
            ),
            why: L('Tạo các đầu dính bổ sung.', 'This leaves matching sticky ends.'),
          },
          {
            id: 'noi',
            text: L(
              'Dùng enzyme ligase nối gene vào plasmid, tạo DNA tái tổ hợp',
              'Join the gene into the plasmid with ligase: recombinant DNA',
            ),
            why: L('Các đầu dính kết cặp bổ sung.', 'The sticky ends pair.'),
          },
          {
            id: 'chuyen',
            text: L('Chuyển DNA tái tổ hợp vào vi khuẩn', 'Put the recombinant DNA into bacteria'),
            why: L('Tế bào nhận.', 'The host cell.'),
          },
          {
            id: 'san-pham',
            text: L(
              'Vi khuẩn tạo ra protein của gene chuyển',
              'The bacteria make the gene’s protein',
            ),
            why: L('Gene chuyển được biểu hiện.', 'The gene is expressed.'),
          },
        ],
      },
      {
        kind: 'match',
        id: 'thanh-tuu',
        prompt: L(
          'Ghép mỗi sinh vật biến đổi gene với điều sách nêu về nó.',
          'Match each modified organism with what the book says about it.',
        ),
        pairs: [
          {
            id: 'lua-vang',
            left: L('Lúa vàng', 'Golden rice'),
            right: L(
              'Có gene tổng hợp tiền chất vitamin A',
              'Has a gene for the vitamin A precursor',
            ),
            why: L('Giúp người thiếu vitamin A.', 'It helps people short of vitamin A.'),
          },
          {
            id: 'bong',
            left: L('Bông chuyển gene', 'Modified cotton'),
            right: L(
              'Có gene của vi khuẩn tạo độc tố chống sâu hại',
              'Has a bacterial gene for a toxin against pests',
            ),
            why: L('Không phải dùng thuốc trừ sâu hóa học.', 'No chemical pesticide is needed.'),
          },
          {
            id: 'cuu',
            left: L('Cừu chuyển gene', 'Modified sheep'),
            right: L(
              'Tạo protein antithrombin của người trong sữa',
              'Makes human antithrombin in its milk',
            ),
            why: L('Dùng làm thuốc chống đông máu.', 'Used as an anticoagulant.'),
          },
          {
            id: 'ca-hoi',
            left: L('Cá hồi chuyển gene', 'Modified salmon'),
            right: L(
              'Có thêm gene hormone sinh trưởng, lớn nhanh',
              'Has an extra growth hormone gene, grows fast',
            ),
            why: L('Tốc độ sinh trưởng cao hơn nhiều.', 'It grows much faster.'),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'dong-thuc-vat',
        prompt: L(
          'Xếp mỗi bước vào cách tạo động vật hoặc thực vật biến đổi gene.',
          'Put each step under modified animals or modified plants.',
        ),
        groups: [
          { id: 'dong', label: L('Động vật biến đổi gene', 'Modified animals') },
          { id: 'thuc', label: L('Thực vật biến đổi gene', 'Modified plants') },
        ],
        items: [
          {
            id: 'tiem',
            text: L(
              'Tiêm gene chuyển vào trứng vừa thụ tinh',
              'Inject the gene into a just-fertilised egg',
            ),
            group: 'dong',
            why: L('Trứng đủ lớn để dùng kim tiêm.', 'The egg is big enough for a needle.'),
          },
          {
            id: 'me-nuoi',
            text: L('Đưa phôi vào tử cung “mẹ nuôi”', 'Place the embryo in a surrogate mother'),
            group: 'dong',
            why: L('Sinh ra con vật chuyển gene.', 'The modified animal is born.'),
          },
          {
            id: 'sung',
            text: L('Dùng súng bắn gene hoặc virus', 'Use a gene gun or a virus'),
            group: 'thuc',
            why: L('Tế bào thực vật có thành tế bào.', 'Plant cells have a wall.'),
          },
          {
            id: 'tai-sinh',
            text: L(
              'Nuôi cấy tế bào chuyển gene tái sinh thành cây',
              'Grow the modified cells into whole plants',
            ),
            group: 'thuc',
            why: L('Cần công nghệ nuôi cấy tế bào.', 'Cell culture is needed.'),
          },
        ],
      },
    ],
  },
};
