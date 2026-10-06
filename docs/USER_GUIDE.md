# Hướng dẫn sử dụng STEM Sim Lab

STEM Sim Lab mô phỏng Vật lý, Hóa học và Sinh học THPT ngay trên máy tính, **không cần mạng**. Mọi
con số do chương trình tính; mỗi mô phỏng có **Thẻ Khoa học** ghi rõ mô hình, phương trình, giả định,
độ tin cậy và nguồn.

## Cài đặt

**Yêu cầu:** Windows 10 hoặc 11 (64-bit), RAM từ 8 GB, màn hình từ 1366×768.

1. Tải bộ cài ở trang **Releases** của dự án trên GitHub (mục _Assets_). Có **hai bản**:
   - `STEM Sim Lab_…_x64-setup.exe` — **bản chính**, cho sinh viên từ 18 tuổi (AI: Gemini mặc định,
     Claude tùy chọn).
   - `STEM Sim Lab THPT_…_x64-setup.exe` — **bản thử nghiệm THPT**, chỉ dùng trong buổi thử nghiệm
     có người giám sát (Claude, không có Gemini; khóa API do người giám sát nhập bằng mã PIN; có
     cổng độ tuổi và đồng ý của phụ huynh).
2. Nhấp đúp để chạy. Windows có thể hiện "Windows protected your PC" vì bộ cài chưa được ký số: bấm
   **More info → Run anyway**.
3. Bộ cài không cần quyền quản trị (cài cho người dùng hiện tại). Xong, mở app từ menu Start.

Chỉ cần cài **một lần**. Các bản sau cập nhật ngay trong app (mục "Cập nhật phần mềm").

Hai bản **cài song song được** trên cùng một máy (ví dụ máy phòng thực hành): mỗi bản có tên trong
menu Start, dữ liệu, khóa AI và mã PIN riêng, không ảnh hưởng nhau.

### Windows chặn bộ cài ("Smart App Control blocked an app")

Smart App Control (Windows 11) chặn mọi chương trình **chưa có chữ ký số** mà Microsoft chưa biết;
hộp thoại này không có nút "Run anyway". Bộ cài STEM Sim Lab chưa được ký số (chứng chỉ ký số tốn
phí, và dịch vụ Azure Artifact Signing chưa nhận người dùng ở Việt Nam). Cách xử lý:

1. Có thể thử bộ cài `.msi` trong cùng thư mục tải về (không chắc được cho qua).
2. Nếu vẫn bị chặn: **Windows Security → App & browser control → Smart App Control settings** →
   chọn **Off**, cài app, rồi bật lại **On**. (Từ bản cập nhật Windows KB5083769, tháng 4/2026, có
   thể bật lại mà không phải cài lại Windows. Máy cũ hơn thì tắt là tắt hẳn — hãy cân nhắc.)
3. Gửi tệp cho Microsoft xét duyệt: <https://www.microsoft.com/wdsi/filesubmission> (chọn
   "Software developer"); sau khi được duyệt, Windows ngừng chặn tệp đó.

Sau lần cài này, các bản cập nhật trong app **không cài thêm tệp .exe nào**, nên Smart App Control
không chặn nữa.

**WebView2:** app dùng WebView2 của Microsoft Edge để hiển thị. Windows 11 và hầu hết máy Windows 10
đã có sẵn. Nếu máy chưa có, bộ cài sẽ tự tải (cần mạng một lần). Máy không có mạng: tải trước
**"Evergreen Standalone Installer"** tại <https://developer.microsoft.com/microsoft-edge/webview2/>,
chép qua USB và cài trước.

