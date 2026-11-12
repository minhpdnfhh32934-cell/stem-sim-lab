# 234 bước 4 — Trạm AI Teacher: sân khấu, tab đánh số, chip kết nối, thẻ kính

- **Goal:** bước 4 của #234: sân khấu riêng (tối ở giao diện tối, xám rất nhạt ở giao diện sáng),
  tab `01 TRÒ CHUYỆN · 02 BẢNG GIẢNG` có gạch chân trượt, chip kết nối thay `teacher__engine-pill`,
  câu trả lời trên thẻ kính, quả cầu thu nhỏ về góc trên bên trái khi sang bảng giảng, trạng thái
  quả cầu đọc qua `aria-live="polite"`. E2E ở 1366×768, 100 % và 140 %, sáng và tối.
- **Date/time:** 2026-11-13 (máy bàn)
- **Status:** PASS
- **Branch / base:** `feat/234-teacher-stage`, PR vào `feat/234-orb-view` (đã có bước 3, #240); đổi
  base sang `main` sau khi #241 vào.

## Đã làm

- `TeacherScreen.tsx`:
  - hàng đầu trang: quay lại · "Là một AI" · (i) · tab đánh số · chip kết nối. Tab vẫn là
    `radiogroup` với hai `radio` (giữ `teacherStore.layout`); số `01` / `02` là `aria-hidden`,
    gạch chân do `slidingIndicator.ts` (lớp `tabs__list`) trượt.
  - chip kết nối đọc `useAiStatusView()` (cùng nguồn với nút trạng thái ở đầu trang), nên không
    còn cảnh chip ghi "AI trực tuyến" khi đầu trang ghi "Chưa kết nối AI" (#233). Chip chỉ hiện khi
    có AI trả lời được (trực tuyến hoặc trên máy); khi chưa kết nối, đầu trang và nút "Kết nối AI"
    đã nói, và trang không lặp lại "Chưa kết nối" (#205 B5).
  - dưới quả cầu: trạng thái bằng chữ (`teacher.state.*`), `aria-live="polite"`; quả cầu vẫn
    `aria-hidden`. Hai câu chào cũ (`talkCaption`, `boardCaption`) được bỏ.
  - `data-glass`: `solid` khi bậc chất lượng thực tế là Low (cả khi thang quá tải đã hạ bậc).
- `glide.ts` (mới): quả cầu trượt giữa hai bố cục bằng một `transform` (FLIP, 500 ms), nên khung
  vẽ chỉ đổi cỡ một lần; giảm chuyển động thì nhảy ngay. Bỏ chuyển động `width` /
  `grid-template-columns` 480 ms cũ (đổi cỡ khung vẽ mỗi khung hình).
- `teacher.css`: sân khấu `--teacher-bg` + quầng `--teacher-glow`; chữ trên sân khấu dùng
  `--teacher-text(-muted)` (đã kiểm ≥ 4,5 : 1 ở bước 1); bảng giữ màu riêng. Thẻ kính:
  `--teacher-glass` (trong mờ), `--teacher-glass-solid` ở Low; không `backdrop-filter`.
- **Khác bản phác của #234 (lý do đo được):**
  - Bố cục "trò chuyện": quả cầu ở **bên trái** cuộc trò chuyện, không ở trên. Đo ở 1366×768:
    quả cầu ở trên chỉ để lại khoảng 180 px chiều cao cho câu trả lời (ảnh chụp); màn hình thiếu
    chiều cao chứ không thiếu chiều ngang. Cuộc trò chuyện vẫn chiếm ≥ 70 % bề ngang (#205 B5).
  - Đầu thẻ không thêm chip động cơ / chip trạng thái: `AiContentBar` ở chân mỗi thẻ đã ghi mô hình
    và "dự phòng"; trạng thái nằm dưới quả cầu. Dòng "thời gian trả lời" ở Nâng cao chưa làm: app
    chưa ghi thời gian trả lời, không bịa số.
- Tên tab "Giảng trên bảng" → "Bảng giảng" (khớp `02 BẢNG GIẢNG`); các test chỉ đổi tên nút chọn.
- `board.css`: chữ "bảng trống" 62 % → 70 % mực: axe báo 4,23 : 1 trên bảng sáng (có sẵn trên
  `main`), nay 5,40 : 1 (tối 7,17 : 1).

## Tests

- **Unit:** `glide.test.ts` (3): đường trượt to → góc và ngược lại (công thức đóng); không trượt
  khi hộp không đổi hoặc chưa có cỡ.
- **E2E mới** `teacher-station.spec.ts` (7, `chromium`): sáng/tối × 100 %/140 % ở 1366×768 (tab
  radio có `01`/`02`, ≥ 40 px; chưa kết nối thì không có chip; trạng thái `aria-live="polite"`;
  quả cầu bên trái, cuộc trò chuyện cao > 560 px; sang bảng quả cầu 88 px ở góc; không cuộn ngang;
  axe không có lỗi nghiêm trọng ở hai bố cục); quả cầu trượt khi đổi bố cục và không trượt khi
  giảm chuyển động; thẻ kính ở medium (alpha < 1) và nền đặc ở low (alpha = 1), không
  `backdrop-filter`, có nhãn AI và nút báo cáo, chip đúng chữ của nút đầu trang.
- Axe tìm được lỗi có sẵn: chữ "bảng trống" 4,23 : 1 trên bảng sáng (đã sửa, xem trên).
- Lần chạy đầu ở giao diện sáng 100 % hỏng vì trang tải chậm lần đầu sau khi sửa CSS (máy chủ thử
  biên dịch lại): đã cho chờ 20 s như các spec AI Teacher khác (môi trường, không phải lỗi app).

## Commands run (real results, summary lines only)

- `npm run check`: 409 tệp test đạt, 2 bỏ qua; 5147 test đạt, 3 bỏ qua.
- `npm run format:check`: đạt.
- `npx playwright test --workers=2`: 288 passed (9,0 phút).
- Không đổi Rust.

## Next steps and limits

- Chưa đo khung hình trên card tích hợp.
- Bước 5: tab Nâng cao 04 GHI NHỚ và 06 LƯỢT DÙNG. Bước 6: tài liệu, 0.8.2.
