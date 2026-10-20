# Hiệu năng

## Ngân sách (MASTER_PROMPT §4.2)

| Chỉ số                                | Mục tiêu |
| ------------------------------------- | -------- |
| 2D, cảnh SGK điển hình, máy tối thiểu | 60 FPS   |
| 3D                                    | ≥ 30 FPS |
| Khởi động lạnh                        | < 3 s    |
| RAM của app (không tính LLM)          | < 300 MB |
| File cài đặt (gồm dữ liệu)            | < 80 MB  |

**Máy tối thiểu:** CPU 4 nhân (i3 / Ryzen 3, ~2018), RAM 8 GB, GPU tích hợp Intel UHD 620,
màn hình 1366×768, Windows 10.

## Kết quả đo

| Ngày       | Giai đoạn | Máy                                               | Chỉ số                                                                            | Kết quả                                                                                              |
| ---------- | --------- | ------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 2026-09-28 | 0         | Máy build (Linux)                                 | Bundle giao diện (JS gzip / CSS gzip)                                             | ≈ 90 KB / 5 KB                                                                                       |
| 2026-09-28 | 0         | Máy build (Linux)                                 | Tránh render thừa khi kéo panel                                                   | Các panel dùng `memo` + selector hẹp của Zustand                                                     |
| 2026-09-29 | 6         | Máy build (Linux, Chromium headless, vẽ bằng CPU) | Khởi động lạnh (bản build, tới khi giao diện sẵn sàng)                            | 0,28 s (DOMContentLoaded 0,14 s)                                                                     |
| 2026-09-29 | 6         | như trên                                          | JS tải lúc khởi động (gzip)                                                       | 168 KB (JS 161 KB + CSS 7 KB); các môn, three.js, RDKit, KaTeX tải khi cần                           |
| 2026-09-29 | 6         | như trên                                          | Bộ nhớ JS (heap): lúc chờ / ném xiên đang chạy / phân tử 3D / cơ chế / cuối phiên | 6 / 11 / 15 / 14 / 19 MB                                                                             |
| 2026-09-29 | 6         | như trên                                          | FPS: ném xiên, thuyết va chạm (hạt), khuếch tán (hạt)                             | 60 / 60 / 60 (không kích hoạt hạ cấp)                                                                |
| 2026-09-29 | 6         | như trên                                          | Thư mục `dist` (gồm RDKit WASM)                                                   | 10,1 MB                                                                                              |
| 2026-09-29 | 7         | như trên                                          | Gói cài bản release (Linux `.deb`; cùng binary và dữ liệu như bản Windows)        | 6,35 MB (mục tiêu < 80 MB). Bộ cài Windows: xem `installer-sizes.txt` trong kết quả workflow Release |

## Chọn mức chất lượng tự động (Giai đoạn 1)

Lần đầu mở app, app đo nhanh cấu hình máy trong khoảng 1,2 giây (`src/perf/benchmark.ts`):

- **CPU:** tính lực hấp dẫn giữa 48 vật trong 600 ms. Kết quả là số "nghìn vật-bước mỗi ms".
- **Vẽ 2D:** vẽ các hình tròn lên canvas 800×600 trong 600 ms, có đọc lại điểm ảnh để tính cả
  thời gian GPU. Kết quả là số "hình tròn mỗi ms".
- **WebGL2:** có hỗ trợ hay không. Số luồng CPU lấy từ `navigator.hardwareConcurrency`.

Từ kết quả đo, app xếp máy vào mức **Thấp / Trung bình / Cao**. Mức chất lượng chỉ ảnh hưởng hình
ảnh (độ nét, khử răng cưa, bóng đổ, số hạt vẽ, độ mịn khối cầu), không ảnh hưởng số liệu. Người
dùng chỉnh được trong Cài đặt → Chất lượng hiển thị, hoặc bấm "Đo lại". Các ngưỡng phân loại hiện
là ước lượng. Cần hiệu chỉnh lại trên máy tối thiểu thật (i3, UHD 620), rồi ghi kết quả vào bảng
bên trên.

