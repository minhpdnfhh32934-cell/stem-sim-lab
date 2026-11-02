declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openLab } from './nav';

/**
 * "Từ tế bào đến DNA": six zoom levels, each with a scale bar to scale and its Science Card.
 * "Phóng to" glides into the ring around the next level's spot while a chip says the picture is
 * not to scale, then the next level replaces the scene; with reduced motion it steps at once.
 * The 2D picture has the same levels. WebGL runs in software (SwiftShader), never on the GPU
 * (see mitosis3d.spec.ts).
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

interface ZoomState {
  level: string;
  barNm: number;
  unitNm: number;
  named: string[];
  spot: boolean;
}
interface Hook {
  frames(): number;
  state(): ZoomState | null;
}
const hook = (page: Page) =>
  page.evaluate(() => {
    const h = (window as unknown as { __simlabBio3d?: Hook }).__simlabBio3d;
    return h ? { frames: h.frames(), state: h.state() } : null;
  });

async function openZoom(page: Page, errors: string[]): Promise<void> {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
  await openLab(page);
  await page.getByRole('radio', { name: 'Sinh học' }).click();
  await page.getByRole('button', { name: 'Từ tế bào đến DNA', exact: true }).click();
}

test('cell → DNA 3D: six levels, scale bars and the not-to-scale glide', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  await openZoom(page, errors);
  const view = page.locator('.bio3d[data-lesson="cellToDna"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await hook(page))?.frames ?? 0).toBeGreaterThan(0);
  await expect(view.getByText('Cấp 1/6 · Tế bào nhân thực')).toBeVisible();
  // Level 1: the 5 µm bar (a page label of the scene) and the nucleus at its printed size.
  await expect.poll(async () => (await hook(page))?.state?.level).toBe('cell');
  expect((await hook(page))?.state?.barNm).toBe(5000);
  await expect(view.locator('.bio3d__labels').getByText('5 µm', { exact: true })).toBeVisible();
  await expect(view.getByText('Đường kính nhân ≈ 5 µm')).toBeVisible();
  // The Science Card of the level.
  await expect(page.getByText('Tế bào nhân thực — cấp 1/6')).toBeVisible();

  // "Phóng to": the chip says "not to scale" while the camera glides, then level 2.
  const zoomIn = view.getByRole('button', { name: 'Phóng to' });
  await zoomIn.click();
  await expect(view.getByText('Chuyển cảnh giữa hai cấp — không theo tỉ lệ')).toBeVisible();
  await expect(view.getByText('Cấp 2/6 · Nhân tế bào')).toBeVisible();
  await expect.poll(async () => (await hook(page))?.state?.level).toBe('nucleus');
  await expect(view.getByText('Chuyển cảnh giữa hai cấp — không theo tỉ lệ')).toHaveCount(0);
  expect((await hook(page))?.state?.barNm).toBe(1000);

  // Every level from the inspector: its own bar, and the last one has no next spot.
  const bars: Record<string, [number, string]> = {
    chromosome: [500, '500 nm'],
    fibre: [100, '100 nm'],
    nucleosome: [10, '10 nm'],
    dna: [1, '1 nm'],
  };
  const panel = page.getByRole('group', { name: 'Sáu cấp phóng to' });
  const names = ['3. NST kép ở kì giữa', '4. Sợi nhiễm sắc 10 nm và khung NST', '5. Nucleosome'];
  for (const [i, id] of ['chromosome', 'fibre', 'nucleosome', 'dna'].entries()) {
    const label = i < 3 ? names[i] : '6. Chuỗi xoắn kép B-DNA';
    await panel.getByRole('button', { name: new RegExp(`^${label ?? ''}`) }).click();
    await expect.poll(async () => (await hook(page))?.state?.level).toBe(id);
    const [nm, text] = bars[id] ?? [0, ''];
    expect((await hook(page))?.state?.barNm).toBe(nm);
    await expect(view.locator('.bio3d__labels').getByText(text, { exact: true })).toBeVisible();
  }
  expect((await hook(page))?.state?.spot).toBe(false);
  await expect(zoomIn).toBeDisabled();
  // The fibre level's card says why there is no 30 nm level (debated); in Basic mode it sits
  // under the card's "Xem thêm".
  await panel.getByRole('button', { name: /^4\. / }).click();
  await expect(page.getByText(/còn được tranh luận nên hình không vẽ/)).toHaveCount(1);

  // 1366×768: no horizontal scroll; the zoom buttons are full targets.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
  const box = await view.getByRole('button', { name: 'Thu nhỏ' }).boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  expect(errors).toEqual([]);
});

test('cell → DNA: reduced motion steps at once; the 2D picture has the same levels', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openZoom(page, errors);
  const view = page.locator('.bio3d[data-lesson="cellToDna"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await view.getByRole('button', { name: 'Phóng to' }).click();
  // No glide, so no not-to-scale moment: the next level at once.
  await expect.poll(async () => (await hook(page))?.state?.level).toBe('nucleus');
  await expect(view.getByText('Chuyển cảnh giữa hai cấp — không theo tỉ lệ')).toHaveCount(0);

  // The learner's 2D choice: the canvas picture, the same level and buttons.
  await view.getByRole('radio', { name: '2D' }).click();
  const flat = page.locator('.zoom2d');
  await expect(flat.locator('canvas')).toBeVisible();
  await expect(flat.getByText('Cấp 2/6 · Nhân tế bào')).toBeVisible();
  await flat.getByRole('button', { name: 'Phóng to' }).click();
  await expect(flat.getByText('Cấp 3/6 · NST kép ở kì giữa')).toBeVisible();
  await expect(flat.getByText(/Thước tỉ lệ dài đúng 500 nm/)).toBeVisible();
  await flat.getByRole('button', { name: 'Thu nhỏ' }).click();
  await expect(flat.getByText('Cấp 2/6 · Nhân tế bào')).toBeVisible();
  // Back to 3D for the next tests on this machine (the choice is remembered per device).
  await flat.getByRole('radio', { name: '3D' }).click();
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
});
