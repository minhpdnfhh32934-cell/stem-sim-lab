import { unitLabel } from '@/core/units';
import type { PhysicsScene } from '@/physics/types';
import { allowedUnits } from './spec';

/** Safety line added to every system prompt (PROMPT_PHAN_2 A3). */
export const SAFETY_RULES = `
AN TOÀN: chỉ xử lý nội dung học tập; không hỏi hay nhắc lại thông tin cá nhân.`;

/**
 * For a model without a JSON-schema mode (the in-app Gemma, a local runtime not checked for
 * structured output): the schema goes into the system prompt, and the pipeline's repair loop
 * (which feeds validation errors back) does the rest.
 */
export function schemaInSystem(system: string, schema: unknown): string {
  return `${system}\n\nTrả về DUY NHẤT một JSON đúng schema sau, không giải thích, không dùng code fence:\n${JSON.stringify(schema)}`;
}

/** One-line descriptions that help a small model pick the right topic. */
export const TOPIC_HINTS: Record<string, string> = {
  uniformMotion:
    'Chuyển động thẳng đều của 1 hoặc 2 vật (xe, người) với vận tốc không đổi; bài toán gặp nhau, đuổi nhau.',
  uniformAcceleration:
    'Chuyển động thẳng nhanh/chậm dần đều có gia tốc; xe tăng tốc, hãm phanh; quãng đường, thời gian dừng.',
  freeFall: 'Rơi tự do hoặc ném thẳng đứng lên/xuống từ một độ cao.',
  horizontalProjectile: 'Ném ngang từ độ cao h với vận tốc ban đầu nằm ngang.',
  obliqueProjectile:
    'Ném xiên: vận tốc ban đầu hợp với phương ngang một góc; tầm xa, độ cao cực đại.',
  forceComposition:
    'Tổng hợp và phân tích lực, cân bằng lực: 2 hoặc 3 lực đồng quy nằm ngang tác dụng lên một vật (độ lớn và hướng, góc đo từ trục Ox), tìm hợp lực, thành phần theo hai trục, lực cần thêm để cân bằng. Đề chỉ cho góc giữa hai lực: không ghi a1 (lực thứ nhất dọc Ox), ghi a2 = góc giữa hai lực. Vật treo bằng dây (trọng lực, lực căng): chọn stringTension nếu có.',
  newtonLaws:
    'Vật trên mặt phẳng ngang bị kéo bởi lực F (có thể xiên góc), có ma sát; tìm gia tốc theo định luật II Newton.',
  stringTension:
    'Vật (đèn) đứng yên treo bằng một dây thẳng đứng hoặc hai dây buộc vào trần; góc của mỗi dây so với phương THẲNG ĐỨNG (a1 dây trái, a2 dây phải); trọng lực, lực căng mỗi dây. Đề cho góc so với phương ngang hoặc với trần: ghi vào clarifications, không tự đổi.',
  newtonThirdLaw:
    'Định luật III Newton: hai xe (vật) đứng yên, giữa có lò xo nhẹ bị nén, thả cho lò xo đẩy hai xe ra; lực mỗi xe nhận, gia tốc, vận tốc mỗi xe sau khi tách. Hai vật đang chuyển động va vào nhau: chọn collisions.',
  inclinedPlane:
    'Vật trên mặt phẳng nghiêng góc θ, có/không ma sát, trượt xuống hoặc được đẩy lên.',
  pulley: 'Hai vật nối dây qua ròng rọc: máy Atwood, một vật trên bàn/trên dốc và một vật treo.',
  hookeSpring: 'Lò xo: định luật Hooke, độ dãn khi treo vật, lực đàn hồi, chiều dài lò xo.',
  fluidFall:
    'Vật (quả cầu) rơi hoặc nổi trong chất lưu (không khí, nước) có lực cản F = ½ρC_dAv² và lực đẩy Archimedes: tốc độ giới hạn, thời gian rơi hết độ cao. Đề cho khối lượng riêng chất lưu khác 1,225 kg/m³ (không khí) hoặc 998 kg/m³ (nước) thì ghi fluid = 2 và rhoF. Lực cản tỉ lệ bậc nhất với v (F = kv): ghi vào unsupported_parts.',
  torqueBalance:
    'Moment lực, quy tắc moment, đòn bẩy/bập bênh: thanh quay quanh trục ở trung điểm, vật m1 cách trục d1 bên trái, vật m2 cách trục d2 bên phải; moment mỗi lực, vị trí đặt vật để thanh cân bằng. Trục không ở trung điểm, lực xiên, ngẫu lực: ghi vào unsupported_parts.',
  workPower:
    'Công, công suất, hiệu suất: kéo vật (thùng) từ đứng yên trên sàn ngang hoặc lên mặt phẳng nghiêng góc theta bằng lực F hợp với mặt phẳng góc beta, có ma sát mu, quãng đường length; công của từng lực, công suất, hiệu suất. Kéo đều (vận tốc không đổi), máy cơ, động cơ có công suất cho trước: ghi vào unsupported_parts.',
  energyConservation:
    'Bảo toàn cơ năng: vật trượt không ma sát trên máng/dốc cong, tốc độ ở độ cao khác.',
  collisions: 'Va chạm hai vật: đàn hồi, mềm (dính nhau), bảo toàn động lượng.',
  springPendulum: 'Con lắc lò xo dao động điều hòa: chu kì, biên độ, vận tốc cực đại, cơ năng.',
  simplePendulum: 'Con lắc đơn: chu kì, biên độ góc, vận tốc, lực căng dây.',
  uniformCircularMotion:
    'Chuyển động tròn đều: bán kính, tốc độ, tốc độ góc (rad/s), chu kì, tần số (Hz, vòng/s, vòng/phút), gia tốc hướng tâm, lực hướng tâm.',
  interference:
    'Giao thoa sóng trên mặt nước, hai nguồn kết hợp CÙNG PHA A, B (S₁, S₂): khoảng cách hai nguồn d (= AB), tần số f, tốc độ truyền sóng v hoặc bước sóng λ (đề cho λ thì ghi lambda và waveFrom = 1), biên độ a của mỗi nguồn, điểm M cách A khoảng d1 và cách B khoảng d2; số điểm cực đại, cực tiểu trên đoạn AB, biên độ tại M. Hai nguồn khác tần số f, f2: phách (mode = 1). Hai nguồn ngược pha hoặc lệch pha, biên độ hai nguồn khác nhau, điểm trên đường tròn/hình vuông, sóng ánh sáng (Young): ghi vào unsupported_parts. Đề cho khoảng cách giữa hai cực đại (hoặc hai cực tiểu) liên tiếp (= λ/2) hoặc biên độ cực đại, biên độ tổng hợp (= 2a): ghi vào clarifications, không tự nhân, chia để ra λ hay a. Chỉ ghi số có trong đề, không tự tính λ hay d1, d2.',
  standingWave:
    'Sóng dừng trên sợi dây CHỈ có hai đầu cố định (dây có một đầu tự do: ghi vào unsupported_parts): chiều dài dây, số bó sóng n (= số bụng; số nút là n + 1 — đề cho số nút thì ghi vào clarifications, không tự trừ), tần số, tốc độ truyền sóng, bước sóng, lực căng dây, mật độ dài (kg/m, g/m), biên độ A của mỗi sóng thành phần (đề cho biên độ bụng 2A thì ghi vào clarifications, không tự chia).',
  electricField:
    'Điện trường, định luật Coulomb: 1–3 điện tích điểm (q có dấu, C/µC/nC), cường độ điện trường tại điểm M, lực điện lên điện tích thử q0, lực tương tác giữa hai điện tích; hoặc tụ phẳng: điện trường đều E = U/d. Tọa độ: q1 ở A = gốc O, q2 ở B trên trục Ox (x2 = khoảng cách AB). M trên đường thẳng AB: xP = khoảng cách AM, dương về phía B, âm khi M nằm ngoài đoạn AB về phía A. Chỉ ghi yP khi đề viết số (ví dụ M(3; 0)); không tự ghi yP = 0, học sinh sẽ xác nhận. M không nằm trên đường thẳng AB (ví dụ chỉ cho MA, MB): không ghi xP, yP và hỏi lại trong clarifications. Chỉ ghi tọa độ có sẵn trong đề, không tự tính. Chân không hoặc không khí; có hằng số điện môi ε thì ghi vào unsupported_parts.',
  dcCircuit:
    'Mạch điện một chiều: nguồn có suất điện động E và điện trở trong r, mạch ngoài 1–3 điện trở (nối tiếp, song song, R1 nt (R2 // R3), (R1 nt R2) // R3); định luật Ohm cho toàn mạch, hiệu điện thế hai cực, công suất, hiệu suất. Hiệu điện thế giữa hai cực khác suất điện động, trừ khi r = 0: đề chỉ cho "hiệu điện thế 12 V" đặt vào mạch thì ghi emf = 12 và không ghi rInt. Đề không cho r thì không ghi rInt (app dùng r = 0). Tụ điện, đèn có điện trở đổi theo nhiệt độ, nhiều nguồn: ghi vào unsupported_parts.',
};

