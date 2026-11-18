import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

/** HH11 Bài 4–8 (#255 round 2d): the oxidation-number axes of the book's activity (tr. 30, 43). */
test('nitrogen and sulfur: the axis of tr. 30, a compound placed by the learner, the reactions', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Nitrogen và sulfur');
  await expect(page.locator('.stage__hud-title')).toHaveText('Nitrogen và sulfur', {
    timeout: 20_000,
  });
  const axis = page.getByRole('list', { name: 'Trục số oxi hóa của N' });
  await expect(axis.getByRole('listitem')).toHaveCount(10);
  await expect(axis.getByRole('listitem', { name: /NH₃: N −3/ })).toBeVisible();
  await expect(axis.getByRole('listitem', { name: /HNO₃: N \+5/ })).toBeVisible();
  // A compound the learner adds: N₂O₅ goes to +5; NH₄NO₃ is refused with the reason.
  const box = page.getByRole('textbox', { name: 'Đặt thêm một chất lên trục' });
  await box.fill('N2O5');
  await page.getByRole('button', { name: 'Đặt lên trục' }).click();
  await expect(axis.getByRole('listitem', { name: /N₂O₅: N \+5/ })).toBeVisible();
  await box.fill('NH4NO3');
  await page.getByRole('button', { name: 'Đặt lên trục' }).click();
  await expect(page.getByText(/NH₄NO₃: N được viết ở hai nhóm nguyên tử/)).toBeVisible();
  // The reactions table: Haber, with ΔrH° = −91,8 kJ and N₂ the oxidising agent.
  await expect(page.getByText('-91,8 kJ').or(page.getByText('−91,8 kJ'))).toBeVisible();
  await page.getByRole('radio', { name: 'Sulfur' }).click();
  await expect(
    page.getByRole('list', { name: 'Trục số oxi hóa của S' }).getByRole('listitem', {
      name: /SO₂: S \+4/,
    }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
