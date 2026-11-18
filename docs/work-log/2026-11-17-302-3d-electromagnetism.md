# 302-3d-electromagnetism — Đợt 6a: 3D cho lực từ, cảm ứng điện từ, sóng điện từ

- **Goal:** đợt đầu của kế hoạch 3D (#302): ba bài Vật lí có thêm chế độ xem 3D, vẽ đúng số của
  mô hình 2D.
- **Date/time:** 2026-11-17 (+0700).
- **Status:** PASS
- **Branch / base:** `feat/302-3d-electromagnetism`, tách từ `origin/main`.

## Files

- **Dùng lại bộ 3D của Sinh học** (`Bio3DView`, `SceneKit`, công tắc 3D/2D) thay vì viết bộ mới.
  `src/biology/view3d/prefs.ts`: thêm ba bài Vật lí; chúng là `OPT_IN_3D`: mở ở 2D (hình 2D có cả
  đồ thị), nhớ lựa chọn 3D của người học (`stemsim.bio3d`, danh sách `on`).
- **Mảnh dùng chung mới:** `src/physics/view3d/arrow.ts` (mũi tên, từ trường đều, đường gấp khúc).
- **Lực từ và cảm ứng từ** (`src/physics/magnetic/`): `magnetic3d.ts` (thuần: B, dòng điện, F =
  I·L × B từ `cross` của mô hình, độ dài theo sinα), `scene3d.ts`, `Magnetic3DView.tsx`. Chỉ phần
  "Lực từ" có 3D; phần "Đo cảm ứng từ" là đồ thị nên luôn 2D.
- **Cảm ứng điện từ và máy phát điện xoay chiều** (`src/physics/induction/`): `induction3d.ts`
  (pháp tuyến n, từ thông, suất điện động lấy từ mô hình), `scene3d.ts` (nam châm N, S, khung dây
  quay quanh trục; phần từ thông có khung "trước" mờ), `Induction3DView.tsx`.
- **Sóng điện từ** (`src/physics/emwave/`): `emwave3d.ts` (E, B cùng pha, vuông góc nhau và với
  phương truyền), `scene3d.ts` (sóng chạy chậm, không cấp phát mỗi khung hình), `Em3DView.tsx`.
- **E2E:** `tests/e2e/em-phys3d.spec.ts` (thêm `phys3d` vào `HEAVY_3D`, chạy với SwiftShader).
- **DATA_REVIEW:** PHY3D-1…4 (pending). CLAUDE.md: một mục "Physics 3D".

## Key decisions

- **Bài Vật lí mở ở 2D:** hình 2D của ba bài có đồ thị (F theo α, e(t), thang sóng) mà hình 3D
  không có; nút 3D ở ngay trên hình.
- **Không tính lại số:** hình 3D đọc store của bài và gọi đúng hàm của mô hình (`force`,
  `forceDirection`, `flux`, `fluxAt`, `emfAt`); test so pháp tuyến vẽ ra với từ thông của mô hình.
- **Phần minh họa ghi rõ** trong chú thích dưới hình: đường sức, độ dài mũi tên, nam châm, biên
  độ, chuyển động.

## Commands run (real results, summary lines only)

- `npx vitest run src/physics/magnetic src/physics/induction src/physics/emwave src/biology/view3d`:
  đạt (thêm 4 tệp test mới: lực từ 9, cảm ứng 10, sóng điện từ 10 bài, và một bài cho công tắc
  3D/2D của bài Vật lí).
- `npx vitest run` (toàn bộ): 478 tệp đạt, 2 bỏ qua (có sẵn); 4 tệp lỗi vì máy đang bận chạy E2E
  cùng lúc (đo thời gian: `app.test` quá 15 s, bài giao thoa quá thời gian, hai bài đo ngân sách
  3D Sinh học 193 / 241 ms > 150 ms). Chạy lại riêng bốn tệp đó: 27/27 đạt.
- `npx tsc -b --noEmit`, `npx eslint src tests playwright.config.ts`, `npx prettier --check`: đạt.
- **E2E chromium-3d** `em-phys3d.spec.ts`: 3/3 đạt (lần chạy đầu tìm ra một lỗi thật: ở bài lực từ và
  cảm ứng, hình 2D che hàng nút nên không bấm được nút 3D; đã sửa bằng cách đặt hàng nút sau hình).
- **E2E chromium** `magnetism-vl12`, `waves-vl11`, `physics.spec`: 51/51 đạt (hình 2D không đổi).
- **Xem ảnh 1366×768:** lực từ (thêm mặt phẳng hình mờ, góc nhìn từ bên để thấy F vuông góc mặt
  phẳng), cảm ứng (nhãn Φ₁ dưới khung, Φ₂ trên khung), sóng điện từ (khung hình vừa sóng).
- **Đo ngân sách:** ghi trong `docs/PERFORMANCE.md` (Vật lí 3D, đợt 6a).

## Next steps and limits

- Đợt 6b: điện trường, điện thế, tụ điện, dòng điện (các bài dạng `PhysicsScene`: cần thêm trường
  `view3d` vào `PhysicsScene`).
- Hình 3D của máy phát chưa có đồ thị e(t); đồ thị vẫn ở hình 2D.
