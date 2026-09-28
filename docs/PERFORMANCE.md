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

Benchmark tự động với các cảnh chuẩn sẽ được thêm từ Giai đoạn 1.
