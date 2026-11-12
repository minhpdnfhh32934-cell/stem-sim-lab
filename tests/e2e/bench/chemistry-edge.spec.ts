import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openTopic } from '../nav';

/**
 * Chemistry on the bench edge (0.8.1 B4; docs/BENCH_DESIGN.md §9.5 and §9.10): each view's own
 * controls sit in the D slots, the stage no longer repeats them, nothing serious for axe.
 */

const edge = (page: Page) => page.locator('.bench-edge');
const serious = async (page: Page) =>
  (await new AxeBuilder({ page }).include('.bench-edge').analyze()).violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.nodes.map((n) => n.target.join(' ')).join(' | ')})`);

test('B4: the mechanism plays from the edge (Bước i/n), not from the stage', async ({ page }) => {
  await openTopic(page, 'Hóa học', 'Thư viện phản ứng đã kiểm chứng');
  await page.getByRole('option', { name: /SN2/ }).click();
  const steps = page.getByRole('group', { name: 'Điều khiển các bước' });
  await expect(steps).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('group', { name: 'Điều khiển cơ chế' })).toHaveCount(0);
  await expect(steps).toContainText('Bước 1/');
  await steps.getByRole('button', { name: 'Bước sau' }).click();
  await expect(steps).toContainText('Bước 2/');
  await expect(edge(page).locator('.bench-play')).toHaveCount(1);
  expect(await serious(page)).toEqual([]);
});

test('B4: the periodic table steps through elements; nothing on its edge is filled', async ({
  page,
}) => {
  await openTopic(page, 'Hóa học', 'Bảng tuần hoàn');
  const stepper = page.getByRole('group', { name: 'Chọn nguyên tố' });
  await expect(stepper).toBeVisible({ timeout: 20_000 });
  // #205 B7: no element list on the edge (it repeated the stepper); the table picks one.
  await expect(stepper.getByRole('combobox')).toHaveCount(0);
  await page.getByRole('gridcell', { name: /^26 Fe / }).click();
  await expect(stepper).toContainText('26 · Fe · Sắt');
  await stepper.getByRole('button', { name: 'Nguyên tố sau' }).click();
  await expect(stepper).toContainText('27 · Co');
  await expect(edge(page).locator('.bench-play')).toHaveCount(0);
  expect(await serious(page)).toEqual([]);
});

test('B4: titration adds NaOH from D0 and reads V on the edge', async ({ page }) => {
  await openTopic(page, 'Hóa học', 'Chuẩn độ acid – base');
  const burette = page.getByRole('group', { name: 'Điều khiển buret' });
  await expect(burette).toBeVisible({ timeout: 20_000 });
  await expect(burette).toContainText('V = 0,00 mL');
  await burette.getByRole('button', { name: /^Nhỏ thêm .* mL NaOH$/ }).click();
  await expect(burette).not.toContainText('V = 0,00 mL');
  // The stage keeps the pH readout, not a second volume slider.
  await expect(page.getByRole('slider', { name: /Thể tích NaOH/ })).toHaveCount(1);
  await burette.getByRole('button', { name: 'Đặt lại' }).click();
  await expect(burette).toContainText('V = 0,00 mL');
  expect(await serious(page)).toEqual([]);
});
