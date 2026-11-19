# game-update — bản cập nhật SimLab 3D ngày 19/11/2026

- **Goal:** người dùng ngày 19/11/2026: "Đây là bản cập nhật mới của game, bạn hãy add vào và thêm
  chế độ chơi online cho game" (tệp `D:\SimLab 3D.zip`, 1,7 GB). PR này là phần "add vào"; chế độ
  online (LAN) làm ở PR sau.
- **Date/time:** 2026-11-19 (+0700).
- **Status:** PASS
- **Branch / base:** `feat/game-2026-11-19`, tách từ `main` (sau #336).

## Người dùng đã chọn

- Online: "Cùng mạng LAN trước"; tính năng: "Thấy nhau di chuyển và tên", "Trò chuyện bằng chữ"
  (không bật giọng nói).
- Tài nguyên: "Mã + tài nguyên game dùng"; video giới thiệu: "Được, tôi tự làm".

## Đã làm

- Thay `game/` bằng bản zip, bỏ những phần đã ghi trong `docs/GAME.md` (Bản cập nhật 19/11/2026).
- Bản zip làm tiếp từ kho riêng của game nên thiếu bốn chỗ `VITE_SIMLAB_EMBED`; đã làm lại trên mã
  mới (chỉ chơi đơn, không khuôn mặt từ ảnh, không Ultra).
- Bỏ Electron khỏi `game/package.json`, tạo lại `game/package-lock.json` (chỉ bớt gói Electron).
- `npm run build:game` bỏ thêm `max/` (người Rocketbox và vải, chỉ dùng ở Ultra). Bản dựng khoảng
  80 MB (trước 22 MB), chủ yếu do video 57 MB.
- Tài liệu: `docs/GAME.md`, `docs/THIRD_PARTY.md`, `docs/DATA_REVIEW.md` (GAME-2), `game/CLAUDE.md`
  (thêm lại đoạn đầu "trong kho SimLab").
- `tests/e2e/fx.spec.ts` đặt mức chất lượng "Trung bình" trước khi chạy: máy CI chậm đo ra "Thấp"
  và tắt hiệu ứng (CI của #337).

## Commands run (real results, summary lines only)

- Trong `game/`: `npm ci --ignore-scripts`; `npm run typecheck`, `npm run lint`,
  `npm run format:check`: đạt; `npx vitest run`: 345 tệp, 4 236 bài đạt.
- `node scripts/game/build.mjs`: dựng xong vào `public/game` (80 MB).
- `npx playwright test tests/e2e/post198-game.spec.ts tests/e2e/fx.spec.ts --project=chromium`:
  5 đạt.
- `npx vitest run src/app/game`: 3 đạt. Prettier và ESLint trên các tệp đã đổi ở gốc: đạt.

## Còn lại

- Chế độ chơi online qua LAN: PR sau (máy chủ phòng trong SimLab, chỉ thấy nhau và trò chuyện bằng
  chữ qua bộ lọc an toàn).
- Nội dung khoa học mới chờ giáo viên duyệt (DATA_REVIEW GAME-2).
