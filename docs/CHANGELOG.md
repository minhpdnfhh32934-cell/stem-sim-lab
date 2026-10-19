# Changelog

Mọi thay đổi đáng chú ý của SimLab (tên cũ: STEM Sim Lab), bản mới nhất ở trên. Định dạng theo [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), số phiên bản dạng `x.y.z`. Tệp này được tạo từ `release-notes/versions.json` bằng `npm run release-notes`. Đừng sửa tay. Lịch sử đầy đủ kèm bằng chứng: [VERSION\_HISTORY.md](VERSION_HISTORY.md).

## [Unreleased] - 0.6.0 (Đang xét duyệt)

_Bản ứng viên phát hành 0.6.0, chưa phát hành. PR #20 (feat/audit-g0-g5) và PR #21 (G8, feat/teacher-board-runtime, đầu abc9e0c) đang mở, chưa gộp. Science Studio (các bước S1–S5 và bước chuẩn bị phát hành, 19/10/2026) nằm trên nhánh feat/science-studio chồng lên PR #21, chỉ có trên máy người phát triển: thay đổi đã stage, chưa commit, chưa có PR. Chưa có tag, GitHub Release hay lượt Release trên GitHub Actions; bộ cài chỉ được dựng thử trên máy người phát triển. Ghi chú công khai đã đặt notesReady: true để chuẩn bị phát hành — chủ dự án đọc lại trước khi chạy Release. Trước khi phát hành: gộp vào main; kiểm tra các cài đặt an toàn phát hành chỉ chủ repo bật được (docs/RELEASE.md, mục “An toàn khi phát hành”: environment release, secret ký chỉ ở environment, ruleset cho tag, kiểm tra bắt buộc, Immutable releases); không tích “Bắt buộc cập nhật” (bản này nâng phiên bản lõi). Sau khi gộp: status merged-not-released; sau khi publish: released._

Bản lớn: Science Studio mới với bài học có hướng dẫn cho Hóa học, Sinh học, Vật lí và trang Soạn bài. AI Teacher giảng trên cả bảng, có “Khoanh để hỏi”, dùng được chương trình AI em tự cài trên máy (Ollama, LM Studio, llama.cpp), dùng kết quả do SimLab tính và nói rõ điều gì chưa kiểm chứng. Ngoài ra có mô phỏng Nguyên phân 3D, Gemma có thêm lớp bảo vệ trên card đồ họa tích hợp và nhiều sửa lỗi bảo mật.

### Added

