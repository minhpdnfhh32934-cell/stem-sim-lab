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

### Bản cập nhật 19/11/2026

- Tệp `D:\SimLab 3D.zip` người dùng đưa ngày 19/11/2026 (16:08, 1,7 GB): "Đây là bản cập nhật mới của game, bạn hãy add vào". `game/` được thay bằng bản này. Thêm mới, theo báo cáo giai đoạn trong `game/docs/` (`phase-g2-report.md`, `phase-max-report.md`, `phase-w-report.md`): vụ khẩn cấp (cháy, đội ứng cứu), bảng tuần hoàn (dữ liệu PubChem, có ghi nguồn trong `game/src/content/periodic-table.json`), màn mở đầu tên lửa, nhân vật và chuyển động mới, menu sống động, video giới thiệu, mức đồ hoạ Ultra mới.
- Người dùng chọn (19/11/2026) "Mã + tài nguyên game dùng". **Không đưa vào kho:** `promo/` (845 MB), `node_modules`, `dist*`, `.git`, `.claude`, `graphify-out`, `public/models` (như trước), `public/audio-trial` và `sound-compare.html` (thử âm thanh), vỏ desktop Electron (`electron/`, `npm run app`, `test:app`, `playwright.app.config.ts`, `e2e/*.app.ts`, `scripts/desktop-app.ps1`, `scripts/make-icon.mjs`) và phần đóng gói hình nền Lively (`vite.wallpaper.config.ts`, `wallpaper.html`, `scripts/wallpaper*`). Mã cảnh nền `src/platform/wallpaper` vẫn giữ vì menu sống động dùng nó. Electron được bỏ khỏi `game/package.json`; `game/package-lock.json` tạo lại (chỉ bớt các gói của Electron).
- Video giới thiệu `game/public/video/simlab3d-gioi-thieu.mp4` (57 MB): người dùng xác nhận ngày 19/11/2026 là do mình làm, được phát hành cùng app.
- Mô hình người Microsoft Rocketbox (`game/public/max/people`, MIT) và vải, vết mòn (`game/public/max/textures`) chỉ dùng ở mức Ultra: có trong mã nguồn, **không** đóng gói vào app (`npm run build:game` bỏ `max`).
- Bốn chỗ `VITE_SIMLAB_EMBED` của bản nhúng (bảng dưới) không có trong bản zip mới (bản zip làm tiếp từ kho riêng của game) và đã được làm lại trên mã mới.

## Dựng lại bản dùng trong SimLab (`public/game/`)

```
npm run build:game
```

`scripts/game/build.mjs` làm ba việc:

1. Cài thư viện riêng của game (`game/package-lock.json`, `npm ci --ignore-scripts`) nếu chưa cài.
2. Dựng game với `VITE_SIMLAB_EMBED=1` và `--base ./` vào `public/game/`.
3. Bỏ hai thư mục `ultra` và `models`.

Kết quả khoảng 22 MB: JS, Rapier wasm, mô hình glTF của thành phố dưới sàn sảnh, âm thanh. Ngày 13/11/2026, dựng lại từ `game/` cho ra **đúng từng byte** bản đã có trong `public/game/` (`git status` sạch). Vì vậy bản cài 0.8.1 khớp với mã nguồn này. Từ bản cập nhật 19/11/2026 bản dựng khoảng **80 MB**: thêm video giới thiệu (57 MB) và ảnh menu sống động; bỏ `ultra`, `max`, `models`.

Game có kiểm tra riêng: trong `game/` chạy `npm run check` (typecheck, ESLint, Prettier, Vitest). Kiểm tra chung của SimLab bỏ qua `game/` (`eslint.config.js`, `.prettierignore`); Vitest và tsconfig của SimLab vốn chỉ đọc `src` và `tests`.

Quy tắc khi làm việc trong `game/`:

- `game/CLAUDE.md` và `game/docs/agents/` là quy tắc riêng của game. Đầu hai tệp đã ghi: trong kho SimLab, `CLAUDE.md` gốc thắng. Claude không gộp, không push `main`.
- **Không chạy** `npm run dev:lan` / `preview:lan` của game: hai lệnh này mở game ra mạng (`vite --host`).

## Bản nhúng khác bản gốc ở đâu (cờ `VITE_SIMLAB_EMBED=1`)

