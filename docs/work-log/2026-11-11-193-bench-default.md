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
- FPS / mức chất lượng / RAM (Nâng cao) của thanh trạng thái cũ: bench chưa có chỗ; issue #201.
  Phiên bản đang chạy: Tệp → "Kiểm tra cập nhật" và Cài đặt → Lịch sử phiên bản.
- `BenchContext`: nhánh cổ điển còn ở 27 tệp (28 chỗ đọc); issue #200, sau khi phát hành 0.8.1.
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
  - (d) thanh công cụ bảng trắng: không kiểm native (cần trả lời 18+, việc chỉ người dùng được làm).
    **Chấp nhận bằng E2E `board.spec`, quyết định của người dùng ngày 11/11/2026.** Bằng chứng: CI run
    43030147008 trên `1630e21`, job E2E: `board.spec.ts` 19/19 PASS, gồm hai test bề rộng thanh công
    cụ ở 1366×768 (`:1032`, `:1118`); cả lần chạy 201 PASS.
- CI: `cargo audit` FAIL vì RUSTSEC-2026-0486 (`rustix` 1.1.5, công bố hôm nay; `Cargo.lock` không đổi
  trong B8, main cũng sẽ đỏ) — PR #199 nâng `rustix` lên 1.1.6.

## Vòng 2 (review của laptop, 11 việc bắt buộc + 3 việc nên sửa)

Tiêu chí: mỗi việc của review có code hoặc tài liệu sửa đúng chỗ và một phép kiểm không dựa vào code
được sửa (dữ liệu bài học, `tokens.css`, luồng của người học trong E2E).

- 1 `PerfNotes` ở Studio Sinh học (mô hình vẽ ngoài `Stage`): `BiologyFlow.test` PASS.
- 2 Tệp → "Chế độ trình chiếu (F5)"; HUD chừa nút thoát khi trình chiếu: `FileMenu.test`, E2E
  `frame.spec` PASS.
- 3 Tệp → "Lịch sử" (cả ở Cơ bản): `FileMenu.test` PASS.
- 4 thẻ chủ đề "Đã mở · 1/3 bước", "Còn: Dự đoán trước, n thử thách": `Library.test`, E2E
  `learner.spec` PASS.
- 5 "Có bản cập nhật {phiên bản}" ở đầu bàn sau "Để sau" (cả khi cần bộ cài mới): `update.test`, E2E
  `layout.spec` (vừa đầu bàn ở 1366, tên bài dài) PASS. FPS / mức chất lượng / RAM: issue #201.
- 6 khung hình đầu là bench (`theme-boot.js` đặt `data-shell`, nền `index.html` lấy từ `tokens.css`):
  `tests/index-html.test.ts` PASS; native: xem Kết quả vòng 2.
- 7 câu riêng tư ở thẻ "Hỏi AI" của sổ ghi (vi, en).
- 8 `Badges` ra tệp riêng; xoá `HomeScreen` ("Gợi ý cho lớp N" bỏ, kệ bài theo lớp thay), `Inspector`
  cổ điển và chú giải (bench không có chú giải ở chỗ khác), CSS/token/khoá i18n chết. `BenchContext`
  còn canh nhánh cổ điển ở 27 tệp, 28 chỗ đọc: issue #200 (`shortcut:` trong `shellMode.ts`).
- 9 `learner.spec` kiểm "Bài 4–5, 7 · chờ giáo viên duyệt" trên thẻ: PASS.
- 10 tiêu điểm về ô tìm / nút "Tất cả": `Library.test` PASS.
- 11 tài liệu và chú thích theo bench; BENCH_DESIGN/PROGRESS ghi "đang review".
- Nên sửa: `PerfNotes` chỉ đọc khi thông báo đến/đi (`PerfNotes.test`); "Bước 2/3" chỉ lần chạy đầu
  (`FirstRun.test`); `drift3d` vào `HEAVY_3D`: chạy riêng ở `chromium-3d` lần đầu FAIL (ngay sau khi
  dừng một lượt chạy khác, máy chủ dev nguội; không giữ được lỗi), rồi 3 lần liền PASS — ghi là chập
  chờn chưa rõ nguyên nhân, theo dõi ở lượt chạy đủ (lượt chạy đủ thứ hai: PASS ở `chromium-3d`).

### Kết quả vòng 2 (head `529f114` trở đi, máy bàn)

