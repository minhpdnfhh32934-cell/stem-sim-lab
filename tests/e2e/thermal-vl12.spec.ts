import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

/**
 * VL12 Bài 2–6 (#255 round 3a): the heating curve opens on question 2, tr. 24 (2 kg of copper from
 * 30 °C, 20 000 W at 50 %: about 116 s to melt it all), then the temperature scales and ΔU = A + Q.
 */
test('internal energy and heat: the copper of tr. 24, 270 °C in kelvins, the first law', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Vật lý', 'Nội năng, nhiệt độ và nhiệt lượng');
  await expect(page.locator('.stage__hud-title')).toHaveText('Nội năng, nhiệt độ và nhiệt lượng', {
    timeout: 20_000,
  });
  // Q = 2·380·(1 084 − 30) + 2·1,8·10⁵ J = 1,161 MJ; at 10 kW: 80,1 s heating, then 36 s melting.
  await expect(
    page.getByRole('img', { name: /Đun nóng thể rắn 80,1 s, Nóng chảy 36 s/ }),
  ).toBeVisible();
  const inspector = page.locator('.thermal-panel__facts').first();
  await expect(inspector).toContainText('1,161 MJ');
  await expect(inspector).toContainText('116,1 s');
  // The book's tables are in the bottom panel.
  await expect(page.getByText('Bảng 4.1, 5.1, 6.1 (SGK)')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('heat.png') });

  // Bài 3: T = t + 273,15.
  await page.getByRole('radio', { name: 'Thang nhiệt độ' }).click();
  await page.getByRole('textbox', { name: 'Nhiệt độ', exact: true }).fill('270');
  await expect(page.getByRole('img', { name: /270 °C = 543,15 K/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('scale.png') });

  // Bài 2: the body receives 300 J of work and gives away 100 J of heat.
  await page.getByRole('radio', { name: 'Định luật I' }).click();
  await expect(page.getByRole('img', { name: /= 200 J$/ })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
