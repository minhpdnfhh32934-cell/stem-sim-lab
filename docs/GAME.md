# SimLab 3D (trò chơi phòng thí nghiệm 3D) trong SimLab

**Trạng thái:** bản chính thức của trò chơi trong 0.8.1. Đưa vào 0.8.1 theo yêu cầu của người dùng
ngày 12/11/2026 ("tích hợp game vào được trong đêm nay và hoàn thành đóng gói bản mới trong 6h
sáng"); ngày 13/11/2026 người dùng bỏ nhãn "Bản thử nghiệm" và dòng ghi chú trên thanh của game
("vì đây là bản chính thức của trò chơi"). Nội dung khoa học trong game vẫn **đang chờ giáo viên
duyệt** (DATA_REVIEW `GAME-1`): bỏ nhãn trên giao diện không có nghĩa là nội dung đã được duyệt.

## Game là gì

Trò chơi góc nhìn thứ nhất, viết bằng TypeScript + three.js + Rapier, do máy B làm:

- Người chơi chuẩn bị ở phòng chuẩn bị (đọc nội quy, mặc đồ bảo hộ, rửa tay…).
- Sau đó đi qua sảnh vào phòng Vật lý, rồi làm các thí nghiệm: rơi tự do, ném xiên, con lắc đơn, định luật Hooke, dao động lò xo.
- Kết quả đo được đặt cạnh kết quả lý thuyết.

Có tiếng Việt và tiếng Anh.

## Nguồn

- Tệp `SimLab 3D - Copy.zip` người dùng đưa ngày 12/11/2026 (23:03).
- Kho git riêng của game, không có remote: commit `934e493` ("Phase F world…"), cộng các thay đổi chưa commit có trong zip.
- **Mã nguồn nằm trong `game/`** (đưa vào ngày 13/11/2026, người dùng: "làm ngay trong 0.8.1"). Gồm `src`, `e2e`, `docs` (báo cáo từng giai đoạn của game), `scripts`, cấu hình, `public/audio` và `public/hub-city`.
- **Không đưa vào kho:**
  - `node_modules`, `.git`, `.claude`, `dist`;
  - `public/models` (mô hình MediaPipe; muốn dùng "khuôn mặt từ ảnh" khi chạy game độc lập thì tải lại theo báo cáo giai đoạn F của game).
- **Texture Ultra** (`game/public/ultra`, 107 MB, ambientCG CC0) có trong kho để mã nguồn đủ và test `surfaces.test.ts` của game đạt (người dùng chọn ngày 13/11/2026). App **không** dùng các texture này: `npm run build:game` bỏ chúng khỏi `public/game/`.

## Dựng lại bản dùng trong SimLab (`public/game/`)

```
npm run build:game
```

`scripts/game/build.mjs` làm ba việc:

1. Cài thư viện riêng của game (`game/package-lock.json`, `npm ci --ignore-scripts`) nếu chưa cài.
2. Dựng game với `VITE_SIMLAB_EMBED=1` và `--base ./` vào `public/game/`.
3. Bỏ hai thư mục `ultra` và `models`.

Kết quả khoảng 22 MB: JS, Rapier wasm, mô hình glTF của thành phố dưới sàn sảnh, âm thanh. Ngày 13/11/2026, dựng lại từ `game/` cho ra **đúng từng byte** bản đã có trong `public/game/` (`git status` sạch). Vì vậy bản cài 0.8.1 khớp với mã nguồn này.

Game có kiểm tra riêng: trong `game/` chạy `npm run check` (typecheck, ESLint, Prettier, Vitest). Kiểm tra chung của SimLab bỏ qua `game/` (`eslint.config.js`, `.prettierignore`); Vitest và tsconfig của SimLab vốn chỉ đọc `src` và `tests`.

## Bản nhúng khác bản gốc ở đâu (cờ `VITE_SIMLAB_EMBED=1`)

Cờ đọc lúc dựng (`import.meta.env.VITE_SIMLAB_EMBED === '1'`). Bản độc lập của game không đổi.

| Bỏ                                                                         | Chỗ trong mã                                       | Lý do                                                                                                                                                                                      |
| -------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Khuôn mặt từ ảnh** (camera + MediaPipe Face Landmarker / Hair Segmenter) | `game/src/platform/ui/characterPage/Customiser.ts` | CLAUDE.md: không chạy thêm mô hình nào trong app nếu chưa hỏi người dùng; quyền riêng tư camera. Mã đọc ảnh không được đưa vào bản dựng (không có `tasks-vision`), thư mục `models/` bị bỏ |
| **Chơi nhiều người qua LAN và trò chuyện bằng giọng**                      | `game/src/platform/ui/PlayPages.ts`                | Cần máy chủ phòng của dev server (không có trong app); trò chuyện với người lạ, micro. Trang "Chơi" chỉ còn "Chơi đơn". Mã LAN và giọng nói vẫn nằm trong gói JS nhưng không tới được      |
| **Chất lượng đồ hoạ Ultra**                                                | `game/src/platform/ui/settings.ts`                 | 107 MB texture PBR (CC0) làm bộ cài và bản cập nhật web nặng gấp nhiều lần; ba mức Thấp / Trung bình / Cao vẫn còn                                                                         |

Ngoài ra không sửa gì khác trong game.

## Cách mở trong SimLab

- Virtual Lab → thanh bên trái, mục "Trò chơi" → nút **SimLab 3D**.
- Game mở trong một `<dialog>` toàn màn hình (`src/app/game/GameDialog.tsx`). Đầu hộp chỉ có nút "Về SimLab" và tiêu đề "SimLab 3D". Game chạy trong một `<iframe>` cùng nguồn.
- Đóng hộp thì gỡ iframe, nên ngữ cảnh WebGL của game được giải phóng.
- Lần mở đầu, game theo ngôn ngữ của app: ghi `simlab.settings.language`, khoá riêng của game. Nếu người học đã đổi ngôn ngữ trong game thì lựa chọn đó được giữ.
- Game lưu bài chơi trong `localStorage` với tiền tố `simlab.*`, không đụng khoá `stemsim.*` của SimLab.

## CSP và bản cài

Không phải sửa CSP:

- `default-src 'self'` cho phép iframe, glTF và âm thanh cùng nguồn.
- `script-src 'self' 'wasm-unsafe-eval'` cho phép Rapier.

Game không tải gì từ mạng. Phần tìm phòng LAN chỉ hỏi chính trang (`…/hello`) và tự dừng khi không có máy chủ phòng.

## Giấy phép

- Mã game: của dự án (máy B).
- Thư viện: three.js (MIT), Rapier (`@dimforge/rapier3d-compat`, Apache-2.0), zod (MIT).
- Tài nguyên, tất cả CC0 1.0:
  - âm thanh Kenney (`public/game/audio/CREDITS.md`);
  - mô hình thành phố Quaternius "Downtown City MegaKit" (`public/game/hub-city/README.md`).

Xem `docs/THIRD_PARTY.md`.

## Kiểm thử

- `src/app/game/GameDialog.test.tsx`: mở và đóng, gỡ iframe, ngôn ngữ lần đầu.
- `tests/e2e/bench/game.spec.ts` (WebGL phần mềm): mở từ Virtual Lab, menu game tiếng Việt, chỉ có "Chơi đơn", "Về SimLab" đóng lại, không lỗi trang.
