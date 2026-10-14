# Đánh giá AI Teacher trên Gemma (14/10/2026)

Bản ghi các lần đo chất lượng giải thích của Gemma chạy trên máy (Transformers.js + WebGPU) qua
đúng mã của app. Mọi con số là số đo thật; dữ liệu thô nằm trong `tests/teaching/results/` và tính
lại được bằng `scripts/teaching/compare.mjs` và `scripts/teaching/breakdown.mjs` (không cần GPU).

## Giai đoạn 1 — Benchmark gốc (168 lượt)

### Thiết lập

| Mục          | Giá trị                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| Mô hình      | `gemma3-1b` (onnx-community, q4, revision ghim trong `src/ai/webGemmaModels.ts`)                      |
| Phần cứng    | NVIDIA GeForce RTX 5060 Laptop (WebGPU báo "nvidia blackwell"), kiểm tra lại sau mỗi lượt             |
| Trình chạy   | Microsoft Edge headless, `--force_high_performance_gpu`, dev server cổng 1430                         |
| Sinh văn bản | greedy (temperature 0), tối đa 1024 token, 1 lượt cho mỗi tổ hợp                                      |
| Bộ câu       | 42 câu (`tests/teaching/teaching-eval.json`): 30 câu gốc + 12 câu mới (thiếu dữ kiện, từng bước, bẫy) |
| Mã nguồn     | prompt và cách sinh như commit `f475e2d` (không đổi trong suốt hai phần chạy)                         |

Bốn điều kiện (2 prompt × 2 cách sinh):

- **Prompt cũ** (`legacy`): prompt của `main` trước đợt audit (c25ad9d) + tối đa 4 ghi chú thư viện
  × 1500 ký tự.
- **Prompt 0.6.0** (`current`): `contextPrompt(…, 'compact')` của bản 0.6.0 (2 ghi chú × 700 ký tự,
  khối "KẾT QUẢ DO SIMLAB TÍNH" khi có phương trình hóa học).
- **Cách sinh cũ** (`legacy`): `repetition_penalty 1.2` + `no_repeat_ngram_size 3` áp lên **cả câu
  hỏi lẫn câu trả lời** (bản 0.6.0 đang dùng).
- **Cách sinh mới** (`app`): chỉ xét phần trả lời (không lặp cụm 10 token, phạt nhẹ 1.1 trong 64
  token gần nhất).

### Số lượt

| Dự kiến | Hợp lệ | Thất bại | Bị loại | Ghi chú                                                                                                                                                      |
| ------- | ------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 168     | 168    | 0        | 0       | Phần 1: 74 lượt (dừng theo yêu cầu lúc 06:00), xác minh đủ trường, cấu hình, card rồi dùng lại. Phần 2: 94 lượt còn thiếu (`--skip` phần 1, lưu file riêng). |

Mỗi tổ hợp (câu × prompt × cách sinh) có đúng một lượt hợp lệ, không trùng, không thiếu. Câu C5 bị
chia ở hai phần nhưng prompt hệ thống giống hệt nhau. Lần chạy phần 2 đầu tiên bị bộ canh GPU dừng
nhầm trước khi có kết quả nào: Windows gửi lại 12 báo cáo lỗi card **cũ** (đêm 13/10 và trước đó),
không có lỗi mới; bộ canh đã sửa để chỉ tính báo cáo có tệp dump mới.

### Kết quả (chấm bằng `scripts/teaching/rubric.mjs`, tự động, theo mẫu chữ)

| Chỉ số                               | Cũ + sinh cũ  | Cũ + sinh mới | 0.6.0 + sinh cũ | 0.6.0 + sinh mới |
| ------------------------------------ | ------------- | ------------- | --------------- | ---------------- |
| Ý chính đúng (trung bình)            | 31,3 %        | **45,5 %**    | 30,0 %          | 33,0 %           |
| Không có câu sai đã biết             | 85,7 %        | 85,7 %        | 85,7 %          | 85,7 %           |
| Câu cuối là câu hỏi kiểm tra         | 3,3 %         | 3,3 %         | 40,0 %          | 26,7 %           |
| Hỏi lại khi thiếu dữ kiện (9 câu)    | 0 %           | 0 %           | 0 %             | 0 %              |
| Nêu đúng đại lượng còn thiếu (9 câu) | 11,1 %        | 11,1 %        | 33,3 %          | 22,2 %           |
| Bước giải đúng thứ tự (3 câu)        | 0 %           | 11,1 %        | 0 %             | 11,1 %           |
| Xử lý câu bẫy (3 câu)                | 0 %           | 0 %           | 0 %             | 0 %              |
| Câu trả lời lẫn chữ nước ngoài       | 50,0 %        | 4,8 %         | 28,6 %          | 7,1 %            |
| Câu trả lời có thuật ngữ bị méo      | 21,4 %        | 0 %           | 19,0 %          | 0 %              |
| Chữ đầu tiên (trung vị / trung bình) | 1,90 / 2,56 s | 1,58 / 1,70 s | 1,24 / 1,26 s   | 1,19 / 1,25 s    |
| Cả câu trả lời (trung bình)          | 12,2 s        | 11,2 s        | 9,7 s           | 9,1 s            |
| Độ dài câu trả lời (ký tự)           | 810           | 778           | 680             | 612              |

