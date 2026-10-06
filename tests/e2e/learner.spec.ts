import { expect, test, type Page } from '@playwright/test';

/** No horizontal scrolling at the test viewport (1366×768, PROMPT_PHAN_2 A4.1). */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test('home "Hôm nay học gì?": suggestions, back home, continue the last lesson', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hôm nay học gì?' })).toBeVisible();
  await expect(page.locator('.home__subject')).toHaveCount(3);
  await expect(page.getByText('Dạy học bằng AI')).toBeVisible();
  await expect(page.locator('.topbar .ai-status')).toBeVisible();
  // No continue button before any lesson.
  await expect(page.getByRole('button', { name: /Tiếp tục bài đang học/ })).toHaveCount(0);
  await expectNoHorizontalScroll(page);

  // Learning text is at least 15px; main buttons are at least 40px tall.
  const fontPx = await page
    .locator('.home__subtitle')
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontPx).toBeGreaterThanOrEqual(15);
  for (const name of [/phân tích đề/i, 'Tự dựng cảnh (không dùng AI)']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  }

  await page.getByRole('button', { name: 'Chuyển động thẳng đều · Vật lý' }).click();
  await expect(page.getByRole('region', { name: 'Khung mô phỏng' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hôm nay học gì?' })).toHaveCount(0);
  await expectNoHorizontalScroll(page);

  await page.getByRole('button', { name: 'Về trang chủ' }).click();
  const resume = page.getByRole('button', { name: /Tiếp tục bài đang học/ });
  await expect(resume).toContainText('Chuyển động thẳng đều');
  await resume.click();
  await expect(page.locator('.stage__hud-title')).toHaveText('Chuyển động thẳng đều');
});

test('subject cards and the level picker (Level → Subject → Topic)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Hóa học/ }).click();
  await expect(page.getByRole('radio', { name: 'Hóa học' })).toBeChecked();
  const library = page.getByRole('complementary', { name: 'Thư viện chủ đề' });
  await expect(library.getByRole('button', { name: 'Bảng tuần hoàn', exact: true })).toBeVisible();
  const levels = library.getByRole('radiogroup', { name: 'Trình độ' });
  await expect(levels.getByRole('radio', { name: 'Nền tảng' })).toBeChecked();
  await levels.getByRole('radio', { name: /Đại cương/ }).click();
  await expect(library).toContainText('sẽ có ở giai đoạn sau');
  await expect(library.getByRole('button', { name: 'Bảng tuần hoàn', exact: true })).toHaveCount(0);
  await levels.getByRole('radio', { name: 'Nền tảng' }).click();
  await expect(library.getByRole('button', { name: 'Bảng tuần hoàn', exact: true })).toBeVisible();
});

test.describe('Basic / Advanced', () => {
  test('Basic is the default: key sliders, Đồ thị · Lời giải; Advanced adds the rest', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Ném xiên', exact: true }).click();
    const inspector = page.getByRole('complementary', { name: 'Bảng thuộc tính' });
    const mode = inspector.getByRole('radiogroup', { name: 'Chế độ hiển thị' });
    await expect(mode.getByRole('radio', { name: 'Cơ bản' })).toBeChecked();

    const bottom = page.getByRole('tablist', { name: 'Bảng đồ thị và lời giải' });
    await expect(bottom.getByRole('tab')).toHaveText(['Đồ thị', 'Lời giải']);
    await expect(inspector.getByText('Đối tượng', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Thước đo góc/ })).toHaveCount(0);
    const sliders = inspector.locator('.params input[type="range"]');
    const basicCount = await sliders.count();
    expect(basicCount).toBeGreaterThanOrEqual(3);
    expect(basicCount).toBeLessThanOrEqual(5);
    await expectNoHorizontalScroll(page);

    // The rest of the parameters are one click away.
    const more = inspector.getByRole('button', { name: /Thêm thông số/ });
    if ((await more.count()) > 0) {
      await more.click();
      expect(await sliders.count()).toBeGreaterThan(basicCount);
    }

    await mode.getByRole('radio', { name: 'Nâng cao' }).click();
    await expect(bottom.getByRole('tab')).toHaveText(['Đồ thị', 'Lời giải', 'Số liệu']);
    await expect(inspector.getByText('Đối tượng', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Thước đo góc/ })).toBeVisible();
    await expectNoHorizontalScroll(page);

    // The choice is remembered.
    await page.reload();
    await page.getByRole('button', { name: 'Ném xiên', exact: true }).click();
    await expect(
      page
        .getByRole('complementary', { name: 'Bảng thuộc tính' })
        .getByRole('radio', { name: 'Nâng cao' }),
    ).toBeChecked();
  });
});

test('touch screens get 40px targets for icon buttons', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: 'tests/e2e/storage-state.json',
    viewport: { width: 1366, height: 768 },
    hasTouch: true,
    isMobile: false,
  });
  const page = await context.newPage();
  await page.goto('/');
  const coarse = await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches);
  test.skip(!coarse, 'this browser does not report a touch pointer');
  const box = await page.getByRole('button', { name: 'Cài đặt', exact: true }).boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  await expectNoHorizontalScroll(page);
  await context.close();
});
