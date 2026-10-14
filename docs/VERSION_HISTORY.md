# SimLab — Version History & Release Notes

Lịch sử phiên bản và ghi chú phát hành của SimLab (tên cũ: STEM Sim Lab). Tạo tự động từ `release-notes/versions.json` bằng `npm run release-notes`. Đừng sửa tay. Bằng chứng được kiểm lần cuối ngày 14/10/2026.

## I. Tổng quan lịch sử SimLab

SimLab (tên cũ: STEM Sim Lab) là ứng dụng desktop mô phỏng Vật lý, Hóa học và Sinh học cho người học, chạy ngay trên máy (Tauri 2 + React). Mọi con số do chương trình tính bằng mô hình ghi trong Thẻ Khoa học; AI chỉ đọc đề và giải thích bằng lời.

Dự án bắt đầu ngày 28/09/2026: Phase 0–7 (khung app, lõi tính toán, Vật lý, AI đọc đề, Hóa học, Sinh học, dự án và bộ cài Windows) xong trong hai ngày đầu. Tiếp theo là giai đoạn 3b (học bằng khám phá, an toàn khi dùng AI, hai bộ cài), bản fork 'Thầy AI' (09–12/10/2026) mà nay là AI Teacher, rồi đổi tên thành SimLab ở 0.5.0 và đợt rà soát toàn diện G0–G5 cho 0.6.0.

Tài liệu này được tạo tự động từ release-notes/versions.json (npm run release-notes). Mọi mốc thời gian lấy từ git, GitHub (PR, Actions, Releases) và tài liệu trong repo; ô ghi 'Chưa xác minh được' nghĩa là chưa có bằng chứng, không có nghĩa là việc đó không xảy ra. Giờ được đổi sang giờ Việt Nam (UTC+7); giá trị gốc nằm trong versions.json.