- `npm run check`: PASS (5032 qua, 1 bỏ qua có sẵn); `format:check`: PASS.
- E2E đủ nhóm, 4 worker (cách né môi trường của máy bàn; CI chạy cấu hình gốc):
  - lượt 1: `chromium` 156/157 — FAIL "a reminder to rest the eyes…" (`learner.spec:257`, hết 60 s khi
    4 worker cùng chạy); hai nhóm 3D không chạy (phụ thuộc). Chạy riêng 3 lần: PASS 3/3 (~5 s). Trace
    bị xoá khi chạy lại nên không biết bước nào chậm: ghi là chập chờn khi máy nặng.
  - lượt 2: `chromium` 157/157 PASS; `chromium-3d` 42/45 — FAIL `hw3d.spec:99` và `bio3d.spec:130`
    (`page.goto` hết 120 s: môi trường, như vòng 1) và `biology.spec:49` (bài Động học enzyme mở,
    khung mô phỏng chưa vẽ sau 20 s nên chưa có Thẻ khoa học: mô-đun nạp lười chưa về, cùng lúc với
    hai lỗi `page.goto`); `chromium-3d-perf` không chạy (phụ thuộc). Chạy lại riêng (1 worker): 3/3
    PASS; perf 1/1 PASS.
- Native WebView2 (bản `tauri build --debug --no-bundle`, identifier tạm qua `--config`, hồ sơ tạm đã
  xoá), việc 6: một script chạy trước mọi script của trang ghi lại ở khung hình đầu (trước khi React
  gắn gì): `data-shell="bench"`, nền `rgb(246, 244, 239)` (sáng) và `rgb(21, 25, 28)` (tối), khớp
  `--bg-app` của bench sau khi tải xong: PASS.
- BENCH_DESIGN/PROGRESS vẫn ghi "đang review" cho tới khi CI của head này chạy đủ và đạt.

## Vòng 3 (duyệt vòng 2 của laptop trên `3b89add`: 5 việc bắt buộc + 4 việc nên sửa)

Đã gộp `main` (`b5820d5`, rustix 1.1.6 của #199): chỉ đổi `src-tauri/Cargo.lock`
(`cargo metadata --locked` PASS).

- 1 `app.test`: "không có khay" so tên thật (`/bảng thuộc tính/i`): PASS.
- 2 nút nhắc cập nhật thành nút biểu tượng có chấm; đầu bàn thiếu chỗ (container query theo `em`
  của đầu bàn) thì ô Tìm và trạng thái AI chỉ còn biểu tượng; tên bài bị cắt có tooltip. E2E
  `layout.spec` 100 % và 140 % khi nút nhắc hiện: mọi nút trong 1366, không tràn, tên bài ≥ hai
  chữ đầu đo bằng phông của nó (140 %: 195 ≥ 147 px; trước 22 px), breadcrumb nguyên, tooltip:
  PASS; axe (`controls.spec`) PASS.
- 3 ghi chú quá tải thành dải trong luồng dưới khung mô-đun và dưới mô hình Studio. E2E
  `mitosis3d.spec`, `studio-biology.spec`: dải nằm dưới, không chung điểm ảnh với `.m3d__hud`: PASS.
- 4 tiêu điểm khi mở Lịch sử từ Tệp và khi đóng ở Cơ bản: `FileMenu.test` PASS.
- 5 tài liệu (`USER_GUIDE`, `CLAUDE.md:489-490` — người dùng cho phép, `profileStore`, #200/#201,
  chú thích 38 px, xoá `.statusbar__update`).
- Nên sửa: "Bước 2/3" khi điều khoản mới và đã xem hướng dẫn (`FirstRun.test`); dòng đọc PerfNotes
  luôn gắn (`PerfNotes.test`); thẻ Vật lí giữ sẵn dòng "Còn: …" (E2E UI-42 thẻ Vật lí); chú thích
  ARCHITECTURE/Studio.

### Kết quả vòng 3 (máy bàn)

- `npm run check`: PASS (5032 qua, 1 bỏ qua có sẵn); `format:check`: PASS.
- E2E đủ nhóm, 4 worker: `chromium` 159/159 PASS; `chromium-3d` 43/47 — 4 FAIL đều dừng ở bước
  đầu (chờ nút "Virtual Lab" của trang mở đầu 150–240 s); trace: từng mô-đun mất 110–160 s, hai
  yêu cầu 408, 58 yêu cầu không xong — dev server của máy bàn nghẽn (môi trường). Chạy lại riêng
  (1 worker): 4/4 PASS; `chromium-3d-perf` 1/1 PASS.
