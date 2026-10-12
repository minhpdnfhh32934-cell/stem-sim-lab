# Thành phần của bên thứ ba (mô hình, phông chữ, dịch vụ)

Danh sách những thứ SimLab dùng mà không do dự án tự làm, kèm giấy phép và cách ghi nguồn. Thư viện
npm/Rust thông thường có giấy phép trong `package.json` / `Cargo.lock`; tệp này chỉ ghi các thành
phần **tải về lúc chạy** hoặc có điều kiện sử dụng đặc biệt. Kiểm tra lại trước mỗi bản phát hành.

| Thành phần                                                                                | Dùng để                                                              | Giấy phép / điều khoản                                                                   | Ghi nguồn trong app                                                                 | Tra ngày   |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------- |
| Gemma 3 270M / 1B, Gemma 4 E2B (`onnx-community/*` trên HuggingFace)                      | AI local trả lời trong app                                           | Gemma Terms of Use + Prohibited Use Policy (ai.google.dev/gemma/terms)                   | Cài đặt → AI local: nút "Đọc điều khoản sử dụng Gemma"                              | 2026-10-12 |
| MMS-TTS tiếng Việt (`facebook/mms-tts-vie`, bản ONNX `Xenova/mms-tts-vie`)                | Giọng tiếng Việt chạy trên máy                                       | **CC BY-NC 4.0**: phi thương mại, phải ghi nguồn                                         | Cài đặt → Giọng nói: tên mô hình, giấy phép, nút "Trang mô hình" và "Đọc giấy phép" | 2026-10-12 |
| Gemini TTS (`gemini-3.8-flash-tts`, `gemini-3.8-flash-lite-tts`)                          | Giọng trực tuyến                                                     | Điều khoản Gemini API (người dùng tự tạo khóa, từ 18 tuổi); âm thanh có thủy vân SynthID | Cài đặt → Giọng nói + ô "Dữ liệu của em đi đâu?"                                    | 2026-10-12 |
| Phông Patrick Hand và Pangolin (`@fontsource/patrick-hand`, `@fontsource/pangolin` 5.3.0) | Chữ viết tay trên bảng trắng (có dấu tiếng Việt), đóng gói trong app | SIL Open Font License 1.1                                                                | (phông đi kèm, giấy phép trong gói npm)                                             | 2026-10-12 |
| Transformers.js (`@huggingface/transformers`)                                             | Chạy Gemma và MMS-TTS                                                | Apache-2.0                                                                               | (thư viện npm)                                                                      | 2026-10-12 |
| ONNX Runtime Web (`onnxruntime-web`, tệp trong `public/ort/`)                             | Bộ chạy mô hình (WebGPU/WebAssembly)                                 | MIT                                                                                      | (thư viện npm)                                                                      | 2026-10-12 |

**Trích dẫn MMS** (theo trang mô hình): Pratap, V. và cộng sự, "Scaling Speech Technology to 1,000+
Languages", Meta AI, 2023.

**Đã cân nhắc nhưng không dùng:** giọng Piper tiếng Việt (`vi_VN-vais1000`, `vi_VN-25hours_single`,
`vi_VN-vivos`): tinh chỉnh từ giọng `lessac` có dữ liệu gốc chỉ cho phép dùng nghiên cứu, và cần
espeak-ng (GPL-3) để phiên âm. Chi tiết: `docs/LEGAL_COMPLIANCE.md` mục 2e.
