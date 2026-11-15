import { expect, test, type Page } from '@playwright/test';
import { openTopic } from './nav';

/**
 * Chemistry checks written after PR #198 for the bench (tests/e2e/bench, no longer run), carried
 * over to the classic window, at 1366 × 768, 100 % and 140 %: Maxwell–Boltzmann's chart and its
 * sliders (#205 B7) and the periodic table (#205 B7). The bench put the chart beside the gas box
 * (its notebook was closed); the classic window shows it once, in the bottom panel (#263). The
 * sliders are in the Inspector here. (The crystal's 3D cell filling the stage is
 * in crystal.spec.ts.)
 */
const sideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function useFontScale(page: Page, fontScale: number) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript((scale) => {
    localStorage.setItem(
      'stemsim.settings',
      JSON.stringify({ state: { locale: 'vi', fontScale: scale }, version: 2 }),
    );
  }, fontScale);
}

for (const fontScale of [1, 1.4] as const) {
  test(`Maxwell–Boltzmann at ${String(fontScale * 100)} %: the box, the chart once in the bottom panel, sliders with a number box and − / +`, async ({
    page,
  }) => {
    await useFontScale(page, fontScale);
    await openTopic(page, 'Hóa học', 'Phân bố Maxwell–Boltzmann');
    const canvas = page.getByRole('region', { name: 'Khung mô phỏng' }).locator('canvas').first();
    const chart = page
      .getByRole('region', { name: 'Bảng đồ thị và lời giải' })
      .locator('.gas-bottom .chart');
    await expect(canvas).toBeVisible({ timeout: 20_000 });
    await expect(chart).toBeVisible();
    // One chart, not a second copy beside the box (#205 B7 split is bench-only).
    await expect(page.locator('.gas-split')).toHaveCount(0);
    const plot = await chart.boundingBox();
    expect(plot?.width ?? 0).toBeGreaterThanOrEqual(300);

    // The Inspector's sliders: number box and − / +. The bench drew − / + as 40 px targets; the
    // classic window's icon buttons are 30 px at 100 %, so their size is not checked here.
    const inspector = page.getByRole('complementary', { name: 'Bảng thuộc tính' });
    for (const name of ['Nhiệt độ T', 'Số hạt']) {
      await expect(inspector.getByRole('slider', { name })).toBeVisible();
      await expect(inspector.getByRole('textbox', { name })).toBeVisible();
      for (const b of [`Giảm ${name}`, `Tăng ${name}`]) {
        await expect(inspector.getByRole('button', { name: b })).toBeVisible();
      }
    }
    await inspector.getByRole('button', { name: 'Tăng Nhiệt độ T' }).click();
    await expect(inspector.getByRole('textbox', { name: 'Nhiệt độ T' })).toHaveValue('310');
    const field = inspector.getByRole('textbox', { name: 'Nhiệt độ T' });
    await field.fill('600');
    await expect(inspector.getByRole('slider', { name: 'Nhiệt độ T' })).toHaveValue('600');
    expect(await sideScroll(page)).toBe(0);
  });

  test(`the periodic table at ${String(fontScale * 100)} %: readable numbers, a full frame, a legend that points`, async ({
    page,
  }) => {
    await useFontScale(page, fontScale);
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

    // The table picks an element (no second element list beside it).
    await page.getByRole('gridcell', { name: /^26 Fe / }).click();
    await expect(page.getByRole('gridcell', { name: /^26 Fe / })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await sideScroll(page)).toBe(0);
  });
}
