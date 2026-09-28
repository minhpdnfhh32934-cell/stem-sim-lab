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

| Ngày       | Giai đoạn | Máy               | Chỉ số                                | Kết quả                                          |
| ---------- | --------- | ----------------- | ------------------------------------- | ------------------------------------------------ |
| 2026-09-28 | 0         | Máy build (Linux) | Bundle giao diện (JS gzip / CSS gzip) | ≈ 90 KB / 5 KB                                   |
| 2026-09-28 | 0         | Máy build (Linux) | Tránh render thừa khi kéo panel       | Các panel dùng `memo` + selector hẹp của Zustand |

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
