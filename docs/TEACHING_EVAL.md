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
chỗ đó (chỉ dẫn mở đầu theo loại lượt hỏi, `turnKind` trong `turnKind.ts`), chạy lại 42 lượt.
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

## Thêm công cụ tính cho AI Teacher (10/11/2026, #136)

Ngoài bộ cân bằng phương trình, câu hỏi về khối lượng mol, cấu hình electron, đổi đơn vị, codon, mạch
ADN/mARN, phép lai Mendel, Hardy–Weinberg và hằng số vật lí giờ nhận kết quả do app tính
(`src/teacher/chat/lookupFacts.ts`). Vì khối này nằm trong prompt, đã đo 12 câu thuộc các dạng trên
bằng Gemma 4 E2B (card NVIDIA, greedy), cùng câu hỏi, trước và sau thay đổi:

| Bản              | Đúng mọi ý chính |
| ---------------- | ---------------- |
| Trước (`main`)   | 7/12             |
| Sau (có công cụ) | 12/12            |

Trước khi có công cụ, model nói sai chẳng hạn GCU mã hóa Glutamine (đúng là Alanine) và mạch bổ sung
TAGGCU (đúng là TACGGC). Bộ 42 câu và bộ held-out 15 câu không có câu nào kích hoạt công cụ mới, nên
prompt của chúng không đổi và số đo cũ vẫn giữ nguyên.

Giới hạn:

- 12 câu, một lượt greedy. Đáp án lấy từ chính các bộ máy này, nên số liệu chỉ cho thấy model chép
  đúng kết quả được đưa, không kiểm chứng bản thân bộ máy.
- Bản đo dựa trên `main`, nơi câu trả lời thô còn lặp lại prompt; điểm trong bảng tính riêng phần
  sau lượt của model, không tính phần lặp. Điểm ghi sẵn trong tệp kết quả tính trên cả câu thô.
- Bộ câu và kết quả: `tests/teaching/results/2026-11-10-tools-set.json`,
  `2026-11-10-gemma4-e2b-tools-before.json`, `2026-11-10-gemma4-e2b-tools-after.json`.

## Đợt 09/11/2026: Qwen 3.5 9B và bản huấn luyện riêng

Cùng 42 + 15 câu, cùng prompt của app, temperature 0, một lượt. Qwen và Gemma 3 12B chạy trên
`llama-server` (bản Q4_K_M, `scripts/teaching/eval-local.mjs`); Gemma 4 E2B chạy trong app bằng WebGPU
(đo sáng cùng ngày). Bản huấn luyện: LoRA trên Qwen 3.5 9B, 628 hội thoại, ba vòng trên Colab (T4).
Sai số trên 98 hội thoại kiểm tra: gốc 0,7328; vòng 1 0,4390; vòng 2 0,4151; vòng 3 0,4344 (không lưu).
Kết quả đã lưu: `tests/teaching/results/2026-11-09-*.json`.

| 42 câu của bộ chính | Câu đúng đủ ý | Tỉ lệ ý chính | Không lỗi đã biết |
| ------------------- | ------------- | ------------- | ----------------- |
| Gemma 4 E2B         | 66,7 %        | 76,9 %        | 100 %             |
| Gemma 3 12B gốc     | 66,7 %        | 83,7 %        | 97,6 %            |
| Qwen 3.5 9B gốc     | 81,0 %        | 92,0 %        | 95,2 %            |
| Qwen, vòng 1        | 90,5 %        | 97,4 %        | 97,6 %            |
| Qwen, vòng 2        | 78,6 %        | 91,8 %        | 95,2 %            |

| 15 câu kiểm chứng | Câu đúng đủ ý | Tỉ lệ ý chính | Không lỗi đã biết |
| ----------------- | ------------- | ------------- | ----------------- |
| Gemma 4 E2B       | 60,0 %        | 82,2 %        | 93,3 %            |
| Gemma 3 12B gốc   | 60,0 %        | 84,4 %        | 100 %             |
| Qwen 3.5 9B gốc   | 86,7 %        | 96,7 %        | 93,3 %            |
| Qwen, vòng 1      | 100 %         | 100 %         | 100 %             |

