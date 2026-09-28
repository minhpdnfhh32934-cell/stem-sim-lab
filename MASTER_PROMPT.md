# MASTER PROMPT — Ứng dụng mô phỏng STEM (Vật lý · Hóa học · Sinh học)

> **Cách dùng:** Tạo một thư mục dự án trống, lưu file này vào đó với tên `MASTER_PROMPT.md`, mở
> Claude Code trong thư mục đó và gõ: *Đọc kỹ MASTER_PROMPT.md, tóm tắt lại cho tôi bạn hiểu gì,
> rồi bắt đầu Giai đoạn 0.*

## 0. Vai trò của bạn

Bạn là một kỹ sư phần mềm cấp cao kiêm chuyên gia mô phỏng khoa học (vật lý tính toán, hóa tin học,
sinh học tính toán). Bạn sẽ xây dựng từ đầu một ứng dụng desktop chạy offline trên máy tính cá nhân,
tên tạm là **STEM Sim Lab** (tôi có thể đổi tên sau). Ứng dụng dùng để dự thi Khoa học Kỹ thuật và
các giải STEM, nên phải đạt đồng thời 3 tiêu chí: **đúng khoa học tuyệt đối, chạy mượt trên máy phổ
thông, giao diện đẹp và dễ dùng.**

Người dùng mục tiêu: học sinh THPT, giáo viên và giám khảo. Ngôn ngữ giao diện chính: tiếng Việt (có
sẵn cấu trúc i18n để thêm tiếng Anh). Tôi đang dùng Windows, laptop Lenovo Legion (RTX 5060 Laptop
8GB VRAM, 16GB RAM) — nhưng app **không được giả định máy mạnh như vậy**.

## 1. Ý tưởng sản phẩm

Người dùng nhập đề bài hoặc mô tả tình huống bằng tiếng Việt (hoặc chọn từ thư viện chủ đề), ứng
dụng sẽ:

- **Vật lý:** dựng cảnh 2D (hoặc 3D khi cần) đúng với dữ kiện đề bài; người dùng tương tác bằng chuột
  như một trình mô phỏng vật lý thực (kéo, ném, đổi thông số, đo đạc), xem vectơ lực/vận tốc, đồ thị
  theo thời gian và lời giải được tính từ chính engine.
- **Hóa học:** hiển thị nguyên tử/phân tử 3D có thể xoay, chọn, soi từng liên kết; hiển thị cấu hình
  electron, loại liên kết, hình học phân tử; mô phỏng toàn bộ tiến trình phản ứng từ chất đầu →
  trung gian → sản phẩm, chỉ với các phản ứng đã được kiểm chứng.
- **Sinh học:** mô phỏng tương tác các quá trình sinh học (phân bào, phiên mã – dịch mã, di truyền
  Mendel, quần thể, enzyme, khuếch tán/thẩm thấu…).

## 2. NGUYÊN TẮC TỐI THƯỢNG: TOÀN VẸN KHOA HỌC (không được vi phạm)

Đây là phần quan trọng nhất. Mọi quyết định kỹ thuật phải phục vụ nguyên tắc này.

### 2.1. AI (LLM) KHÔNG BAO GIỜ tự tính toán hay tự bịa ra mô phỏng

- LLM chỉ làm 2 việc: (a) trích xuất dữ kiện đề bài thành JSON có cấu trúc (SceneSpec), (b) diễn
  giải bằng lời các kết quả mà engine đã tính.
- Mọi con số, quỹ đạo, lực, năng lượng, nồng độ, tỉ lệ… đều do engine tất định (deterministic) viết
  bằng code tính ra — không bao giờ lấy từ output của LLM.
- LLM không được đưa vào SceneSpec bất kỳ con số nào không có trong đề. Giá trị mặc định (ví dụ
  g = 9,81 m/s²) do code điền và phải được đánh dấu `"source": "default"` để hiển thị cho người dùng
  thấy.
- Sau khi trích xuất, app phải hiện bảng **"Tôi hiểu đề như sau"** (các đại lượng, đơn vị, giả định)
  để người dùng xác nhận hoặc sửa trước khi chạy mô phỏng. Nếu đề mơ hồ/thiếu dữ kiện → hỏi lại,
  không đoán.

