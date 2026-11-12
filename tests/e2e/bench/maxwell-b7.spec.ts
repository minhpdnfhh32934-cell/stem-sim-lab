import { expect, test } from '@playwright/test';
import { openTopic } from '../nav';

/**
 * #205 B7, Maxwell–Boltzmann at 1366 × 768, 100 % and 140 %: the speed distribution beside the
 * gas box (no notebook to open); every slider of the tray has its number box and − / + (40 px),
 * as in the physics lessons.
 */
for (const fontScale of [1, 1.4] as const) {
  test(`Maxwell–Boltzmann at ${String(fontScale * 100)} %: the chart beside the box, sliders with a number box and − / +`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript((scale) => {
      localStorage.setItem(
        'stemsim.settings',
        JSON.stringify({ state: { locale: 'vi', fontScale: scale }, version: 2 }),
      );
    }, fontScale);
    await openTopic(page, 'Hóa học', 'Phân bố Maxwell–Boltzmann');
    const canvas = page.locator('.gas-split__box canvas');
    const chart = page.locator('.gas-split__chart .chart');
    await expect(canvas).toBeVisible({ timeout: 20_000 });
    await expect(chart).toBeVisible();
    const box = await canvas.boundingBox();
    const plot = await chart.boundingBox();
    // Side by side, both of a useful size.
    expect(plot?.x ?? 0).toBeGreaterThanOrEqual((box?.x ?? 0) + (box?.width ?? 0) - 1);
    expect(plot?.width ?? 0).toBeGreaterThanOrEqual(300);
    expect(plot?.height ?? 0).toBeGreaterThanOrEqual(200);

    // The tray's sliders: number box and − / +.
    const tray = page.getByRole('complementary', { name: 'Điều chỉnh (bảng thuộc tính)' });
    for (const name of ['Nhiệt độ T', 'Số hạt']) {
      await expect(tray.getByRole('slider', { name })).toBeVisible();
      await expect(tray.getByRole('textbox', { name })).toBeVisible();
      for (const b of [`Giảm ${name}`, `Tăng ${name}`]) {
        const r = await tray.getByRole('button', { name: b }).boundingBox();
        expect(Math.min(r?.width ?? 0, r?.height ?? 0)).toBeGreaterThanOrEqual(40);
      }
    }
    await tray.getByRole('button', { name: 'Tăng Nhiệt độ T' }).click();
    await expect(tray.getByRole('textbox', { name: 'Nhiệt độ T' })).toHaveValue('310');
    const field = tray.getByRole('textbox', { name: 'Nhiệt độ T' });
    await field.fill('600');
    await expect(tray.getByRole('slider', { name: 'Nhiệt độ T' })).toHaveValue('600');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
  });
}
