# SimLab — Version History & Release Notes

Lịch sử phiên bản và ghi chú phát hành của SimLab (tên cũ: STEM Sim Lab). Tạo tự động từ `release-notes/versions.json` bằng `npm run release-notes`. Đừng sửa tay. Bằng chứng được kiểm lần cuối ngày 22/10/2026.

## I. Tổng quan lịch sử SimLab

SimLab (tên cũ: STEM Sim Lab) là ứng dụng desktop mô phỏng Vật lý, Hóa học và Sinh học cho người học, chạy ngay trên máy (Tauri 2 + React). Mọi con số do chương trình tính bằng mô hình ghi trong Thẻ Khoa học; AI chỉ đọc đề và giải thích bằng lời.

Dự án bắt đầu ngày 28/09/2026: Phase 0–7 (khung app, lõi tính toán, Vật lý, AI đọc đề, Hóa học, Sinh học, dự án và bộ cài Windows) xong trong hai ngày đầu. Tiếp theo là giai đoạn 3b (học bằng khám phá, an toàn khi dùng AI, hai bộ cài), bản fork 'Thầy AI' (09–12/10/2026) mà nay là AI Teacher, rồi đổi tên thành SimLab ở 0.5.0 và đợt rà soát toàn diện G0–G5 cho 0.6.0. Bản 0.7.0 và 0.7.1 đưa cả 11 bài Sinh học lên hình 3D.

Tài liệu này được tạo tự động từ release-notes/versions.json (npm run release-notes). Mọi mốc thời gian lấy từ git, GitHub (PR, Actions, Releases) và tài liệu trong repo; ô ghi 'Chưa xác minh được' nghĩa là chưa có bằng chứng, không có nghĩa là việc đó không xảy ra. Giờ được đổi sang giờ Việt Nam (UTC+7); giá trị gốc nằm trong versions.json.

- Số phiên bản ghi nhận: 14 (0.1.0 → 0.8.0).
- Đã phát hành trên GitHub: 0.2.0 (05/10/2026), 0.3.0 (06/10/2026), 0.4.1 (12/10/2026), 0.5.0 (13/10/2026), 0.5.2 (13/10/2026), 0.6.0 (19/10/2026), 0.7.0 (20/10/2026), 0.7.1 (22/10/2026).
- Đã gộp, chưa phát hành: 0.5.1.
- Đang xét duyệt: 0.8.0.
- Bản phát triển, không phát hành: 0.1.0.
- Chưa xác minh: 0.4.0, 0.4.2, 0.4.3.
- Phiên bản mới nhất trong dữ liệu: 0.8.0 (Đang xét duyệt).

## II. Dòng thời gian phát triển từ bản gốc

Cũ nhất ở trên. Cột "Ngày phát hành" chỉ ghi ngày khi có GitHub Release thật (published\_at, giờ Việt Nam); bản chưa có Release ghi "Chưa phát hành".

