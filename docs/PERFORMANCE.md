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

Vòng 2 (2026-10-21, viền đậm cho vỏ trong suốt ở giao diện sáng + nhãn tránh NST): shader viền chỉ
thêm một phép `pow`/`mix` mỗi điểm ảnh, không thêm lệnh vẽ. Đo SwiftShader 1366×768, nguyên phân
Trung bình 2n = 4 ở 2×, 8 s, 3 lần: trước 155/173/160 khung, p50 33 ms, p95 83–100 ms; sau
152/161/172 khung, p50 33 ms, p95 67–100 ms; 31 lệnh vẽ cả hai. Mức Thấp không dùng hình 3D cho
nguyên phân/giảm phân (hiện 2D), nên không đổi. Giao diện tối không đổi một điểm ảnh nào (ảnh
trước/sau giống hệt khi chỉ có một tế bào). Nhãn: mỗi khung chiếu hộp bao các crômatit (8 đỉnh mỗi
crômatit) và các tế bào (6 điểm) lên màn hình.

**ADN → mARN → Protein và Đột biến điểm 3D — làm đẹp (2026-10-21, bản 0.7.1).** Mạch khung là ống
Catmull–Rom liền (`dogma3d/strandTube.ts`) thay cho một hình cầu + một ống trụ mỗi nuclêôtit: bộ đệm
cấp một lần theo sức chứa, chỉ các đoạn đổi mới được viết lại và tải lên (`addUpdateRange`). Khi
phiên mã, hai đoạn xoắn đứng yên hai bên bong bóng được dựng một lần ở tư thế nghỉ rồi chỉ quay
(`rigidSpan`); chỉ bong bóng (≤ 26 nuclêôtit) dựng lại mỗi khung. Đo CPU (`drawStats`, gen 300 cặp):
ADN → mARN → Protein Trung bình 197 388 → 158 880 tam giác, Cao 437 192 → 374 036, tối đa 20 lệnh vẽ
(ngân sách 32); Đột biến điểm Trung bình 402 736 → 343 280 (thay thế), Cao 879 856 → 769 880, 25 lệnh
vẽ (trước 28, ngân sách 28); dựng cảnh < 15 ms; một khung phát (thời điểm + cập nhật) vẫn < 2 ms
(p95, `scene.perf.test`). Đo SwiftShader 1366×768, gen mặc định 26 cặp, 2 lần: ADN → mARN → Protein
phát 8 s từ đầu — Trung bình trước 231/279 khung, p50 33 ms, p95 50–67 ms; sau 284/288 khung, p50 33
ms, p95 50 ms; Cao trước 159/170 khung, p50 50 ms, p95 100 ms; sau 158/161 khung, p50 50 ms, p95 83
ms. Đột biến điểm Trung bình trong 3 s viền nhấp nháy: trước 87/91 khung, sau 80/84 khung, p50 33 ms
và p95 67 ms cả hai (hai tấm nền làn phủ thêm diện tích tô). Hậu kỳ (GTAO, tỏa sáng) chỉ ở mức Cao
trên GPU rời như trước; tỏa sáng chỉ chạy khi khung bộ ba đang đọc / viền đột biến hiện. Mức Thấp
không có hình 3D cho hai bài (hiện 2D), nên không đổi; máy GPU tích hợp không bị nâng mức.

**Vòng 2 (2026-10-21).** Bazơ mARN có vật liệu riêng (thêm 1 chương trình shader, không thêm lệnh vẽ)
và được vẽ sau AO/tỏa sáng trên mức Cao. Vật cản của nhãn: "Đột biến điểm" tính một lần cho mỗi
cảnh; "ADN → mARN → Protein" tính lại chỉ khi thời điểm đổi, dùng lại mảng điểm (không cấp phát khi
phát); cỡ mỗi nhãn chữ nhỏ đo một lần cho mỗi chữ. Đo SwiftShader 1366×768, Trung bình, 2 lần: ADN →
mARN → Protein phát 8 s: 320/331 khung, p50 16,7 ms, p95 50 ms, 12 lệnh vẽ; Đột biến điểm 3 s viền
nhấp nháy: 93/91 khung, p50 33 ms, p95 50–67 ms, 25 lệnh vẽ — không chậm hơn lần đo trước.

