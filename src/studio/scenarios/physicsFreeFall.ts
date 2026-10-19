import type { StudioScenario } from '../scenario';

/**
 * Free fall from twice the height. Every number the learner sees comes from the `freeFall`
 * scene's engine; the text below is teaching copy waiting for a teacher's review
 * (docs/DATA_REVIEW.md #20).
 */
export const physicsFreeFall: StudioScenario = {
  schemaVersion: 1,
  id: 'physics.free-fall-height',
  subject: 'physics',
  topic: 'freeFall',
  title: {
    vi: 'Rơi tự do: thả từ độ cao gấp đôi',
    en: 'Free fall: dropping from twice the height',
  },
  objectives: [
    {
      vi: 'Dự đoán thời gian rơi thay đổi thế nào khi độ cao ban đầu tăng gấp đôi.',
      en: 'Predict how the fall time changes when the starting height is doubled.',
    },
    {
      vi: 'So sánh hai lần thả A và B bằng số đo và đồ thị do mô phỏng tính.',
      en: 'Compare drops A and B using measurements and a graph computed by the simulation.',
    },
    {
      vi: 'Giải thích kết quả bằng chính số liệu đã đo.',
      en: 'Explain the result with the measured data.',
    },
  ],
  level: 'foundation',
  difficulty: 'intro',
  tools: ['controls', 'engine-run', 'table', 'graph', 'science-card', 'open-lab', 'report'],
  models: ['phys.projectile'],
  // The scene's default height; dropped from rest so the POE question ("thả vật") holds.
  initial: { h0: 45, v0: 0 },
  steps: ['predict', 'interact', 'observe', 'explain', 'conclude', 'report'],
  hints: [
    {
      vi: 'Nhìn dòng "Thời gian chuyển động": lần thả B lâu hơn A bao nhiêu lần?',
      en: 'Look at "Time of flight": how many times longer does drop B take than A?',
    },
    {
      vi: 'So sánh tỉ số B/A của thời gian với tỉ số độ cao (B cao gấp 2 lần A).',
      en: 'Compare the B/A time ratio with the height ratio (B is twice as high as A).',
    },
    {
      vi: 'Trên đồ thị y(t), đường của A và B có cùng hình dạng nhưng kết thúc ở thời điểm khác nhau.',
      en: 'On the y(t) graph, A and B have the same shape but end at different times.',
    },
  ],
  questions: [
    {
      vi: 'Độ cao tăng gấp đôi, vì sao thời gian rơi không tăng gấp đôi?',
      en: 'The height doubled — why did the fall time not double?',
    },
    {
      vi: 'Tốc độ chạm đất thay đổi thế nào? Số đo nào cho em biết điều đó?',
      en: 'How did the impact speed change? Which measurement shows it?',
    },
  ],
  completion: { prediction: true, observation: true, explanationMinChars: 20, conclusion: true },
  expectedConclusion: {
    vi: 'Khi bỏ qua sức cản không khí và thả không vận tốc đầu, thời gian rơi tỉ lệ với căn bậc hai của độ cao (t = √(2h/g)): độ cao gấp đôi thì thời gian rơi tăng √2 lần, không phải 2 lần.',
    en: 'Ignoring air resistance and dropping from rest, the fall time grows with the square root of the height (t = √(2h/g)): doubling the height makes the fall √2 times longer, not twice as long.',
  },
  sources: [],
  assumptions: [
    {
      vi: 'Vật được thả không vận tốc đầu (v₀ = 0); A và B chỉ khác nhau ở độ cao ban đầu.',
      en: 'The object is dropped from rest (v₀ = 0); A and B differ only in the starting height.',
    },
    {
      vi: 'Gia tốc trọng trường g lấy theo Cài đặt của ứng dụng.',
      en: 'The gravitational acceleration g comes from the app Settings.',
    },
  ],
  limits: [
    {
      vi: 'Mô hình chất điểm, bỏ qua sức cản không khí: không áp dụng cho vật nhẹ và rộng (lá cây, tờ giấy) hay rơi từ rất cao.',
      en: 'Point-mass model without air resistance: not valid for light, wide objects (a leaf, a sheet of paper) or very long falls.',
    },
  ],
  review_status: 'pending',
  binding: {
    kind: 'physics',
    scene: 'freeFall',
    poe: 'freeFall.h0',
    controls: ['h0'],
    measures: [
      { answer: 'time_of_flight', engine: { kind: 'endTime' } },
      { answer: 'impact_speed', engine: { kind: 'seriesEnd', graph: 'velocity', series: 'v' } },
    ],
    graph: { graph: 'position', series: 'y' },
    tMax: 20,
  },
};
