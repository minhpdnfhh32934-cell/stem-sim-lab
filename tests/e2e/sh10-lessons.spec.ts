import { expect, test, type Page } from '@playwright/test';
import { openTopic } from './nav';

/**
 * SH10 KNTT Bài 4 and Bài 21 (#255 round 1g), opened from the classic library: numbers come from
 * data/cell_elements.json (SGK H 4.1, NIST) and from the textbook formula Nₜ = N₀ × 2ⁿ.
 */
function watch(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test('Các nguyên tố hóa học và nước: figure 4.1, then water’s heat numbers', async ({ page }) => {
  const errors = watch(page);
  await openTopic(page, 'Sinh học', 'Các nguyên tố hóa học và nước');
  const stage = page.locator('section.stage--module');
  await expect(stage.getByText('C + H + O + N = 96%')).toBeVisible({ timeout: 20_000 });
  await expect(stage.getByRole('button', { name: /Oxygen \(O\)\s*65%/ })).toBeVisible();
  await expect(stage.locator('.el-bar')).toHaveCount(8);
  await expect(page.locator('.science-card')).toBeVisible();
  const panel = page.getByRole('complementary', { name: 'Bảng thuộc tính' });
  await stage.getByRole('button', { name: /Các nguyên tố vi lượng/ }).click();
  await expect(panel.getByText(/bướu cổ/)).toBeVisible();
  await noSideScroll(page);

  await stage.getByRole('radio', { name: 'Nước' }).click();
  await expect(page.getByTestId('water-q1')).toContainText('418,4 J');
  await expect(page.getByTestId('water-equivalent')).toContainText('584 g');
  await panel.getByRole('textbox', { name: 'Tăng nhiệt độ ΔT' }).fill('10');
  await panel.getByRole('textbox', { name: 'Tăng nhiệt độ ΔT' }).press('Enter');
  await expect(page.getByTestId('water-q1')).toContainText('4.184 J');
  await expect(page.locator('.science-card')).toContainText('NIST');
  await noSideScroll(page);
  expect(errors).toEqual([]);
});

test('Sinh trưởng của quần thể vi khuẩn: Nₜ = N₀ × 2ⁿ, the book’s examples, four phases', async ({
  page,
}) => {
  const errors = watch(page);
  await openTopic(page, 'Sinh học', 'Sinh trưởng của quần thể vi khuẩn');
  await expect(page.getByTestId('mg-n')).toContainText('n = t/g = 180/20 = 9', {
    timeout: 20_000,
  });
  await expect(page.getByTestId('mg-nt')).toContainText('51.200 tế bào');
  await expect(page.locator('.science-card')).toContainText(/chính xác/);
  const panel = page.getByRole('complementary', { name: 'Bảng thuộc tính' });
  await panel.getByRole('button', { name: /Vi khuẩn lao/ }).click();
  await expect(page.getByTestId('mg-n')).toContainText('= 0,25');
  await panel.getByRole('textbox', { name: 'Thời gian nuôi t' }).fill('1440');
  await panel.getByRole('textbox', { name: 'Thời gian nuôi t' }).press('Enter');
  await expect(page.getByTestId('mg-nt')).toContainText('= 400 tế bào');
  await noSideScroll(page);

  const stage = page.locator('section.stage--module');
  await stage.getByRole('radio', { name: 'Bốn pha (minh họa)' }).click();
  await expect(
    stage.getByRole('img', { name: /Hình minh họa đường cong sinh trưởng/ }),
  ).toBeVisible();
  await expect(stage.getByText('Định tính', { exact: true })).toBeVisible();
  await stage.getByRole('button', { name: 'Pha cân bằng' }).click();
  await expect(stage.getByText(/Số tế bào sinh ra bằng số tế bào chết đi/)).toBeVisible();
  await expect(page.locator('.science-card')).toContainText('Định tính');
  await noSideScroll(page);
  expect(errors).toEqual([]);
});
