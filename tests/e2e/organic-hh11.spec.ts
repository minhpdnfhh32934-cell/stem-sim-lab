import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

/** HH11 Bài 10, 12, 13 (#255 round 2e): eugenol's formula from the book's question 3 (tr. 73). */
test('organic basics: eugenol 73,17 % C, 7,31 % H, M = 164 gives C₁₀H₁₂O₂; the isomers of tr. 76', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Nhóm chức, công thức phân tử, đồng phân');
  await expect(page.locator('.stage__hud-title')).toHaveText('Đại cương về hóa học hữu cơ', {
    timeout: 20_000,
  });
  await expect(
    page.getByRole('img', { name: 'Vùng số sóng hấp thụ đặc trưng của các nhóm chức (Bảng 10.2)' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'Lập công thức (Bài 12)' }).click();
  await page.getByRole('button', { name: /^Eugenol/ }).click();
  await expect(page.locator('.organic-steps__answer')).toHaveText('C₁₀H₁₂O₂');
  await page.getByRole('radio', { name: 'Đồng phân (Bài 13)' }).click();
  await expect(page.locator('.organic-isomer figcaption')).toHaveText([
    'propanal',
    'acetone',
    'allyl alcohol',
    'methyl vinyl ether',
  ]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
