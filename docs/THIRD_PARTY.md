# Thành phần của bên thứ ba (mô hình, phông chữ, dịch vụ)

Danh sách những thứ SimLab dùng mà không do dự án tự làm, kèm giấy phép và cách ghi nguồn. Thư viện
npm/Rust thông thường có giấy phép trong `package.json` / `Cargo.lock`; tệp này chỉ ghi các thành
phần **tải về lúc chạy** hoặc có điều kiện sử dụng đặc biệt. Kiểm tra lại trước mỗi bản phát hành.

| Thành phần                                                                                                      | Dùng để                                                                                                                                                                                                                                                                                  | Giấy phép / điều khoản                                                                   | Ghi nguồn trong app                                                                 | Tra ngày   |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------- |
| Gemma 3 270M / 1B, Gemma 4 E2B (`onnx-community/*` trên HuggingFace)                                            | AI local trả lời trong app                                                                                                                                                                                                                                                               | Gemma Terms of Use + Prohibited Use Policy (ai.google.dev/gemma/terms)                   | Cài đặt → AI local: nút "Đọc điều khoản sử dụng Gemma"                              | 2026-10-12 |
| MMS-TTS tiếng Việt (`facebook/mms-tts-vie`, bản ONNX `Xenova/mms-tts-vie`)                                      | Giọng tiếng Việt chạy trên máy                                                                                                                                                                                                                                                           | **CC BY-NC 4.0**: phi thương mại, phải ghi nguồn                                         | Cài đặt → Giọng nói: tên mô hình, giấy phép, nút "Trang mô hình" và "Đọc giấy phép" | 2026-10-12 |
| Gemini TTS (`gemini-3.8-flash-tts`, `gemini-3.8-flash-lite-tts`)                                                | Giọng trực tuyến                                                                                                                                                                                                                                                                         | Điều khoản Gemini API (người dùng tự tạo khóa, từ 18 tuổi); âm thanh có thủy vân SynthID | Cài đặt → Giọng nói + ô "Dữ liệu của em đi đâu?"                                    | 2026-10-12 |
| Phông Patrick Hand và Pangolin (`@fontsource/patrick-hand`, `@fontsource/pangolin` 5.3.0)                       | Chữ viết tay trên bảng trắng (có dấu tiếng Việt), đóng gói trong app                                                                                                                                                                                                                     | SIL Open Font License 1.1                                                                | (phông đi kèm, giấy phép trong gói npm)                                             | 2026-10-12 |
| Phông Be Vietnam Pro và JetBrains Mono (`@fontsource/be-vietnam-pro`, `@fontsource/jetbrains-mono` 5.3.0)       | Chữ giao diện và số đo của giao diện mới "Bàn thí nghiệm" (chỉ giao diện này nạp; 223 KB woff2). Chữ số chỉ số dưới/trên (trừ ¹²³), mũi tên, ≈ ≤ ≥ √ và (với Be Vietnam Pro) chữ Hy Lạp không có trong các bộ chữ đóng gói, nên dùng phông dự phòng (`src/app/theme/benchFonts.test.ts`) | SIL Open Font License 1.1                                                                | (phông đi kèm, giấy phép trong gói npm)                                             | 2026-11-02 |
| Transformers.js (`@huggingface/transformers`)                                                                   | Chạy Gemma và MMS-TTS                                                                                                                                                                                                                                                                    | Apache-2.0                                                                               | (thư viện npm)                                                                      | 2026-10-12 |
| ONNX Runtime Web (`onnxruntime-web`, tệp trong `public/ort/`)                                                   | Bộ chạy mô hình (WebGPU/WebAssembly)                                                                                                                                                                                                                                                     | MIT                                                                                      | (thư viện npm)                                                                      | 2026-10-12 |
| Mẫu giao diện uiverse.io (kho `uiverse-io/galaxy`, commit `adbd2adde0a2`): bộ B người dùng chọn ngày 02/11/2026 | Kiểu các nút, công tắc, thanh trượt, tooltip… của giao diện "Bàn thí nghiệm" (`src/app/bench/bench.css`, `src/app/bench/ThemeSwitch.tsx`). Viết lại hoàn toàn bằng token của app, chỉ giữ ý tưởng và cấu trúc của từng mẫu                                                               | MIT (Copyright (c) 2023 Uiverse.io): phải giữ thông báo giấy phép                        | Thông báo MIT và tên tác giả ở mục "Mẫu uiverse.io" bên dưới                        | 2026-11-03 |

