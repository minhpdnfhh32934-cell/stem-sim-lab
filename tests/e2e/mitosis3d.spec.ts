declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openLab } from './nav';

const STAGES = ['g1', 'g2', 'prophase', 'metaphase', 'anaphase', 'telophase', 'cytokinesis'];

async function openMitosis(page: Page) {
  // A slow test machine may measure as "low" quality, where mitosis uses the 2D picture.
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
  await openLab(page);
  await page.getByRole('radio', { name: 'Sinh học' }).click();
  await page.getByRole('button', { name: 'Nguyên phân', exact: true }).click();
  await expect(page.locator('.m3d canvas')).toBeVisible({ timeout: 20_000 });
}

const stage = (page: Page) => page.evaluate(() => window.__simlabMitosis3d?.stage() ?? null);
const info = (page: Page) => page.evaluate(() => window.__simlabMitosis3d?.info() ?? null);

test('mitosis 3D: plays through every stage, switches cell type, no leaks on replay', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await openMitosis(page);
  await expect(page.locator('.science-card')).toContainText('Nguyên phân 3D');

  // Play the whole division at 2× and record every stage shown.
  await page.getByRole('radio', { name: '2×' }).click();
  await page.getByRole('button', { name: 'Phát', exact: true }).click();
  const seen = new Set<string>();
  await expect
    .poll(
      async () => {
        const s = await stage(page);
        if (s) seen.add(s);
        return s;
      },
      { timeout: 40_000, intervals: [100] },
    )
    .toBe('cytokinesis');
  await expect(page.getByRole('button', { name: 'Phát', exact: true })).toBeVisible({
    timeout: 15_000,
  });
  expect([...seen].sort()).toEqual([...STAGES].sort());
  await expect(page.getByText('Sau khi chia: 2 tế bào con · mỗi tế bào 4 NST đơn')).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/m3d-animal-end.png` });

  // Plant cell: wall and cell plate instead of centrosomes and furrow.
  await page.getByRole('radio', { name: 'Thực vật' }).click();
  const parts = page.getByRole('group', { name: 'Bộ phận tế bào' });
  await expect(parts.getByRole('button', { name: 'Thành tế bào' })).toBeVisible();
  await expect(parts.getByRole('button', { name: 'Trung thể' })).toHaveCount(0);
  await parts.getByRole('button', { name: 'Vách ngăn (tấm tế bào)' }).click();
  await expect(page.locator('.m3d__info')).toContainText('Golgi');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/m3d-plant-end.png` });

  // Replay 10 times (stepping through every stage): GPU resources must not grow.
  const next = page.getByRole('button', { name: 'Kì tiếp theo' });
  const pass = async () => {
    await page.getByRole('button', { name: 'Phát lại từ đầu' }).click();
    await page.getByRole('button', { name: 'Tạm dừng' }).click();
    for (let k = 0; k < STAGES.length - 1; k++) {
      await next.click();
      await page.waitForTimeout(60);
    }
    await expect(next).toBeDisabled();
  };
  await pass();
  const first = await info(page);
  expect(first?.geometries).toBeGreaterThan(0);
  for (let r = 0; r < 9; r++) await pass();
  const after = await info(page);
  expect(after?.geometries).toBe(first?.geometries);
  expect(after?.textures).toBe(first?.textures);
  expect(after?.objects).toBe(first?.objects);

  // Switching cell type back and forth rebuilds the scene and frees the old one.
  for (let r = 0; r < 3; r++) {
    await page.getByRole('radio', { name: 'Động vật' }).click();
    await page.getByRole('radio', { name: 'Thực vật' }).click();
  }
  await page.waitForTimeout(300);
  const toggled = await info(page);
  expect(toggled?.objects).toBe(first?.objects);
  expect(toggled?.geometries).toBeLessThanOrEqual((first?.geometries ?? 0) + 2);

  // Close-up and metaphase picture for the record.
  await page.getByRole('button', { name: 'Kì giữa' }).click();
  await page.getByRole('radio', { name: 'Cận cảnh NST' }).click();
  await page.waitForTimeout(300);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/m3d-plant-meta.png` });
  await page.getByRole('radio', { name: 'Động vật' }).click();
  await page.getByRole('radio', { name: 'Toàn cảnh' }).click();
  await page.waitForTimeout(300);
  if (process.env.SHOTS)
    await page.screenshot({ path: `${process.env.SHOTS}/m3d-animal-meta.png` });

  // 2D view still available; meiosis keeps the 2D picture.
  await page.getByRole('radio', { name: '2D' }).click();
  await expect(page.locator('.m3d')).toHaveCount(0);
  await expect(page.locator('canvas.chem-canvas')).toBeVisible();
  await page.getByRole('radio', { name: '3D' }).click();
  await expect(page.locator('.m3d canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Giảm phân', exact: true }).click();
  await expect(page.locator('.m3d')).toHaveCount(0);
  await expect(page.locator('canvas.chem-canvas')).toBeVisible();

  expect(errors).toEqual([]);
});