Trên bộ chính, vòng 1 hỏi lại khi đề thiếu dữ kiện 66,7 % (gốc 11,1 %), nêu các bước đúng thứ tự
100 % (gốc 44,4 %), nhưng nêu đúng dữ kiện còn thiếu 88,9 % (gốc 100 %). Vòng 1 được chọn bằng bộ
chính; chỉ riêng nó chạy một lần trên bộ kiểm chứng.

Giới hạn của đợt này:

- Vòng 1 hơn Qwen gốc 2 câu và không kém câu nào trên bộ kiểm chứng (McNemar p = 0,5), 6 câu hơn và
  2 câu kém trên bộ chính. Mẫu nhỏ: chưa đủ để nói thắng rõ.
- Chấm theo từ khóa, chưa có giáo viên hay giám khảo AI chấm mù.
- Trong đợt này bộ chấm được sửa để đọc LaTeX (commit 08ebd0b), sau khi đã xem kết quả, vì câu đúng
  viết bằng công thức bị tính là thiếu ý. Đáp án không đổi, mọi nhóm được chấm lại như nhau.
- Dữ liệu huấn luyện do chính Qwen 3.5 9B viết và chưa được giáo viên duyệt.
- E2B và Qwen chạy trên hai đường khác nhau, nên thời gian trả lời chỉ để tham khảo.

## Đợt 10/11/2026: huấn luyện lại trên RTX 4080 và chấm mù

Cùng bộ câu và cách đo với đợt 09/11, trên máy bàn (RTX 4080, `llama-server` CUDA backend 2.71.0 của
LM Studio, bản Q4_K_M, temperature 0). export-1 là 628 hội thoại cũ. export-2 thêm 400 hội thoại do
Qwen 3.5 9B viết bằng đúng quy trình cũ (960 huấn luyện, 160 kiểm tra), vẫn `review_status: "pending"`.
Kết quả đã lưu: `tests/teaching/results/2026-11-10-*.json` và `tests/teaching/results/judge-2026-11-10/`.

| 42 câu của bộ chính         | Câu đúng đủ ý | Tỉ lệ ý chính | Không lỗi đã biết |
| --------------------------- | ------------- | ------------- | ----------------- |
| Qwen 3.5 9B gốc             | 78,6 %        | 91,8 %        | 97,6 %            |
| lora-e1 cũ (Colab, 09/11)   | 88,1 %        | 96,8 %        | 97,6 %            |
| export1-e1 (huấn luyện lại) | 90,5 %        | 96,2 %        | 100 %             |
| export1-e2                  | 83,3 %        | 93,3 %        | 97,6 %            |
| export2-e1 (thêm dữ liệu)   | 85,7 %        | 93,5 %        | 97,6 %            |
| export2-e2                  | 78,6 %        | 89,3 %        | 97,6 %            |

Không bản nào hơn Qwen gốc có ý nghĩa thống kê (McNemar p: 0,344; 0,180; 0,774; 0,508; 1,000). Máy bàn
lệch laptop 1 câu ở cả hai mốc đối chứng (gốc 33 so với 34 câu, lora-e1 37 so với 38 câu), và chỉ 10/42
câu trả lời của bản gốc giống hệt laptop; nguyên nhân chưa xác định.

Theo quy tắc chọn định trước (nhiều câu đúng nhất), export1-e1 được chọn và chạy đúng một lần trên bộ
kiểm chứng: **13/15** (86,7 %), tỉ lệ ý chính 94,4 %, không lỗi đã biết 100 %. Số đã lưu từ đợt 09/11 trên
laptop: Qwen gốc 13/15, lora-e1 cũ 15/15. Quy tắc được ghi sau khi đã có 6 lần đo bộ chính, do một phiên
chưa thấy các số đó viết.

