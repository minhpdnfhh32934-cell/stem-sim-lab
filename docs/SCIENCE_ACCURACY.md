# Độ chính xác khoa học — STEM Sim Lab

> Tài liệu này sẽ được nộp kèm hồ sơ dự thi. Mỗi giai đoạn sẽ bổ sung các mô hình mới.
> Trạng thái: đã có Giai đoạn 1 (bộ giải), 2 (Vật lý) và 3 (AI đọc đề).

## 1. Nguyên tắc

- Mọi con số đều do engine tất định tính ra. AI (LLM) chỉ trích xuất dữ kiện đề bài và diễn giải
  kết quả bằng lời.
- Mỗi mô phỏng có **Thẻ Khoa học** ghi rõ: mô hình, phương trình, giả định, phạm vi hợp lệ, mức
  tin cậy và nguồn.
- Có ba mức tin cậy:
  - **Định lượng chính xác** (xanh lá): khớp lời giải giải tích trong sai số ghi rõ.
  - **Định lượng gần đúng** (vàng): tích phân số, có ghi sai số ước lượng.
  - **Định tính / minh họa** (xanh dương): không dùng để đọc số liệu.
- Khi hệ quá tải, app ưu tiên giữ độ chính xác và giảm độ mượt trước. App không bao giờ âm thầm
  giảm độ chính xác.

## 2. Nguồn dữ liệu chuẩn

| Loại                  | Nguồn                                |
| --------------------- | ------------------------------------ |
| Hằng số vật lý        | CODATA (NIST), bản mới nhất          |
| Khối lượng nguyên tử  | IUPAC                                |
| Độ âm điện            | Thang Pauling                        |
| Bán kính cộng hóa trị | Cordero et al., _Dalton Trans._ 2008 |
| Màu nguyên tố         | CPK / Jmol                           |
| Cấu trúc 3D phân tử   | PubChem (public domain)              |
| Mã di truyền          | NCBI translation table 1             |

## 3. Bộ giải số và kiểm chứng (Giai đoạn 1)

Mọi bộ giải đều có test tự động (`src/core/**/*.test.ts`), so sánh với lời giải giải tích hoặc
với một phương pháp độc lập khác.

| Bộ giải                                  | Dùng cho                                                           | Kiểm chứng                                                                                                                                                                       | Dung sai            |
| ---------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| RK4 (bước cố định)                       | Hệ trơn, không cứng                                                | Dao động điều hòa x = cos ωt. Bậc hội tụ đo được ≈ 4 (tỉ số sai số 14–18 khi chia đôi bước)                                                                                      | 10⁻⁹                |
| Dormand–Prince 5(4), bước thích nghi     | Tính đáp số chính xác, bắt sự kiện (chạm đất, qua vị trí cân bằng) | Phân rã mũ; ném xiên (thời gian bay khớp công thức giải tích); **con lắc đơn phi tuyến**: chu kì đo bằng tích phân số khớp công thức tích phân elliptic T = 4√(L/g)·K(sin(θ₀/2)) | 10⁻⁹ – 10⁻¹¹        |
| Velocity Verlet (symplectic)             | Mô phỏng thời gian thực của hệ bảo toàn                            | Năng lượng dao động bị chặn (không trôi) sau 10 000 bước; chính xác tuyệt đối cho gia tốc không đổi                                                                              | 2·10⁻⁴ (năng lượng) |
| TR-BDF2 (ẩn, L-ổn định), bước thích nghi | Hệ cứng: động học hóa học, Hodgkin–Huxley                          | y′ = −1000(y − cos t) − sin t (nghiệm y = cos t); bài toán Robertson: bảo toàn khối lượng và khớp giá trị tham chiếu tại t = 40 (Hairer & Wanner, 1996)                          | 10⁻⁶                |
| Hàm đặc biệt K(k) (AGM)                  | Chu kì con lắc chính xác                                           | K(0) = π/2; K(1/√2) = Γ(1/4)²/(4√π)                                                                                                                                              | 10⁻¹³               |

### An toàn số học khi chạy thời gian thực

- **Bước cố định** Δt = 1/240 s cùng bộ tích lũy thời gian. Mỗi khung hình có ngân sách thời
  gian tính 8 ms (và giới hạn an toàn 512 bước con). Khi quá tải, app **chạy chậm lại** và
  hiển thị rõ tỉ lệ (ví dụ "×0,25"). App không tăng Δt nên độ chính xác không bị giảm.
- **NaN / vô cực:** nếu trạng thái có giá trị không hữu hạn, app dừng, khôi phục trạng thái hợp lệ
  gần nhất và báo lỗi.