**Di truyền Mendel và Động học enzyme 3D — làm đẹp (2026-10-21, bản 0.7.1).** Mendel thành "bàn
thí nghiệm" (khay có ô lõm và rãnh giao tử, bệ, ống đong thủy tinh có chất lỏng, vạch khắc); enzyme
trong bể kính có chất lỏng và đế. Đo CPU (`drawStats`): Mendel 9 nhóm + 200 hình con lai Trung bình
37 → 43 lệnh vẽ, 119 000 → 86 000 tam giác (Cao 44 lệnh, 174 000); enzyme Trung bình 11 → 16 lệnh
vẽ, 73 000 → 79 000 tam giác (Cao 18 lệnh, 183 000). Ngân sách trong `scene.test` cập nhật có chủ
ý. Đo SwiftShader 1366×768 (tổng khung trong lúc phát): Mendel phát lại 10 s — Trung bình trước
198/183 khung, p50 50 ms, p95 100 ms; bản đầu tiên sau khi làm đẹp chỉ còn 127/134 khung (mặt sau
mờ của 4 ống kính cao thêm 2 lớp trong suốt), nên mặt sau ống kính chỉ vẽ ở mức Cao và bàn vẽ
không chiếu sáng dưới mức có bóng (mặt phẳng, cùng màu): 175/183 khung, p50 50 ms, p95 100–117 ms;
Cao trước 103 khung, sau 102 khung (p50 100 ms). Enzyme phát đồ thị theo thời gian 6 s — Trung bình
trước 127/130 khung, p50 50 ms, p95 100 ms; sau (mặt trong và mặt sau bể chỉ ở mức Cao) 107/113/133
khung, p50 50 ms, p95 100–133 ms; Cao trước 71 khung, sau 52 khung (p95 333 ms; lớp chất lỏng và
mặt thoáng phủ cả bể — trên GPU thật không đáng kể, thang quá tải vẫn hạ mức khi chậm). Không có
khúc xạ kính ở hai bài (dữ liệu sau kính giữ đúng màu). Bóng đổ (shadow map) trên bàn/đế, GTAO và
tỏa sáng (viền enzyme được chọn) chỉ ở mức Cao trên GPU rời như trước. Mức Thấp không có hình 3D
cho hai bài (hiện 2D), nên không đổi; máy GPU tích hợp không bị nâng mức.

**Khuếch tán & thẩm thấu 3D — làm đẹp (2026-10-21, bản 0.7.1).** Khuếch tán: bể kính hai ngăn
có chất lỏng, đế và khung màng (bỏ khung dây); thẩm thấu: ống chữ U liền một khối, chất lỏng cắt
đúng mực bằng mặt phẳng cắt (`clippingPlanes`) + mặt khum, giá đỡ và thước có vạch khắc. Đo CPU
(`drawStats`): khuếch tán 400 hạt, 8 lỗ Trung bình 9 → 11 lệnh vẽ, 36 000 → 39 000 tam giác (Cao 13
lệnh, 95 000); thẩm thấu Trung bình 13 → 14 lệnh vẽ, khoảng 15 000 tam giác (Cao 16 lệnh, 38 000).
Ngân sách trong `scene.test` cập nhật có chủ ý. Đo SwiftShader 1366×768, phát 6 s (tổng khung): bản
đầu tiên của bể khuếch tán còn 212 khung ở mức Trung bình (trước 291/282) và 109 ở mức Cao (trước 199) — các lớp trong suốt mới (kính, chất lỏng, màng hai mặt vẽ hai lượt) phủ cả bể. Đã làm nhẹ:
chất lỏng không chiếu sáng và đế/khung chỉ khuếch tán (Lambert) dưới mức Cao, màng mỏng vẽ hai mặt
trong một lượt (`forceSinglePass`), ở mức Cao bỏ mặt trong của kính và lớp phủ bóng của đế, chấm
nước đục 20 mặt (không trong suốt). Sau: khuếch tán Trung bình 264/267 khung (p50 16,7 ms, p95
33–50 ms), Cao 141/143 khung (p50 50 ms, p95 100 ms); thẩm thấu Trung bình 283/288 khung (trước
252/258, p95 50 → 33 ms), Cao 159/159 (trước 163). Không có khúc xạ kính (dữ liệu sau kính giữ đúng
màu); bóng đổ (shadow map) lên đế chỉ ở mức Cao trên GPU rời. Mức Thấp hiện hình 2D cho bài này nên
không đổi; máy GPU tích hợp không bị nâng mức.

**Khuếch tán & thẩm thấu 3D — vòng 2 (2026-10-21, bản 0.7.1).** Nền sáng: kính bể có viền đậm hơn (chỉ thêm phép tính trong shader của mặt trước), chất lỏng đậm hơn (độ trong suốt đỉnh/đáy 0,14/0,26 thay vì 0,04/0,15) và một đường viền mặt nước cho hai ngăn (một lệnh vẽ, khoảng 770 tam giác). Đĩa màng thẩm thấu thêm viền tròn gộp vào cùng một lưới (không thêm lệnh vẽ). Đo CPU (`drawStats`): khuếch tán 400 hạt, 8 lỗ Trung bình 11 → 12 lệnh vẽ, khoảng 39 900 tam giác (Cao 14 lệnh, 95 800); thẩm thấu không đổi (14 lệnh Trung bình). Ngân sách trong `scene.test` cập nhật có chủ ý. SwiftShader 1366×768, phát 6 s: khuếch tán Trung bình 256/255 khung (trước 264/267, p50 16,7 ms, p95 50 ms), Cao 138 (trước 141/143); thẩm thấu Trung bình 283/283 (trước 283/288), Cao 159 (trước 159). Mức Thấp vẫn hiện 2D cho bài này; máy GPU tích hợp không bị nâng mức.

**Watchdog bộ nhớ** (`src/perf/memory.ts`): 10 giây đọc heap JS một lần (WebView2/Chromium). Khi vượt
80 % ngân sách 300 MB (hoặc 80 % giới hạn heap), app giải phóng bộ nhớ đệm đã đăng ký (ví dụ: bản
ghi đồ thị vật lý giữ lại một nửa số mẫu — chỉ giảm độ phân giải đồ thị, không ảnh hưởng mô phỏng)
và hiện cảnh báo một lần. Thanh trạng thái hiện RAM hiện tại.
