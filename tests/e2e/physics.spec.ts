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
  ['Tổng hợp và phân tích lực', 'Tổng hợp và phân tích lực'],
  ['Các định luật Newton', 'Các định luật Newton'],
  ['Định luật III Newton', 'Định luật III Newton'],
  ['Trọng lực và lực căng dây', 'Trọng lực và lực căng dây'],
  ['Mặt phẳng nghiêng', 'Mặt phẳng nghiêng'],
  ['Ròng rọc – dây nối', 'Ròng rọc – dây nối'],
  ['Lò xo (định luật Hooke)', 'Lò xo – định luật Hooke'],
  ['Lực cản của chất lưu', 'Lực cản của chất lưu'],
  ['Moment lực và cân bằng vật rắn', 'Moment lực và cân bằng vật rắn'],
  ['Áp suất chất lỏng', 'Áp suất chất lỏng'],
  ['Công, công suất và hiệu suất', 'Công, công suất và hiệu suất'],
  ['Bảo toàn cơ năng', 'Bảo toàn cơ năng'],
  ['Va chạm đàn hồi và va chạm mềm', 'Va chạm đàn hồi và va chạm mềm'],
  ['Con lắc lò xo', 'Con lắc lò xo'],
  ['Con lắc đơn', 'Con lắc đơn'],
  ['Dao động cưỡng bức và cộng hưởng', 'Dao động cưỡng bức và cộng hưởng'],
  ['Chuyển động tròn đều', 'Chuyển động tròn đều'],
  ['Sóng cơ: sóng ngang, sóng dọc', 'Sóng cơ: sóng ngang, sóng dọc'],
  ['Sóng điện từ', 'Sóng điện từ'],
  ['Giao thoa sóng hai nguồn', 'Giao thoa sóng hai nguồn'],
  ['Sóng dừng trên dây', 'Sóng dừng trên dây'],
  ['Họa âm và chuỗi Fourier', 'Họa âm và chuỗi Fourier'],
  ['Điện trường của điện tích điểm', 'Điện trường của điện tích điểm'],
  ['Thế năng điện. Điện thế', 'Thế năng điện. Điện thế'],
  ['Tụ điện', 'Tụ điện'],
  ['Cường độ dòng điện', 'Cường độ dòng điện'],
  ['Mạch điện một chiều', 'Mạch điện một chiều'],
  ['Cấu trúc của chất và sự chuyển thể', 'Cấu trúc của chất và sự chuyển thể'],
  ['Nội năng, nhiệt độ và nhiệt lượng', 'Nội năng, nhiệt độ và nhiệt lượng'],
  ['Mô hình động học phân tử chất khí', 'Mô hình động học phân tử chất khí'],
  ['Các định luật của khí lí tưởng', 'Các định luật của khí lí tưởng'],
  ['Từ trường và đường sức từ', 'Từ trường và đường sức từ'],
  ['Lực từ và cảm ứng từ', 'Lực từ và cảm ứng từ'],
  ['Cảm ứng điện từ và máy phát điện xoay chiều', 'Cảm ứng điện từ và máy phát điện xoay chiều'],
  ['Ứng dụng hiện tượng cảm ứng điện từ', 'Ứng dụng hiện tượng cảm ứng điện từ'],
  ['Điện từ trường và mô hình sóng điện từ', 'Điện từ trường và mô hình sóng điện từ'],
  ['Định luật II Kepler', 'Định luật II Kepler'],
];

/** Descriptive lessons run as guided lessons (#255): a lesson frame, no simulation. */
const GUIDED = new Set([
  'Cấu trúc của chất và sự chuyển thể',
  'Mô hình động học phân tử chất khí',
  'Từ trường và đường sức từ',
  'Ứng dụng hiện tượng cảm ứng điện từ',
  'Điện từ trường và mô hình sóng điện từ',
]);

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
    if (GUIDED.has(name)) {
      await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByRole('region', { name: 'Khung bài học' })).toBeVisible();
    } else {
      // The dev server compiles a scene's chunk on first use (up to ~20 s on a busy machine).
      await expect(page.locator('.stage__hud-title')).toHaveText(title, { timeout: 20_000 });
      await expect(page.getByRole('region', { name: 'Khung mô phỏng' })).toBeVisible();
    }
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test('phase portraits (#54 item 3): the phase circle of the spring, the phase space of the pendulum', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const library = await openPhysicsLibrary(page);
  await library.getByRole('button', { name: 'Con lắc lò xo', exact: true }).click();
  await expect(page.locator('.stage__hud-title')).toHaveText('Con lắc lò xo', { timeout: 20_000 });
  await page.getByRole('tab', { name: 'Đồ thị' }).click();
  await page.getByRole('button', { name: 'Chạy (Space)' }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('radio', { name: 'Vòng tròn pha' }).click();
  const circle = page.getByRole('img', { name: 'Vòng tròn pha: −v/ω (m) theo x (m)' });
  await expect(circle).toBeVisible();
  expect((await circle.boundingBox())?.height ?? 0).toBeGreaterThan(100);
  await page.screenshot({ path: 'test-results/phase-circle.png' });

  await library.getByRole('button', { name: 'Con lắc đơn', exact: true }).click();
  await expect(page.locator('.stage__hud-title')).toHaveText('Con lắc đơn', { timeout: 20_000 });
  await page.getByRole('tab', { name: 'Đồ thị' }).click();
  await page.getByRole('button', { name: 'Chạy (Space)' }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('radio', { name: 'Không gian pha' }).click();
  await expect(
    page.getByRole('img', { name: 'Không gian pha: ω (rad/s) theo α (rad)' }),
  ).toBeVisible();
  await expect(page.getByText('Đường phân cách (E = 2mgL)')).toBeVisible();
  await page.screenshot({ path: 'test-results/phase-pendulum.png' });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
