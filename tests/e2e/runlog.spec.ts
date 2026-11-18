import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

/**
 * #195 step 4, "Sổ ghi": each stop of a physics run adds a row with the lesson's own answers (the
 * same numbers as the Lời giải tab); a new value is a new row; "Xóa sổ" empties it.
 */
test('Sổ ghi: a row per run, with the same answers as Lời giải', async ({ page }) => {
  await openTopic(page, 'Vật lý', 'Ném xiên');
  await expect(page.locator('.stage__hud-title')).toHaveText('Ném xiên', { timeout: 20_000 });
  const run = page.getByRole('button', { name: 'Chạy (Space)' }).first();
  const pause = page.getByRole('button', { name: 'Tạm dừng (Space)' }).first();

  await page.getByRole('tab', { name: 'Sổ ghi' }).click();
  const panel = page.getByRole('tabpanel', { name: 'Sổ ghi' });
  await expect(panel.getByText(/Chưa có lần chạy nào/)).toBeVisible();

  await run.click();
  await page.waitForTimeout(400);
  await pause.click();
  const rows = panel.locator('tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Mặc định');

  // The first answer of Lời giải is in the row, written the same way.
  await page.getByRole('tab', { name: 'Lời giải' }).click();
  const first = (await page.locator('.solution__value').first().textContent())?.trim() ?? '';
  expect(first).not.toBe('');
  await page.getByRole('tab', { name: 'Sổ ghi' }).click();
  await expect(rows.first()).toContainText(first);

  // A new initial speed, a new run: a second row on top, naming the changed value.
  await page.getByRole('slider', { name: /Vận tốc ban đầu/ }).fill('20');
  await run.click();
  await page.waitForTimeout(400);
  await pause.click();
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('Vận tốc ban đầu');
  await expect(rows.first()).toContainText('20 m/s');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await panel.getByRole('button', { name: 'Xóa sổ' }).click();
  await expect(panel.getByText(/Chưa có lần chạy nào/)).toBeVisible();
});

test('the five bottom tabs fit in one row at 140 % text, Advanced mode (#195)', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const saved = JSON.parse(localStorage.getItem('stemsim.settings') ?? '{}') as {
      state?: Record<string, unknown>;
      version?: number;
    };
    localStorage.setItem(
      'stemsim.settings',
      JSON.stringify({
        version: saved.version ?? 3,
        state: { ...saved.state, fontScale: 1.4, uiMode: 'advanced' },
      }),
    );
  });
  await openTopic(page, 'Vật lý', 'Ném xiên');
  const list = page.getByRole('region', { name: 'Bảng đồ thị và lời giải' }).getByRole('tablist');
  await expect(list.getByRole('tab')).toHaveCount(5);
  const fits = await list.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
  expect(fits).toBe(true);
  for (const tab of await list.getByRole('tab').all()) await expect(tab).toBeInViewport();
});
