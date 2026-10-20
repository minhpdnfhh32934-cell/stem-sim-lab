import type { StudioScenario } from '../scenario';

/**
 * Mitosis on the 3D model: a stage prediction answered by the model's centromere positions, and
 * a "find the part from its function" activity on the model's own part texts. The wording below
 * is teaching copy waiting for a teacher's review (docs/DATA_REVIEW.md #22); the stage names,
 * stage notes and part functions shown during the lesson come from the 3D model's data.
 */
export const biologyMitosisMetaphase: StudioScenario = {
  schemaVersion: 1,
  id: 'biology.mitosis-equator',
  subject: 'biology',
  topic: 'mitosis',
  title: {
    vi: 'Nguyên phân 3D: khi nào NST kép xếp hàng ở mặt phẳng xích đạo?',
    en: 'Mitosis in 3D: when do double chromosomes line up at the equator?',
  },
  objectives: [
    {
      vi: 'Dự đoán ở kì nào các NST kép xếp thành một hàng ở mặt phẳng xích đạo.',
      en: 'Predict in which stage the double chromosomes line up in one row on the equatorial plane.',
    },
    {
      vi: 'Chuyển qua các kì trong mô hình 3D và đọc số tâm động nằm trên mặt phẳng xích đạo do mô hình đếm.',
      en: 'Step through the stages of the 3D model and read how many centromeres the model counts on the equatorial plane.',
    },
    {
      vi: 'Tìm trong mô hình bộ phận tế bào ứng với từng chức năng.',
      en: 'Find in the model the cell part that has each function.',
    },
  ],
  level: 'foundation',
  difficulty: 'intro',
  tools: ['model-3d', 'match', 'science-card', 'report'],
  models: ['mitosis3d'],
  initial: {},
  steps: ['predict', 'interact', 'observe', 'explain', 'conclude', 'report'],
  hints: [
    {
      vi: 'Ở mỗi kì em ghi lại, so số NST kép với số tâm động nằm trên mặt phẳng xích đạo.',
      en: 'For each stage you recorded, compare the number of double chromosomes with the number of centromeres on the equatorial plane.',
    },
    {
      vi: 'Ở kì nào mọi tâm động đều nằm trên mặt phẳng xích đạo? Đọc thêm dòng "Mô tả kì" của kì đó.',
      en: 'In which stage are all centromeres on the equatorial plane? Also read the "Stage description" line of that stage.',
    },
    {
      vi: 'Nhân con và thoi phân bào không có ở mọi kì: nếu chưa thấy bộ phận cần tìm, hãy chuyển sang kì khác.',
      en: 'The nucleolus and the spindle are not there in every stage: if you cannot see a part, move to another stage.',
    },
  ],
  questions: [
    {
      vi: 'Ở kì trả lời câu hỏi dự đoán, mô hình đếm được bao nhiêu NST kép và bao nhiêu tâm động nằm trên mặt phẳng xích đạo? Kết quả có khớp với dự đoán của em không?',
      en: 'In the stage that answers the prediction, how many double chromosomes and how many centromeres on the equatorial plane does the model count? Does it match your prediction?',
    },
    {
      vi: 'Ở kì ngay trước và ngay sau kì đó, số liệu khác thế nào? Vì sao?',
      en: 'How are the numbers different in the stage just before and just after it? Why?',
    },
  ],
  completion: {
    prediction: true,
    observation: true,
    explanationMinChars: 20,
    conclusion: true,
    activity: true,
  },
  expectedConclusion: {
    vi: 'Theo mô hình nguyên phân 3D (nội dung chưa được kiểm duyệt): ở Kì giữa, mọi NST kép đều có tâm động nằm trên mặt phẳng xích đạo, tức là các NST kép xếp thành một hàng; ở các kì khác, mô hình không cho thấy điều này.',
    en: 'According to the 3D mitosis model (content not yet reviewed): in Metaphase every double chromosome has its centromere on the equatorial plane, so the double chromosomes line up in one row; in the other stages the model does not show this.',
  },
  sources: [],
  assumptions: [
    {
      vi: 'Mỗi kì được đọc tại thời điểm đặc trưng của kì đó trong mô hình 3D; số NST, NST kép và tâm động do mô hình đếm.',
      en: 'Each stage is read at its characteristic moment in the 3D model; chromosomes, double chromosomes and centromeres are counted by the model.',
    },
    {
      vi: 'Mặt phẳng xích đạo là mặt phẳng giữa hai cực thoi phân bào trong mô hình; một tâm động được tính là nằm trên mặt phẳng khi nó nằm đúng trên mặt phẳng đó (chỉ bỏ qua sai số làm tròn).',
      en: 'The equatorial plane is the plane halfway between the two spindle poles of the model; a centromere counts as on it only when it lies exactly on it (apart from rounding).',
    },
  ],
  limits: [
    {
      vi: 'Kích thước, vị trí và thời gian trong hình 3D là minh họa, không theo tỉ lệ; chỉ các số đếm là chính xác.',
      en: 'Sizes, positions and timing in the 3D picture are illustrative, not to scale; only the counts are exact.',
    },
    {
      vi: 'Hoạt động tìm bộ phận chỉ so câu trả lời với văn bản chức năng có sẵn trong ứng dụng (chưa được kiểm duyệt); nó không chấm lời giải thích của em.',
      en: 'The part-finding activity only compares answers with the function texts stored in the app (not yet reviewed); it does not mark your explanation.',
    },
  ],
  review_status: 'pending',
  binding: {
    kind: 'biology',
    model: 'mitosis3d',
    cellType: 'animal',
    pairs: 2,
    parts: ['membrane', 'nucleus', 'nuclearEnvelope', 'nucleolus', 'spindle'],
    stageQuestion: 'equatorRow',
    question: {
      vi: 'Trong nguyên phân của một tế bào động vật (2n = 4), theo em ở kì nào các NST kép xếp thành một hàng ở mặt phẳng xích đạo?',
      en: 'In mitosis of an animal cell (2n = 4), in which stage do you think the double chromosomes line up in one row on the equatorial plane?',
    },
  },
};