### 2.2. Hóa học: chỉ mô phỏng phản ứng có trong cơ sở dữ liệu đã kiểm chứng

- Mọi phản ứng phải nằm trong thư viện phản ứng được tuyển chọn (curated), mỗi mục bắt buộc có:
  phương trình cân bằng, điều kiện (nhiệt độ, xúc tác, dung môi…), các bước cơ chế (nếu đã được xác
  lập), nguồn trích dẫn (SGK Hóa 10–12, giáo trình đại học, IUPAC, tài liệu khoa học), và trạng thái
  duyệt.
- Nếu người dùng nhập phản ứng không có trong thư viện: app được phép kiểm tra cân bằng nguyên
  tử/điện tích bằng đại số tuyến tính, nhưng phải hiển thị rõ: *"Phản ứng này chưa có trong cơ sở dữ
  liệu đã kiểm chứng — không hiển thị cơ chế"*. Tuyệt đối không để LLM sinh cơ chế, trạng thái chuyển
  tiếp hay sản phẩm.
- Chuyển động nội suy giữa các khung hình cơ chế (keyframe) phải gắn nhãn: *"Chuyển tiếp minh họa —
  không phải quỹ đạo nguyên tử thực"*. Các keyframe (chất đầu, trung gian, trạng thái chuyển tiếp,
  sản phẩm) phải theo tài liệu.
- Cấu hình electron lấy từ bảng dữ liệu (gồm các ngoại lệ như Cr, Cu, Mo, Ag…), không suy ra từ quy
  tắc Aufbau.

### 2.3. Mỗi mô phỏng đều có "Thẻ Khoa học" (Science Card)

Hiển thị trong app, gồm:

- Mô hình sử dụng (ví dụ: "chất điểm, bỏ qua lực cản không khí", "dao động điều hòa – gần đúng góc
  nhỏ", "mô hình Bohr – mang tính lịch sử, giản lược").
- Phương trình dùng để tính (render bằng KaTeX).
- Giả định và phạm vi hợp lệ (ví dụ: gần đúng góc nhỏ chỉ đúng khi θ₀ ≲ 10°).
- Mức độ tin cậy, một trong ba:
  - **Định lượng chính xác** (nhãn xanh lá) — khớp lời giải giải tích trong sai số cho phép.
  - **Định lượng gần đúng** (nhãn vàng) — tích phân số, có ghi sai số ước lượng.
  - **Định tính / minh họa** (nhãn xanh dương) — chỉ minh họa khái niệm, không dùng để đọc số liệu.
- Nguồn dữ liệu/hằng số.

### 2.4. Nguồn dữ liệu chuẩn

- Hằng số vật lý: CODATA (NIST) mới nhất.
- Nguyên tố: khối lượng nguyên tử IUPAC, độ âm điện Pauling, bán kính cộng hóa trị (Cordero et al.
  2008), màu CPK/Jmol.
- Cấu trúc 3D phân tử: tọa độ conformer từ PubChem (public domain), đóng gói sẵn offline; dùng
  RDKit.js để đọc SMILES, kiểm tra hóa trị, sinh cấu trúc 2D.
- Mã di truyền: bảng mã chuẩn NCBI (translation table 1).
- **Quy tắc với chính bạn (Claude Code):** không được tự bịa dữ liệu khoa học. Nếu không chắc một
  giá trị/phản ứng/cơ chế, hãy để `TODO` và ghi vào `docs/DATA_REVIEW.md`. Mọi mục dữ liệu bạn tạo
  đều có trường `review_status: "pending" | "verified"`. App hiển thị huy hiệu "Đang chờ giáo viên
  duyệt" cho mục pending. Tôi sẽ nhờ giáo viên duyệt.

### 2.5. Khi người dùng can thiệp

Khi người dùng kéo/ném vật bằng chuột giữa chừng, lời giải giải tích không còn áp dụng → app tự
chuyển nhãn sang mức "Định lượng gần đúng" và ghi "Đã có can thiệp — kết quả là mô phỏng số".

## 3. Kiến trúc & công nghệ

Dùng bản stable mới nhất của mỗi thư viện (tự kiểm tra version khi cài). Giải thích ngắn nếu bạn
muốn thay thư viện nào.

| Lớp | Công nghệ |
| --- | --------- |
| Vỏ desktop | Tauri 2 (Rust) — file cài nhẹ, ít RAM |
| Giao diện | React + TypeScript (strict) + Vite, state: Zustand |
| Style | CSS variables / Tailwind, icon Lucide (dạng nét – outline) có animation nhẹ, không dùng emoji màu trong UI |
| Đồ họa 2D | Canvas 2D hoặc PixiJS (WebGL) cho cảnh nhiều đối tượng |
| Đồ họa 3D | three.js qua @react-three/fiber + drei, dùng InstancedMesh cho phân tử |
| Vật lý sandbox | Rapier (WASM, 2D & 3D) cho va chạm vật rắn tương tác tự do |
| Vật lý bài toán SGK | Solver tự viết (RK4, Velocity Verlet, bộ giải ODE thích nghi RK45, solver implicit cho hệ cứng) — để kiểm soát độ chính xác và so với lời giải giải tích |
| Hóa tin | RDKit.js (WASM) |
| Công thức | KaTeX |
| Đồ thị | uPlot (nhẹ, nhanh, realtime) |
| Kiểm tra dữ liệu | Zod (schema cho SceneSpec và dữ liệu) |
| Lưu trữ | SQLite (tauri-plugin-sql) cho thư viện/lịch sử; file dự án `.stemsim` (JSON) |
| Tính toán nặng | Web Worker (+ OffscreenCanvas khi phù hợp); phần cực nặng có thể viết Rust/WASM |
| Test | Vitest (unit), Playwright (E2E), cargo test (Rust) |

### 3.1. Lớp AI (đọc đề)

- **Mặc định: local qua LM Studio** — API tương thích OpenAI tại `http://localhost:1234/v1`, dùng
  structured output (`response_format` với JSON schema) để ép đúng định dạng SceneSpec. Model do
  người dùng chọn trong Cài đặt (tôi đang dùng Qwen3.5-9B / 4B).
- Tùy chọn: API cloud (Anthropic Claude, OpenAI) — người dùng tự nhập key; key lưu trong keychain
  của hệ điều hành, không lưu plaintext.
- Mọi lời gọi AI đi qua backend Rust (tránh CORS, giấu key), có timeout, hủy được, có retry giới hạn.
- **Không có AI vẫn dùng được:** chế độ "Tự dựng cảnh" (kéo thả vật thể, nhập thông số bằng form) và
  thư viện bài mẫu. App tự phát hiện LM Studio có đang chạy không và hiện trạng thái rõ ràng.
- Pipeline: Đề bài → LLM → JSON → Zod validate → kiểm tra nhất quán vật lý (đơn vị, dấu, miền giá
  trị) → bảng xác nhận → engine. JSON sai → gửi lại lỗi cho LLM tối đa 2 lần → nếu vẫn sai thì mở
  form cho người dùng tự điền.

### 3.2. Ví dụ SceneSpec (tham khảo, bạn thiết kế đầy đủ)

```json
{
  "domain": "physics",
  "topic": "projectile",
  "dimension": "2d",
  "objects": [
    { "id": "ball", "type": "point_mass",
      "mass": { "value": 0.5, "unit": "kg", "source": "problem" },
      "initial_position": { "value": [0, 20], "unit": "m", "source": "problem" },
      "initial_velocity": { "magnitude": 15, "angle_deg": 30, "unit": "m/s", "source": "problem" } }
  ],
  "environment": {
    "gravity": { "value": 9.81, "unit": "m/s^2", "source": "default" },
    "air_resistance": false
  },
  "questions": [ { "id": "q1", "ask": "time_of_flight" }, { "id": "q2", "ask": "range" } ],
  "unsupported_parts": []
}
```

- Nội bộ dùng đơn vị SI, hệ tọa độ trục y hướng lên, đơn vị mét; hiển thị cho phép đổi đơn vị.
- Phần đề mà engine chưa hỗ trợ phải được đưa vào `unsupported_parts` và báo cho người dùng, không
  được lặng lẽ xấp xỉ.

### 3.3. Cấu trúc thư mục gợi ý

```
src/
  app/            # shell, routing, layout, theme, i18n
  ui/             # component dùng chung (design system)
  ai/             # client LLM, prompt trích xuất, schema, pipeline
  core/           # đơn vị, hằng số, bộ tích phân số, vector math
  physics/        # engine + scene từng chủ đề + test
  chemistry/      # nguyên tố, phân tử, renderer, thư viện phản ứng, cân bằng PT
  biology/        # các mô-đun sinh học
  science-card/   # Thẻ Khoa học
  perf/           # đo hiệu năng, quality tier, watchdog
  workers/
data/             # JSON dữ liệu khoa học (có nguồn + review_status)
src-tauri/        # backend Rust
docs/             # ARCHITECTURE.md, SCIENCE_ACCURACY.md, DATA_REVIEW.md, USER_GUIDE.md
tests/            # golden tests, e2e
```

## 4. Tối ưu cho đa số cấu hình máy hiện nay

### 4.1. Cấu hình mục tiêu

- **Tối thiểu (phải chạy được):** CPU 4 nhân (i3/Ryzen 3 đời ~2018), 8GB RAM, GPU tích hợp (Intel
  UHD 620), màn hình 1366×768, Windows 10.
- **Khuyến nghị:** 16GB RAM, GPU rời bất kỳ, 1920×1080.
- Hỗ trợ chính Windows 10/11; build được cho macOS/Linux.

### 4.2. Ngân sách hiệu năng (đo và ghi vào docs/PERFORMANCE.md)

- 2D: 60 FPS trên máy tối thiểu với cảnh SGK điển hình; 3D: ≥ 30 FPS.
- Khởi động lạnh < 3 giây; RAM của app (không tính LLM) < 300MB khi chạy cảnh thường.
- File cài đặt (gồm dữ liệu) mục tiêu < 80MB.
- Lazy-load từng mô-đun (Vật lý/Hóa/Sinh), RDKit.js và dữ liệu phân tử chỉ tải khi cần.

### 4.3. Quality tier tự động

Lần chạy đầu làm benchmark nhanh (~2 giây) → chọn Thấp / Trung bình / Cao (pixel ratio, khử răng
cưa, bóng đổ, số hạt tối đa, mức chi tiết phân tử). Người dùng chỉnh lại được trong Cài đặt. WebGL2
là chuẩn; WebGPU chỉ dùng khi có và ổn định.

### 4.4. Tách vật lý khỏi render

- Bước vật lý cố định (fixed timestep, ví dụ 1/240 s) với accumulator; render nội suy giữa hai trạng
  thái.
- Giới hạn số substep mỗi frame để tránh "spiral of death".
- Mô phỏng chạy trong Web Worker, UI thread chỉ vẽ.

## 5. Xử lý khi mô phỏng bị QUÁ TẢI

Nguyên tắc: **ưu tiên giữ độ chính xác, hy sinh độ mượt trước; không bao giờ giảm độ chính xác một
cách âm thầm.** Hãy cài đặt "thang hạ cấp" (degradation ladder) sau, kích hoạt khi thời gian frame
vượt ngân sách trong N frame liên tiếp:

1. **Hạ chất lượng hiển thị** (không ảnh hưởng số liệu): giảm pixel ratio, tắt bóng đổ/hậu kỳ, giảm
   tần suất cập nhật đồ thị.
2. **Chuyển chế độ "chuyển động chậm":** giữ nguyên độ chính xác vật lý nhưng thời gian mô phỏng chạy
   chậm hơn thời gian thực — hiển thị rõ tỉ lệ (ví dụ "×0,25").
3. **Mức chi tiết (LOD) cho phân tử:** ball-and-stick → stick → wireframe; > 500 nguyên tử → dạng
   cartoon/bề mặt; instancing cho nguyên tử cùng loại.
4. **Thuật toán tăng tốc:** spatial hashing / grid cho va chạm hạt, Barnes–Hut cho tương tác nhiều
   vật, sleep cho vật đứng yên.
5. **Hạt đại diện (thống kê):** với mô phỏng hàng nghìn phân tử (khí, khuếch tán, động học phản
   ứng), mỗi hạt hiển thị đại diện cho N phân tử — phải ghi rõ "1 hạt = N phân tử" và kết quả định
   lượng lấy từ phương trình vĩ mô (ODE), không từ đếm hạt.
6. **Giới hạn cứng:** vượt ngưỡng (ví dụ > 5.000 vật thể) → tạm dừng và hiện hộp thoại giải thích,
   gợi ý giảm quy mô. Không để app treo.

**Ổn định số học** (cũng là một dạng quá tải):

- Theo dõi sai lệch năng lượng/động lượng của hệ bảo toàn; nếu sai lệch > ngưỡng (ví dụ 0,1%) → tự
  giảm bước thời gian hoặc đổi bộ tích phân; nếu vẫn vượt → hạ nhãn xuống "Định lượng gần đúng" kèm
  sai số.
- Hệ phương trình cứng (stiff: động học hóa học, Hodgkin–Huxley) → dùng solver implicit/thích nghi.
- Phát hiện NaN/Infinity → dừng, khôi phục trạng thái hợp lệ gần nhất, báo lỗi thân thiện.

**Quá tải phía AI:** timeout (mặc định 60 s, chỉnh được), nút hủy, hàng đợi yêu cầu; đề quá dài/phức
tạp → tách thành các phần; LM Studio không phản hồi → gợi ý chuyển sang API cloud hoặc chế độ "Tự
dựng cảnh".

**Watchdog bộ nhớ:** theo dõi RAM; gần ngưỡng → giải phóng cache phân tử/texture không dùng, cảnh báo
người dùng.

## 6. Nội dung khoa học — phạm vi MVP rồi mở rộng

Làm sâu và chắc trước, mở rộng sau. Mỗi chủ đề phải có: cảnh mẫu, tương tác chuột, Thẻ Khoa học, đồ
thị, test đối chiếu.

### 6.1. Vật lý (MVP)

- **Động học:** thẳng đều, thẳng biến đổi đều, rơi tự do, ném ngang, ném xiên.
- **Động lực học:** các định luật Newton, mặt phẳng nghiêng có/không ma sát (nghỉ & trượt), ròng rọc
  – dây nối, lò xo (Hooke).
- **Năng lượng & động lượng:** bảo toàn cơ năng, va chạm đàn hồi / mềm (1D, 2D).
- **Dao động:** con lắc lò xo; con lắc đơn hiển thị song song nghiệm gần đúng góc nhỏ và nghiệm phi
  tuyến chính xác để thấy khác biệt.
- **Tương tác chuột:** kéo vật (dùng ràng buộc lò xo giữa chuột và vật, không "dịch chuyển tức
  thời"), ném theo vận tốc kéo, chỉnh thông số bằng thanh trượt khi đang chạy, công cụ thước đo,
  thước đo góc, đồng hồ bấm giờ, bật/tắt vectơ lực/vận tốc/gia tốc, vết quỹ đạo.
- **Lời giải:** engine tính đáp số → hiển thị từng bước với công thức KaTeX; LLM chỉ diễn giải bằng
  lời dựa trên kết quả đó.

### 6.2. Vật lý (mở rộng sau)

Mạch điện DC (giải bằng Modified Nodal Analysis), điện trường/đường sức của điện tích điểm, từ
trường dòng điện, quang hình (định luật Snell, gương, thấu kính — ray tracing), sóng & giao thoa, 3D
cho bài toán không gian.

### 6.3. Hóa học (MVP)

- **Nguyên tử:** bảng tuần hoàn tương tác; cấu hình electron (từ bảng dữ liệu); mô hình Bohr (gắn
  nhãn "giản lược"); hình dạng orbital — chính xác cho nguyên tử hydro (hàm sóng giải tích), với
  nguyên tử khác gắn nhãn định tính.
- **Phân tử 3D:** tìm theo tên (Việt/Anh), công thức, SMILES; xoay/zoom/chọn; hiện liên kết
  đơn/đôi/ba/thơm, độ dài liên kết, góc liên kết, cặp electron tự do (VSEPR), độ phân cực theo hiệu
  độ âm điện. Kiểm tra hình học với giá trị tham chiếu trong test.
- **Thư viện phản ứng** (~30–50 phản ứng trong chương trình SGK có nguồn rõ ràng): phương trình cân
  bằng, điều kiện, timeline cơ chế từng bước có thể tua, dừng, xoay 3D; chỉ số nguyên tử được ánh xạ
  (atom mapping) để thấy liên kết nào đứt/tạo.
  - Ví dụ nhóm nên có: đốt cháy CH₄, tổng hợp H₂O, trung hòa axit–bazơ, phản ứng thế SN1/SN2, tách
    E1/E2, cộng HBr vào anken (Markovnikov), este hóa, oxi hóa–khử cơ bản. Bạn phải kiểm tra lại
    từng phản ứng trước khi đưa vào và gắn nguồn.
- **Mức hạt:** mô phỏng thuyết va chạm, phân bố Maxwell–Boltzmann, cân bằng hóa học & nguyên lý Le
  Chatelier (tốc độ từ định luật tốc độ, tích phân ODE).
- **Cân bằng phương trình:** thuật toán ma trận (null space) cho phương trình người dùng nhập — kèm
  cảnh báo mục 2.2.

### 6.4. Sinh học (MVP)

- **Nguyên phân & giảm phân:** các kỳ đúng thứ tự, số NST/cromatit đúng ở từng kỳ (bộ 2n chỉnh
  được), có trao đổi chéo ở giảm phân I.
- **ADN → mARN → Protein:** người dùng nhập trình tự; phiên mã, dịch mã theo bảng mã di truyền chuẩn;
  hiển thị codon mở đầu/kết thúc, đột biến điểm và hậu quả.
- **Di truyền Mendel:** bảng Punnett, lai 1–2 cặp tính trạng, mô phỏng Monte Carlo so với tỉ lệ lý
  thuyết.
- **Di truyền quần thể:** Hardy–Weinberg, phiêu bạt di truyền.
- **Sinh thái:** tăng trưởng logistic, Lotka–Volterra (con mồi – vật ăn thịt).
- **Enzyme:** động học Michaelis–Menten, ảnh hưởng của chất ức chế.
- **Khuếch tán & thẩm thấu:** mô phỏng hạt qua màng bán thấm.
- (Mở rộng sau: điện thế hoạt động Hodgkin–Huxley với tham số kinh điển, quang hợp & hô hấp dạng sơ
  đồ giai đoạn.)

## 7. Giao diện (UI/UX)

### 7.1. Bố cục chính

- **Thanh trên:** ô "Nhập đề bài…" lớn (hỗ trợ dán nhiều dòng, dán ảnh đề để mở rộng sau), chọn môn,
  trạng thái AI (local/cloud/offline).
- **Cột trái:** thư viện chủ đề theo môn → chương → bài mẫu; lịch sử mô phỏng.
- **Trung tâm:** khung mô phỏng (canvas 2D/3D), thanh công cụ nổi (chọn, kéo, đo, vectơ, camera).
- **Cột phải (Inspector):** thuộc tính đối tượng đang chọn, thanh trượt thông số, Thẻ Khoa học.
- **Dưới:** timeline (Play/Pause/Step từng bước/tua/tốc độ ×0,1–×4), bảng đồ thị (x-t, v-t, a-t,
  năng lượng, nồng độ…), bảng lời giải.
- Các panel thu gọn/kéo giãn được; nhớ bố cục.

### 7.2. Phong cách

- Hiện đại, sạch, tối giản; dark mode & light mode; bảng màu thân thiện với người mù màu cho đồ thị.
- Icon outline (Lucide) có micro-animation tinh tế; chuyển cảnh mượt nhưng không lòe loẹt.
- Chữ dễ đọc, hỗ trợ đầy đủ tiếng Việt có dấu; phóng to cỡ chữ.
- **Chế độ Trình chiếu** cho buổi chấm thi: toàn màn hình, chữ to, ẩn panel phụ.
- Tour hướng dẫn lần đầu mở app; tooltip cho mọi nút; phím tắt (Space = chạy/dừng, R = reset,
  Ctrl+Z/Ctrl+Y…).

### 7.3. Tính năng tiện ích

Undo/Redo, lưu/mở file `.stemsim`, xuất ảnh PNG, xuất dữ liệu CSV, trang "Nguồn & Giả định" tổng hợp
mọi nguồn dữ liệu (rất có giá trị khi trình bày với giám khảo).

## 8. Kiểm thử & đảm bảo độ chính xác

- Unit test mọi solver so với lời giải giải tích (ném xiên, dao động điều hòa, va chạm, logistic…)
  với dung sai ghi rõ.
- **Golden test set:** ít nhất 30 bài tập Vật lý SGK 10–12 (đề tiếng Việt → SceneSpec mong đợi → đáp
  số mong đợi). Chạy được với LLM local để đo tỉ lệ trích xuất đúng.
- Hóa: mọi phản ứng trong thư viện qua test bảo toàn nguyên tử & điện tích; hình học phân tử khớp
  tham chiếu (độ dài liên kết, góc VSEPR) trong dung sai.
- Sinh: test bảng mã di truyền, số NST từng kỳ phân bào, tỉ lệ Mendel/Hardy–Weinberg.
- E2E (Playwright): luồng nhập đề → xác nhận → mô phỏng → xem lời giải.
- Benchmark hiệu năng tự động với cảnh chuẩn; ghi kết quả vào `docs/PERFORMANCE.md`.
- Tài liệu `docs/SCIENCE_ACCURACY.md`: mô tả mô hình, sai số, nguồn — dùng làm tài liệu nộp kèm cuộc
  thi.

## 9. Lộ trình làm việc (theo giai đoạn)

Làm tuần tự. **Hết mỗi giai đoạn: chạy toàn bộ test, cập nhật docs, dừng lại báo cáo cho tôi (đã làm
gì, chạy thế nào, còn gì chưa xong) và chờ tôi đồng ý mới sang giai đoạn tiếp.**

| GĐ | Nội dung | Tiêu chí hoàn thành |
| -- | -------- | ------------------- |
| 0 | Khởi tạo dự án Tauri + React + TS; CLAUDE.md, docs/ARCHITECTURE.md; design system, layout rỗng, theme, i18n; CI chạy lint + test | `npm run tauri dev` mở được app với bố cục đầy đủ |
| 1 | Core: đơn vị, hằng số, bộ tích phân, fixed timestep, worker, quality tier, Thẻ Khoa học | Test solver pass; benchmark chạy |
| 2 | Vật lý 2D MVP (mục 6.1) + tương tác chuột + đồ thị + lời giải | Mọi chủ đề có test so giải tích; 60 FPS trên cấu hình tối thiểu |
| 3 | Lớp AI: LM Studio + cloud, SceneSpec, bảng xác nhận, chế độ "Tự dựng cảnh" | Golden test chạy; app vẫn dùng được khi tắt AI |
| 4 | Hóa học MVP (mục 6.3) | Test bảo toàn & hình học pass; mọi phản ứng có nguồn |
| 5 | Sinh học MVP (mục 6.4) | Test sinh học pass |
| 6 | Thang hạ cấp quá tải, watchdog, tối ưu, chế độ trình chiếu, tour hướng dẫn | Đạt ngân sách mục 4.2 |
| 7 | Đóng gói bộ cài Windows (.msi/.exe), hướng dẫn sử dụng, SCIENCE_ACCURACY.md hoàn chỉnh | Cài được trên máy sạch, chạy offline |
| 8+ | Mở rộng (mục 6.2, 3D nâng cao, sinh học nâng cao) | Theo yêu cầu |

## 10. Quy tắc làm việc cho Claude Code

- Lập kế hoạch trước khi code mỗi giai đoạn; trình bày ngắn gọn cho tôi.
- Tạo và duy trì `CLAUDE.md` ghi quy ước dự án, lệnh build/test, và nhắc lại Nguyên tắc tối thượng
  (mục 2).
- Code sạch, có kiểu dữ liệu chặt chẽ; comment code bằng tiếng Anh, chuỗi hiển thị qua i18n (tiếng
  Việt).
- Không bỏ qua hay tắt test để cho "xanh". Test fail → sửa code hoặc báo tôi.
- Gặp điểm khoa học không chắc chắn → hỏi tôi hoặc ghi vào `DATA_REVIEW.md`, không đoán.
- Commit git theo từng tính năng nhỏ, thông điệp rõ ràng.
- Tôi là người mới học lập trình (có nền Python, đang học Java): khi báo cáo, giải thích ngắn gọn,
  dễ hiểu những gì bạn làm và vì sao; hướng dẫn cài công cụ cần thiết (Node.js, Rust, Visual Studio
  Build Tools/WebView2 cho Tauri trên Windows) theo từng bước.
- Ưu tiên giải pháp nhẹ, ít phụ thuộc; mỗi thư viện thêm vào phải có lý do.

**Bắt đầu:** Hãy tóm tắt lại cách bạn hiểu dự án (≤ 15 dòng), liệt kê công cụ tôi cần cài trên
Windows, rồi thực hiện Giai đoạn 0.
