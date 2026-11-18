# teacher-ui-unify — Trang AI Teacher theo giao diện của app

- **Goal:** yêu cầu người dùng 18/11/2026: "chỉnh sửa lại giao diện AI Teacher cho đồng đều với
  giao diện app". Trang AI Teacher còn kiểu "trạm điều khiển" của #234 (màu riêng xanh ngọc, nền
  có quầng sáng, tab số "01 TRÒ CHUYỆN" chữ in hoa kiểu mã, chip kết nối thứ hai, thẻ trả lời
  "kính").
- **Date/time:** 2026-11-18 (+0700).
- **Status:** PASS
- **Branch / base:** `feat/teacher-ui-unify`, tách từ `origin/main` 33edcf36.

## Chỗ lệch (xem ở 1366×768, sáng và tối, so với bài "Rơi tự do")

| Phần             | Trước (trạm #234)                                   | Sau (giống app)                                    |
| ---------------- | --------------------------------------------------- | -------------------------------------------------- |
| Nền              | `--teacher-bg` + quầng `--teacher-glow` xanh ngọc   | `--bg-stage`, như trang chủ "Hôm nay học gì?"      |
| Màu nhấn         | xanh ngọc `--teacher-accent`                        | xanh dương `--accent` / `--stage-accent` của app   |
| Tab              | "01 TRÒ CHUYỆN": số mono, in hoa, giãn chữ          | `.tabs__tab` như bảng dưới: biểu tượng + tên       |
| Kết nối          | chip thứ hai "ĐÃ KẾT NỐI GEMINI" (trùng thanh trên) | chỉ còn nút AI trên thanh trên cùng                |
| Khung trò chuyện | trong suốt, không viền                              | khung chat của phòng thí nghiệm (`--bg-panel`)     |
| Thẻ trả lời      | kính mờ, viền xanh ngọc, bóng phát sáng             | thẻ chat của app (`--bg-panel-2`), đục mọi mức máy |
| Trạng thái       | "ĐÃ TRẢ LỜI" mono in hoa xanh ngọc                  | "Đã trả lời", chữ phụ `--text-muted`               |
| Quả cầu          | `--teacher-accent` / `--teacher-line`               | `--stage-accent` (giữ quả cầu, quyết định 12/11)   |
| Ghi nhớ          | thẻ `--teacher-glass-solid`                         | thẻ như nhóm Cài đặt (`--bg-panel-2`, `--border`)  |

Giữ nguyên: quả cầu và hình dự phòng (vòng + mặt), nhãn AI và nút báo cáo (`AiContentBar`), chip
"SimLab kiểm tra" (nguồn gốc con số), cổng 18+, tab Nâng cao Ghi nhớ / Lượt dùng, bảng giảng, bố
cục (quả cầu bên trái, góc trên khi ở bảng). Không đụng `src/app/settings/*`, phần `data-motion`
của `tokens.css`, màu của phần còn lại của app.

## Thay đổi

- `src/app/theme/tokens.css`: xóa 9 token trạm (`--teacher-bg`, `-glow`, `-accent`, `-warn`,
  `-line`, `-text`, `-text-muted`, `-glass-solid`, `-glass`) ở cả sáng và tối. Giữ
  `--teacher-warm` / `-cool` / `-ring-bg` (mặt B4, trang chủ dùng).
- `src/teacher/screen/TeacherScreen.tsx`: tab = `tabs__tab` + `is-selected` + biểu tượng Lucide
  (MessagesSquare, Presentation, Brain, Gauge: hai cái sau là biểu tượng sẵn có của trang Ghi nhớ /
  Lượt dùng); bỏ chip kết nối và `data-glass` (cùng `useAiStatusView`, `usePerfStore`).
- `teacher.css`, `teacherViews.css`: chỉ token của app.
- `OrbView.tsx`: quả cầu đọc `--stage-accent` (quy tắc "Stage" của CLAUDE.md).
- Tài liệu: `CLAUDE.md`, `docs/AI_TUTOR.md`.

## Test

- `tokens.test.ts`: bài "AI Teacher's station tokens" thay bằng "AI Teacher's page in the app's
  look": chữ, chữ phụ, màu nhấn, vàng cảnh báo ≥ 4,5 : 1 trên `--bg-stage`, `--bg-panel`,
  `--bg-panel-2`; quả cầu ≥ 3 : 1 trên nền trang; tệp CSS của trang không có màu viết tay và không
  có token trạm (sẽ hỏng nếu ai đưa bảng màu riêng trở lại). Bài "kính ≥ 70 %" bỏ vì không còn kính.
- `post198-teacher.spec.ts`: số "01/02/03/04" → mỗi tab có biểu tượng, tab đang mở có
  `is-selected`; chip kết nối → không có chip thứ hai, thanh trên vẫn nói "Đã kết nối Gemini"; thẻ
  kính → thẻ trả lời đúng màu `--bg-panel-2`, khung trò chuyện đúng `--bg-panel`, không
  `backdrop-filter`, ở cả mức Trung bình và Thấp.

## Kết quả chạy (máy A, Windows, 18/11/2026)

- PASS `npx vitest run src/app/theme/tokens.test.ts src/teacher`: 91 tệp, 2341 test.
- PASS `npx playwright test tests/e2e/teacher.spec.ts tests/e2e/post198-teacher.spec.ts
--project=chromium`: 23/27 ở lần đầu; 4 bài "page, sáng/tối, 100/140 %" hỏng vì chính regex
  của bài test bị ghi sai (ký tự `\b`), sửa xong chạy lại 4 bài đó: đạt (cùng board.spec 427 và
  718, lesson-flow 74, local-ai 120: 8/8).
- PASS `npx playwright test tests/e2e/post198-orb-bio3d.spec.ts --project=chromium-3d --no-deps`:
  5/5.
- Lần chạy đầu của dự án `chromium-3d` (không có `--no-deps`) kéo theo cả dự án `chromium`, chạy
  cùng ESLint và typecheck trên máy: 19 bài hỏng vì quá tải (Hóa học, đồ thị Vật lí, bảng…), không
  bài nào đụng tới mã đã sửa; 4 bài AI Teacher trong số đó đã chạy lại ở trên và đạt. CI chạy lại đủ.
- PASS `npx eslint . --ignore-pattern "*.local.config.ts"`, `npm run typecheck`.
- PASS `npm run check` (định dạng, lint, kiểu, unit): 495 tệp, 5723 test đạt, 3 bỏ qua sẵn có.

Ảnh trước/sau (1366×768, sáng và tối; trò chuyện, bảng giảng, bài "Rơi tự do") chụp bằng một
spec Playwright tạm, không đưa vào repo.