- Science Studio (trang mở đầu → thẻ “Science Studio”): bài học có hướng dẫn theo các bước Dự đoán → Thí nghiệm → Quan sát → Giải thích → Kết luận → Báo cáo. Vật lí: rơi tự do, thả từ độ cao gấp đôi và so sánh hai lần chạy A và B. Hóa học: bàn thí nghiệm ảo nhận biết ion Cl⁻ bằng dung dịch AgNO₃. Sinh học: Nguyên phân 3D, tìm kì mà NST kép xếp hàng ở mặt phẳng xích đạo và tìm bộ phận tế bào theo chức năng. Mọi số đo do mô phỏng tính; hiện tượng và phương trình hóa học chép từ thư viện phản ứng của SimLab.
- Soạn bài trong Science Studio: tạo, sửa, nhân bản, xóa và xem trước bài học cho ba môn; nhập và xuất tệp bài học. Chỉ chọn được những gì mô phỏng chạy được; bài soạn lưu trên máy này và luôn ghi “chưa được kiểm duyệt”.
- Báo cáo bài học trong Science Studio: xem trước, sao chép hoặc lưu thành tệp, với số đo của mô phỏng tách riêng khỏi phần em viết; bài đang làm được giữ lại khi mở lại app. Nút “Hỏi thầy” mở AI Teacher với câu hỏi viết sẵn; thầy chỉ thấy số đo và ghi chú của bài khi em bật “Lấy thông tin từ màn hình”.
- Mô phỏng Nguyên phân 3D cho tế bào động vật và thực vật: 7 bước, phát/tạm dừng/từng bước, xoay, chọn một bộ phận để đọc chức năng, có Thẻ Khoa học riêng.
- Thẻ 'Kết quả do SimLab tính' khi câu hỏi có phương trình hóa học: bộ cân bằng của SimLab giải phương trình, AI chỉ giải thích.
- Nút 'Gợi ý từng bước', và nút 'Xem mô phỏng' dưới câu trả lời khi câu hỏi nêu đúng tên một chủ đề có mô phỏng.
- Nút 'Dừng' để dừng câu trả lời đang viết, với Gemma lẫn AI trực tuyến.
- SimLab nhắc khi đề bài có thể còn thiếu số liệu, và liệt kê các con số AI tự đưa ra mà chưa ai cho (chưa kiểm chứng).
- Cảnh báo khi bật giọng đọc mà máy không có giọng tiếng Việt.
- Hộp 'SimLab đã được cập nhật' cho biết điểm mới sau khi cập nhật, và trang 'Lịch sử phiên bản' trong Cài đặt.
- “Khoanh để hỏi” trên bảng: khoanh, gạch chân hoặc chạm vào chỗ muốn hỏi rồi bấm “Hỏi thầy chỗ này”. App đọc đúng chữ, công thức và nhãn hình đang có trên bảng; câu trả lời hiện trong khung chat và bài giảng chờ đến khi bấm “Quay lại bài giảng”. Chỗ không có chữ chỉ được gửi dạng ảnh cho AI đọc ảnh chạy trên máy, không lên mạng.
- Cài đặt → “AI trên máy khác”: tìm, kiểm tra và chọn chương trình AI em tự cài trên máy (Ollama, LM Studio, llama.cpp hoặc máy chủ kiểu OpenAI) cho AI Teacher, “Phân tích đề” và “AI diễn giải”. Chỉ dùng địa chỉ trên chính máy; khi chương trình lỗi, app nói rõ và không tự gửi câu hỏi lên mạng; mô hình cloud của Ollama bị từ chối.
- Phóng to, thu nhỏ bảng (1–2×) và nút “Vừa khung”; chữ đã viết không đổi chỗ.
- Nguyên phân 3D: nút “Hỏi thầy về bộ phận này” mở AI Teacher với câu hỏi viết sẵn về bộ phận đang chọn.
- Trên ứng dụng desktop, câu trả lời của AI trực tuyến (Gemini, Claude, Groq) hiện dần trong khi đang viết.

### Improved

- Với AI trực tuyến, AI Teacher được hướng dẫn giảng theo trình tự: mục tiêu, giải thích đơn giản, ví dụ, các bước có lý do, một lỗi hay gặp. Gemma được dặn trả lời thẳng câu hỏi trước rồi giải thích ngắn, có lý do. Câu trả lời về khái niệm được dặn kết thúc bằng một câu hỏi kiểm tra (trừ Gemma trên card đồ họa tích hợp, để câu trả lời ngắn); Gemma 1B thường chưa làm theo (khoảng 1/5 câu trả lời khi đo).
- Thầy đọc đúng chữ đang viết trên bảng; tạm dừng giữa câu thì đọc lại câu đó; đọc ký hiệu đúng hơn (2n, \[S\], (aq), mũi tên phản ứng).
- Khi giọng đọc gặp lỗi, giọng dự phòng đọc tiếp từ đoạn chưa nghe, không đọc lặp.
- Gemma trả lời đúng ý hơn và bắt đầu nhanh hơn; câu trả lời lẫn chữ nước ngoài ít hơn hẳn (50 % → 7 %) và viết méo thuật ngữ cũng ít hơn (19 % → 4,8 %), nhưng vẫn còn (đo với Gemma 1B trên 42 câu hỏi; câu trả lời dài hơn trước).
- Tìm ghi chú kiến thức hợp với câu hỏi tốt hơn; ghi chú lạc đề không được gửi cho AI.
- Giọng đọc trên máy: âm lượng giữa các đoạn như nhau, tiếng đầu tiên đến sớm hơn, ngắt nghỉ theo câu và mệnh đề, không cắt giữa số và đơn vị; trước ý chính có một quãng nghỉ ngắn.
- Đọc đúng hơn nhiều ký hiệu khoa học: MeV, MPa, đơn vị mét vuông/mét khối, cấu hình electron, mũi tên phản ứng, "tan" trong hòa tan.
- Bảng chỉ trình bày nội dung bài học: phần suy nghĩ nội bộ của AI, câu lặp lại lời nhắc, dòng nguồn và ký hiệu định dạng thừa không được viết lên bảng hay đọc to; lời chào chỉ được nói, không viết.
- Thầy dùng cả bảng: mỗi bảng được chia theo nội dung (một, hai hoặc ba cột), phần không vừa xuống một dải ngang cả bảng, công thức dài viết thành nhiều dòng; không có chữ đè lên nhau khi đổi cỡ cửa sổ hay phóng to.
- Lỗi AI được nói bằng lời dễ hiểu (hết lượt, sai khóa, mất mạng, chương trình trên máy chưa mở…), dòng “gửi tới” nêu đúng nơi câu hỏi sẽ được gửi, và nhà cung cấp dự phòng chỉ trả lời khi nhà cung cấp chính hết lượt hoặc hết tiền.