- **Đại lượng bảo toàn:** engine báo năng lượng hoặc động lượng, và app theo dõi độ trôi tương đối
  so với lúc bắt đầu.
- **Can thiệp của người dùng:** khi người dùng kéo hoặc ném vật, app đánh dấu "Đã có can thiệp",
  nhãn "Định lượng chính xác" tự chuyển thành "Định lượng gần đúng", và app bỏ mốc năng lượng
  ban đầu.

## 4. Vật lý: mô hình từng chủ đề (Giai đoạn 2)

Mỗi chủ đề có ba lớp kiểm chứng. (1) Đáp số tính bằng công thức giải tích. (2) Kiểm chứng độc
lập bằng tích phân số Dormand–Prince, hoặc một cách tính khác. (3) Test tự động so sánh engine
thời gian thực với lời giải chính xác.

| Chủ đề                                | Engine (cách cập nhật)                                                                                             | Mức tin cậy                                             | Kiểm chứng tự động                                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chuyển động thẳng đều / biến đổi đều  | Công thức chính xác cho gia tốc không đổi. Thời điểm dừng khi hãm phanh được tìm đúng trong bước                   | Chính xác                                               | Hai xe gặp nhau (t = 4 s, x = 40 m); xe hãm phanh (dừng sau 10 s, đi được 100 m); v² − v₀² = 2as; so với DOPRI5                                                      |
| Rơi tự do, ném ngang, ném xiên        | Công thức chính xác. Thời điểm chạm đất giải đúng bằng phương trình bậc hai                                        | Chính xác                                               | h = 45 m, v₀ = 10 → t = 3 s, L = 30 m; ném từ mặt đất: 45° cho tầm xa lớn nhất; so với DOPRI5 ở sai số 10⁻⁹                                                          |
| Định luật Newton, mặt phẳng nghiêng   | Gia tốc không đổi từng đoạn. Chuyển từ ma sát nghỉ sang trượt được giải chính xác                                  | Chính xác                                               | a = g(sin θ − μ cos θ); vật đứng yên khi tan θ ≤ μₙ; vật trượt ngược lại trên dốc dốc; so với DOPRI5                                                                 |
| Ròng rọc – dây nối                    | Quy về một bậc tự do với ma sát Coulomb                                                                            | Chính xác                                               | Máy Atwood a = (m₂ − m₁)g/(m₁+m₂), T = 2m₁m₂g/(m₁+m₂); vật trên bàn; vật trên dốc; thời gian dịch chuyển so với DOPRI5                                               |
| Lò xo, con lắc lò xo                  | Dùng **nghiệm giải tích chính xác** để cập nhật, kể cả khi có lực cản (tắt dần dưới tới hạn, tới hạn, quá tới hạn) | Chính xác                                               | Cả 4 chế độ so với DOPRI5 (10⁻⁹); T = 2π√(m/k); cơ năng bảo toàn đến 10⁻¹²                                                                                           |
| Con lắc đơn                           | RK4 với 8 bước con mỗi Δt (h ≈ 0,52 ms). Mô hình góc nhỏ chạy song song bằng nghiệm chính xác                      | Chính xác khi không có lực cản; gần đúng khi có lực cản | Chu kì đo trong mô phỏng khớp công thức T = 4√(l/g)K(sin(α₀/2)); ở 60° sai lệch so với công thức góc nhỏ là 7,32 %; cơ năng trôi < 10⁻¹⁰                             |
| Bảo toàn cơ năng (vật trên đường ray) | RK4 với 8 bước con cho phương trình có ràng buộc                                                                   | Chính xác (tốc độ tính từ bảo toàn cơ năng)             | v(đáy) = √(2gH) so với DOPRI5; cơ năng trôi < 10⁻⁹ trong 20 s                                                                                                        |
| Va chạm 1D/2D                         | Chuyển động thẳng đều giữa hai va chạm. Thời điểm va chạm giải chính xác, xung lực tính theo hệ số phục hồi e      | Chính xác                                               | Hai vật cùng khối lượng va chạm đàn hồi thì trao đổi vận tốc; va chạm xiên hai vật cùng khối lượng thì hai hướng vuông góc; kết quả khớp cách tính trong hệ khối tâm |

**Kéo và ném bằng chuột:** app nối vật với con trỏ bằng một lò xo có giảm chấn tới hạn
(ω = 28 rad/s), nên vật không bị dịch chuyển tức thời. Khi thả chuột, vật giữ nguyên vận tốc lúc
đó. Ngay khi có can thiệp, Thẻ Khoa học chuyển sang mức **Định lượng gần đúng**, và lời giải giải
tích được ghi rõ là chỉ áp dụng cho điều kiện ban đầu.

