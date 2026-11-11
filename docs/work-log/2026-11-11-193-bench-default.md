# 193 — B8: Bàn thí nghiệm thành giao diện mặc định, xoá giao diện cũ

- **Goal:** người học mở bản phát hành thấy ngay Bàn thí nghiệm; giao diện cũ, test của nó,
  `--glass-*`, khối nền trang mở đầu cũ và khoá i18n thừa bị xoá sau khi test hai bên đủ cặp.
- **Date/time:** 2026-11-11, +07:00 (máy bàn)
- **Branch / base:** `feat/193-bench-default`, từ `origin/main` `aadc36a`, cập nhật với `d079b3f`
- **Phép sửa config:** người dùng cho phép sửa `playwright.config.ts` và `.github/workflows/ci.yml`
  (trả lời trực tiếp ở máy bàn ngày 11/11: "Cho phép").

## Tiêu chí (từ issue) và cách kiểm

| Tiêu chí                        | Cách kiểm (không dựa vào mã đang kiểm)                                         |
| ------------------------------- | ------------------------------------------------------------------------------ |
| Đủ cặp trước khi xoá            | mọi tên test chạy được của 37 spec cũ có trong `tests/e2e/bench/` (143/143)    |
| Bản phát hành mở Bàn thí nghiệm | `src/app/App.test.tsx`: `<App/>` đặt `data-shell="bench"`, bỏ qua khoá cũ      |
| Bản lưu 0.7.1 mở không lỗi      | `src/app/bench/upgrade071.test.ts`: dữ liệu đúng dạng tag `v0.7.1`             |
| Không còn mã chết               | dò import từ `src/main.tsx` trên main và trên nhánh: 0 tệp mới bị bỏ rơi       |
| Không test nào yếu đi           | số test 3 nhóm E2E = số của 3 nhóm bench cũ (156, 44, 1); unit test chuyển chỗ |

## Xoá

- Mã: `AppShell`/`ClassicShell`, `TopBar`, `StatusBar`, `Timeline`, `BottomPanel`, `LeftSidebar`,
  `SubjectSwitch`, `LandingScreen` (trang mở đầu cũ, có khối nền trôi), `ChatBubble`, `tauri.ts`.
  Danh sách lấy từ phép dò import: 9 tệp mới không còn ai import sau khi `App` dùng `BenchShell`.
- CSS: rule chỉ dành cho 64 class của các tệp trên (~790 dòng, script bỏ selector, rule rỗng và
  `@media` rỗng), `@keyframes launch-blob-drift`.
- `--glass-*`: mọi chỗ dùng lấy đúng giá trị bench vẫn đang ra (`--bg-panel`, `--border`, không
  blur, không viền sáng) nên bench không đổi điểm ảnh nào; bỏ khối `@supports` dự phòng.
- i18n: 30 khoá chỉ các tệp trên dùng (vi và en); typecheck chứng minh không còn mã nào gọi chúng.
- Test: 37 spec cũ, `scripts/e2e/title-parity.mjs` + `.d.mts` + `tests/titleParity.test.ts` + bước
  CI (không còn gì để so), `tests/e2e/bench/storage-state.json` (chỉ khác bản chung ở công tắc dev),
  `LeftSidebar.test.tsx`, `shellMode.test.ts`.

## Giữ lại điều bench còn thiếu

- **Cảnh báo quá tải** (MASTER_PROMPT §2.6): "Chuyển động chậm ×…" và "Đã hạ chất lượng hiển thị…"
  chỉ có ở thanh trạng thái cũ. Nay `PerfNotes` hiện trên khung: trong HUD (Vật lí) hoặc giữa mép
  trên khung (mô-đun). Test `PerfNotes.test.tsx`.
- **Kệ bài khi tìm không thấy** (§9.3): "Có n chủ đề ở <môn>" và "Xem tất cả" (lớp), tiêu điểm về
  "Tất cả"; số đếm của chương luôn tính cả chương khi đang tìm.

## Unit test chuyển sang bench (cùng điều kiểm)

