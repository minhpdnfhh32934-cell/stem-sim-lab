# Giảng trên bảng của AI Teacher: nghiên cứu, thiết kế, hiện trạng

Ngày: 12/10/2026. Mã nguồn: `src/teacher/board/`. Đặc tả nền: `PROMPT_PHAN_2.md` mục B3, B7, B8 và
`docs/TEACHSCRIPT.md`. Tài liệu này gom phần nghiên cứu (để đưa vào báo cáo) và mô tả những gì app
thật sự làm.

## 1. Giáo viên thật dùng bảng như thế nào

Tổng hợp từ tài liệu sư phạm và hướng dẫn thực hành (nguồn ở mục 6; phần lớn là tài liệu hướng dẫn,
không phải nghiên cứu thực nghiệm, nên chỉ coi là kinh nghiệm thực hành tốt):

| Nguyên tắc                            | Ý nghĩa                                                                                           | App làm thế nào                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chia bảng trước khi giảng**         | Bảng có vùng nội dung chính và vùng phụ (nháp, ví dụ, ghi chú); học sinh biết nhìn đâu, chép đâu. | Trước khi viết, mỗi mặt bảng được chia theo đúng những gì mặt đó sẽ có: chỉ có các bước thì viết trên cả bề ngang; có tóm tắt đề/ghi chú thì thêm cột trái; có hình, bảng số thì thêm cột phải; có cả hai thì 3 cột. Đường kẻ nhạt chỉ có giữa hai vùng đều đang có chữ (một dải ngang viết sau cùng bên dưới không làm mất đường kẻ). |
| **Viết ý chính, ngắn gọn**            | Bảng quá trống thì khó theo, quá dày thì rối.                                                     | Câu dài chỉ được _nói_; trên bảng chỉ có tiêu đề, dữ kiện, công thức, bước, kết quả. Một dòng viết tối đa ~150 ký tự.                                                                                                                                                                                                                  |
| **Trái → phải, trên → dưới**          | Thứ tự đọc rõ ràng.                                                                               | Mỗi vùng điền từ trên xuống; không bao giờ chồng chữ, đo theo đúng bề rộng nét chữ (có test sinh ngẫu nhiên 400 thao tác, và 40 bài ngẫu nhiên được chia mặt bảng, có cả "Viết tiếp").                                                                                                                                                 |
| **Màu có nghĩa cố định**              | 3–4 màu, mỗi màu một vai trò, học sinh quen dần.                                                  | Đỏ = tiêu đề, khoanh, đóng khung; xanh dương = đề mục, từ khóa, gạch chân, đồ thị; xanh lá = ghi chú; mực = nội dung. Học sinh có bút màu tím riêng.                                                                                                                                                                                   |
| **Tín hiệu hướng chú ý** (signaling)  | Gạch chân, khoanh, mũi tên, bàn tay đang viết dẫn mắt người học.                                  | Gạch chân đúng cụm chữ, khoanh tròn hơi hở như vẽ tay, đóng khung kết quả, mũi tên cong có nhãn, đầu bút hiện ở chỗ đang viết.                                                                                                                                                                                                         |
| **Chia nhỏ** (segmenting)             | Học từng phần nhỏ, có nhịp nghỉ.                                                                  | Giảng từng câu: thầy nói câu nào thì viết phần của câu đó; câu sau chờ cả lời và bút xong; có nút Tạm dừng, tốc độ viết 0,75×–2×.                                                                                                                                                                                                      |
| **Giải từng bước, hỏi lại**           | Không đưa đáp án ngay, mời học sinh nghĩ.                                                         | Lời nhắc chế độ bảng yêu cầu: tiêu đề → Cho/Tìm → các bước đánh số → kết quả → một câu hỏi gợi mở.                                                                                                                                                                                                                                     |
| **Giữ những gì quan trọng, xóa nháp** | Công thức chính ở lại trên bảng.                                                                  | Thầy có `<erase>`, `<correct>` (gạch và viết lại bên cạnh), `<newboard>` sang mặt bảng mới; các mặt cũ vẫn xem lại được.                                                                                                                                                                                                               |

## 2. Sản phẩm và nghiên cứu tương tự (tra 12/10/2026)

- **Dudely** (khởi nghiệp): gia sư STEM vẽ lời giải từng bước lên bảng và đọc to; kiểm tra hiểu bài
  trước khi đi tiếp.
- **Scribe AI** (dự án hackathon): AI viết "kịch bản hình ảnh" từng bước, bộ vẽ hoạt ảnh từng ký hiệu
  trong khi giọng đọc giải thích, dùng Gemini API. Gần ý tưởng của SimLab nhất.
- **Gauth AI Course** (2/10/2026): bảng chung để học sinh và gia sư AI cùng làm bài.
- **Thinkverse, DeskProf, Solversboard**: bảng cạnh khung chat; AI khoanh chỗ sai trên bài của học sinh.
- Nghiên cứu: **DrawDash** (arXiv, 12/2025) biến lời nói thành cập nhật sơ đồ dần dần; **AmIWrite**
  (CHI 2026) gia sư toán dựa trên chữ viết tay.

**Điểm khác của SimLab:** (1) AI không bao giờ chọn tọa độ: bố cục do code tất định; (2) mọi con số
viết lên bảng được kiểm nguồn gốc (có trong đề / phép tính máy kiểm lại / chưa kiểm chứng); (3) đồ thị
do code tính từ biểu thức, không vẽ theo số AI gõ; (4) chạy được cả với Gemma trên máy (câu trả lời
thường được tự xếp lên bảng); (5) tiếng Việt có dấu viết tay và giọng đọc tiếng Việt.

## 3. Yêu cầu từ tài liệu nhóm

Từ "Stem Sim Lab app" (P8.3 – T2 Bảng trắng; phần B7 của PROMPT_PHAN_2) và khung báo cáo:

- Chữ viết tay tiếng Việt có dấu, hiệu ứng viết từng chữ, gạch chân, khoanh tròn, mũi tên, sơ đồ, xóa
  và sửa, bố cục tự động không chồng lấn, lịch sử bảng; thử với nội dung dài.
- Báo cáo (2.3.1.4) nhấn mạnh: AI Teacher hỗ trợ có mục đích sư phạm, phân biệt số liệu thật từ mô
  phỏng với suy luận của AI, liên kết hiện tượng – công thức – bảng số – đồ thị.

