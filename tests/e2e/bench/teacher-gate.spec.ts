import { expect, test, type Page } from '@playwright/test';

/**
 * AI Teacher's door follows one age rule everywhere (safetyStore `teacherLocked`, the launch
 * page's): answered "under 18", Ctrl+K offers no AI Teacher page (it used to open it while the
 * launch card was locked); 18 and over, both pages are offered and open.
 */

async function teacherCommands(page: Page) {
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Tìm nhanh' });
  await expect(palette).toBeVisible({ timeout: 20_000 });
  await palette.getByRole('combobox').fill('AI Teacher');
  return palette.getByRole('option', { name: /AI Teacher —/ });
}

test('under 18: the launch card is locked and Ctrl+K has no AI Teacher command', async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto('/');
  const onboarding = page.getByRole('dialog', { name: 'Bạn đang học hoặc ôn lớp nào?' });
  await expect(onboarding).toBeVisible({ timeout: 20_000 });
  await onboarding.getByRole('button', { name: 'Tiếp' }).click();
  const gate = page.getByRole('dialog', { name: 'Trước khi bắt đầu' });
  await gate.getByRole('button', { name: 'Tôi chưa đủ 18 tuổi' }).click();
  await expect(gate).toHaveCount(0);

  await expect(page.getByText('AI Teacher cần bạn đủ 18 tuổi')).toBeVisible();
  const commands = await teacherCommands(page);
  await expect(commands).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Dạy học bằng AI' })).toHaveCount(0);
  await context.close();
});

test('18 and over: Ctrl+K offers both AI Teacher pages and opens one', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Virtual Lab/ })).toBeVisible({ timeout: 20_000 });
  const commands = await teacherCommands(page);
  await expect(commands).toHaveCount(2);
  await commands.filter({ hasText: 'AI Teacher — trò chuyện' }).click();
  await expect(page.getByRole('region', { name: 'Dạy học bằng AI' })).toBeVisible({
    timeout: 20_000,
  });
});