`tests/app.test.tsx` (khung app), `bottomPanel.test.tsx` (thẻ bảng phụ trong sổ), `Library.test.tsx`
(+5: dấu "Đã mở/Đã xong", số chương khi tìm, xem theo lớp, lớp trống; thay `LeftSidebar.test.tsx` và
hai test của `learner.test.tsx`), `PoeFlow.test.tsx` (lối vào Studio), `AskTeacher.test.tsx` (quyền
riêng tư "Hỏi thầy" trên sổ thay bong bóng), `FirstRun.test.tsx` (cổng 18+ bước 2/3).

## Ngoài phạm vi / việc sau

- Nhánh `BenchContext` cổ điển còn trong vài thành phần dùng chung (luôn `true` trong app).
- `stemsim.layout` giữ các trường cũ (`leftWidth`…) để không đổi version của store.
- Thanh trạng thái cũ còn hiện FPS/RAM/phiên bản (Nâng cao) và nhắc cập nhật sau "Để sau": bench
  không có; phiên bản xem ở Cài đặt → Lịch sử phiên bản, cập nhật qua menu ☰.
- Mục 0.8.1 trong `release-notes/versions.json`: test buộc mục đầu trùng `package.json` (0.8.0);
  thêm mục mới cần đổi số phiên bản, việc của #194. Câu ghi chú B8 soạn sẵn trong PR.

## Kết quả

- `npm run check`: PASS (5027 qua, 1 bỏ qua có sẵn); `format:check`: PASS.
- E2E trên máy bàn với 16 worker (mặc định): FAIL hàng loạt, ~100/156 `page.goto` hết 60 s ngay lần mở
  `/` đầu tiên. **Môi trường, không phải B8:** commit trước khi chuyển khung (`2d047c4`, sáng 11/11 đạt
  156/156) chạy lại sau khi máy khởi động lại cũng FAIL 101/156 cùng kiểu lỗi (thử A/B trong worktree
  tạm). Đo thời gian trả lời `/` khi đang chạy: 8,5 / 18,5 / 28,5 s… (kết nối TCP thử lại), Vite chỉ
  nghe `[::1]:1420`; WARP đang tắt.
- E2E 4 worker trên máy bàn: chromium 148/156, chromium-3d 40/44, perf 1/1. Lỗi còn lại: `page.goto`
  hết giờ (môi trường), một test bảng trắng chập chờn (chạy riêng 6/6 PASS). Hai lỗi thật đã sửa:
  thứ tự CSS (`bench.css` phải nạp cuối, 5 test controls/frame) và `project.spec` "first run" (trước B8
  chạy luồng lần đầu của khung cũ vì context trống không có công tắc; nay theo luồng bench).
- Kiểm WebView2 native (bản `tauri build --debug --no-bundle`, identifier tạm `vn.stemsimlab.b8check`
  qua `--config`, hồ sơ tạm đã xoá; Edge WebView2 157, màn 125 %):
  - (a) cửa sổ 1366×690 CSS px (máy 1366×768 phóng to): khung mô phỏng 998×578, mép bàn đủ, không cuộn:
    PASS (`docs/images/b8-native-1366x690.png`).
  - (b) KaTeX dưới CSP thật (script nội tuyến bị chặn): 45 phần tử `top:` nội tuyến, 0 bị chặn; chỉ số
    dưới đúng chỗ: PASS (`docs/images/b8-native-katex.png`).
  - (c) dấu tiếng Việt: Be Vietnam Pro 400/500/600 vẽ đủ "Ặ Ẫ Ỡ Ữ Ỵ ẫ ặ ệ ộ ợ": PASS
    (`docs/images/b8-native-diacritics.png`).
  - (d) thanh công cụ bảng trắng: BLOCKED — cần trả lời 18+ và đồng ý điều khoản, chỉ người dùng được
    làm (bị chặn khi máy tự làm).
- CI: `cargo audit` FAIL vì RUSTSEC-2026-0486 (`rustix` 1.1.5, công bố hôm nay; `Cargo.lock` không đổi
  trong B8, main cũng sẽ đỏ) — ngoài phạm vi B8.