Cách đo lại: `npm run build`, chạy `npx vite preview --port 4173`, rồi `node scripts/perf/measure.mjs`
(đặt `PW_CHROMIUM` nếu dùng Chromium có sẵn). Heap JS chỉ là một phần RAM của app; RAM thật của
WebView2 trên Windows cần đo bằng Task Manager trên máy tối thiểu (i3, UHD 620) — **chưa đo**.

## Xử lý quá tải (Giai đoạn 6, MASTER_PROMPT §5)

Nguyên tắc: hy sinh độ mượt trước, **không bao giờ âm thầm giảm độ chính xác**.

| Bậc | Khi nào                                                                      | Làm gì                                                                                                                                      | Người dùng thấy                                                    |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | 45 khung hình liên tiếp chậm hơn ngân sách 20 % (`FrameMonitor`)             | Hạ mức chất lượng vẽ một bậc (độ nét, khử răng cưa, bóng, số hạt vẽ, tần số cập nhật đồ thị). Số liệu không đổi. Đặt lại khi mở chủ đề khác | Thanh trạng thái: "Đã hạ chất lượng hiển thị… (số liệu không đổi)" |
| 2   | Máy không kịp tính đủ bước vật lý trong thời gian thực (ngân sách mỗi khung) | Chạy chậm hơn thời gian thực, giữ nguyên bước tích phân                                                                                     | "Chuyển động chậm ×0,5 để giữ độ chính xác"                        |
| 3   | Phân tử                                                                      | Mức chi tiết khối cầu theo mức chất lượng; phân tử trong app ≤ 30 nguyên tử nên chưa cần dạng cartoon                                       | —                                                                  |
| 4   | Nhiều hạt                                                                    | Va chạm hạt dùng lưới không gian (spatial hashing)                                                                                          | —                                                                  |
| 5   | Mô phỏng hạt                                                                 | Hạt chỉ minh họa; kết quả định lượng lấy từ phương trình (Fick, ODE cân bằng, Maxwell–Boltzmann)                                            | Thẻ Khoa học ghi rõ                                                |
| 6   | Giới hạn cứng                                                                | Thanh trượt giới hạn số hạt (khí ≤ 800, khuếch tán ≤ 400) theo mức chất lượng                                                               | —                                                                  |

Ổn định số học: runner phát hiện NaN/Infinity → dừng, khôi phục trạng thái hợp lệ gần nhất và báo
lỗi; hệ bảo toàn theo dõi sai lệch năng lượng (Giai đoạn 1–2); Lotka–Volterra hiển thị sai lệch của
đại lượng bảo toàn.

**Hậu kỳ 3D theo mức chất lượng (0.7.1)** (`src/ui/three/quality3d.ts`, `postfx.ts`):

| Mức                          | Vẽ thế nào                                                                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thấp                         | Không có 3D (hình 2D), không đổi.                                                                                                                                                                    |
| Trung bình                   | Không có hậu kỳ: khử răng cưa của canvas, Neutral, nền dải màu (+1 lệnh vẽ), môi trường, bóng giả.                                                                                                   |
| Cao, GPU tích hợp / phần mềm | Như Cao ở 0.7.0 (nhiều đoạn hơn, 10 nhãn, sheen/clear coat), không bóng thật, không hậu kỳ — không nặng hơn trước (Radeon 780M).                                                                     |
| Cao, GPU rời                 | Phần HDR (HalfFloat 4× MSAA + độ sâu): vật đặc → GTAO ½ → bloom (khi có vật làm nổi); rồi trên màn hình: nền → ghép tone map → màng/bóng giả vẽ thẳng như đường trực tiếp; khúc xạ, bóng thật 1024². |

Bộ canh khung hình: 30 khung hình động liên tiếp > 20 ms thì tắt AO, rồi bloom, rồi khúc xạ — chỉ
thay đổi hình, không đổi số hay vị trí nào.

