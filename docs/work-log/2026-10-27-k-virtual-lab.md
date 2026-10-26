# (k) — "Phòng thí nghiệm" thành "Virtual Lab" (issue #73, kế hoạch #37 §9d)

- **Status:** PASS (unit); E2E: xem dưới
- **Branch / base:** `feat/73-virtual-lab` từ `main` c621f3f

## Đã làm

- 7 chuỗi vi + 7 chuỗi en (`lab`, `labTitle`, `backToLab`, `preparing.*`, `openLab`, `openInLab`) thành "Virtual Lab"; mã bên trong giữ nguyên.
- Test tìm nút theo tên mới (nav.ts, studio/teacher/learner spec, app.test, PoeFlow, usePublishCard). Ctrl+K: từ khoá "phong thi nghiem" (test mới, thử bỏ thì hỏng).
- Tài liệu: USER_GUIDE, ARCHITECTURE, AI_TUTOR, README, release-notes/README, CLAUDE.md (quyết định 23/10).
- Giữ tên cũ: lịch sử phát hành, work-log cũ, dòng PROGRESS cũ, trang Store (bạn sửa tay), câu đề mẫu trong speechPlan.test.ts. Giọng đọc không đọc tên này nên không thêm cách đọc.

## Kiểm tra

- typecheck, eslint, Prettier: đạt. `npm test`: 4282 đạt, 1 hỏng do máy tải (app.test Science Studio; chạy riêng đạt).
- E2E đầy đủ: 93 đạt, 1 hỏng quá giờ (chemistry, chạy lại 6/6 đạt). Nhóm 3D chạy lại lúc máy tải nặng: 31 đạt, 5 hỏng vì khung 3D chưa hiện kịp (không liên quan đổi chữ) — cần chạy lại khi máy rảnh.
- Rà soát workflow (10 agent): không có lỗi chặn; 2 gợi ý đã làm (Ctrl+K, tệp work-log này).

## Còn lại

- Ghi chú 0.8.0 nêu tên mới (PR phiên bản 31/10). Mô tả Store sửa tay trong Partner Center.