## 4. Thiết kế đã làm

```
Câu trả lời AI ──► answerClean.ts (bỏ suy nghĩ ẩn, nhãn lời nhắc, nhận xét của người rà soát)
                                             ▼
                   TeachScript? ──có──► parseTeachScript (chịu lỗi)
                    │                        │
                    └──không──► markdownToScript (tự xếp câu trả lời thường)
                                             ▼
                       câu 1, câu 2, … (lời nói + hành động bảng)
                                             ▼
          lessonCheck.ts: chỉ giữ nội dung học, giới hạn độ dài, nhãn → ý nghĩa
                                             ▼
          lesson.ts: nói câu (giọng tiếng Việt) ∥ bút viết / đánh dấu / vẽ
                                             ▼
          layout.ts (chia mặt bảng theo nội dung, không chồng)   provenance.ts (nguồn gốc số)
                                             ▼
          Whiteboard.tsx: chữ viết tay, đầu bút, nét vẽ tay (rough.ts), hình (BoardDrawing.tsx)
```

- **Bảng chỉ có nội dung học (mục 1, `lessonCheck.ts`, chi tiết ở TEACHSCRIPT.md §7.1):** trước
  khi vẽ, mỗi câu trả lời được kiểm thành một bài có kiểu rõ ràng (tiêu đề, dữ kiện, công thức,
  bước, ghi chú, kết quả, câu hỏi kiểm tra…).
  - Lời chào, "Tôi là AI…", "Dưới đây là…", "Hy vọng…" được **nói** nhưng không viết lên bảng.
    Nếu ngay sau lời chào có phép tính ("Chào em, v = gt = 9,8·2 = 19,6 m/s.") hoặc một lý do
    ("Câu hỏi hay đấy, vì trọng lực…") thì phần đó vẫn được viết. Dòng ngắn của bài học không bao
    giờ bị coi là lời nói suông: câu trả lời "Không." / "Có." / "Được." / "Vâng." / "Dạ." (đứng
    một mình; "Vâng ạ!", "Dạ vâng.", "Vâng!", "Dạ, mình sẽ…" là lời dạ vâng lễ phép: chỉ nói), ẩn số
    "a = ?", ký hiệu "σ là độ đàn hồi", "Dây dẫn." (so từ có dấu: "dây" khác "đây"). Câu bài học
    chỉ trông giống lời chào hay suy nghĩ vẫn được giữ: "Chào mào là loài chim…", "Cháo là…", "Hy
    vọng sống…", "Người dùng muốn tiết kiệm điện…", "Mình cần suy nghĩ xem vật chịu những lực
    nào.", giả thiết "Mình hiểu ý bạn là vật trượt không ma sát." ("Mình hiểu ý bạn." một mình
    thì chỉ nói), "Cảm ơn lực ma sát, xe mới dừng được." ("Cảm ơn bạn…", "Cảm ơn câu hỏi…",
    "Cảm ơn sự kiên nhẫn của bạn." thì chỉ nói).
  - Suy nghĩ ẩn, nhận xét của người rà soát, nhãn lặp lại từ lời nhắc, dòng nguồn, dòng "---"
    không được nói, cũng không được viết. Dòng nguồn là dòng mà phần còn lại sau khi bỏ link
    **chỉ** trỏ tới hay gọi tên nguồn: chữ nguồn dùng như nhãn ("Nguồn: …", "Xem thêm: …",
    "Wikipedia: https://…"), chỉ có lời trỏ ("Xem thêm tại Wikipedia (https://…).", "Nguồn
    (https://…)", "Xem https://… để biết thêm"), tên trang và nguồn ("Lực hấp dẫn – Wikipedia"),
    đúng tên trang mà link dẫn tới ("Lực hấp dẫn (https://…/wiki/Lực_hấp_dẫn)"), một dòng chỉ là
    một link, hay danh sách sau "Tài liệu tham khảo:" / "Xem thêm:". Riêng mục của một danh sách
    mà dòng trước nó là nội dung bài học ("Các giai đoạn của nguyên phân:" + "- Kì đầu
    (https://…/Kì_đầu)", "Các lực cơ học:" + "* [Lực hấp dẫn](…)", "Cho:" + …) thì tên trang
    chính là khái niệm của bài: mục được giữ, chỉ mất link. Mọi dòng khác kèm link chỉ mất cái link:
    chữ, công thức và số vẫn được nói và viết. Kể cả câu chỉ **bắt đầu** bằng chữ giống chữ nguồn
    ("Nguồn điện tạo ra hiệu điện thế…", "Liên kết ion hình thành…", "Xem xét các lực…", "See how
    …", "Sources of energy …"), câu ngắn không có dấu chấm ("Electron mang điện tích âm
    (https://…)"), tên ngắn không phải tên trang ("Luật vạn vật hấp dẫn (https://…)"), dòng có
    công thức hay số đo ("g = 9,81 m/s² (https://…).") và câu có năm ("Năm 1687, Newton công
    bố…"). Link trong ngoặc mất cùng những chữ **chỉ** nói nguồn ("(theo Wikipedia: https://…)",
    "(nguồn: https://…)", "(theo Halliday, 2011 https://…)" → không còn "(theo Wikipedia:)");
    chữ khác trong ngoặc ở lại ("(theo phương ngang https://…)" → "(theo phương ngang)"), số
    không phải năm, trang hay số thứ tự trích dẫn cũng ở lại ("(see 6,67 https://…)"); ngoặc chỉ
    chứa link markdown tới nguồn cũng mất hẳn ("(xem [Wikipedia](…))", "(theo [Wikipedia](…))" →
    không còn "(xem)"). Chữ trỏ nguồn đứng ngay trước địa chỉ mất cùng địa chỉ: "Theo https://…,
    lực là đại lượng vectơ." → "lực là đại lượng vectơ." (không bao giờ "Theo lực là…"), "…, xem
    https://…." → "….". Link chỉ là một con số mất cùng số đó **chỉ** khi nó đứng ở chỗ của chú
    thích (dính ngay sau chữ, số hay dấu chấm câu: "lục lạp[1](…)"; cuối câu hay trước dấu phẩy:
    "lục lạp [1](…)."); cạnh phép tính hay trước chữ khác thì đó là số của bài và được giữ ("v =
    [2](…) m/s" → "v = 2 m/s", "Có [3](…) định luật Newton." → "Có 3 định luật Newton."). Trong
    lời TeachScript, link không bao giờ làm mất một câu bài học (câu được nói không có link);
    câu chỉ để dẫn nguồn ("Nguồn: https://….", "Xem thêm tại https://…", "(https://…).",
    "Nguồn: Wikipedia (https://…).") thì không được nói, không để lại "Nguồn:" hay "." lơ lửng.
  - Một nhãn đứng một mình ("**Kết luận:**", "Phân tích:", "Cho:", "Ghi chú:") không được viết:
    thầy nói nhãn cùng dòng ngay sau, và ý nghĩa của nhãn đi theo dòng đó (kết luận → khung kết
    quả đúng một lần, không bao giờ có khung rỗng; dữ kiện, ghi chú → cột bên; câu hỏi kiểm tra
    cuối bài → ghi chú ngắn ở cột bên, cả khi nó mở đầu bằng "Vậy" hay "=>" như một kết luận:
    "Vậy nếu m tăng gấp đôi thì a thế nào?" không bao giờ được đóng khung như đáp số, và một dòng
    hỏi như "**Vậy, đúng hay sai?**" không bao giờ là kết quả). "Kiểm tra (lại):" là kiểm lại đáp số: phép tính sau nó
    được viết đủ. Chỉ câu hỏi kiểm tra cuối bài mới được rút gọn còn câu hỏi, và câu nào có số
    vẫn được giữ; câu hỏi nằm trong đề bài ("… 72 km/h … Tính quãng đường?") được viết đủ; câu hỏi
    thầy tự trả lời ngay ("Vì sao vật rơi nhanh dần? Vì trọng lực…") là một bước, viết đủ.
  - Mỗi loại có giới hạn độ dài: câu chỉ có chữ thì viết ý chính (đọc đủ cả câu); câu có số
    hoặc công thức viết bằng chữ ("a = F/m", "HCl + NaOH → NaCl + H₂O", "p = mv") thì tách ở dấu
    phẩy thành tối đa 3 dòng hoặc giữ nguyên, không bao giờ cắt giữa hay cắt mất một con số, một
    công thức.
    Đoạn dài chỉ được nói, và mọi phương trình trong đó (cả `$…$`, `\(…\)` lẫn dạng chữ như
    `a = F/m = 10/2 = 5 m/s²`, tối đa 4) được viết lên bảng: viết đủ cả phương trình hoặc không
    viết, không bao giờ một mẩu dừng sau dấu phép tính hay ngoặc chưa đóng ("T = R *").
  - Dấu gạch chân, khung, mũi tên chỉ vào chữ đã bị bỏ thì cũng bị bỏ; lời thầy nói được tính
    lại theo những gì còn trên bảng. Dòng dài bị tách: khung ở mẩu cuối, gạch chân cả dòng thì
    gạch mọi mẩu, sửa sai thì gạch bỏ mọi mẩu rồi viết lời sửa sau mẩu cuối. Cùng một dòng viết
    lặp ngay ở câu sau, hoặc viết liền hai lần trong một câu không có lời nào ở giữa (lỗi của AI),
    chỉ viết một lần nhưng vẫn được đọc; "Vật A có a = 2 m/s² và vật B cũng có a = 2 m/s²" (có lời
    ở giữa) viết cả hai và đọc đủ. Cùng kết quả ở câu b, ở bài khác, ở "Trường hợp 2", "Cách 2",
    "Vật B", "TH2", "Lần 2", "Lần thứ hai", "Thí nghiệm 2", "Ở thí nghiệm thứ ba", "Giai đoạn 2"
    hay ở mặt bảng khác thì vẫn được viết lại; dòng đã bị xóa, hoặc đã được sửa sang chữ khác
    (`<correct>`), rồi viết lại đúng chữ cũ thì được viết. Chữ hoa và chữ thường khác nhau ("F = 0"
    và "f = 0", "T" và "t", "V" và "v" là ký hiệu khác nhau), "Vật rơi" và "Vật rời" là hai dòng
    khác nhau. Không con số nào bị đổi, làm tròn hay thêm vào (có kiểm thử tính chất). Phép so
    sánh "v<s và t>0", "<v>" và giá trị trung bình "<p> = 0", "<b> = 2 cm" không bao giờ bị xóa
    như thẻ HTML, trừ khi chính thẻ đó được đóng trong cùng đoạn ("Trung bình <b>= 2 cm</b>"): một
    cặp "<b>Lưu ý:</b>" ở đoạn sau là cặp khác, không đóng giá trị trung bình; thẻ lạ có thẻ đóng
    ("<note>…</note>", "<step>…</step>") thì bỏ thẻ, giữ chữ; "10<sup>23</sup>" thành lũy thừa
    10²³ (giọng đọc "mười mũ hai mươi ba", không phải "một nghìn không trăm hai mươi ba");
    "1,6.10<sup>-19</sup>" (dấu chấm là dấu nhân) giữ nguyên cả số 1,6 × 10⁻¹⁹ (đọc "một phẩy sáu
    nhân mười mũ trừ mười chín", không bao giờ tách "1," khỏi "6.10"), và
    "(1,6 ± 0,1).10<sup>-19</sup>" vẫn là lũy thừa của 10 (số mũ được kiểm nguồn gốc); chỉ số
    trích dẫn "1687<sup>[1]</sup>"
    không phải lũy thừa; số mũ nhiều ký tự giữ nguyên nhóm trên bảng và phụ đề ("x<sup>n+1</sup>"
    là x^(n+1), không bao giờ x^n + 1); `<sup>`/`<sub>` bên trong công thức thành `^{…}`/`_{…}`
    của TeX nên công thức vẫn hiện đúng; chỗ trống "F = ____ N" được giữ.
  - Trình đọc TeachScript: thẻ `<write>` sai mã được sửa mã (không mất chữ), thẻ chưa đóng kết
    thúc ở cuối câu, "$x<y$ và $y>z$" là chữ chứ không phải thẻ, thẻ bị cắt ở cuối câu trả lời
    không bao giờ được đọc lên (chỉ khi cả đoạn cuối đúng là một thẻ đang viết dở: "Khi v<c thì
    … 6 kg·m/s." vẫn được đọc và viết đủ).
  - "Viết tiếp": đọc lại toàn bộ câu trả lời và tiếp tục từ chỗ bài đã giảng tới, bỏ qua phần
    đã giảng **theo vị trí** trong câu trả lời (không đếm câu). Câu bị cắt được nói lại đủ; bài bị
    dừng giữa chừng được giảng tiếp từ chỗ dừng. Những gì câu cuối đã đặt lên bảng được so với câu
    trả lời đầy đủ: giống hệt thì giữ, khác (mẩu cụt, dòng bị cắt trong `**`, dòng dài ra quá giới
    hạn, mẩu thành nhãn, câu hỏi cuối bài nay là một bước, mặt bảng có tiêu đề bị cắt) thì xóa
    cùng dấu đánh dấu của nó rồi viết bản đầy đủ (tiêu đề bị cắt được gỡ hẳn khỏi bảng để tiêu
    đề đầy đủ vẫn nằm ở chỗ tiêu đề). Chữ đến sau có thể đổi cách đọc dòng trước: một thẻ trần
    "<step>", "<note>" chỉ là thẻ khi thẻ đóng của nó đã đến. Vì vậy phần đã giảng được so với câu
    trả lời đầy đủ từ chỗ **đầu tiên** đọc khác đi, không chỉ từ câu cuối (không câu nào bị nói
    lại, chỉ phần bảng khác được xóa và viết lại). Việc so sánh đi **theo thứ tự**: một khi có
    dòng phải viết lại, mọi dòng sau nó cũng được xóa và viết lại bên dưới, nên "<step>Bước 1: …"
    viết lại không bao giờ nằm dưới "Bước 2" (bảng có thể có khoảng trống ở chỗ dòng bị xóa). Bảng
    cuối cùng có cùng các dòng, cùng thứ tự từ trên xuống, cùng dấu đánh dấu như giảng cả câu trả
    lời một lần (kiểm thử `lessonContinue.test.ts`, gồm bảng cắt câu trả lời ở **mọi ký tự** cho
    câu trả lời markdown, TeachScript và câu trả lời thật của bộ đánh giá). Khi câu trả lời đã
    sang mặt bảng thứ hai (hay thứ ba) mà mọi dòng trên các mặt đó phải viết lại, các mặt ấy được
    gỡ đi từ mặt cuối trở về, rồi câu trả lời đầy đủ mở lại chúng theo đúng thứ tự; dòng viết lại
    trên đó lấy lại mã cũ nhưng không bao giờ bị ẩn như một mẩu đã xóa (dấu "đã xóa", tiến độ
    viết và kiểm số của phần tử đã rời bảng đi cùng nó).
- **Dùng hết bảng (mục 3, `layout.ts`, `formulaSplit.ts`):** trước khi giảng (bài mới, "Giảng
  lại", phần mới của "Viết tiếp"), mỗi mặt bảng được chia theo những gì sẽ viết lên nó, đọc từ các
  hành động **còn phải giảng** (mặt đã có chữ giữ nguyên cách chia, nên không gì bị dời):
  - chỉ có bước giải, công thức (câu trả lời thường của Gemma): một vùng rộng 40–1160 trên bảng
    1200 đơn vị (trước đây là cột giữa 480, chỉ 40% bề ngang);
  - có tóm tắt đề, ghi chú, sửa sai: cột trái 300 + vùng chính 780;
  - có hình, bảng số, đồ thị: vùng chính 680 + cột phải 400;
  - có cả hai: 3 cột như cũ (260 / 480 / 300).
  - Thứ mặt bảng chưa tính trước (ví dụ ghi chú của "Viết tiếp" trên mặt chỉ có bước giải) được
    viết thành một **dải ngang hết bề rộng** bên dưới mọi thứ đã có; các vùng viết tiếp bên dưới
    dải đó, không bao giờ chồng chữ.
  - Hộp của mỗi phần tử là đúng bề rộng nét chữ (không còn cắt hộp cho vừa cột trong khi chữ tràn
    sang cột bên). Công thức quá rộng: thu nhỏ tối đa còn 60%; vẫn quá rộng thì xuống dải ngang;
    chỉ khi cả bề ngang bảng cũng không đủ mới viết nhỏ hơn nữa (rất hiếm, có cờ `squeezed`).
  - Chuỗi bằng nhau dài (`a = F/m = 10/2 = 5 m/s²`) được viết thành nhiều dòng, mỗi dòng bắt đầu
    bằng dấu `=` và thụt vào một chút, như thầy viết bảng. Chỉ tách ở dấu quan hệ ngoài cùng
    (không tách trong ngoặc, `\text{…}`, `\left…\right`, môi trường `aligned`…); công thức
    không cân ngoặc thì không tách. Các mẩu ghép lại đúng nguyên văn công thức, và việc kiểm nguồn gốc
    số vẫn đọc nguyên công thức (không con số nào bị đổi). Mỗi mẩu là một bước của bút.
  - Dấu quan hệ bị phủ định (`\not=` là "≠", `\not\equiv`) được tách **trước** `\not`, không bao
    giờ giữa `\not` và dấu nó phủ định (nếu không, dòng sau sẽ hiện "=" thay cho "≠").
  - Một danh sách nhiều mệnh đề (`v_0 = 0,\quad a = 2 m/s²,\quad t = 3 s`) được tách **sau** dấu
    ngăn cách (dấu `,` hoặc `;` ngoài ngoặc, `\quad`, `\qquad`, chữ nối như `\text{ và }`; một từ
    nối viết dạng chữ — và, hoặc, nên, thì, khi, với, suy ra, do đó, and, or, so, where — ở bất kỳ
    chỗ nào, cả ngay sau một số hay số mũ của đơn vị: `a = 2\ \text{m/s}^2\ \text{và}\ t = 3`) và
    khoảng trắng sau nó: mỗi dòng bắt đầu bằng tên đại lượng, không bao giờ "tên" ở một dòng còn
    "= giá trị" ở dòng sau. Dòng của mệnh đề mới không thụt vào (chỉ dòng nối tiếp chuỗi bằng nhau
    mới thụt). Dấu phẩy thập phân (`9,81`) không phải dấu ngăn cách; số mũ, chỉ số dưới không bị
    tách khỏi thứ đứng trước nó.
  - Bảng số quá rộng cho cột phải thì sang vùng giữa, rồi sang dải ngang, cuối cùng mới thu nhỏ
    (bảng được vẽ thu nhỏ đúng bằng hộp của nó).
  - **Đổi cỡ cửa sổ, phóng to:** bảng là tờ giấy 1200 đơn vị được co giãn theo khung nhìn; đổi cỡ
    chỉ đổi tỉ lệ, **không bao giờ dời chữ đã viết** (dấu gạch chân, nét của học sinh là tọa độ trên
    bảng). Phần bảng đang ở giữa khung nhìn vẫn ở giữa sau khi đổi cỡ (không nhảy về dòng cuối),
    kể cả khi chỉ chiều cao khung bảng đổi (cửa sổ cao hơn, phụ đề hay chú thích hiện ra) và khi
    chiều cao đổi dần qua nhiều khung hình (một khung bên trượt ra): vị trí bảng tự đặt được ghi
    đúng như đã tính, không theo số điểm ảnh trình duyệt làm tròn, nên hàng ở giữa không trôi dần
    (kiểm thử E2E: lệch dưới 2 đơn vị bảng). Chỉ khi khung nhìn chạm mép bảng thì không giữ được.
    Khi thầy đang viết và học sinh đang theo thì dòng đang viết vẫn trong tầm nhìn. Thanh cuộn luôn
    giữ chỗ (`scrollbar-gutter: stable`) để tỉ lệ không dao động.
  - Nút **Thu nhỏ / Phóng to** (100%, 125%, 150%, 200%, chỉ trong lần dùng này) và **Vừa khung**
    (hiện khi đang phóng to). Phóng to thì bảng cuộn ngang bên trong khung bảng (trang không cuộn
    ngang), bút của thầy được theo cả chiều ngang, bản đồ nhỏ hiện đúng phần đang xem. Không dùng
    Ctrl+lăn chuột hay Ctrl+= (Ctrl+= là cỡ chữ của cả app).
  - Camera khi phóng to lia **cả hai chiều trong một lần cuộn** (trong Chromium/WebView2, đặt riêng
    một chiều sẽ dừng lần cuộn mượt của chiều kia; trước đây vì thế khung nhìn không theo thầy xuống
    dưới). Camera quyết định theo chỗ nó **đang lia tới**, không theo chỗ khung nhìn mới đi được nửa
    đường, nên không lia lại sau mỗi chữ. Học sinh tự cuộn (lăn chuột, chạm, phím cuộn, thanh cuộn,
    bản đồ nhỏ) thì camera để yên chiều ngang cho học sinh đến khi thầy bắt đầu dòng mới (dòng tiếp
    theo của cùng một phần tử cũng là dòng mới). Lăn chuột hay bấm phím mà khung nhìn không nhúc
    nhích (đã ở mép bảng) thì không tính là tự cuộn: camera vẫn theo như trước; một lượt lăn liền
    nhau (các lần cách nhau dưới 250 ms) được tính chung, nên lăn về mép rồi lăn thêm vẫn là tự
    cuộn. Phím không cuộn (chữ cái…) không tính.
- **Chữ viết tay:** phông Patrick Hand (nội dung) và Pangolin (tiêu đề), giấy phép OFL, có bộ chữ
  tiếng Việt, đóng gói sẵn trong app (không tải từ mạng). Mỗi chữ cái lệch nhẹ (xoay ±2°, lệch dòng,
  co giãn ±3%) theo seed cố định; dòng dài hơi trôi xuống như viết tay.
- **Hoạt ảnh viết:** hiện từng ký tự theo nhịp không đều (dừng ngắn giữa các từ), đầu bút đi theo; công
  thức KaTeX hiện dần từ trái sang phải. "Viết nhanh" viết ngay phần còn lại.
- **Đánh dấu:** gạch chân (đúng cụm chữ nếu có `span`), khoanh (elip hơi hở, có chỗ vẽ trùm), khung
  (bốn nét lố góc), bút dạ quang, gạch bỏ khi sửa, mũi tên cong có nhãn. Mỗi nét tự vẽ ra (600 ms).
- **Hình:** đồ thị hàm số (code tự lấy mẫu biểu thức, bộ đọc biểu thức an toàn không dùng `eval`), trục
  tọa độ, sơ đồ lực (hướng theo tên lực: P xuống, N lên, F sang phải, Fms sang trái), véc-tơ, sơ đồ quá
  trình, bảng số.
- **Nguồn gốc con số:** số có trong câu hỏi (hoặc g = 9,8/9,81/10, số nguyên nhỏ) là "cho sẵn"; phép
  tính viết trên bảng ("a = 10/2 = 5") được máy tính lại, đúng thì đánh dấu ✓ "Phép tính đã được máy
  kiểm lại"; số không rõ nguồn được gắn ⚠ "Có số do AI tự tính, chưa kiểm chứng".
- **Đồng bộ lời – bút:** câu nào nói thì phần bảng của câu đó được viết cùng lúc; câu sau chờ cả hai
  xong (giọng không chạy trước bút). Không bật giọng thì có thời gian đọc phụ đề.
- **Camera và mặt bảng:** bảng dài xuống dưới, khung nhìn tự lia theo bút; `<newboard>` mở mặt mới, có
  thẻ "Bảng 1, Bảng 2…" để xem lại. Thẻ của mặt thầy đang viết có biểu tượng cây bút. Khung nhìn chỉ
  lia khi bài đang giảng, học sinh đang theo thầy và không đang tự viết bằng "Bút của em".
- **Bút và bài giảng thuộc về một mặt bảng, một lượt giảng** (`lesson.ts`): mỗi lượt giảng (bài mới,
  "Giảng lại", phần "Viết tiếp") có số lượt riêng; mọi thay đổi trên bảng đi qua một bước kiểm tra
  "lượt này còn là lượt hiện tại", nên một lượt đã dừng không bao giờ viết đè lên bài mới. Đầu bút
  mang theo mặt bảng và số lượt, chỉ hiện trên đúng mặt đó.
  - Học sinh mở mặt khác khi thầy đang viết: bài **tạm dừng** (giọng ngừng, câu bị cắt sẽ đọc lại),
    đầu bút không hiện ở mặt kia, chữ đã viết giữ nguyên. Quay lại mặt của thầy thì thấy bút đúng chỗ
    cũ, vẫn đang dừng (không tự giảng tiếp: không bật tiếng bất ngờ, không tốn thêm lượt giọng đọc
    trực tuyến). "Tiếp tục" (bấm ở mặt nào cũng được) đưa khung nhìn về mặt thầy đang viết rồi giảng
    tiếp. Khi đang dừng hoặc đã giảng xong, bấm thẻ chỉ đổi mặt đang xem.
  - Thầy đánh dấu (gạch chân, khoanh…) một chữ ở mặt cũ: thầy "đi" sang mặt đó rồi quay lại; khung
    nhìn đi theo nếu học sinh đang theo thầy.
  - Chuyển sang "Trò chuyện": bài tạm dừng; quay lại "Giảng trên bảng" thấy bảng như cũ và nút "Tiếp
    tục". Rời màn hình AI Teacher (Quay lại, Esc, mở bài học, về trang chủ): bài dừng hẳn, kể cả bài
    đang tạm dừng lúc bảng bị ẩn.
  - Có câu trả lời mới: lượt cũ dừng ngay (không viết tiếp dưới dòng "Đang chuẩn bị bảng…"); bài mới
    bắt đầu ở mặt 1. Trong lúc bảng chuẩn bị câu trả lời mới, nút "Giảng lại" bị tắt và lệnh giảng
    lại không làm gì (nếu không, bảng sẽ giảng lại câu trả lời **cũ** dưới tên câu trả lời mới).
    Học sinh gửi câu hỏi mới khi thầy đang giảng: bài tạm dừng ngay khi AI bắt đầu
    trả lời (thầy dừng lại nghe), câu bị cắt đọc lại khi bấm "Tiếp tục". Xóa cuộc trò chuyện: bài
    dừng và bảng trống.
  - Một lượt bị dừng đúng lúc phụ đề của câu đổi (một nơi đang nghe bảng dừng nó) thì câu đó không
    được đọc, không được tính giờ: lượt kiểm tra lại ngay sau khi đổi phụ đề. Trong React
    StrictMode (bản dev, mỗi hiệu ứng chạy hai lần) một câu trả lời vẫn được giảng đúng một lần, và
    bảng quay lại từ "Trò chuyện" vẫn đang dừng đến khi bấm "Tiếp tục" (có kiểm thử).
  - Ai đọc to câu trả lời được quyết định lúc câu trả lời đến: ở "Giảng trên bảng" bảng tự đọc theo
    từng câu, ở "Trò chuyện" khung chat đọc (đổi bố cục trong lúc AI đang trả lời không làm câu trả
    lời bị đọc hai lần hay không ai đọc).
  - "Viết tiếp": mỗi lượt giữ bảng đối chiếu mã phần tử của AI → mã thật trên bảng, nên dấu gạch
    chân, khung… của phần mới nằm đúng ở phần mới (không rơi vào phần tử cũ trùng mã như `r1`).
- **Bút của học sinh:** bật "Bút của em" để viết/vẽ bằng chuột hoặc cảm ứng (màu tím), xóa nét của
  mình. Nét chỉ ở trên máy, không gửi đi. Nét thuộc về mặt bảng nơi bắt đầu viết: nếu mặt bảng đổi
  giữa chừng, nét kết thúc và được giữ ở mặt cũ. Thao tác bị hủy (chạm chuyển thành cuộn…) cũng kết
  thúc nét; di chuột mà không nhấn không vẽ thêm.
- **Khoanh để hỏi (mục 2, `selection.ts`, `SelectionBar.tsx`):** nút riêng trên thanh công cụ (biểu
  tượng LassoSelect, không bật cùng lúc với "Bút của em"). Học sinh khoanh, gạch chân hoặc chạm vào
  chỗ trên bảng rồi hỏi thầy về đúng chỗ đó.
  - **Bài giảng dừng lại nghe:** vừa đặt bút khoanh là bài tạm dừng bằng đúng đường tạm dừng của
    nút "Tạm dừng" (`pauseForAsk` → `pauseLesson`), câu đang nói bị cắt sẽ được đọc lại. Bài đã đang
    dừng (xem mặt khác, chuyển "Trò chuyện") cũng được đánh dấu là dừng để hỏi. Nút tiếp tục khi đó
    ghi **"Quay lại bài giảng"**: bấm thì giọng trả lời trong khung chat ngừng trước, bỏ chỗ đã
    khoanh, tắt công cụ khoanh và giảng tiếp từ chỗ dừng. "Bỏ chọn" không tự giảng tiếp.
  - **Đọc chỗ khoanh bằng code (không AI):** nét khoanh (đơn vị bảng, tính cả tỉ lệ, phóng to và
    cuộn) thành một vùng: vòng kín, nét hở (gạch chân: chọn cả dòng chữ ngay trên nét) hoặc chạm.
    Vùng được so với từng chữ, từng mảnh công thức và từng hình **đã viết** trên mặt bảng đó (chưa
    viết, đã xóa, ở mặt khác thì không tính; phần tử đang viết dở chỉ tính phần đã hiện). Một chữ
    được chọn khi ≥ 50 % hộp của nó nằm trong vùng, một hình khi ≥ 35 % (hoặc ≥ 60 % vùng nằm trong
    hình); chọn ≥ 80 % một dòng thì lấy cả dòng (nguyên văn nguồn, công thức là LaTeX đầy đủ). Công
    thức dài bị cắt thành nhiều mảnh thì chọn theo cả mảnh và gửi đúng LaTeX của mảnh đó. Thứ tự đọc:
    tiêu đề → cột trái → giữa → phải, dải ngang toàn bảng đứng sau những gì nằm trên nó; hướng vẽ nét
    không ảnh hưởng. Các ngưỡng là hằng số có kiểm thử (`TOKEN_HIT`, `FIGURE_HIT`, `WHOLE_ELEMENT`…).
  - **Thanh "Chỗ em khoanh trên bảng"** (nằm đè lên bảng, trong khung bảng): "Em khoanh: «…»" và
    nút chính **"Hỏi thầy chỗ này"**, cùng "Khoanh lại", "Bỏ chọn". Không trúng gì: app tự nói "Mình
    chưa thấy em khoanh vào chữ hay hình nào trên bảng…" (không hỏi AI). Khoanh quá nhiều (hơn 6 chỗ,
    hoặc hơn 60 % phần đã viết) hay chỉ chạm một phần: học sinh chọn "Cả phần này" (luôn đứng đầu)
    hoặc một chỗ; hàng lựa chọn cao tối đa hai dòng, nhiều hơn thì cuộn trong chính hàng đó. Khung
    chat có thẻ "Hỏi về: «…»" (bỏ được) nên câu gõ tay và các nút gợi ý cũng mang theo chỗ đã khoanh.
  - **Thanh không làm bảng đổi cỡ** (`askBarSide`): thanh nằm đè lên bảng ở phía xa chỗ vừa khoanh
    (chỗ khoanh ở nửa dưới khung nhìn → thanh ở trên, chừa chỗ cho bản đồ nhỏ; ngược lại → ở dưới),
    nên khung bảng không co lại, không có gì trên bảng bị cuộn đi và chỗ khoanh vẫn nhìn thấy. Thanh
    không bao giờ che dòng phụ đề hay nhãn "Nội dung do AI hỗ trợ" bên dưới bảng. Bảng hẹp (1366×768
    có khung chat bên cạnh, truy vấn `@container board`): các nút "Viết nhanh", "Vừa khung", "Khoanh
    để hỏi" và "Bút của em" chỉ hiện biểu tượng (tên vẫn có cho trình đọc màn hình, chú thích khi rê
    chuột), nên thanh công cụ luôn một hàng.
  - **Câu trả lời là câu "ngoài lề"** (`mode: 'aside'`): hiện trong khung chat, có nhãn AI và nút báo
    cáo, được đọc to trong khung chat; **không bao giờ được giảng lên bảng** — bảng giữ nguyên bài
    đang dừng (`latestLesson` bỏ qua câu trả lời ngoài lề và câu hỏi về bảng). "Viết tiếp" vẫn gắn với
    câu trả lời của bài giảng. Không có gì trên bảng bị thay đổi: bố cục, dấu, phần đã viết, nét của
    học sinh giữ nguyên.
  - **Gửi đi những gì:** chữ do bài giảng viết ở chỗ khoanh (nguyên văn, công thức là LaTeX, hình
    vẽ đọc từ chính nhãn của nó — không bao giờ là số máy tự tính), tiêu đề mặt bảng và tối đa vài
    dòng ngay trước/sau, trong một khối có rào `<board_selection>` (chữ trên bảng không thể đóng khối
    hay mở khối giả), dài tối đa 2000 ký tự (API), 600 (mô hình trên máy) hay 300 (Gemma trên card
    tích hợp). Chỗ em khoanh được ưu tiên: dòng trước/sau rồi tiêu đề bị bỏ trước; nếu chỗ khoanh vẫn
    không vừa thì không gửi tiêu đề, dòng bị cắt có "…" và khối ghi rõ "(… và N chỗ khác em khoanh,
    không đủ chỗ ghi ở đây)" — không bao giờ lặng lẽ bỏ bớt. Khối này qua kiểm tra an toàn như mọi
    thứ được gửi (lỗi riêng: "Phần chữ em khoanh trên bảng có thể chứa thông tin cá nhân…"); nó
    không nằm trong câu hỏi, nên số mà bài giảng đã đánh dấu "chưa kiểm chứng" vẫn bị đánh dấu trong
    câu trả lời. Câu hỏi về chỗ khoanh luôn được coi là câu hỏi (không bị chấm như câu trả lời cho
    câu hỏi kiểm tra của thầy). Dòng "Câu hỏi … sẽ được gửi tới" trong khung chat ghi "kèm phần chữ
    em khoanh trên bảng"; với Think, bên rà soát cũng đọc phần chữ đó. Câu hỏi về chỗ khoanh **không
    bao giờ được tra Wikipedia** (kể cả khi em bật tra cứu): chữ trên bảng không gửi tới Wikipedia,
    và dòng "gửi tới" khi đó không ghi Wikipedia.
  - **Nét của học sinh không bao giờ được gửi đi dưới dạng chữ hay lên mạng.** Chỉ khi chỗ khoanh
    không có chữ nào (hình không có nhãn, hoặc chỉ là nét viết tay của em) app mới vẽ một ảnh PNG của
    vùng đó từ mô hình bảng (SVG thuần: nét của em và hình vẽ, không chụp KaTeX hay chữ) và chỉ gửi
    ảnh cho AI **trên máy này** đọc được ảnh: Gemma E2B mà em đã chọn, chạy trên card rời đã biết
    (không bao giờ trên card tích hợp, không tự đổi sang E2B), hoặc mô hình của chương trình trên máy
    mà lần kiểm tra trên máy thấy "Có" đọc ảnh. Không bao giờ gửi ảnh lên mạng. AI khác: thanh nói rõ
    "AI em đang dùng chưa đọc được hình vẽ hay nét viết tay" và đề nghị em gõ câu hỏi (không gọi AI).
    **Think không rà soát câu hỏi về ảnh:** bản nháp của AI trên máy là lời nó tả nét của em, nên gửi
    bản nháp cho bên rà soát trên mạng là đưa nét của em lên mạng dưới dạng chữ (và bên rà soát cũng
    không thấy ảnh để kiểm tra). Câu hỏi về ảnh chỉ được trả lời trên máy, kể cả khi Think đang bật
    (không cần khóa của bên rà soát), dưới câu trả lời ghi "Chưa rà soát: câu hỏi về hình em khoanh
    chỉ được trả lời trên máy này…", và dòng "gửi tới" không ghi bên rà soát. Câu hỏi về ảnh và câu
    trả lời của nó cũng **không đi theo các câu hỏi sau lên mạng** (`withoutPictureAsks`): lịch sử gửi
    cho API hay cho bên rà soát của Think bỏ cặp hỏi–đáp đó, và bản tóm tắt phần trò chuyện cũ không
    bao giờ chứa nó (chỉ AI trên máy, khi Think tắt, còn thấy nó trong lịch sử). Hệ quả: nếu em đổi
    sang API rồi bấm "Viết tiếp" hay "Giải thích lại" ngay sau câu trả lời về ảnh, API không thấy câu
    trả lời đó. Đường tạo ảnh (blob: → OffscreenCanvas → PNG) **chưa được kiểm tra trong bản desktop
    (WebView2)**; nếu không tạo được ảnh, em được báo và không có gì được gửi. Bấm "Hỏi thầy chỗ này"
    hai lần (hay Enter rồi bấm) khi ảnh đang được tạo chỉ gửi một câu hỏi.
- **Chế độ bảng với AI cloud:** lời nhắc TeachScript (`BOARD_SYSTEM` trong
  `src/teacher/chat/chatService.ts`): ví dụ mẫu, cấm tọa độ, yêu cầu viết rõ phép tính. Think giữ nguyên
  định dạng thẻ khi rà soát. Gemma (mô hình nhỏ) trả lời bình thường, bảng tự xếp.

## 5. Chưa làm (để lại cho các bước sau)

- Xuất bảng thành ảnh PNG/PDF. Ảnh vùng khoanh cho AI trên mạng (cần sửa Rust: tin nhắn có ảnh,
  tăng phiên bản native, xem lại pháp lý/quyền riêng tư) — chưa làm, ảnh chỉ đi tới AI trên máy.
- Khoanh để hỏi: chưa có cách làm bằng bàn phím (khoanh cần chuột hoặc cảm ứng; em vẫn gõ câu hỏi
  được). Chưa khoanh được một phần nhỏ bên trong một công thức (một số hạng của phân số): đơn vị
  nhỏ nhất là cả công thức hoặc cả mảnh công thức. Hộp chữ tính từ số đo bố cục, có thể lệch vài
  điểm ảnh so với chữ hiện trên màn hình; "Khoanh lại" và danh sách chọn là lưới an toàn. Mô phỏng
  3D (nguyên phân) và vật trong mô phỏng vật lý chưa khoanh được từ trang AI Teacher.
- Viết tay mức 2 (vẽ theo khung xương nét, dấu thanh viết sau chữ cái gốc).
- Khẩu hình theo âm, nhận dạng giọng nói, nút "Giơ tay", ngắt lời (T3, T5).
- Khi đang tạm dừng, khung nhìn không tự lia tới chỗ thầy dừng; "Tiếp tục" mới đưa khung nhìn về.
  Học sinh tự cuộn trên mặt bảng thầy đang viết thì khung nhìn vẫn theo bút (chưa có nút "về chỗ
  thầy đang viết").
- Chưa có công cụ tính toán tất định cho AI gọi (T4): hiện chỉ kiểm lại phép tính AI viết ra.

**Giới hạn đã biết** (chọn giữ lại, có lý do):

- "Vâng." hay "Dạ." đứng một mình (chỉ có dấu chấm) luôn là câu trả lời có/không và được viết lên
  bảng, kể cả khi AI chỉ dùng nó để mở đầu lễ phép ("Dạ. Mình sẽ giúp bạn…" để lại "Dạ." trên
  bảng). Bảng chỉ bỏ một dòng khi chắc chắn; một chữ thừa trên bảng ít hại hơn mất câu trả lời
  của học sinh. Dạng lễ phép rõ ràng ("Vâng ạ!", "Dạ vâng.", "Vâng!", "Dạ, …") thì chỉ nói.
- Câu cảm ơn mở đầu bằng "Cảm ơn" chỉ được coi là lời xã giao khi nó cảm ơn người ("bạn", "em",
  "câu hỏi", "vì…", "… của bạn"); "Cảm ơn sự quan tâm!" (không có ai) được viết lên bảng. Cùng lý
  do: "Cảm ơn lực ma sát, xe mới dừng được." là bài học.
- Học sinh chạm vào bảng (màn hình cảm ứng) thì camera để yên chiều ngang đến dòng mới, kể cả khi
  chỉ là một cú chạm không cuộn: cú kéo có thể bắt đầu muộn, nên bảng không đoán là "không cuộn".
- Một câu mở đầu bằng "Vật A/B…", "Cách 2", "Lần 2" được coi là phần mới: một dòng lặp do lỗi ngay
  sau nó vẫn được viết lại (thà viết hai lần còn hơn mất kết quả của phần mới). Một phần mới mở
  đầu bằng cách khác ("Còn bây giờ, khi vật lên dốc…") thì chưa được nhận ra: kết quả lặp lại
  ngay câu sau chỉ được nói, không viết lần hai.
- Một dòng ngắn chỉ có tên kèm link mà tên không trùng tên trang ("Luật vạn vật hấp dẫn
  (https://…/Lực_hấp_dẫn)") được viết lên bảng như một ý của bài: bảng không phân biệt được nó
  với câu ngắn "Electron mang điện tích âm (https://…)", nên giữ cả hai (chỉ bỏ khi chắc chắn).
- Dòng mở đầu một danh sách đọc thêm mà không có chữ nguồn nào ("Bạn có thể học tiếp:") vẫn được
  viết, dù các mục link của nó bị bỏ; dòng có chữ nguồn ("Xem thêm:", "Bạn có thể đọc thêm:",
  "Tài liệu tham khảo:") thì danh sách sau nó là nguồn. Ngược lại, tên trang trong danh sách sau
  một dòng nội dung luôn được giữ, kể cả khi danh sách ấy thật ra là nguồn.
- Một link chỉ là con số đứng cuối câu sau chữ ("Có tất cả [3](…).") được coi là chú thích và
  mất cùng con số: đó đúng là chỗ của chú thích, và bảng không phân biệt được hai cách viết.
- Số mũ nhiều ký tự giữ nhóm trên bảng và phụ đề (x^(n+1)), nhưng giọng đọc vẫn nói "ích mũ nờ
  cộng một" như với mọi số mũ `^{…}` (cả "$2^{n+1}$"): cách đọc số mũ thuộc phần giọng nói
  (`src/teacher/voice/`), ngoài phạm vi bước này.
- "Viết tiếp" có thể để lại khoảng trống ở chỗ dòng bị xóa rồi viết lại (thứ tự và nội dung vẫn
  đúng như giảng một lần).

## 6. Nguồn

- Kỹ năng trình bày bảng: luatduonggia.vn (Kỹ năng trình bày bảng lớp của giáo viên Tiểu học),
  luatminhkhue.vn (mẹo cho giáo viên khi đứng lớp), vjol.vista.gov.vn (Rèn luyện kỹ năng trình bày bảng
  cho sinh viên ngành Giáo dục tiểu học), nvsp.hnue.edu.vn.
- Bảng trắng và học đa phương tiện: uis.edu (lightboard videos: segmenting, pre-training),
  Computers and Education Open 2021 (signaling và concept map, doaj.org), theteflacademy.com
  (whiteboard technique: chia vùng, màu cố định).
- Sản phẩm: f4.fund/startups/dudely, devpost.com/software/scribe-ai-4569xd, taiwannews.com.tw (Gauth),
  thinkverse.co, arxiv.org/abs/2512.01234 (DrawDash).
