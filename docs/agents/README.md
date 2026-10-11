# Prompt cài đặt cho từng máy

Mỗi máy có một thư mục riêng. Mở đúng file của máy mình, rồi dán khung prompt trong file đó vào
Claude Code chạy **trên máy đó** (không dùng phiên cloud).

| Máy                         | Tài khoản           | File                                                         | Làm khi nào |
| --------------------------- | ------------------- | ------------------------------------------------------------ | ----------- |
| A — Lead (kế hoạch, review) | Claude 1 · GitHub 1 | [`lead/BOOTSTRAP_PROMPT.md`](lead/BOOTSTRAP_PROMPT.md)       | **Trước**   |
| B — Builder (viết code)     | Claude 2 · GitHub 2 | [`builder/BOOTSTRAP_PROMPT.md`](builder/BOOTSTRAP_PROMPT.md) | Sau máy A   |

Điều kiện chung: PR #1 đã được merge vào `main`, máy đã cài Claude Code và đăng nhập
(`docs/TWO_MACHINE_WORKFLOW.md` bước 1–4).

Xong cả hai máy thì issue "Kiểm tra kết nối hai máy" phải có hai bình luận: `pong:lead` và
`pong:builder`. Quy trình làm việc hằng ngày: `docs/TWO_MACHINE_WORKFLOW.md` mục 8 và 8b.