| Phiên bản | Trạng thái | Ngày phát hành | PR | Tag |
| --- | --- | --- | --- | --- |
| 0.1.0 | Bản phát triển, không phát hành | Chưa phát hành | — | — |
| 0.2.0 | Đã phát hành | 05/10/2026 (đã xác minh) | — | [v0.2.0](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.2.0) |
| 0.3.0 | Đã phát hành | 06/10/2026 (đã xác minh) | — | [v0.3.0](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.3.0) |
| 0.4.0 | Chưa xác minh | Chưa phát hành | — | — |
| 0.4.1 | Đã phát hành | 12/10/2026 (đã xác minh) | [#7](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/7) | [v0.4.1](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.4.1) |
| 0.4.2 | Chưa xác minh | Chưa phát hành | [#8](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/8) | — |
| 0.4.3 | Chưa xác minh | Chưa phát hành | [#8](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/8) | — |
| 0.5.0 | Đã phát hành | 13/10/2026 (đã xác minh) | [#8](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/8), [#11](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/11), [#12](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/12), [#13](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/13), [#14](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/14) | [v0.5.0](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.5.0) |
| 0.5.1 | Đã gộp, chưa phát hành | Chưa phát hành | [#15](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/15), [#16](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/16), [#17](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/17) | — |
| 0.5.2 | Đã phát hành | 13/10/2026 (đã xác minh) | [#18](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/18), [#19](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/19) | [v0.5.2](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.5.2) |
| 0.6.0 | Đã phát hành | 19/10/2026 (đã xác minh) | [#20](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/20), [#21](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/21), [#22](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/22), [#29](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/29), [#30](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/30) | [v0.6.0](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.6.0) |
| 0.7.0 | Đã phát hành | 20/10/2026 (đã xác minh) | [#32](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/32) | [v0.7.0](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.7.0) |
| 0.7.1 | Đã phát hành | 22/10/2026 (đã xác minh) | [#35](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/35), [#38](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/38) | [v0.7.1](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.7.1) |
| 0.8.0 | Đang xét duyệt | Chưa phát hành | [#26](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/26), [#27](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/27), [#28](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/28), [#40](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/40), [#41](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/41), [#42](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/42), [#43](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/43), [#44](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/44), [#45](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/45), [#46](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/46), [#47](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/47), [#48](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/48), [#49](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/49), [#50](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/50), [#51](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/51), [#53](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/53), [#55](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/55), [#79](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/79), [#81](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/81), [#82](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/82), [#83](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/83), [#84](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/84), [#85](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/85), [#86](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/86), [#87](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/87), [#88](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/88), [#90](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/90), [#91](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/91) | — |

### Các mốc phát triển

| Thời điểm (giờ VN) | Mốc | Bằng chứng |
| --- | --- | --- |
| 28/09/2026 18:13 | Phase 0 — khung dự án, bố cục, giao diện sáng/tối, tiếng Việt/Anh, CI | commit b9a2430; docs/PROGRESS.md hàng '2026-09-28 \| 0' |
| 28/09/2026 18:34 | Phase 1 — lõi tính toán: đơn vị SI, hằng số CODATA 2022, bộ giải ODE, Thẻ Khoa học | commit 51f3540; PROGRESS '2026-09-28 \| 1' |
| 28/09/2026 22:27 | Phase 2 — 13 chủ đề Vật lý 2D | commit b3d2270 'complete Phase 2 physics MVP'; PROGRESS '2026-09-28 \| 2' |
| 29/09/2026 07:05 | Phase 3 — AI đọc đề, bảng 'Tôi hiểu đề như sau', bộ đề chuẩn 31 bài | commit e75f7f6; PROGRESS '2026-09-29 \| 3' |
| 29/09/2026 12:16 | Phase 4 — Hóa học: bảng tuần hoàn, phân tử 3D, 39 phản ứng, cân bằng phương trình | commit fcf8279 'complete Phase 4'; PROGRESS '2026-09-29 \| 4' |
| 29/09/2026 12:50 | Phase 5 — Sinh học: 11 chủ đề | commit 5d647b8; PROGRESS '2026-09-29 \| 5' |
| 29/09/2026 13:25 | Phase 6 — tệp .stemsim, hoàn tác, lịch sử, chế độ trình chiếu, tour | commit 624b23e; PROGRESS '2026-09-29 \| 6' |
| 29/09/2026 17:09 | Phase 7 — workflow bộ cài Windows, Hướng dẫn sử dụng, SCIENCE\_ACCURACY | commit 365761f; PROGRESS '2026-09-29 \| 7' |
| 29/09/2026 19:26 | Lần dựng bộ cài đầu tiên trên GitHub Actions (artifact 0.1.0, không phát hành) | run 36565163753, job 'Build Windows installers' |
| 29/09/2026 22:09 | Bắt đầu cập nhật ngay trong app (gói web ký số) | commit c515250; PROGRESS '2026-09-29 \| sửa' |
| 05/10/2026 13:20 | 3b.1 — lớp AI cắm-rút (Gemini + Claude), gỡ OpenAI, hai bản build | commit d587a4c; PROGRESS '2026-10-05 \| 3b.1' |
| 05/10/2026 20:14 | 3b.3 — an toàn và tuân thủ khi dùng AI | commit 3a52794; PROGRESS '2026-10-05 \| 3b.3' |
| 06/10/2026 10:01 | 3b.4 — giao diện cho người học (trang chủ, Cơ bản/Nâng cao) | commit df84ddf; PROGRESS '2026-10-06 \| 3b.4' |
| 06/10/2026 10:58 | 3b.5 — học bằng khám phá (Dự đoán trước, thử thách, huy hiệu) | commit a2c3561; PROGRESS '2026-10-06 \| 3b.5' |
| 06/10/2026 21:25 | 3b.6 — hai bộ cài, hai kênh cập nhật | commit b72f030; PROGRESS '2026-10-06 \| 3b.6' |
| 06/10/2026 22:30 | T0 — đặc tả Dạy học bằng AI (chờ duyệt) | commit d480445; PROGRESS '2026-10-06 \| T0' |
| 09/10/2026 | Bắt đầu bản fork 'Thầy AI' (làm ngoài git) | PROGRESS các hàng '2026-10-09 \| fork…' |
| 10/10/2026 | Fork: Gemma chạy ngay trong app bằng card đồ họa (bỏ Ollama) | PROGRESS '2026-10-10 \| fork-webgemma' |
| 11/10/2026 17:26 | Quy trình hai máy Claude Code (Lead/Builder) vào main | PR #1 gộp lúc 2026-10-11T10:26:53Z |
| 12/10/2026 18:43 | Bỏ bản thử nghiệm THPT (một bộ cài duy nhất) | commit cbb176a (máy B) và 8430959 (máy A); PROGRESS '2026-10-12 \| 0.5.0' |
| 12/10/2026 20:39 | Đổi tên app thành SimLab, 'Thầy AI' thành AI Teacher | commit f58a9be; PROGRESS '2026-10-12 \| 0.5.0-bảng' |
| 13/10/2026 | Nộp SimLab lên Microsoft Store (bản nộp 1, gói 0.5.1.0): đang chờ duyệt, chọn giữ lại | PROGRESS '0.5.1-store-nộp' ('In certification'); docs/STORE.md; commit 87df5ad |
| 13/10/2026 | Sự cố máy khởi động lại khi đo Gemma 1B trên card đồ họa tích hợp → sửa lỗi GPU-01 | docs/AUDIT\_2026-10-13.md, mục 'Sự cố' |
| 14/10/2026 02:05 | Mở PR #20 — rà soát G0–G5 (0.6.0) | PR #20 createdAt 2026-10-13T19:05:41Z; commit đầu 511345d |
| 14/10/2026 07:14 | Đánh giá cách giảng 168/168 lượt trên Gemma 1B (nhánh local) | commit 4f1e2c7; docs/TEACHING\_EVAL.md |
| 19/10/2026 10:48 | Mở PR #21 — G8: bảng dạy, “Khoanh để hỏi”, AI trên máy khác (0.6.0) | PR #21 createdAt 2026-10-19T03:48:53Z (gh pr list); đầu nhánh abc9e0c |
| 19/10/2026 18:58 | Phát hành 0.6.0 (v0.6.0): Science Studio, AI Teacher giảng trên bảng, Nguyên phân 3D | GitHub Release v0.6.0, published\_at 2026-10-19T11:58:38Z (mục 0.6.0, dates.released) |
| 20/10/2026 22:22 | Phát hành 0.7.0 (v0.7.0): bảy bài Sinh học có hình 3D riêng, sửa nhiều lỗi | GitHub Release v0.7.0, published\_at 2026-10-20T15:22:50Z, lượt Release 39444423723 |
| 21/10/2026 10:35 | Science Studio vào trong Phòng thí nghiệm (PR #35) | PR #35 mergedAt 2026-10-21T03:35:48Z (gh pr view 35), merge commit b6d7298 |
| 22/10/2026 18:40 | Phát hành 0.7.1 (v0.7.1): cả 11 bài Sinh học có hình 3D, bốn bài quần thể có khung cảnh riêng | GitHub Release v0.7.1, published\_at 2026-10-22T11:40:31Z, lượt Release 39769849056 |

## III. Chi tiết từng phiên bản

### 0.8.0 (Đang xét duyệt)

Bản 0.8.0 bám theo sách Kết nối tri thức: thêm bài Chuyển động tròn đều và Sóng dừng trên dây (Vật lí), bài Tế bào nhân sơ và nhân thực (Sinh học), thanh chọn Lớp 10 · 11 · 12 trong thư viện, và đổi tên Phòng thí nghiệm thành Virtual Lab.

- Trạng thái: Đang xét duyệt.
- Kênh phân phối: GitHub Releases: bộ cài Windows và cập nhật trong app.
- Ghi chú trạng thái: PR phiên bản mở 27/10/2026, chưa gộp, chưa phát hành; dự kiến gộp 31/10/2026 (hạn ngừng thêm tính năng của kế hoạch #37). Phần web và phần lõi cùng lên 0.8.0 theo lời giao việc 0.8.0 của chủ dự án, nên ứng dụng 0.7.1 sẽ được báo cài bộ cài mới thay vì cập nhật trong app; máy dùng cho buổi demo 07/11/2026 phải cài bộ cài 0.8.0. Bài (d) Điện trường của điện tích điểm (PR #89) còn đang duyệt lúc mở PR này: chỉ thêm vào ghi chú khi đã gộp.
- Ghi chú công khai: bản nháp, chưa duyệt để công bố (không hiện trong hộp "Có gì mới").

| Mốc | Thời điểm (giờ VN) | Giá trị gốc |
| --- | --- | --- |
| Bắt đầu phát triển | 22/10/2026 10:56 | `2026-10-22T03:56:04Z` |
| Commit đầu tiên | 22/10/2026 23:06 | `2026-10-22T23:06:49+07:00` |
| Commit cuối cùng | 27/10/2026 04:36 | `2026-10-27T04:36:56+07:00` |
| Gộp vào nhánh (merge) | Chưa xác minh được | — |
| Dựng bộ cài (GitHub Actions) | Chưa xác minh được | — |
| Phát hành (GitHub Release) | Chưa xác minh được | — |
| Tạo tag | Chưa xác minh được | — |

**Tính năng mới**

- Vật lí: bài Chuyển động tròn đều (Vật lí 10, Bài 31–32). Em chọn đề cho biết tốc độ, tốc độ góc, chu kì hay tần số; app tính các đại lượng còn lại, gia tốc hướng tâm và lực hướng tâm.
- Vật lí: bài Sóng dừng trên dây (Vật lí 11, Bài 13). Xem bụng, nút và số bó sóng; khi chưa có sóng dừng, nút "Dùng fₙ" đặt đúng tần số cộng hưởng gần nhất.
- Sinh học: bài Tế bào nhân sơ và tế bào nhân thực (Sinh học 10, Bài 7–8), hình 2D. Bấm vào từng bộ phận để xem tên và chức năng.
- Thư viện, trang chủ và bước làm quen có thanh Lớp 10 · 11 · 12 · Tất cả, xếp chủ đề theo mục lục sách Kết nối tri thức. Cách xếp này đang chờ giáo viên duyệt.
- Science Studio có hướng dẫn "Cách học" ngay trong app.

**Cải tiến**

- Đồ thị các bài Vật lí đọc được trên màn hình 1366×768: vùng vẽ cao hơn, chú giải nằm ở cột bên phải.
- Dấu "Đã học" hiện cho mọi chủ đề em đã mở, kèm số bước còn lại.
- Bảng "Tôi hiểu đề như sau" báo khi đề cho một đại lượng mà cách bố trí đang chọn không dùng tới.

**Sửa lỗi**

- Bảng của AI Teacher: không còn viết dòng nguồn "Theo ghi chú từ…", chữ phụ đề không còn kí hiệu thô, và không cắt câu giữa chừng.

**Bảo mật**

- Cập nhật các thư viện có lỗ hổng đã biết và các phụ thuộc khác.

**Thay đổi**

- "Phòng thí nghiệm" nay tên là "Virtual Lab" ở cả tiếng Việt và tiếng Anh.
- Máy đang chạy 0.7.1 cần cài bộ cài mới để lên 0.8.0; bản này không cập nhật được trong app.

**Điểm nổi bật trong app**

- Bài mới: Chuyển động tròn đều, Sóng dừng trên dây và Tế bào nhân sơ, nhân thực.
- Thư viện chọn được Lớp 10, 11, 12 theo sách Kết nối tri thức.
- Phòng thí nghiệm nay tên là Virtual Lab.
- Science Studio có hướng dẫn Cách học.

**Bằng chứng**

- devStart: issue #37 (kế hoạch 0.8.0) tạo lúc 2026-10-22T03:56:04Z (gh issue view 37); người dùng gắn approved ngày 26/10/2026; 10 issue con #68–#77 gắn approved cùng ngày
- Khoảng commit: sau ee8aaff (PR #39, ghi 0.7.1 đã phát hành) đến main 006f519; 99 commit không phải commit gộp (git rev-list --no-merges --count ee8aaff..006f519, 27/10/2026)
- firstCommit: 39bfd01 2026-10-22T23:06:49+07:00 'test(e2e): hw3d runs with reduced motion so the overload ladder cannot swap it to 2D'; lastCommit lúc mở PR này: d57b284 2026-10-27T04:36:56+07:00 'docs(work-log): (b) PR #90 review 2'
- (f) dấu "Đã học" cho mọi chủ đề đã mở: PR #79, gộp 18b6a5c 2026-10-26T12:52:42Z (issue #68)
- (g1) dữ liệu xếp lớp theo mục lục SGK Kết nối tri thức, sinh bằng scripts/data/gen\_curriculum\_kntt.py: PR #82, gộp 70b5b7c 2026-10-26T12:12:20Z (issue #71); docs/DATA\_REVIEW.md mục 12 và KNTT-1 … KNTT-11, đang chờ giáo viên duyệt
- (i1) đồ thị Vật lí đọc được ở 1366×768, test bố cục tests/e2e/layout.spec.ts: PR #81, gộp e9c5f3b 2026-10-26T17:33:59Z (issue #69)
- (j) hướng dẫn "Cách học" trong Science Studio: PR #83, gộp 41fbaee 2026-10-26T18:06:52Z (issue #72)
- (a) Chuyển động tròn đều (VL10 Bài 31–32), nhãn nhóm đơn vị (rad/s khác Hz, vòng/s, vòng/phút), cảnh báo "không dùng tới" trong bảng đọc đề: PR #87, gộp 3c728d1 2026-10-26T18:53:00Z (issue #74); DATA\_REVIEW UCM-1 … UCM-5
- Sinh (a) Tế bào nhân sơ và nhân thực, bản 2D (SH10 Bài 7–8): PR #88, gộp aeb52dd 2026-10-26T19:14:39Z (issue #77); DATA\_REVIEW CELL3D-1 … CELL3D-5
- (g2) thanh Lớp 10 · 11 · 12 · Tất cả trong thư viện, trang chủ và bước làm quen: PR #86, gộp c621f3f 2026-10-26T19:59:13Z (issue #71)
- (k) "Phòng thí nghiệm" thành "Virtual Lab" (chỉ chữ hiển thị, quyết định của chủ dự án 23/10/2026 ghi trong CLAUDE.md): PR #91, gộp f904250 2026-10-26T21:29:52Z (issue #73)
- (b) Sóng dừng trên dây (VL11 Bài 13), nút "Dùng fₙ": PR #90, gộp 006f519 2026-10-26T22:07:30Z (issue #75); DATA\_REVIEW SWV-1 … SWV-8
- Bảng của AI Teacher (dòng nguồn, chữ phụ đề, cắt câu giữa chừng, thấy trong bản ghi hình 26/10/2026): PR #55, gộp d6f9fec 2026-10-26T00:17:07Z
- Phụ thuộc có lỗ hổng: PR #48 tokio 1.53.3 (RUSTSEC-2026-0386), gộp 4321eb9 2026-10-23T15:51:45Z; PR #51 undici 8.12.3 và zod 4.6.7 (npm audit), gộp f7eb477 2026-10-24T05:12:59Z; dependabot PR #45, #49, #27, #53, #28, #26 gộp 24/10/2026
- Chỉ đổi CI và E2E, không đổi app: PR #40, #41, #42, #43, #44, #46, #47, #50, #84 (ci.yml), #85 (release.yml)

### 0.7.1 (Đã phát hành)

Science Studio chuyển vào trong Phòng thí nghiệm (một lối vào cho mỗi chủ đề). Cả 11 bài Sinh học 3D đẹp và rõ hơn: bảy bài được vẽ lại, bốn bài quần thể có khung cảnh 3D riêng; không số liệu nào của mô hình bị đổi.

- Trạng thái: Đã phát hành.
- Kênh phân phối: GitHub Releases: bộ cài Windows và cập nhật trong app.
- Ghi chú trạng thái: Phát hành 22/10/2026 từ main @ 49c4d6a (lượt Release 39769849056). Phần web và phần lõi cùng số 0.7.1, nên ứng dụng 0.7.0 được báo cài bộ cài mới thay vì cập nhật trong app. Không bắt buộc cập nhật (minRequired để trống).
- Ghi chú công khai: đã duyệt để công bố (hiện trong hộp "Có gì mới").

| Mốc | Thời điểm (giờ VN) | Giá trị gốc |
| --- | --- | --- |
| Bắt đầu phát triển | 20/10/2026 20:12 | `2026-10-20T20:12:42+07:00` |
| Commit đầu tiên | 20/10/2026 20:12 | `2026-10-20T20:12:42+07:00` |
| Commit cuối cùng | 22/10/2026 14:11 | `2026-10-22T14:11:19+07:00` |
| Gộp vào nhánh (merge) | 22/10/2026 16:57 | `2026-10-22T09:57:27Z` |
| Dựng bộ cài (GitHub Actions) | 22/10/2026 18:40 | `2026-10-22T11:40:17Z` |
| Phát hành (GitHub Release) | 22/10/2026 18:40 | `2026-10-22T11:40:31Z` |
| Tạo tag | Chưa xác minh được | — |

**Tính năng mới**

- Nút Science Studio ở đầu thư viện chủ đề và trong Tìm nhanh (Ctrl+K).
- Chủ đề có bài hướng dẫn (Rơi tự do, Thư viện phản ứng đã kiểm chứng, Nguyên phân) có nút Học theo bài ở bảng bên phải.
- Bốn bài quần thể có khung cảnh 3D ngoài trời riêng: Hardy–Weinberg (con vật mang màu kiểu gen, hũ vốn gen, đi qua từng thế hệ), Phiêu bạt di truyền (mỗi lần chạy là một hòn đảo, có cờ khi chỉ còn một alen), Tăng trưởng logistic (đàn trong hàng rào, cột đo có vạch K, thanh thời gian vẽ đường N(t)), Con mồi – vật ăn thịt (hai loài trên đồng cỏ, hai ống đo và bảng quỹ đạo pha). Bấm vào con vật hay cột đo để xem thẻ giải thích; ba bài sau còn đưa hình tới gần chỗ đã bấm.

**Cải tiến**

- Mọi bài Sinh học 3D có sân khấu mới: nền dải màu, ánh sáng kiểu phòng chụp, vật liệu riêng cho màng, nhiễm sắc thể, ADN, protein, thủy tinh và chất lỏng. Ở chất lượng Cao trên máy có card đồ họa rời còn có bóng đổ thật, bóng ở chỗ khuất và ánh sáng nổi.
- Nguyên phân và Giảm phân 3D: nhiễm sắc thể to và có khối hơn, thoi phân bào trong mờ, màng tế bào và màng nhân có viền rõ trên nền sáng; nhãn không bao giờ đè lên nhiễm sắc thể.
- ADN → mARN → Protein và Đột biến điểm 3D: chuỗi xoắn có mạch khung liền và cặp bazơ bo tròn, ARN pôlimeraza và ribôxôm trong suốt, tARN hình chữ L; khi Theo dõi dịch mã, máy quay tới gần ribôxôm.
- Di truyền Mendel 3D thành bàn thí nghiệm: khay Punnett có ô, ống đong cho tỉ lệ kiểu hình, đủ 16 kiểu gen ở góc nhìn Bảng Punnett, mỗi số đếm của lần tạo ngẫu nhiên có ghi tên nhóm. Động học enzyme 3D đặt trong bể kính.
- Khuếch tán & thẩm thấu 3D: bể kính hai ngăn có màng và lỗ thật, ống chữ U có mặt khum, thước có vạch khắc; bể và màng dễ thấy trên nền sáng.

**Sửa lỗi**

- Thẩm thấu 3D: đáy mặt khum nay đúng bằng mực chất lỏng của mô hình, nên đọc ở đáy mặt khum ra đúng số.
- Động học enzyme 3D: hạt sản phẩm mới chỉ đi ra từ phức hợp enzyme–cơ chất (ES), không bao giờ từ phức hợp có chất ức chế (ESI).
- Đột biến điểm 3D: dấu “chuỗi kết thúc sớm” chỉ hiện khi bộ ba kết thúc thật sự đến sớm, không hiện khi chỉ mất trọn một bộ ba.
- Dịch mã 3D: màu bazơ của mARN và tARN không còn nhạt đi.
- Ở chất lượng Cao trên máy có card đồ họa rời, nền, màng tế bào và bóng dưới tế bào có đúng màu như ở các mức khác.
- Science Studio: tab môn Vật lý nay ghi “Vật lý” như tên môn ở mọi chỗ khác trong app (trước đây ghi “Vật lí”).

**Bảo mật**

- Phần lõi của ứng dụng dùng bản mới của thư viện kiểm tra chứng chỉ khi kết nối Internet.

**Hiệu năng**

- Các hiệu ứng ánh sáng nặng chỉ bật ở chất lượng Cao trên máy có card đồ họa rời; máy dùng đồ họa tích hợp không bị nâng mức và không có các hiệu ứng này, mức Thấp vẫn dùng hình 2D.

**Thay đổi**

- Trang mở đầu chỉ còn Phòng thí nghiệm và AI Teacher; Science Studio mở từ trong Phòng thí nghiệm, cạnh thư viện chủ đề.
- Ở chủ đề Rơi tự do, Dự đoán trước dẫn sang bài Science Studio thay vì có một phần dự đoán thứ hai.

**Vấn đề đã biết**

- Bản này đổi phần lõi, nên máy đã cài 0.7.0 cần cài bộ cài mới (không cập nhật được trong app).
- Khi quần thể đông hơn số hình vẽ được, mỗi hình ứng với nhiều cá thể và số hình được làm tròn; góc hình ghi rõ “1 hình = … cá thể”. Con vật, cây cỏ và chuyển động chỉ là minh họa.
- Lời giải thích mới đi kèm các hình 3D đang chờ giáo viên duyệt; số liệu vẫn do mô hình của bài tính.

**Điểm nổi bật trong app**

- Science Studio nằm ngay trong Phòng thí nghiệm, mở được từ chủ đề đang học.
- Bảy bài Sinh học 3D được vẽ lại đẹp và rõ hơn: ánh sáng mới, nhiễm sắc thể, chuỗi xoắn ADN, protein, thủy tinh và chất lỏng trông có khối thật.
- Bốn bài quần thể (Hardy–Weinberg, phiêu bạt di truyền, tăng trưởng logistic, con mồi – vật ăn thịt) có khung cảnh 3D riêng: đồng cỏ, đảo, con vật và cột đo; số con vẽ ra lấy từ mô hình của bài.
- Hình 3D khớp với mô hình hơn: mặt khum ở thẩm thấu đúng mực, sản phẩm enzyme chỉ ra từ phức hợp ES, dấu kết thúc sớm chỉ hiện khi chuỗi thật sự dừng sớm.
- Hiệu ứng đẹp nhất chỉ bật trên máy có card đồ họa rời; máy yếu vẫn dùng được như trước và có hình 2D.

**Bằng chứng**

- Quyết định của chủ dự án 20/10/2026: giữ tên Science Studio, bỏ thẻ Science Studio ở trang mở đầu (ghi trong CLAUDE.md, docs/ARCHITECTURE.md §3f)
- Science Studio trong Phòng thí nghiệm (PR #35): 61258ea 2026-10-20T23:03:28+00:00 'feat(studio): embed guided lessons in lab'; tiếp theo 9fb3061 (mở bài từ chủ đề, bỏ dự đoán trùng) và a5661cb (test)
- PR #35 mở 21/10/2026; 9be792c: vite 8.3.4 (npm audit); fbde966: rustls-webpki 0.103.16, webpki-root-certs 1.0.10 (cargo audit); phần lõi lên 0.7.1 theo quyết định của người dùng 21/10/2026
- firstCommit: c3cab4c 2026-10-20T20:12:42+07:00 'feat(3d): GPU class and post-processing flags in the quality table', commit đầu của phần Sinh học 3D trên nhánh feat/0.7.1 (sớm hơn 61258ea của PR #35); 46 commit c3cab4c … 8b6cc69, rồi gộp origin/main (b6d7298) ở 3bdb73a
- PR #35 đã gộp vào main lúc 2026-10-21T03:35:48Z (gh pr view 35, merge commit b6d7298); 22/10/2026: git fetch, origin/main vẫn ở b6d7298 và đã có trong nhánh (git log HEAD..origin/main rỗng), nên không phải gộp lại; nhánh feat/0.7.1 chưa có PR (gh pr list --head feat/0.7.1, 22/10/2026)
- Sinh học 3D: bộ công cụ c3cab4c, 5a3ddaf, c4decca, 01b1ef3, 1afbcbd; Nguyên phân và Giảm phân 9de55fc, 7079dd0; ADN → mARN → Protein và Đột biến điểm 0adba18, 4d6769b, b74758d; Mendel b97b2b5, 12f6fc1; Động học enzyme 3e3115c, 24ac90b; Khuếch tán & thẩm thấu 304ef28, ee773a0. Lời văn và hình mới: docs/DATA\_REVIEW.md mục 30–34 (M3D-33/34, MEI3D-15, DOG3D-11/12, MUT3D-5, MEN3D-6/7, ENZ3D-7/8, TRA3D-7 … 11, đang chờ duyệt); số đo từng mức chất lượng: docs/PERFORMANCE.md; nhật ký: docs/PROGRESS.md các hàng 0.7.1-\*
- Bốn bài quần thể 3D trên nhánh feat/0.7.1: bộ công cụ 0b4970f (chọn hình, dáng nghỉ, ánh sáng ngoài trời), 2f135f1 (cận cảnh, nhãn gọi tên); Hardy–Weinberg 1f51d5d, 5b9efef; Phiêu bạt di truyền fdfeecb, 6232792; Tăng trưởng logistic b5852b5, ccfc01e; Con mồi – vật ăn thịt 6a8b391, a3d8a97. Lời văn mới: docs/DATA\_REVIEW.md mục 35–42 (HW3D-1 … 8, DRF3D-1 … 7, LOG3D-1 … 6, LV3D-1 … 5, đang chờ duyệt); mục 43 gom danh mục duyệt của 0.7.1
- bd95467: E2E Nguyên phân 3D bền hơn khi máy chạy thử bận, ngân sách hiệu năng không đổi
- lastCommit: 2b069b6 2026-10-22T14:11:19+07:00 'perf(3d): software WebGL leaves out the look's accents', commit mã cuối của bản (sau 7f35c78 'fix(studio): subject tab says "Vật lý"…' và dafff80); commit tài liệu và gộp đến sau
- PR #34 (ghi 0.7.0 đã phát hành) gộp vào main 2026-10-22T09:18:07Z (0a89fa5); gộp main vào feat/0.7.1 ở 357e866, các tệp sinh ra được tạo lại bằng npm run release-notes, không sửa tay
- dafff80: E2E bốn bài quần thể 3D chỉ đọc vị trí khi camera đã dừng (hook moving() của Bio3DCanvas); lỗi CI lv3d "Mặt phẳng pha" và logistic3d 17,27 \< 19,17 tái hiện được trên máy khi làm chậm khung hình 400 ms; không điều kiện kiểm tra nào bị nới
- Bài đo @perf nguyên phân 3D trên CI (dafff80): p95 200 / 216,7 / 216,6 ms \> 150. Đo trên cùng một máy (SwiftShader, máy chủ dev chạy sẵn): 0.7.0 p95 66,7 ms, 0.7.1 83,3 ms. 2b069b6: Quality3D.accents — chỉ khi WebGL chạy bằng phần mềm mới bỏ đèn phụ + đèn viền, mặt sau sáng mờ của vỏ trong suốt và clear coat của bài phân bào; sau đó p95 66,6–66,7 ms (docs/PERFORMANCE.md). GPU tích hợp và GPU rời giữ nguyên vẻ 0.7.1
- PR #38 gộp 2026-10-22T09:57:27Z (49c4d6a), CI 8/8 đạt trên PR ở 357e866; CI trên main ở 49c4d6a: job E2E lần 1 hỏng ở bài @perf (p95 216,6 / 216,7 / 216,7 ms, máy CI dùng chung chậm hơn), chạy lại lần 2 đạt 8/8
- built: lượt Release 39769849056 (workflow\_dispatch, main, 49c4d6a), job 'Build Windows installers' xong 2026-10-22T11:40:17Z
- released: GitHub Release v0.7.1 'SimLab 0.7.1', published\_at 2026-10-22T11:40:31Z, target 49c4d6a, latest; tệp: SimLab\_0.7.1\_x64-setup.exe, SimLab\_0.7.1\_x64\_en-US.msi, web-bundle.zip, web-update.json, SHA256SUMS.txt
- web-update.json: webVersion 0.7.1, minNative 0.7.1, minRequired "" (không bắt buộc), có signature và signatureV2
- tagged: tag nhẹ (lightweight), git không lưu ngày tạo tag

### 0.7.0 (Đã phát hành)

Bản cập nhật cho Sinh học 3D và sửa lỗi. Giảm phân, ADN → mARN → Protein, Đột biến điểm, Di truyền Mendel, Động học enzyme và Khuếch tán & thẩm thấu có hình 3D riêng; Nguyên phân 3D rõ và đẹp hơn. Mọi con số trong hình 3D do mô hình của bài tính. Ngoài ra sửa nhiều lỗi ở mô phỏng Vật lí, Hóa học, Sinh học, AI Teacher, bảng dạy, giọng đọc và phần cập nhật trong app.

- Trạng thái: Đã phát hành.
- Kênh phân phối: GitHub Releases: bộ cài Windows và cập nhật trong app.
- Ghi chú trạng thái: Phát hành 20/10/2026 từ main @ 433c3a9 (lượt Release 39444423723). Phần web và phần lõi cùng số 0.7.0, nên ứng dụng 0.6.x được báo cài bộ cài mới thay vì cập nhật trong app. Không bắt buộc cập nhật (minRequired để trống).
- Ghi chú công khai: đã duyệt để công bố (hiện trong hộp "Có gì mới").

| Mốc | Thời điểm (giờ VN) | Giá trị gốc |
| --- | --- | --- |
| Bắt đầu phát triển | 19/10/2026 20:08 | `2026-10-19T20:08:43+07:00` |
| Commit đầu tiên | 19/10/2026 20:08 | `2026-10-19T20:08:43+07:00` |
| Commit cuối cùng | 20/10/2026 18:35 | `2026-10-20T18:35:27+07:00` |
| Gộp vào nhánh (merge) | 20/10/2026 21:59 | `2026-10-20T14:59:56Z` |
| Dựng bộ cài (GitHub Actions) | 20/10/2026 22:22 | `2026-10-20T15:22:28Z` |
| Phát hành (GitHub Release) | 20/10/2026 22:22 | `2026-10-20T15:22:50Z` |
| Tạo tag | Chưa xác minh được | — |

**Tính năng mới**

- Giảm phân 3D: 12 bước từ G1 tới phân chia tế bào chất II ở tế bào động vật, có trao đổi chéo và điểm bắt chéo. Số NST, crômatit, ADN do mô hình đếm; hình 3D và hình 2D dùng cùng một lần sắp xếp ngẫu nhiên.
- ADN → mARN → Protein 3D: chuỗi xoắn kép mở ra, mARN được tổng hợp rồi ribôxôm dịch từng bộ ba. Chữ cái, bộ ba và axit amin lấy từ trình tự em nhập và bảng mã di truyền.
- Đột biến điểm 3D: ADN bình thường và ADN đột biến đặt cạnh nhau, kèm mARN và chuỗi axit amin trước và sau đột biến; chỗ nuclêôtit thay đổi và các axit amin khác nhau được tô nổi.
- Di truyền Mendel 3D: bố mẹ, giao tử, bảng Punnett và cột con lai cao theo xác suất; phần con lai ngẫu nhiên dùng cùng lần tạo ngẫu nhiên với bảng 2D.
- Động học enzyme 3D: tỉ lệ enzyme đang gắn cơ chất theo v/Vmax của công thức trong bài (làm tròn); có các dạng enzyme gắn chất ức chế và thang “1 hạt = … mM”.
- Khuếch tán & thẩm thấu 3D: số hạt mỗi ngăn theo định luật Fick ở mọi thời điểm, hạt đi qua lỗ màng; ống chữ U có thước cm và mực nước lấy từ đồ thị của bài.
- Hardy–Weinberg, Phiêu bạt di truyền, Tăng trưởng logistic và Con mồi – vật ăn thịt có hình 3D đơn giản: mỗi hình là một cá thể hoặc một nhóm cá thể (có ghi chú), số lượng lấy từ mô hình.

**Cải tiến**

- Nguyên phân 3D: mỗi crômatit co xoắn dần ngay tại chỗ, ánh sáng mới, tên bộ phận hiện trên hình, máy ảnh chuyển cảnh mượt; ở chất lượng Cao có màng nhân kép vỡ thành túi nhỏ, trung tử 9 bộ ba vi ống và túi tạo tấm tế bào.
- Mỗi bài Sinh học có nút 3D / 2D và nhớ lựa chọn; khi chất lượng hiển thị là Thấp, máy không có WebGL hoặc card đồ họa gặp lỗi, bài tự dùng hình 2D và nói lý do.
- Đồ thị ghi đơn vị ở tên trục và có đủ vạch chia; công thức dài trong Thẻ Khoa học tự thu nhỏ cho vừa khung thay vì phải cuộn ngang.
- Nút “Hỏi thầy” không còn che khung mô phỏng; nút bấm trên màn hình cảm ứng đủ lớn (≥ 40 px); chữ mờ dễ đọc hơn ở cả giao diện sáng và tối.
- Chế độ Cơ bản của các bài Sinh học giữ các thông số phụ sau nút “Thêm thông số”.

**Sửa lỗi**

- Vật lí: đổi g khi đang chạy nay chạy lại đúng ở con lắc, lò xo, mặt phẳng nghiêng, ròng rọc và đường ray (trước đây vẫn chạy theo g cũ). Sửa thêm: thời điểm gặp nhau ở chuyển động thẳng, báo lỗi khi dây con lắc sẽ bị chùng hoặc ném từ mặt đất mà không có vận tốc hướng lên, chu kì lò xo có tắt dần, máy Atwood cân bằng và kết luận của bài hạt qua hai đỉnh dốc.
- Sinh học: ống thẩm thấu báo đúng khi nhánh nước cạn, con mồi – vật ăn thịt giữ chính xác khi quần thể rất nhỏ, điểm uốn của đường logistic, tên đột biến quanh bộ ba mở đầu và chuỗi protein khi đột biến tạo bộ ba mở đầu mới.
- Hóa học: động học cân bằng tính chính xác và hình động không còn đứng hình; phương trình viết khác với phản ứng trong thư viện không còn bị gắn nhãn đã kiểm chứng; hệ số thập phân bị báo lỗi; nguyên tử trung tâm VSEPR và cấu trúc SMILES hiển thị đúng chất đang tìm.
- AI: “Giải thích” chấp nhận các số do SimLab tính; cụm từ phủ định (“không có ma sát”…) không bị đọc thành một giá trị; nút dừng dừng được câu trả lời của Gemma trong app.
- AI Teacher, bảng dạy và giọng đọc: xóa trò chuyện thì dừng câu trả lời; tra thư viện và Wikipedia dùng đúng lời em hỏi; bảng giữ đúng phép chia, lũy thừa và số thập phân; giọng đọc đọc đúng 2gh, khoảng giá trị, 0,125, đơn vị m³/s² và 5′→3′; công thức tải lỗi không làm bảng treo.
- Các từ sinh học như “túi tự sát” (lizôxôm), “tế bào tự sát”, từ tiếng Anh “sex chromosomes” và các dãy số liệu không còn bị chặn nhầm.
- Cập nhật trong app: bản đang mở không còn bị xóa trước khi khởi động lại (trước đây các chủ đề chưa mở có thể không tải được); tải gói cập nhật lớn không còn bị ngắt vì quá giờ.
- Card đồ họa có mã nhận dạng dài (ví dụ máy Windows chạy chip ARM) nay chọn được trong Cài đặt.
- Mở tệp .stemsim từ bất kỳ màn hình nào cũng hiện đúng chủ đề; phím tắt của phòng thí nghiệm chỉ hoạt động khi đang ở phòng thí nghiệm; chú thích nổi hiện trên hộp thoại; xuất CSV chỉ có ở chế độ Nâng cao; g chuẩn hiện là 9,80665; “Hướng dẫn nhanh” từ menu mở đúng phòng thí nghiệm.
- Science Studio: dự đoán và kết luận theo đúng ngôn ngữ đang chọn; bài Vật lí ở lại bước thí nghiệm sau khi chạy như hai môn kia.

**Bảo mật**

- Chụp ảnh đề bài nay cũng theo cổng an toàn và bộ lọc nội dung; khi em chọn Gemma, ảnh không bao giờ được gửi lên mạng.
- Hộp cập nhật bắt buộc và câu hỏi về tuổi hiện lại nếu bị đóng bằng phím Esc.
- Câu hỏi bị chặn ở lại ô nhập để em sửa, không còn bị lưu hay gửi đi sau đó.

**Hiệu năng**

- Hình 3D chỉ vẽ lại khi có thay đổi, chia mức chi tiết theo chất lượng hiển thị và giải phóng bộ nhớ khi rời bài; khi máy chậm, chuyển động bớt mượt nhưng số liệu vẫn giữ nguyên độ chính xác.

**Thay đổi**

- Các bài Sinh học mở bằng hình 3D; bấm 2D để quay lại hình cũ.

**Vấn đề đã biết**

- Bốn bài về quần thể (Hardy–Weinberg, Phiêu bạt di truyền, Tăng trưởng logistic, Con mồi – vật ăn thịt) mới có hình 3D đơn giản; hình 3D riêng, chi tiết như các bài khác sẽ có trong một bản cập nhật sau.
- Lời văn và cách vẽ của các hình 3D mới đang chờ giáo viên duyệt. Hình dạng, kích thước, vị trí và chuyển động trong hình 3D chỉ là minh họa; chỉ số lượng và tỉ lệ lấy từ mô hình.
- Giảm phân 3D chỉ vẽ tế bào động vật và bốn tế bào con bằng nhau (phân chia không đều ở con cái chỉ được ghi chú); chưa có giảm phân ở thực vật.
- Các vấn đề đã biết của bản 0.6.0 về Gemma và AI qua API vẫn còn (xem ghi chú 0.6.0).
- Bản Microsoft Store cần nộp gói mới và chờ Microsoft duyệt, nên người dùng Store nhận bản này muộn hơn người dùng bản tải từ GitHub.

**Điểm nổi bật trong app**

- Hình 3D mới cho Giảm phân, ADN → mARN → Protein, Đột biến điểm, Di truyền Mendel, Động học enzyme và Khuếch tán & thẩm thấu: xoay, phóng to và xem từng bước.
- Nguyên phân 3D rõ và đẹp hơn: NST co xoắn dần, tên các bộ phận hiện ngay trên hình.
- Số NST, số hạt, tỉ lệ con lai… trong hình 3D đều do mô hình của bài tính; hình dạng và chuyển động chỉ là minh họa. Máy yếu thì tự dùng hình 2D.
- Sửa nhiều lỗi ở mô phỏng Vật lí, Hóa học và Sinh học, ví dụ đổi g giữa chừng nay chạy lại đúng.
- AI Teacher, bảng dạy và giọng đọc ít lỗi hơn: đọc đúng đơn vị, xóa trò chuyện là dừng câu trả lời.

**Bằng chứng**

- firstCommit: d86c099 2026-10-19T20:08:43+07:00 'fix(physics): restart the run when g changes…', commit mã đầu tiên sau af13bc4 (ghi chú phát hành 0.6.0, sau tag v0.6.0 = feab5a8)
- lastCommit: b59cc1a 2026-10-20T18:35:27+07:00 'test(e2e): stable full runs with every biology lesson in 3D' (trước đó 825a08f: bài test hạt khuếch tán quá giờ khi chạy song song); sau đó là 745c913 'chore(lint): skip the git-ignored .agent-logs folder', 3fd363b 'chore(release): 0.7.0' (nâng phiên bản, ghi chú này) và 7f616cd 'docs(0.7.0)' (CLAUDE.md, ARCHITECTURE, USER\_GUIDE, DATA\_REVIEW, PROGRESS)
- feab5a8..b59cc1a: 87 commit trên nhánh feat/0.7, 402 tệp thay đổi (git diff --stat). Nhánh trên GitHub (origin/feat/0.7) đã tới 3773296; 825a08f, b59cc1a và commit phát hành sau chúng mới có trên máy người phát triển (20/10/2026)
- Sửa lỗi Vật lí d86c099 … 97029c9, Hóa học – Sinh học c52cd58 … 4c9fb7f, AI / bảng dạy / giọng đọc dc3112e … 25834a9, giao diện và dự án 52e0ecf … de16278, Rust 9e005c8 (gpu.rs) và b990432 (webupdate.rs); lời văn khoa học mới: docs/DATA\_REVIEW.md mục 24 và 25 (đang chờ duyệt)
- Sinh học 3D: bộ công cụ 3D dùng chung ff4f63f, d1de33b (src/ui/three, src/biology/view3d); Nguyên phân 3D 14f9423, 276656a, 6dadbd7, 353813a; Giảm phân 15ae66c; ADN → mARN → Protein 2ea45a6; Đột biến điểm 745dea0, 1a8f717; Mendel b361e3c; Động học enzyme 1c00c7c; Khuếch tán & thẩm thấu f302cff. Lời văn và hình mới: docs/DATA\_REVIEW.md mục 26–28 và các dòng M3D-25 … 32, MEI3D, DOG3D, MUT3D, MEN3D, ENZ3D, TRA3D (đang chờ duyệt)
- Bốn bài quần thể (Hardy–Weinberg, phiêu bạt di truyền, tăng trưởng logistic, con mồi – vật ăn thịt) có hình 3D đơn giản từ bộ công cụ chung (6a49c5d, bd23ab3); hình 3D riêng như bảy bài kia chưa làm
- GitHub: không có PR nào từ nhánh feat/0.7 (gh pr list --head feat/0.7, 20/10/2026); chưa có lượt Release, tag hay GitHub Release cho 0.7.0
- PR #32 gộp 2026-10-20T14:59:56Z (433c3a9), CI 8/8 đạt trên PR (job E2E chạy lại một lần: bài đo hiệu năng @perf dao động trên máy CI dùng chung)
- built: lượt Release 39444423723 (workflow\_dispatch, main, 433c3a9), job 'Build Windows installers' xong 2026-10-20T15:22:28Z
- released: GitHub Release v0.7.0 'SimLab 0.7.0', published\_at 2026-10-20T15:22:50Z, target 433c3a9 (gh api …/releases/latest)
- web-update.json: webVersion 0.7.0, minNative 0.7.0, minRequired "" (không bắt buộc), có signature và signatureV2
- tagged: tag nhẹ (lightweight), git không lưu ngày tạo tag

### 0.6.0 (Đã phát hành)

Bản lớn: Science Studio mới với bài học có hướng dẫn cho Hóa học, Sinh học, Vật lí và trang Soạn bài. AI Teacher giảng trên cả bảng, có “Khoanh để hỏi”, dùng được chương trình AI em tự cài trên máy (Ollama, LM Studio, llama.cpp), dùng kết quả do SimLab tính và nói rõ điều gì chưa kiểm chứng. Ngoài ra có mô phỏng Nguyên phân 3D, Gemma có thêm lớp bảo vệ trên card đồ họa tích hợp và nhiều sửa lỗi bảo mật.

- Trạng thái: Đã phát hành.
- Kênh phân phối: GitHub Releases: bộ cài Windows và cập nhật trong app.
- Ghi chú trạng thái: Phát hành 19/10/2026 từ main @ feab5a8 (lượt Release 39246720932). Phần web và phần lõi cùng số 0.6.0, nên ứng dụng 0.5.x được báo cài bộ cài mới thay vì cập nhật trong app. Không bắt buộc cập nhật (minRequired để trống).
- Ghi chú công khai: đã duyệt để công bố (hiện trong hộp "Có gì mới").

| Mốc | Thời điểm (giờ VN) | Giá trị gốc |
| --- | --- | --- |
| Bắt đầu phát triển | 13/10/2026 22:42 | `2026-10-13T22:42:01+07:00` |
| Commit đầu tiên | 13/10/2026 22:42 | `2026-10-13T22:42:01+07:00` |
| Commit cuối cùng | 19/10/2026 10:25 | `2026-10-19T10:25:02+07:00` |
| Gộp vào nhánh (merge) | 19/10/2026 17:30 | `2026-10-19T10:30:25Z` |
| Dựng bộ cài (GitHub Actions) | 19/10/2026 18:58 | `2026-10-19T11:58:19Z` |
| Phát hành (GitHub Release) | 19/10/2026 18:58 | `2026-10-19T11:58:38Z` |
| Tạo tag | Chưa xác minh được | — |

**Tính năng mới**

- Science Studio (trang mở đầu → thẻ “Science Studio”): bài học có hướng dẫn theo các bước Dự đoán → Thí nghiệm → Quan sát → Giải thích → Kết luận → Báo cáo. Vật lí: rơi tự do, thả từ độ cao gấp đôi và so sánh hai lần chạy A và B. Hóa học: bàn thí nghiệm ảo nhận biết ion Cl⁻ bằng dung dịch AgNO₃. Sinh học: Nguyên phân 3D, tìm kì mà NST kép xếp hàng ở mặt phẳng xích đạo và tìm bộ phận tế bào theo chức năng. Mọi số đo do mô phỏng tính; hiện tượng và phương trình hóa học chép từ thư viện phản ứng của SimLab.
- Soạn bài trong Science Studio: tạo, sửa, nhân bản, xóa và xem trước bài học cho ba môn; nhập và xuất tệp bài học. Chỉ chọn được những gì mô phỏng chạy được; bài soạn lưu trên máy này và luôn ghi “chưa được kiểm duyệt”.
- Báo cáo bài học trong Science Studio: xem trước, sao chép hoặc lưu thành tệp, với số đo của mô phỏng tách riêng khỏi phần em viết; bài đang làm được giữ lại khi mở lại app. Nút “Hỏi thầy” mở AI Teacher với câu hỏi viết sẵn; thầy chỉ thấy số đo và ghi chú của bài khi em bật “Lấy thông tin từ màn hình”.
- Mô phỏng Nguyên phân 3D cho tế bào động vật và thực vật: 7 bước, phát/tạm dừng/từng bước, xoay, chọn một bộ phận để đọc chức năng, có Thẻ Khoa học riêng.
- Thẻ 'Kết quả do SimLab tính' khi câu hỏi có phương trình hóa học: bộ cân bằng của SimLab giải phương trình, AI chỉ giải thích.
- Nút 'Gợi ý từng bước', và nút 'Xem mô phỏng' dưới câu trả lời khi câu hỏi nêu đúng tên một chủ đề có mô phỏng.
- Nút 'Dừng' để dừng câu trả lời đang viết, với Gemma lẫn AI trực tuyến.
- SimLab nhắc khi đề bài có thể còn thiếu số liệu, và liệt kê các con số AI tự đưa ra mà chưa ai cho (chưa kiểm chứng).
- Cảnh báo khi bật giọng đọc mà máy không có giọng tiếng Việt.
- Hộp 'SimLab đã được cập nhật' cho biết điểm mới sau khi cập nhật, và trang 'Lịch sử phiên bản' trong Cài đặt.
- “Khoanh để hỏi” trên bảng: khoanh, gạch chân hoặc chạm vào chỗ muốn hỏi rồi bấm “Hỏi thầy chỗ này”. App đọc đúng chữ, công thức và nhãn hình đang có trên bảng; câu trả lời hiện trong khung chat và bài giảng chờ đến khi bấm “Quay lại bài giảng”. Chỗ không có chữ chỉ được gửi dạng ảnh cho AI đọc ảnh chạy trên máy, không lên mạng.
- Cài đặt → “AI trên máy khác”: tìm, kiểm tra và chọn chương trình AI em tự cài trên máy (Ollama, LM Studio, llama.cpp hoặc máy chủ kiểu OpenAI) cho AI Teacher, “Phân tích đề” và “AI diễn giải”. Chỉ dùng địa chỉ trên chính máy; khi chương trình lỗi, app nói rõ và không tự gửi câu hỏi lên mạng; mô hình cloud của Ollama bị từ chối.
- Phóng to, thu nhỏ bảng (1–2×) và nút “Vừa khung”; chữ đã viết không đổi chỗ.
- Nguyên phân 3D: nút “Hỏi thầy về bộ phận này” mở AI Teacher với câu hỏi viết sẵn về bộ phận đang chọn.
- Trên ứng dụng desktop, câu trả lời của AI trực tuyến (Gemini, Claude, Groq) hiện dần trong khi đang viết.

**Cải tiến**

- Với AI trực tuyến, AI Teacher được hướng dẫn giảng theo trình tự: mục tiêu, giải thích đơn giản, ví dụ, các bước có lý do, một lỗi hay gặp. Gemma được dặn trả lời thẳng câu hỏi trước rồi giải thích ngắn, có lý do. Câu trả lời về khái niệm được dặn kết thúc bằng một câu hỏi kiểm tra (trừ Gemma trên card đồ họa tích hợp, để câu trả lời ngắn); Gemma 1B thường chưa làm theo (khoảng 1/5 câu trả lời khi đo).
- Thầy đọc đúng chữ đang viết trên bảng; tạm dừng giữa câu thì đọc lại câu đó; đọc ký hiệu đúng hơn (2n, \[S\], (aq), mũi tên phản ứng).
- Khi giọng đọc gặp lỗi, giọng dự phòng đọc tiếp từ đoạn chưa nghe, không đọc lặp.
- Gemma trả lời đúng ý hơn và bắt đầu nhanh hơn; câu trả lời lẫn chữ nước ngoài ít hơn hẳn (50 % → 7 %) và viết méo thuật ngữ cũng ít hơn (19 % → 4,8 %), nhưng vẫn còn (đo với Gemma 1B trên 42 câu hỏi; câu trả lời dài hơn trước).
- Tìm ghi chú kiến thức hợp với câu hỏi tốt hơn; ghi chú lạc đề không được gửi cho AI.
- Giọng đọc trên máy: âm lượng giữa các đoạn như nhau, tiếng đầu tiên đến sớm hơn, ngắt nghỉ theo câu và mệnh đề, không cắt giữa số và đơn vị; trước ý chính có một quãng nghỉ ngắn.
- Đọc đúng hơn nhiều ký hiệu khoa học: MeV, MPa, đơn vị mét vuông/mét khối, cấu hình electron, mũi tên phản ứng, "tan" trong hòa tan.
- Bảng chỉ trình bày nội dung bài học: phần suy nghĩ nội bộ của AI, câu lặp lại lời nhắc, dòng nguồn và ký hiệu định dạng thừa không được viết lên bảng hay đọc to; lời chào chỉ được nói, không viết.
- Thầy dùng cả bảng: mỗi bảng được chia theo nội dung (một, hai hoặc ba cột), phần không vừa xuống một dải ngang cả bảng, công thức dài viết thành nhiều dòng; không có chữ đè lên nhau khi đổi cỡ cửa sổ hay phóng to.
- Lỗi AI được nói bằng lời dễ hiểu (hết lượt, sai khóa, mất mạng, chương trình trên máy chưa mở…), dòng “gửi tới” nêu đúng nơi câu hỏi sẽ được gửi, và nhà cung cấp dự phòng chỉ trả lời khi nhà cung cấp chính hết lượt hoặc hết tiền.

**Sửa lỗi**

- Gemma có thể làm treo card đồ họa tích hợp và khiến máy khởi động lại: nay sau một lỗi card, Gemma dừng tới khi mở lại app; card tích hợp dùng lời nhắc ngắn hơn; câu trả lời bị treo được tự dừng.
- Khi bật giọng đọc, bài giảng trên bảng có thể dừng sau câu đầu tiên.
- Giọng đọc chạy trên máy không bao giờ nạp lại vào card đồ họa vừa gặp lỗi; khi card lỗi, giọng chuyển sang CPU.
- Bút của thầy có thể vẫn viết trên bảng cũ khi chuyển sang bảng khác: nay mỗi lượt giảng chỉ viết trên bảng của nó, và quay lại bảng cũ thì phần đã viết vẫn còn.
- “Viết tiếp” không còn ẩn hay đảo các dòng đã viết và không để lại phần dở dang.
- Giữ phím Enter không còn gửi câu hỏi đang gõ trong ô chat.

**Bảo mật**

- Quy trình phát hành chặt hơn: chỉ phát hành mã đã có trên nhánh chính, bước ký số chạy riêng, mọi công cụ tự động được ghim đúng phiên bản; bật quét bí mật và cảnh báo thư viện có lỗ hổng.
- Liên kết do AI viết không còn bấm được, và cửa sổ app không mở trang web lạ bên trong.
- Tài liệu và ghi chú đưa cho AI được đánh dấu là dữ liệu tham khảo, không phải lệnh.
- Giới hạn lượt AI mỗi ngày chắc chắn hơn (mặc định 100 lượt).
- Mô hình Gemma và giọng đọc trên máy luôn tải đúng một phiên bản đã ghim.

**Hiệu năng**

- Không tra Wikipedia khi Gemma đã có ghi chú phù hợp trong thư viện.

**Thay đổi**

- Phiên bản 0.6.0 thay đổi cả phần lõi: máy đang dùng 0.5.x cần tải bộ cài mới một lần.

**Vấn đề đã biết**

- Gemma 1B vẫn hay sai kiến thức và có lúc khen câu trả lời sai của học sinh; hãy kiểm tra lại bằng mô phỏng hoặc sách.
- Chưa đánh giá cách giảng với Gemini, Claude hoặc Groq thật (chưa có khóa để thử).
- Mô tả các kì của Nguyên phân 3D đang chờ giáo viên duyệt.
- Bản Microsoft Store cần nộp gói mới và chờ Microsoft duyệt, nên người dùng Store nhận bản này muộn hơn người dùng bản tải từ GitHub.
- Các lớp bảo vệ mới cho Gemma trên card đồ họa tích hợp chưa được thử lại trên một card tích hợp thật.
- Trên máy không có card đồ họa rời, giọng đọc trên máy chạy bằng CPU và chậm hơn lời nói nên có quãng chờ giữa các đoạn; ở bản này quãng chờ còn dài hơn trước (trung vị 7,3 s → 8,4 s mỗi câu, đo trên 19 câu).
- Giọng MMS không có ngữ điệu, cảm xúc thật; chưa có người nghe chấm độ tự nhiên.
- “Khoanh để hỏi”, AI trên máy khác, câu trả lời hiện dần và nút “Hỏi thầy” của Science Studio mới chỉ được thử với dịch vụ giả lập: chưa thử với khóa API thật hay Ollama, LM Studio, llama.cpp thật; ảnh vùng khoanh chưa được thử trên ứng dụng desktop.
- SimLab không chọn được card đồ họa cho chương trình AI trên máy khác; chọn trong chính chương trình đó.
- Nội dung bài học của Science Studio (mục tiêu, câu hỏi, gợi ý, kết luận tham khảo), thư viện phản ứng hóa học và mô tả kì, bộ phận tế bào của Nguyên phân 3D đang chờ giáo viên duyệt; Studio ghi “chưa được kiểm duyệt” cạnh những phần này.
- Science Studio mới có một bài cho mỗi môn, và Soạn bài chỉ tạo được bài trên các mô phỏng đó: rơi tự do (Vật lí), các phản ứng tạo kết tủa có trong thư viện (Hóa học), Nguyên phân 3D (Sinh học).

**Điểm nổi bật trong app**

- Science Studio mới: mỗi môn Hóa học, Sinh học, Vật lí có một bài học có hướng dẫn (dự đoán, thí nghiệm, quan sát, giải thích, báo cáo), và trang Soạn bài để tự tạo thêm bài.
- “Khoanh để hỏi”: khoanh chỗ em chưa hiểu trên bảng rồi hỏi thầy đúng chỗ đó.
- Thầy dùng cả bảng: bảng chia cột theo nội dung, công thức dài viết thành nhiều dòng, chữ không đè lên nhau.
- Dùng được chương trình AI em tự cài trên máy (Ollama, LM Studio, llama.cpp); khi chương trình lỗi, câu hỏi không tự bị gửi lên mạng.
- AI trả lời trung thực hơn: con số do SimLab tính, số AI tự đưa ra được ghi là chưa kiểm chứng, và lỗi được nói bằng lời dễ hiểu.

**Bằng chứng**

- firstCommit: 511345d 2026-10-13T22:42:01+07:00 'fix(security): release integrity…' (G1), commit đầu sau tag v0.5.2 (c25ad9d)
- Nâng phiên bản: 0ec0577 2026-10-14T00:14:16+07:00 'chore(release): 0.6.0 (web + native)' — package.json 0.5.2 → 0.6.0; tauri.conf.json, Cargo.toml 0.5.1 → 0.6.0
- lastCommit: abc9e0c 2026-10-19T10:25:02+07:00 'docs(release-notes): unreleased 0.6.0 notes for the G8 work; PROGRESS row with test numbers' = đầu PR #21 (origin/feat/teacher-board-runtime); commit mã cuối của G8: 051816b 2026-10-19T10:02:17+07:00. Science Studio chưa được commit nên không có trong lastCommit
- PR #20 'Audit G0–G5: security, GPU safety, AI Teacher teaching, 3D mitosis (0.6.0)' mở lúc 2026-10-13T19:05:41Z, chưa gộp
- Các commit f527f18..8a3c48d (98 commit, gồm commit gộp phần giọng đọc 10d35e0 và các sửa lỗi rà soát cuối) đã được đẩy lên PR #20 ngày 14/10/2026
- built: không có lượt release.yml nào cho nhánh này; chỉ có lượt 'Security checks' trên PR (2026-10-13T19:05:44Z). AUDIT ghi bản release dựng trên máy người phát triển báo app\_info = 0.6.0
- Mô tả PR #20: chưa dựng bộ cài Windows; bản Store cần nộp lại gói mới
- Gemma quality: docs/TEACHING\_EVAL.md (2026-10-14): key facts 31.3 % (0.5.2 prompt and decoding) -\> 47.7 % (v2 prompt, answer-only decoding); answers with foreign script 50 % -\> 7 %; corrupted terms 19 % -\> 4.8 %; first piece p50 1.90 s -\> 0.91 s; answer length 810 -\> 1047 characters. The blind AI judge still flagged language problems in 31 % of v2 answers; check question in 18.8 % of concept/misconception answers.
- Voice: docs/VOICE\_BENCHMARK.md §6 (2026-10-14): 19 sentences on the CPU, legacy vs natural pipeline: loudness spread 2.47 -\> 0 dB, first sound 4.07 -\> 3.22 s, waits between pieces per sentence (median) 7.3 -\> 8.4 s, no dropped/reordered words in either; RTF about 2 on the CPU in both modes. Nobody has listened to it yet (no naturalness rating).
- Gemma safeguards on integrated graphics (GPU-01): not retested on an integrated card after the fix (docs/AUDIT\_2026-10-13.md G2, 1B on AMD 780M: 'Không đo lại').
- G8: 120 commit 895ecf6..051816b (14/10–19/10/2026) trên feat/teacher-board-runtime, gồm nhánh gộp feat/local-ai-runtime (9a49b83, aac007a); đường dẫn dữ liệu mới và điều cần xác nhận: docs/AI\_TUTOR.md 'Where data goes', docs/LEGAL\_COMPLIANCE.md mục 2f
- G8 AI paths: docs/AI\_COMPATIBILITY.md (checked 2026-10-19) — every row is unit/E2E-tested against fakes or implemented only; none verified with a real provider key or a real local runtime
- PR #21 'G8: board shows only lessons, circle to ask, whole board, local AI runtimes, pen fix, honest AI connections' mở lúc 2026-10-19T03:48:53Z, nhánh feat/teacher-board-runtime, đầu abc9e0c, chưa gộp (gh pr list, 19/10/2026)
- Science Studio: docs/work-log/2026-10-19-S1-core-physics.md, -S2-chemistry, -S3-biology, -S3b-biology-finish, -S4-authoring, -S5-ai-report và -release-prep; nhánh feat/science-studio trên máy người phát triển (đã stage, chưa commit); nội dung khoa học mới: docs/DATA\_REVIEW.md mục 20–23 (đang chờ duyệt)
- PR #20 gộp 2026-10-19T09:14:09Z (a3b832d); PR #22 gộp 2026-10-19T09:45:44Z (c051a5e, kéo theo #21); PR #29 gộp 2026-10-19T10:00:56Z (cae3487); PR #30 gộp 2026-10-19T10:30:25Z (feab5a8), CI 8/8 đạt trên PR và trên main @ feab5a8
- built: lượt Release 39246720932 (workflow\_dispatch, main, feab5a8), job 'Build Windows installers' xong 2026-10-19T11:58:19Z
- released: GitHub Release v0.6.0 'SimLab 0.6.0', published\_at 2026-10-19T11:58:38Z, target feab5a8 (gh api …/releases/latest)
- web-update.json: webVersion 0.6.0, minNative 0.6.0, minRequired "" (không bắt buộc), có signature và signatureV2
- tagged: tag nhẹ (lightweight), git không lưu ngày tạo tag

### 0.5.2 (Đã phát hành)

Giao diện đẹp và dễ dùng hơn: tìm nhanh bằng Ctrl+K, Gemma trả lời hiện dần từng chữ, ghim quỹ đạo để so sánh. Đây là bản cập nhật phần giao diện; bộ cài đi kèm mang số 0.5.1.

- Trạng thái: Đã phát hành.
- Kênh phân phối: GitHub Releases: chỉ cập nhật phần web (bộ cài giữ số phiên bản lõi cũ).
- Ghi chú trạng thái: Chỉ nâng phần web (package.json 0.5.2); phần lõi giữ 0.5.1, nên bộ cài kèm Release mang số 0.5.1. Đây cũng là lần đầu các thay đổi của 0.5.1 đến tay người dùng.
- Ghi chú công khai: đã duyệt để công bố (hiện trong hộp "Có gì mới").

| Mốc | Thời điểm (giờ VN) | Giá trị gốc |
| --- | --- | --- |
| Bắt đầu phát triển | 13/10/2026 20:14 | `2026-10-13T20:14:02+07:00` |
| Commit đầu tiên | 13/10/2026 20:14 | `2026-10-13T20:14:02+07:00` |
| Commit cuối cùng | 13/10/2026 21:38 | `2026-10-13T21:38:33+07:00` |
| Gộp vào nhánh (merge) | 13/10/2026 21:38 | `2026-10-13T14:38:34Z` |
| Dựng bộ cài (GitHub Actions) | 13/10/2026 21:49 | `2026-10-13T14:49:42Z` |
| Phát hành (GitHub Release) | 13/10/2026 21:50 | `2026-10-13T14:50:00Z` |
| Tạo tag | Chưa xác minh được | — |

**Tính năng mới**

- Tìm nhanh bằng Ctrl+K: chủ đề, trang, mục Cài đặt và thao tác; gõ không dấu vẫn tìm được.
- Câu trả lời của Gemma hiện dần từng chữ.
- Ghim quỹ đạo để so sánh trước và sau khi đổi thông số (bản sao của vết đã ghi, không tính lại).
- Bản đồ nhỏ của bảng trắng.
- Thanh tải cho biết thời gian còn lại ('còn khoảng … phút').
- Hiệu ứng nhẹ khi đoán đúng hoặc đạt thử thách (tắt khi bật giảm chuyển động).

**Cải tiến**

- Ô chọn và thẻ có viên chọn trượt; nút Chạy/Dừng và Sáng/Tối đổi hình mượt; khung chờ dạng xương thay vòng xoay.
- Tìm chủ đề không thấy thì gợi ý môn khác có kết quả, kèm nút 'Xóa tìm kiếm'.
- Thanh công cụ, bảng số nổi và đồng hồ có nền kính mờ.

**Sửa lỗi**

- Bảng thông tin phân tử không còn tràn khỏi cột Thuộc tính (sửa từ 0.5.1).
- Nút AI Teacher không còn che cột cuối của bảng; nay nằm ở góc vùng mô phỏng (sửa từ 0.5.1).
- Khung chat không còn mở cao hết màn hình (sửa từ 0.5.1).

**Bảo mật**

- Mỗi đoạn trả lời hiện dần của Gemma đều qua bộ lọc an toàn; có đoạn không an toàn thì cả câu trả lời bị thu lại.

**Hiệu năng**

- Tìm nhanh chỉ được tải khi dùng lần đầu (gói 6 kB), nên app mở vẫn nhẹ.

**Vấn đề đã biết**

- Bộ cài kèm bản này mang số 0.5.1 vì phần lõi không đổi; phần giao diện là 0.5.2.
- Máy đang dùng 0.5.0 cần tải bộ cài mới một lần.

**Điểm nổi bật trong app**

- Tìm nhanh bằng Ctrl+K, gõ không dấu cũng được.
- Câu trả lời của Gemma hiện dần từng chữ.
- Ghim quỹ đạo để so sánh trước và sau khi đổi thông số.
- Bản đồ nhỏ giúp đi lại trên bảng trắng.
- Thanh tải cho biết còn khoảng bao nhiêu phút.

**Bằng chứng**

- firstCommit: f25e3ae 2026-10-13T20:14:02+07:00 (commit đầu của PR #18)
- Nâng phiên bản: b1471c5 2026-10-13T21:34:59+07:00 — package.json 0.5.1 → 0.5.2; tauri.conf.json vẫn 0.5.1
- PR #18 gộp lúc 2026-10-13T14:29:18Z; PR #19 gộp lúc 2026-10-13T14:38:34Z (c25ad9d = tag v0.5.2)
- built: lượt Release 38415240996 (main, c25ad9d), job 'Build Windows installers' xong 2026-10-13T14:49:42Z
- released: GitHub Release v0.5.2 'SimLab 0.5.2', published\_at 2026-10-13T14:50:00Z, target c25ad9d (gh api …/releases)
- tagged: tag nhẹ (lightweight), git không lưu ngày tạo tag
- AUDIT G0: 'main @ c25ad9d (PR #19 đã merge, Release v0.5.2 đã phát hành). CI 4/4 đạt.'

### 0.5.1 (Đã gộp, chưa phát hành)

Chuẩn bị đưa SimLab lên Microsoft Store và sửa vài lỗi bố cục. Bản này không có bản phát hành riêng; các sửa lỗi đến với người dùng qua bản 0.5.2.

- Trạng thái: Đã gộp, chưa phát hành.
- Kênh phân phối: Microsoft Store (bản nộp duyệt).
- Ghi chú trạng thái: Không có tag v0.5.1 và không có GitHub Release riêng; bộ cài lõi 0.5.1 được phát hành lần đầu kèm Release v0.5.2. Gói Microsoft Store 0.5.1.0 đã gửi duyệt ngày 13/10/2026 và được chọn giữ lại; chưa có tài liệu nào cho thấy app đã lên Store.
- Ghi chú công khai: bản nháp, chưa duyệt để công bố (không hiện trong hộp "Có gì mới").

| Mốc | Thời điểm (giờ VN) | Giá trị gốc |
| --- | --- | --- |
| Bắt đầu phát triển | 13/10/2026 12:49 | `2026-10-13T12:49:58+07:00` |
| Commit đầu tiên | 13/10/2026 12:49 | `2026-10-13T12:49:58+07:00` |
| Commit cuối cùng | 13/10/2026 15:32 | `2026-10-13T15:32:06+07:00` |
| Gộp vào nhánh (merge) | 13/10/2026 12:56 | `2026-10-13T05:56:11Z` |
| Dựng bộ cài (GitHub Actions) | 13/10/2026 21:49 | `2026-10-13T14:49:42Z` |
| Phát hành (GitHub Release) | Chưa xác minh được | — |
| Tạo tag | Chưa xác minh được | — |

**Tính năng mới**

- Gói cài cho Microsoft Store; bản cài từ Store chỉ cập nhật qua Store (nút 'Mở Microsoft Store').
- Trang chính sách quyền riêng tư trên GitHub Pages.

**Sửa lỗi**

- Bảng thông tin phân tử không còn tràn khỏi cột Thuộc tính.
- Nút AI Teacher không còn che cột cuối của bảng; nay nằm ở góc vùng mô phỏng.
- Khung chat không còn mở cao hết màn hình.

**Vấn đề đã biết**

- Gói Store 0.5.1.0 đang chờ duyệt và được giữ lại; lúc ghi, app chưa có trên Microsoft Store.
- Gói Store này dùng giao diện cũ, chưa có phần làm đẹp của 0.5.2.
- Chưa kiểm chứng: cài thử gói Store và bộ kiểm tra của Windows (WACK).

**Điểm nổi bật trong app**

- Chuẩn bị bản SimLab cho Microsoft Store.
- Bảng phân tử không còn tràn, nút AI Teacher không còn che bảng.

**Bằng chứng**

- firstCommit: 2d506e7 2026-10-13T12:49:58+07:00 'feat(store): Microsoft Store package…' — package.json, tauri.conf.json, Cargo.toml 0.5.0 → 0.5.1
- PR #15 gộp lúc 2026-10-13T05:56:11Z; PR #16 lúc 08:20:00Z; PR #17 lúc 08:35:20Z
- lastCommit: 069df6c 2026-10-13T15:32:06+07:00 'chore(store): submit Store updates by hand…'
- built: không có lượt Release riêng cho 0.5.1; bộ cài lõi 0.5.1 do lượt 38415240996 (cùng phần web 0.5.2) dựng, job xong 2026-10-13T14:49:42Z
- Không có tag v0.5.1 và không có Release v0.5.1 (gh api …/releases, git ls-remote origin)
- Microsoft Store: docs/STORE.md và PROGRESS '0.5.1-store-nộp' ghi đã gửi duyệt ngày 13/10/2026, trạng thái 'In certification', giữ lại tới khi bấm Publish now

### 0.5.0 (Đã phát hành)

App đổi tên thành SimLab, 'Thầy AI' thành AI Teacher. AI Teacher giảng trên bảng trắng và đọc bằng giọng tiếng Việt; chọn được card đồ họa cho Gemma; trí nhớ hội thoại dài hơn.

- Trạng thái: Đã phát hành.
- Kênh phân phối: GitHub Releases: bộ cài Windows và cập nhật trong app.
- Ghi chú công khai: đã duyệt để công bố (hiện trong hộp "Có gì mới").

| Mốc | Thời điểm (giờ VN) | Giá trị gốc |
| --- | --- | --- |
| Bắt đầu phát triển | 12/10/2026 18:43 | `2026-10-12T18:43:51+07:00` |
| Commit đầu tiên | 12/10/2026 18:43 | `2026-10-12T18:43:51+07:00` |
| Commit cuối cùng | 13/10/2026 09:19 | `2026-10-13T09:19:30+07:00` |
| Gộp vào nhánh (merge) | 13/10/2026 07:25 | `2026-10-13T00:25:18Z` |
| Dựng bộ cài (GitHub Actions) | 13/10/2026 09:39 | `2026-10-13T02:39:21Z` |
| Phát hành (GitHub Release) | 13/10/2026 09:39 | `2026-10-13T02:39:36Z` |
| Tạo tag | Chưa xác minh được | — |

**Tính năng mới**

- AI Teacher giảng trên bảng trắng: chữ viết tay tiếng Việt, công thức, khoanh/gạch chân/đóng khung, đồ thị và sơ đồ lực do chương trình vẽ, bút cho học sinh.
- Giọng đọc tiếng Việt với 3 nguồn: giọng Windows, Gemini TTS (trực tuyến) và giọng MMS chạy ngay trên máy.
- Chọn card đồ họa chạy Gemma trên Windows: gợi ý card rời, nút 'Mở lại ngay'.
- Trí nhớ hội thoại dài hơn, có tóm tắt phần cũ; Cài đặt 'Trí nhớ hội thoại: Vừa/Dài'.
- Nút 'Viết tiếp' khi câu trả lời dài bị dừng giữa chừng; thầy viết tiếp ngay trên cùng bảng.

**Cải tiến**

- AI Teacher được viết câu trả lời dài hơn trước.
- Cài đặt chia thành 11 trang nhỏ.
- Ô chọn đẹp hơn; trang AI Teacher và Phòng thí nghiệm gọn hơn; không để một chữ đứng một mình trên một dòng.

**Sửa lỗi**

- Gemma luôn chạy trên card tích hợp dù máy có card rời.
- Nút nhanh chỉ gửi đúng hai chữ 'Chậm hơn' nên AI hiểu sai; nay gửi câu hướng dẫn đầy đủ.
- Ghi chú kiến thức có sẵn được đánh dấu là đang chờ giáo viên duyệt.

**Hiệu năng**

- Bộ cài và gói cập nhật nhỏ hơn: bộ cài 21,6 MB (0.4.1) → 11,7 MB, gói cập nhật 32,1 MB → 18,2 MB.

**Thay đổi**

- Đổi tên app thành SimLab và 'Thầy AI' thành AI Teacher; dữ liệu và khóa đã lưu được giữ nguyên.
- Chỉ còn một bản cài (bỏ bản thử nghiệm THPT): một bộ cài, một kênh cập nhật; bỏ năm sinh, mã PIN người giám sát và phiếu đồng ý của phụ huynh.
- Các khung không còn ẩn/hiện bằng nút hay phím tắt Ctrl+B/I/J; vẫn kéo để đổi kích thước được.
- Phần lõi thay đổi: cần tải bộ cài mới một lần.

**Vấn đề đã biết**

- Máy đã cài bản thử nghiệm THPT (0.4.1 trở về trước) không nhận cập nhật nữa.
- Chưa kiểm chứng lúc phát hành: Gemma trên card rời sau khi gộp, giọng Gemini TTS với khóa thật, giọng 'Microsoft An' trong app, bộ cài Windows.

**Điểm nổi bật trong app**

- AI Teacher giảng trên bảng trắng, có công thức, đồ thị và sơ đồ lực.
- Giọng đọc tiếng Việt: giọng Windows, Gemini hoặc giọng chạy ngay trên máy.
- Chọn card đồ họa rời để Gemma chạy nhanh hơn.
- Trí nhớ hội thoại dài hơn và nút 'Viết tiếp'.
- App đổi tên thành SimLab; Cài đặt chia thành trang nhỏ.

**Bằng chứng**

- firstCommit: cbb176a 2026-10-12T18:43:51+07:00 (máy B), lần đầu package.json 0.4.1 → 0.5.0; máy A nâng riêng ở 6b89f13 2026-10-12T23:41:16+07:00; hai nhánh gộp ở 7a127ae
- merged: PR #14 gộp lúc 2026-10-13T00:25:18Z (65ae076); cùng đợt PR #8, #11, #12, #13; trước tag còn PR #3, #5, #6, #9
- lastCommit: c6d01f4 2026-10-13T09:19:30+07:00 (gộp PR #6) = tag v0.5.0
- built: lượt Release 38336613170 (main, c6d01f4), job 'Build Windows installers' xong 2026-10-13T02:39:21Z
- released: GitHub Release v0.5.0 'SimLab 0.5.0', published\_at 2026-10-13T02:39:36Z, target c6d01f4 (gh api …/releases)
- tagged: tag nhẹ (lightweight), git không lưu ngày tạo tag
- Kích thước tài sản Release: bộ cài .exe 21 645 425 byte (v0.4.1) → 11 707 857 byte; web-bundle.zip 32 130 306 → 18 231 166 byte
- Một tệp ZIP mang tên v0.5.0 được tạo lúc 2026-10-12 23:43 (+07), trước khi gộp PR #8: khác bản phát hành (chưa mở)

### 0.4.3 (Chưa xác minh)

Bước phát triển nội bộ theo yêu cầu người dùng: trí nhớ hội thoại dài hơn, nút 'Viết tiếp', bỏ ẩn/hiện khung. Không phát hành riêng; nội dung đến người dùng trong 0.5.0.

- Trạng thái: Chưa xác minh.
- Kênh phân phối: Không phân phối.
- Ghi chú trạng thái: Nhãn nội bộ, chưa bao giờ là số phiên bản trong package.json (commit cbb176a nâng thẳng 0.4.1 → 0.5.0). Không có tag, Release hay ZIP. Nội dung, trừ bảng giảng LessonBoard đã bị thay, đến với người dùng trong 0.5.0.
- Ghi chú công khai: bản nháp, chưa duyệt để công bố (không hiện trong hộp "Có gì mới").

| Mốc | Thời điểm (giờ VN) | Giá trị gốc |
| --- | --- | --- |
| Bắt đầu phát triển | 12/10/2026 | `2026-10-12` |
| Commit đầu tiên | 12/10/2026 18:43 | `2026-10-12T18:43:51+07:00` |
| Commit cuối cùng | 12/10/2026 18:43 | `2026-10-12T18:43:51+07:00` |
| Gộp vào nhánh (merge) | 13/10/2026 07:25 | `2026-10-13T00:25:20Z` |
| Dựng bộ cài (GitHub Actions) | Chưa xác minh được | — |
| Phát hành (GitHub Release) | Chưa xác minh được | — |
| Tạo tag | Chưa xác minh được | — |

**Tính năng mới**

- Trí nhớ hội thoại theo độ dài, có tóm tắt phần cũ, và nút 'Viết tiếp' khi câu trả lời chạm giới hạn.
- Bảng giảng các bước hiện dần (sau đó được thay bằng bảng trắng ở 0.5.0).

**Cải tiến**

- AI được viết câu trả lời dài hơn.

**Sửa lỗi**

- Nút nhanh chỉ gửi đúng hai chữ 'Chậm hơn' nên Gemma hiểu sai; nay gửi câu hướng dẫn đầy đủ.

**Thay đổi**

- Bỏ ẩn/hiện khung (3 nút trên thanh trên cùng, phím Ctrl+B/I/J, nút X).

**Vấn đề đã biết**

- Chưa kiểm chứng: chất lượng tóm tắt và câu trả lời với Gemma và API thật, bộ cài Windows.

**Điểm nổi bật trong app**

- Trí nhớ hội thoại dài hơn và nút 'Viết tiếp'.

**Bằng chứng**

- Nhãn 0.4.3 chỉ có trong docs/PROGRESS.md ('fork-0.4.3'), CLAUDE.md và mô tả PR #8
- Một commit chung cho 0.4.2–0.5.0: cbb176a 2026-10-12T18:43:51+07:00 (máy B)
- merged: PR #8 gộp lúc 2026-10-13T00:25:20Z (vào nhánh bảng trắng, commit gộp 7a127ae)
- Bảng giảng LessonBoard.tsx bị xóa khi gộp, thay bằng bảng trắng (PROGRESS '0.5.0-gộp')

### 0.4.2 (Chưa xác minh)

Bước phát triển nội bộ: chọn card đồ họa cho Gemma trên Windows. Không phát hành riêng; nội dung đến người dùng trong 0.5.0.

- Trạng thái: Chưa xác minh.
- Kênh phân phối: Không phân phối.
- Ghi chú trạng thái: Nhãn nội bộ, chưa bao giờ là số phiên bản trong package.json. Không có tag, Release hay ZIP. Nội dung đến với người dùng trong 0.5.0.
- Ghi chú công khai: bản nháp, chưa duyệt để công bố (không hiện trong hộp "Có gì mới").

| Mốc | Thời điểm (giờ VN) | Giá trị gốc |
| --- | --- | --- |
| Bắt đầu phát triển | 12/10/2026 | `2026-10-12` |
| Commit đầu tiên | 12/10/2026 18:43 | `2026-10-12T18:43:51+07:00` |
| Commit cuối cùng | 12/10/2026 19:44 | `2026-10-12T19:44:51+07:00` |
| Gộp vào nhánh (merge) | 13/10/2026 07:25 | `2026-10-13T00:25:20Z` |
| Dựng bộ cài (GitHub Actions) | Chưa xác minh được | — |
| Phát hành (GitHub Release) | Chưa xác minh được | — |
| Tạo tag | Chưa xác minh được | — |

**Tính năng mới**

- Chọn card đồ họa chạy Gemma trên Windows: danh sách card và bộ nhớ, gợi ý card rời, nút 'Mở lại ngay'.

**Sửa lỗi**

- Gemma luôn chạy trên card tích hợp dù máy có card rời.

**Vấn đề đã biết**

- Chưa kiểm chứng: tốc độ Gemma thật trên từng card, bộ cài Windows.

**Điểm nổi bật trong app**

- Chọn card đồ họa rời cho Gemma.

**Bằng chứng**

- Nhãn 0.4.2 chỉ có trong docs/PROGRESS.md ('fork-0.4.2'), CLAUDE.md ('GPU choice (0.4.2)') và mô tả PR #8
- firstCommit: cbb176a 2026-10-12T18:43:51+07:00 (máy B), commit chung cho 0.4.2–0.5.0; lastCommit: d15587e 2026-10-12T19:44:51+07:00 'fix(ci): allow Windows-only GPU items…'
- merged: PR #8 gộp lúc 2026-10-13T00:25:20Z
- Đo thật trên laptop AMD Radeon 610M + NVIDIA RTX 5070: bản 0.4.1 luôn chạy trên card tích hợp; chọn card rời nhanh khoảng 10 lần ở phép tính mẫu (PROGRESS 'fork-0.4.2', docs/AI\_TUTOR.md)

### 0.4.1 (Đã phát hành)

Ra mắt Thầy AI (nay là AI Teacher): trang trò chuyện riêng, Think kiểm tra chéo bằng một AI thứ hai, Gemma chạy ngay trên máy, thư viện kiến thức STEM và ô 'Dữ liệu của em đi đâu?'.

- Trạng thái: Đã phát hành.
- Kênh phân phối: GitHub Releases: bộ cài Windows và cập nhật trong app.
- Ghi chú trạng thái: Bản phát hành công khai đầu tiên của nhánh AI Teacher (lúc đó gọi là 'Thầy AI'), gồm cả nội dung của bản ZIP 0.4.0. Release được publish từ nhánh fork/thay-ai 6 phút trước khi PR #7 được gộp; mã phát hành (e342263) đúng là mã được gộp.
- Ghi chú công khai: đã duyệt để công bố (hiện trong hộp "Có gì mới").

| Mốc | Thời điểm (giờ VN) | Giá trị gốc |
| --- | --- | --- |
| Bắt đầu phát triển | 12/10/2026 | `2026-10-12` |
| Commit đầu tiên | 12/10/2026 12:52 | `2026-10-12T12:52:15+07:00` |
| Commit cuối cùng | 12/10/2026 12:53 | `2026-10-12T12:53:02+07:00` |
| Gộp vào nhánh (merge) | 12/10/2026 13:17 | `2026-10-12T06:17:26Z` |
| Dựng bộ cài (GitHub Actions) | 12/10/2026 13:11 | `2026-10-12T06:11:16Z` |
| Phát hành (GitHub Release) | 12/10/2026 13:11 | `2026-10-12T06:11:35Z` |
| Tạo tag | Chưa xác minh được | — |

**Tính năng mới**

- Trang mở đầu với hai lối vào Phòng thí nghiệm và Thầy AI; khung chat nổi trong phòng thí nghiệm và trang Thầy AI riêng.
- Think: một nhà cung cấp AI thứ hai rà soát và viết lại câu trả lời.
- Gemma chạy ngay trên máy bằng card đồ họa: tải về một lần (bản 270M khoảng 345 MB), trả lời không gửi gì ra mạng.
- Thư viện kiến thức STEM (66 ghi chú) và thêm được tài liệu văn bản của riêng em.
- Chụp đề bằng camera; thầy đọc câu trả lời bằng giọng của máy; tin nhắn hiển thị công thức và khung code.
- Ô 'Dữ liệu của em đi đâu?', dòng cho biết câu hỏi sẽ được gửi tới đâu, nhãn AI và nút báo cáo trên mỗi câu trả lời.

**Cải tiến**

- Kiểm tra chỗ trống trước khi tải mô hình, nút 'Hủy tải', báo lỗi tải dễ hiểu và bước 'đang nạp vào GPU'.

**Sửa lỗi**

- Sửa 5 lỗi khiến Gemma không chạy được ở bản ZIP 0.4.0, gồm nút 'Đang tải…' quay mãi và việc mỗi lần mở app phải tải lại mô hình.
- Cài mới không còn bị kẹt chờ Gemma khi đã có khóa AI trực tuyến.
- Think không còn bị từ chối khi dùng Gemini kèm dự phòng Groq.

**Bảo mật**

- Tra Wikipedia thành tùy chọn, mặc định tắt (bản fork trước đó gửi câu hỏi tới Wikipedia mỗi lần mà không báo).
- Trang ngoài chỉ mở được từ một danh sách cố định.

**Thay đổi**

- Phần lõi thay đổi: cần tải bộ cài mới một lần.

**Vấn đề đã biết**

- Gemma 270M hay trả lời lạc đề.
- Chưa kiểm chứng lúc phát hành: Gemma 1B/E2B, chất lượng trả lời sau khi rút gọn lời nhắc, bộ cài Windows.

**Điểm nổi bật trong app**

- Gặp Thầy AI (nay là AI Teacher): hỏi bài ngay trong app.
- Gemma chạy ngay trên máy, không cần mạng sau khi tải.
- Think: một AI thứ hai kiểm tra lại câu trả lời.
- Thư viện kiến thức STEM với 66 ghi chú.
- Ô 'Dữ liệu của em đi đâu?' cho biết câu hỏi được gửi tới đâu.

**Bằng chứng**

- 17e1cd4 (nhánh local master, 2026-10-12T12:52:15+07:00) và e342263 (GitHub, 12:53:02+07:00) cùng tiêu đề 'feat(fork): Thầy AI 0.4.1 …'; e342263 nâng package.json, tauri.conf.json, Cargo.toml 0.3.0 → 0.4.1
- merged: PR #7 gộp lúc 2026-10-12T06:17:26Z (abb4339)
- built: lượt Release 38210325461 (nhánh fork/thay-ai, e342263), job 'Build Windows installers' xong 2026-10-12T06:11:16Z
- released: GitHub Release v0.4.1 'STEM Sim Lab 0.4.1', published\_at 2026-10-12T06:11:35Z, target e342263 — 6 phút trước khi PR #7 được gộp
- tagged: tag nhẹ (lightweight), git không lưu ngày tạo tag
- git diff cea9d93 e342263: gồm trang mở đầu, chat, khuôn mặt thầy, thư viện kiến thức, camera, giọng đọc và engineChoice — tức cả công việc của bản fork 09–12/10
- Release v0.4.1 vẫn có bộ cài THPT (STEM.Sim.Lab.THPT\_0.4.1)

### 0.4.0 (Chưa xác minh)

Bản thử 'Thầy AI' gửi dạng tệp ZIP: trang mở đầu hai lối vào, chat, Think, Gemma chạy trên máy, thư viện kiến thức. Chưa xác minh được nội dung chính xác của ZIP; các tính năng này được phát hành chính thức ở 0.4.1.

- Trạng thái: Chưa xác minh.
- Kênh phân phối: Tệp ZIP gửi tay.
- Ghi chú trạng thái: Bản fork 'Thầy AI' gửi dưới dạng tệp ZIP. Không commit nào mang số 0.4.0 (package.json đi thẳng 0.3.0 → 0.4.1) và ZIP chưa được mở để kiểm. Nội dung vào git và được phát hành cùng 0.4.1.
- Ghi chú công khai: bản nháp, chưa duyệt để công bố (không hiện trong hộp "Có gì mới").

| Mốc | Thời điểm (giờ VN) | Giá trị gốc |
| --- | --- | --- |
| Bắt đầu phát triển | 09/10/2026 | `2026-10-09` |
| Commit đầu tiên | 12/10/2026 08:16 | `2026-10-12T08:16:45+07:00` |
| Commit cuối cùng | Chưa xác minh được | — |
| Gộp vào nhánh (merge) | Chưa xác minh được | — |
| Dựng bộ cài (GitHub Actions) | Chưa xác minh được | — |
| Phát hành (GitHub Release) | Chưa xác minh được | — |
| Tạo tag | Chưa xác minh được | — |

**Tính năng mới**

- Trang mở đầu hai lối vào Phòng thí nghiệm / Thầy AI; chat dạng bong bóng và trang Thầy AI riêng.
- Think: rà soát câu trả lời bằng một nhà cung cấp AI thứ hai.
- Gemma chạy ngay trong app bằng card đồ họa (không cần Ollama).
- Thư viện kiến thức STEM (66 ghi chú) và nhập tệp văn bản trên máy.
- Chụp đề bằng camera; giọng đọc của thầy; tin nhắn hiển thị công thức và khung code.

**Sửa lỗi**

- Cài mới chọn sẵn Gemma làm 'Phân tích đề' và chat bị kẹt dù đã có khóa Gemini.
- Think với Gemini và dự phòng Groq luôn bị từ chối.
- Esc đóng Cài đặt cũng thoát trang Thầy AI và kết thúc hướng dẫn.

**Bảo mật**

- Tra Wikipedia thành tùy chọn, mặc định tắt.
- Gỡ phần mã Ollama cũ; trang ngoài chỉ mở từ một danh sách cố định.

**Vấn đề đã biết**

- Gemma trên máy chưa chạy được ở bản này; 0.4.1 sửa 5 lỗi khiến Gemma không chạy.

**Điểm nổi bật trong app**

- Bản thử Thầy AI dạng tệp ZIP (đã được phát hành chính thức ở 0.4.1).

**Bằng chứng**

- devStart: docs/PROGRESS.md hàng '2026-10-09 \| fork' (làm ngoài git, trên bản sao)
- firstCommit: 0f4d2f8 2026-10-12T08:16:45+07:00 'baseline: stem-sim-lab-ai.zip (2026-10-12)', chỉ trên nhánh local master, package.json 0.3.0 — trạng thái fork trước 0.4.0
- Tệp stem-sim-lab-ai-v0.4.0.zip: chỉ biết tên tệp và ngày sửa 2026-10-12 09:29:39 (+07); chưa mở
- docs/PROGRESS.md hàng '2026-10-12 \| fork-0.4.0'; CLAUDE.md: 'the old gemma.rs was removed in 0.4.0'
- Không có tag hay Release v0.4.0 (git tag, git ls-remote origin, gh api …/releases)

### 0.3.0 (Đã phát hành)

Học dễ hơn với trang chủ 'Hôm nay học gì?', chế độ Cơ bản/Nâng cao, Dự đoán trước và Thử thách; thêm Claude bên cạnh Gemini, dự phòng Groq và các lớp an toàn khi dùng AI.

- Trạng thái: Đã phát hành.
- Kênh phân phối: GitHub Releases: bộ cài Windows và cập nhật trong app.
- Ghi chú công khai: đã duyệt để công bố (hiện trong hộp "Có gì mới").

| Mốc | Thời điểm (giờ VN) | Giá trị gốc |
| --- | --- | --- |
| Bắt đầu phát triển | 05/10/2026 13:20 | `2026-10-05T13:20:52+07:00` |
| Commit đầu tiên | 05/10/2026 13:20 | `2026-10-05T13:20:52+07:00` |
| Commit cuối cùng | 06/10/2026 22:40 | `2026-10-06T22:40:41+07:00` |
| Gộp vào nhánh (merge) | Chưa xác minh được | — |
| Dựng bộ cài (GitHub Actions) | 06/10/2026 22:51 | `2026-10-06T15:51:41Z` |
| Phát hành (GitHub Release) | 06/10/2026 22:51 | `2026-10-06T15:51:58Z` |
| Tạo tag | Chưa xác minh được | — |

**Tính năng mới**

- Trang chủ 'Hôm nay học gì?' và phần làm quen lần đầu; chế độ Cơ bản/Nâng cao.
- Dự đoán trước (Dự đoán → Quan sát → Giải thích) và thử thách cho cả 13 chủ đề Vật lý; gợi ý từng bước; huy hiệu; nhắc nghỉ mắt sau khoảng 45 phút.
- Màn hình 'Kết nối AI' với nút 'Kiểm tra key'; thêm Claude bên cạnh Gemini.
- Dự phòng miễn phí Groq khi Gemini hoặc Claude hết lượt.
- Bộ cài thử nghiệm 'STEM Sim Lab THPT' cho buổi học có người giám sát (chỉ Claude, khóa do người giám sát nhập bằng PIN), có kênh cập nhật riêng.
- Hộp thoại tự hiện khi có bản mới ('Cập nhật ngay' / 'Để sau'); có thể đặt cập nhật bắt buộc, được ký số.

**Cải tiến**

- Tự thử lại khi máy chủ AI bận (tối đa 3 lần), giới hạn lượt AI mỗi ngày, nhớ đề đã xác nhận để không hỏi AI lại.
- Nút cao ít nhất 40 px, chữ bài học 15 px, vừa màn hình 1366×768 không cuộn ngang.

**Sửa lỗi**

- Bấm 'Thử lại' trong hộp thoại lỗi không còn tự hủy.

**Bảo mật**

- Lần đầu mở app hỏi xác nhận đủ 18 tuổi và điều khoản; chưa xác nhận thì không lưu khóa và không gọi AI.
- Nhãn 'Nội dung do AI hỗ trợ' và nút báo cáo; chặn đề có thông tin cá nhân; lọc câu trả lời của AI; nhật ký sự cố chỉ ghi loại và thời gian; trang Quyền riêng tư.

**Thay đổi**

- Bỏ OpenAI; AI dùng Gemini (mặc định) hoặc Claude.
- Phần lõi thay đổi: cần tải bộ cài mới một lần.

**Vấn đề đã biết**

- 'Dạy học bằng AI' mới ở mức thiết kế, chưa dùng được.
- Mô hình dự phòng Groq chưa được thử với khóa thật.

**Điểm nổi bật trong app**

- Trang chủ 'Hôm nay học gì?' với chế độ Cơ bản và Nâng cao.
- Dự đoán trước, thử thách và gợi ý từng bước.
- Kết nối AI có nút 'Kiểm tra key'; thêm Claude và dự phòng Groq.
- Xác nhận 18+ trước khi dùng AI; nhãn AI và nút báo cáo.
- App tự báo khi có bản mới.

**Bằng chứng**

- firstCommit: d587a4c 2026-10-05T13:20:52+07:00 'update: .github/workflows (3b.1: AIProvider, two editions)', commit đầu sau tag v0.2.0
- Nâng phiên bản: 3975db4 (package.json) và 884cc67 (tauri.conf.json, Cargo.toml) ngày 2026-10-06, 0.2.0 → 0.3.0
- lastCommit: 1e7029a 2026-10-06T22:40:41+07:00 = tag v0.3.0
- merged: không có PR (commit thẳng lên main)
- built: lượt Release 37489652593 (main, 1e7029a), job 'Build Windows installers' xong 2026-10-06T15:51:41Z; trước đó lượt 37480981103 chỉ dựng (không publish), lượt 37483213542 bị hủy
- released: GitHub Release v0.3.0 'STEM Sim Lab 0.3.0', published\_at 2026-10-06T15:51:58Z, target 1e7029a (gh api …/releases)
- tagged: tag nhẹ (lightweight), git không lưu ngày tạo tag

### 0.2.0 (Đã phát hành)

Cập nhật ngay trong ứng dụng, không cần cài lại; AI đọc đề chuyển sang Gemini (có gói miễn phí) kèm hướng dẫn lấy khóa API.

- Trạng thái: Đã phát hành.
- Kênh phân phối: GitHub Releases: bộ cài Windows và cập nhật trong app.
- Ghi chú trạng thái: PROGRESS.md ghi 'Phiên bản 0.2.0' ngày 29/09/2026 (lúc nâng số), nhưng Release v0.2.0 phát hành ngày 05/10/2026 và gồm cả việc chuyển sang Gemini.
- Ghi chú công khai: đã duyệt để công bố (hiện trong hộp "Có gì mới").

| Mốc | Thời điểm (giờ VN) | Giá trị gốc |
| --- | --- | --- |
| Bắt đầu phát triển | 29/09/2026 22:09 | `2026-09-29T22:09:05+07:00` |
| Commit đầu tiên | 29/09/2026 22:09 | `2026-09-29T22:09:05+07:00` |
| Commit cuối cùng | 05/10/2026 07:54 | `2026-10-05T07:54:58+07:00` |
| Gộp vào nhánh (merge) | Chưa xác minh được | — |
| Dựng bộ cài (GitHub Actions) | 05/10/2026 10:07 | `2026-10-05T03:07:05Z` |
| Phát hành (GitHub Release) | 05/10/2026 10:07 | `2026-10-05T03:07:21Z` |
| Tạo tag | Chưa xác minh được | — |

**Tính năng mới**

- Cập nhật ngay trong app (menu ☰ → Kiểm tra cập nhật): tải phần giao diện mới, không cần cài lại tệp .exe.
- Hướng dẫn lấy khóa API Gemini ngay trong Cài đặt (người tạo khóa phải từ 18 tuổi).

**Cải tiến**

- Lỗi hết lượt, khóa sai hay tên mô hình sai được giải thích bằng lời dễ hiểu.

**Bảo mật**

- Bản cập nhật trong app được ký số và kiểm tra chữ ký trước khi dùng.

**Thay đổi**

- AI mặc định là Gemini (có gói miễn phí); bỏ LM Studio.

**Điểm nổi bật trong app**

- Cập nhật ngay trong app, không cần cài lại.
- AI đọc đề dùng Gemini, có gói miễn phí và hướng dẫn lấy khóa.
- Bản cập nhật được ký số trước khi dùng.

**Bằng chứng**

- firstCommit: c515250 2026-09-29T22:09:05+07:00 'update: .github/workflows (in-app updates, v0.2.0)'; nâng phiên bản ở fdb7e6e (package.json) và 47dc1ea (tauri.conf.json, Cargo.toml) cùng tối 29/09
- lastCommit: 7d32305 2026-10-05T07:54:58+07:00 'update: src-tauri/src/ai.rs (Gemini replaces LM Studio)' = tag v0.2.0
- merged: không có PR (commit thẳng lên main; PR đầu tiên của repo là #1 ngày 11/10)
- built: lượt Release 37257271728 (main, 7d32305), job 'Build Windows installers' xong 2026-10-05T03:07:05Z
- released: GitHub Release v0.2.0 'STEM Sim Lab 0.2.0', published\_at 2026-10-05T03:07:21Z, target 7d32305 (gh api …/releases)
- tagged: tag nhẹ (lightweight), git không lưu ngày tạo tag

### 0.1.0 (Bản phát triển, không phát hành)

Bản đầu tiên của STEM Sim Lab (tên cũ của SimLab): mô phỏng Vật lý, Hóa học và Sinh học chạy ngay trên máy. Bản này chỉ được dựng thử, chưa phát hành.

- Trạng thái: Bản phát triển, không phát hành.
- Kênh phân phối: Không phân phối.
- Ghi chú trạng thái: Phiên bản khởi tạo. GitHub Actions dựng bộ cài 2 lần ngày 29/09/2026 nhưng chỉ thành artifact: không có tag v0.1.0 và không có GitHub Release.
- Ghi chú công khai: bản nháp, chưa duyệt để công bố (không hiện trong hộp "Có gì mới").

| Mốc | Thời điểm (giờ VN) | Giá trị gốc |
| --- | --- | --- |
| Bắt đầu phát triển | 28/09/2026 18:13 | `2026-09-28T11:13:10Z` |
| Commit đầu tiên | 28/09/2026 18:13 | `2026-09-28T11:13:10Z` |
| Commit cuối cùng | 29/09/2026 20:09 | `2026-09-29T20:09:12+07:00` |
| Gộp vào nhánh (merge) | Chưa xác minh được | — |
| Dựng bộ cài (GitHub Actions) | 29/09/2026 19:26 | `2026-09-29T12:26:56Z` |
| Phát hành (GitHub Release) | Chưa xác minh được | — |
| Tạo tag | Chưa xác minh được | — |

**Tính năng mới**

- 13 chủ đề Vật lý 2D có đồ thị, lời giải từng bước, bảng số liệu và xuất CSV.
- Thẻ Khoa học cho mỗi mô phỏng: mô hình, công thức, giả định, mức tin cậy và nguồn.
- AI đọc đề bài và dựng mô phỏng; mọi con số do chương trình tính, bạn xác nhận bảng 'Tôi hiểu đề như sau' trước.
- Hóa học: bảng tuần hoàn 118 nguyên tố, 63 phân tử 3D, hình dạng phân tử VSEPR, 39 phản ứng (10 có cơ chế), cân bằng phương trình.
- Sinh học: 11 chủ đề (nguyên phân, giảm phân, ADN → protein, di truyền Mendel, Hardy–Weinberg, sinh thái, enzyme, khuếch tán và thẩm thấu).
- Lưu và mở tệp .stemsim, xuất ảnh PNG, hoàn tác/làm lại, lịch sử, chế độ trình chiếu và hướng dẫn lần đầu.
- Giao diện sáng/tối, tiếng Việt và tiếng Anh.

**Sửa lỗi**

- Mô phỏng không còn bỏ sót lúc vật chạm đất khi được ném từ mặt đất, hoặc khi điểm cao nhất và lúc chạm đất rơi vào cùng một bước tính.
- Công thức hiển thị đúng vị trí trong bản cài đặt.
- Không còn báo 'chuyển động chậm' sai trên màn hình có tần số quét cao.

**Vấn đề đã biết**

- Bản này không có bộ cài phát hành công khai; chỉ có bản dựng thử trên GitHub Actions.

**Điểm nổi bật trong app**

- Mô phỏng Vật lý, Hóa học và Sinh học chạy ngay trên máy.
- Mỗi mô phỏng có Thẻ Khoa học ghi rõ mô hình và mức tin cậy.

**Bằng chứng**

- firstCommit: b9a2430 2026-09-28T11:13:10Z 'chore: scaffold Vite + React 19 + TypeScript (strict) project' thêm "version": "0.1.0"; c8830ab (cùng thời điểm) thêm tauri.conf.json 'STEM Sim Lab' 0.1.0
- lastCommit: f857ec7 2026-09-29T20:09:12+07:00 'docs: where to find the installer artifact'; commit sau đó (c515250) bắt đầu 0.2.0
- built: lượt Release 36565163753 (workflow\_dispatch, 02ae6d2), job 'Build Windows installers' xong 2026-09-29T12:26:56Z; lượt thứ hai 36573143091 (f857ec7) xong 13:20:25Z; cả hai chỉ tạo artifact stem-sim-lab-windows
- Không có tag v0.1.0 và không có GitHub Release (gh api …/releases, git tag, git ls-remote origin)
- Nội dung: docs/PROGRESS.md các hàng 2026-09-28 (Phase 0–2) và 2026-09-29 (Phase 3–7)

## IV. Cải tiến về AI Teacher, bảng dạy, giọng nói, Gemma local + API

Gom từ các ghi chú có area teacher, voice, gemma và api, cũ nhất ở trên; trong ngoặc là trạng thái của phiên bản và loại thay đổi.

### AI Teacher và bảng dạy

- **0.3.0** (Đã phát hành, vấn đề đã biết): 'Dạy học bằng AI' mới ở mức thiết kế, chưa dùng được.
- **0.4.0** (Chưa xác minh, tính năng mới): Trang mở đầu hai lối vào Phòng thí nghiệm / Thầy AI; chat dạng bong bóng và trang Thầy AI riêng.
- **0.4.0** (Chưa xác minh, tính năng mới): Thư viện kiến thức STEM (66 ghi chú) và nhập tệp văn bản trên máy.
- **0.4.0** (Chưa xác minh, tính năng mới): Chụp đề bằng camera; giọng đọc của thầy; tin nhắn hiển thị công thức và khung code.
- **0.4.0** (Chưa xác minh, bảo mật): Tra Wikipedia thành tùy chọn, mặc định tắt.
- **0.4.1** (Đã phát hành, tính năng mới): Trang mở đầu với hai lối vào Phòng thí nghiệm và Thầy AI; khung chat nổi trong phòng thí nghiệm và trang Thầy AI riêng.
- **0.4.1** (Đã phát hành, tính năng mới): Thư viện kiến thức STEM (66 ghi chú) và thêm được tài liệu văn bản của riêng em.
- **0.4.1** (Đã phát hành, tính năng mới): Chụp đề bằng camera; thầy đọc câu trả lời bằng giọng của máy; tin nhắn hiển thị công thức và khung code.
- **0.4.1** (Đã phát hành, bảo mật): Tra Wikipedia thành tùy chọn, mặc định tắt (bản fork trước đó gửi câu hỏi tới Wikipedia mỗi lần mà không báo).
- **0.4.3** (Chưa xác minh, tính năng mới): Trí nhớ hội thoại theo độ dài, có tóm tắt phần cũ, và nút 'Viết tiếp' khi câu trả lời chạm giới hạn.
- **0.4.3** (Chưa xác minh, tính năng mới): Bảng giảng các bước hiện dần (sau đó được thay bằng bảng trắng ở 0.5.0).
- **0.4.3** (Chưa xác minh, cải tiến): AI được viết câu trả lời dài hơn.
- **0.4.3** (Chưa xác minh, sửa lỗi): Nút nhanh chỉ gửi đúng hai chữ 'Chậm hơn' nên Gemma hiểu sai; nay gửi câu hướng dẫn đầy đủ.
- **0.5.0** (Đã phát hành, tính năng mới): AI Teacher giảng trên bảng trắng: chữ viết tay tiếng Việt, công thức, khoanh/gạch chân/đóng khung, đồ thị và sơ đồ lực do chương trình vẽ, bút cho học sinh.
- **0.5.0** (Đã phát hành, tính năng mới): Trí nhớ hội thoại dài hơn, có tóm tắt phần cũ; Cài đặt 'Trí nhớ hội thoại: Vừa/Dài'.
- **0.5.0** (Đã phát hành, tính năng mới): Nút 'Viết tiếp' khi câu trả lời dài bị dừng giữa chừng; thầy viết tiếp ngay trên cùng bảng.
- **0.5.0** (Đã phát hành, cải tiến): AI Teacher được viết câu trả lời dài hơn trước.
- **0.5.0** (Đã phát hành, sửa lỗi): Nút nhanh chỉ gửi đúng hai chữ 'Chậm hơn' nên AI hiểu sai; nay gửi câu hướng dẫn đầy đủ.
- **0.5.0** (Đã phát hành, sửa lỗi): Ghi chú kiến thức có sẵn được đánh dấu là đang chờ giáo viên duyệt.
- **0.5.1** (Đã gộp, chưa phát hành, sửa lỗi): Nút AI Teacher không còn che cột cuối của bảng; nay nằm ở góc vùng mô phỏng.
- **0.5.1** (Đã gộp, chưa phát hành, sửa lỗi): Khung chat không còn mở cao hết màn hình.
- **0.5.2** (Đã phát hành, tính năng mới): Bản đồ nhỏ của bảng trắng.
- **0.5.2** (Đã phát hành, sửa lỗi): Nút AI Teacher không còn che cột cuối của bảng; nay nằm ở góc vùng mô phỏng (sửa từ 0.5.1).
- **0.5.2** (Đã phát hành, sửa lỗi): Khung chat không còn mở cao hết màn hình (sửa từ 0.5.1).
- **0.6.0** (Đã phát hành, tính năng mới): Thẻ 'Kết quả do SimLab tính' khi câu hỏi có phương trình hóa học: bộ cân bằng của SimLab giải phương trình, AI chỉ giải thích.
- **0.6.0** (Đã phát hành, tính năng mới): Nút 'Gợi ý từng bước', và nút 'Xem mô phỏng' dưới câu trả lời khi câu hỏi nêu đúng tên một chủ đề có mô phỏng.
- **0.6.0** (Đã phát hành, tính năng mới): Nút 'Dừng' để dừng câu trả lời đang viết, với Gemma lẫn AI trực tuyến.
- **0.6.0** (Đã phát hành, tính năng mới): SimLab nhắc khi đề bài có thể còn thiếu số liệu, và liệt kê các con số AI tự đưa ra mà chưa ai cho (chưa kiểm chứng).
- **0.6.0** (Đã phát hành, tính năng mới): “Khoanh để hỏi” trên bảng: khoanh, gạch chân hoặc chạm vào chỗ muốn hỏi rồi bấm “Hỏi thầy chỗ này”. App đọc đúng chữ, công thức và nhãn hình đang có trên bảng; câu trả lời hiện trong khung chat và bài giảng chờ đến khi bấm “Quay lại bài giảng”. Chỗ không có chữ chỉ được gửi dạng ảnh cho AI đọc ảnh chạy trên máy, không lên mạng.
- **0.6.0** (Đã phát hành, tính năng mới): Cài đặt → “AI trên máy khác”: tìm, kiểm tra và chọn chương trình AI em tự cài trên máy (Ollama, LM Studio, llama.cpp hoặc máy chủ kiểu OpenAI) cho AI Teacher, “Phân tích đề” và “AI diễn giải”. Chỉ dùng địa chỉ trên chính máy; khi chương trình lỗi, app nói rõ và không tự gửi câu hỏi lên mạng; mô hình cloud của Ollama bị từ chối.
- **0.6.0** (Đã phát hành, tính năng mới): Phóng to, thu nhỏ bảng (1–2×) và nút “Vừa khung”; chữ đã viết không đổi chỗ.
- **0.6.0** (Đã phát hành, cải tiến): Với AI trực tuyến, AI Teacher được hướng dẫn giảng theo trình tự: mục tiêu, giải thích đơn giản, ví dụ, các bước có lý do, một lỗi hay gặp. Gemma được dặn trả lời thẳng câu hỏi trước rồi giải thích ngắn, có lý do. Câu trả lời về khái niệm được dặn kết thúc bằng một câu hỏi kiểm tra (trừ Gemma trên card đồ họa tích hợp, để câu trả lời ngắn); Gemma 1B thường chưa làm theo (khoảng 1/5 câu trả lời khi đo).
- **0.6.0** (Đã phát hành, cải tiến): Tìm ghi chú kiến thức hợp với câu hỏi tốt hơn; ghi chú lạc đề không được gửi cho AI.
- **0.6.0** (Đã phát hành, cải tiến): Bảng chỉ trình bày nội dung bài học: phần suy nghĩ nội bộ của AI, câu lặp lại lời nhắc, dòng nguồn và ký hiệu định dạng thừa không được viết lên bảng hay đọc to; lời chào chỉ được nói, không viết.
- **0.6.0** (Đã phát hành, cải tiến): Thầy dùng cả bảng: mỗi bảng được chia theo nội dung (một, hai hoặc ba cột), phần không vừa xuống một dải ngang cả bảng, công thức dài viết thành nhiều dòng; không có chữ đè lên nhau khi đổi cỡ cửa sổ hay phóng to.
- **0.6.0** (Đã phát hành, sửa lỗi): Bút của thầy có thể vẫn viết trên bảng cũ khi chuyển sang bảng khác: nay mỗi lượt giảng chỉ viết trên bảng của nó, và quay lại bảng cũ thì phần đã viết vẫn còn.
- **0.6.0** (Đã phát hành, sửa lỗi): “Viết tiếp” không còn ẩn hay đảo các dòng đã viết và không để lại phần dở dang.
- **0.6.0** (Đã phát hành, sửa lỗi): Giữ phím Enter không còn gửi câu hỏi đang gõ trong ô chat.
- **0.6.0** (Đã phát hành, bảo mật): Tài liệu và ghi chú đưa cho AI được đánh dấu là dữ liệu tham khảo, không phải lệnh.
- **0.6.0** (Đã phát hành, vấn đề đã biết): “Khoanh để hỏi”, AI trên máy khác, câu trả lời hiện dần và nút “Hỏi thầy” của Science Studio mới chỉ được thử với dịch vụ giả lập: chưa thử với khóa API thật hay Ollama, LM Studio, llama.cpp thật; ảnh vùng khoanh chưa được thử trên ứng dụng desktop.
- **0.6.0** (Đã phát hành, vấn đề đã biết): SimLab không chọn được card đồ họa cho chương trình AI trên máy khác; chọn trong chính chương trình đó.
- **0.7.0** (Đã phát hành, sửa lỗi): AI Teacher, bảng dạy và giọng đọc: xóa trò chuyện thì dừng câu trả lời; tra thư viện và Wikipedia dùng đúng lời em hỏi; bảng giữ đúng phép chia, lũy thừa và số thập phân; giọng đọc đọc đúng 2gh, khoảng giá trị, 0,125, đơn vị m³/s² và 5′→3′; công thức tải lỗi không làm bảng treo.
- **0.8.0** (Đang xét duyệt, sửa lỗi): Bảng của AI Teacher: không còn viết dòng nguồn "Theo ghi chú từ…", chữ phụ đề không còn kí hiệu thô, và không cắt câu giữa chừng.

### Giọng nói

- **0.5.0** (Đã phát hành, tính năng mới): Giọng đọc tiếng Việt với 3 nguồn: giọng Windows, Gemini TTS (trực tuyến) và giọng MMS chạy ngay trên máy.
- **0.6.0** (Đã phát hành, tính năng mới): Cảnh báo khi bật giọng đọc mà máy không có giọng tiếng Việt.
- **0.6.0** (Đã phát hành, cải tiến): Thầy đọc đúng chữ đang viết trên bảng; tạm dừng giữa câu thì đọc lại câu đó; đọc ký hiệu đúng hơn (2n, \[S\], (aq), mũi tên phản ứng).
- **0.6.0** (Đã phát hành, cải tiến): Khi giọng đọc gặp lỗi, giọng dự phòng đọc tiếp từ đoạn chưa nghe, không đọc lặp.
- **0.6.0** (Đã phát hành, cải tiến): Giọng đọc trên máy: âm lượng giữa các đoạn như nhau, tiếng đầu tiên đến sớm hơn, ngắt nghỉ theo câu và mệnh đề, không cắt giữa số và đơn vị; trước ý chính có một quãng nghỉ ngắn.
- **0.6.0** (Đã phát hành, cải tiến): Đọc đúng hơn nhiều ký hiệu khoa học: MeV, MPa, đơn vị mét vuông/mét khối, cấu hình electron, mũi tên phản ứng, "tan" trong hòa tan.
- **0.6.0** (Đã phát hành, sửa lỗi): Khi bật giọng đọc, bài giảng trên bảng có thể dừng sau câu đầu tiên.
- **0.6.0** (Đã phát hành, sửa lỗi): Giọng đọc chạy trên máy không bao giờ nạp lại vào card đồ họa vừa gặp lỗi; khi card lỗi, giọng chuyển sang CPU.
- **0.6.0** (Đã phát hành, vấn đề đã biết): Trên máy không có card đồ họa rời, giọng đọc trên máy chạy bằng CPU và chậm hơn lời nói nên có quãng chờ giữa các đoạn; ở bản này quãng chờ còn dài hơn trước (trung vị 7,3 s → 8,4 s mỗi câu, đo trên 19 câu).
- **0.6.0** (Đã phát hành, vấn đề đã biết): Giọng MMS không có ngữ điệu, cảm xúc thật; chưa có người nghe chấm độ tự nhiên.

### Gemma chạy trên máy (local)

- **0.4.0** (Chưa xác minh, tính năng mới): Gemma chạy ngay trong app bằng card đồ họa (không cần Ollama).
- **0.4.0** (Chưa xác minh, sửa lỗi): Cài mới chọn sẵn Gemma làm 'Phân tích đề' và chat bị kẹt dù đã có khóa Gemini.
- **0.4.0** (Chưa xác minh, vấn đề đã biết): Gemma trên máy chưa chạy được ở bản này; 0.4.1 sửa 5 lỗi khiến Gemma không chạy.
- **0.4.1** (Đã phát hành, tính năng mới): Gemma chạy ngay trên máy bằng card đồ họa: tải về một lần (bản 270M khoảng 345 MB), trả lời không gửi gì ra mạng.
- **0.4.1** (Đã phát hành, cải tiến): Kiểm tra chỗ trống trước khi tải mô hình, nút 'Hủy tải', báo lỗi tải dễ hiểu và bước 'đang nạp vào GPU'.
- **0.4.1** (Đã phát hành, sửa lỗi): Sửa 5 lỗi khiến Gemma không chạy được ở bản ZIP 0.4.0, gồm nút 'Đang tải…' quay mãi và việc mỗi lần mở app phải tải lại mô hình.
- **0.4.1** (Đã phát hành, sửa lỗi): Cài mới không còn bị kẹt chờ Gemma khi đã có khóa AI trực tuyến.
- **0.4.1** (Đã phát hành, vấn đề đã biết): Gemma 270M hay trả lời lạc đề.
- **0.4.1** (Đã phát hành, vấn đề đã biết): Chưa kiểm chứng lúc phát hành: Gemma 1B/E2B, chất lượng trả lời sau khi rút gọn lời nhắc, bộ cài Windows.
- **0.4.2** (Chưa xác minh, tính năng mới): Chọn card đồ họa chạy Gemma trên Windows: danh sách card và bộ nhớ, gợi ý card rời, nút 'Mở lại ngay'.
- **0.4.2** (Chưa xác minh, sửa lỗi): Gemma luôn chạy trên card tích hợp dù máy có card rời.
- **0.4.2** (Chưa xác minh, vấn đề đã biết): Chưa kiểm chứng: tốc độ Gemma thật trên từng card, bộ cài Windows.
- **0.5.0** (Đã phát hành, tính năng mới): Chọn card đồ họa chạy Gemma trên Windows: gợi ý card rời, nút 'Mở lại ngay'.
- **0.5.0** (Đã phát hành, sửa lỗi): Gemma luôn chạy trên card tích hợp dù máy có card rời.
- **0.5.2** (Đã phát hành, tính năng mới): Câu trả lời của Gemma hiện dần từng chữ.
- **0.5.2** (Đã phát hành, bảo mật): Mỗi đoạn trả lời hiện dần của Gemma đều qua bộ lọc an toàn; có đoạn không an toàn thì cả câu trả lời bị thu lại.
- **0.6.0** (Đã phát hành, cải tiến): Gemma trả lời đúng ý hơn và bắt đầu nhanh hơn; câu trả lời lẫn chữ nước ngoài ít hơn hẳn (50 % → 7 %) và viết méo thuật ngữ cũng ít hơn (19 % → 4,8 %), nhưng vẫn còn (đo với Gemma 1B trên 42 câu hỏi; câu trả lời dài hơn trước).
- **0.6.0** (Đã phát hành, sửa lỗi): Gemma có thể làm treo card đồ họa tích hợp và khiến máy khởi động lại: nay sau một lỗi card, Gemma dừng tới khi mở lại app; card tích hợp dùng lời nhắc ngắn hơn; câu trả lời bị treo được tự dừng.
- **0.6.0** (Đã phát hành, bảo mật): Mô hình Gemma và giọng đọc trên máy luôn tải đúng một phiên bản đã ghim.
- **0.6.0** (Đã phát hành, hiệu năng): Không tra Wikipedia khi Gemma đã có ghi chú phù hợp trong thư viện.
- **0.6.0** (Đã phát hành, vấn đề đã biết): Gemma 1B vẫn hay sai kiến thức và có lúc khen câu trả lời sai của học sinh; hãy kiểm tra lại bằng mô phỏng hoặc sách.
- **0.6.0** (Đã phát hành, vấn đề đã biết): Các lớp bảo vệ mới cho Gemma trên card đồ họa tích hợp chưa được thử lại trên một card tích hợp thật.
- **0.7.0** (Đã phát hành, sửa lỗi): Card đồ họa có mã nhận dạng dài (ví dụ máy Windows chạy chip ARM) nay chọn được trong Cài đặt.

### AI qua API (Gemini, Claude, Groq)

- **0.1.0** (Bản phát triển, không phát hành, tính năng mới): AI đọc đề bài và dựng mô phỏng; mọi con số do chương trình tính, bạn xác nhận bảng 'Tôi hiểu đề như sau' trước.
- **0.2.0** (Đã phát hành, tính năng mới): Hướng dẫn lấy khóa API Gemini ngay trong Cài đặt (người tạo khóa phải từ 18 tuổi).
- **0.2.0** (Đã phát hành, cải tiến): Lỗi hết lượt, khóa sai hay tên mô hình sai được giải thích bằng lời dễ hiểu.
- **0.2.0** (Đã phát hành, thay đổi): AI mặc định là Gemini (có gói miễn phí); bỏ LM Studio.
- **0.3.0** (Đã phát hành, tính năng mới): Màn hình 'Kết nối AI' với nút 'Kiểm tra key'; thêm Claude bên cạnh Gemini.
- **0.3.0** (Đã phát hành, tính năng mới): Dự phòng miễn phí Groq khi Gemini hoặc Claude hết lượt.
- **0.3.0** (Đã phát hành, cải tiến): Tự thử lại khi máy chủ AI bận (tối đa 3 lần), giới hạn lượt AI mỗi ngày, nhớ đề đã xác nhận để không hỏi AI lại.
- **0.3.0** (Đã phát hành, sửa lỗi): Bấm 'Thử lại' trong hộp thoại lỗi không còn tự hủy.
- **0.3.0** (Đã phát hành, thay đổi): Bỏ OpenAI; AI dùng Gemini (mặc định) hoặc Claude.
- **0.3.0** (Đã phát hành, vấn đề đã biết): Mô hình dự phòng Groq chưa được thử với khóa thật.
- **0.4.0** (Chưa xác minh, tính năng mới): Think: rà soát câu trả lời bằng một nhà cung cấp AI thứ hai.
- **0.4.0** (Chưa xác minh, sửa lỗi): Think với Gemini và dự phòng Groq luôn bị từ chối.
- **0.4.1** (Đã phát hành, tính năng mới): Think: một nhà cung cấp AI thứ hai rà soát và viết lại câu trả lời.
- **0.4.1** (Đã phát hành, sửa lỗi): Think không còn bị từ chối khi dùng Gemini kèm dự phòng Groq.
- **0.6.0** (Đã phát hành, tính năng mới): Trên ứng dụng desktop, câu trả lời của AI trực tuyến (Gemini, Claude, Groq) hiện dần trong khi đang viết.
- **0.6.0** (Đã phát hành, cải tiến): Lỗi AI được nói bằng lời dễ hiểu (hết lượt, sai khóa, mất mạng, chương trình trên máy chưa mở…), dòng “gửi tới” nêu đúng nơi câu hỏi sẽ được gửi, và nhà cung cấp dự phòng chỉ trả lời khi nhà cung cấp chính hết lượt hoặc hết tiền.
- **0.6.0** (Đã phát hành, bảo mật): Giới hạn lượt AI mỗi ngày chắc chắn hơn (mặc định 100 lượt).
- **0.6.0** (Đã phát hành, vấn đề đã biết): Chưa đánh giá cách giảng với Gemini, Claude hoặc Groq thật (chưa có khóa để thử).
- **0.8.0** (Đang xét duyệt, cải tiến): Bảng "Tôi hiểu đề như sau" báo khi đề cho một đại lượng mà cách bố trí đang chọn không dùng tới.

## V. Cải tiến mô phỏng 3D Sinh học

Mô phỏng 3D Sinh học xuất hiện lần đầu ở phiên bản 0.6.0 (Đã phát hành); các phiên bản trước không có ghi chú nào về mô phỏng 3D Sinh học.

- **0.6.0** (Đã phát hành, tính năng mới): Mô phỏng Nguyên phân 3D cho tế bào động vật và thực vật: 7 bước, phát/tạm dừng/từng bước, xoay, chọn một bộ phận để đọc chức năng, có Thẻ Khoa học riêng.
- **0.6.0** (Đã phát hành, tính năng mới): Nguyên phân 3D: nút “Hỏi thầy về bộ phận này” mở AI Teacher với câu hỏi viết sẵn về bộ phận đang chọn.
- **0.6.0** (Đã phát hành, vấn đề đã biết): Mô tả các kì của Nguyên phân 3D đang chờ giáo viên duyệt.
- **0.7.0** (Đã phát hành, tính năng mới): Giảm phân 3D: 12 bước từ G1 tới phân chia tế bào chất II ở tế bào động vật, có trao đổi chéo và điểm bắt chéo. Số NST, crômatit, ADN do mô hình đếm; hình 3D và hình 2D dùng cùng một lần sắp xếp ngẫu nhiên.
- **0.7.0** (Đã phát hành, tính năng mới): ADN → mARN → Protein 3D: chuỗi xoắn kép mở ra, mARN được tổng hợp rồi ribôxôm dịch từng bộ ba. Chữ cái, bộ ba và axit amin lấy từ trình tự em nhập và bảng mã di truyền.
- **0.7.0** (Đã phát hành, tính năng mới): Đột biến điểm 3D: ADN bình thường và ADN đột biến đặt cạnh nhau, kèm mARN và chuỗi axit amin trước và sau đột biến; chỗ nuclêôtit thay đổi và các axit amin khác nhau được tô nổi.
- **0.7.0** (Đã phát hành, tính năng mới): Di truyền Mendel 3D: bố mẹ, giao tử, bảng Punnett và cột con lai cao theo xác suất; phần con lai ngẫu nhiên dùng cùng lần tạo ngẫu nhiên với bảng 2D.
- **0.7.0** (Đã phát hành, tính năng mới): Động học enzyme 3D: tỉ lệ enzyme đang gắn cơ chất theo v/Vmax của công thức trong bài (làm tròn); có các dạng enzyme gắn chất ức chế và thang “1 hạt = … mM”.
- **0.7.0** (Đã phát hành, tính năng mới): Khuếch tán & thẩm thấu 3D: số hạt mỗi ngăn theo định luật Fick ở mọi thời điểm, hạt đi qua lỗ màng; ống chữ U có thước cm và mực nước lấy từ đồ thị của bài.
- **0.7.0** (Đã phát hành, tính năng mới): Hardy–Weinberg, Phiêu bạt di truyền, Tăng trưởng logistic và Con mồi – vật ăn thịt có hình 3D đơn giản: mỗi hình là một cá thể hoặc một nhóm cá thể (có ghi chú), số lượng lấy từ mô hình.
- **0.7.0** (Đã phát hành, cải tiến): Nguyên phân 3D: mỗi crômatit co xoắn dần ngay tại chỗ, ánh sáng mới, tên bộ phận hiện trên hình, máy ảnh chuyển cảnh mượt; ở chất lượng Cao có màng nhân kép vỡ thành túi nhỏ, trung tử 9 bộ ba vi ống và túi tạo tấm tế bào.
- **0.7.0** (Đã phát hành, cải tiến): Mỗi bài Sinh học có nút 3D / 2D và nhớ lựa chọn; khi chất lượng hiển thị là Thấp, máy không có WebGL hoặc card đồ họa gặp lỗi, bài tự dùng hình 2D và nói lý do.
- **0.7.0** (Đã phát hành, thay đổi): Các bài Sinh học mở bằng hình 3D; bấm 2D để quay lại hình cũ.
- **0.7.0** (Đã phát hành, vấn đề đã biết): Bốn bài về quần thể (Hardy–Weinberg, Phiêu bạt di truyền, Tăng trưởng logistic, Con mồi – vật ăn thịt) mới có hình 3D đơn giản; hình 3D riêng, chi tiết như các bài khác sẽ có trong một bản cập nhật sau.
- **0.7.0** (Đã phát hành, vấn đề đã biết): Lời văn và cách vẽ của các hình 3D mới đang chờ giáo viên duyệt. Hình dạng, kích thước, vị trí và chuyển động trong hình 3D chỉ là minh họa; chỉ số lượng và tỉ lệ lấy từ mô hình.
- **0.7.0** (Đã phát hành, vấn đề đã biết): Giảm phân 3D chỉ vẽ tế bào động vật và bốn tế bào con bằng nhau (phân chia không đều ở con cái chỉ được ghi chú); chưa có giảm phân ở thực vật.
- **0.7.1** (Đã phát hành, tính năng mới): Bốn bài quần thể có khung cảnh 3D ngoài trời riêng: Hardy–Weinberg (con vật mang màu kiểu gen, hũ vốn gen, đi qua từng thế hệ), Phiêu bạt di truyền (mỗi lần chạy là một hòn đảo, có cờ khi chỉ còn một alen), Tăng trưởng logistic (đàn trong hàng rào, cột đo có vạch K, thanh thời gian vẽ đường N(t)), Con mồi – vật ăn thịt (hai loài trên đồng cỏ, hai ống đo và bảng quỹ đạo pha). Bấm vào con vật hay cột đo để xem thẻ giải thích; ba bài sau còn đưa hình tới gần chỗ đã bấm.
- **0.7.1** (Đã phát hành, cải tiến): Mọi bài Sinh học 3D có sân khấu mới: nền dải màu, ánh sáng kiểu phòng chụp, vật liệu riêng cho màng, nhiễm sắc thể, ADN, protein, thủy tinh và chất lỏng. Ở chất lượng Cao trên máy có card đồ họa rời còn có bóng đổ thật, bóng ở chỗ khuất và ánh sáng nổi.
- **0.7.1** (Đã phát hành, cải tiến): Nguyên phân và Giảm phân 3D: nhiễm sắc thể to và có khối hơn, thoi phân bào trong mờ, màng tế bào và màng nhân có viền rõ trên nền sáng; nhãn không bao giờ đè lên nhiễm sắc thể.
- **0.7.1** (Đã phát hành, cải tiến): ADN → mARN → Protein và Đột biến điểm 3D: chuỗi xoắn có mạch khung liền và cặp bazơ bo tròn, ARN pôlimeraza và ribôxôm trong suốt, tARN hình chữ L; khi Theo dõi dịch mã, máy quay tới gần ribôxôm.
- **0.7.1** (Đã phát hành, cải tiến): Di truyền Mendel 3D thành bàn thí nghiệm: khay Punnett có ô, ống đong cho tỉ lệ kiểu hình, đủ 16 kiểu gen ở góc nhìn Bảng Punnett, mỗi số đếm của lần tạo ngẫu nhiên có ghi tên nhóm. Động học enzyme 3D đặt trong bể kính.
- **0.7.1** (Đã phát hành, cải tiến): Khuếch tán & thẩm thấu 3D: bể kính hai ngăn có màng và lỗ thật, ống chữ U có mặt khum, thước có vạch khắc; bể và màng dễ thấy trên nền sáng.
- **0.7.1** (Đã phát hành, sửa lỗi): Thẩm thấu 3D: đáy mặt khum nay đúng bằng mực chất lỏng của mô hình, nên đọc ở đáy mặt khum ra đúng số.
- **0.7.1** (Đã phát hành, sửa lỗi): Động học enzyme 3D: hạt sản phẩm mới chỉ đi ra từ phức hợp enzyme–cơ chất (ES), không bao giờ từ phức hợp có chất ức chế (ESI).
- **0.7.1** (Đã phát hành, sửa lỗi): Đột biến điểm 3D: dấu “chuỗi kết thúc sớm” chỉ hiện khi bộ ba kết thúc thật sự đến sớm, không hiện khi chỉ mất trọn một bộ ba.
- **0.7.1** (Đã phát hành, sửa lỗi): Dịch mã 3D: màu bazơ của mARN và tARN không còn nhạt đi.
- **0.7.1** (Đã phát hành, sửa lỗi): Ở chất lượng Cao trên máy có card đồ họa rời, nền, màng tế bào và bóng dưới tế bào có đúng màu như ở các mức khác.

**Kiểm thử liên quan**

- **0.6.0**: App desktop bản release dựng trên máy người phát triển: chặn điều hướng ra trang ngoài, công thức KaTeX đúng vị trí, mô phỏng 3D mở được (AUDIT)
- **0.7.0**: 20/10/2026 trên b59cc1a: format, lint, typecheck sạch (prettier chỉ báo hai tệp ngoài kho, không được theo dõi: AGENTS.md, bench.json); 3933/3933 unit test (272 tệp); E2E 102/102 (chromium 72, chromium-3d 29, chromium-3d-perf 1); Rust fmt + clippy -D warnings + 221 test
- **0.7.0**: Lần chạy E2E đầu tiên có lỗi ngẫu nhiên do thư mục kết quả Playwright nằm trong vùng Vite theo dõi (tệp .html của trace làm trang tải lại giữa chừng) và do chờ quá ngắn khi mở mô-đun lần đầu; đã sửa ở b59cc1a (không bỏ bài kiểm tra nào, không đổi điều được kiểm; lần mở mô-đun đầu tiên được chờ tới 20 s như các bài khác, dự án 3D chạy tối đa 4 luồng)
- **0.7.1**: E2E đầy đủ (npm run test:e2e): 100 qua, 2 hỏng, 1 không chạy (dự án chromium-3d-perf, phụ thuộc chromium-3d). Hỏng: mitosis3d.spec.ts 'plays through every stage' (hình 3D tự về 2D khi chạy phần mềm) và 'boxes never overlap' (chỉ khi chạy song song; chạy riêng thì qua). Bài đầu hỏng y hệt trên main 433c3a9 trong cùng sandbox, nên không do thay đổi này; chưa chạy trên máy Windows
- **0.7.1**: E2E trên cổng 1421 (một worktree khác có thể dùng 1420; trạng thái lưu của E2E được viết lại cho cổng 1421): dự án chromium 70/73; 3 bài hỏng vì tự ghi gốc http://localhost:1420 (ai-flow.spec.ts "first run" ×2, learner.spec.ts "touch screens get 40px targets"), bản sao chỉ đổi gốc sang 1421 thì qua 3/3. Hai trong bốn lần chạy dự án chromium còn hỏng thêm studio.spec.ts:137, chemistry.spec.ts:24, lesson-flow.spec.ts:74: quá giờ khi 8 luồng cùng mở mô-đun lần đầu lúc dev server còn lạnh (chạy riêng thì qua; ở lần qua mất 17,9 s, 39,6 s, 43,0 s). chromium-3d 31/31 và chromium-3d-perf 1/1 (chạy với --no-deps vì dự án chromium hỏng 3 bài do cổng)
- **0.7.1**: E2E 22/10/2026 trên cổng 1421 (trạng thái lưu viết cho 1421): dự án chromium 71/74 với 4 luồng; 3 bài hỏng chỉ vì tự ghi gốc http://localhost:1420 (ai-flow.spec.ts "first run" ×2, learner.spec.ts "touch screens get 40px targets"), bản sao chỉ đổi gốc và đường dẫn import thì qua (24/24 bài của hai tệp). Lần chạy 8 luồng trước đó còn 4 bài quá giờ 60 s khi chờ trang mở đầu (chemistry.spec.ts:83, studio.spec.ts:346, teacher.spec.ts:190, board.spec.ts:656); chạy riêng qua 4/4 trong 8,7 s. chromium-3d 34/34 và chromium-3d-perf 1/1 (chạy với --no-deps). studio.spec.ts 7/7 sau khi tab đổi thành “Vật lý”
- **0.7.1**: 22/10/2026 trên máy Windows, feat/0.7.1 ở 2b069b6: format, lint, typecheck sạch; 4203 unit test qua (307 tệp), 1 bỏ qua có điều kiện (postfx.gpu.test.ts); E2E chromium-3d 34/34 và @perf 7/7 lần chạy riêng (p95 66,6–66,7 ms) trên cổng 1421; dự án chromium vẫn có 3 bài chỉ hỏng vì tự ghi gốc http://localhost:1420 như các dòng trên
- **0.8.0**: PR #91: unit đạt (1 test chập chờn khi máy tải nặng, chạy riêng đạt); CI 8/8 gồm cả E2E 3D (docs/work-log/2026-10-27-k-virtual-lab.md)

## VI. Lịch sử bảo mật, hiệu năng và kết quả kiểm thử

### Bảo mật

- **0.2.0** (Đã phát hành): Bản cập nhật trong app được ký số và kiểm tra chữ ký trước khi dùng.
- **0.3.0** (Đã phát hành): Lần đầu mở app hỏi xác nhận đủ 18 tuổi và điều khoản; chưa xác nhận thì không lưu khóa và không gọi AI.
- **0.3.0** (Đã phát hành): Nhãn 'Nội dung do AI hỗ trợ' và nút báo cáo; chặn đề có thông tin cá nhân; lọc câu trả lời của AI; nhật ký sự cố chỉ ghi loại và thời gian; trang Quyền riêng tư.
- **0.4.0** (Chưa xác minh): Tra Wikipedia thành tùy chọn, mặc định tắt.
- **0.4.0** (Chưa xác minh): Gỡ phần mã Ollama cũ; trang ngoài chỉ mở từ một danh sách cố định.
- **0.4.1** (Đã phát hành): Tra Wikipedia thành tùy chọn, mặc định tắt (bản fork trước đó gửi câu hỏi tới Wikipedia mỗi lần mà không báo).
- **0.4.1** (Đã phát hành): Trang ngoài chỉ mở được từ một danh sách cố định.
- **0.5.2** (Đã phát hành): Mỗi đoạn trả lời hiện dần của Gemma đều qua bộ lọc an toàn; có đoạn không an toàn thì cả câu trả lời bị thu lại.
- **0.6.0** (Đã phát hành): Quy trình phát hành chặt hơn: chỉ phát hành mã đã có trên nhánh chính, bước ký số chạy riêng, mọi công cụ tự động được ghim đúng phiên bản; bật quét bí mật và cảnh báo thư viện có lỗ hổng.
- **0.6.0** (Đã phát hành): Liên kết do AI viết không còn bấm được, và cửa sổ app không mở trang web lạ bên trong.
- **0.6.0** (Đã phát hành): Tài liệu và ghi chú đưa cho AI được đánh dấu là dữ liệu tham khảo, không phải lệnh.
- **0.6.0** (Đã phát hành): Giới hạn lượt AI mỗi ngày chắc chắn hơn (mặc định 100 lượt).
- **0.6.0** (Đã phát hành): Mô hình Gemma và giọng đọc trên máy luôn tải đúng một phiên bản đã ghim.
- **0.7.0** (Đã phát hành): Chụp ảnh đề bài nay cũng theo cổng an toàn và bộ lọc nội dung; khi em chọn Gemma, ảnh không bao giờ được gửi lên mạng.
- **0.7.0** (Đã phát hành): Hộp cập nhật bắt buộc và câu hỏi về tuổi hiện lại nếu bị đóng bằng phím Esc.
- **0.7.0** (Đã phát hành): Câu hỏi bị chặn ở lại ô nhập để em sửa, không còn bị lưu hay gửi đi sau đó.
- **0.7.1** (Đã phát hành): Phần lõi của ứng dụng dùng bản mới của thư viện kiểm tra chứng chỉ khi kết nối Internet.
- **0.8.0** (Đang xét duyệt): Cập nhật các thư viện có lỗ hổng đã biết và các phụ thuộc khác.

### Hiệu năng

- **0.5.0** (Đã phát hành): Bộ cài và gói cập nhật nhỏ hơn: bộ cài 21,6 MB (0.4.1) → 11,7 MB, gói cập nhật 32,1 MB → 18,2 MB.
- **0.5.2** (Đã phát hành): Tìm nhanh chỉ được tải khi dùng lần đầu (gói 6 kB), nên app mở vẫn nhẹ.
- **0.6.0** (Đã phát hành): Không tra Wikipedia khi Gemma đã có ghi chú phù hợp trong thư viện.
- **0.7.0** (Đã phát hành): Hình 3D chỉ vẽ lại khi có thay đổi, chia mức chi tiết theo chất lượng hiển thị và giải phóng bộ nhớ khi rời bài; khi máy chậm, chuyển động bớt mượt nhưng số liệu vẫn giữ nguyên độ chính xác.
- **0.7.1** (Đã phát hành): Các hiệu ứng ánh sáng nặng chỉ bật ở chất lượng Cao trên máy có card đồ họa rời; máy dùng đồ họa tích hợp không bị nâng mức và không có các hiệu ứng này, mức Thấp vẫn dùng hình 2D.

### Kết quả kiểm thử

**0.1.0** (Bản phát triển, không phát hành)

- Bộ đề chuẩn 31 bài; E2E Playwright (PROGRESS '2026-09-29 \| 3')
- Đo hiệu năng: khởi động 0,28 s, JS ban đầu 168 KB gzip (PROGRESS '2026-09-29 \| 6')
- Job 'Tests before packaging' đạt ở run 36565163753 và 36573143091
- Số lượng unit/E2E/Rust test của bản này: chưa xác minh được

**0.2.0** (Đã phát hành)

- 317 unit test, 27 E2E, 21 Rust test đạt (PROGRESS '2026-10-05 \| sửa')
- Job 'Tests before packaging' đạt (run 37257271728)

**0.3.0** (Đã phát hành)

- Job 'Tests before packaging' đạt (run 37489652593); test bảo đảm bản THPT không chứa mã Gemini (PROGRESS 3b.1)
- E2E Kết nối AI (khóa đúng/sai/hết hạn mức/mất mạng), E2E 1366×768, test chữ ký thứ hai (commit e041c0b, 1409eeb, 511fef2)
- Tổng số unit/E2E/Rust test của 0.3.0: chưa xác minh được (các hàng 3b của PROGRESS không ghi số)

**0.4.0** (Chưa xác minh)

- format:check + lint + typecheck sạch, 412 unit test, build (PROGRESS 'fork-sửa'); 61 tệp / 416 test (PROGRESS 'fork-kiểm')
- 4 E2E Thầy AI mới; số liệu kiểm tra cuối của 0.4.0: chưa xác minh được (PROGRESS trỏ tới docs/AI\_TUTOR.md nhưng tài liệu đó không có số test)

**0.4.1** (Đã phát hành)

- 457 unit, 47 E2E, Rust 53 + 48 (bản chính + THPT), clippy (PROGRESS 'fork-0.4.1'; mô tả PR #7; commit e342263)
- Thử thật: tải Gemma 270M (≈ 343 MB), nạp lên GPU AMD, trả lời trên máy trong 39 s (PROGRESS 'fork-0.4.1')
- Job 'Tests before packaging' đạt (run 38210325461)

**0.4.2** (Chưa xác minh)

- 467 unit, 47 E2E (Edge 154), Rust 60 + 55 (bản chính + THPT), clippy; chọn RTX → mở lại → WebGPU báo nvidia/blackwell (PROGRESS 'fork-0.4.2')

**0.4.3** (Chưa xác minh)

- 491 unit, 48 E2E (Edge 154), Rust 63 + 57 (PROGRESS 'fork-0.4.3')
- Mâu thuẫn: mô tả PR #8 ghi 'npm run check PASS — 484 test', 'E2E 48/48', 'Rust … 58 test'; chưa xác minh được lần chạy nào đúng

**0.5.0** (Đã phát hành)

- format:check/lint/typecheck đạt; 553 unit; E2E 49/49; Rust fmt + clippy + 61 test; build; thử tay tải giọng MMS 115 MB và bài giảng mẫu trên bảng (PR #14, PROGRESS '0.5.0-gộp')
- 558 unit, 49 E2E, build; xem tận mắt 1366×768 sáng/tối (PROGRESS '0.5.0-gọn', vẫn trong PR #14)
- Job 'Tests before packaging' đạt (run 38336613170)

**0.5.1** (Đã gộp, chưa phát hành)

- format/lint/typecheck đạt; 565 unit; E2E 49/49; Rust fmt + clippy + 62 test; build web + bản release; dựng thử gói MSIX trên máy (12 MB) (PR #15, PROGRESS '0.5.1-store')
- PR #17: prettier, YAML hợp lệ, test cấp app (63)

**0.5.2** (Đã phát hành)

- format:check, lint, typecheck sạch; 587 unit test (86 tệp); build; 49 E2E; ảnh 1366×768 sáng/tối (PR #18, PROGRESS '0.5.2-ui-polish')
- Trạng thái ban đầu của audit tại c25ad9d: Rust fmt/clippy/62 test; 587 unit; 49 E2E; npm audit 0; CI 4/4 (AUDIT G0)
- Job 'Tests before packaging' đạt (run 38415240996)
- Hai E2E mở module Sinh học lần đầu có thể hết giờ khi chạy song song trên Windows; lần chạy đầu của PR #19 có 4 lần hết giờ khi máy tải nặng, chạy lại thì qua

**0.6.0** (Đã phát hành)

- format, lint, typecheck sạch; 792/792 unit test (106 tệp); E2E 52/52 hai lần liên tiếp; Rust fmt + clippy -D warnings + 71 test; npm audit 0; cargo audit 0 lỗ hổng (2 cảnh báo cũ); build web (docs/AUDIT\_2026-10-13.md 'Kiểm tra cuối (14/10)', đầu PR #20)
- App desktop bản release dựng trên máy người phát triển: chặn điều hướng ra trang ngoài, công thức KaTeX đúng vị trí, mô phỏng 3D mở được (AUDIT)
- Gemma 270M/1B chạy thật trên card NVIDIA RTX 5060; đánh giá 30 câu chấm lại ngày 14/10, cùng thước chấm và cùng cách sinh chữ (greedy, Gemma 1B, docs/TEACHING\_EVAL.md): câu trả lời về khái niệm/hiểu lầm kết thúc bằng câu hỏi kiểm tra ở 43,8 % với lời nhắc của PR #20 (f527f18) và chỉ 18,8 % với lời nhắc v2 trên nhánh local. Các số 4 % → 42 % và 29 % → 23 % trong AUDIT G3 theo thước chấm lúc đó, không so trực tiếp được
- Benchmark 168/168 lượt, 42 câu, Gemma 1B: cách sinh văn bản mới tăng ý chính đúng 13,4 điểm với prompt cũ (kiểm định dấu p = 0,007; câu đúng, McNemar p = 0,031); lời nhắc của PR #20 (f527f18) không đúng hơn prompt cũ; nhánh local dùng lời nhắc v2, đo được ý chính đúng 31,3 % (prompt và cách sinh cũ) → 47,7 % (docs/TEACHING\_EVAL.md)
- Workflow 'Security checks' đạt trên PR #20 (2026-10-13T19:05:44Z)
- Số test của các commit sau đầu PR f527f18: xem docs/PROGRESS.md hàng '0.6.0-g6-g7' (số cuối cùng được ghi ở đó)
- Số test sau phần G8 (051816b và commit tài liệu kèm theo): xem docs/PROGRESS.md hàng '0.6.0-g8'
- Science Studio + chuẩn bị phát hành (19/10/2026, nhánh feat/science-studio): xem docs/PROGRESS.md hàng '0.6.0-studio' và docs/work-log/2026-10-19-release-prep.md

**0.7.0** (Đã phát hành)

- 20/10/2026 trên b59cc1a: format, lint, typecheck sạch (prettier chỉ báo hai tệp ngoài kho, không được theo dõi: AGENTS.md, bench.json); 3933/3933 unit test (272 tệp); E2E 102/102 (chromium 72, chromium-3d 29, chromium-3d-perf 1); Rust fmt + clippy -D warnings + 221 test
- Lần chạy E2E đầu tiên có lỗi ngẫu nhiên do thư mục kết quả Playwright nằm trong vùng Vite theo dõi (tệp .html của trace làm trang tải lại giữa chừng) và do chờ quá ngắn khi mở mô-đun lần đầu; đã sửa ở b59cc1a (không bỏ bài kiểm tra nào, không đổi điều được kiểm; lần mở mô-đun đầu tiên được chờ tới 20 s như các bài khác, dự án 3D chạy tối đa 4 luồng)
- Build web, bộ cài Windows (NSIS + MSI, npm run tauri build) và kiểm tra app thật: xem docs/PROGRESS.md hàng '0.7.0'

**0.7.1** (Đã phát hành)

- 20/10/2026 trong sandbox đám mây (Linux) trên a5661cb + tài liệu: npm run check sạch (format, lint, typecheck) và 3942/3942 unit test (274 tệp); npm run format:check sạch
- E2E đầy đủ (npm run test:e2e): 100 qua, 2 hỏng, 1 không chạy (dự án chromium-3d-perf, phụ thuộc chromium-3d). Hỏng: mitosis3d.spec.ts 'plays through every stage' (hình 3D tự về 2D khi chạy phần mềm) và 'boxes never overlap' (chỉ khi chạy song song; chạy riêng thì qua). Bài đầu hỏng y hệt trên main 433c3a9 trong cùng sandbox, nên không do thay đổi này; chưa chạy trên máy Windows
- 21/10/2026 trên máy Windows (16 luồng), nhánh feat/0.7.1 sau khi gộp main (3bdb73a) cùng ghi chú này: npm run check sạch (format, lint, typecheck) và 4117 unit test qua, 1 bỏ qua có điều kiện (src/ui/three/postfx.gpu.test.ts chỉ chạy khi có WebGL 2 thật); npm run format:check sạch; cargo test trong src-tauri 221 qua
- E2E trên cổng 1421 (một worktree khác có thể dùng 1420; trạng thái lưu của E2E được viết lại cho cổng 1421): dự án chromium 70/73; 3 bài hỏng vì tự ghi gốc http://localhost:1420 (ai-flow.spec.ts "first run" ×2, learner.spec.ts "touch screens get 40px targets"), bản sao chỉ đổi gốc sang 1421 thì qua 3/3. Hai trong bốn lần chạy dự án chromium còn hỏng thêm studio.spec.ts:137, chemistry.spec.ts:24, lesson-flow.spec.ts:74: quá giờ khi 8 luồng cùng mở mô-đun lần đầu lúc dev server còn lạnh (chạy riêng thì qua; ở lần qua mất 17,9 s, 39,6 s, 43,0 s). chromium-3d 31/31 và chromium-3d-perf 1/1 (chạy với --no-deps vì dự án chromium hỏng 3 bài do cổng)
- 22/10/2026 trên máy Windows (16 luồng), nhánh feat/0.7.1 ở 7f35c78 cùng tài liệu của bước hoàn tất: npm run format:check, lint, typecheck sạch; 4200 unit test qua (307 tệp), 1 bỏ qua có điều kiện (src/ui/three/postfx.gpu.test.ts chỉ chạy khi có WebGL 2 thật); npm run build qua; npm run tauri build qua (Rust release 4 phút 26 giây, 0 cảnh báo): SimLab\_0.7.1\_x64-setup.exe 11,73 MiB và SimLab\_0.7.1\_x64\_en-US.msi 12,49 MiB. Phần Rust không đổi so với main b6d7298 nên không chạy lại cargo fmt/clippy/test (21/10/2026: cargo test 221 qua)
- E2E 22/10/2026 trên cổng 1421 (trạng thái lưu viết cho 1421): dự án chromium 71/74 với 4 luồng; 3 bài hỏng chỉ vì tự ghi gốc http://localhost:1420 (ai-flow.spec.ts "first run" ×2, learner.spec.ts "touch screens get 40px targets"), bản sao chỉ đổi gốc và đường dẫn import thì qua (24/24 bài của hai tệp). Lần chạy 8 luồng trước đó còn 4 bài quá giờ 60 s khi chờ trang mở đầu (chemistry.spec.ts:83, studio.spec.ts:346, teacher.spec.ts:190, board.spec.ts:656); chạy riêng qua 4/4 trong 8,7 s. chromium-3d 34/34 và chromium-3d-perf 1/1 (chạy với --no-deps). studio.spec.ts 7/7 sau khi tab đổi thành “Vật lý”
- Chưa kiểm bản dựng thật bằng exe + CDP: ngày 22/10/2026 SimLab đã cài (D:/SimLab/stem-sim-lab.exe) đang mở trên máy, nên bước này bỏ qua để không đụng tới tiến trình đó
- 22/10/2026 trên máy Windows, feat/0.7.1 ở 2b069b6: format, lint, typecheck sạch; 4203 unit test qua (307 tệp), 1 bỏ qua có điều kiện (postfx.gpu.test.ts); E2E chromium-3d 34/34 và @perf 7/7 lần chạy riêng (p95 66,6–66,7 ms) trên cổng 1421; dự án chromium vẫn có 3 bài chỉ hỏng vì tự ghi gốc http://localhost:1420 như các dòng trên

**0.8.0** (Đang xét duyệt)

- CI 8/8 (Frontend lint · typecheck · test · build, Rust ubuntu và windows, E2E, npm audit, cargo audit, gitleaks, dependency review) xanh trên mọi PR trước khi gộp (gh pr checks; nhánh main bắt buộc 8 bước)
- PR #87 sau khi sửa theo duyệt: E2E đầy đủ trên máy 127/127 đạt (27/10/2026, work-log docs/work-log/2026-10-27-a-uniform-circular-motion.md)
- PR #88: unit 4269 đạt; E2E learner 6/6 và biology + project 17/17 đạt (phiên làm PR #88, 27/10/2026)
- PR #90 sau lượt duyệt 2: unit 4339 đạt; E2E physics + layout 17/17 đạt (docs/work-log/2026-10-26-b-standing-wave.md)
- PR #91: unit đạt (1 test chập chờn khi máy tải nặng, chạy riêng đạt); CI 8/8 gồm cả E2E 3D (docs/work-log/2026-10-27-k-virtual-lab.md)

## VII. Những vấn đề chưa hoàn thành

### Vấn đề đã biết của bản mới nhất (0.8.0, Đang xét duyệt)

Chưa có mục nào.

### Phiên bản chưa phát hành hoặc chưa xác minh

- **0.8.0** (Đang xét duyệt): PR phiên bản mở 27/10/2026, chưa gộp, chưa phát hành; dự kiến gộp 31/10/2026 (hạn ngừng thêm tính năng của kế hoạch #37). Phần web và phần lõi cùng lên 0.8.0 theo lời giao việc 0.8.0 của chủ dự án, nên ứng dụng 0.7.1 sẽ được báo cài bộ cài mới thay vì cập nhật trong app; máy dùng cho buổi demo 07/11/2026 phải cài bộ cài 0.8.0. Bài (d) Điện trường của điện tích điểm (PR #89) còn đang duyệt lúc mở PR này: chỉ thêm vào ghi chú khi đã gộp.
- **0.5.1** (Đã gộp, chưa phát hành): Không có tag v0.5.1 và không có GitHub Release riêng; bộ cài lõi 0.5.1 được phát hành lần đầu kèm Release v0.5.2. Gói Microsoft Store 0.5.1.0 đã gửi duyệt ngày 13/10/2026 và được chọn giữ lại; chưa có tài liệu nào cho thấy app đã lên Store.
- **0.4.3** (Chưa xác minh): Nhãn nội bộ, chưa bao giờ là số phiên bản trong package.json (commit cbb176a nâng thẳng 0.4.1 → 0.5.0). Không có tag, Release hay ZIP. Nội dung, trừ bảng giảng LessonBoard đã bị thay, đến với người dùng trong 0.5.0.
- **0.4.2** (Chưa xác minh): Nhãn nội bộ, chưa bao giờ là số phiên bản trong package.json. Không có tag, Release hay ZIP. Nội dung đến với người dùng trong 0.5.0.
- **0.4.0** (Chưa xác minh): Bản fork 'Thầy AI' gửi dưới dạng tệp ZIP. Không commit nào mang số 0.4.0 (package.json đi thẳng 0.3.0 → 0.4.1) và ZIP chưa được mở để kiểm. Nội dung vào git và được phát hành cùng 0.4.1.
- **0.1.0** (Bản phát triển, không phát hành): Phiên bản khởi tạo. GitHub Actions dựng bộ cài 2 lần ngày 29/09/2026 nhưng chỉ thành artifact: không có tag v0.1.0 và không có GitHub Release.

### Điểm chưa xác minh được

- Ngày tạo tag: cả 8 tag (v0.2.0, v0.3.0, v0.4.1, v0.5.0, v0.5.2, v0.6.0, v0.7.0, v0.7.1) là tag nhẹ (lightweight), nên git không lưu thời điểm tạo tag; dates.tagged để trống. Cần audit log của GitHub, log của bước phát hành hoặc chủ repo xác nhận.
- 0.1.0: có hai bản dựng thử (artifact) ngày 29/09/2026 nhưng không có tag hay GitHub Release; cần quyết định có nhắc bản này trong ghi chú phát hành công khai hay không.
- 0.4.0: chỉ có tên tệp ZIP, hàng PROGRESS 'fork-0.4.0' và CLAUDE.md; chưa mở ZIP để xem package.json, và chưa biết ZIP được gửi cho ai, ngày nào (ngày sửa tệp không phải ngày phân phối).
- 0.4.2 và 0.4.3: chỉ là nhãn trong tài liệu, chưa bao giờ là số phiên bản thật. Số test của 0.4.3 mâu thuẫn: PROGRESS ghi 491 unit, 48 E2E, Rust 63 + 57; mô tả PR #8 ghi 484 test, E2E 48/48, Rust 58 test.
- 0.5.0: tệp ZIP mang tên v0.5.0 được tạo trước khi gộp PR #8, nên khác bản phát hành v0.5.0.
- 0.5.1: chưa biết trạng thái hiện tại của gói Microsoft Store (đã qua duyệt chưa, đã bấm Publish now chưa) và gói MSIX đã nộp được dựng ở đâu.
- Tổng số unit/E2E/Rust test của 0.1.0 và 0.3.0 không có trong tài liệu.

## VIII. Tham chiếu commit, PR, tag và GitHub Release

Kho mã: [https://github.com/minhpdnfhh32934-cell/stem-sim-lab](https://github.com/minhpdnfhh32934-cell/stem-sim-lab). Commit chỉ có trên nhánh local (ghi trong phần bằng chứng) không mở được trên GitHub.

| Phiên bản | Tag | Commit của tag | GitHub Release | PR | Commit (đầu → cuối) | Nhánh |
| --- | --- | --- | --- | --- | --- | --- |
| 0.8.0 | — | — | — | [#26](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/26), [#27](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/27), [#28](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/28), [#40](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/40), [#41](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/41), [#42](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/42), [#43](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/43), [#44](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/44), [#45](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/45), [#46](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/46), [#47](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/47), [#48](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/48), [#49](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/49), [#50](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/50), [#51](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/51), [#53](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/53), [#55](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/55), [#79](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/79), [#81](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/81), [#82](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/82), [#83](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/83), [#84](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/84), [#85](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/85), [#86](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/86), [#87](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/87), [#88](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/88), [#90](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/90), [#91](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/91) | `39bfd01` → `d57b284` | `main`, `chore/0.8.0-version` |
| 0.7.1 | `v0.7.1` | `49c4d6a513ae452a5290d5f49359a4b243db911a` | [Release v0.7.1](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.7.1) | [#35](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/35), [#38](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/38) | `61258ea` → `9fb3061` → `a5661cb` → `3b2d0b8` → `9be792c` → `fbde966` → `c3cab4c` → `5a3ddaf` → `9de55fc` → `0adba18` → `4d6769b` → `b97b2b5` → `3e3115c` → `24ac90b` → `12f6fc1` → `304ef28` → `ee773a0` → `8b6cc69` → `3bdb73a` → `0b4970f` → `1f51d5d` → `2f135f1` → `5b9efef` → `fdfeecb` → `6232792` → `b5852b5` → `ccfc01e` → `6a8b391` → `a3d8a97` → `bd95467` → `7f35c78` → `dafff80` → `2b069b6` → `49c4d6a` | `claude/wizardly-galileo-k3vxcs`, `feat/0.7.1` |
| 0.7.0 | `v0.7.0` | `433c3a91b481e4ba9dabf593d2a6cb8b113ee8bf` | [Release v0.7.0](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.7.0) | [#32](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/32) | `d86c099` → `ff4f63f` → `15ae66c` → `2ea45a6` → `745dea0` → `b361e3c` → `1c00c7c` → `f302cff` → `3773296` → `825a08f` → `b59cc1a` → `433c3a9` | `feat/0.7` |
| 0.6.0 | `v0.6.0` | `feab5a8eec14e7ac728a0b5ca75629259ed87a3f` | [Release v0.6.0](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.6.0) | [#20](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/20), [#21](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/21), [#22](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/22), [#29](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/29), [#30](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/30) | `511345d` → `f527f18` → `8a3c48d` → `abc9e0c` → `c051a5e` → `cae3487` → `feab5a8` | `feat/audit-g0-g5`, `feat/mitosis-3d`, `feat/teacher-quality`, `feat/voice-natural`, `feat/release-history`, `feat/local-ai-runtime`, `feat/teacher-board-runtime`, `feat/science-studio`, `fix/release-0.6.0`, `fix/mitosis-card-linux` |
| 0.5.2 | `v0.5.2` | `c25ad9d37cc27efb6e9ad4cc8a7dd45f5256c0da` | [Release v0.5.2](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.5.2) | [#18](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/18), [#19](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/19) | `f25e3ae` → `c25ad9d` | `feat/ui-polish`, `release/0.5.2` |
| 0.5.1 | — | — | — | [#15](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/15), [#16](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/16), [#17](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/17) | `2d506e7` → `069df6c` | `feat/microsoft-store`, `chore/store-identity`, `chore/store-manual-submit` |
| 0.5.0 | `v0.5.0` | `c6d01f4081eee86e244136074e6997dd64bebe3f` | [Release v0.5.0](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.5.0) | [#8](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/8), [#11](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/11), [#12](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/12), [#13](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/13), [#14](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/14) | `cbb176a` → `c6d01f4` | `feat/simlab-ai-teacher-board`, `feat/v0.5.0-gpu-thay-ai`, `fix/knowledge-review-status`, `perf/ort-asyncify-only`, `chore/message-parse-module` |
| 0.4.3 | — | — | — | [#8](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/8) | `cbb176a` | `feat/v0.5.0-gpu-thay-ai` |
| 0.4.2 | — | — | — | [#8](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/8) | `cbb176a` → `d15587e` | `feat/v0.5.0-gpu-thay-ai` |
| 0.4.1 | `v0.4.1` | `e342263be0836737e1c0a1eab009ced49f22ad8c` | [Release v0.4.1](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.4.1) | [#7](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/7) | `17e1cd4` → `e342263` | `fork/thay-ai`, `master` |
| 0.4.0 | — | — | — | — | `0f4d2f8` | `master` |
| 0.3.0 | `v0.3.0` | `1e7029a602ce17a29796a187e5093f7cec76987a` | [Release v0.3.0](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.3.0) | — | `d587a4c` → `1e7029a` | `main` |
| 0.2.0 | `v0.2.0` | `7d32305da0d2e21fd62676d7250170801c2240b9` | [Release v0.2.0](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.2.0) | — | `c515250` → `7d32305` | `main` |
| 0.1.0 | — | — | — | — | `b9a2430` → `f857ec7` | `main` |
