# Prompt cài đặt cho từng máy

Mỗi máy có một thư mục riêng. Trên mỗi máy, chỉ cần cài Git và Claude Code (2 lệnh ở đầu file),
mở `claude`, rồi **gửi cả file** của máy đó cho Claude: dán toàn bộ nội dung, hoặc kéo thả file vào.
Claude tự cài và tự kiểm tra từ đầu đến cuối. Bạn chỉ cần bấm Yes/Authorize khi được hỏi.

| Máy                         | Tài khoản           | File                                                         | Làm khi nào |
| --------------------------- | ------------------- | ------------------------------------------------------------ | ----------- |
| A — Lead (kế hoạch, review) | Claude 1 · GitHub 1 | [`lead/BOOTSTRAP_PROMPT.md`](lead/BOOTSTRAP_PROMPT.md)       | **Trước**   |
| B — Builder (viết code)     | Claude 2 · GitHub 2 | [`builder/BOOTSTRAP_PROMPT.md`](builder/BOOTSTRAP_PROMPT.md) | Sau máy A   |

Điều kiện chung: PR #1 đã được merge vào `main`.

Xong cả hai máy thì issue "Kiểm tra kết nối hai máy" phải có hai bình luận: `pong:lead` và
`pong:builder`. Quy trình làm việc hằng ngày: `docs/TWO_MACHINE_WORKFLOW.md` mục 8 và 8b.
