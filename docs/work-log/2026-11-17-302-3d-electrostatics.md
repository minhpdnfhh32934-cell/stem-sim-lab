# 302-3d-electrostatics — Đợt 6b: 3D cho điện trường, điện thế, tụ điện, dòng điện

- **Goal:** đợt 6b của kế hoạch 3D (#302): bốn bài Vật lí 11 dạng `PhysicsScene` có thêm chế độ xem
  3D, vẽ đúng số của mô hình và engine.
- **Date/time:** 2026-11-17 (+0700).
- **Status:** PASS
- **Branch / base:** `feat/302-3d-electrostatics`, tách từ `feat/302-3d-electromagnetism` (đợt 6a).

## Files

- **Nền chung cho bài dạng `PhysicsScene`:**
  - `src/physics/types.ts`: trường tùy chọn `view3d` (một component `lazy()` tạo một lần trong tệp
    của bài).
  - `src/app/sim/SceneStage.tsx`: hiện hình 3D thay cho canvas khi người học chọn 3D. Lúc đó nó tự
    chạy engine (`sim.tick` mỗi khung hình), vì canvas vốn làm việc này không còn hiện.
  - `src/app/layout/Stage.tsx`, `src/app/sim/sim.css`: nút 3D/2D nằm dưới dòng tiêu đề, bên phải;
    cột công cụ của canvas (thước, thước đo góc…) ẩn khi xem 3D vì không dùng được ở đó.
- **Điện trường của điện tích điểm** (`src/physics/field/`): `field3d.ts`, `scene3d.ts`,
  `Field3DView.tsx`.
  - Đường sức là các đường mà mô hình đã vạch cho hình 2D (`linesFor`).
  - Với 1, 2 điện tích hoặc 3 điện tích thẳng hàng, điện trường đối xứng quanh đường thẳng nối
    chúng, nên app vẽ thêm các đường sức đó khi quay 60° và 120° quanh đường thẳng ấy. Test kiểm
    tra tính đối xứng này bằng định luật Coulomb trong không gian.
  - Tụ phẳng: hai bản, đường sức đều, E dài 0,35·d như hình 2D.
- **Thế năng điện. Điện thế** (`src/physics/potential/`): mặt đẳng thế qua M và N (V = E·y); điện
  tích nằm ở vị trí engine tính; có lực qE.
- **Cường độ dòng điện** (`src/physics/current/`): dây trong suốt, ion đứng yên, electron trôi đúng
  quãng đường s = v·t của engine (cùng quy tắc với hình 2D).
- **Tụ điện** (`src/physics/capacitor/`): các tụ ghép nối tiếp thành chuỗi hoặc song song cạnh nhau.
  Số chấm điện tích trên mỗi bản tỉ lệ với qᵢ = Cᵢ·Uᵢ(t) của engine.
- **Dời hàm dùng chung sang model:** `rightEdge` (điện thế), `lengthOf` và `jitter` (dòng điện),
  để hình 2D và 3D dùng cùng một hàm.
- **E2E:** `tests/e2e/electric-phys3d.spec.ts` (4 bài).
- **DATA_REVIEW:** PHY3D-5…9 (pending). CLAUDE.md: mục "Physics 3D".

## Key decisions

- **Không tính lại số:** E tại M từ `fieldAtPoint` (engine dùng cùng hàm); vị trí điện tích,
  quãng đường electron và hiệu điện thế từng tụ đọc từ `sim.renderState`.
- **Đối xứng chứ không vạch lại:** đường sức 3D là đường 2D của mô hình quay quanh trục đối xứng.
  Trường hợp ba điện tích không thẳng hàng không có đối xứng này, nên chỉ vẽ mặt phẳng chứa chúng
  (ghi trong chú thích).
- **Đổi mô hình hoặc cách ghép thì dựng lại hình 3D** (điện tích điểm ↔ tụ phẳng; nối tiếp ↔ song
  song), để mỗi kiểu bắt đầu từ góc nhìn hợp với nó.

## Commands run (real results, summary lines only)

- `npx vitest run src/physics/field src/physics/potential src/physics/current src/physics/capacitor`:
  đạt (tệp test mới: điện trường 6, điện thế 3, dòng điện 2, tụ điện 3 bài).
- `npx vitest run` (toàn bộ): 484 tệp đạt, 2 bỏ qua (có sẵn); 2 tệp lỗi vì đo thời gian lúc máy bận
  (`app.test` quá thời gian; `playbackEndless` 4,945 thay vì 5 ± 0,05). Chạy lại riêng: 17/17 đạt.
- `npx tsc -b --noEmit`, `npx eslint`, `npx prettier --check`: đạt.
- **E2E chromium-3d** `electric-phys3d.spec.ts`: 4/4 đạt (điện trường + tụ phẳng + trở lại 2D; điện
  thế: điện tích đi từ M xuống N; dòng điện: v = 0,118 mm/s, s tăng khi chạy; tụ điện: nối tiếp
  36/36/36 chấm, song song 18/27/36).
- **E2E chromium** `electric-vl11`, `physics.spec`: 50/50 đạt (hình 2D của mọi bài Vật lí không đổi).
- **Xem ảnh 1366×768:** đã sửa bốn chỗ: bản tụ phẳng dày như gối (nay mỏng), E xuyên bản dưới (nay
  0,35·d), chấm điện tích bị che sau bản (nay ở mặt trong, bản trong mờ), nhãn E che nhãn Vₙ.
- **Đo ngân sách:** `docs/PERFORMANCE.md` (Vật lí 3D, đợt 6b).

## Next steps and limits

- Đợt 6c: sóng cơ, giao thoa, sóng dừng.
- Hình 3D chưa có các công cụ đo của canvas (thước, thước đo góc); cột công cụ ẩn khi xem 3D.
