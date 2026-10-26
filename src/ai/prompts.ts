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
  newtonLaws:
    'Vật trên mặt phẳng ngang bị kéo bởi lực F (có thể xiên góc), có ma sát; tìm gia tốc theo định luật II Newton.',
  inclinedPlane:
    'Vật trên mặt phẳng nghiêng góc θ, có/không ma sát, trượt xuống hoặc được đẩy lên.',
  pulley: 'Hai vật nối dây qua ròng rọc: máy Atwood, một vật trên bàn/trên dốc và một vật treo.',
  hookeSpring: 'Lò xo: định luật Hooke, độ dãn khi treo vật, lực đàn hồi, chiều dài lò xo.',
  energyConservation:
    'Bảo toàn cơ năng: vật trượt không ma sát trên máng/dốc cong, tốc độ ở độ cao khác.',
  collisions: 'Va chạm hai vật: đàn hồi, mềm (dính nhau), bảo toàn động lượng.',
  springPendulum: 'Con lắc lò xo dao động điều hòa: chu kì, biên độ, vận tốc cực đại, cơ năng.',
  simplePendulum: 'Con lắc đơn: chu kì, biên độ góc, vận tốc, lực căng dây.',
  uniformCircularMotion:
    'Chuyển động tròn đều: bán kính, tốc độ, tốc độ góc (rad/s), chu kì, tần số (Hz, vòng/s, vòng/phút), gia tốc hướng tâm, lực hướng tâm.',
  electricField:
    'Điện trường, định luật Coulomb: 1–3 điện tích điểm (q có dấu, C/µC/nC), cường độ điện trường tại điểm M, lực điện lên điện tích thử q0, lực tương tác giữa hai điện tích; hoặc tụ phẳng: điện trường đều E = U/d. Tọa độ: q1 ở A = gốc O, q2 ở B trên trục Ox (x2 = khoảng cách AB). M trên đường thẳng AB: xP = khoảng cách AM, dương về phía B, âm khi M nằm ngoài đoạn AB về phía A; yP = 0 kèm trích dẫn "trên đoạn AB", "trên đường thẳng AB" hoặc "trung điểm của AB". M không nằm trên đường thẳng AB (ví dụ chỉ cho MA, MB): không ghi xP, yP và hỏi lại trong clarifications. Chỉ ghi tọa độ có sẵn trong đề, không tự tính. Chân không hoặc không khí; có hằng số điện môi ε thì ghi vào unsupported_parts.',
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
