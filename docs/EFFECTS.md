# Hiệu ứng của app (theo trò chơi SimLab 3D)

**Yêu cầu:** người dùng ngày 19/11/2026: "Thêm các hiệu ứng vào app nữa giống phần game ấy". Người
dùng chọn ba nhóm: màn mở đầu, chuyển cảnh khi vào, nền động và hiện dần. Không làm âm thanh giao
diện. Không làm vệt sáng theo chuột, vì nó che hình khi người học kéo vật trong bài.

Các hiệu ứng lấy ý từ trò chơi (`game/src/platform/ui/AppIntro.ts`, `EnterTransition.ts`, nền menu
trong `styles.css`). Mã thì viết lại cho app, không chép từ trò chơi. Màu lấy từ `tokens.css`, biểu
tượng là Lucide.

## Ba nhóm hiệu ứng

| Hiệu ứng           | Tệp                                                    | Nội dung                                                                                                                                                                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Màn mở đầu         | `src/app/fx/Intro.tsx`, `fx.css`                       | Chạy mỗi lần mở app, khoảng 2,5 giây. Ô logo hiện ra, quỹ đạo vừa xoay vào chỗ vừa được vẽ, một viên bi bay theo đường ném, chất điểm hiện ra. Sau đó chữ "SimLab" hiện từng chữ, có vệt sáng quét qua, rồi mờ vào trang mở đầu. Bấm chuột hoặc gõ phím thì bỏ qua. Nếu có hộp thoại lúc mở (màn làm quen, cập nhật) thì màn mở đầu dừng lại, nhường cho hộp thoại. |
| Chuyển cảnh        | `fx.ts` (`screenChange`), `ScreenPortal.tsx`, `fx.css` | Dùng View Transitions có sẵn trong Chromium/WebView2. Màn cũ lùi lại và tối đi. Màn mới mở thành vòng tròn từ chỗ vừa bấm (nếu không có cú bấm gần đó thì từ nút đang chọn, không có nữa thì từ giữa màn hình). Vòng quỹ đạo của logo bay ra theo vòng tròn. Tổng cộng khoảng 0,56 giây.                                                                            |
| Nền động, hiện dần | `LandingScreen.tsx`, `fx.css`                          | Trên trang mở đầu, bảy biểu tượng môn học và một con lắc trôi chậm (chỉ để trang trí, không phải mô hình). Chữ và thẻ của trang mở đầu, trang "Hôm nay học gì?", các nhóm cài đặt và thông báo đều hiện dần. Biểu tượng trên nút nảy nhẹ khi bấm.                                                                                                                   |

## Quy tắc

- **Không đổi số nào, không chạy trong hình của bài học.** Hiệu ứng chỉ nằm ở trang mở đầu, lúc đổi
  màn hình và trên các thành phần giao diện. Canvas và cảnh 3D giữ nguyên.
- **`data-fx` trên `<html>`** (do `useApplyTheme` đặt) có giá trị `off` trong ba trường hợp:
  - khi chạy unit test (`MODE === 'test'`);
  - trong trình duyệt tự động (`navigator.webdriver`), trừ khi URL có `?fx=1`;
  - khi chất lượng hiển thị đang ở mức **Thấp**, kể cả lúc app tạm hạ chất lượng vì máy chậm.

  Đây là cùng quy tắc với màn mở đầu của trò chơi. Nhờ vậy các E2E khác chạy như cũ, và axe không
  đọc phải chữ đang mờ dở.

- **Giảm chuyển động** (`data-motion='reduce'`, Cài đặt → Giao diện): không còn gì di chuyển. Màn
  mở đầu chỉ là hình đứng yên 0,7 giây rồi mờ đi. Chuyển cảnh chỉ mờ dần 0,16 giây, không có vòng.
  Nền đứng yên, các phần hiện ngay.
- **`screenChange(update)`:** khi hiệu ứng đang bật, `update` chạy chậm một khung hình, sau khi
  trình duyệt đã chụp lại màn cũ. Toàn bộ thay đổi chạy cùng lúc trong `flushSync`. Lời gọi lồng
  bên trong chạy ngay tại chỗ. Vì vậy, một hàm điều hướng phải làm xong mọi việc **bên trong**
  `update`. Ví dụ: `openTeacherOn('board')` và `openTeacherWithQuestion(q)` đặt trang và câu hỏi
  trong cùng một lần đổi màn. Không được gọi `openTeacher()` rồi mới đặt trang, vì trang đặt sau sẽ
  bị ghi đè.
- **Màn mở đầu và hiện dần:** trong lúc màn mở đầu chạy, `<html data-intro>` giữ cho phần hiện dần
  của trang mở đầu dừng lại. Khi màn mở đầu bắt đầu mờ đi thì phần hiện dần mới chạy.
- **Hiện dần dùng `animation-fill-mode: backwards`** để hiệu ứng nhấc thẻ khi rê chuột vẫn chạy
  sau khi phần hiện dần đã xong.

## Kiểm thử

- `src/app/fx/fx.test.tsx` kiểm các ý sau:
  - khi nào hiệu ứng chạy;
  - mỗi lần đổi màn chỉ có một transition, gọi lồng thì chạy tại chỗ;
  - giảm chuyển động thì không có vòng;
  - AI Teacher giữ đúng câu hỏi và trang khi mở;
  - tâm và bán kính của vòng tròn;
  - vòng tự gỡ.
- `src/app/fx/Intro.test.tsx` kiểm các ý sau:
  - màn mở đầu chỉ chạy một lần;
  - đúng thời gian;
  - bấm phím thì bỏ qua;
  - có hộp thoại thì nhường;
  - giảm chuyển động thì chỉ là hình đứng yên.
- `tests/e2e/fx.spec.ts` kiểm các ý sau:
  - không có `?fx=1` thì không có hiệu ứng;
  - có `?fx=1` thì có màn mở đầu, và đổi màn chỉ tạo một transition;
  - vòng tự gỡ;
  - axe đạt sau khi mọi hiệu ứng xong;
  - bấm phím thì bỏ qua màn mở đầu;
  - giảm chuyển động.