Đo 2026-10-20 (SwiftShader, 1366×768, nguyên phân đang phát, 6 s): Thấp p50 16,7 ms / p95 16,7 ms
(trước 16,7 / 16,8); Trung bình p50 16,7 / p95 33,4 ms (trước 16,7 / 50), 20 lệnh vẽ (trước 19:
thêm nền), 9 604 tam giác (+2); Cao (phần mềm, không hậu kỳ) p50 33,3 / p95 50,1 ms (trước 33,3 /
66,6). Chi phí hậu kỳ trên GPU rời chưa đo trên máy thật (ước tính 2–4 ms/khung, 25–35 MB bộ nhớ
GPU; 0 khi đứng yên).

Vòng 2 (2026-10-20): hậu kỳ chia hai nửa — vật đặc qua HDR (GTAO, bloom), còn nền, màng trong suốt
và bóng giả vẽ thẳng trên màn hình như đường trực tiếp (thêm 1 lần vẽ nền + 1 quad ghép; khi bật hậu
kỳ khung nguyên phân 2n = 4 có 50 lệnh vẽ, gồm các bước hậu kỳ). Vân bề mặt (`relief.ts`) và tối
viền chỉ ở các phần nhỏ (NST, nhân con, enzyme, ARN pôlimeraza/ribôxôm), không đổi số lệnh vẽ
hay tam giác (44 lệnh, 35 828 tam giác ở 2n = 8, Cao). Bài kiểm ngân sách nguyên phân (phần mềm,
Cao, 2n = 8, phát 2×): p50 50 ms trước và sau; p95 dao động mạnh trên máy đang bận (trước 100–167
ms qua 11 lần, bản cuối 117–200 ms qua 3 lần; bước 16,7 ms), nên đã bỏ vân trên màng tế bào, giảm nhiễu
còn 1 lớp và bỏ clear coat của NST. Dựng khối protein nhanh hơn nhiều lần (lưới icosphere trực
tiếp).

Làm đẹp nguyên phân/giảm phân (2026-10-21, SwiftShader 1366×768, phát 8 s, 3 lần mỗi cách): nguyên
phân Cao 2n = 8 ở 2×: trước 125–137 khung, p50 50 ms, p95 100–117 ms; sau 114–132 khung, p50 50 ms,
p95 100–150 ms (lần đầu mỗi loạt chậm hơn, như trước); 32 lệnh vẽ như cũ. Mặt sau màng tế bào dùng
Lambert (chỉ ánh sáng khuếch tán) vì nó phủ cả tế bào: bản Standard đầu tiên làm chậm rõ trên phần
mềm. Giảm phân Nâng cao (không phóng to): như trước (≈ 190–200 khung, p50 33 ms, p95 67–83 ms).
Giảm phân Cơ bản, kì đầu I–kì giữa I: khung hình phóng vào NST nên màng tế bào phủ cả khung —
trên phần mềm Cao 140–150 khung, p50 50 ms (trước 33); Trung bình 195 khung (285 khi không phóng
to). Giống như khi người học tự cuộn phóng to; GPU thật chưa đo. Cập nhật một khung trên CPU
(2n = 46): p95 0,43–0,47 ms (trước 0,56). Bài `scene.perf.test` (< 2 ms) qua khi chạy riêng; khi
chạy cả bộ song song trên máy đang bận nó có thể vượt 2 ms — trước thay đổi cũng vậy.

**Watchdog bộ nhớ** (`src/perf/memory.ts`): 10 giây đọc heap JS một lần (WebView2/Chromium). Khi vượt
80 % ngân sách 300 MB (hoặc 80 % giới hạn heap), app giải phóng bộ nhớ đệm đã đăng ký (ví dụ: bản
ghi đồ thị vật lý giữ lại một nửa số mẫu — chỉ giảm độ phân giải đồ thị, không ảnh hưởng mô phỏng)
và hiện cảnh báo một lần. Thanh trạng thái hiện RAM hiện tại.
