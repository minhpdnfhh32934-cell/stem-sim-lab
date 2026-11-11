import { expect, test, type Page } from '@playwright/test';
import { openLab } from '../nav';

// Bench twin of tests/e2e/fourier.spec.ts (0.8.1 B8: same titles, the same checks on the bench
// shell; scripts/e2e/title-parity.mjs).

test.use({ viewport: { width: 1366, height: 768 } });

/**
 * What layout.spec.ts checks for the engine graphs, for this lesson's own view (it has no graph
 * tab and no Run, so that test leaves it out): the figure is readable inside the window, nothing
 * scrolls sideways, and a harmonics table taller than its panel says so with the scroll cue.
 */
async function readableAt1366(page: Page, figure: string): Promise<void> {
  const box = await page.getByRole('img', { name: figure }).boundingBox();
  expect(box?.height ?? 0, `${figure}: figure height`).toBeGreaterThanOrEqual(80);
  expect((box?.y ?? 0) + (box?.height ?? 0), `${figure}: inside the window`).toBeLessThanOrEqual(
    768,
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${figure}: horizontal scroll`).toBeLessThanOrEqual(0);
  const scroll = page.locator('.notebook .panel__scroll');
  if (await scroll.evaluate((el) => el.scrollHeight > el.clientHeight + 1))
    await expect(scroll).toHaveAttribute('data-more-below', '');
}

/** Harmonics and Fourier series (#54 item 10): the sum, its harmonics, "Nghe" only on a press. */
test('Fourier: the sum follows N, the harmonics table, "Nghe" starts and stops on a press', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openLab(page);
  await page.getByRole('radio', { name: 'Vật lý' }).click();
  await page.getByRole('button', { name: 'Hoạ âm và chuỗi Fourier', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Sóng vuông: tổng 5 hoạ âm' })).toBeVisible({
    timeout: 20_000,
  });
  // Nothing plays before the learner asks.
  const listen = page.getByRole('button', { name: 'Nghe', exact: true });
  await expect(listen).toHaveAttribute('aria-pressed', 'false');
  // Square wave: odd harmonics only, 1, 3, 5 for N = 5. The bench keeps the lesson's bottom panel
  // in its notebook, as the tab "Các hoạ âm" (closed until the learner opens it).
  await page.getByRole('tab', { name: 'Các hoạ âm' }).click();
  const rows = page.locator('.fourier-table tbody tr');
  await expect(rows).toHaveCount(3);
  await readableAt1366(page, 'Sóng vuông: tổng 5 hoạ âm');
  await page.getByRole('radio', { name: 'Sóng răng cưa' }).click();
  await expect(rows).toHaveCount(5);
  await expect(page.getByRole('img', { name: 'Sóng răng cưa: tổng 5 hoạ âm' })).toBeVisible();
  await readableAt1366(page, 'Sóng răng cưa: tổng 5 hoạ âm');
  await listen.click();
  await expect(page.getByRole('button', { name: 'Dừng nghe' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Dừng nghe' }).click();
  await expect(listen).toHaveAttribute('aria-pressed', 'false');
  // The link to the standing-wave lesson.
  await page.getByRole('button', { name: 'Hoạ âm của dây đàn: mở bài Sóng dừng trên dây' }).click();
  await expect(page.locator('.stage__hud-title')).toHaveText('Sóng dừng trên dây', {
    timeout: 20_000,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
