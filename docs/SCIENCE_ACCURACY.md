# Độ chính xác khoa học — STEM Sim Lab

> Tài liệu này sẽ được nộp kèm hồ sơ dự thi. Mỗi giai đoạn sẽ bổ sung các mô hình mới.
> Trạng thái: đã có Giai đoạn 1 (bộ giải), 2 (Vật lý), 3 (AI đọc đề) và 4 (Hóa học).

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

## 6. Hóa học (Giai đoạn 4)

### Dữ liệu

| Dữ liệu                                                                                                                       | Nguồn                                                                                                                                 | Tạo bằng                        | Trạng thái |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------- |
| 118 nguyên tố: nguyên tử khối, độ âm điện Pauling, bán kính cộng hóa trị, năng lượng ion hóa, cấu hình electron, màu CPK/Jmol | IUPAC/CIAAW, Pauling, Cordero et al. 2008, NIST ASD (qua thư viện `mendeleev` 1.3.0)                                                  | `scripts/data/gen_elements.py`  | chờ duyệt  |
| 63 phân tử (tọa độ 3D)                                                                                                        | RDKit ETKDG + MMFF94; hình học thực nghiệm (NIST CCCBDB) cho 14 phân tử vô cơ nhỏ; hình học VSEPR lý tưởng cho 7 phân tử siêu hóa trị | `scripts/data/gen_molecules.py` | chờ duyệt  |
| 39 phản ứng, 10 cơ chế                                                                                                        | SGK Hóa 10–12 (GDPT 2018); Clayden, _Organic Chemistry_ (2nd ed.)                                                                     | `scripts/data/gen_reactions.py` | chờ duyệt  |

PubChem không truy cập được từ môi trường xây dựng, nên cấu trúc 3D được sinh bằng RDKit (ghi rõ
phương pháp cho từng phân tử trong app và trong Thẻ Khoa học).

### Kiểm chứng tự động

| Nội dung                      | Kiểm tra                                                                                                                                                                           | Kết quả              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Cấu hình electron             | Lấy từ bảng dữ liệu; test xác nhận Cr, Cu, Mo, Ag, Au, Pd là ngoại lệ Aufbau và Fe, Zn… không phải; tổng electron = Z cho cả 118 nguyên tố                                         | đạt                  |
| Nguyên tử hydro               | ∫R²r²dr = 1; ⟨r⟩ = (3n² − l(l+1))a₀/2; số nút xuyên tâm n − l − 1; hàm điều hòa cầu thực trực chuẩn; Hα = 656,47 nm (chân không, khối lượng rút gọn)                               | đạt                  |
| Hình học phân tử (trường lực) | So với thực nghiệm: độ dài liên kết lệch < 0,03 Å, góc lệch < 3° (H₂O, NH₃, CH₄, C₂H₄, C₂H₂, C₆H₆, HCN, C₂H₆)                                                                      | đạt                  |
| VSEPR                         | 16 phân tử/ion: nhãn AXₙEₘ và hình dạng đúng (CO₂, BF₃, SO₂, CH₄, NH₃, H₂O, PCl₅, SF₄, ClF₃, XeF₂, SF₆, XeF₄, NH₄⁺, NO₃⁻, O₃, SO₄²⁻)                                               | đạt                  |
| Độ phân cực                   | Tổng vectơ momen liên kết (∝ Δχ) + điện tích hình thức trung bình theo cộng hưởng; 27 phân tử khớp SGK. Hạn chế đã biết: PH₃ (Δχ ≈ 0 nhưng thực tế phân cực nhẹ)                   | đạt (có ghi hạn chế) |
| Công thức phân tử             | Công thức viết kiểu SGK của mỗi phân tử có cùng số nguyên tử và điện tích với công thức Hill                                                                                       | đạt                  |
| Thư viện phản ứng             | Mọi phương trình bảo toàn nguyên tố và điện tích; bộ cân bằng tìm lại đúng hệ số (trừ phản ứng tráng bạc: có nhiều cách cân bằng độc lập, app báo rõ)                              | đạt                  |
| Cơ chế                        | Mọi khung của một cơ chế có cùng tập nguyên tử (atom mapping) và cùng tổng điện tích; SN2: C–Br đứt, C–O tạo; ester hóa: O của nước đến từ nhóm OH của axit (kết quả đánh dấu ¹⁸O) | đạt                  |
| Cân bằng phương trình         | Không gian nghiệm tính bằng số hữu tỉ chính xác (BigInt); báo "không thể cân bằng" hoặc "vô số cách cân bằng" thay vì đoán                                                         | đạt                  |
| Khí 2D (Maxwell–Boltzmann)    | Va chạm đàn hồi: năng lượng bảo toàn đến 10⁻⁹; tốc độ trung bình khớp √(πkT/2m) trong 2 %; histogram lệch lý thuyết 2D < 5 %                                                       | đạt                  |
| Thuyết va chạm                | Tỉ lệ va chạm đủ năng lượng khớp e^(−Eₐ/k_BT) trong ±0,03 (Eₐ = 0,5 và 1,5 k_BT)                                                                                                   | đạt                  |
| Cân bằng hóa học              | A ⇌ B khớp nghiệm giải tích; A + B ⇌ C khớp nghiệm phương trình bậc hai; Q = K khi cân bằng; định luật van ’t Hoff; 2A ⇌ B bảo toàn khối lượng                                     | đạt                  |

