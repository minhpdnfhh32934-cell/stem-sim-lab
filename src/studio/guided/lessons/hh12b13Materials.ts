import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * HH12 KNTT Bài 13 "Vật liệu polymer" (printed pages 56–64), in SimLab's own words. Checked
 * against the pages on 17/11/2026: plastics, their uses and the table of uses (tr. 57), plastic
 * waste and ways to cut it (Hình 13.1), composites (tr. 58–59), fibres and their classes (Hình
 * 13.2, tr. 59–61), natural and synthetic rubber (tr. 61–62) and adhesives (tr. 63). HH12-GL-7.
 */
export const hh12b13Materials: StudioScenario = {
  ...GUIDED_BASE,
  subject: 'chemistry',
  id: 'guided.hh12-polymer-materials',
  topic: 'polymerMaterials',
  title: L('Vật liệu polymer', 'Polymer materials'),
  objectives: [
    L(
      'Dự đoán vì sao PVC được dùng làm vỏ bọc dây điện.',
      'Predict why PVC is used to sheathe electric wires.',
    ),
    L(
      'Ghép mỗi loại vật liệu polymer với tính chất đặc trưng của nó.',
      'Match each kind of polymer material with its defining property.',
    ),
    L('Phân loại tơ và cao su theo nguồn gốc.', 'Sort fibres and rubbers by origin.'),
  ],
  hints: [
    L(
      'Sách nêu một số polymer có tính cách điện.',
      'The book says some polymers are electrical insulators.',
    ),
    L(
      'Tơ bán tổng hợp được chế biến từ polymer thiên nhiên bằng phương pháp hóa học.',
      'Semi-synthetic fibres are made chemically from natural polymers.',
    ),
  ],
  questions: [
    L(
      'Nêu một số việc em có thể làm ở nhà để giảm rác thải nhựa.',
      'Name some things you can do at home to cut plastic waste.',
    ),
  ],
  expectedConclusion: L(
    'Chất dẻo là vật liệu polymer có tính dẻo; các chất dẻo thông dụng như PE, PP, PVC, PS được tổng hợp bằng phản ứng trùng hợp và dùng rộng rãi, nhưng sử dụng và xử lí không đúng cách gây ô nhiễm môi trường. Vật liệu composite gồm vật liệu cốt và vật liệu nền. Tơ là vật liệu polymer dạng sợi mảnh, có độ bền nhất định, gồm tơ tự nhiên, tơ tổng hợp và tơ bán tổng hợp. Cao su là vật liệu polymer có tính đàn hồi; cao su tự nhiên lấy từ mủ cây cao su, cao su tổng hợp điều chế bằng phản ứng trùng hợp. Keo dán có khả năng kết dính bề mặt hai vật liệu rắn mà không làm biến đổi bản chất của chúng.',
    'Plastics are polymer materials that can be shaped; the common ones such as PE, PP, PVC and PS are made by addition polymerisation and widely used, but careless use and disposal pollute the environment. Composites combine a reinforcement and a matrix. Fibres are thin, fairly strong polymer threads: natural, synthetic or semi-synthetic. Rubbers are elastic polymers: natural rubber comes from the latex of the rubber tree, synthetic rubbers are made by addition polymerisation. Adhesives bond the surfaces of two solids without changing what they are.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu khái niệm, phân loại và ứng dụng như sách giáo khoa.',
      'The lesson gives only ideas, classes and uses, as the textbook does.',
    ),
  ],
  limits: [
    L(
      'Phương trình điều chế từng vật liệu được viết trong sách; bài này chỉ dùng tên.',
      'The book writes the equation for each material; this lesson uses the names only.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'HH12', lesson: 13 },
    question: L(
      'Poly(vinyl chloride) (PVC) thường được dùng làm vỏ bọc dây điện. Ứng dụng này dựa trên tính chất nào của PVC?',
      'Poly(vinyl chloride) (PVC) often sheathes electric wires. Which property of PVC does this rely on?',
    ),
    choices: [
      { id: 'cach-dien', text: L('Cách điện tốt', 'It insulates well') },
      { id: 'dan-dien', text: L('Dẫn điện tốt', 'It conducts well') },
      { id: 'phan-huy', text: L('Dễ bị phân hủy sinh học', 'It breaks down easily') },
      { id: 'dan-hoi', text: L('Có tính đàn hồi như cao su', 'It is elastic like rubber') },
    ],
    answer: 'cach-dien',
    answerWhy: L(
      'Sách nêu một số polymer như PE, PVC có tính cách điện, nên PVC bọc ngoài dây dẫn để ngăn dòng điện ra ngoài.',
      'The book says polymers such as PE and PVC insulate, so PVC around a wire keeps the current in.',
    ),
    activities: [
      {
        kind: 'match',
        id: 'vat-lieu',
        prompt: L(
          'Ghép mỗi loại vật liệu polymer với tính chất đặc trưng của nó.',
          'Match each polymer material with its defining property.',
        ),
        pairs: [
          {
            id: 'chat-deo',
            left: L('Chất dẻo', 'Plastic'),
            right: L(
              'Bị biến dạng khi chịu nhiệt, áp lực và giữ được biến dạng đó',
              'Deforms under heat or pressure and keeps that shape',
            ),
            why: L('Tính dẻo.', 'Plasticity.'),
          },
          {
            id: 'cao-su',
            left: L('Cao su', 'Rubber'),
            right: L(
              'Biến dạng khi chịu lực và trở lại dạng ban đầu khi thôi tác dụng',
              'Deforms under force and springs back when released',
            ),
            why: L('Tính đàn hồi.', 'Elasticity.'),
          },
          {
            id: 'to',
            left: L('Tơ', 'Fibre'),
            right: L('Dạng sợi mảnh, có độ bền nhất định', 'Thin threads with some strength'),
            why: L(
              'Mạch polymer không phân nhánh, xếp song song.',
              'Unbranched chains lying side by side.',
            ),
          },
          {
            id: 'keo',
            left: L('Keo dán', 'Adhesive'),
            right: L(
              'Kết dính bề mặt hai vật liệu rắn mà không làm biến đổi bản chất của chúng',
              'Bonds two solid surfaces without changing what they are',
            ),
            why: L(
              'Tạo lớp màng mỏng bám chắc vào hai mảnh vật liệu.',
              'It forms a thin film gripping both pieces.',
            ),
          },
          {
            id: 'composite',
            left: L('Vật liệu composite', 'Composite'),
            right: L('Gồm vật liệu cốt và vật liệu nền', 'A reinforcement and a matrix'),
            why: L(
              'Có tính chất vượt trội so với các vật liệu ban đầu.',
              'Better than the materials it is made of.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'loai-to',
        prompt: L('Xếp mỗi loại tơ theo nguồn gốc của nó.', 'Put each fibre under its origin.'),
        groups: [
          { id: 'tu-nhien', label: L('Tơ tự nhiên', 'Natural fibre') },
          { id: 'tong-hop', label: L('Tơ tổng hợp', 'Synthetic fibre') },
          { id: 'ban-tong-hop', label: L('Tơ bán tổng hợp', 'Semi-synthetic fibre') },
        ],
        items: [
          {
            id: 'bong',
            text: L('Sợi bông', 'Cotton'),
            group: 'tu-nhien',
            why: L(
              'Thành phần chủ yếu là cellulose có sẵn trong tự nhiên.',
              'Mostly natural cellulose.',
            ),
          },
          {
            id: 'to-tam',
            text: L('Tơ tằm', 'Silk'),
            group: 'tu-nhien',
            why: L('Lấy từ kén của con sâu tằm.', 'From silkworm cocoons.'),
          },
          {
            id: 'capron',
            text: L('Tơ capron', 'Capron'),
            group: 'tong-hop',
            why: L('Chế tạo từ caprolactam.', 'Made from caprolactam.'),
          },
          {
            id: 'nitron',
            text: L('Tơ nitron (olon)', 'Nitron (acrylic)'),
            group: 'tong-hop',
            why: L('Trùng hợp acrylonitrile.', 'Polymerised acrylonitrile.'),
          },
          {
            id: 'visco',
            text: L('Tơ visco', 'Viscose'),
            group: 'ban-tong-hop',
            why: L('Sản xuất từ nguồn cellulose.', 'Made from cellulose.'),
          },
          {
            id: 'acetate',
            text: L('Tơ cellulose acetate', 'Cellulose acetate'),
            group: 'ban-tong-hop',
            why: L(
              'Chế biến cellulose bằng phương pháp hóa học.',
              'Cellulose processed chemically.',
            ),
          },
        ],
      },
      {
        kind: 'sort',
        id: 'cao-su',
        prompt: L(
          'Xếp mỗi loại cao su hay đặc điểm vào cao su tự nhiên hoặc cao su tổng hợp.',
          'Put each rubber or feature under natural or synthetic rubber.',
        ),
        groups: [
          { id: 'tu-nhien', label: L('Cao su tự nhiên', 'Natural rubber') },
          { id: 'tong-hop', label: L('Cao su tổng hợp', 'Synthetic rubber') },
        ],
        items: [
          {
            id: 'mu',
            text: L('Lấy từ mủ cây cao su', 'From the latex of the rubber tree'),
            group: 'tu-nhien',
            why: L('Cây Hevea brasiliensis.', 'The tree Hevea brasiliensis.'),
          },
          {
            id: 'isoprene-cis',
            text: L(
              'Mắt xích isoprene, liên kết đôi đều ở dạng cis',
              'Isoprene units, every double bond cis',
            ),
            group: 'tu-nhien',
            why: L('Đặc điểm cấu tạo sách nêu.', 'The structure the book describes.'),
          },
          {
            id: 'buna',
            text: L('Cao su buna', 'Buna rubber'),
            group: 'tong-hop',
            why: L('Trùng hợp với xúc tác sodium.', 'Polymerised with a sodium catalyst.'),
          },
          {
            id: 'chloroprene',
            text: L('Cao su chloroprene', 'Chloroprene rubber'),
            group: 'tong-hop',
            why: L('Trùng hợp chloroprene.', 'Polymerised chloroprene.'),
          },
        ],
      },
    ],
  },
};
