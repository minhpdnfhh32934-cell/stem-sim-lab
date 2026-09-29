# Cài đặt môi trường trên Windows

Hướng dẫn này dành cho người mới. Làm lần lượt từng bước. Mỗi bước đều có lệnh **kiểm tra** để
biết đã cài đúng hay chưa.

> Mở **PowerShell**: bấm phím Windows, gõ `PowerShell`, rồi Enter.
> Sau khi cài xong một công cụ, **đóng PowerShell và mở lại** để máy nhận lệnh mới.

## Cách nhanh: dùng `winget` (có sẵn trên Windows 10/11)

Dán lần lượt từng dòng vào PowerShell:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
winget install --id Rustlang.Rustup
winget install --id OpenJS.NodeJS.LTS
winget install --id Git.Git
```

Nếu `winget` báo lỗi, làm theo cách thủ công bên dưới.

## Cách thủ công

### 1. Microsoft C++ Build Tools (bắt buộc cho Rust/Tauri)

1. Tải **Build Tools for Visual Studio** tại <https://visualstudio.microsoft.com/visual-cpp-build-tools/>.
2. Chạy file cài đặt, tích chọn **"Desktop development with C++"**.
   Mục này đã có sẵn MSVC và Windows SDK.
3. Bấm **Install** (khoảng 2–6 GB, mất vài phút).

### 2. WebView2

Windows 10 (bản 1803 trở lên) và Windows 11 thường **đã có sẵn**. Nếu app báo thiếu WebView2,
tải bản _Evergreen Bootstrapper_ tại <https://developer.microsoft.com/microsoft-edge/webview2/>.

### 3. Rust

1. Tải `rustup-init.exe` tại <https://rustup.rs>.
2. Chạy file, nhấn Enter để chọn mặc định (toolchain `stable-x86_64-pc-windows-msvc`).
3. Kiểm tra:
   ```powershell
   rustc --version
   cargo --version
   ```

### 4. Node.js (bản 22.12 trở lên)

1. Tải bản **LTS** tại <https://nodejs.org>, cài với tùy chọn mặc định.
2. Kiểm tra:
   ```powershell
   node --version   # phải từ v22.12 trở lên
   npm --version
   ```

### 5. Git

Tải tại <https://git-scm.com/download/win>, cài với tùy chọn mặc định. Kiểm tra: `git --version`.

### 6. (Khuyên dùng) VS Code và các extension

Khi mở thư mục dự án, VS Code sẽ gợi ý cài các extension trong `.vscode/extensions.json`:
Tauri, rust-analyzer, ESLint, Prettier, Vitest.

## Chạy dự án

```powershell
cd C:\stem-sim-lab        # thay bằng thư mục dự án của bạn
npm install               # tải thư viện JavaScript (lần đầu ~1–2 phút)
npm run tauri dev         # mở app desktop
```

Lần đầu `npm run tauri dev` phải biên dịch Rust nên mất khoảng **5–10 phút**. Các lần sau chỉ
mất vài giây.

### Các lệnh hay dùng

| Lệnh                  | Tác dụng                                                                   |
| --------------------- | -------------------------------------------------------------------------- |
| `npm run tauri dev`   | Chạy app desktop, tự tải lại khi sửa code                                  |
| `npm run dev`         | Chỉ chạy giao diện trong trình duyệt (http://localhost:1420)               |
| `npm test`            | Chạy toàn bộ unit test                                                     |
| `npm run lint`        | Kiểm tra lỗi và phong cách code                                            |
| `npm run typecheck`   | Kiểm tra kiểu TypeScript                                                   |
| `npm run check`       | Chạy cả lint, typecheck và test                                            |
| `npm run tauri build` | Đóng gói bộ cài `.exe` / `.msi` (trong `src-tauri\target\release\bundle\`) |
| `cargo test`          | Test phần Rust (chạy trong thư mục `src-tauri`)                            |

## Lỗi thường gặp

- **`npm : File ... npm.ps1 cannot be loaded because running scripts is disabled`**:
  chạy lệnh `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, chọn `Y`, rồi mở lại PowerShell.
- **`linker 'link.exe' not found`**: chưa cài bước 1 (C++ Build Tools), hoặc chưa tích mục
  "Desktop development with C++".
- **`Port 1420 is already in use`**: đang có một cửa sổ `tauri dev` khác chạy. Đóng nó, hoặc tắt
  tiến trình `node` trong Task Manager.
- **Lần build đầu rất chậm**: phần mềm diệt virus có thể đang quét thư mục `src-tauri\target`.
  Có thể thêm thư mục này vào danh sách loại trừ của Windows Defender.
