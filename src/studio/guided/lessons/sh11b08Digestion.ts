import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH11 KNTT Bài 8 "Dinh dưỡng và tiêu hóa ở động vật" (printed pages 46–53), in SimLab's own words.
 * Checked against the pages on 17/11/2026: the three ways of taking food (ăn lọc: trai; ăn hút: muỗi
 * cái; thức ăn rắn: voi, hổ), digestion along the human tract (miệng: amylase; dạ dày: pepsin, HCl;
 * ruột non: dịch tụy, dịch ruột, dịch mật; ruột già), the enzymes and bile (Hình 8.4) and the large
 * absorbing surface of the small intestine (Hình 8.5). SH11-GL-5.
 */
export const sh11b08Digestion: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh11-digestion',
  topic: 'animalNutrition',
  title: L('Dinh dưỡng và tiêu hóa ở động vật', 'Nutrition and digestion in animals'),
  objectives: [
    L(
      'Dự đoán tác dụng của các nếp gấp, lông ruột và vi nhung mao ở ruột non.',
      'Predict what the folds, villi and microvilli of the small intestine are for.',
    ),
    L(
      'Phân loại các kiểu lấy thức ăn; xếp đúng đường đi và sự biến đổi của thức ăn trong ống tiêu hóa người.',
      'Sort the ways animals take food; put the path and changes of food in the human gut in order.',
    ),
    L(
      'Ghép mỗi dịch tiêu hóa, enzyme với việc nó làm.',
      'Match each digestive juice or enzyme with what it does.',
    ),
  ],
  hints: [
    L(
      'Tiêu hóa biến thức ăn phức tạp thành phân tử nhỏ, đơn giản mà cơ thể hấp thụ được.',
      'Digestion turns complex food into small, simple molecules the body can absorb.',
    ),
    L(
      'Chất dinh dưỡng đi vào máu qua bề mặt ruột: bề mặt càng rộng, hấp thụ càng nhiều.',
      'Nutrients enter the blood across the gut lining: the larger the surface, the more is absorbed.',
    ),
  ],
  questions: [
    L(
      'Vì sao cần ăn đa dạng thực phẩm, đủ chất, đủ lượng và giữ vệ sinh an toàn thực phẩm?',
      'Why should food be varied, complete, in the right amount and safely prepared?',
    ),
  ],
  expectedConclusion: L(
    'Dinh dưỡng ở động vật gồm lấy thức ăn, tiêu hóa, hấp thụ và đồng hóa. Động vật lấy thức ăn theo ba kiểu: ăn lọc, ăn hút và ăn thức ăn rắn. Ở người, thức ăn được tiêu hóa cơ học và hóa học: amylase nước bọt bắt đầu phân giải tinh bột, dạ dày phân giải protein, ruột non nhờ dịch tụy, dịch ruột, dịch mật biến thức ăn thành chất đơn giản. Ruột non có nhiều nếp gấp, lông ruột, vi nhung mao tạo diện tích hấp thụ rất lớn. Chế độ ăn khoa học là ăn đủ năng lượng, đủ chất và dùng thực phẩm sạch.',
    'Animal nutrition is taking food, digesting it, absorbing it and assimilating it. Animals take food in three ways: filter feeding, sucking and eating solid food. In people, food is digested mechanically and chemically: salivary amylase starts on starch, the stomach breaks down protein, and the small intestine with pancreatic juice, intestinal juice and bile turns food into simple substances. The small intestine’s folds, villi and microvilli give a very large absorbing surface. A sound diet gives enough energy and every nutrient, from clean food.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nêu các quá trình như sách giáo khoa; SimLab không tính năng lượng hay lượng chất dinh dưỡng nào.',
      'The lesson gives only the processes, as the textbook does; SimLab computes no energy or amount of nutrients.',
    ),
  ],
  limits: [
    L(
      'Bảng nhu cầu năng lượng và protein theo lứa tuổi của sách không có trong bài học này.',
      'The book’s table of energy and protein needs by age is not part of this lesson.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH11', lesson: 8 },
    question: L(
      'Thành ruột non có rất nhiều nếp gấp; trên nếp gấp có lông ruột, trên tế bào lông ruột lại có vi nhung mao. Cấu tạo này có tác dụng chính là gì?',
      'The small intestine’s wall has many folds; the folds carry villi, and the villus cells carry microvilli. What is this structure mainly for?',
    ),
    choices: [
      {
        id: 'dien-tich',
        text: L('Tạo diện tích hấp thụ rất lớn', 'A very large absorbing surface'),
      },
      { id: 'enzyme', text: L('Tiết ra nhiều enzyme hơn', 'Making more enzymes') },
      { id: 'day-nhanh', text: L('Đẩy thức ăn đi nhanh hơn', 'Pushing food along faster') },
      {
        id: 'giu-lau',
        text: L('Giữ thức ăn lại lâu để nghiền nhỏ', 'Holding food longer to grind it'),
      },
    ],
    answer: 'dien-tich',
    answerWhy: L(
      'Hấp thụ chất dinh dưỡng diễn ra chủ yếu ở ruột non. Nếp gấp, lông ruột và vi nhung mao làm bề mặt tiếp xúc với dịch tiêu hóa rộng ra rất nhiều, nên chất dinh dưỡng được hấp thụ vào máu và bạch huyết nhanh và nhiều.',
      'Nutrients are absorbed mainly in the small intestine. Folds, villi and microvilli greatly enlarge the surface in contact with the digested food, so nutrients pass into the blood and lymph quickly and in large amounts.',
    ),
    activities: [
      {
        kind: 'sort',
        id: 'lay-thuc-an',
        prompt: L(
          'Xếp mỗi con vật vào đúng kiểu lấy thức ăn.',
          'Put each animal under its way of taking food.',
        ),
        groups: [
          { id: 'loc', label: L('Ăn lọc', 'Filter feeding') },
          { id: 'hut', label: L('Ăn hút', 'Sucking') },
          { id: 'ran', label: L('Ăn thức ăn rắn', 'Eating solid food') },
        ],
        items: [
          {
            id: 'trai',
            text: L(
              'Con trai dùng tấm mang lọc sinh vật nhỏ trong nước',
              'A mussel uses its gill plates to filter tiny organisms from the water',
            ),
            group: 'loc',
            why: L(
              'Ăn lọc là lọc nước qua bộ phận chuyên hóa để lấy thức ăn.',
              'Filter feeding strains water through a special organ to get food.',
            ),
          },
          {
            id: 'hau',
            text: L('Con hàu lọc nước để lấy thức ăn', 'An oyster filters water for food'),
            group: 'loc',
            why: L(
              'Hàu cũng lấy thức ăn bằng cách lọc nước như trai.',
              'Oysters, like mussels, feed by filtering water.',
            ),
          },
          {
            id: 'muoi',
            text: L(
              'Muỗi cái dùng vòi chích qua da, hút máu',
              'A female mosquito pierces skin with its proboscis and sucks blood',
            ),
            group: 'hut',
            why: L(
              'Miệng của động vật ăn hút có cấu tạo để đục lỗ và hút dịch.',
              'Sucking feeders have mouthparts built to pierce and suck fluids.',
            ),
          },
          {
            id: 'rep',
            text: L('Rệp cây hút nhựa cây', 'An aphid sucks plant sap'),
            group: 'hut',
            why: L(
              'Thức ăn là dịch lỏng hút từ cơ thể thực vật.',
              'The food is a liquid sucked from a plant.',
            ),
          },
          {
            id: 'voi',
            text: L(
              'Con voi dùng vòi đưa thức ăn vào miệng',
              'An elephant uses its trunk to put food in its mouth',
            ),
            group: 'ran',
            why: L(
              'Thức ăn rắn được đưa vào miệng rồi nghiền nhỏ.',
              'Solid food is put into the mouth and broken up.',
            ),
          },
          {
            id: 'ho',
            text: L(
              'Con hổ cắn chết con mồi rồi dùng răng cắt từng miếng thịt',
              'A tiger kills its prey and cuts the meat into pieces with its teeth',
            ),
            group: 'ran',
            why: L(
              'Động vật ăn thức ăn rắn có nhiều cách lấy thức ăn khác nhau.',
              'Animals that eat solid food get it in many different ways.',
            ),
          },
        ],
      },
      {
        kind: 'order',
        id: 'duong-di',
        prompt: L(
          'Xếp đường đi và sự biến đổi của thức ăn trong ống tiêu hóa người theo đúng thứ tự.',
          'Put the path and changes of food in the human gut in order.',
        ),
        items: [
          {
            id: 'mieng',
            text: L(
              'Miệng: nhai, trộn nước bọt, amylase bắt đầu phân giải tinh bột',
              'Mouth: chewing, mixing with saliva, amylase starts breaking down starch',
            ),
            why: L(
              'Tinh bột bị thủy phân thành đường maltose.',
              'Starch is broken down into maltose.',
            ),
          },
          {
            id: 'thuc-quan',
            text: L(
              'Thực quản: nhu động đẩy thức ăn xuống dạ dày',
              'Oesophagus: waves of muscle push food to the stomach',
            ),
            why: L(
              'Phản xạ nuốt chuyển thức ăn từ miệng xuống thực quản.',
              'The swallowing reflex moves food from the mouth into the oesophagus.',
            ),
          },
          {
            id: 'da-day',
            text: L(
              'Dạ dày: co bóp trộn dịch vị; pepsin và HCl phân giải protein',
              'Stomach: churning with gastric juice; pepsin and HCl break down protein',
            ),
            why: L('Protein bị phân giải thành các peptide.', 'Protein is broken into peptides.'),
          },
          {
            id: 'ruot-non',
            text: L(
              'Ruột non: dịch tụy, dịch ruột, dịch mật biến thức ăn thành chất đơn giản; hấp thụ',
              'Small intestine: pancreatic juice, intestinal juice and bile turn food into simple substances; absorption',
            ),
            why: L(
              'Đây là nơi tiêu hóa hóa học và hấp thụ chủ yếu.',
              'This is where most chemical digestion and absorption happen.',
            ),
          },
          {
            id: 'ruot-gia',
            text: L(
              'Ruột già: phần còn lại thành phân, thải ra ngoài',
              'Large intestine: the rest becomes faeces and is passed out',
            ),
            why: L(
              'Phần còn lại hầu như không còn chất dinh dưỡng.',
              'What is left holds almost no nutrients.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'enzyme',
        prompt: L(
          'Ghép mỗi dịch tiêu hóa, enzyme với việc nó làm.',
          'Match each digestive juice or enzyme with what it does.',
        ),
        pairs: [
          {
            id: 'amylase',
            left: L('Amylase trong nước bọt', 'Salivary amylase'),
            right: L('Thủy phân tinh bột thành đường maltose', 'Breaks starch down into maltose'),
            why: L(
              'Tiêu hóa hóa học bắt đầu ngay ở khoang miệng.',
              'Chemical digestion starts in the mouth.',
            ),
          },
          {
            id: 'pepsin',
            left: L('Pepsin và HCl trong dịch vị', 'Pepsin and HCl in gastric juice'),
            right: L('Phân giải protein thành peptide', 'Breaks protein down into peptides'),
            why: L('Dạ dày tiêu hóa một phần protein.', 'The stomach digests part of the protein.'),
          },
          {
            id: 'mat',
            left: L('Dịch mật', 'Bile'),
            right: L(
              'Tách giọt lipid lớn thành giọt nhỏ, tăng diện tích cho lipase',
              'Splits large fat droplets into small ones, giving lipase more surface',
            ),
            why: L(
              'Dịch mật do gan sản xuất, làm giảm sức căng bề mặt của giọt lipid.',
              'Bile, made by the liver, lowers the surface tension of fat droplets.',
            ),
          },
          {
            id: 'lipase',
            left: L('Lipase', 'Lipase'),
            right: L(
              'Thủy phân lipid thành glycerol, acid béo, monoglyceride',
              'Breaks lipids down into glycerol, fatty acids and monoglycerides',
            ),
            why: L(
              'Lipase có trong dịch tụy và dịch ruột.',
              'Lipase is in pancreatic and intestinal juice.',
            ),
          },
          {
            id: 'trypsin',
            left: L('Trypsin, chymotrypsin, peptidase', 'Trypsin, chymotrypsin, peptidases'),
            right: L(
              'Thủy phân protein, peptide thành amino acid',
              'Break proteins and peptides down into amino acids',
            ),
            why: L(
              'Các protease hoàn tất tiêu hóa protein ở ruột non.',
              'These proteases finish protein digestion in the small intestine.',
            ),
          },
        ],
      },
    ],
  },
};
