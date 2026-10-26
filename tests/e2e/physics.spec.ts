import { expect, test, type Page } from '@playwright/test';
import { openLab } from './nav';

/**
 * Every physics topic opens without a page error, fits 1366×768 without horizontal scrolling
 * and shows its own title. A new topic appends its [library name, stage title] here; the first
 * test fails until it does.
 */
const TOPICS: readonly (readonly [string, string])[] = [
  ['Chuyển động thẳng đều', 'Chuyển động thẳng đều'],
  ['Chuyển động thẳng biến đổi đều', 'Chuyển động thẳng biến đổi đều'],
  ['Rơi tự do', 'Rơi tự do và ném thẳng đứng'],
  ['Ném ngang', 'Ném ngang'],
  ['Ném xiên', 'Ném xiên'],
  ['Các định luật Newton', 'Các định luật Newton'],
  ['Mặt phẳng nghiêng', 'Mặt phẳng nghiêng'],
  ['Ròng rọc – dây nối', 'Ròng rọc – dây nối'],
  ['Lò xo (định luật Hooke)', 'Lò xo – định luật Hooke'],
  ['Bảo toàn cơ năng', 'Bảo toàn cơ năng'],
  ['Va chạm đàn hồi và va chạm mềm', 'Va chạm đàn hồi và va chạm mềm'],
  ['Con lắc lò xo', 'Con lắc lò xo'],
  ['Con lắc đơn', 'Con lắc đơn'],
  ['Chuyển động tròn đều', 'Chuyển động tròn đều'],
  ['Điện trường của điện tích điểm', 'Điện trường của điện tích điểm'],
];

async function openPhysicsLibrary(page: Page) {
  await openLab(page);
  await page.getByRole('radio', { name: 'Vật lý' }).click();
  return page.getByRole('complementary', { name: 'Thư viện chủ đề' });
}

test('the physics library lists exactly the topics below', async ({ page }) => {
  const library = await openPhysicsLibrary(page);
  await expect(library.locator('.tree__topic-title')).toHaveText(TOPICS.map(([name]) => name));
});

for (const [name, title] of TOPICS) {
  test(`${name}: opens without errors, fits 1366×768, shows its title`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const library = await openPhysicsLibrary(page);
    await library.getByRole('button', { name, exact: true }).click();
    // The dev server compiles a scene's chunk on first use (up to ~20 s on a busy machine).
    await expect(page.locator('.stage__hud-title')).toHaveText(title, { timeout: 20_000 });
    await expect(page.getByRole('region', { name: 'Khung mô phỏng' })).toBeVisible();
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}
