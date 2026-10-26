# Hướng dẫn sử dụng SimLab

SimLab mô phỏng Vật lý, Hóa học và Sinh học THPT ngay trên máy tính, **không cần mạng**. Mọi
con số do chương trình tính; mỗi mô phỏng có **Thẻ Khoa học** ghi rõ mô hình, phương trình, giả định,
độ tin cậy và nguồn.

## Cài đặt

**Yêu cầu:** Windows 10 hoặc 11 (64-bit), RAM từ 8 GB, màn hình từ 1366×768.

1. Tải bộ cài `SimLab_…_x64-setup.exe` ở trang **Releases** của dự án trên GitHub (mục _Assets_).
   Phần AI dành cho người dùng từ 18 tuổi (Gemini mặc định, Claude tùy chọn, Groq dự phòng).
2. Nhấp đúp để chạy. Windows có thể hiện "Windows protected your PC" vì bộ cài chưa được ký số: bấm
   **More info → Run anyway**.
3. Bộ cài không cần quyền quản trị (cài cho người dùng hiện tại). Xong, mở app từ menu Start.

Chỉ cần cài **một lần**. Các bản sau cập nhật ngay trong app (mục "Cập nhật phần mềm").

**Cài từ Microsoft Store (khi app đã lên Store):** mở Microsoft Store, tìm **SimLab**, bấm
**Nhận** (Get). Không có cảnh báo "Windows protected your PC", và Store tự cập nhật app; trong app,
menu ☰ → **Kiểm tra cập nhật** chỉ mở Store. Bản Store và bản cài từ GitHub giữ dữ liệu riêng (khóa
AI dùng chung). Cách đưa app lên Store: `docs/STORE.md`.

