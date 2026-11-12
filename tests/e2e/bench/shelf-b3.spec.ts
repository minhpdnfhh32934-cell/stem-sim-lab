import { expect, test, type Locator, type Page } from '@playwright/test';
import { openLab } from '../nav';

/**
 * #205 B3, the lab's home page ("Kệ bài") at 1366 × 768, 100 % and 140 %: the "Tiếp tục" card's
 * title on one line; one place to type a problem (the "Có đề bài?" card; the header's "Đề bài"
 * only in a lesson); the topic cards' second line at least 13 px and 500 weight.
 */
const lines = (loc: Locator) =>
  loc.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
  });

async function openShelf(page: Page, fontScale: number) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript((scale) => {
    localStorage.setItem(
      'stemsim.settings',
      JSON.stringify({ state: { locale: 'vi', fontScale: scale }, version: 2 }),
    );
    localStorage.setItem(
      'stemsim.profile',
      JSON.stringify({
        state: { level: 'foundation', grade: 'all', interests: [], lastTopic: 'obliqueProjectile' },
        version: 2,
      }),
    );
  }, fontScale);
  await openLab(page);
}

for (const fontScale of [1, 1.4] as const) {
  test(`the shelf at ${String(fontScale * 100)} %: "Tiếp tục" on one line, one problem box, readable card lines`, async ({
    page,
  }) => {
    await openShelf(page, fontScale);
    const resume = page.getByRole('heading', { name: 'Tiếp tục bài đang học' });
    await expect(resume).toBeVisible();
    expect(await lines(resume)).toBe(1);

    // Nothing in the two start cards pushes past their edge (the field and "Kết nối AI…" did at
    // 140 %).
    for (const card of await page.locator('.shelf-start').all()) {
      const edge = await card.evaluate((el) => el.getBoundingClientRect().right);
      for (const child of await card.locator('button, h2, p').all()) {
        const right = await child.evaluate((el) => el.getBoundingClientRect().right);
        expect(right).toBeLessThanOrEqual(edge + 0.5);
      }
    }

    // No "Đề bài" in the header here: the "Có đề bài?" card is the one place.
    const header = page.locator('.bench-header');
    await expect(header.getByRole('button', { name: 'Đề bài', exact: true })).toHaveCount(0);
    const field = page.getByRole('button', { name: 'Gõ hoặc dán đề bài…' });
    await field.click();
    await expect(page.locator('#problem-text')).toBeVisible();
    await page.getByRole('button', { name: 'Đóng đề bài' }).click();
    await expect(page.locator('#problem-text')).toHaveCount(0);
    await expect(field).toBeFocused();

    // The cards' second line ("Có 1 bài có hướng dẫn", "Đã mở"…).
    const meta = page.locator('.shelf-card__meta').filter({ hasText: /\S/ }).first();
    await expect(meta).toBeVisible();
    const style = await meta.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight) };
    });
    expect(style.size).toBeGreaterThanOrEqual(13 * fontScale - 0.01);
    expect(style.weight).toBeGreaterThanOrEqual(500);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);

    // In a lesson the header has it.
    await page.getByRole('button', { name: 'Mở lại' }).click();
    await expect(header.getByRole('button', { name: 'Đề bài', exact: true })).toBeVisible({
      timeout: 20_000,
    });
  });
}