### Fixed

- Gemma có thể làm treo card đồ họa tích hợp và khiến máy khởi động lại: nay sau một lỗi card, Gemma dừng tới khi mở lại app; card tích hợp dùng lời nhắc ngắn hơn; câu trả lời bị treo được tự dừng.
- Khi bật giọng đọc, bài giảng trên bảng có thể dừng sau câu đầu tiên.
- Giọng đọc chạy trên máy không bao giờ nạp lại vào card đồ họa vừa gặp lỗi; khi card lỗi, giọng chuyển sang CPU.
- Bút của thầy có thể vẫn viết trên bảng cũ khi chuyển sang bảng khác: nay mỗi lượt giảng chỉ viết trên bảng của nó, và quay lại bảng cũ thì phần đã viết vẫn còn.
- “Viết tiếp” không còn ẩn hay đảo các dòng đã viết và không để lại phần dở dang.
- Giữ phím Enter không còn gửi câu hỏi đang gõ trong ô chat.

### Security

- Quy trình phát hành chặt hơn: chỉ phát hành mã đã có trên nhánh chính, bước ký số chạy riêng, mọi công cụ tự động được ghim đúng phiên bản; bật quét bí mật và cảnh báo thư viện có lỗ hổng.
- Liên kết do AI viết không còn bấm được, và cửa sổ app không mở trang web lạ bên trong.
- Tài liệu và ghi chú đưa cho AI được đánh dấu là dữ liệu tham khảo, không phải lệnh.
- Giới hạn lượt AI mỗi ngày chắc chắn hơn (mặc định 100 lượt).
- Mô hình Gemma và giọng đọc trên máy luôn tải đúng một phiên bản đã ghim.

### Performance

- Không tra Wikipedia khi Gemma đã có ghi chú phù hợp trong thư viện.

### Changed

- Phiên bản 0.6.0 thay đổi cả phần lõi: máy đang dùng 0.5.x cần tải bộ cài mới một lần.

### Known Issues

- Gemma 1B vẫn hay sai kiến thức và có lúc khen câu trả lời sai của học sinh; hãy kiểm tra lại bằng mô phỏng hoặc sách.
- Chưa đánh giá cách giảng với Gemini, Claude hoặc Groq thật (chưa có khóa để thử).
- Mô tả các kì của Nguyên phân 3D đang chờ giáo viên duyệt.
- Bản Microsoft Store cần nộp gói mới và chờ Microsoft duyệt, nên người dùng Store nhận bản này muộn hơn người dùng bản tải từ GitHub.
- Các lớp bảo vệ mới cho Gemma trên card đồ họa tích hợp chưa được thử lại trên một card tích hợp thật.
- Trên máy không có card đồ họa rời, giọng đọc trên máy chạy bằng CPU và chậm hơn lời nói nên có quãng chờ giữa các đoạn; ở bản này quãng chờ còn dài hơn trước (trung vị 7,3 s → 8,4 s mỗi câu, đo trên 19 câu).
- Giọng MMS không có ngữ điệu, cảm xúc thật; chưa có người nghe chấm độ tự nhiên.
- “Khoanh để hỏi”, AI trên máy khác, câu trả lời hiện dần và nút “Hỏi thầy” của Science Studio mới chỉ được thử với dịch vụ giả lập: chưa thử với khóa API thật hay Ollama, LM Studio, llama.cpp thật; ảnh vùng khoanh chưa được thử trên ứng dụng desktop.
- SimLab không chọn được card đồ họa cho chương trình AI trên máy khác; chọn trong chính chương trình đó.
- Nội dung bài học của Science Studio (mục tiêu, câu hỏi, gợi ý, kết luận tham khảo), thư viện phản ứng hóa học và mô tả kì, bộ phận tế bào của Nguyên phân 3D đang chờ giáo viên duyệt; Studio ghi “chưa được kiểm duyệt” cạnh những phần này.
- Science Studio mới có một bài cho mỗi môn, và Soạn bài chỉ tạo được bài trên các mô phỏng đó: rơi tự do (Vật lí), các phản ứng tạo kết tủa có trong thư viện (Hóa học), Nguyên phân 3D (Sinh học).

