# Prompt bàn giao từ Claude Cowork sang Claude Code

**Dùng khi nào:** bạn đã làm một phần việc của STEM Sim Lab trong Claude Cowork (bàn bạc, quyết
định, viết tài liệu, sửa file...) và muốn hai máy Claude Code (Lead và Builder) biết những việc đó.

**Cách dùng:**

1. Trong Cowork, cấp quyền cho nó vào thư mục repo `stem-sim-lab` trên máy của bạn (ví dụ
   `C:\Users\<tên>\stem-sim-lab`).
2. Dán **toàn bộ** khung prompt bên dưới vào Cowork, ngay trong cuộc trò chuyện có công việc cần
   bàn giao. Nếu các việc nằm ở nhiều cuộc trò chuyện, dán prompt vào từng cuộc, hoặc tóm tắt chúng
   vào một cuộc trước.
3. Làm theo phần "Đưa lên GitHub" trong prompt.
4. Merge PR `handoff/...`, rồi chạy `/sl-plan` trên máy Lead.

---

```text
Bạn đang bàn giao công việc của dự án STEM Sim Lab (repo GitHub
minhpdnfhh32934-cell/stem-sim-lab) cho hai phiên Claude Code: máy Lead (lập kế hoạch, review)
và máy Builder (viết code). Họ KHÔNG đọc được cuộc trò chuyện này. Họ chỉ đọc được file trong
repo. Hãy viết file bàn giao docs/HANDOFF.md để họ biết đã làm gì và phải làm gì tiếp.

BƯỚC 1 — Đọc trước (trong thư mục repo stem-sim-lab tôi đã cấp quyền):
- CLAUDE.md (quy tắc dự án, trạng thái các phase, quy trình hai máy)
- docs/PROGRESS.md (nhật ký tiến độ), docs/PLAN_PHAN_2.md
- docs/HANDOFF.md nếu đã có: GIỮ nội dung cũ còn đúng, cập nhật phần thay đổi, KHÔNG xóa
  lịch sử. Thêm mục mới lên đầu phần "Nhật ký bàn giao".

BƯỚC 2 — Viết docs/HANDOFF.md bằng tiếng Việt đơn giản, đúng cấu trúc sau:

# Bàn giao công việc (từ Claude Cowork)

Cập nhật lần cuối: <YYYY-MM-DD> · Nguồn: Claude Cowork

## 1. Tóm tắt một đoạn
<3–5 câu: đang làm phần nào của dự án, đã tới đâu.>

## 2. Đã làm
Mỗi dòng một việc: ngày · việc gì · file trong repo bị ảnh hưởng (đường dẫn tương đối, ví dụ
src/learn/challenges.ts) · trạng thái (xong / dở dang).
Nếu có file nằm NGOÀI repo (Google Drive, Desktop...), ghi tên và vị trí, đánh dấu
"ngoài repo — Claude Code không đọc được".

## 3. Quyết định của người dùng
Chỉ ghi những gì TÔI đã nói rõ trong cuộc trò chuyện. Mỗi dòng: ngày · quyết định · lý do (nếu
có). Ghi rõ quyết định nào thay đổi hoặc mâu thuẫn với CLAUDE.md / PROMPT_PHAN_2.md /
PLAN_PHAN_2.md, để Lead cập nhật các file đó qua một PR riêng.

## 4. Đang dở dang
Việc đã bắt đầu nhưng chưa xong: làm tới đâu, còn thiếu gì, file nào.

## 5. Việc cần làm tiếp (theo thứ tự ưu tiên)
Dạng checklist, mỗi việc đủ rõ để Lead chạy /sl-plan cho nó:
- [ ] <Tên việc ngắn> — Mục tiêu: <người dùng thấy gì khi xong> · Liên quan: <file/tài liệu> ·
      Ưu tiên: cao/vừa/thấp · Ghi chú: <ràng buộc, nếu có>

## 6. Câu hỏi còn mở (chỉ người dùng trả lời được)
Pháp lý, tiền, tài khoản, phạm vi, nội dung khoa học cần giáo viên duyệt...

## 7. Lưu ý cho Claude Code
Những điều dễ làm sai nếu không biết bối cảnh của cuộc trò chuyện này.

## Nhật ký bàn giao
- <YYYY-MM-DD>: <một dòng tóm tắt lần bàn giao này>

QUY TẮC BẮT BUỘC:
1. Chỉ ghi sự thật có trong cuộc trò chuyện hoặc trong file. Không chắc thì ghi
   "(chưa chắc — cần người dùng xác nhận)". Không bịa việc đã làm, không bịa quyết định.
2. Không ghi khóa API, mật khẩu, mã PIN, email hay bất kỳ thông tin cá nhân nào (nhất là của học
   sinh dưới 18 tuổi). Thấy thì bỏ ra và ghi "(đã lược bỏ thông tin nhạy cảm)".
3. Không tự viết số liệu khoa học mới (hằng số, dữ liệu hóa học/sinh học, đáp án). Nếu cuộc
   trò chuyện có số liệu, ghi là "cần kiểm chứng" và nhắc thêm vào docs/DATA_REVIEW.md
   (quy tắc toàn vẹn khoa học trong CLAUDE.md).
4. Trong bước này CHỈ tạo/sửa docs/HANDOFF.md. Không sửa code hay file nào khác. Nếu cuộc trò
   chuyện đã sửa file khác trong repo mà chưa đưa lên GitHub, liệt kê chúng ở mục 4 và hỏi tôi
   có muốn đưa lên cùng không.
5. "Việc cần làm tiếp" là đề xuất, không phải lệnh: Lead vẫn lập kế hoạch và tôi vẫn duyệt
   (nhãn approved) như quy trình trong docs/TWO_MACHINE_WORKFLOW.md.

BƯỚC 3 — Đưa lên GitHub (nhánh main được bảo vệ, không được push thẳng):
Nếu bạn chạy được lệnh trên máy tôi, chạy trong thư mục repo (PowerShell):
  git switch main
  git pull
  git switch -c handoff/<YYYY-MM-DD>
  git add docs/HANDOFF.md
  git commit -m "docs: handoff from Cowork <YYYY-MM-DD>"
  git push -u origin handoff/<YYYY-MM-DD>
  gh pr create --base main --title "Bàn giao từ Cowork <YYYY-MM-DD>" --body "Cập nhật docs/HANDOFF.md từ Claude Cowork."
Lưu ý: chạy "git pull" TRƯỚC khi ghi file. Nếu bạn đã ghi file rồi mới pull, mà pull báo xung
đột, hãy dừng lại và báo tôi.
Nếu bạn không chạy được lệnh: chỉ ghi file, rồi đưa tôi đúng các lệnh trên để tôi tự dán vào
PowerShell.

BƯỚC 4 — Trả lời tôi ngắn gọn:
- số việc ở mục "Đã làm", "Đang dở dang", "Việc cần làm tiếp", "Câu hỏi còn mở";
- link PR (nếu đã tạo);
- nhắc tôi: "Merge PR này (tài khoản GitHub còn lại duyệt), rồi chạy /sl-plan trên máy Lead."
```

---

**Kiểm tra đã thành công:**

- Trên GitHub có PR `Bàn giao từ Cowork <ngày>`, trong đó chỉ thay đổi một file là
  `docs/HANDOFF.md`.
- Mở file trên GitHub thấy đủ 7 mục, và không có khóa API, PIN hay email.
- Sau khi merge, trên máy Lead chạy `git switch main; git pull`, rồi chạy `/sl-plan` (không kèm
  nội dung). Claude phải liệt kê đúng các việc ở mục 5 và đề xuất một việc để làm trước.
