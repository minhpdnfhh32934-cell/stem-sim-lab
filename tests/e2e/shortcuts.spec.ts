import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

/** #195 step 1: Ctrl+/ opens Settings on the shortcut list; while typing it stays the field's. */
test('Ctrl+/ opens the shortcut list, but not from the problem box', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openTopic(page, 'Vật lý', 'Cường độ dòng điện');
  const settings = page.getByRole('dialog', { name: 'Cài đặt' });

  await page.locator('#problem-text').fill('Một vật rơi từ độ cao 20 m');
  await page.keyboard.press('Control+/');
  await expect(settings).toHaveCount(0);

  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+/');
  await expect(settings).toBeVisible();
  const row = settings.locator('.shortcut-list__row', { hasText: 'Mở danh sách phím tắt này' });
  await expect(row.locator('kbd')).toHaveText('Ctrl + /');
  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
});