**Gỡ cài đặt:** Settings → Apps → STEM Sim Lab (hoặc STEM Sim Lab THPT) → Uninstall. Lịch sử mô
phỏng nằm trong `%APPDATA%\vn.stemsimlab.desktop\history.sqlite` (bản THPT:
`%APPDATA%\vn.stemsimlab.pilot\`).

### Tạo bộ cài

- **Cách 1 — GitHub (không cần cài gì trên máy):** đưa mã nguồn lên một kho GitHub, vào tab
  **Actions → Release (Windows installer) → Run workflow**. Khoảng 15–25 phút sau, mở lần chạy có
  tên **Release (Windows installer)** (không phải lần chạy "CI" — CI chỉ kiểm tra lỗi, không tạo bộ
  cài), kéo xuống cuối trang **Summary** để thấy mục **Artifacts → stem-sim-lab-windows**. Tệp zip
  tải về chứa bộ cài `…x64-setup.exe` (khuyên dùng) và `.msi` của **cả hai bản**, cùng
  `installer-sizes.txt`. Khi chọn `publish` = true, GitHub còn tạo bản Release để mọi máy đã cài tự
  nhận cập nhật (xem `docs/RELEASE.md`).
- **Cách 2 — trên máy Windows của bạn:** cài công cụ theo `docs/SETUP_WINDOWS.md`, rồi chạy
  `npm install` và `npm run tauri build`. Bộ cài nằm trong `src-tauri\target\release\bundle\nsis\`.
  Bản THPT:
  `npx tauri build --config src-tauri/tauri.pilot.conf.json --features edition-pilot -- --no-default-features`.

## Bắt đầu nhanh

1. Lần đầu mở app có vài bước làm quen (bấm **Bỏ qua** bất cứ lúc nào):
   - **Bản chính:** chọn trình độ → chọn môn quan tâm → xác nhận đủ 18 tuổi và điều khoản →
     **Kết nối AI** (nhập khóa Gemini, hoặc **Để sau**) → hướng dẫn nhanh.
   - **Bản thử nghiệm THPT:** chọn môn → cổng độ tuổi / đồng ý của phụ huynh (người giám sát nhập
     PIN) → hướng dẫn nhanh. Không có bước nhập khóa.
     Hướng dẫn nhanh mở lại được bằng menu ☰ → Hướng dẫn nhanh. App cũng đo nhanh sức mạnh máy
     (khoảng 1 giây) để chọn chất lượng hiển thị.
2. **Trang chủ "Hôm nay học gì?"** hiện khi chưa mở chủ đề nào:
   - nút **Tiếp tục bài đang học** (mở lại chủ đề lần trước);
   - ô **Nhập đề bài hoặc câu hỏi…** (dán được đề nhiều dòng, Ctrl+Enter để phân tích) và nút
     **Tự dựng cảnh** (không cần AI);
   - 3 thẻ môn **Vật lý · Hóa học · Sinh học** (bấm để xem các chủ đề của môn trong Thư viện);
   - **chủ đề gợi ý** theo trình độ, môn bạn quan tâm được gợi ý trước;
   - **Dạy học bằng AI** (sắp có).
     Bấm logo **STEM Sim Lab** ở góc trái để quay về trang chủ.
3. Chọn một chủ đề (trang chủ hoặc **Thư viện** bên trái), chỉnh thông số ở cột phải, bấm ▶ (hoặc
   Space) để chạy.
4. Đọc **Thẻ Khoa học** ở cột phải để biết mô hình và mức độ tin cậy của kết quả.

### Trình độ: Nền tảng và Đại cương

Thư viện sắp xếp theo **Trình độ → Môn → Chủ đề**. **Nền tảng** là kiến thức gốc, tương đương
chương trình THPT — mọi chủ đề hiện có nằm ở đây. **Đại cương** (các môn năm nhất đại học) sẽ có ở
giai đoạn sau. Việc ghép chủ đề với bài cụ thể trong sách giáo khoa đang chờ giáo viên duyệt
(`docs/DATA_REVIEW.md`, mục 12).

### Chế độ Cơ bản và Nâng cao

Đổi ở đầu cột **Thuộc tính** hoặc Cài đặt → Giao diện → **Chế độ hiển thị**.

- **Cơ bản** (mặc định): 3–5 thông số quan trọng nhất (nút **Thêm thông số** để xem phần còn lại;
  giá trị lấy từ đề bài hoặc bạn đã chỉnh thì luôn hiện), thẻ dưới **Đồ thị · Lời giải**, thanh
  công cụ chỉ có chọn, kéo, thước đo, vectơ và căn khung nhìn.
- **Nâng cao:** thêm mục Đối tượng, mọi thông số, thước đo góc, đồng hồ bấm giờ, vết quỹ đạo, thẻ
  **Số liệu** và **Xuất CSV**.

Người đã dùng bản cũ được giữ ở chế độ Nâng cao như trước.

### Học bằng khám phá: Dự đoán trước, Thử thách, Gợi ý từng bước

Với mỗi chủ đề Vật lý, mở thẻ **Thử thách** ở bảng dưới:

- **Dự đoán trước** (Dự đoán → Quan sát → Giải thích): chọn điều bạn nghĩ sẽ xảy ra (ví dụ "thả
  từ độ cao gấp đôi thì thời gian rơi thay đổi thế nào?"), bấm **Chạy để kiểm tra** để xem mô
  phỏng với giá trị mới và so sánh con số trước/sau, rồi tự viết lời giải thích của bạn (không lưu,
  không gửi đi). Đáp án đúng do chương trình tính, không ai viết sẵn.
- **Thử thách nhỏ**: ví dụ "chỉnh góc ném để vật bay xa nhất". Bấm **Bắt đầu thử thách**, chỉ chỉnh
  thông số được nêu; ô "Hiện tại / Mục tiêu" cập nhật ngay, có nút **Xem gợi ý**.
- **Gợi ý từng bước**: khi bạn nhập đề bài, thẻ **Lời giải** ẩn đáp số để bạn tự giải trước: bấm
  **Gợi ý 1**, **Gợi ý 2**… đến **Lời giải đầy đủ**, hoặc **Xem lời giải ngay** để đối chiếu.
- **Tiến độ và huy hiệu**: chủ đề hoàn thành (đã mở, đã dự đoán, đã làm thử thách) có dấu ✓ trong
  Thư viện, mỗi chương có số "đã xong/tổng". Huy hiệu hiện ở trang chủ. Không có chuỗi ngày hay
  bảng xếp hạng. Tiến độ chỉ lưu trên máy này.
- **Nhắc nghỉ mắt**: sau khoảng 45 phút dùng liên tục, app hiện một lời nhắc nhỏ (không chặn màn
  hình). Nghỉ từ 5 phút trở lên thì đếm lại từ đầu.

## Bố cục màn hình

- **Thanh trên:** chọn môn, ô nhập đề bài, trạng thái AI, các nút ẩn/hiện bảng, sáng/tối, trình
  chiếu, cài đặt.
- **Cột trái:** Thư viện chủ đề và Lịch sử.
- **Giữa:** khung mô phỏng và thanh công cụ nổi. Bên dưới là thanh thời gian (chạy, dừng, tua,
  tốc độ).
- **Dưới:** Đồ thị, Lời giải, Số liệu.
- **Cột phải:** Thuộc tính của vật đang chọn, thông số và Thẻ Khoa học.

Các cột và bảng đều kéo giãn được bằng cách kéo đường viền. Nhấp đúp vào đường viền để trả về kích
thước mặc định. App tự nhớ bố cục cho lần mở sau.

## Thẻ Khoa học và mức tin cậy

| Nhãn                            | Ý nghĩa                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| **Định lượng chính xác** (xanh) | Khớp lời giải giải tích (công thức) trong sai số ghi trên thẻ                               |
| **Định lượng gần đúng** (vàng)  | Tích phân số, có kiểm soát sai số                                                           |
| **Định tính / minh họa** (lam)  | Chỉ minh họa khái niệm, không đọc số liệu từ hình                                           |
| **Đang chờ giáo viên duyệt**    | Dữ liệu chưa được giáo viên đối chiếu nguồn (xem `docs/DATA_REVIEW.md`)                     |
| **Đã có can thiệp**             | Bạn đã kéo/ném vật bằng chuột: lời giải công thức không còn áp dụng, kết quả là mô phỏng số |

## Vật lý

13 chủ đề: chuyển động thẳng đều, thẳng biến đổi đều, rơi tự do, ném ngang, ném xiên, định luật
Newton, mặt phẳng nghiêng, ròng rọc – dây nối, lò xo (Hooke), bảo toàn cơ năng, va chạm, con lắc lò
xo, con lắc đơn.

- **Thông số** (cột phải): kéo thanh trượt hoặc gõ số. Nhãn **đề bài / mặc định / đã chỉnh** cho biết
  giá trị đến từ đâu. Ví dụ g = 9,81 m/s² là mặc định khi đề không cho (đổi trong Cài đặt → Vật lý).
- **Thanh công cụ nổi** trên khung mô phỏng: Chọn (V), Kéo/ném vật (H), Thước đo (M), Thước đo góc
  (A), Đồng hồ bấm giờ (T), hiện vectơ, vết quỹ đạo, căn vừa khung nhìn (F). Lăn chuột để phóng to,
  kéo nền để di chuyển.
- **Thanh thời gian:** chạy/dừng, bước từng khung, đặt lại, kéo để tua lại, chọn tốc độ ×0,1 đến ×4
  (và tua nhanh cho bài toán tính bằng giờ).
- **Bảng dưới:** **Đồ thị** (x–t, v–t, a–t, năng lượng), **Lời giải** (công thức và các bước, đáp số
  đề hỏi được đánh dấu), **Số liệu** (bảng giá trị, nút Xuất CSV).

## Đọc đề bằng AI

1. Dán đề vào ô **Đề bài** ở thanh trên, bấm **Phân tích đề** (hoặc Ctrl+Enter).
2. App mở bảng **"Tôi hiểu đề như sau"**. Mỗi dòng có:
   - giá trị (sửa được), đơn vị;
   - nhãn nguồn: **đề bài** (có trích dẫn nguyên văn), **mặc định** (đề không cho, app tự điền),
     **đã chỉnh** (bạn sửa);
   - dòng tô vàng **Cần nhập**: đề thiếu dữ kiện bắt buộc. Hãy nhập, hoặc bấm "Giữ mặc định".
3. Kiểm tra thêm các mục: câu đề hỏi, giả thiết, phần chưa mô phỏng được, cảnh báo.
4. Bấm **Mô phỏng**. Ở tab **Lời giải**, các đáp số đề hỏi được đánh dấu "đề hỏi". Nút **AI diễn
   giải** nhờ AI giải thích bằng lời; nếu AI viết ra con số không do chương trình tính, đoạn đó bị
   ẩn.

Không có AI? Bấm nút **Tự dựng cảnh** (biểu tượng thước và bút chì) cạnh nút Phân tích đề để chọn
chủ đề và nhập thông số bằng tay.

### Cài AI: lấy khóa API Gemini (miễn phí)

AI đọc đề dùng **Gemini** của Google (mặc định). Cần một **khóa API** (API key), làm một lần:

> **Lưu ý tuổi:** theo điều khoản của Google, người tạo khóa API phải **từ 18 tuổi trở lên**. Học
> sinh dưới 18 tuổi hãy nhờ thầy cô hoặc phụ huynh tạo khóa và nhập giúp vào máy.

1. Trong app: bấm ⚙ **Cài đặt** → mục **Kết nối AI** → chọn **Gemini (khuyên dùng)** → mở
   **Hướng dẫn lấy khóa API Gemini** → bấm **Mở trang tạo khóa**. (Hoặc tự gõ
   `aistudio.google.com/apikey` vào trình duyệt.)
2. Đăng nhập tài khoản Google. Lần đầu vào **Google AI Studio**: đọc và đồng ý điều khoản.
3. Bấm **Create API key** (Tạo khóa API). Nếu được hỏi chọn dự án (project), chọn dự án có sẵn hoặc
   để Google tự tạo.
4. Bấm biểu tượng **sao chép** cạnh khóa vừa tạo.
5. Quay lại app: dán khóa vào ô **Khóa API** (Ctrl+V; bấm biểu tượng con mắt để xem lại khóa vừa
   dán) → bấm **Lưu khóa**. Sau khi lưu, app chỉ hiện 4 ký tự cuối của khóa (`••••••••abcd`).
6. Bấm **Kiểm tra key**. Thấy "Kết nối thành công — khóa hoạt động" là xong; nhãn trên thanh công
   cụ đổi thành "AI: đám mây". Các kết quả khác: **Key không hợp lệ** (dán sai hoặc khóa đã bị xóa —
   tạo khóa mới), **Hết hạn mức** (đợi một lúc hoặc thử lại ngày mai), **Không có mạng** (kiểm tra
   Internet), **không tìm thấy mô hình** (xóa ô Mô hình).

Chưa có khóa thì nút **Phân tích đề** mở thẳng mục Kết nối AI. Trong Hướng dẫn có hình minh họa
từng bước.

Cần biết:

- **Miễn phí, không cần thẻ ngân hàng**, nhưng có giới hạn số lượt mỗi phút và mỗi ngày. Khi app báo
  "hết lượt dùng AI miễn phí", đợi khoảng 1 phút; nếu vẫn báo thì thử lại vào ngày hôm sau. Lúc đó
  vẫn dùng được **Tự dựng cảnh**.
- **Riêng tư:** đề bài được gửi lên máy chủ Google để đọc. Với gói miễn phí, Google có thể dùng nội
  dung gửi lên để cải thiện sản phẩm, nên **đừng nhập thông tin cá nhân** (họ tên, số điện thoại,
  địa chỉ…) vào đề bài.
- **Giữ khóa như mật khẩu:** không gửi cho bạn bè, không đăng lên mạng. App cất khóa trong kho khóa
  của Windows (Windows Credential Manager), không lưu trong tệp. Lỡ để lộ khóa: vào Google AI Studio
  xóa khóa đó, tạo khóa mới và dán lại.
- Ô **Mô hình** để trống là dùng mô hình mặc định (`gemini-3.8-flash`, thuộc gói miễn phí lúc viết
  hướng dẫn này — tháng 10/2026). Chỉ đổi khi thầy cô hướng dẫn.
- Có thể chọn **Claude** thay cho Gemini (cần khóa API trả phí của Anthropic), hoặc **Tắt** AI.
- **Số lượt AI tối đa mỗi ngày** (mặc định 100; mỗi lần đọc đề dùng khoảng 2–4 lượt; 0 = không
  giới hạn). Hết lượt thì app báo và bạn vẫn dùng được Tự dựng cảnh, bài mẫu. Khi máy chủ AI đang
  bận (lỗi 429 hoặc 5xx), app tự thử lại tối đa 3 lần, mỗi lần đợi lâu hơn.
- **Đề đã xác nhận được nhớ trên máy:** phân tích lại đúng đề đó thì app dùng lại kết quả cũ, không
  gọi AI (bảng xác nhận vẫn hiện để bạn kiểm tra). Muốn AI đọc lại, bấm **Đọc lại bằng AI**. Xóa danh
  sách này trong Cài đặt → Kết nối AI.

### Dự phòng miễn phí khi hết lượt: Groq

Khi nhà cung cấp chính (Gemini, Claude) **hết lượt miễn phí hoặc hết tiền**, app tự chuyển sang
**Groq** (miễn phí) nếu đã có khóa Groq. Nhãn **Nội dung do AI hỗ trợ** và dòng "Mô hình AI" ghi
rõ mô hình nào đã trả lời, kèm chữ **dự phòng**. App chỉ chuyển khi hết lượt/hết tiền — không
chuyển khi khóa sai hay mất mạng (những lỗi đó cần bạn sửa). Groq cũng có thể chọn làm nhà cung cấp
chính (ví dụ lớp học không có khóa trả phí).

Cài đặt → **Kết nối AI** → mục **Dự phòng khi hết lượt** → chọn **Groq (miễn phí)** → mở
**Hướng dẫn lấy khóa API Groq**:

1. Bấm **Mở trang tạo khóa** (hoặc gõ `console.groq.com/keys`) và đăng nhập.
2. Bấm **Create API Key**, đặt tên bất kỳ rồi xác nhận.
3. Sao chép khóa (chỉ hiện một lần).
4. Dán vào ô **Khóa API cho dự phòng** → **Lưu khóa** → **Kiểm tra key**.

Cần biết: người tạo tài khoản Groq phải **từ 18 tuổi** (bản thử nghiệm THPT: phụ huynh hoặc thầy cô
tạo, người giám sát nhập bằng PIN). Theo điều khoản của Groq, nội dung gửi lên **không được dùng để
huấn luyện AI**; nếu tài khoản có tùy chọn "Zero Data Retention", nên bật. Gói miễn phí có giới hạn
(khoảng 1 000 lượt/ngày). Mô hình mặc định: `qwen/qwen3.8-27b` (đổi được ở ô **Mô hình dự phòng**).

## An toàn và quyền riêng tư

**Lần đầu mở app** sẽ có câu hỏi **"Trước khi bắt đầu"**:

- **Bản chính (sinh viên):** đánh dấu "Tôi đã đọc… và đồng ý", bấm **Tôi đủ 18 tuổi — bật AI**. Nếu
  bấm **Tôi chưa đủ 18 tuổi**, app vẫn dùng được toàn bộ mô phỏng, thư viện bài mẫu, Tự dựng cảnh;
  chỉ phần AI tắt (nhà cung cấp AI chỉ cho người từ 18 tuổi). Chưa xác nhận 18+ thì app **không cho
  lưu khóa API**. Trả lời lại: Cài đặt → **An toàn & quyền riêng tư**.
- **Bản thử nghiệm THPT (có giám sát):** học sinh nhập năm sinh → **người giám sát** (phụ huynh hoặc
  thầy cô) đặt **mã PIN** 4–8 chữ số → nếu học sinh dưới 18 tuổi, người giám sát đánh dấu đã có
  **Phiếu đồng ý** (mẫu: `docs/PILOT_CONSENT.md`) và bấm **Ghi nhận đồng ý và bật AI**. Bấm "Để sau"
  thì app chỉ dùng mô phỏng. Khóa API Claude do người lớn trả phí (sinh viên 18+ hoặc phụ huynh) tạo;
  chỉ người giám sát nhập/xóa được khóa (mở khóa bằng PIN trong Cài đặt → An toàn & quyền riêng tư,
  tự khóa lại sau 10 phút). Sai PIN 5 lần thì phải đợi 60 giây.

Khi dùng AI:

- Phần do AI đọc hoặc viết có nhãn **Nội dung do AI hỗ trợ**. Thấy nội dung sai, lạ hoặc khó chịu:
  bấm **Báo cáo nội dung không phù hợp**.
- Đề bài có **số điện thoại, email, số căn cước, họ tên/địa chỉ** sẽ **không được gửi** cho AI — xóa
  phần đó rồi phân tích lại. Nội dung không phù hợp với việc học cũng bị chặn; câu trả lời của AI
  có nội dung không phù hợp sẽ bị ẩn.
- Nếu đề bài cho thấy bạn đang gặp chuyện rất khó khăn, app **không gửi cho AI** mà hiện các số
  điện thoại hỗ trợ (bản thử nghiệm: Tổng đài bảo vệ trẻ em **111**; cả hai bản: đường dây Ngày Mai
  096 306 1414; nguy hiểm ngay: **115**). Hãy nói chuyện với người lớn bạn tin tưởng.
- **Nhật ký sự cố** (Cài đặt → An toàn & quyền riêng tư) chỉ ghi **loại sự cố và thời gian**, không
  ghi nội dung. Bản thử nghiệm: chỉ người giám sát xem được.
- Đọc thêm: menu ☰ → **Quyền riêng tư & dùng AI an toàn** (ứng dụng gửi gì, lưu gì, nhà cung cấp AI
  làm gì với đề bài, điều khoản tóm tắt, mẹo học với AI). Nguồn pháp lý: `docs/LEGAL_COMPLIANCE.md`.

## Hóa học

- **Bảng tuần hoàn:** nhấp một ô để xem dữ liệu; tô màu theo nhóm, khối, độ âm điện, bán kính,
  năng lượng ion hóa. Bảng dưới vẽ xu hướng theo Z.
- **Cấu hình electron / Mô hình Bohr / Orbital:** chọn nguyên tố (hoặc n, l cho orbital hydro).
  Các ngoại lệ như Cr, Cu được ghi chú rõ.
- **Phân tử 3D, VSEPR, độ phân cực:** tìm theo tên (Việt/Anh), công thức hoặc SMILES. Kéo chuột
  để xoay, lăn để phóng to. Nhấp nguyên tử/liên kết để xem chi tiết; Shift+nhấp 2 hoặc 3 nguyên tử
  để đo khoảng cách hoặc góc.
- **Thư viện phản ứng:** chọn phản ứng ở cột phải. Phản ứng có cơ chế có thanh phát: tua từng bước,
  xoay 3D; liên kết đứt màu cam, liên kết tạo màu xanh lá.
- **Cân bằng phương trình:** gõ ví dụ `Fe + O2 -> Fe2O3`. Điện tích: `Fe^3+`, `SO4^2-`.
- **Mức hạt:** Maxwell–Boltzmann (khí 2D), thuyết va chạm, cân bằng hóa học (nhấn các nút thêm
  chất, đổi nhiệt độ, nén để thấy nguyên lí Le Chatelier).

## Sinh học

- **Nguyên phân / Giảm phân:** nhấn ▶ hoặc mũi tên để đi qua từng kì. Chọn bộ NST 2n; ở giảm phân
  bật/tắt trao đổi chéo và bấm "Sắp xếp ngẫu nhiên lại" để thấy phân li độc lập. Bảng dưới liệt kê
  số NST, cromatit, tâm động, ADN ở mọi kì.
- **ADN → mARN → Protein / Đột biến điểm:** dán trình tự ADN (có thể có khoảng trắng, 5′/3′), chọn
  mạch bổ sung hay mạch gốc. Ở Đột biến điểm, chọn dạng đột biến, vị trí và nuclêôtit mới — app so
  sánh protein trước/sau và gọi tên kiểu đột biến.
- **Di truyền Mendel:** chọn lai 1 hoặc 2 cặp tính trạng, kiểu gen P, trội hoàn toàn / không hoàn
  toàn. Bấm "Tạo ngẫu nhiên" để so sánh kết quả ngẫu nhiên với lí thuyết (kiểm định χ²).
- **Hardy–Weinberg:** nhập số cá thể AA, Aa, aa; app tính p, q và kiểm định χ².
- **Phiêu bạt di truyền:** đổi kích thước quần thể N để thấy quần thể nhỏ mất/cố định alen nhanh.
- **Tăng trưởng logistic, Con mồi – vật ăn thịt:** kéo thanh trượt các hệ số. Ở Lotka–Volterra,
  bấm vào mặt phẳng pha để chọn điểm bắt đầu.
- **Động học enzyme:** chọn kiểu chất ức chế; xem đồ thị v–[S], [S] theo thời gian và
  Lineweaver–Burk.
- **Khuếch tán & thẩm thấu:** chuyển giữa hai chế độ. Ống chữ U cho thấy mực nước dâng tới khi
  ρgΔh = iCRT.

## Lưu, mở, xuất và lịch sử

- **Menu Tệp** (nút ☰ ở thanh trên): Mở tệp `.stemsim`, Lưu mô phỏng, Xuất ảnh PNG, Nguồn & Giả
  định, Hướng dẫn nhanh.
- **Lưu (Ctrl+S) / Mở (Ctrl+O):** tệp `.stemsim` lưu chủ đề và các thông số bạn đã chỉnh (không lưu
  kết quả — app tính lại khi mở, nên kết quả luôn đúng với phiên bản app).
- **Hoàn tác / Làm lại (Ctrl+Z / Ctrl+Y):** áp dụng cho thông số của chủ đề đang mở. Kéo thanh trượt
  liên tục được tính là một bước.
- **Xuất PNG:** chụp khung mô phỏng (hình 2D, 3D hoặc đồ thị). Chủ đề hiển thị bằng bảng thì dùng Xuất
  CSV. Rê chuột lên một đồ thị để thấy nút **Xuất CSV** ở góc phải.
- **Lịch sử** (tab ở cột trái): mọi mô phỏng đã mở, kèm thông số cuối cùng. Bấm để mở lại; bấm
  thùng rác để xóa.
- **Nguồn & Giả định:** một trang tổng hợp nguyên tắc khoa học, nguồn của mọi bộ dữ liệu (kèm số mục
  chờ giáo viên duyệt), tài liệu tham khảo và giả định của chủ đề đang mở — dùng khi trình bày với
  giám khảo.
- **Chế độ trình chiếu (F5):** toàn màn hình, chữ to hơn, ẩn các bảng phụ. Esc để thoát.

## Cập nhật phần mềm

- Khi mở app (có mạng), app tự kiểm tra bản mới. Nếu có, **hộp thoại cập nhật tự hiện** với hai nút
  **Cập nhật ngay** / **Để sau**. Chọn "Để sau" thì thanh trạng thái vẫn nhắc **"Có bản cập nhật
  …"** (bấm vào đó, hoặc menu ☰ → **Kiểm tra cập nhật**) và lần mở app sau sẽ hỏi lại.
- Một số bản là **bắt buộc** (ví dụ sửa lỗi quan trọng): hộp thoại không có nút "Để sau", cần cập
  nhật mới dùng tiếp. Không có mạng thì app vẫn dùng bình thường.
- Bấm **Cập nhật ngay** → app tải gói cập nhật (vài MB), kiểm tra chữ ký số và mã SHA-256, rồi
  **Khởi động lại**. Lịch sử, tệp .stemsim và cài đặt của bạn giữ nguyên.
- Nếu bản mới thay đổi phần lõi của app, hộp thoại báo cần tải bộ cài mới và có nút mở trang tải.
- Bản cập nhật có lỗi? Nút **Quay về bản gốc** trả app về bản đã cài từ bộ cài.
- Mỗi bản chỉ nhận cập nhật **của chính nó**: bản THPT không bao giờ nhận phần có mã Gemini của bản
  chính (app kiểm tra chữ ký và tên bản trước khi dùng).

## Khi máy yếu

App ưu tiên đúng hơn mượt. Nếu máy không kịp vẽ, thanh trạng thái báo "Đã hạ chất lượng hiển thị"
(số liệu không đổi). Nếu không kịp tính, mô phỏng chạy chậm hơn thời gian thực và ghi rõ tỉ lệ (ví dụ
×0,5). Khi bộ nhớ cao, app giải phóng bộ nhớ đệm và nhắc bạn đóng bớt chủ đề 3D.

## Cài đặt (nút bánh răng)

- **Giao diện:** sáng / tối / theo hệ thống; cỡ chữ 90–140 %; ngôn ngữ Tiếng Việt / English.
- **Vật lý:** giá trị g mặc định (9,80665 / 9,81 / 9,8 / 10 m/s²) — chỉ dùng khi đề không cho g.
- **Chất lượng hiển thị:** Tự động / Thấp / Trung bình / Cao, nút Đo lại. Chỉ ảnh hưởng hình ảnh,
  không ảnh hưởng số liệu.
- **Kết nối AI:** chọn Gemini (khuyên dùng), Claude hoặc tắt AI; hướng dẫn lấy khóa API Gemini;
  khóa API; mô hình; thời gian chờ (mặc định 30 giây); số lượt tối đa mỗi ngày; xóa các đề đã lưu;
  nút Kiểm tra key (kết quả: thành công / key không hợp lệ / hết hạn mức / không có mạng).
- **Phím tắt:** danh sách đầy đủ.

## Lỗi thường gặp

- **App mở ra màn hình trắng:** máy thiếu WebView2 — xem mục Cài đặt.
- **"AI: thiếu key":** chưa nhập khóa API — làm theo mục "Cài AI: lấy khóa API Gemini" ở trên.
- **"Khóa bị từ chối":** khóa gõ sai, đã bị xóa hoặc bị tắt. Tạo khóa mới trong Google AI Studio và
  dán lại.
- **"Không kết nối được máy chủ AI":** kiểm tra mạng Internet. Không có mạng vẫn dùng được **Tự dựng
  cảnh** và thư viện bài mẫu.
- **"Hết lượt dùng AI miễn phí":** đợi khoảng 1 phút, hoặc thử lại vào ngày mai.
- **Mô phỏng chạy chậm, thanh trạng thái hiện "Chuyển động chậm ×…":** máy không kịp tính theo thời
  gian thực; kết quả vẫn đúng. Có thể giảm tốc độ phát hoặc đóng bớt chương trình khác.
- **Không mở được tệp .stemsim:** tệp hỏng hoặc từ phiên bản mới hơn; app báo lỗi và không thay đổi
  mô phỏng đang mở.

## Phím tắt

| Phím                     | Tác dụng                                    |
| ------------------------ | ------------------------------------------- |
| Space                    | Chạy / tạm dừng                             |
| R                        | Đặt lại                                     |
| .                        | Bước tiếp theo                              |
| Ctrl+Z / Ctrl+Y          | Hoàn tác / Làm lại                          |
| Ctrl+S / Ctrl+O          | Lưu / mở tệp .stemsim                       |
| Ctrl+B / Ctrl+I / Ctrl+J | Ẩn/hiện Thư viện / Thuộc tính / bảng Đồ thị |
| F5 / Esc                 | Vào / thoát chế độ trình chiếu              |
| Ctrl+= / Ctrl+-          | Tăng / giảm cỡ chữ                          |
| Ctrl+Enter               | Phân tích đề (khi đang ở ô đề bài)          |
