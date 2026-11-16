import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH10 KNTT Bài 19 "Công nghệ tế bào" (printed pages 110–115), in SimLab's own words. Checked on
 * 16/11/2026: plant tissue culture (tissue → sterile medium with plant hormones → callus → roots,
 * stem, leaves → plantlet), the book's three plant techniques (nuôi cấy mô, lai tế bào sinh
 * dưỡng, nuôi cấy hạt phấn/noãn chưa thụ tinh) and three animal achievements (nhân bản vô tính,
 * liệu pháp tế bào gốc, liệu pháp gene). The book does not use "tính toàn năng" here, so neither
 * does the lesson. SH10-GL-5.
 */
export const sh10b19CellTechnology: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh10-cell-technology',
  topic: 'cellTechnology',
  title: L(
    'Công nghệ tế bào: từ một mảnh mô nhỏ đến cây con',
    'Cell technology: from a small piece of tissue to a young plant',
  ),
  objectives: [
    L(
      'Dự đoán vì sao một mảnh mô lá có thể tái sinh thành cây.',
      'Predict why a small piece of leaf tissue can grow into a whole plant.',
    ),
    L(
      'Xếp đúng thứ tự các bước nuôi cấy mô tế bào thực vật.',
      'Put the steps of plant tissue culture in order.',
    ),
    L(
      'Ghép mỗi kĩ thuật công nghệ tế bào với thành tựu của nó.',
      'Match each cell technology technique with what it achieves.',
    ),
  ],
  hints: [
    L(
      'Ở thực vật, tế bào đã chuyên hoá có quay lại phân chia được không, nếu được nuôi trong điều kiện thích hợp?',
      'In plants, can a specialised cell start dividing again if it is kept in the right conditions?',
    ),
    L(
      'Mỗi kĩ thuật dùng loại tế bào nào: tế bào sinh dưỡng, hạt phấn, tế bào trứng hay tế bào gốc?',
      'Which cells does each technique use: body cells, pollen, egg cells or stem cells?',
    ),
  ],
  questions: [
    L(
      'Vì sao các cây con tạo ra bằng nuôi cấy mô thường giống hệt nhau? Điều đó có lợi và có rủi ro gì?',
      'Why are young plants made by tissue culture usually identical? What is good and what is risky about that?',
    ),
  ],
  expectedConclusion: L(
    'Công nghệ tế bào nuôi cấy tế bào, mô trong môi trường nhân tạo. Ở thực vật, nhờ chất dinh dưỡng và hormone thích hợp, tế bào đã chuyên hoá quay về trạng thái chưa phân hoá (mô sẹo) rồi tái sinh thành những cây con giống nhau. Các thành tựu gồm nhân nhanh giống cây, cây lai khác loài, cây đồng hợp tử, nhân bản vô tính vật nuôi, liệu pháp tế bào gốc và liệu pháp gene.',
    'Cell technology grows cells and tissues in an artificial medium. In plants, the right nutrients and hormones let specialised cells return to an undifferentiated state (callus) and then regrow into identical young plants. Its achievements include fast propagation of plants, hybrids of two species, fully homozygous plants, cloned farm animals, stem cell therapy and gene therapy.',
  ),
  sources: [],
  assumptions: [
    L(
      'Nuôi cấy mô được mô tả theo các bước chính; bài không nêu tên và tỉ lệ hormone cụ thể.',
      'Tissue culture is described by its main steps; the lesson does not name hormones or their ratios.',
    ),
  ],
  limits: [
    L(
      'Liệu pháp tế bào gốc và liệu pháp gene được nêu ở mức sách giáo khoa, không phải thông tin điều trị.',
      'Stem cell and gene therapy are described at textbook level; this is not treatment information.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH10', lesson: 19 },
    question: L(
      'Người ta lấy một mảnh mô lá rất nhỏ, nuôi trong ống nghiệm và nhận được cả một cây con. Theo em vì sao làm được như vậy?',
      'A very small piece of leaf tissue is grown in a test tube and becomes a whole young plant. Why do you think this works?',
    ),
    choices: [
      {
        id: 'tai-sinh',
        text: L(
          'Tế bào thực vật có thể quay về trạng thái chưa phân hoá rồi tái sinh thành cây',
          'Plant cells can go back to an undifferentiated state and regrow into a plant',
        ),
      },
      {
        id: 'co-hat',
        text: L(
          'Trong mảnh lá có sẵn những hạt giống rất nhỏ',
          'The piece of leaf already holds tiny seeds',
        ),
      },
      {
        id: 'du-chat',
        text: L(
          'Mảnh lá chứa đủ chất dinh dưỡng để tự lớn thành cây',
          'The piece of leaf holds enough food to grow into a plant by itself',
        ),
      },
    ],
    answer: 'tai-sinh',
    answerWhy: L(
      'Trong ống nghiệm có chất dinh dưỡng và hormone thực vật với tỉ lệ thích hợp. Nhờ đó, tế bào lá đã chuyên hoá quay về trạng thái chưa phân hoá, phân chia nhiều lần rồi tạo thành rễ, thân, lá. Mảnh lá không có hạt, cũng không đủ chất để tự nuôi cả cây.',
      'The test tube holds nutrients and plant hormones in the right ratio. Thanks to them, specialised leaf cells return to an undifferentiated state, divide many times and form roots, a stem and leaves. The leaf piece has no seeds and not enough food to feed a whole plant.',
    ),
    activities: [
      {
        kind: 'order',
        id: 'nuoi-cay-mo',
        prompt: L(
          'Xếp các bước nuôi cấy mô tế bào thực vật theo đúng thứ tự.',
          'Put the steps of plant tissue culture in the right order.',
        ),
        items: [
          {
            id: 'tach',
            text: L('Tách một mảnh mô khỏi cây', 'Take a piece of tissue from the plant'),
            why: L(
              'Bước đầu tiên: lấy mô gồm những tế bào đã chuyên hoá từ cây cần nhân giống.',
              'First step: take tissue made of specialised cells from the plant to be propagated.',
            ),
          },
          {
            id: 'nuoi',
            text: L(
              'Nuôi mô trong ống nghiệm vô trùng, có chất dinh dưỡng và hormone thực vật',
              'Grow the tissue in a sterile test tube with nutrients and plant hormones',
            ),
            why: L(
              'Vô trùng để vi sinh vật không làm hỏng mẫu; hormone với tỉ lệ thích hợp điều khiển sự phát triển của mô.',
              'Sterile so that microbes do not spoil the sample; hormones in the right ratio steer how the tissue develops.',
            ),
          },
          {
            id: 'mo-seo',
            text: L(
              'Tế bào quay về trạng thái chưa phân hoá, tạo mô sẹo',
              'The cells return to an undifferentiated state and form a callus',
            ),
            why: L(
              'Khối tế bào chưa phân hoá này gọi là mô sẹo (mô callus).',
              'This lump of undifferentiated cells is called a callus.',
            ),
          },
          {
            id: 're-than-la',
            text: L(
              'Tế bào mô sẹo phân chia và hình thành rễ, thân, lá',
              'Callus cells divide and form roots, a stem and leaves',
            ),
            why: L(
              'Các tế bào mô sẹo phân chia rồi chuyên hoá dần thành các bộ phận của cây.',
              'The callus cells divide and gradually specialise into the parts of a plant.',
            ),
          },
          {
            id: 'cay-con',
            text: L('Thu được cây con hoàn chỉnh', 'A complete young plant is obtained'),
            why: L(
              'Các cây con có kiểu gene giống nhau và giống cây ban đầu.',
              'The young plants have the same genotype as each other and as the parent plant.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'thanh-tuu',
        prompt: L(
          'Ghép mỗi kĩ thuật với thành tựu hoặc ứng dụng của nó.',
          'Match each technique with what it achieves or is used for.',
        ),
        pairs: [
          {
            id: 'nuoi-cay-mo',
            left: L('Nuôi cấy mô tế bào thực vật', 'Plant tissue culture'),
            right: L(
              'Nhân nhanh số lượng lớn cây quý hiếm, cây kháng bệnh',
              'Fast propagation of many rare or disease-resistant plants',
            ),
            why: L(
              'Từ một mẫu mô có thể tạo ra rất nhiều cây con giống nhau trong thời gian ngắn.',
              'One tissue sample can give very many identical young plants in a short time.',
            ),
          },
          {
            id: 'lai-sinh-duong',
            left: L('Lai tế bào sinh dưỡng', 'Somatic cell hybridisation'),
            right: L(
              'Cây lai mang đặc điểm của hai loài khác nhau',
              'A hybrid plant with traits of two different species',
            ),
            why: L(
              'Người ta loại bỏ lớp thành cellulose bao ngoài tế bào sinh dưỡng của hai loài, cho hai tế bào hợp lại thành một tế bào lai rồi nuôi thành cây lai; cách tạo giống thông thường không làm được như vậy.',
              'Cells of two species lose their cellulose walls and fuse into one hybrid cell that grows into a hybrid plant; ordinary crossing cannot do this.',
            ),
          },
          {
            id: 'hat-phan',
            left: L(
              'Nuôi cấy hạt phấn hoặc noãn chưa thụ tinh',
              'Culture of pollen or unfertilised ovules',
            ),
            right: L('Cây đồng hợp tử về tất cả các gene', 'A plant homozygous for every gene'),
            why: L(
              'Cây đơn bội tạo ra được lưỡng bội hoá, nên mọi gene đều ở trạng thái đồng hợp; điều này có ích khi tạo giống.',
              'The haploid plant obtained is doubled, so every gene is homozygous; this helps plant breeding.',
            ),
          },
          {
            id: 'nhan-ban',
            left: L('Nhân bản vô tính vật nuôi', 'Cloning farm animals'),
            right: L(
              'Những con vật giống hệt nhau về kiểu gene, như cừu Dolly',
              'Animals with identical genotypes, like Dolly the sheep',
            ),
            why: L(
              'Nhân tế bào của con vật cho được chuyển vào tế bào trứng đã bỏ nhân; con sinh ra mang kiểu gene của con cho nhân.',
              'The nucleus of a donor animal’s cell is put into an egg cell whose nucleus was removed; the offspring has the donor’s genotype.',
            ),
          },
          {
            id: 'te-bao-goc',
            left: L('Liệu pháp tế bào gốc', 'Stem cell therapy'),
            right: L(
              'Thay thế tế bào bị bệnh hoặc tổn thương bằng tế bào gốc nuôi cấy',
              'Replacing diseased or damaged cells with cultured stem cells',
            ),
            why: L(
              'Tế bào gốc có thể phân chia và biệt hoá thành nhiều loại tế bào, nên được nuôi cấy rồi đưa vào người bệnh.',
              'Stem cells can divide and turn into many kinds of cells, so they are grown and then given to the patient.',
            ),
          },
          {
            id: 'lieu-phap-gene',
            left: L('Liệu pháp gene', 'Gene therapy'),
            right: L(
              'Thay gene bệnh bằng gene lành trong tế bào người bệnh',
              'Replacing a faulty gene with a working one in the patient’s cells',
            ),
            why: L(
              'Tế bào được chỉnh sửa gene trong ống nghiệm, được chọn lọc, nhân lên rồi đưa lại vào cơ thể người bệnh.',
              'Cells are gene-edited in a test tube, selected, multiplied and put back into the patient’s body.',
            ),
          },
        ],
      },
    ],
  },
};
