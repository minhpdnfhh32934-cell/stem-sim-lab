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

| Ngày       | Giai đoạn | Máy                                               | Chỉ số                                                                            | Kết quả                                                                    |
| ---------- | --------- | ------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 2026-09-28 | 0         | Máy build (Linux)                                 | Bundle giao diện (JS gzip / CSS gzip)                                             | ≈ 90 KB / 5 KB                                                             |
| 2026-09-28 | 0         | Máy build (Linux)                                 | Tránh render thừa khi kéo panel                                                   | Các panel dùng `memo` + selector hẹp của Zustand                           |
| 2026-09-29 | 6         | Máy build (Linux, Chromium headless, vẽ bằng CPU) | Khởi động lạnh (bản build, tới khi giao diện sẵn sàng)                            | 0,28 s (DOMContentLoaded 0,14 s)                                           |
| 2026-09-29 | 6         | như trên                                          | JS tải lúc khởi động (gzip)                                                       | 168 KB (JS 161 KB + CSS 7 KB); các môn, three.js, RDKit, KaTeX tải khi cần |
| 2026-09-29 | 6         | như trên                                          | Bộ nhớ JS (heap): lúc chờ / ném xiên đang chạy / phân tử 3D / cơ chế / cuối phiên | 6 / 11 / 15 / 14 / 19 MB                                                   |
| 2026-09-29 | 6         | như trên                                          | FPS: ném xiên, thuyết va chạm (hạt), khuếch tán (hạt)                             | 60 / 60 / 60 (không kích hoạt hạ cấp)                                      |
| 2026-09-29 | 6         | như trên                                          | Thư mục `dist` (gồm RDKit WASM)                                                   | 10,1 MB                                                                    |

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

**Watchdog bộ nhớ** (`src/perf/memory.ts`): 10 giây đọc heap JS một lần (WebView2/Chromium). Khi vượt
80 % ngân sách 300 MB (hoặc 80 % giới hạn heap), app giải phóng bộ nhớ đệm đã đăng ký (ví dụ: bản
ghi đồ thị vật lý giữ lại một nửa số mẫu — chỉ giảm độ phân giải đồ thị, không ảnh hưởng mô phỏng)
và hiện cảnh báo một lần. Thanh trạng thái hiện RAM hiện tại.
