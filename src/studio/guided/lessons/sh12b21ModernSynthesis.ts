import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH12 KNTT Bài 21 "Học thuyết tiến hoá tổng hợp hiện đại" (printed pages 106–112), in SimLab's
 * own words. Checked against the pages on 17/11/2026: microevolution as changing allele and
 * genotype frequencies (tr. 106), the evolutionary factors — mutation, genetic drift (Hình 21.1),
 * gene flow, natural selection, non-random mating (tr. 106–108), adaptations and their relative
 * nature (tr. 108–109), the biological species, isolation, allopatric (Hình 21.2) and sympatric
 * speciation (tr. 110). SH12-GL-7.
 */
export const sh12b21ModernSynthesis: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'biology',
  id: 'guided.sh12-modern-synthesis',
  topic: 'modernSynthesis',
  title: L('Học thuyết tiến hóa tổng hợp hiện đại', 'The modern evolutionary synthesis'),
  objectives: [
    L(
      'Dự đoán nhân tố tiến hóa nào làm thay đổi tần số kiểu gene mà không làm thay đổi tần số allele.',
      'Predict which factor changes genotype but not allele frequencies.',
    ),
    L(
      'Ghép mỗi nhân tố tiến hóa với đặc điểm của nó.',
      'Match each evolutionary factor with what it does.',
    ),
    L(
      'Phân loại các ví dụ hình thành loài khác và cùng khu vực địa lí.',
      'Sort examples of speciation apart from and within one area.',
    ),
  ],
  hints: [
    L(
      'Giao phối cận huyết làm tăng tần số kiểu gene đồng hợp, giảm dị hợp.',
      'Inbreeding raises homozygote and lowers heterozygote frequencies.',
    ),
    L(
      'Cách li địa lí ngăn cản dòng gene giữa các quần thể.',
      'Geographic isolation blocks gene flow between populations.',
    ),
  ],
  questions: [
    L(
      'Vì sao cá thể sinh vật không phải là đơn vị của tiến hóa nhỏ?',
      'Why is an individual not the unit of microevolution?',
    ),
  ],
  expectedConclusion: L(
    'Tiến hóa nhỏ là quá trình thay đổi tần số allele và tần số kiểu gene của quần thể qua các thế hệ; quần thể là đơn vị tiến hóa nhỏ. Các nhân tố tiến hóa gồm đột biến, phiêu bạt di truyền, dòng gene, chọn lọc tự nhiên và giao phối không ngẫu nhiên; riêng giao phối không ngẫu nhiên chỉ làm thay đổi tần số kiểu gene. Chọn lọc tự nhiên hình thành đặc điểm thích nghi, nhưng mọi đặc điểm thích nghi chỉ mang tính tương đối. Loài sinh học là nhóm quần thể giao phối được với nhau sinh con hữu thụ và cách li sinh sản với nhóm khác; loài mới hình thành khi xuất hiện cách li sinh sản, khác hoặc cùng khu vực địa lí.',
    'Microevolution is the change of a population’s allele and genotype frequencies over generations; the population is its unit. The evolutionary factors are mutation, genetic drift, gene flow, natural selection and non-random mating; non-random mating changes only genotype frequencies. Natural selection shapes adaptations, but every adaptation is only relative. A biological species is a group of populations that interbreed to fertile offspring and are reproductively isolated from others; a new species forms when reproductive isolation appears, apart from or within one area.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu khái niệm và ví dụ như sách giáo khoa.',
      'The lesson gives the ideas and examples as the textbook does.',
    ),
  ],
  limits: [
    L(
      'Phiêu bạt di truyền và cân bằng Hardy – Weinberg được tính trong các chủ đề riêng.',
      'Genetic drift and the Hardy – Weinberg balance are worked out in their own topics.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH12', lesson: 21 },
    question: L(
      'Nhân tố tiến hóa nào làm thay đổi tần số kiểu gene nhưng không làm thay đổi tần số allele của quần thể?',
      'Which evolutionary factor changes genotype frequencies but not allele frequencies?',
    ),
    choices: [
      { id: 'giao-phoi', text: L('Giao phối không ngẫu nhiên', 'Non-random mating') },
      { id: 'dot-bien', text: L('Đột biến', 'Mutation') },
      { id: 'dong-gene', text: L('Dòng gene', 'Gene flow') },
      { id: 'chon-loc', text: L('Chọn lọc tự nhiên', 'Natural selection') },
    ],
    answer: 'giao-phoi',
    answerWhy: L(
      'Giao phối không ngẫu nhiên (cận huyết, có lựa chọn) không thêm hay bớt allele nào, chỉ làm tăng kiểu gene đồng hợp và giảm kiểu gene dị hợp.',
      'Non-random mating (inbreeding, choice) adds or removes no allele; it only raises homozygotes and lowers heterozygotes.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'nhan-to',
        prompt: L(
          'Ghép mỗi nhân tố tiến hóa với đặc điểm của nó.',
          'Match each factor with what it does.',
        ),
        pairs: [
          {
            id: 'dot-bien',
            left: L('Đột biến', 'Mutation'),
            right: L(
              'Tạo allele mới, cung cấp nguyên liệu cho tiến hóa',
              'Makes new alleles, the raw material',
            ),
            why: L('Tần số thấp nhưng có ở mọi gene.', 'Rare per gene, but across all genes.'),
          },
          {
            id: 'phieu-bat',
            left: L('Phiêu bạt di truyền', 'Genetic drift'),
            right: L(
              'Yếu tố ngẫu nhiên làm thay đổi tần số allele, mạnh ở quần thể nhỏ',
              'Chance changes allele frequencies, strongly in small populations',
            ),
            why: L('Ví dụ bọ rùa trên đảo sau hỏa hoạn.', 'Like the ladybirds after the fire.'),
          },
          {
            id: 'dong-gene',
            left: L('Dòng gene', 'Gene flow'),
            right: L(
              'Allele di chuyển vào hoặc ra khỏi quần thể',
              'Alleles moving into or out of a population',
            ),
            why: L('Qua cá thể hoặc giao tử di cư.', 'Through migrating individuals or gametes.'),
          },
          {
            id: 'chon-loc',
            left: L('Chọn lọc tự nhiên', 'Natural selection'),
            right: L(
              'Tăng tần số allele quy định đặc điểm thích nghi theo hướng xác định',
              'Raises the frequency of adaptive alleles in one direction',
            ),
            why: L('Tác động trực tiếp lên kiểu hình.', 'It acts on the phenotype.'),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'hinh-thanh-loai',
        prompt: L(
          'Xếp mỗi ví dụ vào cách hình thành loài.',
          'Put each example under its kind of speciation.',
        ),
        groups: [
          { id: 'khac', label: L('Khác khu vực địa lí', 'In separate areas') },
          { id: 'cung', label: L('Cùng khu vực địa lí', 'Within one area') },
        ],
        items: [
          {
            id: 'dao',
            text: L(
              'Quần thể di cư ra đảo xa, cách li với đất liền rồi phân hóa vốn gene',
              'A population on a far island, cut off from the mainland, drifts apart',
            ),
            group: 'khac',
            why: L('Trở ngại đại dương ngăn dòng gene.', 'The ocean blocks gene flow.'),
          },
          {
            id: 'lau-dai',
            text: L(
              'Hai quần thể bị cách li địa lí lâu dài, vốn gene phân hóa do đột biến, chọn lọc, phiêu bạt',
              'Two populations long cut off from each other, their gene pools drifting apart',
            ),
            group: 'khac',
            why: L(
              'Cách li càng lâu, trở ngại sinh sản càng dễ xuất hiện.',
              'The longer the isolation, the likelier a barrier to breeding.',
            ),
          },
          {
            id: 'tu-boi',
            text: L(
              'Cây tứ bội xuất hiện trong quần thể lưỡng bội',
              'A tetraploid plant appears among diploids',
            ),
            group: 'cung',
            why: L(
              'Lai với cây lưỡng bội cho con tam bội bất thụ.',
              'Crossing with diploids gives sterile triploids.',
            ),
          },
          {
            id: 'lai-xa',
            text: L(
              'Lai giữa hai loài họ hàng gần rồi đa bội hóa',
              'A cross of two related species, then doubling',
            ),
            group: 'cung',
            why: L('Hay gặp ở thực vật.', 'Common in plants.'),
          },
        ],
      },
    ],
  },
};