### Nguyên tắc hiển thị

- Cơ chế chỉ có cho phản ứng trong thư viện. Phản ứng khác: chỉ kiểm tra cân bằng, kèm câu
  "Phản ứng này chưa có trong cơ sở dữ liệu đã kiểm chứng — không hiển thị cơ chế".
- Chuyển động giữa các khung cơ chế là nội suy, luôn gắn nhãn "Chuyển tiếp minh họa — không phải
  quỹ đạo nguyên tử thực". Trạng thái chuyển tiếp là hình minh họa (không tính bằng hóa lượng tử).
- SMILES không có trong thư viện: RDKit kiểm tra hóa trị và vẽ 2D; không dựng 3D.
- Phân bố Maxwell–Boltzmann trong app là của khí **hai chiều**; công thức 3D của SGK chỉ hiển thị
  để so sánh.

## 7. Sinh học (Giai đoạn 5)

### Dữ liệu

| Dữ liệu                             | Nguồn                                                  | Tạo bằng                           | Trạng thái |
| ----------------------------------- | ------------------------------------------------------ | ---------------------------------- | ---------- |
| Bảng mã di truyền chuẩn (64 bộ ba)  | NCBI Genetic Code, bảng số 1 (qua Biopython 1.88)      | `scripts/data/gen_genetic_code.py` | chờ duyệt  |
| Bảng số lượng NST ở các kì phân bào | Không nhập tay: **đếm** từ mô hình NST (`division.ts`) | code + test so với bảng SGK        | chờ duyệt  |

Mọi chủ đề sinh học khác dùng **công thức** (không có bảng số liệu nhập tay), nên độ tin cậy do
test tự động bảo đảm.

### Kiểm chứng tự động