**Bản thử nghiệm THPT đã ngừng (12/10/2026).** Máy nào đã cài "STEM Sim Lab THPT" sẽ không nhận
cập nhật nữa: gỡ bản đó (Settings → Apps) rồi cài bản chính ở trên. Dữ liệu của bản THPT nằm riêng
trong `%APPDATA%\vn.stemsimlab.pilot\`, có thể xóa sau khi gỡ.

### Windows chặn bộ cài ("Smart App Control blocked an app")

Smart App Control (Windows 11) chặn mọi chương trình **chưa có chữ ký số** mà Microsoft chưa biết;
hộp thoại này không có nút "Run anyway". Bộ cài SimLab chưa được ký số (chứng chỉ ký số tốn
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

**Gỡ cài đặt:** Settings → Apps → SimLab → Uninstall. Lịch sử mô phỏng nằm trong
`%APPDATA%\vn.stemsimlab.desktop\history.sqlite`.

### Tạo bộ cài

- **Cách 1 — GitHub (không cần cài gì trên máy):** đưa mã nguồn lên một kho GitHub, vào tab
  **Actions → Release (Windows installer) → Run workflow**. Khoảng 15–25 phút sau, mở lần chạy có
  tên **Release (Windows installer)** (không phải lần chạy "CI" — CI chỉ kiểm tra lỗi, không tạo bộ
  cài), kéo xuống cuối trang **Summary** để thấy mục **Artifacts → stem-sim-lab-windows**. Tệp zip
  tải về chứa bộ cài `…x64-setup.exe` (khuyên dùng) và `.msi`, cùng
  `installer-sizes.txt`. Khi chọn `publish` = true, GitHub còn tạo bản Release để mọi máy đã cài tự
  nhận cập nhật (xem `docs/RELEASE.md`).
- **Cách 2 — trên máy Windows của bạn:** cài công cụ theo `docs/SETUP_WINDOWS.md`, rồi chạy
  `npm install` và `npm run tauri build`. Bộ cài nằm trong `src-tauri\target\release\bundle\nsis\`.

## Bắt đầu nhanh

1. Lần đầu mở app có vài bước làm quen (bấm **Bỏ qua** bất cứ lúc nào): chọn trình độ → chọn môn
   quan tâm → xác nhận đủ 18 tuổi và điều khoản → **Kết nối AI** (nhập khóa Gemini, hoặc **Để sau**)
   → hướng dẫn nhanh.

   Hướng dẫn nhanh mở lại được bằng menu ☰ → Hướng dẫn nhanh. App cũng đo nhanh sức mạnh máy
   (khoảng 1 giây) để chọn chất lượng hiển thị.

   **Tìm nhanh (Ctrl+K)** hoặc nút kính lúp trên thanh trên cùng: gõ vài chữ (không cần dấu, ví
   dụ "nem xien") để mở một chủ đề, một trang Cài đặt, AI Teacher, hoặc làm nhanh một việc (đổi
   sáng/tối, Cơ bản/Nâng cao, ngôn ngữ, trình chiếu, lưu/mở tệp). Mũi tên ↑ ↓ để chọn, Enter để mở,
   Esc để đóng.

2. **Trang chủ SimLab** có hai lối vào:
   - **Phòng thí nghiệm** mở thư viện chủ đề, lịch sử, trang "Hôm nay học gì?" và **Science Studio**
     (các bài học có hướng dẫn, mục "Science Studio" bên dưới);
   - **AI Teacher** mở trang trò chuyện với trợ lý học tập.

   Bấm logo **SimLab** ở góc trái để quay về trang chủ.

3. Trong **Phòng thí nghiệm**, trang "Hôm nay học gì?" hiện khi chưa mở chủ đề nào:
   - nút **Tiếp tục bài đang học** (mở lại chủ đề lần trước);
   - ô **Nhập đề bài hoặc câu hỏi…** (dán được đề nhiều dòng, Ctrl+Enter để phân tích) và nút
     **Tự dựng cảnh** (không cần AI);
   - 3 thẻ môn **Vật lý · Hóa học · Sinh học** (bấm để xem các chủ đề của môn trong Thư viện);
   - **chủ đề gợi ý** theo trình độ, môn bạn quan tâm được gợi ý trước;
   - **AI Teacher** để hỏi bài trong trang chat riêng.
4. Chọn một chủ đề (trang chủ Phòng thí nghiệm hoặc **Thư viện** bên trái), chỉnh thông số ở cột phải, bấm ▶ (hoặc
   Space) để chạy.
5. Đọc **Thẻ Khoa học** ở cột phải để biết mô hình và mức độ tin cậy của kết quả.

### Trò chuyện với AI Teacher

Trong Phòng thí nghiệm, bấm nút tròn có mặt **AI Teacher** ở góc dưới (bên trái cột Thuộc tính) để
hỏi nhanh; ở trang chủ, bấm thẻ **AI Teacher** để mở cuộc trò chuyện toàn màn hình. Bấm chữ **SimLab**
ở góc trên để về trang chủ. Chọn API trực tuyến hoặc Gemma cục bộ ở ô chọn trên đầu khung chat; nút
ⓘ cạnh tiêu đề trang AI Teacher nhắc trang này làm gì và dữ liệu nào có thể được gửi đi. Nếu chưa kết nối API hoặc
Gemma chưa sẵn sàng, khung chat hiện thông báo và nút **Cài đặt** mở thẳng đúng mục cần chỉnh. Dòng
nhỏ dưới thanh chọn cho biết câu hỏi tiếp theo sẽ được gửi tới đâu (hoặc chỉ xử lý trên máy).

- Bật **Lấy thông tin từ màn hình** để gửi chủ đề, thông số, đề bài đã mở, trạng thái mô phỏng và
  Thẻ Khoa học của SimLab cùng câu hỏi. Mặc định tắt; nút tự tắt lại mỗi lần mở bong bóng.
  Công tắc này chỉ có trong bong bóng chat, không có ở trang AI Teacher toàn màn hình.
  Ứng dụng dùng trạng thái có cấu trúc, không chụp màn hình hay đọc cửa sổ khác.
- Bật **Think** để API trả lời thứ nhất tạo bản nháp và một nhà cung cấp API khác kiểm tra, chỉnh lại
  câu trả lời. Think dùng thêm lượt API; cấu hình nhà cung cấp thứ hai trong Cài đặt → AI Teacher. Thiếu
  khóa thứ hai thì app báo ngay khi bật Think, không gửi gì. Khi bật Think, bản nháp không chuyển
  sang nhà cung cấp dự phòng, để người rà soát không tự chấm bài của chính mình. Trên trình duyệt,
  khóa chỉ nằm trong phiên (tải lại trang là mất) và Claude chỉ rà soát được ở bản desktop.
- Chọn **Gemma cục bộ** để trò chuyện ngay trên máy, không cần Ollama, không cần mạng sau
  khi đã tải model. Vào Cài đặt → AI local (Gemma) để tải Gemma 270M (≈ 345 MB, nhẹ nhất nhưng trả lời
  còn yếu), 1B (≈ 880 MB, khuyên dùng) hoặc E2B (≈ 3,8 GB, đọc được ảnh, cần nhiều chỗ trống). Thanh tiến độ hiện phần trăm và dung lượng, và
  "còn khoảng … phút" sau vài giây (ước tính theo tốc độ mạng mấy giây gần nhất, nên có thể thay
  đổi); có nút **Hủy tải**; chỉ khi tải và nạp xong mới báo sẵn sàng. Với Gemma, câu trả lời hiện
  dần từng chữ trong khi thầy đang viết; nếu giữa chừng có đoạn không an toàn, phần đã hiện bị thu
  lại ngay. Khi bật Think, bản nháp không hiện ra mà chờ rà soát xong. Máy và trình duyệt cần hỗ trợ WebGPU;
  nếu không, app nói rõ và dùng API thay thế. Cài mới chọn sẵn Gemma, nhưng khi chưa tải model thì
  app tự dùng API đã kết nối; nếu em tự chọn Gemma mà chưa tải, app không gửi câu hỏi lên mạng.
  Mô hình được lưu trên máy, mở lại app không phải tải lại. Khi Gemma đang trả lời, hãy để cửa sổ
  app hiện trên màn hình (thu nhỏ cửa sổ có thể làm máy tạm dừng GPU).
- **Chọn card đồ họa (GPU) cho Gemma** (bản desktop trên Windows): máy có cả card tích hợp và card
  rời (ví dụ laptop chơi game) thì vào Cài đặt → GPU cho Gemma → **Card đồ họa (GPU) chạy Gemma** để
  chọn.
  Card rời (thường có nhãn "Nên dùng cho Gemma") chạy nhanh hơn nhiều nhưng tốn pin hơn; card được
  chọn chạy cả phần hiển thị của app. Đổi card xong phải **mở lại app** (có nút **Mở lại ngay**);
  trước đó Gemma vẫn chạy trên card cũ. Dòng "WebGPU của ứng dụng đang chạy trên: …" cho biết card
  thật đang dùng. Nếu card rời đang tắt (chế độ Eco/tiết kiệm pin của hãng máy), app báo không thấy
  card đã chọn và tạm dùng card mặc định.
- **Card tích hợp và Gemma (quan trọng):** trên laptop có card tích hợp, câu hỏi dài có thể làm card
  tích hợp bị treo (Windows phải khởi động lại card; nếu lặp lại nhiều lần, máy có thể bị khởi động
  lại — đã gặp thật với AMD Radeon 780M). Vì vậy app: rút ngắn câu hỏi gửi cho Gemma khi chạy trên
  card tích hợp; **sau một lần card bị treo, Gemma tạm dừng tới khi em mở lại app**; Cài đặt → GPU cho
  Gemma hiện thông báo với nút **Dùng card rời** và **Vẫn cho Gemma chạy lại** (chỉ bấm khi em hiểu
  rủi ro). Máy có card rời thì nên chọn card rời cho Gemma.
- **Chất lượng của Gemma trên máy:** 270M chỉ để thử (hay lạc đề); 1B nhanh nhưng **hay sai kiến
  thức** (đánh giá 30 câu ngày 13/10/2026). Với kiến thức quan trọng, hãy kiểm tra lại với Thẻ Khoa
  học/giáo viên, bật **Think**, hoặc dùng API trực tuyến.
- **Trí nhớ hội thoại** (Cài đặt → Trí nhớ hội thoại): **Vừa** (mặc định) hoặc **Dài**. Thầy nhớ phần trò
  chuyện gần nhất; phần cũ hơn được chính AI đang trả lời tóm tắt ngắn (lưu trên máy) để thầy vẫn
  theo được mạch bài. "Dài" nhớ nhiều hơn nhưng chậm hơn trên máy yếu và dễ hết lượt hơn với gói API
  miễn phí.
- Câu trả lời quá dài bị dừng giữa chừng thì dưới câu trả lời có dòng báo và nút **Viết tiếp**. Khi
  đang giảng trên bảng, phần viết tiếp được giảng tiếp ngay trên cùng bảng.
- Các nút nhanh ở trang AI Teacher (**Gợi ý từng bước**, Giải thích lại, Chậm hơn, Thêm ví dụ, Đơn
  giản hơn, Em chưa hiểu chỗ này) hiện sau câu trả lời đầu tiên và gửi cho AI một câu hướng dẫn đầy
  đủ dựa trên câu trả lời vừa rồi. "Gợi ý từng bước" chỉ cho một gợi ý nhỏ cho bước tiếp theo, chưa
  nói đáp số.
- Thầy giảng theo trình tự: điều cần hiểu → hỏi lại nếu đề thiếu dữ kiện → giải thích đơn giản → ví
  dụ → các bước có lý do → một lỗi hay nhầm → **một câu hỏi kiểm tra**. Em trả lời câu hỏi đó, thầy
  nói rõ đúng/sai ở đâu và giải thích theo cách khác.
- **Kết quả do SimLab tính:** khi câu hỏi có phương trình hóa học (ví dụ "Cân bằng H2 + O2 → H2O"),
  bộ cân bằng chính xác của SimLab giải trước; dưới câu trả lời có khung xanh **Kết quả do SimLab tính
  (chính xác, không phải AI)**. Nếu chữ của AI khác khung này, tin khung này.
- **Xem mô phỏng:** khi câu hỏi nêu đúng tên một chủ đề có mô phỏng (ví dụ "nguyên phân", "rơi tự
  do"), dưới câu trả lời có nút **Xem mô phỏng: …** để mở chủ đề đó.
- Đường link trong câu trả lời của AI chỉ hiện dưới dạng chữ (kèm tên trang), không bấm được: AI có
  thể bị nội dung lạ đánh lừa; trang ngoài chỉ mở từ các nút của app.
- **Thư viện kiến thức** có sẵn ghi chú Vật lý, Hóa học, Sinh học THPT và cho phép nạp tệp `.txt`,
  `.md`, `.csv`, `.json`. Tệp và lịch sử chat lưu trên máy; khi chat bằng API trực tuyến, các đoạn
  kiến thức liên quan có thể được gửi cùng câu hỏi. **Tra thêm Wikipedia** là tùy chọn (mặc định
  tắt): khi bật, câu hỏi được gửi tới Wikipedia. Ô **Dữ liệu của em đi đâu?** trong Cài đặt → AI Teacher
  liệt kê theo cài đặt hiện tại những gì lưu trên máy và những gì có thể gửi đi. Xem thêm
  `docs/AI_TUTOR.md`.

### AI trên máy khác (Ollama, LM Studio, llama.cpp)

Nếu em đã tự cài một chương trình AI trên máy (Ollama, LM Studio, `llama-server` của llama.cpp, hoặc
máy chủ khác kiểu OpenAI), SimLab có thể dùng nó thay cho API. SimLab **không cài, không mở và không
tải mô hình** cho chương trình đó: em mở chương trình và tải mô hình trước (với LM Studio, bật chế độ
máy chủ của nó).

1. Vào Cài đặt → **AI trên máy khác (Ollama, LM Studio, llama.cpp)**, bấm **Tìm trên máy này**. App
   chỉ hỏi ba địa chỉ quen thuộc trên máy (cổng 11434, 1234, 8080) và các địa chỉ em tự thêm ở
   **Thêm địa chỉ** (chỉ nhận `127.0.0.1`, `localhost` hoặc `[::1]` có số cổng). Không đọc tệp, không
   quét ổ đĩa.
2. App liệt kê các mô hình **chương trình đó báo có**. Bấm **Kiểm tra kết nối**, rồi **Kiểm tra trả
   lời** để thử một câu ngắn; khả năng chương trình không cho biết thì ghi **Chưa xác minh**.
3. Bấm **Dùng cho AI Teacher**, rồi ở AI Teacher chọn **AI trên máy khác** trong ô chọn mô hình.
   "Phân tích đề", "AI diễn giải" và đọc ảnh chụp đề cũng dùng lựa chọn này.

Câu hỏi chỉ đi tới chương trình đó trên máy em. Khi nó lỗi hoặc tắt, app nói rõ và **không tự gửi câu
hỏi lên mạng**; chỉ khi em bật Think thì bản nháp mới được gửi tới API để rà soát. Mô hình "cloud" của
Ollama (chạy trên ollama.com) bị từ chối. Ảnh chỉ gửi cho mô hình đã thử đọc được ảnh trên máy này.
SimLab không chọn được card đồ họa cho chương trình đó (chỉnh trong chính chương trình). Có nút
**Khôi phục mặc định** và mục **Gặp lỗi? Cách xử lý**.

### Giảng trên bảng

Ở trang AI Teacher, chọn **Giảng trên bảng** (góc trên bên phải). Mỗi câu trả lời được giảng trên bảng
trắng: thầy vừa nói vừa viết (chữ viết tay tiếng Việt, đầu bút đi theo), công thức hiện dần, gạch chân
từ khóa, khoanh công thức quan trọng, đóng khung kết quả, mũi tên nối các ý, vẽ đồ thị, sơ đồ lực, bảng
số. Bảng chia ba cột như lớp học: trái là tóm tắt đề và ghi chú, giữa là các bước giải, phải là hình
vẽ. Phụ đề dưới bảng cho biết thầy đang nói gì. Bảng có nhãn "Nội dung do AI hỗ trợ" và nút báo cáo.

- Nút **Tạm dừng / Tiếp tục / Giảng lại**, **Viết nhanh** (viết ngay phần còn lại), tốc độ viết
  0,75–2× (hiện khi bảng đã có bài). Bảng dài tự cuộn theo bút; khi sang phần mới có các thẻ **Bảng 1, Bảng 2…** để xem lại.
  Khi bảng dài hơn khung nhìn, góc trên bên phải có **bản đồ nhỏ** của bảng: các khối đã viết và
  khung phần đang nhìn; bấm hoặc kéo trên bản đồ để đến chỗ đó.
- **Bút của em:** bật để tự viết, vẽ lên bảng bằng chuột hoặc cảm ứng (màu tím); nút cục tẩy xóa nét
  của em. Nét vẽ chỉ ở trên máy.
- Mọi con số trên bảng được kiểm nguồn gốc: số có trong đề là bình thường; phép tính viết trên bảng
  được máy tính lại (dấu ✓); số không rõ nguồn có dấu ⚠ "Có số do AI tự tính, chưa kiểm chứng" — hãy
  tự tính lại. Đồ thị do app tự tính từ biểu thức.
- Với API trực tuyến, AI được yêu cầu trả lời dạng "kịch bản bảng" (chỉ nói ý định, không bao giờ cho
  tọa độ; app tự xếp chỗ). Với Gemma trên máy, câu trả lời thường được app tự xếp lên bảng (chỉ viết ý
  chính của bước dài, phần còn lại thầy đọc). Chi tiết: `docs/WHITEBOARD.md`.
- Khi bật giọng: thầy đọc cả nội dung đang viết đúng lúc viết (công thức đọc thành lời, ví dụ "2n"
  là "hai nờ"); bấm **Tạm dừng** giữa câu rồi **Tiếp tục** thì thầy đọc lại câu đó; tốc độ 0,75–2× của
  bảng áp cho cả giọng.
- **Phóng to bảng / Thu nhỏ bảng** (1×, 1,25×, 1,5×, 2×) và **Vừa khung** (thấy hết bề ngang). Phóng
  to chỉ làm bảng to ra để dễ đọc; chữ đã viết không đổi chỗ. Khi em chuyển sang xem bảng khác, bài
  giảng tạm dừng và bút không viết sang bảng đó; quay lại thì phần đã viết vẫn còn.

### Khoanh để hỏi

Trên thanh công cụ của bảng, bật **Khoanh để hỏi** rồi khoanh, gạch chân hoặc chạm vào chỗ em muốn hỏi.
Thanh **Chỗ em khoanh trên bảng** hiện "Em khoanh: …" — đúng chữ, công thức, nhãn hình đang có trên
bảng (app tự đọc, không nhờ AI đoán). Bấm **Hỏi thầy chỗ này** (hoặc **Khoanh lại**, **Bỏ chọn**).

- Khoanh trúng nhiều chỗ: app hỏi em muốn hỏi **Cả phần này** hay một chỗ. Không trúng chữ hay hình
  nào: app nói rõ và không gửi gì.
- Câu trả lời hiện trong khung chat (thầy đọc to nếu bật giọng), không viết đè lên bài; bài giảng tạm
  dừng đến khi em bấm **Quay lại bài giảng**.
- Chữ và công thức em khoanh được gửi kèm câu hỏi tới AI em đang chọn (và AI rà soát khi bật Think);
  không bao giờ gửi tới Wikipedia.
- Khoanh vào hình không có chữ hoặc nét viết tay của em: app chỉ gửi **ảnh vùng khoanh** cho AI đọc
  được ảnh chạy trên máy (Gemma E2B trên card rời, hoặc mô hình của AI trên máy khác đã thử đọc được
  ảnh), không bao giờ lên mạng. AI khác thì app nhờ em gõ câu hỏi.

### Trình độ: Nền tảng và Đại cương

Thư viện sắp xếp theo **Trình độ → Môn → Chủ đề**. **Nền tảng** là kiến thức gốc, tương đương
chương trình THPT — mọi chủ đề hiện có nằm ở đây. **Đại cương** (các môn năm nhất đại học) sẽ có ở
giai đoạn sau. Việc ghép chủ đề với bài cụ thể trong sách giáo khoa đang chờ giáo viên duyệt
(`docs/DATA_REVIEW.md`, mục 12).

### Chế độ Cơ bản và Nâng cao

Đổi ở đầu cột **Thuộc tính** hoặc Cài đặt → Giao diện → **Chế độ hiển thị**.

- **Cơ bản** (mặc định): 3–5 thông số quan trọng nhất (nút **Thêm thông số** để xem phần còn lại;
  giá trị lấy từ đề bài hoặc bạn đã chỉnh thì luôn hiện), thẻ dưới **Đồ thị · Lời giải**, thanh
  công cụ chỉ có chọn, kéo, thước đo, vectơ và căn khung nhìn. Khi mọi thông số đều là giá trị mặc
  định, một dòng ghi điều đó thay cho nhãn "mặc định" ở từng dòng; có giá trị từ đề hoặc do bạn chỉnh
  thì mọi dòng ghi rõ nguồn. **Thẻ Khoa học** hiện tên, mức tin cậy, cảnh báo can thiệp và mô hình;
  phương trình, giả định và nguồn gấp lại dưới một dòng, bấm để mở. Thanh trạng thái chỉ hiện các
  cảnh báo (chuyển động chậm, hạ chất lượng), không hiện FPS/RAM.
- **Nâng cao:** thêm mục Đối tượng, mọi thông số, thước đo góc, đồng hồ bấm giờ, vết quỹ đạo, thẻ
  **Số liệu** và **Xuất CSV**; Thẻ Khoa học mở đầy đủ; thanh trạng thái có chất lượng hiển thị, FPS,
  RAM.

Người đã dùng bản cũ được giữ ở chế độ Nâng cao như trước.

### Học bằng khám phá: Dự đoán trước, Thử thách, Gợi ý từng bước

Với mỗi chủ đề Vật lý, mở thẻ **Thử thách** ở bảng dưới:

- **Dự đoán trước** (Dự đoán → Quan sát → Giải thích): chọn điều bạn nghĩ sẽ xảy ra (ví dụ "thả
  từ độ cao gấp đôi thì thời gian rơi thay đổi thế nào?"), bấm **Chạy để kiểm tra** để xem mô
  phỏng với giá trị mới và so sánh con số trước/sau, rồi tự viết lời giải thích của bạn (không lưu,
  không gửi đi). Đáp án đúng do chương trình tính, không ai viết sẵn.
- **Thử thách nhỏ**: ví dụ "chỉnh góc ném để vật bay xa nhất". Bấm **Bắt đầu thử thách**, chỉ chỉnh
  thông số được nêu; ô "Hiện tại / Mục tiêu" cập nhật ngay, có nút **Xem gợi ý**.
- Đúng dự đoán hoặc đạt thử thách thì dấu ✓ bật lên với một chùm chấm nhỏ (dưới 1 giây; tắt khi
  máy đặt "giảm chuyển động").
- **Gợi ý từng bước**: khi bạn nhập đề bài, thẻ **Lời giải** ẩn đáp số để bạn tự giải trước: bấm
  **Gợi ý 1**, **Gợi ý 2**… đến **Lời giải đầy đủ**, hoặc **Xem lời giải ngay** để đối chiếu.
- **Tiến độ và huy hiệu**: mở một chủ đề (môn nào cũng vậy) là có dấu ✓ **Đã học** trong Thư viện.
  Chủ đề Vật lí còn việc thì có thêm số nhỏ như "1/3" (di chuột vào để xem còn Dự đoán trước hay
  thử thách nào); làm xong hết (đã mở, đã dự đoán, đã làm mọi thử thách) thì dấu ✓ đổi thành biểu
  tượng **Hoàn thành**. Mỗi chương có số "đã học/tổng". Huy hiệu hiện ở trang chủ. Không có chuỗi
  ngày hay bảng xếp hạng. Tiến độ chỉ lưu trên máy này.
- **Nhắc nghỉ mắt**: sau khoảng 45 phút dùng liên tục, app hiện một lời nhắc nhỏ (không chặn màn
  hình). Nghỉ từ 5 phút trở lên thì đếm lại từ đầu.

## Science Studio

**Mở:** Science Studio nằm trong **Phòng thí nghiệm** (trang chủ SimLab không còn thẻ riêng). Có ba
cách mở:

- bấm nút **Science Studio** ở đầu thư viện chủ đề (bên trái) để xem mọi bài, kể cả bài giáo viên đã
  soạn và thẻ **Soạn bài**;
- khi đang mở một chủ đề có bài hướng dẫn (hiện có: Rơi tự do, Thư viện phản ứng đã kiểm chứng,
  Nguyên phân), bấm **Học theo bài: …** ở thẻ **Science Studio** trong bảng bên phải;
- ở chủ đề Rơi tự do, phần **Dự đoán trước** (thẻ **Thử thách**) dẫn sang bài Science Studio của chủ
  đề, nên em chỉ dự đoán một lần, trong bài đó. Các thử thách nhỏ vẫn ở trong Phòng thí nghiệm.

Trong Studio, chọn môn ở các thẻ **Hóa học · Sinh học · Vật lí · Soạn bài** (thư viện bên trái đổi
theo môn đó), rồi chọn bài ở **Chọn bài học**. Bấm **Về Phòng thí nghiệm** để quay lại; bài đang làm
dở được giữ nguyên. Bấm logo **SimLab** để về trang chủ.

Mỗi bài đi qua 6 bước: **Dự đoán → Thí nghiệm → Quan sát → Giải thích → Kết luận → Báo cáo**. Phải
chọn dự đoán, làm thí nghiệm, viết giải thích (đủ số ký tự app ghi dưới ô) và viết kết luận thì mới
sang bước sau; dòng chữ cạnh nút **Tiếp** cho biết còn thiếu gì. Dự đoán được giữ lại từ
lần thí nghiệm đầu tiên; muốn đoán lại, bấm **Học lại từ đầu** ở bước Báo cáo. Mọi số đo do mô phỏng
tính; phần chữ của bài (mục tiêu, gợi ý, kết luận tham khảo) đang ghi **"chưa được kiểm duyệt"** vì
chưa có giáo viên duyệt.

- **Vật lí — Rơi tự do:** chỉnh độ cao rồi bấm **Chạy thí nghiệm**. App chạy hai lần: A (độ cao em
  chọn) và B (độ cao gấp đôi), rồi báo đã có số đo; bấm **Tiếp: Quan sát** để xem bảng số đo, đồ thị
  và phép kiểm tra chéo với công thức (như ở môn Hóa và Sinh, em tự quyết khi nào đi tiếp). Nút
  **Chạy A trong Phòng thí nghiệm** (hoặc **Chạy B…**) mở đúng lần chạy đó trong Phòng thí nghiệm.
- **Hóa học — Nhận biết ion Cl⁻:** lấy dung dịch từ **Giá hóa chất** cho vào ống nghiệm, bấm **Lắc để
  trộn**, xem hiện tượng; **Rửa ống nghiệm** trước khi thử cặp khác. Hiện tượng và phương trình chép
  từ thư viện phản ứng của app. Cặp dung dịch không có trong thư viện chỉ hiện "chưa có trong cơ sở dữ
  liệu đã kiểm chứng" — app không đoán. Hình kết tủa chỉ là kí hiệu, không vẽ màu hay lượng thật.
- **Sinh học — Nguyên phân 3D:** xoay, phóng to hình và chuyển qua các kì, bấm **Ghi lại kì này** ở
  kì em cho là trả lời câu hỏi. Sau đó làm **Tìm bộ phận theo chức năng**: chọn bộ phận trong hình
  (hoặc trong danh sách), bấm **Trả lời** cho từng chức năng rồi **Kiểm tra**. Trong bài, loại tế bào
  và bộ NST được giữ cố định. Máy không vẽ được 3D (hoặc đặt chất lượng Thấp) thì hiện hình 2D: chuyển
  kì bằng nút **Bước trước** / **Bước tiếp theo** trên hình và chọn bộ phận trong danh sách **Bộ phận
  tế bào**. Trả lời đủ các chức năng và bấm **Kiểm tra** là sang được bước Quan sát; chức năng nào
  chưa đúng được đánh dấu để em sửa.
- **Soạn bài:** **Tạo bài mới** → chọn môn → điền phần chữ (tiếng Việt bắt buộc, tiếng Anh không bắt
  buộc) và chọn phần mô phỏng sẽ chạy → **Lưu bài**. App chỉ cho chọn những gì mô phỏng chạy được, và
  báo những chỗ cần sửa trước khi lưu. Mỗi bài đã soạn có **Xem trước**, **Sửa**, **Nhân bản**,
  **Xuất JSON** và **Xóa** (hỏi lại trước khi xóa); **Nhập tệp JSON** để mở bài người khác gửi (tệp
  hỏng hoặc sai mẫu thì app nói lý do và không nhập). Bài soạn chỉ lưu trên máy này
  và luôn ghi "chưa được kiểm duyệt" (app không kiểm tra nội dung khoa học giáo viên viết).
- **Báo cáo:** bước cuối hiện bản xem trước, có **Lưu báo cáo (.md)** và **Sao chép báo cáo**. Số đo
  của mô phỏng, phần em viết, kết luận tham khảo, dữ liệu chưa kiểm duyệt và nguồn nằm ở các mục
  riêng. Nếu máy không cho sao chép, app nhắc em bôi đen chữ trong bản xem trước rồi bấm Ctrl+C. Báo
  cáo được tạo trên máy, app không gửi đi đâu. Bài đang làm dở được giữ khi mở lại app.
- **Hỏi thầy:** nút **Hỏi thầy** mở khung AI Teacher với câu hỏi viết sẵn theo bước đang làm (em sửa
  được trước khi gửi). Thầy chỉ thấy số đo và ghi chú của bài khi em bật **Lấy thông tin từ màn
  hình** trong khung chat.

## Bố cục màn hình

- **Thanh trên:** chọn môn, ô nhập đề bài, trạng thái AI, sáng/tối, trình
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
- **So sánh trước / sau** (nút ghim, ở chủ đề có vết quỹ đạo): chạy một lần, bấm **Ghim lần chạy
  này để so sánh**, đổi thông số rồi chạy lại. Quỹ đạo đã ghim hiện bằng nét đứt màu xám; ô chú thích
  ở góc dưới ghi giá trị lúc ghim của các thông số đã đổi. Nét đứt là bản sao quỹ đạo đã tính, không
  tính thêm gì. Bấm lại nút ghim hoặc dấu × để bỏ; mở chủ đề khác thì tự bỏ.
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
- **Giữ khóa như mật khẩu:** không gửi cho bạn bè, không đăng lên mạng. Bản desktop cất khóa trong kho khóa
  của Windows (Windows Credential Manager), không lưu trong tệp. Trên trình duyệt/localhost, khóa chỉ nằm
  trong bộ nhớ của trang (tắt hoặc tải lại là mất) nên mỗi phiên phải nhập lại. Lỡ để lộ khóa: vào Google AI Studio
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

Cần biết: người tạo tài khoản Groq phải **từ 18 tuổi**. Theo điều khoản của Groq, nội dung gửi lên **không được dùng để
huấn luyện AI**; nếu tài khoản có tùy chọn "Zero Data Retention", nên bật. Gói miễn phí có giới hạn
(khoảng 1 000 lượt/ngày). Mô hình mặc định: `qwen/qwen3.8-27b` (đổi được ở ô **Mô hình dự phòng**).

## An toàn và quyền riêng tư

**Lần đầu mở app** sẽ có câu hỏi **"Trước khi bắt đầu"**:

- Đánh dấu "Tôi đã đọc… và đồng ý", bấm **Tôi đủ 18 tuổi — bật AI**. Nếu bấm **Tôi chưa đủ 18
  tuổi**, app vẫn dùng được toàn bộ mô phỏng, thư viện bài mẫu, Tự dựng cảnh; chỉ phần AI tắt (nhà
  cung cấp AI chỉ cho người từ 18 tuổi). Chưa xác nhận 18+ thì app **không cho lưu khóa API**. Trả
  lời lại: Cài đặt → **An toàn & quyền riêng tư**.

Khi dùng AI:

- Phần do AI đọc hoặc viết có nhãn **Nội dung do AI hỗ trợ**. Thấy nội dung sai, lạ hoặc khó chịu:
  bấm **Báo cáo nội dung không phù hợp**.
- Đề bài có **số điện thoại, email, số căn cước, họ tên/địa chỉ** sẽ **không được gửi** cho AI — xóa
  phần đó rồi phân tích lại. Nội dung không phù hợp với việc học cũng bị chặn; câu trả lời của AI
  có nội dung không phù hợp sẽ bị ẩn.
- Nếu đề bài cho thấy bạn đang gặp chuyện rất khó khăn, app **không gửi cho AI** mà hiện các số
  điện thoại hỗ trợ (đường dây Ngày Mai 096 306 1414; nguy hiểm ngay: **115**). Hãy nói chuyện với
  người bạn tin tưởng.
- **Nhật ký sự cố** (Cài đặt → An toàn & quyền riêng tư) chỉ ghi **loại sự cố và thời gian**, không
  ghi nội dung.
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
- **Nguyên phân 3D:** chủ đề Nguyên phân mở hình 3D (nút **3D / 2D** để đổi). Chọn tế bào **Động
  vật** hoặc **Thực vật**, bấm Phát hoặc **Bước trước / Bước tiếp theo**, chọn tốc độ; kéo chuột để
  xoay, bấm vào một bộ phận (NST kép, tâm động, thoi phân bào, trung thể, thành tế bào…) để đọc chức
  năng của nó. Số NST, cromatit, ADN luôn do mô hình đếm; kích thước, vị trí, thời gian chỉ là minh
  họa. Pha S không vẽ thành bước riêng (G2 đã có NST kép). Khi chất lượng hiển thị là Thấp hoặc máy
  không có WebGL2, app dùng hình 2D và ghi rõ lý do. Từ bản 0.7, mỗi crômatit co xoắn dần ngay tại
  chỗ; ở chất lượng **Cao** có thêm màng nhân kép có lỗ (vỡ thành túi nhỏ ở kì đầu), trung tử 9 bộ
  ba vi ống và các túi tạo tấm tế bào ở thực vật.
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

### Hình 3D trong Sinh học (bản 0.7, làm đẹp ở 0.7.1)

Cả 11 bài Sinh học mở bằng hình 3D. Cách dùng chung:

- Nút **3D / 2D** để đổi hình; app nhớ lựa chọn của từng bài. Kéo chuột để xoay, lăn chuột để
  phóng to, phím mũi tên cũng xoay được; **Góc nhìn** đổi giữa **Toàn cảnh** và cận cảnh.
- Bật **Hiện tên** để thấy tên các phần ngay trên hình (chế độ Cơ bản bật sẵn).
- Mọi con số trên hình (số NST, số hạt, tỉ lệ con lai, chữ cái của trình tự…) do mô hình của bài
  tính, giống hình 2D. Hình dạng, kích thước, vị trí và chuyển động chỉ là **minh họa** — hình nào
  cũng ghi câu này. Khi phải vẽ một hình cho nhiều cá thể hoặc nhiều hạt, hình có ghi chú mỗi hình ứng với bao nhiêu.
- Chất lượng hiển thị Thấp, máy không có WebGL2 hoặc card đồ họa gặp lỗi → app tự dùng hình 2D và
  ghi lý do. Máy chậm thì chuyển động bớt mượt, số liệu không đổi.
- Từ 0.7.1 mọi bài có cùng một "sân khấu": nền dải màu, ánh sáng kiểu phòng chụp (bốn bài quần thể
  dùng ánh sáng ngoài trời), vật liệu riêng cho màng, NST, ADN, protein, thủy tinh và chất lỏng. Chỉ
  ở chất lượng **Cao** trên máy có card đồ họa rời mới có thêm bóng ở chỗ khuất và ánh sáng nổi;
  máy dùng đồ họa tích hợp vẫn vẽ như mức Cao của 0.7.0. Nếu máy không theo kịp, app tự tắt dần các
  hiệu ứng này, số liệu không đổi.

Từng bài:

- **Giảm phân 3D:** 12 bước của tế bào động vật, từ G1 tới phân chia tế bào chất II. Ở kì đầu I
  thấy trao đổi chéo và điểm bắt chéo; màu từng đoạn crômatit cho biết phần từ mẹ, phần từ bố. Hình
  3D dùng đúng lần sắp xếp ngẫu nhiên của hình 2D. Bấm lần thứ hai vào một NST để xem các đoạn ADN của một crômatit.
  Chưa vẽ giảm phân ở thực vật.
- **ADN → mARN → Protein 3D:** chuỗi xoắn kép mở ra, mARN được tổng hợp, rồi ribôxôm dịch mỗi bước
  một bộ ba. Góc nhìn **Theo dõi** (đi theo chỗ đang làm việc) hoặc **Toàn cảnh**; **Hiện tên và
  chữ cái** để đọc bazơ và axit amin.
- **Đột biến điểm 3D:** ADN bình thường và ADN đột biến xếp song song, kèm mARN và chuỗi axit amin
  của cả hai. Chỗ thay đổi được viền nổi. Góc nhìn **Vị trí đột biến** đưa máy ảnh tới đúng chỗ đó;
  bấm vào một cặp bazơ của ADN bình thường để chọn vị trí đột biến.
- **Di truyền Mendel 3D:** bố mẹ, giao tử, bảng Punnett và các cột con lai cao theo xác suất. Đi
  qua bốn bước **Giảm phân → Giao tử → Thụ tinh → Con lai**; góc nhìn **Bảng Punnett** để nhìn
  thẳng vào bảng. Phần **Con lai ngẫu nhiên** dùng cùng lần tạo ngẫu nhiên với bảng 2D.
- **Động học enzyme 3D:** số enzyme đang gắn cơ chất theo v/Vmax của công thức trong bài (làm tròn);
  chất ức chế gắn đúng chỗ theo kiểu ức chế đã chọn; thang "1 hạt = … mM". Góc nhìn **Cận cảnh
  enzyme** để nhìn một enzyme.
- **Khuếch tán & thẩm thấu 3D:** số hạt mỗi ngăn theo định luật Fick ở mọi thời điểm, hạt đi qua
  lỗ màng. Thẩm thấu: ống chữ U có thước cm, mực nước lấy từ đồ thị của bài.
- **Bốn bài quần thể (0.7.1)** mỗi bài có một khung cảnh ngoài trời riêng. Con vật, cây cỏ, đảo,
  hàng rào và cách chúng di chuyển chỉ là minh họa; số con vẽ ra lấy từ mô hình của bài. Khi quần
  thể lớn hơn số hình vẽ được, góc hình ghi tỉ lệ, ví dụ "1 hình = 5 cá thể (làm tròn)". Bấm vào một
  con vật, cột đo hoặc bảng để xem thẻ giải thích (ba bài sau còn đưa hình tới gần chỗ đã bấm);
  **Toàn cảnh** đưa về hình cả quần thể.
  - **Hardy–Weinberg 3D:** hình nằm trên đồ thị và bảng của bài. Màu thân con vật là kiểu gen, hai
    hạt trên râu là hai alen; hũ thủy tinh "vốn gen" chứa hạt alen và vòng p : q. Đổi thế hệ: thế
    hệ 0 là số em nhập, thế hệ 1 đúng là lần **Cho ngẫu phối 1 thế hệ**. Góc nhìn **Cận cảnh cá thể**.
  - **Phiêu bạt di truyền 3D:** mỗi lần chạy của mô hình là một hòn đảo, dải màu quanh bờ cho p : q
    của thế hệ đang xem; đảo chỉ còn một alen (A cố định hoặc mất hẳn) có cờ màu alen còn lại. Đồ
    thị dị hợp tử bên dưới đánh dấu cùng thế hệ. Góc nhìn **Cận cảnh một đảo**.
  - **Tăng trưởng logistic 3D:** đàn con vật trong hàng rào trên đồng cỏ ba lá, số con theo N(t) của
    công thức; cột thủy tinh có vạch K và K/2 và mũi tên dN/dt (thẻ ghi mũi tên dài nhất ứng với
    bao nhiêu). Thanh thời gian vẽ sẵn đường N(t); **Tới t\*** nhảy tới điểm uốn. Góc nhìn **Cận
    cảnh đàn**.
  - **Con mồi – vật ăn thịt 3D:** con mồi và vật ăn thịt trên đồng cỏ, số con theo điểm đã tính gần
    nhất của quỹ đạo (không nội suy); hai ống thủy tinh cho x và y có vạch x\*, y\*, mũi tên dx/dt,
    dy/dt và biển ghi số; bảng bên phải vẽ quỹ đạo pha như hình 2D, có hạt sáng ở thời điểm đang xem.

## Lưu, mở, xuất và lịch sử

- **Menu Tệp** (nút ☰ ở thanh trên): Mở tệp `.stemsim`, Lưu mô phỏng, Xuất ảnh PNG, Nguồn & Giả
  định, Hướng dẫn nhanh.
- **Lưu (Ctrl+S) / Mở (Ctrl+O):** tệp `.stemsim` lưu chủ đề và các thông số bạn đã chỉnh (không lưu
  kết quả — app tính lại khi mở, nên kết quả luôn đúng với phiên bản app).
- **Hoàn tác / Làm lại (Ctrl+Z / Ctrl+Y):** áp dụng cho thông số của chủ đề đang mở. Kéo thanh trượt
  liên tục được tính là một bước.
- **Xuất PNG:** chụp khung mô phỏng (hình 2D, 3D hoặc đồ thị). Chủ đề hiển thị bằng bảng thì dùng Xuất
  CSV. Ở chế độ **Nâng cao**, rê chuột lên một đồ thị để thấy nút **Xuất CSV** ở góc phải (trên màn
  hình cảm ứng nút luôn hiện).
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
- App kiểm tra chữ ký số và tên bản trước khi dùng một gói cập nhật.

## Khi máy yếu

App ưu tiên đúng hơn mượt. Nếu máy không kịp vẽ, thanh trạng thái báo "Đã hạ chất lượng hiển thị"
(số liệu không đổi). Nếu không kịp tính, mô phỏng chạy chậm hơn thời gian thực và ghi rõ tỉ lệ (ví dụ
×0,5). Khi bộ nhớ cao, app giải phóng bộ nhớ đệm và nhắc bạn đóng bớt chủ đề 3D.

## Cài đặt (nút bánh răng)

Cài đặt chia thành các trang nhỏ, chọn ở cột bên trái (màn hình hẹp: hàng thẻ phía trên; phím mũi
tên lên/xuống để chuyển trang). Mỗi trang gồm vài ô nhỏ.

- **Giao diện:** chế độ Cơ bản / Nâng cao; sáng / tối / theo hệ thống; cỡ chữ 90–140 %; ngôn ngữ;
  khôi phục bố cục.
- **Mô phỏng & hiệu năng:** chất lượng hiển thị (Tự động / Thấp / Trung bình / Cao, nút Đo lại — chỉ
  ảnh hưởng hình ảnh, không ảnh hưởng số liệu); g mặc định (9,80665 / 9,81 / 9,8 / 10 m/s², chỉ dùng
  khi đề không cho g).
- **Phím tắt:** danh sách đầy đủ.
- **Kết nối AI:** ô "Nhà cung cấp và khóa API" (Gemini khuyên dùng, Claude, Groq miễn phí hoặc tắt;
  hướng dẫn lấy khóa; mô hình; nút Kiểm tra key), ô "Thời gian chờ và giới hạn mỗi ngày" và ô "Dự
  phòng khi hết lượt" (mặc định Groq, xem phần Groq ở trên).
- **AI Teacher:** Think (API thứ hai rà soát câu trả lời) và ô **Dữ liệu của em đi đâu?**.
- **AI local (Gemma):** tải, chọn, xóa mô hình Gemma chạy trên máy; điều khoản Gemma.
- **GPU cho Gemma:** chọn card đồ họa chạy Gemma (bản desktop trên Windows, máy có hai card; đổi card
  cần mở lại app) và xem WebGPU thật đang chạy trên card nào; độ dài câu trả lời của Gemma (Ngắn / Vừa
  / Dài); giải phóng bộ nhớ GPU sau 5 hoặc 15 phút không dùng, hoặc ngay lập tức.
- **Thư viện kiến thức:** ghi chú có sẵn, tài liệu em thêm (.txt, .md, .csv, .json), tra Wikipedia.
- **Trí nhớ hội thoại:** Vừa / Dài (phần cũ hơn được tóm tắt ngắn); lưu hay không lưu cuộc trò chuyện
  trên máy (tắt thì bản tóm tắt cũng không lưu); xóa cuộc trò chuyện.
- **Giọng nói:** xem mục "Giọng đọc tiếng Việt" bên dưới.
- **An toàn & quyền riêng tư:** xác nhận độ tuổi và điều khoản, trang quyền riêng tư, nhật ký sự cố.

### Giọng đọc tiếng Việt

Bật **Đọc to câu trả lời** (hoặc nút loa trong khung chat). Trước khi đọc, app chuyển câu trả lời
thành lời tiếng Việt: số dùng dấu phẩy thập phân ("9,81" → "chín phẩy tám mốt"), đơn vị ("m/s²" →
"mét trên giây bình phương"), công thức ("F = m·a" → "ép bằng mờ nhân a"), phân số, căn, chữ Hy Lạp,
công thức hóa học ("H₂O" → "hát hai ô"), và ngắt nghỉ ở dấu câu như khi thầy cô giảng. Nút **Xem chữ
sẽ đọc** cho thấy đúng lời app sẽ đọc. Có ba nguồn giọng:

- **Giọng của Windows** (miễn phí, không cần mạng). Máy chưa có giọng tiếng Việt thì Windows đọc bằng
  giọng tiếng Anh, sai dấu. Cách cài: Settings → Time & language → Speech → "Manage voices" → **Add
  voices** → gõ "Vietnamese" → chọn **Vietnamese (Vietnam)** → Add (giọng "Microsoft An"), rồi mở lại
  SimLab. Nút **Mở cài đặt giọng nói của Windows** mở thẳng trang đó (bản desktop).
- **Giọng Gemini (trực tuyến):** tự nhiên nhất; dùng khóa Gemini ở Kết nối AI và tính vào số lượt AI
  mỗi ngày. Chữ của câu trả lời (không có câu hỏi của em) được gửi tới Google để đọc.
- **Giọng tiếng Việt trên máy:** tải một lần (≈ 115 MB, mô hình MMS-TTS của Meta, giấy phép CC BY-NC
  4.0: chỉ dùng phi thương mại), sau đó đọc không cần mạng; giọng hơi giống máy hơn nhưng đúng dấu.
  Chạy bằng card đồ họa nếu có, nếu không thì bằng CPU (chậm hơn).

Giọng đã chọn không đọc được (thiếu khóa, mất mạng, chưa tải) thì app đọc bằng giọng Windows và trang
Giọng nói ghi lý do. Có thể chọn kiểu giọng (Vui vẻ, Trầm ấm, Lanh lẹ, Hài hước) và tốc độ 0,8–1,3×.

## Lỗi thường gặp

- **App mở ra màn hình trắng:** máy thiếu WebView2 — xem đoạn **WebView2** trong mục "Cài đặt" ở đầu hướng dẫn.
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

| Phím            | Tác dụng                            |
| --------------- | ----------------------------------- |
| Space           | Chạy / tạm dừng                     |
| R               | Đặt lại                             |
| .               | Bước tiếp theo                      |
| Ctrl+Z / Ctrl+Y | Hoàn tác / Làm lại                  |
| Ctrl+S / Ctrl+O | Lưu / mở tệp .stemsim               |
| F5 / Esc        | Vào / thoát chế độ trình chiếu      |
| Ctrl+= / Ctrl+- | Tăng / giảm cỡ chữ                  |
| Ctrl+Enter      | Phân tích đề (khi đang ở ô đề bài)  |
| Ctrl+K          | Tìm nhanh (chủ đề, trang, thao tác) |
