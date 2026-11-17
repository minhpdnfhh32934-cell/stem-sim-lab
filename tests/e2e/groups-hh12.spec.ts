import { expect, test, type Page } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

async function open(page: Page, name: string) {
  await openTopic(page, 'Hóa học', name);
  await expect(page.locator('.stage__hud-title')).toHaveText(name, { timeout: 20_000 });
}

/**
 * HH12 Bài 24, 25, 27 (#255 round 4e): trends of Bảng 24.1 and 25.1, Bảng 25.4 from the
 * solubilities, the thermal stability of carbonates, Bảng 27.2, Fe²⁺ (tr. 131) and the titration
 * of tr. 132.
 */
test('groups IA and IIA: trends, solubility, thermal stability', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await open(page, 'Nguyên tố nhóm IA');
  await expect(page.locator('.groups-view__head')).toHaveText(
    'Bán kính nguyên tử: tăng dần từ Li đến Cs',
  );
  await expect(page.locator('.bar-list__row')).toHaveCount(5);
  await page.screenshot({ path: testInfo.outputPath('ia.png') });

  await open(page, 'Nguyên tố nhóm IIA');
  await page.getByRole('radio', { name: 'Độ tan' }).click();
  await expect(page.locator('.groups-solubility__verdict')).toContainText('ít tan');
  await page.getByRole('button', { name: /0,0028/ }).click();
  await expect(page.locator('.groups-solubility__verdict')).toContainText('không tan');
  await page.screenshot({ path: testInfo.outputPath('iia-solubility.png') });
  await page.getByRole('radio', { name: 'Độ bền nhiệt' }).click();
  await expect(page.locator('.groups-view__head')).toContainText('tăng dần từ Mg đến Ba');
  await page.screenshot({ path: testInfo.outputPath('iia-thermal.png') });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('first-row transition metals: Be line, Fe²⁺, the FeSO₄ titration', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await open(page, 'Đại cương về kim loại chuyển tiếp dãy thứ nhất');
  await expect(page.locator('.bar-list__row--strong')).toHaveCount(7);
  await page.screenshot({ path: testInfo.outputPath('tm-mp.png') });

  await page.getByRole('radio', { name: 'Ion và số oxi hóa' }).click();
  await expect(page.locator('.groups-ion__result')).toHaveText('Fe²⁺: [Ar]3d⁶');
  await page.getByRole('radio', { name: '3+' }).click();
  await expect(page.locator('.groups-ion__result')).toHaveText('Fe³⁺: [Ar]3d⁵');

  await page.getByRole('radio', { name: 'Chuẩn độ FeSO₄' }).click();
  await expect(page.locator('.groups-steps__result')).toContainText('0,1 M');
  await page.screenshot({ path: testInfo.outputPath('tm-titration.png') });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
