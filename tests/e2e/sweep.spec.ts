import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

/**
 * #195 step 5, "Quét tham số" (Advanced): the range of an oblique throw at 45° against v₀. Each
 * point is the lesson's solve(): L = v₀²/g with g = 9,8 m/s², so v₀ = 20 m/s gives 40,82 m.
 */
test('Quét tham số: range against initial speed, each point from the lesson', async ({ page }) => {
  await openTopic(page, 'Vật lý', 'Ném xiên');
  await expect(page.locator('.stage__hud-title')).toHaveText('Ném xiên', { timeout: 20_000 });
  const tabs = page.getByRole('region', { name: 'Bảng đồ thị và lời giải' }).getByRole('tablist');
  // Basic mode has no sweep.
  await expect(tabs.getByRole('tab', { name: 'Quét tham số' })).toHaveCount(0);
  await page.evaluate(async () => {
    const { useSettingsStore } = (await (async (m: string) =>
      import(/* @vite-ignore */ m) as Promise<Record<string, unknown>>)(
      '/src/app/settings/settingsStore.ts',
    )) as { useSettingsStore: { getState(): { setUiMode(m: 'advanced'): void } } };
    useSettingsStore.getState().setUiMode('advanced');
  });
  await tabs.getByRole('tab', { name: 'Quét tham số' }).click();
  const panel = page.getByRole('tabpanel', { name: 'Quét tham số' });

  await panel
    .getByRole('combobox', { name: 'Thông số thay đổi' })
    .selectOption({ label: 'Vận tốc ban đầu' });
  await panel.getByRole('textbox', { name: 'Từ' }).fill('5');
  await panel.getByRole('textbox', { name: 'Từ' }).press('Tab');
  await panel.getByRole('textbox', { name: 'Đến' }).fill('25');
  await panel.getByRole('textbox', { name: 'Đến' }).press('Tab');
  await panel.getByRole('textbox', { name: 'Số điểm' }).fill('5');
  await panel.getByRole('textbox', { name: 'Số điểm' }).press('Tab');
  await panel.getByRole('combobox', { name: 'Đáp số cần xem' }).selectOption({ label: 'Tầm xa' });
  await panel.getByRole('button', { name: 'Quét', exact: true }).click();

  const result = panel.getByRole('region', { name: 'Kết quả quét' });
  await expect(result.locator('canvas').first()).toBeVisible();
  await result.getByText('Bảng số').click();
  const rows = result.locator('.sweep__table tbody tr');
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(3)).toContainText('20');
  await expect(rows.nth(3)).toContainText('40,82');
  await expect(result.getByText(/Bỏ \d+ điểm/)).toHaveCount(0);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
