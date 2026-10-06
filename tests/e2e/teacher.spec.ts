import { expect, test } from '@playwright/test';

/** "Dạy học bằng AI" — T0 interface sketch (dev builds only), PROMPT_PHAN_2 B4. */
test('the AI teacher sketch: two layouts, labelled, fits 1366×768, Esc goes back', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Xem bản phác thảo' }).click();
  const screen = page.getByRole('region', { name: 'Dạy học bằng AI' });
  await expect(screen).toBeVisible();
  await expect(page.getByText('Bản phác thảo — chưa hoạt động')).toBeVisible();
  await expect(page.getByText('Thầy/cô AI', { exact: true })).toBeVisible();
  // The workspace panels are gone: the teacher screen is its own area.
  await expect(page.getByRole('complementary', { name: 'Thư viện chủ đề' })).toHaveCount(0);

  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  expect(await overflow()).toBeLessThanOrEqual(0);
  for (const name of ['Giữ để nói', 'Giơ tay', 'Em chưa hiểu chỗ này']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: 'test-results/teacher-talk.png' });

  await page.getByRole('radio', { name: 'Giảng trên bảng' }).click();
  await expect(page.getByRole('img', { name: 'Bảng trắng' })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/teacher-board.png' });

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Hôm nay học gì?' })).toBeVisible();
});
