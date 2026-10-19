import type { StudioScenario } from '../scenario';

/**
 * Silver nitrate test for chloride on the virtual bench. What the learner observes is the
 * `agcl` record of the reaction library; the text below is teaching copy waiting for a
 * teacher's review (docs/DATA_REVIEW.md #21). The other rack solutions come from library records
 * too, so a wrong pair shows either another record or "not in the verified database".
 */
export const chemistryChlorideTest: StudioScenario = {
  schemaVersion: 1,
  id: 'chemistry.chloride-silver-nitrate',
  subject: 'chemistry',
  topic: 'reactionLibrary',
  title: {
    vi: 'Nhận biết ion Cl⁻ bằng dung dịch AgNO₃',
    en: 'Testing for Cl⁻ with AgNO₃ solution',
  },
  objectives: [
    {
      vi: 'Dự đoán hiện tượng khi nhỏ dung dịch AgNO₃ vào dung dịch NaCl.',
      en: 'Predict what happens when AgNO₃ solution is added to NaCl solution.',
    },
    {
      vi: 'Làm đúng các bước trên bàn thí nghiệm ảo và đọc hiện tượng mà thư viện phản ứng ghi lại.',
      en: 'Follow the steps on the virtual bench and read the observation recorded in the reaction library.',
    },
    {
      vi: 'Đọc phương trình đã kiểm tra cân bằng và biết bàn thí nghiệm chưa đo được những đại lượng nào.',
      en: 'Read the balance-checked equation and know which quantities the bench does not measure.',
    },
  ],
  level: 'foundation',
  difficulty: 'intro',
  tools: ['bench', 'science-card', 'report'],
  models: ['reactions'],
  initial: {},
  steps: ['predict', 'interact', 'observe', 'explain', 'conclude', 'report'],
  hints: [
    {
      vi: 'Đọc dòng "Hiện tượng (thư viện)": thư viện ghi điều gì xuất hiện trong ống nghiệm?',
      en: 'Read the "Observation (library)" line: what does the library say appears in the tube?',
    },
    {
      vi: 'Nhìn phương trình: chất kết tủa mà thư viện nhắc tới nằm ở vế nào?',
      en: 'Look at the equation: on which side is the precipitate the library mentions?',
    },
    {
      vi: 'Thư viện ghi phản ứng này dùng để nhận biết ion nào?',
      en: 'Which ion does the library say this reaction is used to test for?',
    },
  ],
  questions: [
    {
      vi: 'Thư viện ghi hiện tượng gì khi trộn hai dung dịch này? Hiện tượng đó có khớp với dự đoán của em không?',
      en: 'What observation does the library record for these two solutions? Does it match your prediction?',
    },
    {
      vi: 'Vì sao với một số cặp dung dịch khác, ứng dụng chỉ trả lời "chưa có trong cơ sở dữ liệu đã kiểm chứng"?',
      en: 'Why does the app only answer "not yet in the verified database" for some other pairs?',
    },
  ],
  completion: { prediction: true, observation: true, explanationMinChars: 20, conclusion: true },
  expectedConclusion: {
    vi: 'Theo bản ghi "Tạo kết tủa AgCl" của thư viện phản ứng (chưa được kiểm duyệt): trộn dung dịch AgNO₃ với dung dịch NaCl tạo kết tủa trắng AgCl theo phương trình AgNO₃ + NaCl → AgCl + NaNO₃; thư viện ghi phản ứng này dùng để nhận biết ion Cl⁻.',
    en: 'According to the reaction library record "Precipitation of AgCl" (not yet reviewed): mixing AgNO₃ solution with NaCl solution gives a white precipitate of AgCl, AgNO₃ + NaCl → AgCl + NaNO₃; the library notes this reaction as a test for Cl⁻.',
  },
  sources: [],
  assumptions: [
    {
      vi: 'Kết quả lấy từ bản ghi của thư viện phản ứng tuyển chọn cho đúng tập chất đầu; bàn thí nghiệm không tự suy ra phản ứng.',
      en: 'Results come from the curated reaction library record for exactly the substances mixed; the bench does not infer reactions.',
    },
    {
      vi: 'Thứ tự cho chất được ghi lại, nhưng bản ghi thư viện không ghi thứ tự cho chất.',
      en: 'The order of addition is recorded, but the library record does not state an order.',
    },
  ],
  limits: [
    {
      vi: 'Không tính lượng chất, nồng độ, khối lượng kết tủa, chất dư hay chất hết, pH, nhiệt độ, nhiệt lượng, thể tích khí hay hiệu suất.',
      en: 'No amounts, concentrations, precipitate mass, limiting or excess reagent, pH, temperature, heat, gas volume or yield are computed.',
    },
    {
      vi: 'Lớp kết tủa trong hình chỉ là kí hiệu: màu và lượng không vẽ theo số liệu.',
      en: 'The precipitate layer in the picture is only a symbol: its colour and amount are not drawn from data.',
    },
    {
      vi: 'Cặp dung dịch không có bản ghi được báo "chưa có trong cơ sở dữ liệu đã kiểm chứng" — điều đó không có nghĩa là chúng không phản ứng.',
      en: 'A pair without a record is reported as "not yet in the verified database" — that does not mean it does not react.',
    },
  ],
  review_status: 'pending',
  binding: {
    kind: 'chemistry',
    inventory: ['NaCl', 'AgNO3', 'BaCl2', 'H2SO4'],
    target: ['NaCl', 'AgNO3'],
    reaction: 'agcl',
    question: {
      vi: 'Nhỏ dung dịch AgNO₃ vào ống nghiệm đựng dung dịch NaCl. Em đoán sẽ thấy gì?',
      en: 'AgNO₃ solution is added to a test tube of NaCl solution. What do you expect to see?',
    },
  },
};
