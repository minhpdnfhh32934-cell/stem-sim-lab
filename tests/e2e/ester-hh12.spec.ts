import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

/**
 * HH12 Bài 1–2 (#255 round 4a): ethyl acetate and the isomers of C4H8O2 and C5H10O2 (tr. 7), the
 * yield of question 7 (tr. 9), tristearin and the trilinolein of question 9 (tr. 12).
 */
test('esters and fats: names, isomers, the yield of tr. 9, triglycerides', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Ester và chất béo');
  await expect(page.locator('.stage__hud-title')).toHaveText('Ester và chất béo', {
    timeout: 20_000,
  });
  await expect(page.locator('.ester-panel__name')).toHaveText('ethyl ethanoate (ethyl acetate)');
  await expect(
    page.getByRole('heading', { name: 'Các ester có công thức C₄H₈O₂: 4' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'C₅H₁₀O₂' }).click();
  await expect(
    page.getByRole('heading', { name: 'Các ester có công thức C₅H₁₀O₂: 9' }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('names.png') });

  await page.getByRole('radio', { name: 'Phản ứng của ester' }).click();
  await page.getByRole('button', { name: 'Câu 7 tr. 9: dầu chuối' }).click();
  // 15,2 g isoamyl alcohol is the limiting reagent: about 63 % of 22,45 g.
  await expect(page.locator('.ester-panel__yield')).toHaveText(/^63,0\d %$/);
  await page.screenshot({ path: testInfo.outputPath('reactions.png') });

  await page.getByRole('radio', { name: 'Chất béo' }).click();
  await expect(page.locator('.ester-panel__fat')).toHaveText('C₅₇H₁₁₀O₆');
  await page.getByRole('button', { name: 'Câu 9 tr. 12: trilinolein' }).click();
  await expect(page.locator('.ester-panel__fat')).toHaveText('C₅₇H₉₈O₆');
  await page.screenshot({ path: testInfo.outputPath('fats.png') });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