export function classificationSystem(topics: { id: string; title: string }[]): string {
  const list = topics.map((t) => `- ${t.id}: ${t.title} — ${TOPIC_HINTS[t.id] ?? ''}`).join('\n');
  return `Bạn là bộ PHÂN LOẠI đề bài Vật lí THPT (tiếng Việt).
Nhiệm vụ DUY NHẤT: chọn MỘT chủ đề trong danh sách phù hợp nhất với đề bài.
- KHÔNG giải bài, KHÔNG tính toán, KHÔNG viết số liệu mới.
- Nếu đề không thuộc chủ đề nào, chọn "unsupported".
- unsupported_parts: liệt kê những phần của đề mà chủ đề đã chọn không mô phỏng được (có thể rỗng).
- reason: một câu ngắn giải thích lựa chọn.${SAFETY_RULES}
Danh sách chủ đề:
${list}
Chỉ trả về JSON đúng schema.`;
}

export function extractionSystem(
  scene: PhysicsScene,
  questions: { id: string; label: string }[],
): string {
  const params = scene.params
    .map((d) => {
      const units = allowedUnits(scene, d.key).map(
        (u) => `"${u}"${u === '1' ? '' : ` (${unitLabel(u)})`}`,
      );
      const choices =
        d.kind === 'choice'
          ? ` Lựa chọn: ${(d.choices ?? []).map((c) => `${c.value} = ${c.label.vi}`).join('; ')}.`
          : d.kind === 'toggle'
            ? ' Giá trị 1 = có, 0 = không.'
            : '';
      return `- ${d.key}: ${d.label.vi}${d.symbol ? ` (ký hiệu ${d.symbol})` : ''}. Đơn vị hợp lệ: ${units.join(', ')}.${choices}`;
    })
    .join('\n');
  const qs = questions.map((q) => `- ${q.id}: ${q.label}`).join('\n');
  return `Bạn TRÍCH XUẤT dữ kiện từ đề bài Vật lí (chủ đề: ${scene.title.vi}) thành JSON.
QUY TẮC BẮT BUỘC:
1. Chỉ lấy các con số ĐƯỢC VIẾT TRONG ĐỀ. Tuyệt đối không tính toán, không đổi đơn vị, không suy ra số mới.
2. Giữ nguyên đơn vị như đề viết (ví dụ "72 km/h" → value 72, unit "km/h"; "30°" → value 30, unit "deg"; "50 g" → value 50, unit "g").
3. quote: chép NGUYÊN VĂN cụm từ ngắn trong đề chứa con số đó.
4. Nếu đề KHÔNG cho một đại lượng thì KHÔNG đưa vào quantities (chương trình sẽ tự điền giá trị mặc định và đánh dấu). Nếu đại lượng đó bắt buộc để giải, ghi câu hỏi vào clarifications.
5. Dấu: chọn chiều dương như mô tả của đại lượng; vật đi ngược chiều dương thì value âm (con số vẫn phải có trong đề).
6. Với đại lượng dạng lựa chọn (0/1/2), chọn đúng giá trị mô tả cách bố trí trong đề; quote là cụm từ mô tả.
7. questions: những đại lượng đề hỏi, chỉ chọn trong danh sách dưới.
8. assumptions: giả thiết đề nêu (ví dụ "bỏ qua sức cản không khí", "lấy g = 10 m/s²").
9. unsupported_parts: phần của đề mà mô phỏng này không xử lý được. Không được lặng lẽ bỏ qua.${SAFETY_RULES}
Các đại lượng:
${params}
Các câu hỏi có thể có:
${qs}
Chỉ trả về JSON đúng schema.`;
}
