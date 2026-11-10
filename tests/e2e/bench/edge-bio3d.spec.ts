declare const process: { env: Record<string, string | undefined> };
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openTopic } from '../nav';

/**
 * Biology on the bench edge (0.8.1 B5; docs/BENCH_DESIGN.md §8, §9.6): a lesson's own player is
 * drawn in the edge (EdgePortal), the stage keeps its pictures and chips. 3D in software.
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

const edge = (page: Page) => page.locator('.bench-edge');
const stage = (page: Page) => page.getByRole('region', { name: 'Khung mô phỏng' });
const serious = async (page: Page) =>
  (await new AxeBuilder({ page }).include('.bench-edge').analyze()).violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.nodes.map((n) => n.target.join(' ')).join(' | ')})`);

test('B5: mitosis 3D steps from the edge; the stage keeps the stage name', async ({ page }) => {
  await openTopic(page, 'Sinh học', 'Nguyên phân');
  const next = edge(page).getByRole('button', { name: 'Bước tiếp theo' });
  await expect(next).toBeVisible({ timeout: 30_000 });
  await expect(edge(page).getByRole('button', { name: 'Bước trước' })).toBeDisabled();
  await expect(stage(page).getByRole('button', { name: 'Bước tiếp theo' })).toHaveCount(0);
  const name = page.locator('.m3d__top .chem-chip strong').first();
  const before = await name.textContent();
  await next.click();
  await expect(name).not.toHaveText(before ?? '');
  await expect(edge(page).getByRole('button', { name: 'Bước trước' })).toBeEnabled();
  expect(await serious(page)).toEqual([]);
});

test('B5: a habitat lesson plays from the edge (time slider there)', async ({ page }) => {
  await openTopic(page, 'Sinh học', 'Tăng trưởng logistic');
  await expect(edge(page).locator('.bio3d__player input[type="range"]')).toBeVisible({
    timeout: 30_000,
  });
  await expect(stage(page).locator('.bio3d__player')).toHaveCount(0);
  expect(await serious(page)).toEqual([]);
});

test('B5: cell → DNA zooms from the edge', async ({ page }) => {
  await openTopic(page, 'Sinh học', 'Từ tế bào đến DNA');
  const zoomIn = edge(page).getByRole('button', { name: 'Phóng to' });
  await expect(zoomIn).toBeVisible({ timeout: 30_000 });
  await expect(edge(page).getByRole('button', { name: 'Thu nhỏ' })).toBeDisabled();
  await zoomIn.click();
  await expect(edge(page).getByRole('button', { name: 'Thu nhỏ' })).toBeEnabled({
    timeout: 10_000,
  });
  expect(await serious(page)).toEqual([]);
});
