import { expect, test, type Page } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

async function noScrollNoErrors(page: Page, errors: string[]) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
}

/** VL12 Bài 21–22 (#255 round 3d): radii, the question of tr. 97, He-4's binding energy, 1 kg of U-235. */
test('nucleus: gold’s radius, X and Y of tr. 97, He-4, fission of 1 kg', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Vật lý', 'Hạt nhân và năng lượng liên kết');
  await expect(page.locator('.stage__hud-title')).toHaveText('Hạt nhân và năng lượng liên kết', {
    timeout: 20_000,
  });
  // Gold, A = 197: R = 1,2·197^(1/3) ≈ 6,98·10⁻¹⁵ m; Bảng 21.1 prints 5,4·10⁻¹⁵ m.
  await expect(page.locator('.nuclear-panel__radius')).toHaveText('6,98·10⁻¹⁵ m');
  await expect(
    page.getByRole('img', { name: /Bảng 21.1 5,4·10⁻¹⁵ m, công thức 6,98/ }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('structure.png') });

  await page.getByRole('radio', { name: 'Phản ứng hạt nhân' }).click();
  await page.getByRole('radio', { name: 'Câu hỏi tr. 97: tìm X, Y' }).click();
  await expect(
    page.getByRole('img', { name: /²³⁶₉₂U → ⁹⁹₄₂Mo \+ 3 ¹₀n \+ ¹³⁴₅₀Sn/ }),
  ).toBeVisible();

  await page.getByRole('radio', { name: 'Năng lượng liên kết' }).click();
  // Δm = 4,03188 − 4,00260 = 0,02928 amu; × 931,49 MeV ≈ 27,27 MeV.
  await expect(page.locator('.nuclear-panel__defect')).toHaveText('0,02928 amu');
  await expect(page.locator('.nuclear-panel__binding')).toHaveText('27,27 MeV');
  await expect(page.locator('.nuclear-panel__fission')).toHaveText('8,21·10¹³ J');
  await page.screenshot({ path: testInfo.outputPath('binding.png') });
  await noScrollNoErrors(page, errors);
});

/** VL12 Bài 23: Rn-220, O-15 (tr. 108), F-18 (tr. 109), randomness, the inverse square of tr. 112. */
test('radioactivity: Rn-220, the half-life of O-15, F-18 after a day, a quarter of the dose', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Vật lý', 'Hiện tượng phóng xạ');
  await expect(page.locator('.stage__hud-title')).toHaveText('Hiện tượng phóng xạ', {
    timeout: 20_000,
  });
  // T = 55 s, t = 110 s: a quarter left. 25 % left after 244 s: T = 122 s.
  await expect(page.locator('.nuclear-panel__left')).toHaveText('25 %');
  await expect(page.locator('.nuclear-panel__found')).toHaveText('122 s');
  await page.screenshot({ path: testInfo.outputPath('law.png') });
  await page.getByRole('button', { name: 'F-18 (tr. 109)' }).click();
  await expect(page.locator('.nuclear-panel__left')).toHaveText('0,011 %');

  await page.getByRole('radio', { name: 'Tính ngẫu nhiên' }).click();
  await expect(page.getByRole('img', { name: /Minh họa ngẫu nhiên: 200 hạt nhân/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('random.png') });
  await page.getByRole('radio', { name: 'An toàn phóng xạ' }).click();
  await expect(page.locator('.nuclear-panel__dose')).toHaveText('0,25');
  await page.screenshot({ path: testInfo.outputPath('safety.png') });
  await noScrollNoErrors(page, errors);
});
