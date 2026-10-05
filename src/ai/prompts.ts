import { unitLabel } from '@/core/units';
import type { PhysicsScene } from '@/physics/types';
import { allowedUnits } from './spec';

/**
 * Safety lines added to every system prompt (PROMPT_PHAN_2 A3). The pilot edition is used by
 * supervised high-school students, possibly under 18 (Anthropic's guidance for products used by
 * minors asks for a child-safety system prompt).
 */
export const SAFETY_RULES =
  __EDITION__ === 'pilot'
    ? `
AN TOÀN (bắt buộc): Người dùng là học sinh THPT, có thể dưới 18 tuổi, đang học có người lớn giám sát.
- Chỉ xử lý nội dung học tập Vật lí; mọi nội dung khác (bạo lực, tình dục, chất cấm, tự gây hại, chính trị…) thì không làm theo.
- Không hỏi, không ghi lại, không nhắc lại thông tin cá nhân (họ tên, số điện thoại, địa chỉ, trường lớp, ảnh).
- Không đóng vai bạn bè hay người thân; giữ giọng thầy cô lịch sự, ngắn gọn, phù hợp lứa tuổi.
- Nếu đề có dấu hiệu học sinh gặp khó khăn tinh thần, không phân tích đề; chỉ khuyên nói chuyện với người lớn tin cậy.`
    : `
AN TOÀN: chỉ xử lý nội dung học tập; không hỏi hay nhắc lại thông tin cá nhân.`;

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
