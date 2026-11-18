import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH12 KNTT Bài 26 "Quần xã sinh vật" (printed pages 141–149), in SimLab's own words. Checked
 * against the pages on 17/11/2026: the community and its features — dominant, characteristic and
 * keystone species (Hình 26.2), diversity and evenness (Hình 26.3), spatial and trophic structure
 * (tr. 143–144), the relationships of Bảng 26.1 and Hình 26.5, the ecological niche and niche
 * partitioning (Hình 26.6), invasive species and protecting communities (tr. 146–148). SH12-GL-8.
 */
export const sh12b26Community: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'biology',
  id: 'guided.sh12-community',
  topic: 'community',
  title: L('Quần xã sinh vật', 'Biological communities'),
  objectives: [
    L(
      'Dự đoán quần xã nào đa dạng hơn khi hai quần xã có cùng số loài.',
      'Predict which community is more diverse when both have the same number of species.',
    ),
    L(
      'Xếp mỗi mối quan hệ giữa các loài vào nhóm hỗ trợ hoặc đối kháng.',
      'Put each relationship between species under mutualistic or antagonistic.',
    ),
    L(
      'Ghép mỗi loại vai trò của loài với ví dụ sách nêu.',
      'Match each kind of species role with the book’s example.',
    ),
  ],
  hints: [
    L(
      'Độ đa dạng tính cả số lượng loài và độ phong phú của từng loài.',
      'Diversity counts both the number of species and how evenly abundant they are.',
    ),
    L(
      'Trong quan hệ hỗ trợ, không loài nào bị hại.',
      'In a mutualistic relationship no species is harmed.',
    ),
  ],
  questions: [
    L(
      'Tập hợp các loài động vật trong một vườn thú có được gọi là quần xã không? Vì sao?',
      'Are the animals of a zoo a community? Why or why not?',
    ),
  ],
  expectedConclusion: L(
    'Quần xã sinh vật gồm các quần thể của nhiều loài cùng sống trong một không gian và thời gian nhất định, gắn bó với nhau như một thể thống nhất qua mối quan hệ dinh dưỡng và nơi ở. Quần xã có các đặc trưng về thành phần loài (loài ưu thế, loài đặc trưng, loài chủ chốt), độ đa dạng, cấu trúc không gian và cấu trúc dinh dưỡng. Các loài có quan hệ hỗ trợ (cộng sinh, hợp tác, hội sinh) hoặc đối kháng (cạnh tranh, kí sinh, sinh vật ăn sinh vật, ức chế). Cạnh tranh dẫn đến phân li ổ sinh thái, giúp nhiều loài cùng tồn tại. Loài ngoại lai và hoạt động của con người có thể làm suy giảm đa dạng của quần xã.',
    'A community is the populations of many species living in one place and time, bound together by feeding and shelter. It is described by its species (dominant, characteristic, keystone), diversity, spatial structure and trophic structure. Species relate mutualistically (symbiosis, cooperation, commensalism) or antagonistically (competition, parasitism, predation, inhibition). Competition leads to niche partitioning, letting many species coexist. Invasive species and human activity can reduce a community’s diversity.',
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
      'Biến động số lượng con mồi và vật ăn thịt được tính trong chủ đề “Con mồi – vật ăn thịt”.',
      'Predator and prey numbers over time are worked out in the predator–prey topic.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH12', lesson: 26 },
    question: L(
      'Hai quần xã có cùng số loài; ở quần xã A một loài chiếm gần hết số cá thể, ở quần xã B số cá thể các loài gần bằng nhau. Quần xã nào đa dạng hơn?',
      'Two communities have the same species; in A one species makes up nearly all individuals, in B the species are about equally common. Which is more diverse?',
    ),
    choices: [
      { id: 'b', text: L('Quần xã B', 'Community B') },
      { id: 'a', text: L('Quần xã A', 'Community A') },
      { id: 'bang', text: L('Như nhau vì cùng số loài', 'The same, since they share the species') },
      { id: 'khong-biet', text: L('Không so sánh được', 'They cannot be compared') },
    ],
    answer: 'b',
    answerWhy: L(
      'Độ đa dạng thể hiện qua số lượng loài và tỉ lệ số cá thể của mỗi loài. Cùng số loài, quần xã có độ phong phú các loài càng đồng đều thì càng đa dạng.',
      'Diversity reflects both the number of species and their shares. With the same species, the more even community is more diverse.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'quan-he',
        prompt: L(
          'Xếp mỗi ví dụ vào nhóm quan hệ của nó.',
          'Put each example under its kind of relationship.',
        ),
        groups: [
          { id: 'ho-tro', label: L('Hỗ trợ', 'Mutualistic') },
          { id: 'doi-khang', label: L('Đối kháng', 'Antagonistic') },
        ],
        items: [
          {
            id: 'dia-y',
            text: L('Nấm và tảo trong địa y', 'Fungus and alga in a lichen'),
            group: 'ho-tro',
            why: L('Cộng sinh: cả hai đều có lợi.', 'Symbiosis: both gain.'),
          },
          {
            id: 'chim-sao',
            text: L('Chim sáo và trâu, bò', 'Mynas and cattle'),
            group: 'ho-tro',
            why: L('Hợp tác.', 'Cooperation.'),
          },
          {
            id: 'phong-lan',
            text: L('Cây phong lan sống bám trên cây gỗ lớn', 'An orchid growing on a big tree'),
            group: 'ho-tro',
            why: L('Hội sinh: cây gỗ không bị hại.', 'Commensalism: the tree is not harmed.'),
          },
          {
            id: 'tho-cuu',
            text: L('Thỏ và cừu cùng ăn cỏ', 'Rabbits and sheep eating the same grass'),
            group: 'doi-khang',
            why: L('Cạnh tranh.', 'Competition.'),
          },
          {
            id: 'to-hong',
            text: L('Cây tầm gửi trên cây thân gỗ', 'Mistletoe on a tree'),
            group: 'doi-khang',
            why: L('Kí sinh.', 'Parasitism.'),
          },
          {
            id: 'tao',
            text: L('Tảo giáp nở hoa tiết chất độc', 'A toxic algal bloom'),
            group: 'doi-khang',
            why: L('Ức chế các loài sống xung quanh.', 'It inhibits the species around it.'),
          },
        ],
      },
      {
        kind: 'match',
        id: 'vai-tro',
        prompt: L(
          'Ghép mỗi loại loài với ví dụ sách nêu.',
          'Match each kind of species with the book’s example.',
        ),
        pairs: [
          {
            id: 'uu-the',
            left: L('Loài ưu thế', 'Dominant species'),
            right: L('Các cây gỗ lớn trong rừng mưa nhiệt đới', 'Large trees of the rainforest'),
            why: L('Số lượng hoặc sinh khối lớn nhất.', 'The largest number or biomass.'),
          },
          {
            id: 'dac-trung',
            left: L('Loài đặc trưng', 'Characteristic species'),
            right: L('Đước, sú, vẹt ở rừng ngập mặn', 'Mangrove trees of the mangrove forest'),
            why: L('Chỉ có hoặc có nhiều ở sinh cảnh đó.', 'Found only or mostly there.'),
          },
          {
            id: 'chu-chot',
            left: L('Loài chủ chốt', 'Keystone species'),
            right: L('Sư tử trên đồng cỏ', 'Lions on the grassland'),
            why: L(
              'Kiểm soát kích thước quần thể động vật ăn thực vật.',
              'It keeps the herbivores in check.',
            ),
          },
          {
            id: 'ngoai-lai',
            left: L('Loài ngoại lai', 'Invasive species'),
            right: L('Ốc bươu vàng ở Việt Nam', 'Golden apple snails in Việt Nam'),
            why: L(
              'Được di nhập, cạnh tranh với loài bản địa.',
              'Brought in, it competes with native species.',
            ),
          },
        ],
      },
    ],
  },
};
