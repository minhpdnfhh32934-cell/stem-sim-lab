# Độ chính xác khoa học — STEM Sim Lab

> Tài liệu này sẽ được nộp kèm hồ sơ dự thi. Mỗi giai đoạn sẽ bổ sung các mô hình mới.
> Trạng thái: **khung (Giai đoạn 0)**.

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

- **Bước cố định** Δt = 1/240 s cùng bộ tích lũy thời gian. Mỗi khung hình chạy tối đa 32 bước
  con, và mỗi khung hình có ngân sách thời gian tính 8 ms. Khi quá tải, app **chạy chậm lại** và
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
