import { expect, test } from '@playwright/test';
import { openTopic } from '../nav';

/**
 * The physics bench of 0.8.1 B2 (docs/BENCH_DESIGN.md §9.4): the Science Card's summary pinned
 * at the top of the tray, "Dụng cụ đo" as switches, the pin in D2, and a locked prediction that
 * turns the main action into "Chạy để kiểm tra".
 */
test('B2: the tray summary, the tool switches and the pin in D2', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Vật lý', 'Ném xiên');
  await expect(page.locator('.stage__hud-title')).toHaveText('Ném xiên', { timeout: 20_000 });
  const tray = page.getByRole('complementary', { name: 'Bảng thuộc tính' });
  const summary = tray.locator('.science-card.science-card--summary');
  await expect(summary).toBeVisible();
  await expect(summary.getByText('Ném xiên')).toBeVisible();
  // The whole card is in the notebook, not a second time in the tray.
  await expect(tray.locator('.science-card')).toHaveCount(1);
  // g can change while running: its hint spans the row (it once wrapped word by word in the − cell).
  const hint = tray.locator('.param__hint').first();
  await hint.scrollIntoViewIfNeeded();
  const [hintBox, rowBox] = await Promise.all([
    hint.boundingBox(),
    hint.locator('xpath=..').boundingBox(),
  ]);
  expect(hintBox && rowBox && hintBox.width / rowBox.width).toBeGreaterThan(0.9);
  await summary.getByRole('button', { name: 'Xem thẻ' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Thẻ khoa học' })).toBeVisible();
  await page.getByRole('button', { name: 'Đóng sổ' }).click();

  // The measuring tools left the stage tool bar for the tray.
  const toolbar = page.getByRole('toolbar', { name: 'Công cụ mô phỏng' });
  await expect(toolbar.getByRole('button', { name: /^Thước/ })).toHaveCount(0);
  const ruler = tray.getByRole('switch', { name: 'Thước đo' });
  await ruler.click();
  await expect(ruler).toHaveAttribute('aria-checked', 'true');
  await ruler.click();
  await expect(ruler).toHaveAttribute('aria-checked', 'false');

  // D2: pin the run, then unpin it.
  const edge = page.getByRole('group', { name: 'Điều khiển thời gian' });
  await edge.getByRole('button', { name: 'Chạy (Space)' }).click();
  await page.waitForTimeout(600);
  await edge.getByRole('button', { name: 'Ghim lần chạy này để so sánh' }).click();
  await expect(edge.getByRole('button', { name: 'Bỏ ghim so sánh' })).toBeVisible();
  await edge.getByRole('button', { name: 'Bỏ ghim so sánh' }).click();
  expect(errors).toEqual([]);
});

test('B2: "Chốt dự đoán" turns the main action into "Chạy để kiểm tra"', async ({ page }) => {
  await openTopic(page, 'Vật lý', 'Ném xiên');
  await expect(page.locator('.stage__hud-title')).toHaveText('Ném xiên', { timeout: 20_000 });
  await page.getByRole('tab', { name: 'Thử thách' }).click();
  const panel = page.getByRole('tabpanel', { name: 'Thử thách' });
  const lock = panel.getByRole('button', { name: 'Chốt dự đoán' });
  await expect(lock).toBeDisabled();
  await panel.getByRole('radio').first().click();
  await lock.click();
  await expect(panel.getByText('Đã chốt.', { exact: false })).toBeVisible();
  const edge = page.getByRole('group', { name: 'Điều khiển thời gian' });
  const check = edge.getByRole('button', { name: 'Chạy để kiểm tra' });
  await expect(check).toBeVisible();
  await check.click();
  // The run happened: the verdict is in the card and the main action is "Tạm dừng" or "Chạy" again.
  await expect(panel.locator('.learn-result')).toBeVisible();
  await expect(check).toHaveCount(0);
});