**Mẫu uiverse.io** (giao diện "Bàn thí nghiệm", bộ B, tra ngày 2026-11-03). Trang pháp lý của
uiverse.io chưa mở được để đối chiếu; kho mã ghi giấy phép MIT dưới đây. Mỗi mẫu một tác giả:

- Nút chính "Chạy": SelfMadeSystem — uiverse.io/SelfMadeSystem/tough-fireant-47
- Nút phụ: e-coders — uiverse.io/e-coders/nervous-chipmunk-49
- Nút biểu tượng: Galahhad — uiverse.io/Galahhad/kind-cheetah-52
- Công tắc đoạn (Cơ bản / Nâng cao): Pradeepsaranbishnoi — uiverse.io/Pradeepsaranbishnoi/slimy-warthog-37
- Thẻ chọn đồ thị: Admin12121 — uiverse.io/Admin12121/cold-bobcat-20
- Ô đánh dấu: cbolson — uiverse.io/cbolson/calm-wasp-75
- Hàng tham số: satisshTechie — uiverse.io/satisshTechie/sharp-hound-14
- Thanh thời gian: Galahhad — uiverse.io/Galahhad/happy-dodo-17
- Ô tìm kiếm: alexruix — uiverse.io/alexruix/slippery-frog-10
- Nấc tốc độ: Yaya12085 — uiverse.io/Yaya12085/rude-mouse-79
- Ô chọn tốc độ (Nâng cao): mi-series — uiverse.io/mi-series/good-walrus-42
- Thẻ thu gọn được: Admin12121 — uiverse.io/Admin12121/fluffy-vampirebat-68
- Chip: kamehame-ha — uiverse.io/kamehame-ha/swift-penguin-73; Madflows — uiverse.io/Madflows/great-chipmunk-4
- Tooltip: kyle1dev — uiverse.io/kyle1dev/quiet-cougar-91
- Khung chờ tải: Yaya12085 — uiverse.io/Yaya12085/curvy-otter-58
- Thông báo nổi: andrew-demchenk0 — uiverse.io/andrew-demchenk0/nervous-bear-89

```text
MIT License

Copyright (c) 2023 Uiverse.io

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**Trích dẫn MMS** (theo trang mô hình): Pratap, V. và cộng sự, "Scaling Speech Technology to 1,000+
Languages", Meta AI, 2023.

**Đã cân nhắc nhưng không dùng:** giọng Piper tiếng Việt (`vi_VN-vais1000`, `vi_VN-25hours_single`,
`vi_VN-vivos`): tinh chỉnh từ giọng `lessac` có dữ liệu gốc chỉ cho phép dùng nghiên cứu, và cần
espeak-ng (GPL-3) để phiên âm. Chi tiết: `docs/LEGAL_COMPLIANCE.md` mục 2e.

## SimLab 3D (trò chơi, `public/game/`, `docs/GAME.md`)

Bản dựng sẵn của game phòng thí nghiệm 3D (thêm ngày 12/11/2026):

- **Thư viện đóng gói trong bản dựng:** three.js (MIT), Rapier `@dimforge/rapier3d-compat` (Apache-2.0), zod (MIT).
- **Âm thanh:** Kenney "Impact Sounds" và "RPG Audio", CC0 1.0. Danh sách từng tệp ở `public/game/audio/CREDITS.md`.
- **Mô hình thành phố dưới sàn sảnh:** Quaternius "Downtown City MegaKit" (bản Standard miễn phí), CC0 1.0 (`public/game/hub-city/README.md`).
- **Không đóng gói:**
  - texture Ultra (ambientCG, CC0), vì quá nặng;
  - mô hình MediaPipe Face Landmarker / Hair Segmenter (Apache-2.0), vì không chạy mô hình trong app khi chưa hỏi người dùng.