## [0.5.2] - 2026-10-13

_Chỉ nâng phần web (package.json 0.5.2); phần lõi giữ 0.5.1, nên bộ cài kèm Release mang số 0.5.1. Đây cũng là lần đầu các thay đổi của 0.5.1 đến tay người dùng._

Giao diện đẹp và dễ dùng hơn: tìm nhanh bằng Ctrl+K, Gemma trả lời hiện dần từng chữ, ghim quỹ đạo để so sánh. Đây là bản cập nhật phần giao diện; bộ cài đi kèm mang số 0.5.1.

### Added

- Tìm nhanh bằng Ctrl+K: chủ đề, trang, mục Cài đặt và thao tác; gõ không dấu vẫn tìm được.
- Câu trả lời của Gemma hiện dần từng chữ.
- Ghim quỹ đạo để so sánh trước và sau khi đổi thông số (bản sao của vết đã ghi, không tính lại).
- Bản đồ nhỏ của bảng trắng.
- Thanh tải cho biết thời gian còn lại ('còn khoảng … phút').
- Hiệu ứng nhẹ khi đoán đúng hoặc đạt thử thách (tắt khi bật giảm chuyển động).

### Improved

- Ô chọn và thẻ có viên chọn trượt; nút Chạy/Dừng và Sáng/Tối đổi hình mượt; khung chờ dạng xương thay vòng xoay.
- Tìm chủ đề không thấy thì gợi ý môn khác có kết quả, kèm nút 'Xóa tìm kiếm'.
- Thanh công cụ, bảng số nổi và đồng hồ có nền kính mờ.

### Fixed

- Bảng thông tin phân tử không còn tràn khỏi cột Thuộc tính (sửa từ 0.5.1).
- Nút AI Teacher không còn che cột cuối của bảng; nay nằm ở góc vùng mô phỏng (sửa từ 0.5.1).
- Khung chat không còn mở cao hết màn hình (sửa từ 0.5.1).

### Security

- Mỗi đoạn trả lời hiện dần của Gemma đều qua bộ lọc an toàn; có đoạn không an toàn thì cả câu trả lời bị thu lại.

### Performance

- Tìm nhanh chỉ được tải khi dùng lần đầu (gói 6 kB), nên app mở vẫn nhẹ.

### Known Issues

- Bộ cài kèm bản này mang số 0.5.1 vì phần lõi không đổi; phần giao diện là 0.5.2.
- Máy đang dùng 0.5.0 cần tải bộ cài mới một lần.

## 0.5.1 - Đã gộp, chưa phát hành

_Không có tag v0.5.1 và không có GitHub Release riêng; bộ cài lõi 0.5.1 được phát hành lần đầu kèm Release v0.5.2. Gói Microsoft Store 0.5.1.0 đã gửi duyệt ngày 13/10/2026 và được chọn giữ lại; chưa có tài liệu nào cho thấy app đã lên Store._

_Ghi chú này là bản nháp, chưa được duyệt để công bố._

Chuẩn bị đưa SimLab lên Microsoft Store và sửa vài lỗi bố cục. Bản này không có bản phát hành riêng; các sửa lỗi đến với người dùng qua bản 0.5.2.