Cờ đọc lúc dựng (`import.meta.env.VITE_SIMLAB_EMBED === '1'`). Bản độc lập của game không đổi.

| Bỏ                                                                         | Chỗ trong mã                                                          | Lý do                                                                                                                                                                                      |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Khuôn mặt từ ảnh** (camera + MediaPipe Face Landmarker / Hair Segmenter) | `game/src/platform/ui/characterPage/Customiser.ts`                    | CLAUDE.md: không chạy thêm mô hình nào trong app nếu chưa hỏi người dùng; quyền riêng tư camera. Mã đọc ảnh không được đưa vào bản dựng (không có `tasks-vision`), thư mục `models/` bị bỏ |
| **Trò chuyện bằng giọng**                                                  | `game/src/main.ts`, `ChatView.ts`, `ControlsPanel.ts`, `PlayPages.ts` | Người dùng chọn ngày 19/11/2026 không bật giọng nói (micro, không lọc được). Không tạo `VoiceChat`; chữ hướng dẫn chỉ nói chat. Phòng LAN thì **có** (xem "Chơi chung qua LAN")            |
| **Chất lượng đồ hoạ Ultra**                                                | `game/src/platform/ui/settings.ts`                                    | 107 MB texture PBR (CC0) và 94 MB người thật, vải (`max`) làm bộ cài và bản cập nhật web nặng gấp nhiều lần; ba mức Thấp / Trung bình / Cao vẫn còn                                        |

Ngoài ra trong game chỉ có phần nối phòng LAN với SimLab (`game/src/platform/net/simlabHost.ts`, mục "Chơi chung qua LAN").

### Sửa giao diện game trong SimLab (20/11/2026)

Người dùng báo giao diện lỗi sau khi cài 0.12.0. Ba chỗ sửa trong mã game, áp dụng cho cả bản độc lập:

- Menu sống động (`liveMenu.css`, `liveMenu.ts`): trên cửa sổ thấp (máy xách tay 125–150 %, cộng
  thanh của SimLab phía trên game) nút "Cài đặt" bị cắt ở mép dưới và không cuộn tới được. Khi cửa sổ
  cao dưới 760 px, các nút gọn lại (nút 52 px, nút Chơi 72 px). Cửa sổ thấp hơn nữa thì nhóm nút
  và tên được đẩy lên, theo chiều cao đo được (`--controls-h`, `--brand-h`), để nút cuối luôn nằm
  trong khung ở cả ba góc nhìn.
- Trong đoạn mở đầu, các nút menu tuy ẩn nhưng vẫn bấm được (bấm vào bên trái màn hình là vào game).
  Giờ chúng ẩn hẳn (`visibility: hidden`) cho tới khi menu hiện.
- Cài đặt → thẻ "Điều khiển" không có chữ: phần này được thêm vào trước khi có tên
  (`ControlSettings.ts`).

## Chơi chung qua LAN (#339, người dùng quyết ngày 19/11/2026)

- Máy chủ phòng nằm trong SimLab (Rust, `src-tauri/src/rooms/`, cổng cố định 5189), làm theo đúng giao
  thức phòng LAN của game (`game/src/multiplayer/`). `GameDialog` gọi `rooms_start` khi mở game,
  `rooms_stop` khi đóng. Máy chủ chỉ nghe 127.0.0.1; khi người học tạo phòng nó mới mở ra mạng riêng
  và phát tín hiệu UDP 5188 (tên gửi đi là "SimLab", không phải tên máy).
- Game nhúng gọi `http://127.0.0.1:5189/simlab-rooms` (`game/src/platform/net/simlabHost.ts`). Đây
  là địa chỉ `http://` duy nhất (ngoài IPC) trong CSP, có test ghim (`tests/tauri-config.test.ts`).
- Chỉ thấy nhau di chuyển, tên và trò chuyện bằng chữ; không giọng nói. Mọi người trong phòng nhắn
  được. Mỗi tin qua bộ lọc của SimLab trên cửa sổ cha (`src/app/game/gameBridge.ts`); không có bộ lọc
  thì không gửi, không hiện. Có nút Báo cáo; nhật ký sự cố chỉ ghi loại và thời gian. Điểm pháp lý:
  `docs/LEGAL_COMPLIANCE.md` mục 2j.
