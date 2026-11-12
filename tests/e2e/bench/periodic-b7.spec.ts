import { expect, test } from '@playwright/test';
import { openTopic } from '../nav';

/**
 * #205 B7, the periodic table at 1366 × 768, 100 % and 140 %: atomic and group numbers at the A1
 * floor (12 px × Cỡ chữ); the table fills the frame; a legend entry, pressed, outlines its cells
 * and dims the others (not by colour alone); the edge keeps its stepper only.
 */
for (const fontScale of [1, 1.4] as const) {
  test(`the periodic table at ${String(fontScale * 100)} %: readable numbers, a full frame, a legend that points`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript((scale) => {
      localStorage.setItem(
        'stemsim.settings',
        JSON.stringify({ state: { locale: 'vi', fontScale: scale }, version: 2 }),
      );
    }, fontScale);
    await openTopic(page, 'Hóa học', 'Bảng tuần hoàn');
    const grid = page.getByRole('grid', { name: 'Bảng tuần hoàn' });
    await expect(grid).toBeVisible({ timeout: 20_000 });

    const sizes = await page.evaluate(() => ({
      z: parseFloat(getComputedStyle(document.querySelector('.pt-cell__z') as Element).fontSize),
      group: parseFloat(getComputedStyle(document.querySelector('.pt__group') as Element).fontSize),
    }));
    expect(sizes.z).toBeGreaterThanOrEqual(12 * fontScale - 0.05);
    expect(sizes.group).toBeGreaterThanOrEqual(12 * fontScale - 0.05);

    // The table takes most of the frame's height (it used about half of it at 100 %).
    if (fontScale === 1) {
      const room = await page.locator('.pt').evaluate((el) => {
        const g = el.querySelector('.pt__grid') as HTMLElement;
        return g.getBoundingClientRect().height / el.clientHeight;
      });
      expect(room).toBeGreaterThanOrEqual(0.7);
    }

    // "Khí hiếm" pressed: the noble gases outlined, the rest dimmed; pressed again, all back.
    const noble = page.getByRole('button', { name: 'Khí hiếm' });
    await noble.click();
    await expect(noble).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('gridcell', { name: /^10 Ne / })).toHaveClass(/is-lit/);
    await expect(page.getByRole('gridcell', { name: /^26 Fe / })).toHaveClass(/is-dim/);
    await noble.click();
    await expect(noble).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.pt-cell.is-dim')).toHaveCount(0);
    const target = await noble.boundingBox();
    expect(target?.height ?? 0).toBeGreaterThanOrEqual(40);

    // The edge: the stepper, no second element list.
    const stepper = page.getByRole('group', { name: 'Chọn nguyên tố' });
    await expect(stepper.getByRole('combobox')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
  });
}
