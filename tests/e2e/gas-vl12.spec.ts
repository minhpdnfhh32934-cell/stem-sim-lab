import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

/**
 * VL12 Bài 9–12 (#255 round 3b): the lesson opens on the pump of tr. 45–46 (5,2·10⁵ Pa), loads the
 * book's Boyle questions (8 L, 1,92·10⁵ Pa), shows Bảng 9.1 and 10.1, and the molecules' speeds.
 */
test('ideal gas laws: the pump of tr. 45, the questions of tr. 39–40, the tables, the molecules', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Vật lý', 'Các định luật của khí lí tưởng');
  await expect(page.locator('.stage__hud-title')).toHaveText('Các định luật của khí lí tưởng', {
    timeout: 20_000,
  });
  const answer = page.locator('.gas-panel__answer');
  // p₂ = 10⁵ · 100 · 312 / (20 · 300) = 5,2·10⁵ Pa.
  await expect(answer).toHaveText('5,2·10⁵ Pa');
  await expect(
    page.getByRole('img', { name: /trạng thái 2 \(5,2·10⁵ Pa, 0,02 L, 312 K\)/ }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('process.png') });

  await page.getByRole('button', { name: 'Ví dụ tr. 39' }).click();
  await expect(answer).toHaveText('8 L');
  await page.getByRole('button', { name: 'Câu 1 tr. 40' }).click();
  await expect(answer).toHaveText('1,92·10⁵ Pa');
  await page.getByRole('radio', { name: 'Đẳng áp' }).click();
  await expect(page.getByRole('radio', { name: 'Tìm V₂' })).toBeChecked();

  await page.getByRole('radio', { name: 'Thí nghiệm SGK' }).click();
  await expect(page.getByRole('img', { name: /Bảng 9.1: pV trung bình 0,296 J/ })).toBeVisible();
  await page.getByRole('radio', { name: 'Bảng 10.1 (đẳng áp)' }).click();
  await expect(page.getByRole('img', { name: /Bảng 10.1: V\/T trung bình/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('data.png') });

  // √(v̄²) = √(3RT/M): oxygen at 273 K ≈ 461 m/s, nitrogen ≈ 493 m/s.
  await page.getByRole('radio', { name: 'Phân tử khí' }).click();
  await expect(page.locator('.gas-panel__speed')).toHaveText('461 m/s');
  await page.getByRole('radio', { name: 'Nitrogen (N₂)' }).click();
  await expect(page.locator('.gas-panel__speed')).toHaveText('493 m/s');
  await page.screenshot({ path: testInfo.outputPath('molecules.png') });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