### Added

- Gói cài cho Microsoft Store; bản cài từ Store chỉ cập nhật qua Store (nút 'Mở Microsoft Store').
- Trang chính sách quyền riêng tư trên GitHub Pages.

### Fixed

- Bảng thông tin phân tử không còn tràn khỏi cột Thuộc tính.
- Nút AI Teacher không còn che cột cuối của bảng; nay nằm ở góc vùng mô phỏng.
- Khung chat không còn mở cao hết màn hình.

### Known Issues

- Gói Store 0.5.1.0 đang chờ duyệt và được giữ lại; lúc ghi, app chưa có trên Microsoft Store.
- Gói Store này dùng giao diện cũ, chưa có phần làm đẹp của 0.5.2.
- Chưa kiểm chứng: cài thử gói Store và bộ kiểm tra của Windows (WACK).

## [0.5.0] - 2026-10-13

App đổi tên thành SimLab, 'Thầy AI' thành AI Teacher. AI Teacher giảng trên bảng trắng và đọc bằng giọng tiếng Việt; chọn được card đồ họa cho Gemma; trí nhớ hội thoại dài hơn.

### Added

- AI Teacher giảng trên bảng trắng: chữ viết tay tiếng Việt, công thức, khoanh/gạch chân/đóng khung, đồ thị và sơ đồ lực do chương trình vẽ, bút cho học sinh.
- Giọng đọc tiếng Việt với 3 nguồn: giọng Windows, Gemini TTS (trực tuyến) và giọng MMS chạy ngay trên máy.
- Chọn card đồ họa chạy Gemma trên Windows: gợi ý card rời, nút 'Mở lại ngay'.
- Trí nhớ hội thoại dài hơn, có tóm tắt phần cũ; Cài đặt 'Trí nhớ hội thoại: Vừa/Dài'.
- Nút 'Viết tiếp' khi câu trả lời dài bị dừng giữa chừng; thầy viết tiếp ngay trên cùng bảng.

### Improved

- AI Teacher được viết câu trả lời dài hơn trước.
- Cài đặt chia thành 11 trang nhỏ.
- Ô chọn đẹp hơn; trang AI Teacher và Phòng thí nghiệm gọn hơn; không để một chữ đứng một mình trên một dòng.

### Fixed

- Gemma luôn chạy trên card tích hợp dù máy có card rời.
- Nút nhanh chỉ gửi đúng hai chữ 'Chậm hơn' nên AI hiểu sai; nay gửi câu hướng dẫn đầy đủ.
- Ghi chú kiến thức có sẵn được đánh dấu là đang chờ giáo viên duyệt.

### Performance

- Bộ cài và gói cập nhật nhỏ hơn: bộ cài 21,6 MB (0.4.1) → 11,7 MB, gói cập nhật 32,1 MB → 18,2 MB.

### Changed

- Đổi tên app thành SimLab và 'Thầy AI' thành AI Teacher; dữ liệu và khóa đã lưu được giữ nguyên.
- Chỉ còn một bản cài (bỏ bản thử nghiệm THPT): một bộ cài, một kênh cập nhật; bỏ năm sinh, mã PIN người giám sát và phiếu đồng ý của phụ huynh.
- Các khung không còn ẩn/hiện bằng nút hay phím tắt Ctrl+B/I/J; vẫn kéo để đổi kích thước được.
- Phần lõi thay đổi: cần tải bộ cài mới một lần.

### Known Issues

- Máy đã cài bản thử nghiệm THPT (0.4.1 trở về trước) không nhận cập nhật nữa.
- Chưa kiểm chứng lúc phát hành: Gemma trên card rời sau khi gộp, giọng Gemini TTS với khóa thật, giọng 'Microsoft An' trong app, bộ cài Windows.

## 0.4.3 - Chưa xác minh

_Nhãn nội bộ, chưa bao giờ là số phiên bản trong package.json (commit cbb176a nâng thẳng 0.4.1 → 0.5.0). Không có tag, Release hay ZIP. Nội dung, trừ bảng giảng LessonBoard đã bị thay, đến với người dùng trong 0.5.0._

_Ghi chú này là bản nháp, chưa được duyệt để công bố._