**Sự kiện trong DOPRI5 (sửa lỗi ngày 2026-09-29):** khi vật xuất phát đúng tại mặt đất (y = 0) hoặc
khi hai sự kiện (đỉnh quỹ đạo và chạm đất) rơi vào cùng một bước tích phân dài, bộ bắt sự kiện cũ
có thể bỏ sót lần chạm đất. Nay mọi sự kiện trong một bước được xử lý theo thứ tự thời gian, và
trường hợp xuất phát trên mặt sự kiện được xét từ ngay sau thời điểm đầu. Có test hồi quy.

## 5. AI đọc đề (Giai đoạn 3)

AI chỉ làm hai việc: (a) **trích xuất** đề bài thành bảng dữ kiện (SceneSpec) và (b) **diễn giải
bằng lời** kết quả engine đã tính. Mọi bước kiểm tra dưới đây do code tất định thực hiện, không phụ
thuộc AI.

| Bước                          | Ai làm           | Quy tắc                                                                                                                                                                                                           |
| ----------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Phân loại chủ đề           | AI (JSON schema) | Chỉ được chọn trong danh sách chủ đề có sẵn, hoặc `unsupported`. Đề không hỗ trợ → báo rõ, không dựng mô phỏng.                                                                                                   |
| 2. Trích xuất dữ kiện         | AI (JSON schema) | Mỗi đại lượng phải kèm **trích dẫn nguyên văn** (quote) và đơn vị như đề viết. Tên đại lượng và đơn vị bị giới hạn bằng `enum` trong schema.                                                                      |
| 3. Kiểm tra định dạng         | Code (Zod)       | JSON sai → gửi lỗi lại cho AI sửa, **tối đa 2 lần**; vẫn sai → báo lỗi `invalidJson`.                                                                                                                             |
| 4. Số phải có trong đề        | Code             | Mỗi giá trị phải xuất hiện trong đề (hiểu dấu phẩy thập phân, "1.200", "3.10⁸"…). AI tự đổi đơn vị (72 km/h → 20 m/s) hay tự tính → **bị loại** và đại lượng chuyển thành "Cần nhập".                             |
| 5. Giá trị nói bằng lời       | Code             | Chỉ chấp nhận khi trích dẫn thật sự có trong đề **và** chứa cụm từ trong bảng cố định (ví dụ "thả nhẹ" → v₀ = 0; "không ma sát" → μ = 0; "va chạm mềm" → e = 0). Bảng này chờ duyệt.                              |
| 6. Đơn vị, phạm vi            | Code             | Đơn vị phải hợp thứ nguyên; ngoài phạm vi mô phỏng → cảnh báo.                                                                                                                                                    |
| 7. Giá trị mặc định           | Code             | Đại lượng đề không cho được điền bằng code và gắn nhãn **"mặc định"** (ví dụ g lấy theo Cài đặt). Đại lượng bắt buộc mà đề không cho → **"Cần nhập"**: không mô phỏng khi chưa nhập hoặc chưa bấm "Giữ mặc định". |
| 8. Bảng "Tôi hiểu đề như sau" | Người dùng       | Người dùng xem, sửa mọi giá trị trước khi mô phỏng. Giá trị sửa tay được gắn nhãn "đã chỉnh".                                                                                                                     |
| 9. Diễn giải bằng lời         | AI + Code        | Code liệt kê mọi con số AI viết ra; con số nào không trùng (sai lệch ≤ 1 %) với số engine tính, số trong lời giải hoặc số trong đề → **ẩn toàn bộ đoạn diễn giải** và báo cho người dùng.                         |

**Bộ đề chuẩn (golden set):** `tests/golden/physics.json` có 31 đề (29 đề mô phỏng được và 2 đề
ngoài phạm vi). Đáp số được tính **độc lập bằng Python** (`scripts/golden/make_physics_golden.py`),
rồi so với đáp số của engine ở sai số 10⁻⁶ (`npm test`). Để đo độ chính xác của một mô hình AI
thật: mở LM Studio, rồi chạy `npm run golden:llm` (báo cáo tỉ lệ chọn đúng chủ đề, trích đúng số
liệu, ra đúng đáp số).

**Kiểm thử đầu-cuối:** `npm run test:e2e` (Playwright) chạy app thật trong trình duyệt với LM
Studio giả lập. Các tình huống: đề → bảng xác nhận → mô phỏng → lời giải → diễn giải; AI bịa số bị
loại; diễn giải chứa số lạ bị ẩn; đề ngoài phạm vi; LM Studio chưa bật; chế độ Tự dựng cảnh không
gọi AI.