- Trong trình duyệt thường (`npm run dev`, E2E) không có máy chủ: thẻ "Chơi nhiều người" ghi "Máy chủ
  phòng chưa chạy".

## Cách mở trong SimLab

- Virtual Lab → cột Thư viện bên trái → nút **SimLab 3D** (ngay dưới nút Science Studio).
- Game mở trong một `<dialog>` toàn màn hình (`src/app/game/GameDialog.tsx`). Đầu hộp chỉ có nút "Về SimLab" và tiêu đề "SimLab 3D". Game chạy trong một `<iframe>` cùng nguồn.
- Đóng hộp thì gỡ iframe, nên ngữ cảnh WebGL của game được giải phóng.
- Lần mở đầu, game theo ngôn ngữ của app: ghi `simlab.settings.language`, khoá riêng của game. Nếu người học đã đổi ngôn ngữ trong game thì lựa chọn đó được giữ.
- Game lưu bài chơi trong `localStorage` với tiền tố `simlab.*`, không đụng khoá `stemsim.*` của SimLab.

## AI Teacher biết gì về game (27/11/2026)

Người dùng báo AI Teacher "chưa hiểu rõ về game". AI Teacher giờ đọc **"Hướng dẫn SimLab 3D"**
(`data/game_guide.json`), tạo từ chính dữ liệu của game bằng `npm run game-guide`: từng phòng, thí
nghiệm (thông số, các bước, bộ phận, ghi chú lý thuyết), nhiệm vụ hướng dẫn, chủ đề, phím điều khiển
của bản nhúng, thầy Quang (giảng, ra đề, chấm bài), nhân vật và cách tạo nhân vật, laptop và sách ở
sảnh, các bảng ở sảnh, cách làm thí nghiệm (bàn điều khiển, bàn làm việc, sai số, khớp đường thẳng),
quy trình vào phòng sạch, cháy và số gọi cứu hỏa, menu và bản lưu, chơi LAN (bổ sung 27/11/2026 cùng
Antigravity). Tên thẻ, dáng đứng, nút đều đọc từ chữ của game, không gõ lại. **Khi nội dung game
đổi (`game/src/content/`, phím, chữ hướng dẫn), chạy lại `npm run game-guide`**: test
`tests/game-guide.test.ts` báo lỗi khi tệp cũ. Chỉ câu hỏi về game mới dùng hướng dẫn này; chi tiết
trong `docs/AI_TUTOR.md` ("The SimLab 3D guide"). Câu chữ chờ duyệt: DATA_REVIEW `GAME-3`.

## CSP và bản cài

CSP chỉ thêm một địa chỉ cho phòng LAN (`http://127.0.0.1:5189`, mục "Chơi chung qua LAN"); phần còn lại không phải sửa:

- `default-src 'self'` cho phép iframe, glTF và âm thanh cùng nguồn.
- `script-src 'self' 'wasm-unsafe-eval'` cho phép Rapier.

Game không tải gì từ Internet. Phần phòng LAN chỉ hỏi máy chủ phòng của SimLab trên chính máy này (`http://127.0.0.1:5189/simlab-rooms/hello`) và tự dừng khi không có máy chủ.

## Giấy phép

- Mã game: của dự án (máy B).
- Thư viện: three.js (MIT), Rapier (`@dimforge/rapier3d-compat`, Apache-2.0), zod (MIT).
- Tài nguyên, tất cả CC0 1.0:
  - âm thanh Kenney (`public/game/audio/CREDITS.md`);
  - mô hình thành phố Quaternius "Downtown City MegaKit" (`public/game/hub-city/README.md`).
- Video giới thiệu: do người dùng làm (xác nhận 19/11/2026).
- Chỉ trong mã nguồn, không đóng gói: người Microsoft Rocketbox (MIT, `game/public/max/people/LICENSE-Rocketbox.md`).

Xem `docs/THIRD_PARTY.md`.

## Kiểm thử

- `src/app/game/GameDialog.test.tsx`: mở và đóng, gỡ iframe, ngôn ngữ lần đầu.
- `tests/e2e/post198-game.spec.ts` (WebGL phần mềm): mở từ Virtual Lab, menu game tiếng Việt, chỉ có "Chơi đơn", "Về SimLab" đóng lại, không lỗi trang.
