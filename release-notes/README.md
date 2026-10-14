# Ghi chú phát hành SimLab (release notes)

`versions.json` là **nguồn duy nhất** cho lịch sử phiên bản của SimLab. Mọi thứ khác được tạo từ nó:

| Tệp                              | Tạo bởi                                  | Dùng cho                                                         |
| -------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| `docs/VERSION_HISTORY.md`        | `npm run release-notes`                  | Lịch sử phiên bản đầy đủ (tiếng Việt, 8 mục I–VIII)              |
| `docs/CHANGELOG.md`              | `npm run release-notes`                  | Changelog kiểu Keep a Changelog, bản mới nhất ở trên             |
| `release-notes/google-docs.html` | `npm run release-notes`                  | Cùng nội dung với VERSION_HISTORY, HTML sạch để nhập Google Docs |
| Hộp "Có gì mới trong SimLab"     | app đọc bản `versions.json` đóng gói sẵn | Hiện sau khi cập nhật (không cần mạng)                           |
| Cài đặt → "Lịch sử phiên bản"    | app, cùng dữ liệu                        | Danh sách mọi phiên bản, có nhãn trạng thái                      |

**Không sửa tay** ba tệp được tạo: sửa `versions.json` rồi chạy `npm run release-notes`.
`tests/release-notes.test.ts` báo lỗi nếu các tệp đó cũ hơn `versions.json`, nếu thiếu bằng chứng
hoặc nếu dữ liệu sai cấu trúc. Cấu trúc được kiểm bằng schema zod trong
`src/app/whatsnew/releaseNotes.ts` (kiểu TypeScript lấy từ chính schema đó).

Để nhập vào Google Docs: mở `google-docs.html` trong trình duyệt, chọn tất cả, dán vào một Google Doc
mới tên **"SimLab — Version History & Release Notes"** (hoặc tải tệp HTML lên Google Drive rồi
"Mở bằng Google Tài liệu").

## Nguyên tắc

- **Không bịa.** Ngày nào không có bằng chứng thì để `null` (hiển thị "Chưa xác minh được"). Mỗi
  phiên bản có `evidence`: lệnh/tài liệu/commit cho biết dữ kiện đến từ đâu.
- **Không gọi là "đã phát hành"** nếu chưa có GitHub Release thật (`status: "released"` cần
  `refs.tag`, `refs.releaseUrl`, `dates.released` và một dòng bằng chứng có `published_at`).
- **Ghi chú công khai** (`publicNotes`, `learnerHighlights`) viết tiếng Việt đơn giản cho người học,
  bản tiếng Anh dịch trung thành; không dùng từ như JSON, engine, token, LLM.
- **Bảo mật:** chỉ ghi chung chung (đã tăng cường gì), không mô tả cách khai thác một lỗi chưa sửa.
- **Không có bí mật, dữ liệu người học hay đường dẫn cá nhân** (test quét khóa API, e-mail, `C:\…`).

## Cấu trúc `versions.json`

Gốc: `schemaVersion` (1), `product`, `repository`, `evidenceCheckedAt` (ngày kiểm bằng chứng gần
nhất), `overview` (đoạn mở đầu), `milestones` (`date`, `text`, `evidence`), `openQuestions` (điểm
chưa xác minh được) và `versions` (mới nhất ở trên, mỗi phiên bản đúng một lần).

Mỗi phần tử của `versions`:

