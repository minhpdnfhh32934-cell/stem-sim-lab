# Độ chính xác khoa học — SimLab

> Tài liệu nộp kèm hồ sơ dự thi: mô hình, sai số, nguồn và cách kiểm chứng của mọi mô phỏng.
> Phiên bản app 0.1.0 — gồm bộ giải (§3), Vật lý (§4), AI đọc đề (§5), Hóa học (§6), Sinh học (§7),
> lưu tệp và quá tải (§8), giới hạn đã biết (§9) và cách tự kiểm chứng (§10).
>
> **Lưu ý:** mọi bộ dữ liệu đang ở trạng thái **chờ giáo viên duyệt** (`review_status: "pending"`).
> Danh sách cần duyệt: `docs/DATA_REVIEW.md`. Trong app: menu ☰ → Nguồn & Giả định.

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

| Loại                  | Nguồn                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Hằng số vật lý        | CODATA 2022 (NIST), qua SciPy                                                                                             |
| Khối lượng nguyên tử  | IUPAC / CIAAW (qua `mendeleev`)                                                                                           |
| Độ âm điện            | Thang Pauling                                                                                                             |
| Bán kính cộng hóa trị | Cordero et al., _Dalton Trans._ 2008                                                                                      |
| Cấu hình electron     | NIST ASD (trạng thái cơ bản)                                                                                              |
| Màu nguyên tố         | CPK / Jmol                                                                                                                |
| Cấu trúc 3D phân tử   | RDKit (ETKDG + MMFF94); hình học thực nghiệm NIST CCCBDB cho phân tử vô cơ nhỏ (PubChem không truy cập được khi xây dựng) |
| Mã di truyền          | NCBI translation table 1 (Biopython)                                                                                      |