| Chủ đề                         | Kiểm tra                                                                                                                                                         | Kết quả |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Nguyên phân / giảm phân        | Với 2n = 4, 8, 46: số NST, trạng thái đơn/kép, cromatit, tâm động, phân tử ADN ở mọi kì khớp bảng SGK; 1 → 2 tế bào (nguyên phân), 1 → 2 → 4 (giảm phân)         | đạt     |
| Phân li độc lập, trao đổi chéo | Mỗi giao tử có đúng 1 NST của mỗi cặp; không trao đổi chéo: 2ⁿ loại giao tử qua mọi cách sắp xếp; có trao đổi chéo (n = 1): 4 loại giao tử khác nhau             | đạt     |
| ADN → mARN → protein           | 64 bộ ba (61 mã hóa, 3 kết thúc, AUG = Met); mạch bổ sung, mạch gốc → mARN; dịch mã từ AUG đầu tiên tới bộ ba kết thúc                                           | đạt     |
| Đột biến điểm                  | Im lặng (GGC → GGA), sai nghĩa (TTT → TCT), vô nghĩa (AAA → TAA), dịch khung (thêm/mất 1 nu), mất trọn bộ ba, mất bộ ba mở đầu                                   | đạt     |
| Di truyền Mendel               | 3 : 1, 1 : 2 : 1, 1 : 1, 9 : 3 : 3 : 1, trội không hoàn toàn 1 : 2 : 1; Monte Carlo khớp lí thuyết (χ²); χ² tới hạn 3,841 / 5,991 / 7,815 ở α = 0,05             | đạt     |
| Hardy–Weinberg                 | p² + 2pq + q² = 1; kiểm định χ² với df = 1; một thế hệ ngẫu phối đưa về tỉ lệ cân bằng                                                                           | đạt     |
| Phiêu bạt di truyền            | Wright–Fisher, 3000 lần chạy: tỉ lệ cố định ≈ p₀ (±0,03); dị hợp trung bình giảm theo (1 − 1/2N)ᵗ                                                                | đạt     |
| Tăng trưởng logistic           | Nghiệm chính xác khớp DOPRI5; tiến tới K; điểm uốn tại N = K/2                                                                                                   | đạt     |
| Lotka–Volterra                 | Đại lượng bảo toàn V lệch < 10⁻⁷ (DOPRI5, rtol 10⁻¹⁰); điểm cân bằng đứng yên; chu kì dao động nhỏ ≈ 2π/√(αγ). App hiển thị sai lệch của V để người dùng tự kiểm | đạt     |
| Động học enzyme                | v = Vmax/2 tại [S] = Km; Km, Vmax biểu kiến của 3 kiểu ức chế; [S](t) chính xác (hàm Lambert W) khớp DOPRI5 (app cũng hiển thị sai lệch)                         | đạt     |
| Khuếch tán (Fick hai ngăn)     | Bảo toàn lượng chất; cân bằng tại nồng độ trung bình theo thể tích; chuyển động Brown: ⟨r²⟩ = 4Dt (2D)                                                           | đạt     |
| Thẩm thấu (ống chữ U)          | Tại cân bằng ρgΔh = iCRT (van ’t Hoff, có tính pha loãng); nước luôn đi vào nhánh dung dịch                                                                      | đạt     |

### Nguyên tắc hiển thị

- Hình NST, ribosome, ARN pôlimeraza, các hạt chuyển động Brown là **minh họa**; số liệu đọc từ
  bảng và đồ thị, không đếm trên hình.
- Tốc độ dâng cột nước trong ống chữ U phụ thuộc hệ số thấm Lp (chọn để minh họa); độ cao cân
  bằng không phụ thuộc Lp.
- Π = iCRT chỉ đúng cho dung dịch loãng; i = 2 (NaCl), 3 (CaCl₂) là giả thiết phân li hoàn toàn.
- Lotka–Volterra là mô hình định tính kinh điển (thẻ khoa học ghi "gần đúng" vì giải số).

## 8. Lưu tệp, lịch sử và quá tải (Giai đoạn 6)

- Tệp `.stemsim` và Lịch sử chỉ lưu **đầu vào** (chủ đề, thông số và nguồn của từng thông số: đề
  bài / mặc định / người dùng). Kết quả luôn được tính lại khi mở, nên không thể có kết quả "cũ" hay
  bị sửa tay. Tệp lạ được kiểm tra bằng Zod; thông số không thuộc chủ đề hoặc sai kiểu bị bỏ qua.
- Khi quá tải, app giảm chất lượng hiển thị hoặc chạy chậm có ghi tỉ lệ; bước tích phân và mô hình
  không đổi (chi tiết: docs/PERFORMANCE.md).
- Watchdog bộ nhớ chỉ giảm số mẫu lưu cho đồ thị (độ phân giải đồ thị), không đụng tới mô phỏng.