Hai điều rút ra:

- Huấn luyện lại cùng dữ liệu và cùng cách cho 13/15 thay vì 15/15, nên kết quả 15/15 của đợt trước
  không ổn định.
- Thêm dữ liệu do chính Qwen viết không làm tăng điểm: export2-e1 36 câu so với export1-e1 38 câu,
  export2-e2 33 câu so với export1-e2 35 câu.

Giám khảo AI chấm mù Qwen gốc và export1-e1 (42 câu, 2 giám khảo, nhãn ẩn, thứ tự xáo riêng cho từng
giám khảo). Thước là `judge-rubric.md` cộng thêm tiêu chí "Cách dạy", lưu ở thư mục kết quả (SHA-256
`6c9441fd3befc152840026fe4037ae831cd1b9cce0705335033e900c0421b77a`); thước gốc không đổi.

| Tiêu chí              | Qwen gốc | export1-e1 |
| --------------------- | -------- | ---------- |
| Độ đúng (0–2)         | 1,81     | 1,93       |
| Đúng hoàn toàn        | 86 %     | 95 %       |
| Độ rõ (1–5)           | 4,45     | 4,82       |
| Độ đủ ý (1–5)         | 4,12     | 4,13       |
| Cách dạy (1–5)        | 3,60     | 3,86       |
| Có số tự đưa ra       | 14 %     | 10 %       |
| Đồng tình với lỗi sai | 0 %      | 2 %        |

Về Cách dạy, export1-e1 hơn ở 18 câu, kém ở 9 câu, bằng ở 15 câu (kiểm định dấu p = 0,12). Hai giám khảo
đồng ý 100 % về độ đúng (kappa 1,00) và 88 % về Cách dạy. Đây là AI chấm, không thay giáo viên; hai giám
khảo cùng một loại model nên mức đồng ý cao không có nghĩa là chấm đúng. Chưa kết luận dùng model nào.

**Bổ sung ngày 10/11: thước từ khóa đã bỏ sót một lỗi ở câu B10.** Khi chấm mù, export1-e1 trả lời B10
"Đáp án đúng là mỗi tế bào con có 23 nhiễm sắc thể … đơn bội (n = 23)", tức là đồng tình với lỗi của
người học. Thước từ khóa vẫn ghi câu này là "không lỗi đã biết", vì mẫu `mustNot` của B10 chỉ bắt câu
mở đầu bằng "Đúng". Ngày 10/11 đã thêm mẫu thứ hai cho B10 (`tests/teaching/teaching-eval.json`, test
trong `tests/teaching-rubric.test.ts`). Bảng trên giữ nguyên số lúc đo. Chấm lại mọi kết quả đã lưu bằng
`rescore.mjs --changes` (không sửa tệp kết quả nào): chỉ câu B10 đổi, ở 3 tệp:

- export1-e1 (10/11): câu đúng đủ ý không đổi (38/42, 90,5 %); không lỗi đã biết 100 % → 97,6 %.
- lora-e1 cũ (10/11): B10 từ đúng thành sai, 37 → 36 câu (88,1 % → 85,7 %); không lỗi đã biết
  97,6 % → 95,2 %. Câu này mở đầu "Chưa đúng" nhưng sau đó nói mỗi tế bào con có bộ "đơn bội n = 23",
  nên tính là lỗi mới đúng. McNemar so với Qwen gốc (`compare.mjs`): p = 0,344 → 0,549.
- Gemma 3 1B improved-v2 (14/10): không lỗi đã biết 81,0 % → 78,6 %.

Hai câu followup còn lại của bộ chính, P10 (gia tốc) và C10 (nguyên tử oxi), có cùng lỗ hổng: mẫu cũ chỉ
bắt câu mở đầu bằng "Đúng". Cũng ngày 10/11 đã thêm mẫu thứ hai cho mỗi câu, cùng cách như B10, có test.
Chấm lại mọi kết quả đã lưu (so bộ câu trước và sau khi thêm mẫu): chỉ 5 câu trả lời đổi.