Bước phát triển nội bộ theo yêu cầu người dùng: trí nhớ hội thoại dài hơn, nút 'Viết tiếp', bỏ ẩn/hiện khung. Không phát hành riêng; nội dung đến người dùng trong 0.5.0.

### Added

- Trí nhớ hội thoại theo độ dài, có tóm tắt phần cũ, và nút 'Viết tiếp' khi câu trả lời chạm giới hạn.
- Bảng giảng các bước hiện dần (sau đó được thay bằng bảng trắng ở 0.5.0).

### Improved

- AI được viết câu trả lời dài hơn.

### Fixed

- Nút nhanh chỉ gửi đúng hai chữ 'Chậm hơn' nên Gemma hiểu sai; nay gửi câu hướng dẫn đầy đủ.

### Changed

- Bỏ ẩn/hiện khung (3 nút trên thanh trên cùng, phím Ctrl+B/I/J, nút X).

### Known Issues

- Chưa kiểm chứng: chất lượng tóm tắt và câu trả lời với Gemma và API thật, bộ cài Windows.

## 0.4.2 - Chưa xác minh

_Nhãn nội bộ, chưa bao giờ là số phiên bản trong package.json. Không có tag, Release hay ZIP. Nội dung đến với người dùng trong 0.5.0._

_Ghi chú này là bản nháp, chưa được duyệt để công bố._

Bước phát triển nội bộ: chọn card đồ họa cho Gemma trên Windows. Không phát hành riêng; nội dung đến người dùng trong 0.5.0.

### Added

- Chọn card đồ họa chạy Gemma trên Windows: danh sách card và bộ nhớ, gợi ý card rời, nút 'Mở lại ngay'.

### Fixed

- Gemma luôn chạy trên card tích hợp dù máy có card rời.

### Known Issues

- Chưa kiểm chứng: tốc độ Gemma thật trên từng card, bộ cài Windows.

## [0.4.1] - 2026-10-12

_Bản phát hành công khai đầu tiên của nhánh AI Teacher (lúc đó gọi là 'Thầy AI'), gồm cả nội dung của bản ZIP 0.4.0. Release được publish từ nhánh fork/thay-ai 6 phút trước khi PR #7 được gộp; mã phát hành (e342263) đúng là mã được gộp._

Ra mắt Thầy AI (nay là AI Teacher): trang trò chuyện riêng, Think kiểm tra chéo bằng một AI thứ hai, Gemma chạy ngay trên máy, thư viện kiến thức STEM và ô 'Dữ liệu của em đi đâu?'.

### Added

- Trang mở đầu với hai lối vào Phòng thí nghiệm và Thầy AI; khung chat nổi trong phòng thí nghiệm và trang Thầy AI riêng.
- Think: một nhà cung cấp AI thứ hai rà soát và viết lại câu trả lời.
- Gemma chạy ngay trên máy bằng card đồ họa: tải về một lần (bản 270M khoảng 345 MB), trả lời không gửi gì ra mạng.
- Thư viện kiến thức STEM (66 ghi chú) và thêm được tài liệu văn bản của riêng em.
- Chụp đề bằng camera; thầy đọc câu trả lời bằng giọng của máy; tin nhắn hiển thị công thức và khung code.
- Ô 'Dữ liệu của em đi đâu?', dòng cho biết câu hỏi sẽ được gửi tới đâu, nhãn AI và nút báo cáo trên mỗi câu trả lời.

### Improved

- Kiểm tra chỗ trống trước khi tải mô hình, nút 'Hủy tải', báo lỗi tải dễ hiểu và bước 'đang nạp vào GPU'.

### Fixed

- Sửa 5 lỗi khiến Gemma không chạy được ở bản ZIP 0.4.0, gồm nút 'Đang tải…' quay mãi và việc mỗi lần mở app phải tải lại mô hình.
- Cài mới không còn bị kẹt chờ Gemma khi đã có khóa AI trực tuyến.
- Think không còn bị từ chối khi dùng Gemini kèm dự phòng Groq.

### Security

- Tra Wikipedia thành tùy chọn, mặc định tắt (bản fork trước đó gửi câu hỏi tới Wikipedia mỗi lần mà không báo).
- Trang ngoài chỉ mở được từ một danh sách cố định.

