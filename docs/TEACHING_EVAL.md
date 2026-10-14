# Đánh giá AI Teacher trên Gemma (14/10/2026)

Bản ghi các lần đo chất lượng giải thích của Gemma chạy trên máy (Transformers.js + WebGPU) qua
đúng mã của app. Mọi con số là số đo thật; dữ liệu thô nằm trong `tests/teaching/results/` và tính
lại được bằng `scripts/teaching/compare.mjs`, `breakdown.mjs` và `judge-score.mjs` (không cần GPU).
Mọi số dưới đây đã chấm lại bằng thước chấm hiện tại (bản sửa ngày 14/10: không còn tính chữ có
sẵn trong câu hỏi, kiểm định theo từng câu, ghi build của app).

**Kết luận ngắn.** Nguyên nhân chính làm Gemma 1B trả lời kém là cách sinh văn bản (cách sinh cũ, vẫn
dùng trong mã của PR #20 (f527f18), cấm mô hình chép lại cụm từ của chính câu hỏi). Sửa nó cộng với
prompt cải tiến v2 làm câu trả lời đúng ý hơn rõ rệt so với lời nhắc và cách sinh của PR #20
(f527f18), trên cả bộ 42 câu và bộ 15 câu mới (held-out). Mô hình 1B vẫn sai nhiều: theo giám khảo
AI, chỉ khoảng 2 % câu trả lời đúng hoàn toàn. Chưa có giáo viên chấm. Bản 0.6.0 chưa phát hành; mã
hiện tại của nhánh dùng prompt v2 và cách sinh mới.

## Thiết lập chung

| Mục          | Giá trị                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------- |
| Mô hình      | `gemma3-1b` (onnx-community, q4, revision ghim trong `src/ai/webGemmaModels.ts`)          |
| Phần cứng    | NVIDIA GeForce RTX 5060 Laptop ("nvidia blackwell"), kiểm tra lại sau mỗi lượt            |
| Trình chạy   | Microsoft Edge headless, `--force_high_performance_gpu`, dev server cổng 1430             |
| Sinh văn bản | greedy (temperature 0), tối đa 1024 token, 1 lượt cho mỗi tổ hợp                          |
| Bộ câu       | 42 câu (`tests/teaching/teaching-eval.json`) và 15 câu held-out (`teaching-heldout.json`) |
| Bộ canh GPU  | dừng nếu VRAM > 7,2 GB, > 83 °C hoặc Windows ghi lỗi card mới; không có lần nào           |

Ba prompt × hai cách sinh văn bản:

- **Prompt cũ** (`legacy`): prompt của `main` trước đợt audit (c25ad9d) + tối đa 4 ghi chú × 1500 ký tự.
- **Prompt PR #20** (`current`): lời nhắc của PR #20 (f527f18), `contextPrompt(…, 'compact')`.
  Trước đây gọi là "prompt 0.6.0"; 0.6.0 chưa phát hành, và mã hiện tại của nhánh dùng prompt v2.
- **Prompt cải tiến v1** (`improved`, build 20b19c2): một ghi chú tốt nhất ≤ 400 ký tự, câu đầu trả
  lời thẳng, phát hiện đề không có số, mức học của người học.
- **Prompt cải tiến v2** (`improved-v2`, build e5565e0/05903ce): như v1, nhưng câu hỏi "có phải… /
  …đúng không" và lượt học sinh trả lời câu hỏi kiểm tra có câu mở đầu riêng (xem giai đoạn 2).
- **Cách sinh cũ** (`legacy`): `repetition_penalty 1.2` + `no_repeat_ngram_size 3` áp lên cả câu
  hỏi lẫn câu trả lời (mã của PR #20, f527f18). **Cách sinh mới** (`app`): chỉ xét phần trả lời.

## Giai đoạn 1 — Benchmark gốc (168 lượt)

| Dự kiến | Hợp lệ | Thất bại | Bị loại | Ghi chú                                                                                                                    |
| ------- | ------ | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| 168     | 168    | 0        | 0       | Phần 1: 74 lượt (dừng theo yêu cầu lúc 06:00), đã xác minh rồi dùng lại. Phần 2: 94 lượt còn thiếu (`--skip`, file riêng). |

Mỗi tổ hợp có đúng một lượt hợp lệ; mã ảnh hưởng tới prompt và cách sinh không đổi giữa hai phần.
Lần chạy phần 2 đầu tiên bị bộ canh GPU dừng nhầm trước khi có kết quả nào (Windows gửi lại báo cáo
lỗi card cũ từ đêm 13/10); bộ canh đã sửa để chỉ tính tệp dump mới.

## Giai đoạn 2 — Prompt cải tiến (126 lượt trên 42 câu + 75 lượt held-out)

v1 (84 lượt: 2 cách sinh) chạy trên đúng 42 câu; ý chính đúng tăng nhưng **số câu có lỗi đã biết
tăng** (85,7 % → 76,2 % không lỗi). Đọc từng câu: câu lệnh "câu đầu: trả lời thẳng" làm mô hình mở
đầu bằng "Đúng!" cả khi câu hỏi dựa trên ý sai (P6) hoặc học sinh trả lời sai (P10, C10). v2 sửa đúng
chỗ đó (chỉ dẫn mở đầu theo loại lượt hỏi, `turnKind` trong `chatService.ts`), chạy lại 42 lượt.
Vì v2 được sửa **sau khi** xem kết quả, nó được kiểm chứng thêm trên 15 câu held-out do một tác nhân
khác viết mà không xem câu trả lời hay prompt nào.

### Kết quả trên 42 câu (thước chấm tự động theo mẫu chữ)

| Chỉ số                                | Cũ+cũ  | Cũ+mới | PR #20+cũ (f527f18) | PR #20+mới | v1+cũ  | v1+mới | **v2+mới** |
| ------------------------------------- | ------ | ------ | ------------------- | ---------- | ------ | ------ | ---------- |
| Ý chính đúng (trung bình)             | 31,3 % | 44,7 % | 30,0 %              | 33,0 %     | 27,4 % | 41,9 % | **47,7 %** |
| Câu đúng (đủ ý chính, không lỗi)      | 14,3 % | 28,6 % | 16,7 %              | 21,4 %     | 16,7 % | 31,0 % | **33,3 %** |
| Không có câu sai đã biết              | 85,7 % | 85,7 % | 85,7 %              | 85,7 %     | 85,7 % | 76,2 % | 81,0 %     |
| Nêu đúng đại lượng còn thiếu (9 câu)  | 11,1 % | 11,1 % | 33,3 %              | 22,2 %     | 0 %    | 33,3 % | 33,3 %     |
| Hỏi lại và không tự đặt số (9 câu)    | 0 %    | 0 %    | 0 %                 | 0 %        | 0 %    | 0 %    | 0 %        |
| Câu hỏi kiểm tra (khái niệm/hiểu lầm) | 0 %    | 0 %    | 43,8 %              | 25,0 %     | 6,3 %  | 18,8 % | 18,8 %     |
| Lẫn chữ nước ngoài                    | 50,0 % | 4,8 %  | 28,6 %              | 7,1 %      | 47,6 % | 9,5 %  | 7,1 %      |
| Thuật ngữ bị méo                      | 19,0 % | 0 %    | 19,0 %              | 0 %        | 26,2 % | 4,8 %  | 4,8 %      |
| Chữ đầu tiên (trung vị)               | 1,90 s | 1,58 s | 1,24 s              | 1,19 s     | 0,97 s | 0,73 s | 0,91 s     |
| Cả câu trả lời (trung bình)           | 12,2 s | 11,2 s | 9,7 s               | 9,1 s      | 13,0 s | 11,2 s | 12,0 s     |
| Độ dài câu trả lời (ký tự)            | 810    | 778    | 680                 | 612        | 1229   | 1053   | 1047       |

Kiểm định theo từng câu (dấu: ý chính; McNemar: câu đúng):

| So sánh (42 câu)                   | Ý chính   | Tốt hơn / kém hơn / hòa | p (dấu) | p (McNemar) |
| ---------------------------------- | --------- | ----------------------- | ------- | ----------- |
| Cách sinh mới vs cũ, prompt cũ     | +13,4     | 17 / 4 / 21             | 0,007   | 0,031       |
| Cách sinh mới vs cũ, prompt PR #20 | +3,1      | 11 / 6 / 25             | 0,33    | 0,63        |
| Prompt PR #20 vs cũ, cách sinh cũ  | −1,4      | 9 / 9 / 24              | 1,0     | 1,0         |
| **v2+mới vs PR #20+cũ (f527f18)**  | **+17,7** | 19 / 6 / 17             | 0,015   | 0,065       |
| v2+mới vs PR #20+mới               | +14,7     | 13 / 5 / 24             | 0,10    | 0,13        |
| v2+mới vs cũ+mới                   | +3,0      | 10 / 7 / 25             | 0,63    | 0,75        |
| v2+mới vs cũ+cũ (trước đợt audit)  | +16,3     | 18 / 5 / 19             | 0,011   | 0,021       |

### Held-out (15 câu mới, 75 lượt)

| Chỉ số                                 | Cũ+cũ  | Cũ+mới | PR #20+cũ (f527f18) | PR #20+mới | **v2+mới** |
| -------------------------------------- | ------ | ------ | ------------------- | ---------- | ---------- |
| Ý chính đúng                           | 16,7 % | 22,2 % | 16,7 %              | 31,1 %     | **44,4 %** |
| Không có câu sai đã biết               | 73,3 % | 53,3 % | 73,3 %              | 46,7 %     | **86,7 %** |
| Câu đúng                               | 0 %    | 0 %    | 0 %                 | 0 %        | 13,3 %     |
| Xử lý câu bẫy (3 câu)                  | 0 %    | 33,3 % | 33,3 %              | 0 %        | **66,7 %** |
| Phản hồi học sinh sai (3 câu), ý chính | 28 %   | 0 %    | 17 %                | 17 %       | **89 %**   |

v2 so với PR #20+cũ (f527f18): +27,8 điểm ý chính (9 câu tốt hơn, 1 kém hơn, p = 0,021). 15 câu là
mẫu nhỏ; xu hướng trùng với bộ 42 câu.

### Giám khảo AI (chấm mù, 42 câu × 7 nhóm × 2 giám khảo = 588 lượt chấm)

Thước chấm cố định trước khi chấm (`scripts/teaching/judge-rubric.md`): đúng 0–2, dễ hiểu 1–5, đầy đủ
1–5. Mỗi câu hỏi có 7 câu trả lời mang mã A–G, thứ tự trộn khác nhau cho mỗi giám khảo, không có tên
nhóm, prompt hay cách sinh; khóa giải mã để ở thư mục khác (`tests/teaching/results/judge-2026-10-14/`).

| Chỉ số (trung bình)     | Cũ+cũ | Cũ+mới | PR #20+cũ | PR #20+mới | v1+cũ | v1+mới | **v2+mới** |
| ----------------------- | ----- | ------ | --------- | ---------- | ----- | ------ | ---------- |
| Đúng (0–2)              | 0,12  | 0,30   | 0,15      | 0,18       | 0,10  | 0,35   | **0,39**   |
| Đúng hoàn toàn (điểm 2) | 0 %   | 10 %   | 0 %       | 2 %        | 0 %   | 2 %    | 2 %        |
| Dễ hiểu (1–5)           | 1,86  | 2,93   | 1,85      | 2,79       | 1,77  | 2,92   | **2,94**   |
| Đầy đủ (1–5)            | 1,20  | 1,49   | 1,36      | 1,37       | 1,29  | 1,90   | **1,96**   |
| Tự đặt số               | 60 %  | 46 %   | 54 %      | 40 %       | 51 %  | 51 %   | 43 %       |
| Đồng ý với điều sai     | 14 %  | 12 %   | 14 %      | 18 %       | 18 %  | 19 %   | 13 %       |
| Lỗi ngôn ngữ            | 86 %  | 18 %   | 90 %      | 25 %       | 99 %  | 36 %   | 31 %       |

v2+mới so với PR #20+cũ (f527f18), theo từng câu: đúng 14 tốt hơn / 3 kém hơn (p = 0,013); dễ hiểu
36 / 1 (p < 0,001); đầy đủ 20 / 4 (p = 0,002). So với "cũ+mới": chỉ hơn rõ ở độ đầy đủ (19 / 4,
p = 0,003). Hai giám khảo đồng ý 96 % về độ đúng (Cohen's kappa 0,87).

### Câu vẫn sai ở mọi nhóm

P4 (rơi tự do 20 m), P13 (quãng đường phanh), C1 (cân bằng H₂ + O₂), B2 (các kì nguyên phân), B3, B4.
Mô hình 1B vẫn yếu nhất ở bài tính số, các bước giải và câu bẫy; v2 đôi khi vẫn mở đầu "Đúng." (P6, B9).

## Kết luận

- Sửa cách sinh văn bản là thay đổi có ích nhất (giữ trong app): thuật ngữ bị méo giảm từ 19 % xuống
  0–4,8 % câu trả lời (chưa hết hẳn), câu trả lời dễ hiểu hơn hẳn, đúng ý hơn với prompt cũ.
- Lời nhắc của PR #20 (f527f18) không đúng hơn prompt cũ. Prompt v2 đúng hơn PR #20+cũ trên cả hai bộ
  câu; so với prompt cũ dùng cách sinh mới thì chỉ hơn rõ ở độ đầy đủ và ở câu bẫy / phản hồi học sinh
  (held-out).
- v2 trả lời dài hơn PR #20+cũ (≈ 1050 so với 680 ký tự) nên cả câu trả lời lâu hơn (12,0 so với
  9,7 s), dù chữ đầu tiên đến sớm hơn. Không dùng tốc độ làm bằng chứng chất lượng.
- Không nhóm nào biết **hỏi lại mà không tự đặt số** khi đề thiếu dữ kiện; app tự nhắc khi đề không có
  số nào (`missingData.ts`) và gắn nhãn "Số do AI tự đưa ra" (`provenance.ts`).

## Giới hạn

- Chấm tự động theo mẫu chữ và chấm bằng AI: không thay được giáo viên. Giám khảo AI cùng một dòng mô
  hình nên đồng ý cao chưa chứng minh là đúng; có thể thiên vị câu dài, trôi chảy dù đã giấu nhãn.
- Đáp án chuẩn của 30 câu gốc và cả bộ held-out do AI viết (AI thứ hai kiểm tra 30 câu gốc, sửa 7),
  chờ giáo viên (`docs/DATA_REVIEW.md` mục 16).
- Một lượt greedy cho mỗi tổ hợp; app thật dùng temperature 0,2. 42 + 15 câu là mẫu nhỏ.
- v2 được thiết kế sau khi xem kết quả v1 trên 42 câu; held-out là kiểm chứng độc lập duy nhất.
- Độ trễ chịu ảnh hưởng ứng dụng khác trên card: tải GPU trước mỗi lượt được ghi (0–51 %); phần 1
  benchmark gốc không ghi (lúc đó Wallpaper Engine và SimLab của người dùng đang dùng card). Các nhóm
  trong cùng lần chạy xen kẽ nhau; số giây chỉ nên so tương đối.
- Sau đợt đo, cách nhận biết "học sinh đang trả lời câu hỏi kiểm tra" (`turnKind`) được sửa theo hai
  vòng rà soát: nút nhanh, lời nhờ giúp, đề bài mới và câu hỏi không có dấu "?" không còn bị coi là
  câu trả lời (commit b18ceb7). Trong bộ đánh giá, 6 câu có lịch sử hội thoại vẫn được nhận là câu
  trả lời và các câu khác không có tin nhắn trước của thầy, nên số đo ở trên không đổi. Bản đo đã ghi
  mã băm `chatService.ts` của lúc đo, không phải của bản hiện tại.
