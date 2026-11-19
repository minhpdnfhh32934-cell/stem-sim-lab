# Hiệu ứng của app (theo trò chơi SimLab 3D)

**Yêu cầu:** người dùng ngày 19/11/2026: "Thêm các hiệu ứng vào app nữa giống phần game ấy". Người
dùng chọn ba nhóm: màn mở đầu, chuyển cảnh khi vào, nền động và hiện dần. Không làm âm thanh giao
diện. Không làm vệt sáng theo chuột, vì nó che hình khi người học kéo vật trong bài.

**Bỏ chuyển cảnh (người dùng, cùng ngày 19/11/2026):** "Xóa hiệu ứng click này đi" — vòng tròn mở
màn mới từ chỗ bấm và vòng quỹ đạo bay ra đã bị gỡ (`screenChange`, `ScreenPortal`). Đổi màn hình
nay diễn ra ngay. Giữ nguyên màn mở đầu, nền động, hiện dần và biểu tượng nảy khi bấm.

Các hiệu ứng lấy ý từ trò chơi (`game/src/platform/ui/AppIntro.ts`, `EnterTransition.ts`, nền menu
trong `styles.css`). Mã thì viết lại cho app, không chép từ trò chơi. Màu lấy từ `tokens.css`, biểu
tượng là Lucide.

## Các hiệu ứng còn lại

| Hiệu ứng           | Tệp                              | Nội dung                                                                                                                                                                                                                                                                                                                                                            |
| ------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Màn mở đầu         | `src/app/fx/Intro.tsx`, `fx.css` | Chạy mỗi lần mở app, khoảng 2,5 giây. Ô logo hiện ra, quỹ đạo vừa xoay vào chỗ vừa được vẽ, một viên bi bay theo đường ném, chất điểm hiện ra. Sau đó chữ "SimLab" hiện từng chữ, có vệt sáng quét qua, rồi mờ vào trang mở đầu. Bấm chuột hoặc gõ phím thì bỏ qua. Nếu có hộp thoại lúc mở (màn làm quen, cập nhật) thì màn mở đầu dừng lại, nhường cho hộp thoại. |
| Nền động, hiện dần | `LandingScreen.tsx`, `fx.css`    | Trên trang mở đầu, bảy biểu tượng môn học và một con lắc trôi chậm (chỉ để trang trí, không phải mô hình). Chữ và thẻ của trang mở đầu, trang "Hôm nay học gì?", các nhóm cài đặt và thông báo đều hiện dần. Biểu tượng trên nút nảy nhẹ khi bấm.                                                                                                                   |

## Quy tắc

- **Không đổi số nào, không chạy trong hình của bài học.** Hiệu ứng chỉ nằm ở trang mở đầu và trên
  các thành phần giao diện. Canvas và cảnh 3D giữ nguyên.
- **`data-fx` trên `<html>`** (do `useApplyTheme` đặt) có giá trị `off` trong ba trường hợp:
  - khi chạy unit test (`MODE === 'test'`);
  - trong trình duyệt tự động (`navigator.webdriver`), trừ khi URL có `?fx=1`;
  - khi chất lượng hiển thị đang ở mức **Thấp**, kể cả lúc app tạm hạ chất lượng vì máy chậm.

  Đây là cùng quy tắc với màn mở đầu của trò chơi. Nhờ vậy các E2E khác chạy như cũ, và axe không
  đọc phải chữ đang mờ dở.

- **Giảm chuyển động** (`data-motion='reduce'`, Cài đặt → Giao diện): không còn gì di chuyển. Màn
  mở đầu chỉ là hình đứng yên 0,7 giây rồi mờ đi. Nền đứng yên, các phần hiện ngay.
- **Màn mở đầu và hiện dần:** trong lúc màn mở đầu chạy, `<html data-intro>` giữ cho phần hiện dần
  của trang mở đầu dừng lại. Khi màn mở đầu bắt đầu mờ đi thì phần hiện dần mới chạy.
- **Hiện dần dùng `animation-fill-mode: backwards`** để hiệu ứng nhấc thẻ khi rê chuột vẫn chạy
  sau khi phần hiện dần đã xong.

## Kiểm thử

- `src/app/fx/fx.test.tsx` kiểm các ý sau:
  - khi nào hiệu ứng chạy;
  - đổi màn diễn ra ngay, không có view transition; AI Teacher giữ đúng câu hỏi và trang khi mở.
- `src/app/fx/Intro.test.tsx` kiểm các ý sau:
  - màn mở đầu chỉ chạy một lần;
  - đúng thời gian;
  - bấm phím thì bỏ qua;
  - có hộp thoại thì nhường;
  - giảm chuyển động thì chỉ là hình đứng yên.
- `tests/e2e/fx.spec.ts` kiểm các ý sau:
  - không có `?fx=1` thì không có hiệu ứng;
  - có `?fx=1` thì có màn mở đầu, và đổi màn không tạo transition nào, không có vòng;
  - axe đạt sau khi mọi hiệu ứng xong;
  - bấm phím thì bỏ qua màn mở đầu;
  - giảm chuyển động.
