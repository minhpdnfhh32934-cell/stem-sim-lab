# lan-rooms-embed — phía game và SimLab của chơi chung qua LAN (#339, bước 2–3)

- **Goal:** người dùng 19/11/2026: "thêm chế độ chơi online cho game". Đã chọn: LAN trước; thấy nhau
  di chuyển và tên, trò chuyện bằng chữ, không giọng nói; CSP được thêm một địa chỉ loopback; mọi
  người trong phòng nhắn được.
- **Date/time:** 2026-11-19 (+0700).
- **Status:** PASS (phần mã); thử thật hai máy: NOT RUN (chờ phần Rust, bước 1, máy bàn làm).
- **Branch / base:** `feat/339-rooms-embed`, chồng lên `feat/game-2026-11-19` (#338).

## Đã làm

- Game (`VITE_SIMLAB_EMBED`): `simlabHost.ts` (máy chủ `http://127.0.0.1:5189`, kiểm tin nhắn qua cửa
  sổ cha); `LanRooms` gọi máy chủ đó; thẻ "Chơi nhiều người" hiện lại, chữ chỉ nói chat; không tạo
  `VoiceChat`; bảng Điều khiển bỏ dòng "giữ để nói"; tin bị chặn thì báo lý do, tin của người khác
  không qua bộ lọc thì ẩn, mỗi tin có nút "Báo cáo"; không có bộ lọc thì không gửi, không hiện.
- SimLab: `src/app/game/gameBridge.ts` (`window.simlabRooms`: check, safe, report; nhật ký sự cố chỉ
  loại và thời gian); `GameDialog` gắn cầu nối và gọi `rooms_start` / `rooms_stop`; CSP thêm
  `http://127.0.0.1:5189` (test ghim); `CLAUDE.md` ghi ngoại lệ; `public/game` dựng lại.
- Tài liệu: `docs/GAME.md` (Chơi chung qua LAN), `docs/USER_GUIDE.md`, `docs/LEGAL_COMPLIANCE.md` 2j.

## Commands run (real results, summary lines only)

- `game/`: typecheck, lint, format:check đạt; `npx vitest run` 346 tệp, 4 239 bài đạt (3 mới).
- `npx vitest run tests/tauri-config.test.ts src/app/game`: 11 đạt; sau khi thêm `gameBridge.test.ts`:
  `src/app/game` 6 đạt. `npx tsc -b --noEmit`, ESLint các tệp đã đổi: đạt.
- `npx playwright test tests/e2e/post198-game.spec.ts --project=chromium`: 1 đạt.

## Còn lại

- Bước 1 (máy chủ Rust `src-tauri/src/rooms/`): máy bàn đang làm.
- Bước 4: thử thật hai máy (laptop + máy bàn cùng mạng).