### Changed

- Phần lõi thay đổi: cần tải bộ cài mới một lần.

### Known Issues

- Gemma 270M hay trả lời lạc đề.
- Chưa kiểm chứng lúc phát hành: Gemma 1B/E2B, chất lượng trả lời sau khi rút gọn lời nhắc, bộ cài Windows.

## 0.4.0 - Chưa xác minh

_Bản fork 'Thầy AI' gửi dưới dạng tệp ZIP. Không commit nào mang số 0.4.0 (package.json đi thẳng 0.3.0 → 0.4.1) và ZIP chưa được mở để kiểm. Nội dung vào git và được phát hành cùng 0.4.1._

_Ghi chú này là bản nháp, chưa được duyệt để công bố._

Bản thử 'Thầy AI' gửi dạng tệp ZIP: trang mở đầu hai lối vào, chat, Think, Gemma chạy trên máy, thư viện kiến thức. Chưa xác minh được nội dung chính xác của ZIP; các tính năng này được phát hành chính thức ở 0.4.1.

### Added

- Trang mở đầu hai lối vào Phòng thí nghiệm / Thầy AI; chat dạng bong bóng và trang Thầy AI riêng.
- Think: rà soát câu trả lời bằng một nhà cung cấp AI thứ hai.
- Gemma chạy ngay trong app bằng card đồ họa (không cần Ollama).
- Thư viện kiến thức STEM (66 ghi chú) và nhập tệp văn bản trên máy.
- Chụp đề bằng camera; giọng đọc của thầy; tin nhắn hiển thị công thức và khung code.

### Fixed

- Cài mới chọn sẵn Gemma làm 'Phân tích đề' và chat bị kẹt dù đã có khóa Gemini.
- Think với Gemini và dự phòng Groq luôn bị từ chối.
- Esc đóng Cài đặt cũng thoát trang Thầy AI và kết thúc hướng dẫn.

### Security

- Tra Wikipedia thành tùy chọn, mặc định tắt.
- Gỡ phần mã Ollama cũ; trang ngoài chỉ mở từ một danh sách cố định.

### Known Issues

- Gemma trên máy chưa chạy được ở bản này; 0.4.1 sửa 5 lỗi khiến Gemma không chạy.

## [0.3.0] - 2026-10-06

Học dễ hơn với trang chủ 'Hôm nay học gì?', chế độ Cơ bản/Nâng cao, Dự đoán trước và Thử thách; thêm Claude bên cạnh Gemini, dự phòng Groq và các lớp an toàn khi dùng AI.

### Added

- Trang chủ 'Hôm nay học gì?' và phần làm quen lần đầu; chế độ Cơ bản/Nâng cao.
- Dự đoán trước (Dự đoán → Quan sát → Giải thích) và thử thách cho cả 13 chủ đề Vật lý; gợi ý từng bước; huy hiệu; nhắc nghỉ mắt sau khoảng 45 phút.
- Màn hình 'Kết nối AI' với nút 'Kiểm tra key'; thêm Claude bên cạnh Gemini.
- Dự phòng miễn phí Groq khi Gemini hoặc Claude hết lượt.
- Bộ cài thử nghiệm 'STEM Sim Lab THPT' cho buổi học có người giám sát (chỉ Claude, khóa do người giám sát nhập bằng PIN), có kênh cập nhật riêng.
- Hộp thoại tự hiện khi có bản mới ('Cập nhật ngay' / 'Để sau'); có thể đặt cập nhật bắt buộc, được ký số.

### Improved

- Tự thử lại khi máy chủ AI bận (tối đa 3 lần), giới hạn lượt AI mỗi ngày, nhớ đề đã xác nhận để không hỏi AI lại.
- Nút cao ít nhất 40 px, chữ bài học 15 px, vừa màn hình 1366×768 không cuộn ngang.

### Fixed

- Bấm 'Thử lại' trong hộp thoại lỗi không còn tự hủy.

### Security