- Số phiên bản ghi nhận: 11 (0.1.0 → 0.6.0).
- Đã phát hành trên GitHub: 0.2.0 (05/10/2026), 0.3.0 (06/10/2026), 0.4.1 (12/10/2026), 0.5.0 (13/10/2026), 0.5.2 (13/10/2026).
- Đã gộp, chưa phát hành: 0.5.1.
- Đang xét duyệt: 0.6.0.
- Bản phát triển, không phát hành: 0.1.0.
- Chưa xác minh: 0.4.0, 0.4.2, 0.4.3.
- Phiên bản mới nhất trong dữ liệu: 0.6.0 (Đang xét duyệt).

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
| 0.6.0 | Đang xét duyệt | Chưa phát hành | [#20](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/20) | — |

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

## III. Chi tiết từng phiên bản

### 0.6.0 (Đang xét duyệt)

Bản lớn sau đợt rà soát toàn diện: AI Teacher giảng có câu hỏi kiểm tra và dùng kết quả do SimLab tính, Gemma an toàn hơn trên card đồ họa tích hợp, có mô phỏng Nguyên phân 3D và nhiều sửa lỗi bảo mật.

- Trạng thái: Đang xét duyệt.
- Kênh phân phối: GitHub Releases: bộ cài Windows và cập nhật trong app.
- Ghi chú trạng thái: PR #20 đang mở: chưa gộp, chưa có tag, chưa có GitHub Release và chưa có lượt Release trên GitHub Actions. Bản release mới chỉ được dựng trên máy của người phát triển. Các commit sau đầu PR (cách giảng, nút Dừng, kiểm tra con số, tìm ghi chú, hộp 'Có gì mới') lúc ghi chỉ có trên các nhánh local feat/audit-g0-g5, feat/teacher-quality và feat/release-history.
- Ghi chú công khai: bản nháp, chưa duyệt để công bố (không hiện trong hộp "Có gì mới").

| Mốc | Thời điểm (giờ VN) | Giá trị gốc |
| --- | --- | --- |
| Bắt đầu phát triển | 13/10/2026 22:42 | `2026-10-13T22:42:01+07:00` |
| Commit đầu tiên | 13/10/2026 22:42 | `2026-10-13T22:42:01+07:00` |
| Commit cuối cùng | 14/10/2026 02:04 | `2026-10-14T02:04:44+07:00` |
| Gộp vào nhánh (merge) | Chưa xác minh được | — |
| Dựng bộ cài (GitHub Actions) | Chưa xác minh được | — |
| Phát hành (GitHub Release) | Chưa xác minh được | — |
| Tạo tag | Chưa xác minh được | — |

**Tính năng mới**

- Mô phỏng Nguyên phân 3D cho tế bào động vật và thực vật: 7 bước, phát/tạm dừng/từng bước, xoay, chọn một bộ phận để đọc chức năng, có Thẻ Khoa học riêng.
- Thẻ 'Kết quả do SimLab tính' khi câu hỏi có phương trình hóa học: bộ cân bằng của SimLab giải phương trình, AI chỉ giải thích.
- Nút 'Gợi ý từng bước', và nút 'Xem mô phỏng' dưới câu trả lời khi câu hỏi nêu đúng tên một chủ đề có mô phỏng.
- Nút 'Dừng' để dừng câu trả lời đang viết, với Gemma lẫn AI trực tuyến.
- SimLab nhắc khi đề bài có thể còn thiếu số liệu, và liệt kê các con số AI tự đưa ra mà chưa ai cho (chưa kiểm chứng).
- Cảnh báo khi bật giọng đọc mà máy không có giọng tiếng Việt.
- Hộp 'Có gì mới trong SimLab' sau khi cập nhật và trang 'Lịch sử phiên bản' trong Cài đặt.

**Cải tiến**

- Cách giảng rõ ràng hơn: mục tiêu, giải thích đơn giản, ví dụ, các bước có lý do, một lỗi hay gặp và một câu hỏi kiểm tra ở cuối.
- Thầy đọc đúng chữ đang viết trên bảng; tạm dừng giữa câu thì đọc lại câu đó; đọc ký hiệu đúng hơn (2n, \[S\], (aq), mũi tên phản ứng).
- Khi giọng đọc gặp lỗi, giọng dự phòng đọc tiếp từ đoạn chưa nghe, không đọc lặp.
- Gemma trả lời đúng ý hơn và bắt đầu nhanh hơn, hầu như không còn lẫn chữ nước ngoài hay viết méo thuật ngữ (đo trên 42 câu hỏi; câu trả lời dài hơn trước).
- Tìm ghi chú kiến thức hợp với câu hỏi tốt hơn; ghi chú lạc đề không được gửi cho AI.
- Giọng đọc trên máy đều và rõ hơn: âm lượng giữa các đoạn như nhau, tiếng đầu tiên đến sớm hơn, ngắt nghỉ theo câu và mệnh đề, không cắt giữa số và đơn vị; nhấn ý chính bằng một quãng nghỉ ngắn.
- Đọc đúng hơn nhiều ký hiệu khoa học: MeV, MPa, đơn vị mét vuông/mét khối, cấu hình electron, mũi tên phản ứng, "tan" trong hòa tan.

**Sửa lỗi**

- Gemma có thể làm treo card đồ họa tích hợp và khiến máy khởi động lại: nay sau một lỗi card, Gemma dừng tới khi mở lại app; card tích hợp dùng lời nhắc ngắn hơn; câu trả lời bị treo được tự dừng.
- Khi bật giọng đọc, bài giảng trên bảng có thể dừng sau câu đầu tiên.
- Giọng đọc chạy trên máy không bao giờ nạp lại vào card đồ họa vừa gặp lỗi; khi card lỗi, giọng chuyển sang CPU.

**Bảo mật**

- Quy trình phát hành chặt hơn: chỉ phát hành mã đã có trên nhánh chính, bước ký số chạy riêng, mọi công cụ tự động được ghim đúng phiên bản; bật quét bí mật và cảnh báo thư viện có lỗ hổng.
- Liên kết do AI viết không còn bấm được, và cửa sổ app không mở trang web lạ bên trong.
- Tài liệu và ghi chú đưa cho AI được đánh dấu là dữ liệu tham khảo, không phải lệnh.
- Giới hạn lượt AI mỗi ngày chắc chắn hơn (mặc định 100 lượt) và không bị đặt lại khi đổi ngày.
- Mô hình Gemma và giọng đọc trên máy luôn tải đúng một phiên bản đã ghim.

**Hiệu năng**

- Không tra Wikipedia khi Gemma đã có ghi chú phù hợp trong thư viện.

**Thay đổi**

- Phiên bản 0.6.0 thay đổi cả phần lõi: máy đang dùng 0.5.x cần tải bộ cài mới một lần.

**Vấn đề đã biết**

- Gemma 1B vẫn hay sai kiến thức và có lúc khen câu trả lời sai của học sinh; hãy kiểm tra lại bằng mô phỏng hoặc sách.
- Chưa đánh giá cách giảng với Gemini, Claude hoặc Groq thật (chưa có khóa để thử).
- Mô tả các kì của Nguyên phân 3D đang chờ giáo viên duyệt.
- Chưa dựng bộ cài Windows chính thức; bản Microsoft Store cần nộp gói mới.
- Trước khi phát hành, chủ dự án còn phải bật thêm một số lớp bảo vệ cho quy trình phát hành trên GitHub.
- Trên máy không có card đồ họa rời, giọng đọc trên máy chạy bằng CPU và chậm hơn lời nói nên có quãng chờ giữa các đoạn.
- Giọng MMS không có ngữ điệu, cảm xúc thật; chưa có người nghe chấm độ tự nhiên.

**Điểm nổi bật trong app**

- Mô phỏng Nguyên phân 3D: xem từng kì ở tế bào động vật và thực vật.
- AI Teacher kết thúc bằng một câu hỏi kiểm tra và dùng kết quả do SimLab tính cho phương trình hóa học.
- Nút 'Dừng' và lời nhắc khi đề bài có thể thiếu số liệu.
- Gemma an toàn hơn trên card đồ họa tích hợp.
- Liên kết do AI viết không còn bấm được.

**Bằng chứng**

- firstCommit: 511345d 2026-10-13T22:42:01+07:00 'fix(security): release integrity…' (G1), commit đầu sau tag v0.5.2 (c25ad9d)
- Nâng phiên bản: 0ec0577 2026-10-14T00:14:16+07:00 'chore(release): 0.6.0 (web + native)' — package.json 0.5.2 → 0.6.0; tauri.conf.json, Cargo.toml 0.5.1 → 0.6.0
- lastCommit: đầu PR #20 trên GitHub là f527f18 2026-10-14T02:04:44+07:00 (git ls-remote origin)
- PR #20 'Audit G0–G5: security, GPU safety, AI Teacher teaching, 3D mitosis (0.6.0)' mở lúc 2026-10-13T19:05:41Z, chưa gộp
- Commit sau đầu PR, lúc ghi chỉ có trên nhánh local: 01faf2f … 20b19c2 (tới 2026-10-14T08:15:31+07:00)
- built: không có lượt release.yml nào cho nhánh này; chỉ có lượt 'Security checks' trên PR (2026-10-13T19:05:44Z). AUDIT ghi bản release dựng trên máy người phát triển báo app\_info = 0.6.0
- Mô tả PR #20: chưa dựng bộ cài Windows; bản Store cần nộp lại gói mới
- Gemma quality: docs/TEACHING\_EVAL.md (2026-10-14): key facts 31.3 % (0.5.2 prompt and decoding) -\> 47.7 % (v2 prompt, answer-only decoding); answers with foreign script 50 % -\> 7 %; corrupted terms 19 % -\> 4.8 %; first piece p50 1.90 s -\> 0.91 s; answer length 810 -\> 1047 characters.
- Voice: docs/VOICE\_BENCHMARK.md §6 (2026-10-14): 19 sentences on the CPU, legacy vs natural pipeline: loudness spread 2.47 -\> 0 dB, first sound 4.07 -\> 3.22 s, no dropped/reordered words in either; RTF about 2 on the CPU in both modes.

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
- **0.6.0** (Đang xét duyệt, tính năng mới): Thẻ 'Kết quả do SimLab tính' khi câu hỏi có phương trình hóa học: bộ cân bằng của SimLab giải phương trình, AI chỉ giải thích.
- **0.6.0** (Đang xét duyệt, tính năng mới): Nút 'Gợi ý từng bước', và nút 'Xem mô phỏng' dưới câu trả lời khi câu hỏi nêu đúng tên một chủ đề có mô phỏng.
- **0.6.0** (Đang xét duyệt, tính năng mới): Nút 'Dừng' để dừng câu trả lời đang viết, với Gemma lẫn AI trực tuyến.
- **0.6.0** (Đang xét duyệt, tính năng mới): SimLab nhắc khi đề bài có thể còn thiếu số liệu, và liệt kê các con số AI tự đưa ra mà chưa ai cho (chưa kiểm chứng).
- **0.6.0** (Đang xét duyệt, cải tiến): Cách giảng rõ ràng hơn: mục tiêu, giải thích đơn giản, ví dụ, các bước có lý do, một lỗi hay gặp và một câu hỏi kiểm tra ở cuối.
- **0.6.0** (Đang xét duyệt, cải tiến): Tìm ghi chú kiến thức hợp với câu hỏi tốt hơn; ghi chú lạc đề không được gửi cho AI.
- **0.6.0** (Đang xét duyệt, bảo mật): Tài liệu và ghi chú đưa cho AI được đánh dấu là dữ liệu tham khảo, không phải lệnh.

### Giọng nói

- **0.5.0** (Đã phát hành, tính năng mới): Giọng đọc tiếng Việt với 3 nguồn: giọng Windows, Gemini TTS (trực tuyến) và giọng MMS chạy ngay trên máy.
- **0.6.0** (Đang xét duyệt, tính năng mới): Cảnh báo khi bật giọng đọc mà máy không có giọng tiếng Việt.
- **0.6.0** (Đang xét duyệt, cải tiến): Thầy đọc đúng chữ đang viết trên bảng; tạm dừng giữa câu thì đọc lại câu đó; đọc ký hiệu đúng hơn (2n, \[S\], (aq), mũi tên phản ứng).
- **0.6.0** (Đang xét duyệt, cải tiến): Khi giọng đọc gặp lỗi, giọng dự phòng đọc tiếp từ đoạn chưa nghe, không đọc lặp.
- **0.6.0** (Đang xét duyệt, cải tiến): Giọng đọc trên máy đều và rõ hơn: âm lượng giữa các đoạn như nhau, tiếng đầu tiên đến sớm hơn, ngắt nghỉ theo câu và mệnh đề, không cắt giữa số và đơn vị; nhấn ý chính bằng một quãng nghỉ ngắn.
- **0.6.0** (Đang xét duyệt, cải tiến): Đọc đúng hơn nhiều ký hiệu khoa học: MeV, MPa, đơn vị mét vuông/mét khối, cấu hình electron, mũi tên phản ứng, "tan" trong hòa tan.
- **0.6.0** (Đang xét duyệt, sửa lỗi): Khi bật giọng đọc, bài giảng trên bảng có thể dừng sau câu đầu tiên.
- **0.6.0** (Đang xét duyệt, sửa lỗi): Giọng đọc chạy trên máy không bao giờ nạp lại vào card đồ họa vừa gặp lỗi; khi card lỗi, giọng chuyển sang CPU.
- **0.6.0** (Đang xét duyệt, vấn đề đã biết): Trên máy không có card đồ họa rời, giọng đọc trên máy chạy bằng CPU và chậm hơn lời nói nên có quãng chờ giữa các đoạn.
- **0.6.0** (Đang xét duyệt, vấn đề đã biết): Giọng MMS không có ngữ điệu, cảm xúc thật; chưa có người nghe chấm độ tự nhiên.

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
- **0.6.0** (Đang xét duyệt, cải tiến): Gemma trả lời đúng ý hơn và bắt đầu nhanh hơn, hầu như không còn lẫn chữ nước ngoài hay viết méo thuật ngữ (đo trên 42 câu hỏi; câu trả lời dài hơn trước).
- **0.6.0** (Đang xét duyệt, sửa lỗi): Gemma có thể làm treo card đồ họa tích hợp và khiến máy khởi động lại: nay sau một lỗi card, Gemma dừng tới khi mở lại app; card tích hợp dùng lời nhắc ngắn hơn; câu trả lời bị treo được tự dừng.
- **0.6.0** (Đang xét duyệt, bảo mật): Mô hình Gemma và giọng đọc trên máy luôn tải đúng một phiên bản đã ghim.
- **0.6.0** (Đang xét duyệt, hiệu năng): Không tra Wikipedia khi Gemma đã có ghi chú phù hợp trong thư viện.
- **0.6.0** (Đang xét duyệt, vấn đề đã biết): Gemma 1B vẫn hay sai kiến thức và có lúc khen câu trả lời sai của học sinh; hãy kiểm tra lại bằng mô phỏng hoặc sách.

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
- **0.6.0** (Đang xét duyệt, bảo mật): Giới hạn lượt AI mỗi ngày chắc chắn hơn (mặc định 100 lượt) và không bị đặt lại khi đổi ngày.
- **0.6.0** (Đang xét duyệt, vấn đề đã biết): Chưa đánh giá cách giảng với Gemini, Claude hoặc Groq thật (chưa có khóa để thử).

## V. Cải tiến mô phỏng 3D Sinh học

Mô phỏng 3D Sinh học xuất hiện lần đầu ở phiên bản 0.6.0 (Đang xét duyệt); các phiên bản trước không có ghi chú nào về mô phỏng 3D Sinh học.

- **0.6.0** (Đang xét duyệt, tính năng mới): Mô phỏng Nguyên phân 3D cho tế bào động vật và thực vật: 7 bước, phát/tạm dừng/từng bước, xoay, chọn một bộ phận để đọc chức năng, có Thẻ Khoa học riêng.
- **0.6.0** (Đang xét duyệt, vấn đề đã biết): Mô tả các kì của Nguyên phân 3D đang chờ giáo viên duyệt.

**Kiểm thử liên quan**

- **0.6.0**: App desktop bản release dựng trên máy người phát triển: chặn điều hướng ra trang ngoài, công thức KaTeX đúng vị trí, mô phỏng 3D mở được (AUDIT)

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
- **0.6.0** (Đang xét duyệt): Quy trình phát hành chặt hơn: chỉ phát hành mã đã có trên nhánh chính, bước ký số chạy riêng, mọi công cụ tự động được ghim đúng phiên bản; bật quét bí mật và cảnh báo thư viện có lỗ hổng.
- **0.6.0** (Đang xét duyệt): Liên kết do AI viết không còn bấm được, và cửa sổ app không mở trang web lạ bên trong.
- **0.6.0** (Đang xét duyệt): Tài liệu và ghi chú đưa cho AI được đánh dấu là dữ liệu tham khảo, không phải lệnh.
- **0.6.0** (Đang xét duyệt): Giới hạn lượt AI mỗi ngày chắc chắn hơn (mặc định 100 lượt) và không bị đặt lại khi đổi ngày.
- **0.6.0** (Đang xét duyệt): Mô hình Gemma và giọng đọc trên máy luôn tải đúng một phiên bản đã ghim.

### Hiệu năng

- **0.5.0** (Đã phát hành): Bộ cài và gói cập nhật nhỏ hơn: bộ cài 21,6 MB (0.4.1) → 11,7 MB, gói cập nhật 32,1 MB → 18,2 MB.
- **0.5.2** (Đã phát hành): Tìm nhanh chỉ được tải khi dùng lần đầu (gói 6 kB), nên app mở vẫn nhẹ.
- **0.6.0** (Đang xét duyệt): Không tra Wikipedia khi Gemma đã có ghi chú phù hợp trong thư viện.

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

**0.6.0** (Đang xét duyệt)

- format, lint, typecheck sạch; 792/792 unit test (106 tệp); E2E 52/52 hai lần liên tiếp; Rust fmt + clippy -D warnings + 71 test; npm audit 0; cargo audit 0 lỗ hổng (2 cảnh báo cũ); build web (docs/AUDIT\_2026-10-13.md 'Kiểm tra cuối (14/10)', đầu PR #20)
- App desktop bản release dựng trên máy người phát triển: chặn điều hướng ra trang ngoài, công thức KaTeX đúng vị trí, mô phỏng 3D mở được (AUDIT)
- Gemma 270M/1B chạy thật trên card NVIDIA RTX 5060; đánh giá 30 câu chấm lại ngày 14/10: câu cuối là câu hỏi kiểm tra 4 % → 42 %, ý chính đúng 29 % → 23 % (AUDIT G3)
- Benchmark 168/168 lượt, 42 câu, Gemma 1B: cách sinh văn bản mới tăng ý chính đúng 14,2 điểm với prompt cũ (p = 0,003); prompt 0.6.0 không làm câu trả lời đúng hơn (docs/TEACHING\_EVAL.md, nhánh local)
- Workflow 'Security checks' đạt trên PR #20 (2026-10-13T19:05:44Z)
- Số test của các commit sau đầu PR: chưa xác minh được (chưa ghi trong tài liệu)

## VII. Những vấn đề chưa hoàn thành

### Vấn đề đã biết của bản mới nhất (0.6.0, Đang xét duyệt)

- Gemma 1B vẫn hay sai kiến thức và có lúc khen câu trả lời sai của học sinh; hãy kiểm tra lại bằng mô phỏng hoặc sách.
- Chưa đánh giá cách giảng với Gemini, Claude hoặc Groq thật (chưa có khóa để thử).
- Mô tả các kì của Nguyên phân 3D đang chờ giáo viên duyệt.
- Chưa dựng bộ cài Windows chính thức; bản Microsoft Store cần nộp gói mới.
- Trước khi phát hành, chủ dự án còn phải bật thêm một số lớp bảo vệ cho quy trình phát hành trên GitHub.
- Trên máy không có card đồ họa rời, giọng đọc trên máy chạy bằng CPU và chậm hơn lời nói nên có quãng chờ giữa các đoạn.
- Giọng MMS không có ngữ điệu, cảm xúc thật; chưa có người nghe chấm độ tự nhiên.

### Phiên bản chưa phát hành hoặc chưa xác minh

- **0.6.0** (Đang xét duyệt): PR #20 đang mở: chưa gộp, chưa có tag, chưa có GitHub Release và chưa có lượt Release trên GitHub Actions. Bản release mới chỉ được dựng trên máy của người phát triển. Các commit sau đầu PR (cách giảng, nút Dừng, kiểm tra con số, tìm ghi chú, hộp 'Có gì mới') lúc ghi chỉ có trên các nhánh local feat/audit-g0-g5, feat/teacher-quality và feat/release-history.
- **0.5.1** (Đã gộp, chưa phát hành): Không có tag v0.5.1 và không có GitHub Release riêng; bộ cài lõi 0.5.1 được phát hành lần đầu kèm Release v0.5.2. Gói Microsoft Store 0.5.1.0 đã gửi duyệt ngày 13/10/2026 và được chọn giữ lại; chưa có tài liệu nào cho thấy app đã lên Store.
- **0.4.3** (Chưa xác minh): Nhãn nội bộ, chưa bao giờ là số phiên bản trong package.json (commit cbb176a nâng thẳng 0.4.1 → 0.5.0). Không có tag, Release hay ZIP. Nội dung, trừ bảng giảng LessonBoard đã bị thay, đến với người dùng trong 0.5.0.
- **0.4.2** (Chưa xác minh): Nhãn nội bộ, chưa bao giờ là số phiên bản trong package.json. Không có tag, Release hay ZIP. Nội dung đến với người dùng trong 0.5.0.
- **0.4.0** (Chưa xác minh): Bản fork 'Thầy AI' gửi dưới dạng tệp ZIP. Không commit nào mang số 0.4.0 (package.json đi thẳng 0.3.0 → 0.4.1) và ZIP chưa được mở để kiểm. Nội dung vào git và được phát hành cùng 0.4.1.
- **0.1.0** (Bản phát triển, không phát hành): Phiên bản khởi tạo. GitHub Actions dựng bộ cài 2 lần ngày 29/09/2026 nhưng chỉ thành artifact: không có tag v0.1.0 và không có GitHub Release.

### Điểm chưa xác minh được

- Ngày tạo tag: cả 5 tag (v0.2.0, v0.3.0, v0.4.1, v0.5.0, v0.5.2) là tag nhẹ (lightweight), nên git không lưu thời điểm tạo tag; dates.tagged để trống. Cần audit log của GitHub, log của bước phát hành hoặc chủ repo xác nhận.
- 0.1.0: có hai bản dựng thử (artifact) ngày 29/09/2026 nhưng không có tag hay GitHub Release; cần quyết định có nhắc bản này trong ghi chú phát hành công khai hay không.
- 0.4.0: chỉ có tên tệp ZIP, hàng PROGRESS 'fork-0.4.0' và CLAUDE.md; chưa mở ZIP để xem package.json, và chưa biết ZIP được gửi cho ai, ngày nào (ngày sửa tệp không phải ngày phân phối).
- 0.4.2 và 0.4.3: chỉ là nhãn trong tài liệu, chưa bao giờ là số phiên bản thật. Số test của 0.4.3 mâu thuẫn: PROGRESS ghi 491 unit, 48 E2E, Rust 63 + 57; mô tả PR #8 ghi 484 test, E2E 48/48, Rust 58 test.
- 0.5.0: tệp ZIP mang tên v0.5.0 được tạo trước khi gộp PR #8, nên khác bản phát hành v0.5.0.
- 0.5.1: chưa biết trạng thái hiện tại của gói Microsoft Store (đã qua duyệt chưa, đã bấm Publish now chưa) và gói MSIX đã nộp được dựng ở đâu.
- 0.6.0: cần quyết định nội dung gồm những commit nào (đầu PR #20 hay cả các nhánh local đi sau), số liệu test lấy theo lần chạy nào; ngày phát hành chỉ được điền sau khi GitHub Release thật được publish.
- Tổng số unit/E2E/Rust test của 0.1.0 và 0.3.0 không có trong tài liệu.

## VIII. Tham chiếu commit, PR, tag và GitHub Release

Kho mã: [https://github.com/minhpdnfhh32934-cell/stem-sim-lab](https://github.com/minhpdnfhh32934-cell/stem-sim-lab). Commit chỉ có trên nhánh local (ghi trong phần bằng chứng) không mở được trên GitHub.

| Phiên bản | Tag | Commit của tag | GitHub Release | PR | Commit (đầu → cuối) | Nhánh |
| --- | --- | --- | --- | --- | --- | --- |
| 0.6.0 | — | — | — | [#20](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/20) | `511345d` → `f527f18` | `feat/audit-g0-g5`, `feat/mitosis-3d`, `feat/teacher-quality`, `feat/release-history` |
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
