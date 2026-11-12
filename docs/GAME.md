# SimLab 3D (trò chơi phòng thí nghiệm 3D) trong SimLab

**Trạng thái:** bản thử nghiệm, đưa vào 0.8.1 theo yêu cầu của người dùng ngày 12/11/2026 ("tích
hợp game vào được trong đêm nay và hoàn thành đóng gói bản mới trong 6h sáng"). Nội dung khoa học
trong game **đang chờ giáo viên duyệt** (DATA_REVIEW `GAME-1`).

## Game là gì

Trò chơi góc nhìn thứ nhất, viết bằng TypeScript + three.js + Rapier, do máy B làm:

- Người chơi chuẩn bị ở phòng chuẩn bị (đọc nội quy, mặc đồ bảo hộ, rửa tay…).
- Sau đó đi qua sảnh vào phòng Vật lý, rồi làm các thí nghiệm: rơi tự do, ném xiên, con lắc đơn, định luật Hooke, dao động lò xo.
- Kết quả đo được đặt cạnh kết quả lý thuyết.

Có tiếng Việt và tiếng Anh.

## Nguồn

- Tệp `SimLab 3D - Copy.zip` người dùng đưa ngày 12/11/2026 (23:03).
- Kho git riêng của game, không có remote: commit `934e493` ("Phase F world…"), cộng các thay đổi chưa commit có trong zip.
- **Mã nguồn của game chưa nằm trong kho này.** Kho này chỉ có bản dựng trong `public/game/`. Việc tiếp theo: đưa mã nguồn vào (cần cấu hình lint/format riêng cho thư mục đó).

## Bản dựng dùng trong SimLab (`public/game/`)

Từ thư mục mã nguồn của game (Node ≥ 22.12):

```
npm ci --ignore-scripts
git apply <đường dẫn tới>/docs/game/embed.patch   # ba chỗ sửa cho bản nhúng (dưới đây)
VITE_SIMLAB_EMBED=1 npx vite build --base ./ --outDir <thư mục ra>
# bỏ hai thư mục không dùng trong SimLab:
rm -rf <thư mục ra>/ultra <thư mục ra>/models
```

Sau đó chép nội dung thư mục ra vào `public/game/`. Kết quả khoảng 22 MB: JS, Rapier wasm, mô hình
glTF của thành phố dưới sàn sảnh, âm thanh.

## Bản nhúng khác bản gốc ở đâu (`docs/game/embed.patch`, cờ `VITE_SIMLAB_EMBED=1`)

| Bỏ                                                                         | Lý do                                                                                                                                                                                      |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Khuôn mặt từ ảnh** (camera + MediaPipe Face Landmarker / Hair Segmenter) | CLAUDE.md: không chạy thêm mô hình nào trong app nếu chưa hỏi người dùng; quyền riêng tư camera. Mã đọc ảnh không được đưa vào bản dựng (không có `tasks-vision`), thư mục `models/` bị bỏ |
| **Chơi nhiều người qua LAN và trò chuyện bằng giọng**                      | Cần máy chủ phòng của dev server (không có trong app); trò chuyện với người lạ, micro. Trang "Chơi" chỉ còn "Chơi đơn"                                                                     |
| **Chất lượng đồ hoạ Ultra**                                                | 107 MB texture PBR (CC0) làm bộ cài và bản cập nhật web nặng gấp nhiều lần; ba mức Thấp / Trung bình / Cao vẫn còn                                                                         |

Ngoài ra không sửa gì khác trong game.

## Cách mở trong SimLab

- Virtual Lab → thanh bên trái, mục "Trò chơi" → nút **SimLab 3D**.
- Game mở trong một `<dialog>` toàn màn hình (`src/app/game/GameDialog.tsx`). Đầu hộp có nút "Về SimLab", nhãn "Bản thử nghiệm" và câu "đang chờ giáo viên duyệt". Game chạy trong một `<iframe>` cùng nguồn.
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