- Lần đầu mở app hỏi xác nhận đủ 18 tuổi và điều khoản; chưa xác nhận thì không lưu khóa và không gọi AI.
- Nhãn 'Nội dung do AI hỗ trợ' và nút báo cáo; chặn đề có thông tin cá nhân; lọc câu trả lời của AI; nhật ký sự cố chỉ ghi loại và thời gian; trang Quyền riêng tư.

### Changed

- Bỏ OpenAI; AI dùng Gemini (mặc định) hoặc Claude.
- Phần lõi thay đổi: cần tải bộ cài mới một lần.

### Known Issues

- 'Dạy học bằng AI' mới ở mức thiết kế, chưa dùng được.
- Mô hình dự phòng Groq chưa được thử với khóa thật.

## [0.2.0] - 2026-10-05

_PROGRESS.md ghi 'Phiên bản 0.2.0' ngày 29/09/2026 (lúc nâng số), nhưng Release v0.2.0 phát hành ngày 05/10/2026 và gồm cả việc chuyển sang Gemini._

Cập nhật ngay trong ứng dụng, không cần cài lại; AI đọc đề chuyển sang Gemini (có gói miễn phí) kèm hướng dẫn lấy khóa API.

### Added

- Cập nhật ngay trong app (menu ☰ → Kiểm tra cập nhật): tải phần giao diện mới, không cần cài lại tệp .exe.
- Hướng dẫn lấy khóa API Gemini ngay trong Cài đặt (người tạo khóa phải từ 18 tuổi).

### Improved

- Lỗi hết lượt, khóa sai hay tên mô hình sai được giải thích bằng lời dễ hiểu.

### Security

- Bản cập nhật trong app được ký số và kiểm tra chữ ký trước khi dùng.

### Changed

- AI mặc định là Gemini (có gói miễn phí); bỏ LM Studio.

## 0.1.0 - Bản phát triển, không phát hành

_Phiên bản khởi tạo. GitHub Actions dựng bộ cài 2 lần ngày 29/09/2026 nhưng chỉ thành artifact: không có tag v0.1.0 và không có GitHub Release._

_Ghi chú này là bản nháp, chưa được duyệt để công bố._

Bản đầu tiên của STEM Sim Lab (tên cũ của SimLab): mô phỏng Vật lý, Hóa học và Sinh học chạy ngay trên máy. Bản này chỉ được dựng thử, chưa phát hành.

### Added

- 13 chủ đề Vật lý 2D có đồ thị, lời giải từng bước, bảng số liệu và xuất CSV.
- Thẻ Khoa học cho mỗi mô phỏng: mô hình, công thức, giả định, mức tin cậy và nguồn.
- AI đọc đề bài và dựng mô phỏng; mọi con số do chương trình tính, bạn xác nhận bảng 'Tôi hiểu đề như sau' trước.
- Hóa học: bảng tuần hoàn 118 nguyên tố, 63 phân tử 3D, hình dạng phân tử VSEPR, 39 phản ứng (10 có cơ chế), cân bằng phương trình.
- Sinh học: 11 chủ đề (nguyên phân, giảm phân, ADN → protein, di truyền Mendel, Hardy–Weinberg, sinh thái, enzyme, khuếch tán và thẩm thấu).
- Lưu và mở tệp .stemsim, xuất ảnh PNG, hoàn tác/làm lại, lịch sử, chế độ trình chiếu và hướng dẫn lần đầu.
- Giao diện sáng/tối, tiếng Việt và tiếng Anh.

### Fixed

- Mô phỏng không còn bỏ sót lúc vật chạm đất khi được ném từ mặt đất, hoặc khi điểm cao nhất và lúc chạm đất rơi vào cùng một bước tính.
- Công thức hiển thị đúng vị trí trong bản cài đặt.
- Không còn báo 'chuyển động chậm' sai trên màn hình có tần số quét cao.

### Known Issues

- Bản này không có bộ cài phát hành công khai; chỉ có bản dựng thử trên GitHub Actions.

[Unreleased]: https://github.com/minhpdnfhh32934-cell/stem-sim-lab/pull/20
[0.5.2]: https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.5.2
[0.5.0]: https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.5.0
[0.4.1]: https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.4.1
[0.3.0]: https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.3.0
[0.2.0]: https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/tag/v0.2.0