- P10, Gemma 3 1B improved-v2 (14/10): từ đúng thành sai. Câu này mở đầu "Chưa đúng" nhưng sau đó
  ghi "**Đáp án:** Gia tốc tăng gấp đôi". Câu đúng 33,3 % → 31,0 %, không lỗi đã biết 78,6 % → 76,2 %.
- C10, Gemma 3 1B baseline-greedy-part2 (14/10): 2 câu (hai biến thể) thành có lỗi đã biết.
- C10, Qwen 3.5 9B e2 (09/11): không lỗi đã biết 95,2 % → 92,9 %; câu đúng không đổi.
- C10, export2-e2 (10/11): không lỗi đã biết 97,6 % → 95,2 % (bảng trên ghi 97,6 %, số lúc đo);
  câu đúng không đổi.

Ở C10, số câu đúng không đổi trong mọi tệp (các câu này đã sai ở ý chính). Thước từ khóa bây giờ bắt
được kiểu nhắc lại đáp án sai của người học như đáp án ở cả 3 câu followup của bộ chính, nhưng vẫn chỉ
bắt các kiểu câu đã biết.

Con số "không lỗi đã biết" chỉ đếm các lỗi mà thước biết tìm: nó không có nghĩa là model không bao
giờ đồng tình với lỗi sai của người học. Bộ kiểm chứng (`teaching-heldout.json`) không đổi: sửa nó sau
khi đã xem kết quả là tinh chỉnh theo chính bộ đó.

## Đo Gemma 4 E2B (09/11/2026)

Cùng 42 câu và 15 câu held-out, cùng thước chấm tự động, prompt v2, cách sinh của app, greedy. Đo
bằng bản 122183e trên RTX 5060 Laptop, không lượt nào lỗi. Dữ liệu thô:
`tests/teaching/results/2026-11-09-gemma4-e2b-*.json`. Cột 1B lấy từ các tệp đo ngày 14/10, bản
build khác, nên chỉ so tương đối.

| Chỉ số                  | E2B, 42 câu | 1B, 42 câu | E2B, held-out | 1B, held-out |
| ----------------------- | ----------- | ---------- | ------------- | ------------ |
| Câu đúng đủ ý chính     | 25          | 14         | 8 / 15        | 2 / 15       |
| Tỉ lệ ý chính nêu được  | 72 %        | 48 %       | 79 %          | 44 %         |
| Câu mắc lỗi đã biết     | 0           | 8          | 1             | 2            |
| Câu có số tự đặt ra     | 1           | 7          | 0             | 0            |
| Câu bị méo chữ          | 0           | 2          | 0             | 0            |
| Câu lẫn chữ nước ngoài  | 0           | 3          | 0             | 1            |
| Giây trung bình mỗi câu | 12,1        | 12,0       | 10,3          | 6,1          |

Theo loại câu trên bộ 42 câu (E2B so với 1B): khái niệm 8/11 và 4/11, ngộ nhận 5/5 và 0/5, thiếu dữ
kiện 7/9 và 6/9, hỏi tiếp 3/3 và 1/3, câu bẫy 1/3 và 0/3, bài toán 1/5 và 2/5, nêu từng bước 0/3 và
0/3, cần công cụ 0/3 và 1/3.

E2B hơn 1B rõ ở khái niệm và ngộ nhận, gần như không còn lỗi đã biết. Nó vẫn yếu ở bài toán, nêu
từng bước và câu cần công cụ: 1/11 câu đúng đủ ý chính.

Giới hạn: chưa chấm mù bằng AI, chưa có giáo viên chấm; đáp án chuẩn vẫn chờ giáo viên; một lượt
greedy cho mỗi câu, trong khi app thật dùng temperature 0,2; đợt này không chạy bộ canh VRAM và nhiệt
độ của đợt 14/10 (cao nhất ghi nhận lúc xem: 5,0 GB, 61 °C).