| Trường              | Ý nghĩa                                                                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`           | `x.y.z` (số phiên bản phần web, như `package.json`)                                                                                                                                                      |
| `status`            | `released` (có GitHub Release) · `merged-not-released` (đã gộp, không có bản phát hành riêng) · `in-review` (PR đang mở) · `development` (bản dựng thử) · `unverified` (chỉ là nhãn/ZIP, chưa kiểm được) |
| `statusNote`        | Giải thích trạng thái (bắt buộc khi chưa phát hành), hoặc `null`                                                                                                                                         |
| `channel`           | `github` (bộ cài + cập nhật trong app qua GitHub Releases) · `github-web` (chỉ phần web) · `store` (Microsoft Store) · `zip` (tệp ZIP gửi tay) · `none`                                                  |
| `dates`             | `devStart`, `firstCommit`, `lastCommit`, `merged`, `built`, `released`, `tagged`: ISO 8601 (ngày `2026-10-09` hoặc giờ có múi `…Z` / `…+07:00`) hoặc `null`                                              |
| `evidence`          | Danh sách chuỗi ngắn: bằng chứng cho từng dữ kiện                                                                                                                                                        |
| `tests`             | Kết quả kiểm thử đã ghi cho bản này, kèm nguồn                                                                                                                                                           |
| `refs`              | `tag`, `tagSha` (40 ký tự), `releaseUrl`, `prs` (số PR), `commits` (commit đầu/cuối), `branches`                                                                                                         |
| `publicNotes`       | `summary` `{vi, en}` và các danh sách `{vi, en, area?}`: `added`, `improved`, `fixed`, `security`, `performance`, `changed`, `deprecated`, `knownIssues`                                                 |
| `notesReady`        | `true` khi ghi chú đã được duyệt để công bố; chỉ khi đó hộp "Có gì mới" mới hiện chúng                                                                                                                   |
| `learnerHighlights` | Tối đa 5 điểm nổi bật `{area, vi, en}`; `area` ∈ `teacher`, `voice`, `gemma`, `bio3d`, `performance`, `ui`, `security`                                                                                   |

`area` của một ghi chú (tùy chọn) dùng thêm giá trị `api` (Gemini/Claude/Groq). Tài liệu lịch sử dùng
`area` để gom mục IV (AI Teacher, giọng nói, Gemma, API) và mục V (`bio3d`).

## Hộp "Có gì mới" trong app (`src/app/whatsnew/`)

- Khóa `localStorage` `stemsim.whatsnew` = `{ "lastSeen": "x.y.z", "snoozed"?: "x.y.z" }`.
- Cài mới (chưa có `stemsim.tourDone`, chưa có `lastSeen`): ghi phiên bản hiện tại, không hiện gì.
- Người dùng cũ chưa có `lastSeen` (có `stemsim.tourDone`): coi như vừa nâng lên bản hiện tại, chỉ
  xét ghi chú của bản hiện tại.
- Nâng cấp (`lastSeen` < bản hiện tại): hiện mọi phiên bản trong khoảng (`lastSeen`, hiện tại] có
  `notesReady: true`, mỗi phiên bản một mục. Không có bản nào sẵn sàng → không hiện, không ghi gì
  (để lần cập nhật sau vẫn hiện được).
- Chỉ tự hiện ở trang mở đầu hoặc trang chủ Phòng thí nghiệm, khi không có hộp thoại nào đang mở
  (không chen vào giữa bài học hay mô phỏng). "Đóng" và "Xem chi tiết" ghi `lastSeen`; "Để sau" ghi
  `snoozed` (không tự hiện lại ở phiên bản này, nhưng menu ☰ còn mục "Có gì mới" có chấm báo).

## Quy trình cập nhật

1. **Khi làm một thay đổi đáng kể:** thêm ghi chú vào phiên bản đang làm (`status: "in-review"` khi
   PR mở), kèm bằng chứng (commit, PR, tài liệu). Chạy `npm run release-notes` và commit cả 4 tệp.
2. **Trước khi chạy Release:** đọc lại `publicNotes` và `learnerHighlights` bằng mắt người (dễ hiểu
   với người học? đúng sự thật? phần bảo mật đủ chung chung?), rồi đặt `notesReady: true`. Sau khi PR
   được gộp, đổi `status` thành `merged-not-released` và điền `dates.merged`.
3. **Sau khi GitHub Release được publish:** một bản không thể tự ghi ngày phát hành của chính nó.
   Ghi `status: "released"`, `dates.built`, `dates.released` (lấy `published_at` từ
   `gh api repos/<owner>/<repo>/releases`), `refs.tag`, `refs.tagSha`, `refs.releaseUrl` và dòng bằng
   chứng tương ứng; chạy `npm run release-notes`. Thay đổi này đi theo lần cập nhật kế tiếp — vì vậy
   trong app, bản đang dùng có thể ghi "Ngày phát hành: chưa xác minh" cho tới lần cập nhật sau.
4. **Bắt đầu phiên bản mới:** khi nâng `package.json`, thêm phần tử mới ở đầu `versions`
   (test yêu cầu phần tử đầu tiên trùng phiên bản trong `package.json`).