"Hỏi lại khi thiếu dữ kiện" cần **cả** câu hỏi xin dữ kiện **và** không tự đặt số: mô hình 1B luôn tự
đặt số, nên 0 % ở mọi nhóm; "nêu đúng đại lượng còn thiếu" là tiêu chí lỏng hơn.

Kiểm định theo cặp (cùng câu hỏi; dấu = so từng câu, McNemar = so từng ý chính):

| So sánh                           | Chênh lệch ý chính | Câu tốt hơn / kém hơn / hòa | p (dấu) | p (McNemar) |
| --------------------------------- | ------------------ | --------------------------- | ------- | ----------- |
| Cách sinh mới vs cũ, prompt cũ    | **+14,2 điểm**     | 17 / 3 / 22                 | 0,003   | 0,005       |
| Cách sinh mới vs cũ, prompt 0.6.0 | +3,1 điểm          | 11 / 6 / 25                 | 0,33    | 0,66        |
| Prompt 0.6.0 vs cũ, cách sinh cũ  | −1,4 điểm          | 9 / 9 / 24                  | 1,0     | 0,54        |
| Prompt 0.6.0 vs cũ, cách sinh mới | −12,5 điểm         | 6 / 13 / 23                 | 0,17    | 0,09        |

Theo loại câu (ý chính đúng, trung bình): khái niệm 23–52 %, thiếu dữ kiện 56–83 % (ý chính ở đây là
nêu đúng chỗ thiếu), bài tính 20–40 %, từng bước 0–15 %, phản hồi học sinh 0–33 %, cân bằng phương
trình 0–17 %. Theo môn: Vật lý 34–57 %, Hóa học 27–43 %, Sinh học 27–36 % (chi tiết:
`node scripts/teaching/breakdown.mjs tests/teaching/results/2026-10-14-*.json`).

**Câu không nhóm nào có ý chính đúng (9):** P4 (rơi tự do 20 m), P8 (lực đàn hồi), P13 (quãng đường
phanh), C1 và C9 (cân bằng phương trình), B2 (các kì nguyên phân), B3, B4, B10. Ở câu phản hồi học sinh
(P10, C10, B10) mô hình thường khen câu trả lời sai.

### Kết luận giai đoạn 1

- **Cách sinh văn bản là nguyên nhân chính** làm câu trả lời kém: bản cũ cấm mô hình chép lại cụm từ
  của chính câu hỏi. Sửa nó tăng ý chính đúng rõ rệt với prompt cũ (+14,2 điểm, p = 0,003) và gần
  như xóa lỗi méo chữ / lẫn chữ nước ngoài ở cả hai prompt.
- **Prompt 0.6.0 không làm câu trả lời đúng hơn** prompt cũ (−1,4 và −12,5 điểm, đều chưa đủ ý
  nghĩa thống kê), dù nó làm câu trả lời ngắn hơn, nhanh hơn và hay kết thúc bằng câu hỏi kiểm tra
  hơn. Prompt cũ đưa nhiều ghi chú hơn (4 × 1500 so với 2 × 700 ký tự); với cách sinh mới, mô hình
  chép được ý đúng từ ghi chú nên nhiều ghi chú hơn có lợi.
- Mô hình 1B vẫn yếu ở bài tính số, phương trình hóa học, câu bẫy và phản hồi học sinh ở mọi nhóm.

### Giới hạn của phép so sánh

- Chấm tự động theo mẫu chữ: đúng một từ khóa trong câu sai vẫn được điểm và ngược lại; chưa có giáo
  viên chấm. Đáp án chuẩn của 30 câu gốc do AI viết, AI thứ hai kiểm tra (sửa 7 câu), chờ giáo viên.
- Một lượt greedy cho mỗi tổ hợp: không có dao động do lấy mẫu, nhưng 42 câu là mẫu nhỏ (khoảng tin
  cậy rộng). App thật dùng temperature 0,2.
- Độ trễ chịu ảnh hưởng của ứng dụng khác trên cùng card: phần 2 ghi tải GPU trước mỗi lượt (23–51 %,
  1,3–1,9 GB); phần 1 không ghi (lúc đó ứng dụng SimLab của người dùng đang dùng card). Các nhóm
  chạy xen kẽ nên ảnh hưởng chia đều, nhưng số giây chỉ nên so tương đối.
- Câu cân bằng phương trình: prompt cũ không có khối "KẾT QUẢ DO SIMLAB TÍNH" (đúng như bản cũ).
- Độ dễ hiểu và độ đầy đủ được chấm bằng AI cùng lúc với phiên bản cải tiến (giai đoạn 2), để mọi
  nhóm được chấm mù trong cùng một lượt.