Mọi tệp dữ liệu trong `data/` được sinh bằng script trong `scripts/data/` (không sửa tay), kiểm tra
bằng Zod khi nạp, và mỗi mục có `review_status`.

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
  so với lúc bắt đầu. Khi độ trôi năng lượng vượt 10⁻⁹ (#205 C2), Thẻ Khoa học nói rõ: "Năng lượng
  đã lệch … so với lúc đầu", kèm con số đo được; nhãn "Định lượng chính xác" chuyển thành
  "Định lượng gần đúng" và sai số ước lượng ít nhất bằng độ trôi đó. Đặt lại thì đo lại từ đầu.
  Ngưỡng 10⁻⁹ là mức các thẻ kiểm chứng (con lắc: chu kì khớp Dormand–Prince dưới 10⁻⁹); các lần chạy
  RK4 đo được 2·10⁻¹² tới 5·10⁻¹² sau 10⁴ s, nên chỉ các lần chạy rất dài mới chạm ngưỡng.
- **Can thiệp của người dùng:** khi người dùng kéo hoặc ném vật, app đánh dấu "Đã có can thiệp",
  nhãn "Định lượng chính xác" tự chuyển thành "Định lượng gần đúng", và app bỏ mốc năng lượng
  ban đầu.

## 4. Vật lý: mô hình từng chủ đề (Giai đoạn 2)

Mỗi chủ đề có ba lớp kiểm chứng. (1) Đáp số tính bằng công thức giải tích. (2) Kiểm chứng độc
lập bằng tích phân số Dormand–Prince, hoặc một cách tính khác. (3) Test tự động so sánh engine
thời gian thực với lời giải chính xác.

| Chủ đề                                | Engine (cách cập nhật)                                                                                                                                                      | Mức tin cậy                                             | Kiểm chứng tự động                                                                                                                                                                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chuyển động thẳng đều / biến đổi đều  | Công thức chính xác cho gia tốc không đổi. Thời điểm dừng khi hãm phanh được tìm đúng trong bước                                                                            | Chính xác                                               | Hai xe gặp nhau (t = 4 s, x = 40 m); xe hãm phanh (dừng sau 10 s, đi được 100 m); v² − v₀² = 2as; so với DOPRI5                                                                                                                                         |
| Rơi tự do, ném ngang, ném xiên        | Công thức chính xác. Thời điểm chạm đất giải đúng bằng phương trình bậc hai                                                                                                 | Chính xác                                               | h = 45 m, v₀ = 10 → t = 3 s, L = 30 m; ném từ mặt đất: 45° cho tầm xa lớn nhất; so với DOPRI5 ở sai số 10⁻⁹                                                                                                                                             |
| Định luật Newton, mặt phẳng nghiêng   | Gia tốc không đổi từng đoạn. Chuyển từ ma sát nghỉ sang trượt được giải chính xác                                                                                           | Chính xác                                               | a = g(sin θ − μ cos θ); vật đứng yên khi tan θ ≤ μₙ; vật trượt ngược lại trên dốc dốc; so với DOPRI5                                                                                                                                                    |
| Ròng rọc – dây nối                    | Quy về một bậc tự do với ma sát Coulomb                                                                                                                                     | Chính xác                                               | Máy Atwood a = (m₂ − m₁)g/(m₁+m₂), T = 2m₁m₂g/(m₁+m₂); vật trên bàn; vật trên dốc; thời gian dịch chuyển so với DOPRI5                                                                                                                                  |
| Lò xo, con lắc lò xo                  | Dùng **nghiệm giải tích chính xác** để cập nhật, kể cả khi có lực cản (tắt dần dưới tới hạn, tới hạn, quá tới hạn)                                                          | Chính xác                                               | Cả 4 chế độ so với DOPRI5 (10⁻⁹); T = 2π√(m/k); cơ năng bảo toàn đến 10⁻¹²                                                                                                                                                                              |
| Con lắc đơn                           | RK4 với 8 bước con mỗi Δt (h ≈ 0,52 ms). Mô hình góc nhỏ chạy song song bằng nghiệm chính xác                                                                               | Chính xác khi không có lực cản; gần đúng khi có lực cản | Chu kì đo trong mô phỏng khớp công thức T = 4√(l/g)K(sin(α₀/2)); ở 60° sai lệch so với công thức góc nhỏ là 7,32 %; cơ năng trôi < 10⁻¹⁰                                                                                                                |
| Bảo toàn cơ năng (vật trên đường ray) | RK4 với 8 bước con cho phương trình có ràng buộc                                                                                                                            | Chính xác (tốc độ tính từ bảo toàn cơ năng)             | v(đáy) = √(2gH) so với DOPRI5; cơ năng trôi < 10⁻⁹ trong 20 s                                                                                                                                                                                           |
| Va chạm 1D/2D                         | Chuyển động thẳng đều giữa hai va chạm. Thời điểm va chạm giải chính xác, xung lực tính theo hệ số phục hồi e                                                               | Chính xác                                               | Hai vật cùng khối lượng va chạm đàn hồi thì trao đổi vận tốc; va chạm xiên hai vật cùng khối lượng thì hai hướng vuông góc; kết quả khớp cách tính trong hệ khối tâm                                                                                    |
| Chuyển động tròn đều                  | Pha chính xác φ = φ₀ ± ωt với t = n·Δt (không cộng dồn); không có gì kéo được                                                                                               | Chính xác                                               | DOPRI5 tích phân r″ = −(F_ht/(m·r))·r⃗ (rtol 10⁻¹²): bán kính giữ nguyên, vị trí khớp engine ở bốn thời điểm, chu kì đo qua y = 0 (đi lên) khớp 2πr/v tới 10⁻⁹                                                                                          |
| Giao thoa sóng hai nguồn              | Công thức chính xác u = a·cos(ω₁t − k₁d₁) + a·cos(ω₂t − k₂d₂) tại t = i·Δt (Δt ≤ T/200); kéo nguồn hay M là đổi thông số, chạy lại từ t = 0                                 | Chính xác (độ dốc 2a·k ≤ 0,1); gần đúng khi biên độ lớn | Số cực đại, cực tiểu trên S₁S₂: công thức so với quét biên độ (tổng hai phasor) dọc đoạn; chu kì phách đo trên li độ tại M khớp 1/\|f₁ − f₂\| tới 0,2 %; mỗi sóng giải lại bằng DOPRI5 trên phương trình sóng dọc một tia (sai số O(Δx²), hội tụ bậc 2) |
| Sóng dừng trên dây                    | Công thức chính xác y = 2A·sin(kx)·sin(ωt) tại t = i·Δt (Δt ≤ T/200); không có gì kéo được                                                                                  | Chính xác (độ dốc 2A·k ≤ 0,1); gần đúng khi biên độ lớn | DOPRI5 trên phương trình sóng của dây chia đoạn, hai đầu cố định: 240/480 đoạn sai số O(Δx²), hội tụ bậc 2; 200 đoạn tần số mode khớp n·v/(2L) tới 10⁻⁹                                                                                                 |
| Điện trường, tụ phẳng                 | Công thức chính xác (Coulomb, chồng chất, E = U/d); đường sức RK4 chia đôi bước, sai số như nhau ở mọi mức máy                                                              | Chính xác (các con số)                                  | E so với −∇V: lệch tương đối ≤ 10⁻⁶; đường sức nằm trong sai số app báo so với DOPRI5; Σqᵢcosθᵢ không đổi (hai điện tích cùng trục)                                                                                                                     |
| Dao động cưỡng bức và cộng hưởng      | Nghiệm chính xác tại t = n·Δt: phần ổn định A·cos(Ωt − φ) (công thức đóng) cộng phần dao động riêng tắt dần (bản đồ chuyển trạng thái chính xác của lò xo, cả 4 chế độ cản) | Chính xác                                               | DOPRI5 trên phương trình chuyển động khớp nghiệm; chuyển động tích phân dừng ở đúng biên độ ổn định (đáp số A có phép kiểm này); đỉnh của A(Ω) tại √(ω₀² − 2γ²), không có đỉnh khi cản lớn                                                              |
| Mạch điện một chiều                   | Công thức nối tiếp / song song và định luật Ohm cho toàn mạch (trạng thái dừng)                                                                                             | Chính xác                                               | Khớp phương pháp điện thế nút (định luật Kirchhoff, giải hệ tuyến tính); cân bằng công suất Σ Pₖ + I²r = E·I và U = E − I·r; DOPRI5: tụ nhỏ đặt ở các nút nạp tới đúng điện thế nút                                                                     |
| Định luật II Kepler (mở rộng)         | Phương trình Kepler M = E − e·sin E giải bằng phương pháp Newton tới sai số làm tròn, tại t = n·Δt; đơn vị tương đối (a = 1)                                                | Chính xác (đơn vị tương đối)                            | DOPRI5 tích phân r⃗″ = −GM·r⃗/r³ (GM = 4π²a³/T²) từ cận nhật với tốc độ vis-viva: vị trí khớp nghiệm Kepler; tỉ số tốc độ cận nhật / viễn nhật = (1 + e)/(1 − e), cũng lấy từ tích phân; diện tích quét mỗi phần = πab/N                                |
| Hoạ âm và chuỗi Fourier               | Tổng riêng S_N tính thẳng từ hệ số đóng (sóng vuông bₙ = 4/(nπ), n lẻ; răng cưa bₙ = 2(−1)ⁿ⁺¹/(nπ)); bài không có diễn biến theo thời gian                                  | Chính xác                                               | bₙ khớp tích phân số của sóng lí tưởng (lệch < 10⁻⁶); sóng vuông chỉ có hoạ âm lẻ; đoạn vượt đỉnh gần chỗ nhảy không mất đi khi thêm hoạ âm (hiện tượng Gibbs), do code đo trên chính tổng đang vẽ; nút Nghe phát đúng các bₙ đang vẽ                   |

**Kéo và ném bằng chuột:** app nối vật với con trỏ bằng một lò xo có giảm chấn tới hạn
(ω = 28 rad/s), nên vật không bị dịch chuyển tức thời. Khi thả chuột, vật giữ nguyên vận tốc lúc
đó. Ngay khi có can thiệp, Thẻ Khoa học chuyển sang mức **Định lượng gần đúng**, và lời giải giải
tích được ghi rõ là chỉ áp dụng cho điều kiện ban đầu.

**Bài chạy liên tục (#205 C1, 12/11/2026):** các bài tuần hoàn (chuyển động tròn đều, Kepler, dao
động cưỡng bức, giao thoa, sóng dừng, lò xo, con lắc đơn, vật trên đường ray) không còn mốc dừng; vật
trên đường ray vẫn dừng khi rời ray. Thời gian luôn là t = t₀ + n·Δt (không cộng dồn). Các bài có
công thức đóng tính trạng thái thẳng từ công thức tại t đó, từ trạng thái đầu (hoặc lần kéo, lần tua
gần nhất); lò xo và mô hình góc nhỏ của con lắc không còn bước theo bản đồ chuyển trạng thái, nên sai
số không tích luỹ. Kiểm chứng: `src/physics/endless.test.ts` chạy thật mỗi engine tới t = 10⁵ s và so
với công thức đóng viết riêng trong test. Hai bài RK4 (con lắc góc lớn, đường ray) không có công
thức đóng: test chạy thật tới 10⁴ s và kiểm năng lượng (đo được độ trôi tương đối 2·10⁻¹² tới
5·10⁻¹², ngưỡng 10⁻⁹); `npm run test:slow` chạy tới 10⁵ s (ngưỡng 10⁻⁸) trước mỗi bản phát hành.
Đồ thị, bảng và CSV giữ đoạn gần nhất của lần chạy (12000 mẫu, khoảng 100 s ở 1×), không thưa dần;
bảng và CSV ghi rõ đoạn đó.

**Sự kiện trong DOPRI5 (sửa lỗi ngày 2026-09-29):** khi vật xuất phát đúng tại mặt đất (y = 0) hoặc
khi hai sự kiện (đỉnh quỹ đạo và chạm đất) rơi vào cùng một bước tích phân dài, bộ bắt sự kiện cũ
có thể bỏ sót lần chạm đất. Nay mọi sự kiện trong một bước được xử lý theo thứ tự thời gian, và
trường hợp xuất phát trên mặt sự kiện được xét từ ngay sau thời điểm đầu. Có test hồi quy.

**Hz và rad/s không được trộn (0.8.0, #37 §8.2 bẫy 1):** hai đơn vị cùng số mũ SI (s⁻¹) và cùng
hệ số 1, nên trước đây "f = 2 Hz" có thể lọt vào ô tốc độ góc thành ω = 2 rad/s (sai 2π lần).
Radian không có chiều, nên `src/core/units.ts` gắn **nhãn nhóm đơn vị**: nhóm "góc" (rad/s) và
nhóm "chu kì" (Hz, vòng/s, vòng/phút; 1 vòng/phút = 1/60 Hz). `convert()` báo lỗi khi đổi giữa hai
nhóm; `allowedUnits()` (`src/ai/spec.ts`) cho ô ω chỉ rad/s, ô f chỉ Hz, vòng/s, vòng/phút, nên AI
ghi "2 Hz" vào ô ω thì bị từ chối (test). Lưu ý: ô hệ số cản `c` của con lắc đơn và đáp án γ của
lò xo là tốc độ tắt dần (s⁻¹) nhưng xưa nay ghi "Hz"; chúng vẫn chạy như cũ (nay thuộc nhóm "chu
kì"), xem DATA_REVIEW UCM-3.

**Giao thoa sóng hai nguồn (0.8.1, #105):** hai nguồn điểm cùng pha, cùng biên độ a, trên mặt nước lí
tưởng (không tắt dần, biên độ không giảm theo khoảng cách, không tán sắc). Số cực đại, cực tiểu trên
đoạn S₁S₂ tính theo −S₁S₂/λ < k < S₁S₂/λ (không kể hai nguồn); S₁S₂/λ chỉ được coi là nguyên khi lệch
do sai số làm tròn (≤ 10⁻⁹), không làm tròn thêm. Kiểm chéo bằng cách quét biên độ của tổng hai
phasor dọc S₁S₂ và đếm đỉnh, đáy (giới hạn đã biết: đỉnh cách nguồn dưới khoảng 10⁻⁷λ không quét
thấy). Khác tần số thì có phách f_b = |f₁ − f₂|; chu kì phách đo lại trên li độ tại M của engine
(đỉnh đường bao), chỉ khi hai tần số đủ gần (2|f₁ − f₂|/(f₁ + f₂) ≤ 0,5; sai số đo ≤ 0,22 %); xa hơn thì
Lời giải không gắn phép đo và ghi chú vì sao. Hình mặt nước là ảnh điểm: máy chậm thì ô ảnh to hơn (cấp chất lượng thấp hơn)
nhưng không to quá λ/4 trên màn hình, nên hình không bao giờ biến mất vì máy chậm; mọi số không đổi.
Chỉ khi bước sóng dưới 4 điểm ảnh trên màn hình thì không vẽ mặt nước (tránh vân giả) và nhắc phóng
to. Bảng Lời giải và test dùng chung một quy tắc "khớp" (#119, `src/physics/tolerance.ts`): lệch tương đối không quá 10⁻⁸, hoặc chênh lệch tuyệt đối không quá 10⁻¹² theo đơn vị SI (sai số làm tròn quanh một đáp số đúng bằng 0; khi đó bảng hiện độ lệch tuyệt đối kèm đơn vị); lệch hơn là "chưa khớp". Chỉ phép đo chu kì phách khai mức riêng 0,3 % (đọc trên các điểm lấy mẫu; Thẻ Khoa học ghi rõ), và một test quét thanh trượt của mọi bài Vật lí chứng minh không đáp số nào "chưa khớp". Khi làm #119, quét này tìm ra hai phép kiểm chéo lệch thật đã sửa: biên độ dao động cưỡng bức (cản lớn thì dao động riêng tắt theo γ − √(γ² − ω₀²), chậm hơn γ; Ω ≪ ω₀ thì phần riêng còn thấy được), nay tích phân từng đoạn tới khi số đo đứng yên; diện tích quét mỗi phần của bài Kepler (đa giác nội tiếp lệch theo 1/n²), nay khử bằng ngoại suy Richardson. Trước #119 bảng dùng ngưỡng 1 %. Ngưỡng 1 % (từ #110) đã làm lộ vài chỗ phép kiểm chéo của bài cũ lệch thật mà trước đây vẫn hiện "khớp" (test `SolutionPanel.test.tsx`): Newton và mặt phẳng nghiêng khi vật vừa vượt cuối đường (bước DOPRI5 nhảy qua cả hai lần cắt), con lắc lò xo và lò xo Hooke gần cản tới hạn (chu kì đo được khi còn quá ít lần qua vị trí cân bằng). Đáp số theo công thức vẫn đúng; sửa phép kiểm ở issue #112. Kéo một nguồn đổi S₁S₂ (hai nguồn dời đối xứng), kéo M đổi d₁, d₂; đó là đổi thông số, không phải
can thiệp giữa chừng, nên kéo không làm Thẻ Khoa học chuyển sang "gần đúng".

**Không gian pha (0.8.1, #142):** đồ thị v theo x (lò xo Hooke, con lắc lò xo) và ω theo α (con
lắc đơn, α đưa về khoảng (−π; π], đường phân cách nét đứt ứng với E = 2mgL) chỉ vẽ các trạng thái
engine đã ghi, không nội suy. Vòng tròn pha của con lắc lò xo (vectơ quay dài A, đầu vectơ là
(x; −v/ω)) chỉ hiện khi không có lực cản, vì mô hình vòng tròn chỉ đúng khi đó.

**Dao động cưỡng bức, mạch điện, Kepler, Fourier (0.8.1):** dao động cưỡng bức cần có lực cản (không
cản thì không có biên độ ổn định); phép kiểm biên độ chờ tới khi phần dao động riêng đã tắt hẳn.
Mạch điện một chiều: đề không cho điện trở trong thì r = 0 (nguồn lí tưởng), Thẻ Khoa học ghi rõ.
Định luật II Kepler là phần **mở rộng ngoài 9 cuốn SGK Kết nối tri thức** (Lời giải và Thẻ Khoa học
ghi rõ) và dùng **đơn vị tương đối**: chưa có bảng số liệu hành tinh có nguồn sinh bằng script, nên
T chỉ quyết định tốc độ chạy hình (DATA_REVIEW KEP-1, KEP-2). Hoạ âm và chuỗi Fourier không nhận số
từ AI; tên "hiện tượng Gibbs" và câu chữ của bài đang chờ duyệt (DATA_REVIEW FOU-*).

**Sóng dừng không tự làm tròn (0.8.0, #37 §8.2 bẫy 5):** dây hai đầu cố định chỉ có sóng dừng
khi m = 2Lf/v là số nguyên. App coi m là nguyên khi khoảng cách tới số nguyên gần nhất không quá
10⁻⁹·max(1, m) — chỉ để bỏ qua sai số làm tròn của máy tính (ví dụ 2·1,1·50/11 tính ra
10,000000000000002). Không nguyên thì app báo "Không có sóng dừng", gợi ý tần số cộng hưởng ngay
dưới và ngay trên (m < 1: chỉ f₁; không quá 20 bó, vượt thì gợi ý f₂₀) kèm nút **Dùng fₙ** để học
sinh tự bấm đặt đúng giá trị, **không** tự đổi f, và hiện m đủ chữ số để không trông như số
nguyên (1.818,2 chứ không phải 1818). Biên độ A là biên độ của mỗi sóng thành phần (bụng 2A); độ
dốc 2A·k > 0,1 thì Thẻ Khoa học chuyển "gần đúng". Hình vẽ phóng to trục dọc (có ghi hệ số) và lấy
một mẫu mỗi khung hình: khi f × tốc độ phát vượt khoảng 30 Hz (nửa số khung hình mỗi giây) thì
thấy hoạt nghiệm, và muốn đường cong mượt (≥ 10 điểm mỗi chu kì) thì chỉ nên vài Hz. Lưới, thước
và thước đo góc chia lại hệ số phóng to (`PhysicsScene.yStretch`), nên vẫn đo theo mét thật. Xem
DATA_REVIEW SWV-1 … SWV-8.

**Số rất nhỏ và dấu điện tích trong đề (0.8.0, #37 §8.2 bẫy 2 và 3; phạm vi cuối của #89):**
`src/ai/numbers.ts` giữ nguyên bộ đọc của bản trước, chỉ thêm bốn điểm:

1. Một dãy chữ số mũ nhỏ phía trên là một số mũ: "4.10⁻⁸", "1,6.10⁻¹⁹" được đọc như khi viết "4.10^-8"
   (trước đây "10⁻¹⁹" thành "10^-^1^9", không đọc được). "⁰" ngay sau chữ số là độ ("10⁰" là 10 độ,
   không phải 1).
2. So **sai số tương đối**, chỉ với số hữu hạn: trước đây ngưỡng tuyệt đối 10⁻⁹ cho số bịa lọt với
   điện tích cỡ 10⁻⁹ C (đề ghi 5.10⁻¹⁰ thì 7.10⁻¹⁰ vẫn qua). Phần kiểm lời giải thích (`explain.ts`)
   cũng bỏ ngưỡng tuyệt đối (số bịa dưới ~10⁻¹¹ từng khớp mọi số nhỏ của đề). Số tràn ("2.10⁴⁰⁰")
   không bao giờ được coi là "có trong đề", còn trong lời giải thích thì luôn bị đánh dấu.
3. Chữ số dính vào ký hiệu một hai chữ cái đầu từ ("q0", "q_0", "m1", "R1", "v_0") không được coi
   là số có trong đề; "nhau10", "góc30" là từ nên vẫn đọc như trước. Chỉ áp ở phía kiểm đề.
4. **Dấu của điện tích:** bộ lọc so trị tuyệt đối, nên `src/ai/draft.ts` kiểm thêm: dấu AI đưa ra khác
   dấu trong đề (dấu "−" sát số, hoặc chữ "âm/dương" trong cùng câu), hay đề để ngỏ ("độ lớn", "trái
   dấu", "khác dấu"), thì bảng "Tôi hiểu đề như sau" hiện cảnh báo ở dòng điện tích đó (không chặn);
   cảnh báo còn cho tới khi dấu người học đặt khớp với đề.

Như trước, lũy thừa 10 không có hệ số ("q = 10⁻⁸ C") không được đọc, và y_M = 0 không được suy từ lời
("M nằm trên đoạn AB"): bảng hỏi người học nhập. Test so sánh với bản trước (`numbersMain.fixture.ts`):
câu nào bản trước chặn thì bản mới cũng chặn (ngoại lệ duy nhất: hệ số với số mũ viết bằng chữ số nhỏ
mà bản trước không đọc được), mọi giá trị của bộ đề chuẩn mà bản trước nhận thì bản mới cũng nhận, lời
giải thích bị bản trước đánh dấu thì bản mới cũng đánh dấu (`numbers.test.ts`).

**Đường sức điện (0.8.0, #76):** vẽ bằng tích phân số dr⃗/ds = ±E⃗/|E⃗| (RK4, chia đôi bước để kiểm sai
số và tự chỉnh bước; dung sai là một phần cố định của khung hình, giống nhau ở mọi mức máy; giới hạn
theo số bước, không đo thời gian). Sai số ghi trên Thẻ Khoa học là một ước lượng trên do code tính:
mỗi đường có một bản "thô" (một bước đủ thay cho hai nửa bước), và sai số là khoảng cách lớn nhất
giữa hai bản; trong test, số này lớn hơn khoảng cách thật tới đường tính bằng DOPRI5 (rtol 10⁻¹²)
khoảng 11 lần. Đường dừng ở điện tích, ra khỏi khung, quá dài, hoặc ở điểm E = 0 (được đánh dấu);
đường bị cắt vì hết số bước vẽ nét đứt. Các con số (E, F) không phụ thuộc đường sức.

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
thật: đặt biến môi trường `GEMINI_API_KEY`, rồi chạy `npm run golden:llm` (dùng lượt miễn phí; báo cáo tỉ lệ chọn đúng chủ đề, trích đúng số
liệu, ra đúng đáp số).

**Kiểm thử đầu-cuối:** `npm run test:e2e` (Playwright) chạy app thật trong trình duyệt với máy
chủ Gemini giả lập. Các tình huống: đề → bảng xác nhận → mô phỏng → lời giải → diễn giải; AI bịa số bị
loại; diễn giải chứa số lạ bị ẩn; đề ngoài phạm vi; mất mạng; hết lượt miễn phí (HTTP 429); chưa có khóa → hướng dẫn lấy khóa; chế độ Tự dựng cảnh không
gọi AI.

## 6. Hóa học (Giai đoạn 4)

### Dữ liệu

| Dữ liệu                                                                                                                       | Nguồn                                                                                                                                 | Tạo bằng                        | Trạng thái |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------- |
| 118 nguyên tố: nguyên tử khối, độ âm điện Pauling, bán kính cộng hóa trị, năng lượng ion hóa, cấu hình electron, màu CPK/Jmol | IUPAC/CIAAW, Pauling, Cordero et al. 2008, NIST ASD (qua thư viện `mendeleev` 1.3.0)                                                  | `scripts/data/gen_elements.py`  | chờ duyệt  |
| 85 phân tử (tọa độ 3D; nhóm chức của phân tử hữu cơ)                                                                          | RDKit ETKDG + MMFF94; hình học thực nghiệm (NIST CCCBDB) cho 14 phân tử vô cơ nhỏ; hình học VSEPR lý tưởng cho 7 phân tử siêu hóa trị | `scripts/data/gen_molecules.py` | chờ duyệt  |
| 39 phản ứng, 10 cơ chế                                                                                                        | SGK Hóa 10–12 (GDPT 2018); Clayden, _Organic Chemistry_ (2nd ed.)                                                                     | `scripts/data/gen_reactions.py` | chờ duyệt  |
| Kw của nước ở 25 °C; khoảng đổi màu và tên màu của 4 chất chỉ thị                                                             | IAPWS R11-24 (2024) cho Kw, đổi từ mol/kg sang mol/L; từng chất chỉ thị có trích nguồn riêng                                          | `scripts/data/gen_titration.py` | chờ duyệt  |

PubChem không truy cập được từ môi trường xây dựng, nên cấu trúc 3D được sinh bằng RDKit (ghi rõ
phương pháp cho từng phân tử trong app và trong Thẻ Khoa học).

### Kiểm chứng tự động

| Nội dung                      | Kiểm tra                                                                                                                                                                                                                               | Kết quả              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Cấu hình electron             | Lấy từ bảng dữ liệu; test xác nhận Cr, Cu, Mo, Ag, Au, Pd là ngoại lệ Aufbau và Fe, Zn… không phải; tổng electron = Z cho cả 118 nguyên tố                                                                                             | đạt                  |
| Nguyên tử hydro               | ∫R²r²dr = 1; ⟨r⟩ = (3n² − l(l+1))a₀/2; số nút xuyên tâm n − l − 1; hàm điều hòa cầu thực trực chuẩn; Hα = 656,47 nm (chân không, khối lượng rút gọn)                                                                                   | đạt                  |
| Hình học phân tử (trường lực) | So với thực nghiệm: độ dài liên kết lệch < 0,03 Å, góc lệch < 3° (H₂O, NH₃, CH₄, C₂H₄, C₂H₂, C₆H₆, HCN, C₂H₆)                                                                                                                          | đạt                  |
| VSEPR                         | 16 phân tử/ion: nhãn AXₙEₘ và hình dạng đúng (CO₂, BF₃, SO₂, CH₄, NH₃, H₂O, PCl₅, SF₄, ClF₃, XeF₂, SF₆, XeF₄, NH₄⁺, NO₃⁻, O₃, SO₄²⁻)                                                                                                   | đạt                  |
| Độ phân cực                   | Tổng vectơ momen liên kết (∝ Δχ) + điện tích hình thức trung bình theo cộng hưởng; 27 phân tử khớp SGK. Hạn chế đã biết: PH₃ (Δχ ≈ 0 nhưng thực tế phân cực nhẹ)                                                                       | đạt (có ghi hạn chế) |
| Công thức phân tử             | Công thức viết kiểu SGK của mỗi phân tử có cùng số nguyên tử và điện tích với công thức Hill                                                                                                                                           | đạt                  |
| Thư viện phản ứng             | Mọi phương trình bảo toàn nguyên tố và điện tích; bộ cân bằng tìm lại đúng hệ số (trừ phản ứng tráng bạc: có nhiều cách cân bằng độc lập, app báo rõ)                                                                                  | đạt                  |
| Cơ chế                        | Mọi khung của một cơ chế có cùng tập nguyên tử (atom mapping) và cùng tổng điện tích; SN2: C–Br đứt, C–O tạo; ester hóa: O của nước đến từ nhóm OH của axit (kết quả đánh dấu ¹⁸O)                                                     | đạt                  |
| Cân bằng phương trình         | Không gian nghiệm tính bằng số hữu tỉ chính xác (BigInt); báo "không thể cân bằng" hoặc "vô số cách cân bằng" thay vì đoán                                                                                                             | đạt                  |
| Khí 2D (Maxwell–Boltzmann)    | Va chạm đàn hồi: năng lượng bảo toàn đến 10⁻⁹; tốc độ trung bình khớp √(πkT/2m) trong 2 %; histogram lệch lý thuyết 2D < 5 %                                                                                                           | đạt                  |
| Thuyết va chạm                | Tỉ lệ va chạm đủ năng lượng khớp e^(−Eₐ/k_BT) trong ±0,03 (Eₐ = 0,5 và 1,5 k_BT)                                                                                                                                                       | đạt                  |
| Cân bằng hóa học              | A ⇌ B khớp nghiệm giải tích; A + B ⇌ C khớp nghiệm phương trình bậc hai; Q = K khi cân bằng; định luật van ’t Hoff; 2A ⇌ B bảo toàn khối lượng                                                                                         | đạt                  |
| Giản đồ năng lượng            | ΔH = Eₐ thuận − Eₐ nghịch, âm khi tỏa nhiệt và dương khi thu nhiệt; đỉnh (trạng thái chuyển tiếp) luôn ở trên; đổi một Eₐ thì đổi cả số lẫn hình; không nhãn nào đè lên mức năng lượng hay nhãn khác                                   |
| Chuẩn độ acid – base          | pH là nghiệm dương của cân bằng điện tích có Kw, khớp nghiệm chia đôi tới 10⁻⁹ pH ở mọi điểm; điểm tương đương tại V = Cₐ·Vₐ/C_b với pH = pKw/2; xa điểm tương đương khớp giá trị SGK; mỗi chất chỉ thị đổi màu đúng khoảng trong bảng |
| Tinh thể kim loại và NaCl     | Đếm từ tọa độ: số hạt trong một ô (lập phương tâm khối 2, tâm mặt 4, lục phương đặc khít 6, NaCl 4 Na⁺ + 4 Cl⁻), viết kiểu SGK (8 × 1/8 + 1); số phối trí 8, 12, 12, 6 : 6; độ đặc khít khớp π√3/8 và π/(3√2)                          |
| Nhóm chức                     | Nhóm chức tìm bằng mẫu SMARTS của RDKit lúc sinh dữ liệu; test: mọi phân tử hữu cơ có nhóm, chất vô cơ không có; đúng nhóm cho benzene, phenol, ethyl acetate, alanine, urea, cyclohexane                                              |

### Nguyên tắc hiển thị

- Cơ chế chỉ có cho phản ứng trong thư viện. Phản ứng khác: chỉ kiểm tra cân bằng, kèm câu
  "Phản ứng này chưa có trong cơ sở dữ liệu đã kiểm chứng — không hiển thị cơ chế".
- Chuyển động giữa các khung cơ chế là nội suy, luôn gắn nhãn "Chuyển tiếp minh họa — không phải
  quỹ đạo nguyên tử thực". Trạng thái chuyển tiếp là hình minh họa (không tính bằng hóa lượng tử).
- SMILES không có trong thư viện: RDKit kiểm tra hóa trị và vẽ 2D; không dựng 3D.
- Phân bố Maxwell–Boltzmann trong app là của khí **hai chiều**; công thức 3D của SGK chỉ hiển thị
  để so sánh.
- Chuẩn độ acid – base (0.8.1, #106): chỉ acid mạnh (trong cốc) với base mạnh (từ buret), 25 °C.
  Màu dung dịch là màu minh họa chọn theo tên màu của chất chỉ thị (chip "Màu minh họa"). Acid yếu
  và dung dịch đệm chưa có.
- Giản đồ năng lượng (0.8.1, #116): ba mức năng lượng là số do code tính từ Eₐ người học nhập, vẽ
  đúng tỉ lệ với nhau; hình dạng đường cong là minh họa định tính (chip ghi rõ). Không lấy số từ AI
  hay từ thư viện phản ứng.
- Tinh thể kim loại và NaCl (0.8.1, #166): hình luôn ghi "Hình minh họa — không theo tỉ lệ"; chưa
  có hằng số mạng có nguồn nên không hiện cạnh ô a (DATA_REVIEW CRY-3). NaCl không tính độ đặc khít
  (cần bán kính hai ion).

## 7. Sinh học (Giai đoạn 5)

### Dữ liệu

| Dữ liệu                              | Nguồn                                                                               | Tạo bằng                            | Trạng thái |
| ------------------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------- | ---------- |
| Bảng mã di truyền chuẩn (64 bộ ba)   | NCBI Genetic Code, bảng số 1 (qua Biopython 1.88)                                   | `scripts/data/gen_genetic_code.py`  | chờ duyệt  |
| Bảng số lượng NST ở các kì phân bào  | Không nhập tay: **đếm** từ mô hình NST (`division.ts`)                              | code + test so với bảng SGK         | chờ duyệt  |
| Bộ phận tế bào (3 tế bào, 21 mục)    | SGK Sinh học 10 KNTT, Bài 7–8 (diễn đạt lại)                                        | `src/biology/cell/parts.ts` + test  | chờ duyệt  |
| Kích thước 6 cấp “Từ tế bào đến DNA” | SGK Sinh học 10 KNTT tr. 44, 49; SGK Sinh học 12 KNTT tr. 36–38; Ou và cộng sự 2017 | `scripts/data/gen_cell_dna_zoom.py` | chờ duyệt  |

Mọi chủ đề sinh học khác dùng **công thức** (không có bảng số liệu nhập tay), nên độ tin cậy do
test tự động bảo đảm. Riêng bài “Tế bào nhân sơ và nhân thực” là **định tính**: bảng bộ phận chỉ
có chữ (không có số), chờ giáo viên duyệt (`DATA_REVIEW.md`, mục `CELL3D-*`). Bài “Từ tế bào đến
DNA” chỉ dùng **số in trong sách** (kích thước, số histone, số cặp nucleotide) và hằng số B-DNA của
`bdna.ts`; không tính gì thêm ngoài phép đổi µm → nm và bán kính trục DNA quấn = (10 nm − 2 nm)/2
(`DATA_REVIEW.md`, mục `DNAZ-*`).

### Kiểm chứng tự động

| Chủ đề                              | Kiểm tra                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Kết quả |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Nguyên phân / giảm phân             | Với 2n = 4, 8, 46: số NST, trạng thái đơn/kép, cromatit, tâm động, phân tử ADN ở mọi kì khớp bảng SGK; 1 → 2 tế bào (nguyên phân), 1 → 2 → 4 (giảm phân)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | đạt     |
| Nguyên phân 3D (động vật, thực vật) | Số lượng ở 7 bước (G1, G2, kì đầu … phân chia tế bào chất) lấy từ `runDivision` với 2n = 4, 8, 46 (hình 3D chỉ có cho 2n = 2–8: bộ chọn 2n, có test); từ G1 tới kì sau, trạng thái hình học của bản 3D (`stateAt`) có số phân tử ADN (mỗi cromatit vẽ ra là 1 phân tử ADN) và số tâm động khớp số đếm (hình vẽ đặt 1 hạt tâm động trên mỗi cromatit, nên NST kép có 2 hạt sát nhau: không đếm tâm động trên hình); G2 có NST kép (tế bào động vật: 2 trung thể) ngay từ đầu bước, vì pha S không vẽ thành bước riêng; kì đầu và kì cuối: không sợi thoi nào đi qua một nhân còn màng (độ đậm ≥ 0,5); kì giữa: NST chỉ rời chỗ khi sợi thoi từ cả hai cực đã đính vào, rồi mọi tâm động nằm trên mặt phẳng xích đạo, NST từ mẹ và từ bố xếp xen kẽ; kì sau: cromatit chị em về hai cực đối diện; kì cuối: 1 tế bào, 2 nhân, mỗi nhân đủ 2n NST; sau phân chia: 2 tế bào, mỗi tế bào 2n NST đơn giống tế bào mẹ; nhân con chỉ là hình vẽ (không đổi số lượng); tế bào động vật không có thành/tấm tế bào, tế bào thực vật không có trung thể/rãnh phân cắt; NST, nhân, trung thể luôn ở trong tế bào; camera không đi vào trong tế bào và luôn thấy đủ khung hình | đạt     |
| Phân li độc lập, trao đổi chéo      | Mỗi giao tử có đúng 1 NST của mỗi cặp; không trao đổi chéo: 2ⁿ loại giao tử qua mọi cách sắp xếp; có trao đổi chéo (n = 1): 4 loại giao tử khác nhau                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | đạt     |
| ADN → mARN → protein                | 64 bộ ba (61 mã hóa, 3 kết thúc, AUG = Met); mạch bổ sung, mạch gốc → mARN; dịch mã từ AUG đầu tiên tới bộ ba kết thúc                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | đạt     |
| Đột biến điểm                       | Im lặng (GGC → GGA), sai nghĩa (TTT → TCT), vô nghĩa (AAA → TAA), dịch khung (thêm/mất 1 nu), mất trọn bộ ba, mất bộ ba mở đầu                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | đạt     |
| Di truyền Mendel                    | 3 : 1, 1 : 2 : 1, 1 : 1, 9 : 3 : 3 : 1, trội không hoàn toàn 1 : 2 : 1; Monte Carlo khớp lí thuyết (χ²); χ² tới hạn 3,841 / 5,991 / 7,815 ở α = 0,05                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | đạt     |
| Hardy–Weinberg                      | p² + 2pq + q² = 1; kiểm định χ² với df = 1; một thế hệ ngẫu phối đưa về tỉ lệ cân bằng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | đạt     |
| Phiêu bạt di truyền                 | Wright–Fisher, 3000 lần chạy: tỉ lệ cố định ≈ p₀ (±0,03); dị hợp trung bình giảm theo (1 − 1/2N)ᵗ                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | đạt     |
| Tăng trưởng logistic                | Nghiệm chính xác khớp DOPRI5; tiến tới K; điểm uốn tại N = K/2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | đạt     |
| Lotka–Volterra                      | Đại lượng bảo toàn V lệch < 10⁻⁷ (DOPRI5, rtol 10⁻¹⁰); điểm cân bằng đứng yên; chu kì dao động nhỏ ≈ 2π/√(αγ). App hiển thị sai lệch của V để người dùng tự kiểm                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | đạt     |
| Động học enzyme                     | v = Vmax/2 tại [S] = Km; Km, Vmax biểu kiến của 3 kiểu ức chế; [S](t) chính xác (hàm Lambert W) khớp DOPRI5 (app cũng hiển thị sai lệch)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | đạt     |
| Khuếch tán (Fick hai ngăn)          | Bảo toàn lượng chất; cân bằng tại nồng độ trung bình theo thể tích; chuyển động Brown: ⟨r²⟩ = 4Dt (2D)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | đạt     |
| Thẩm thấu (ống chữ U)               | Tại cân bằng ρgΔh = iCRT (van ’t Hoff, có tính pha loãng); nước luôn đi vào nhánh dung dịch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | đạt     |
| Tế bào nhân sơ và nhân thực         | Nhân sơ không có nhân và không có bào quan có màng bao bọc; tế bào động vật không có thành tế bào, lục lạp; tế bào thực vật có thành tế bào, lục lạp, không bào trung tâm; mọi bộ phận có tên vi/en, nguồn + số trang, `pending`; không có chữ số; không kích hoạt nhầm cảnh báo khủng hoảng; hình 2D vẽ đúng các bộ phận của bảng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | đạt     |
| Từ tế bào đến DNA                   | Số trong dữ liệu đúng số in trong SGK (tr. 36, 37, 44, 49) và đường kính DNA = hằng số `bdna.ts`; 6 cấp nhỏ dần; thước tỉ lệ là 1, 2 hoặc 5 × 10ᵏ, dài đúng `barNm` trong cả 3D và 2D; cảnh 3D giải phóng hết bộ nhớ (`expectAllFreed`), ngân sách vẽ đo thật; E2E: phóng to có chip “không theo tỉ lệ”, giảm chuyển động thì chuyển cấp ngay, bản 2D cùng số                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | đạt     |

### Nguyên tắc hiển thị

- Hình NST, ribosome, ARN pôlimeraza, các hạt chuyển động Brown là **minh họa**; số liệu đọc từ
  bảng và đồ thị, không đếm trên hình.
- Nguyên phân 3D: kích thước, vị trí và thời gian là **minh họa, không theo tỉ lệ**; chuyển động
  giữa các khung hình chính được nội suy mượt. Số lượng (bảng, nhãn) đếm từ mô hình. Khi máy không
  vẽ được WebGL, khi chất lượng hiển thị là Thấp, hoặc khi app tự hạ chất lượng vì máy chạy chậm, app
  dùng hình 2D và mở ở kì mà hình 3D đang cho xem. Hình 3D chỉ vẽ cho 2n = 2–8 (với 2n = 46 các NST
  chồng lên nhau); nhân con được vẽ đơn giản để thấy nó tiêu biến ở kì đầu và xuất hiện lại ở kì
  cuối; vị trí NST từ mẹ và từ bố trên mặt phẳng xích đạo là minh họa (xen kẽ). Hai bản dùng chung mô hình
  đếm `runDivision` và có số liệu giống nhau từ G1 tới kì sau, nhưng ghi kì cuối khác nhau: bản 2D
  ghi theo mỗi tế bào con (2 tế bào, mỗi tế bào 2n NST đơn), bản 3D ghi 1 tế bào có 2 nhân (cả tế
  bào 4n NST đơn, mỗi nhân 2n; quy ước đang chờ duyệt, xem `DATA_REVIEW.md` mục 15). Bản 3D có
  thêm bước "Phân chia tế bào chất", với số liệu mỗi tế bào con bằng kì cuối của bản 2D.
- Tốc độ dâng cột nước trong ống chữ U phụ thuộc hệ số thấm Lp (chọn để minh họa); độ cao cân
  bằng không phụ thuộc Lp.
- Π = iCRT chỉ đúng cho dung dịch loãng; i = 2 (NaCl), 3 (CaCl₂) là giả thiết phân li hoàn toàn.
- Lotka–Volterra là mô hình định tính kinh điển (thẻ khoa học ghi "gần đúng" vì giải số).
- **Chạy liên tục (#205 C5, 12/11/2026):** cảnh 3D Lotka–Volterra chạy hết khung này sang khung
  khác; mỗi khung được tính bằng DOPRI5 (cùng rtol 10⁻¹⁰, cùng bước lấy mẫu) từ điểm cuối của khung
  trước (`lvSegment`), không nội suy. Kiểm chứng (`src/biology/models.test.ts`): 10 khung nối nhau
  trùng với một lần tính liền mạch, từng mẫu (đo được sai khác 0), cả khi con mồi xuống dưới 10⁻¹⁰⁰;
  V lệch 2·10⁻¹⁰ tới 8·10⁻¹⁰ sau 300 đơn vị thời gian và 8·10⁻⁹ sau 3000 (ngưỡng cảnh báo của bài
  10⁻⁶). Chip sai lệch V tính so với V lúc t = 0 qua mọi khung đã chạy. Cảnh 3D logistic dùng công
  thức N(t) tại mọi t (không bước số).
- Tế bào nhân sơ và nhân thực (bản 2D 0.8.0, bản 3D 0.8.1 #148): hình **định tính**, ghi “Minh họa
  — không theo tỉ lệ; số lượng bào quan chỉ để minh họa”; vị trí, hình dạng, màu chỉ để phân biệt
  các bộ phận. Bản 3D vẽ đúng các bộ phận của hình trong SGK cho từng loại tế bào (test), giống nhau
  ở mọi lần dựng; chất lượng Thấp, không có WebGL hoặc mất ngữ cảnh thì dùng hình 2D và nói lí do.
  Tên và chức năng diễn đạt lại theo SGK Sinh học 10 KNTT (Bài 7–8), chờ giáo viên duyệt.
- Từ tế bào đến DNA (0.8.1, #107): mỗi cấp có **một kích thước vẽ đúng số in trong sách** (nhân
  5 µm, crômatit 700 nm, sợi nhiễm sắc 10 nm, B-DNA 2 nm) và một thước tỉ lệ dài đúng; tế bào vẽ
  đường kính 20 µm, một giá trị chọn trong khoảng 10–100 µm của SGK (chú thích ghi rõ). Mọi phần
  khác (bào quan, lỗ màng nhân, hạch nhân, chiều dài cánh NST, số vòng của sợi, số vòng DNA quấn
  quanh histone, trình tự base) là minh họa. Lúc chuyển giữa hai cấp, hình ghi “không theo tỉ lệ”.
  Theo SGK Sinh học 12 (H 7.1), sợi 10 nm gắn thẳng vào khung NST; hình **không vẽ sợi 30 nm**, và
  Thẻ Khoa học ghi lí do (SGK không có cấp này; Ou và cộng sự 2017 không thấy sợi 30 nm trong nhân tế
  bào người). Cấp nhân và cấp NST kép là hai thời điểm khác nhau của chu kì tế bào (thẻ ghi rõ).

## 8. Lưu tệp, lịch sử và quá tải (Giai đoạn 6)

- Tệp `.stemsim` và Lịch sử chỉ lưu **đầu vào** (chủ đề, thông số và nguồn của từng thông số: đề
  bài / mặc định / người dùng). Kết quả luôn được tính lại khi mở, nên không thể có kết quả "cũ" hay
  bị sửa tay. Tệp lạ được kiểm tra bằng Zod; thông số không thuộc chủ đề hoặc sai kiểu bị bỏ qua.
- Khi quá tải, app giảm chất lượng hiển thị hoặc chạy chậm có ghi tỉ lệ; bước tích phân và mô hình
  không đổi (chi tiết: docs/PERFORMANCE.md).
- Watchdog bộ nhớ chỉ giảm số mẫu lưu cho đồ thị (độ phân giải đồ thị), không đụng tới mô phỏng.

## 9. Giới hạn đã biết

Những điểm dưới đây là giới hạn **có chủ ý** của phiên bản 0.1.0; app ghi rõ trong Thẻ Khoa học
tương ứng, không che giấu.

- **Vật lý:** chỉ 2D; bỏ qua lực cản không khí (trừ lực cản của con lắc/lò xo khi người dùng bật);
  con lắc đơn có lực cản là nghiệm số (gần đúng). AI chỉ đọc đề Vật lý; đề Hóa/Sinh dùng thư viện
  chủ đề.
- **Hóa học:** orbital chỉ của nguyên tử hydro (nghiệm giải tích); không tính hóa lượng tử cho nguyên
  tử nhiều electron hay trạng thái chuyển tiếp — các khung trạng thái chuyển tiếp là hình minh họa.
  Tọa độ 3D của phân tử hữu cơ từ trường lực MMFF94 (lệch thực nghiệm < 0,03 Å, < 3°). Độ phân cực
  suy từ Δχ nên PH₃ bị xếp gần như không phân cực. Khí trong mô phỏng hạt là khí **2 chiều**. Phản
  ứng tráng bạc có nhiều cách cân bằng độc lập (app báo "vô số cách cân bằng").
- **Sinh học:** gen không có intron, dịch mã từ AUG đầu tiên, chỉ bảng mã chuẩn; Mendel chỉ xét gen
  phân li độc lập (chưa có liên kết gen/hoán vị gen theo khoảng cách); Hardy–Weinberg 2 alen;
  phiêu bạt theo Wright–Fisher với N không đổi; Lotka–Volterra cổ điển; Michaelis–Menten một cơ
  chất, không thuận nghịch; thẩm thấu theo van 't Hoff cho dung dịch loãng lí tưởng, tốc độ dâng
  cột nước là minh họa.
- **Dữ liệu:** toàn bộ đang chờ giáo viên duyệt (xem `docs/DATA_REVIEW.md`); nguồn SGK chưa ghi số
  trang.
- **Hiệu năng:** số đo trong `docs/PERFORMANCE.md` làm trên máy build (Linux). Chưa đo trên máy tối
  thiểu thật (i3, Intel UHD 620, Windows 10); RAM thật của WebView2 cần đo bằng Task Manager.
- **Bộ cài:** chưa ký số (Windows hiện cảnh báo SmartScreen lần đầu).

## 10. Cách tự kiểm chứng

| Lệnh                                  | Kiểm tra                                                                          | Kết quả (05/10/2026)      |
| ------------------------------------- | --------------------------------------------------------------------------------- | ------------------------- |
| `npm test`                            | Unit test: bộ giải, 13 chủ đề Vật lý, AI (quy tắc kiểm tra), Hóa, Sinh, tệp dự án | 43 tệp, 317 test đạt      |
| `npm run test:e2e`                    | Chạy app thật trong Chromium: AI (giả lập), mọi chủ đề Hóa/Sinh, lưu/mở, lịch sử  | 27 test đạt               |
| `cargo test` (trong `src-tauri`)      | Rust: gọi AI, lịch sử SQLite, lưu tệp, cập nhật trong app                         | 21 test đạt               |
| `npm run golden:llm`                  | 31 đề chuẩn với mô hình Gemini thật (`GEMINI_API_KEY`)                            | tùy mô hình (cần mạng)    |
| `node scripts/perf/measure.mjs`       | Khởi động, bộ nhớ, FPS của bản build                                              | xem `docs/PERFORMANCE.md` |
| Trong app: menu ☰ → Nguồn & Giả định | Nguồn của mọi bộ dữ liệu, số mục chờ duyệt, giả định của chủ đề đang mở           | —                         |
