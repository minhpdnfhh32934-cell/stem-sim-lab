import { expect, test, type Page } from '@playwright/test';
import { openLab } from '../nav';

/**
 * #205 B4, the bench at 1366 × 768, 100 % and 140 %: the edge's readout never runs onto the
 * scrubber; "Tạm dừng" stays on one line in its 144 px; the confidence is the edge's chip only
 * (the tray does not repeat it); the stage's corner notes are at least the A1 floor (12 px × Cỡ
 * chữ).
 */
async function open(page: Page, fontScale: number, subject: string, topic: string) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript((scale) => {
    localStorage.setItem(
      'stemsim.settings',
      JSON.stringify({ state: { locale: 'vi', fontScale: scale }, version: 2 }),
    );
  }, fontScale);
  await openLab(page);
  await page.getByRole('radio', { name: subject }).click();
  await page.getByRole('main').getByRole('button', { name: topic, exact: true }).click();
  await expect(page.locator('.science-card__summary-title')).toBeVisible({ timeout: 20_000 });
}

const lineCount = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
  });

for (const fontScale of [1, 1.4] as const) {
  test(`physics at ${String(fontScale * 100)} %: the readout clear of the scrubber, one confidence chip, notes ≥ 12 px`, async ({
    page,
  }) => {
    await open(page, fontScale, 'Vật lý', 'Ném xiên');
    const readout = page.locator('.bench-edge__readout');
    await expect(readout).toHaveText(/^t = /);
    const r = await readout.evaluate((el) => ({
      fits: el.scrollWidth <= el.clientWidth,
      right: el.getBoundingClientRect().right,
    }));
    expect(r.fits).toBe(true);
    const scrub = await page.locator('.bench-edge__scrubber').boundingBox();
    expect(r.right).toBeLessThanOrEqual(scrub?.x ?? 0);

    // The confidence: on the edge, not in the tray as well.
    await expect(page.locator('.bench-chip')).toContainText('Định lượng chính xác');
    const tray = page.getByRole('complementary', { name: 'Điều chỉnh (bảng thuộc tính)' });
    await expect(tray.getByText('Định lượng chính xác')).toHaveCount(0);

    // Text over the stage (title, time, notes): at least 12 px × Cỡ chữ.
    const smallest = await page.locator('.stage').evaluate((stage) => {
      let min = Infinity;
      for (const el of stage.querySelectorAll<HTMLElement>('*')) {
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
        if (!own || el.getClientRects().length === 0) continue;
        min = Math.min(min, parseFloat(getComputedStyle(el).fontSize));
      }
      return min;
    });
    expect(smallest).toBeGreaterThanOrEqual(12 * fontScale - 0.01);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
  });

  test(`a running particle lesson at ${String(fontScale * 100)} %: "Tạm dừng" on one line`, async ({
    page,
  }) => {
    await open(page, fontScale, 'Hóa học', 'Phân bố Maxwell–Boltzmann');
    await expect(page.locator('.bench-play')).toHaveText('Tạm dừng');
    expect(await lineCount(page, '.bench-play__label')).toBe(1);
    const box = await page.locator('.bench-play').boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(144);
  });
}
