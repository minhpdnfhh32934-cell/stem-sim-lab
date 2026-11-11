# 202 — Bench: chữ theo Cỡ chữ, ảnh thẻ khi đổi sáng/tối, nút Thoát trình chiếu, nút sáng/tối

- **Goal:** sửa ba lỗi có từ trước B8 mà mọi người dùng sẽ gặp từ 0.8.1, và đổi nút sáng/tối theo
  yêu cầu của người dùng (việc 4, ghi ở issue ngày 11/11/2026). Danh sách kiểm tra R1–R10.
- **Date/time:** 2026-11-12, +07:00 (máy bàn)
- **Branch / base:** `feat/202-bench-text-theme-exit`, từ `origin/main` `f2e535e` (sau #198)
- Commit đầu: "docs: B8 done" (BENCH_DESIGN §14, PROGRESS), vì CI run 43051736789 của `d086b3e`
  đã xanh 8/8 và #198 đã vào main.

## Tiêu chí (từ issue) và cách kiểm

| Tiêu chí                                | Cách kiểm (không dựa vào mã đang kiểm)                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Mọi chữ của bench theo Cỡ chữ           | E2E: cỡ chữ của các dòng trên kệ và mép bàn ở 140 % bằng 1,4 × ở 100 %                              |
| 100 % không đổi điểm ảnh nào            | cả nhóm E2E nhẹ đang ghim kích thước (khe 168×40, cửa 268×168…) vẫn đạt                             |
| Ảnh thẻ đúng màu sau khi đổi giao diện  | E2E ghi màu mọi nét viền nhãn vẽ trên ảnh thẻ, so với `--bg-stage` tối đọc từ trang                 |
| Nút Thoát ≥ 40 px, không che điều khiển | E2E trình chiếu ở Nguyên phân 3D: nút ≥ 40 px, nằm hẳn bên phải khung (`.m3d__side` không bị che)   |
| Nút sáng/tối 40×40, không tràn, ≥ 3 : 1 | E2E 100 % và 140 %, cả hai giao diện: cỡ nút, cạnh phải ≤ 1366, tương phản biểu tượng / nền đầu bàn |

## Nguyên nhân gốc và cách sửa

- **Ảnh thẻ (việc 2):** `src/physics/render/draw.ts` giữ màu viền nhãn trong một biến của
  module (`halo`), chỉ `drawGrid` đặt. Ảnh thẻ vẽ không lưới, nên nhãn lấy màu khung mô phỏng vẽ
  lần cuối, tức giao diện cũ sau khi đổi; tải lại trang thì `halo` rỗng. Thêm `setLabelHalo`
  (bắt đầu mỗi khung); `SceneStill` gọi với `--bg-stage` của giao diện đang hiện (nền ảnh thẻ).
- **Nút Thoát (việc 3):** nút cố định ở góc phải đè lên khung; chỉ HUD Vật lí có luật chừa chỗ.
  Khi trình chiếu, khung mô phỏng chừa một cột bên phải bằng cỡ nút cộng khoảng cách; nút cỡ
  `var(--target)`. Luật riêng cho HUD bỏ đi. Đo lại: trong chế độ trình chiếu nút vốn đã 47,5 px
  (chữ trình chiếu ×1,25), nên lỗi thật là phần che.
- **Nút sáng/tối (việc 4):** `ThemeSwitch.tsx` thành `IconButton` mặt trăng ⇄ mặt trời,
  `aria-pressed` = tối, tên "Giao diện tối" là tooltip; "Theo máy" vẫn ở Cài đặt; khoá lưu không
  đổi. Bỏ CSS, token `--sw-*` (cùng phép kiểm tương phản của chúng, vì công tắc đã bỏ) và dòng
  THIRD_PARTY của công tắc uiverse; BENCH_DESIGN ghi quyết định mới.
- **Cỡ chữ (việc 1):** `font-size` và `line-height` ghi px trong `bench.css` (34 + 38), `chat.css`
  (4) và nhãn HTML của phân tử 3D thành `calc(Nrem / 14)`: đúng từng điểm ảnh ở 100 %. Chỗ chừa
  cho dòng dấu và dòng "Còn: …" của thẻ, chấm của nút nhắc cập nhật cũng theo chữ. **Giữ px có chủ
  ý:** chữ nằm trong hình vẽ, co giãn theo hình: tờ bảng trắng (`board.css`, đơn vị của bảng,
  `layout.ts` xếp theo), nhãn SVG của Hoá (`.eq-energy__text`, `.tit-label`), ống nghiệm Studio
  (`.chem-tube__label`), hình hướng dẫn AI (`.guide-art__text`).

## Kết quả

- Mỗi việc bắt đầu bằng test hỏng trên mã cũ: ảnh thẻ (viền `#fcfcfa` thay vì `#20262b`), nút
  Thoát (x 1303 < 1366), nút sáng/tối (`ThemeSwitch.test`, `app.test`: 4 FAIL), cỡ chữ (tiêu đề
  thẻ 16 px thay vì 22,4 px). Sau khi sửa: PASS.
- `npm run check`: PASS (5033 qua, 1 bỏ qua có sẵn); `format:check`: PASS.
- E2E nhóm nhẹ sau việc 1: 163/163 PASS (100 % không đổi điểm ảnh).
- E2E đủ nhóm, 4 worker (máy bàn): **212/212 PASS** trong một lượt (`chromium` 163, `chromium-3d`
  48, `chromium-3d-perf` 1). Hai lượt trước có lỗi; tìm nguyên nhân gốc rồi mới chạy lại:
  - "a reminder to rest the eyes…" (`learner.spec`): chập chờn, kể cả chạy riêng (khoảng 1 trong
    3–4 lần). Trace: lần `clock.fastForward` thứ hai không bao giờ xong. Nguyên nhân: benchmark lúc
    mở app chạy vòng `while (now() - start < 600)`, mà dưới đồng hồ giả `performance.now()` không
    chạy, nên trang treo. Sửa test (gieo sẵn kết quả benchmark, như các spec 3D gieo
    `stemsim.perf`); phép kiểm giữ nguyên. Lặp 8 lần: 8 PASS.
  - "cell structure: … targets" (`biology.spec:195`): FAIL 15/16 khi chạy sau test mở mọi bài Sinh
    trong cùng worker; trên `main` (`f2e535e`) cũng hỏng y vậy, nên có từ trước #202. Nguyên nhân:
    đếm trước khi hình 3D (nạp lười) kịp hiện nút "Hiện tên các bộ phận". Test chờ nút đó; phép
    đếm và cỡ giữ nguyên. Chạy cặp đó 2 lần: PASS.
  - `ai-flow.spec:147`: một lần nút vẫn "AI đang viết diễn giải…" sau 5 s (máy bận); chạy riêng
    PASS. Ba lỗi `page.goto` hết giờ ở nhóm 3D: dev server máy bàn nghẽn, như #198.
