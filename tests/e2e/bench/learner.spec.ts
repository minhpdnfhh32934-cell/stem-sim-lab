import { expect, test, type Page } from '@playwright/test';
import { enterLab, openLab } from '../nav';

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
  await openLab(page);
  await expect(page.getByRole('heading', { name: 'Hôm nay học gì?' })).toBeVisible();
  await expect(page.locator('.home__subject')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Mở AI Teacher' })).toBeVisible();
  await expect(page.locator('.bench-header .ai-status')).toBeVisible();
  // No "Tiếp tục" card before any lesson.
  await expect(page.getByRole('button', { name: 'Mở lại' })).toHaveCount(0);
  await expectNoHorizontalScroll(page);

  // Learning text is at least 15px; main buttons are at least 40px tall.
  const fontPx = await page
    .locator('.shelf-card__title')
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontPx).toBeGreaterThanOrEqual(15);
  for (const name of [/phân tích đề/i, 'Tự dựng cảnh (không dùng AI)']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  }

  await page.getByRole('button', { name: 'Chuyển động thẳng đều', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Khung mô phỏng' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hôm nay học gì?' })).toHaveCount(0);
  await expectNoHorizontalScroll(page);

  // The brand goes back to the launch page; the lab door leads to "Hôm nay học gì?" again.
  await page.getByRole('button', { name: 'Về trang chủ' }).click();
  await expect(page.getByRole('button', { name: /AI Teacher/ }).first()).toBeVisible();
  await enterLab(page);
  await expect(page.locator('.shelf-start__topic')).toHaveText('Chuyển động thẳng đều');
  await page.getByRole('button', { name: 'Mở lại' }).click();
  // The dev server compiles the physics stage on first use (up to ~20 s on a busy machine).
  await expect(page.locator('.stage__hud-title')).toHaveText('Chuyển động thẳng đều', {
    timeout: 20_000,
  });
});

test('subject cards and the grade switch (Grade → Subject → Topic)', async ({ page }) => {
  await openLab(page);
  const library = page.getByRole('complementary', { name: 'Thư viện chủ đề' });
  const shelf = page.getByRole('main');
  await library.getByRole('radio', { name: 'Hóa học' }).click();
  await expect(library.getByRole('radio', { name: 'Hóa học' })).toBeChecked();
  await expect(shelf.getByRole('button', { name: 'Bảng tuần hoàn', exact: true })).toBeVisible();
  const grades = shelf.getByRole('radiogroup', { name: 'Lớp' });
  await expect(grades.getByRole('radio', { name: 'Tất cả' })).toBeChecked();
  for (const radio of await grades.getByRole('radio').all()) {
    const box = await radio.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  }

  // Grade 10: physics topics under the textbook chapters, with lessons and the pending label.
  await library.getByRole('radio', { name: 'Vật lý' }).click();
  await grades.getByRole('radio', { name: 'Lớp 10' }).click();
  await expect(shelf).toContainText('chờ giáo viên duyệt');
  const kinematics = shelf.locator('.shelf', { hasText: 'Chương II. Động học' });
  await expect(
    kinematics.getByRole('button', { name: 'Chuyển động thẳng đều', exact: true }),
  ).toHaveAccessibleDescription(/Bài 4–5, 7/);
  await expectNoHorizontalScroll(page);

  // Biology has no grade 11 topic yet: no dead end, "Xem tất cả" goes back to every topic.
  await library.getByRole('radio', { name: 'Sinh học' }).click();
  await grades.getByRole('radio', { name: 'Lớp 11' }).click();
  await expect(shelf).toContainText('Chưa có chủ đề Sinh học nào được xếp vào lớp 11.');
  await shelf.getByRole('button', { name: 'Xem tất cả' }).click();
  await expect(grades.getByRole('radio', { name: 'Tất cả' })).toBeChecked();
  await expect(shelf.getByRole('button', { name: 'Nguyên phân', exact: true })).toBeVisible();
});

test('the grade switch fits the narrowest library at the largest font, in English too', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.layout',
      JSON.stringify({ state: { leftWidth: 200 }, version: 1 }),
    );
    localStorage.setItem(
      'stemsim.settings',
      JSON.stringify({ state: { locale: 'en', fontScale: 1.4 }, version: 2 }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Virtual Lab/ }).click();
  const grades = page.getByRole('radiogroup', { name: 'Grade' });
  await expect(grades.getByRole('radio', { name: 'Grade 10' })).toBeVisible();
  // Nothing spills out of the switch or out of an item (long names fold instead).
  const overflow = await grades.evaluate((el) =>
    [el, ...el.querySelectorAll('button')].map((n) => n.scrollWidth - n.clientWidth),
  );
  expect(Math.max(...overflow)).toBeLessThanOrEqual(0);
  for (const radio of await grades.getByRole('radio').all()) {
    const box = await radio.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  }
  await expectNoHorizontalScroll(page);
});

test.describe('Basic / Advanced', () => {
  test('Basic is the default: key sliders, Đồ thị · Lời giải · Thử thách; Advanced adds the rest', async ({
    page,
  }) => {
    await openLab(page);
    await page.getByRole('button', { name: 'Ném xiên', exact: true }).click();
    // The bench: the mode switch is in the header, the parameters in the tray, the panels in
    // the notebook (Thẻ khoa học and Hỏi AI always at the bottom of its rail).
    const header = page.locator('.bench-header');
    const tray = page.getByRole('complementary', { name: 'Điều chỉnh (bảng thuộc tính)' });
    const mode = header.getByRole('radiogroup', { name: 'Chế độ hiển thị' });
    await expect(mode.getByRole('radio', { name: 'Cơ bản' })).toBeChecked();

    const bottom = page.getByRole('tablist', { name: 'Bảng đồ thị và lời giải' });
    await expect(bottom.getByRole('tab')).toHaveText([
      'Thử thách',
      'Đồ thị',
      'Lời giải',
      'Thẻ khoa học',
      'Hỏi AI',
    ]);
    await expect(tray.getByText('Đối tượng', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('switch', { name: /Thước đo góc/ })).toHaveCount(0);
    const sliders = tray.locator('.params input[type="range"]');
    // count() does not wait: let the sliders render first (slow under a full parallel run).
    await expect(sliders.first()).toBeVisible();
    const basicCount = await sliders.count();
    expect(basicCount).toBeGreaterThanOrEqual(3);
    expect(basicCount).toBeLessThanOrEqual(5);
    await expectNoHorizontalScroll(page);

    // The rest of the parameters are one click away.
    const more = tray.getByRole('button', { name: /Thêm thông số/ });
    if ((await more.count()) > 0) {
      await more.click();
      await expect.poll(() => sliders.count()).toBeGreaterThan(basicCount);
    }

    await mode.getByRole('radio', { name: 'Nâng cao' }).click();
    await expect(bottom.getByRole('tab')).toHaveText([
      'Thử thách',
      'Đồ thị',
      'Lời giải',
      'Số liệu',
      'Thẻ khoa học',
      'Hỏi AI',
    ]);
    await expect(tray.getByText('Đối tượng', { exact: true })).toBeVisible();
    await expect(page.getByRole('switch', { name: /Thước đo góc/ })).toBeVisible();
    await expectNoHorizontalScroll(page);

    // The choice is remembered.
    await page.reload();
    await enterLab(page);
    await page.getByRole('button', { name: 'Ném xiên', exact: true }).click();
    await expect(
      page
        .locator('.bench-header')
        .getByRole('radiogroup', { name: 'Chế độ hiển thị' })
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
  await openLab(page);
  const coarse = await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches);
  test.skip(!coarse, 'this browser does not report a touch pointer');
  const box = await page.getByRole('button', { name: 'Cài đặt', exact: true }).boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  await expectNoHorizontalScroll(page);
  await context.close();
});

test('learn by exploring: predict → observe, a challenge solved, progress and a badge', async ({
  page,
}) => {
  await openLab(page);
  // Ném ngang: its prediction lives in the lab (Rơi tự do's is a Science Studio lesson).
  const card = () => page.getByRole('main').getByRole('button', { name: 'Ném ngang', exact: true });
  await card().click();
  await expect(page.locator('.stage__hud-title')).toHaveText('Ném ngang', { timeout: 20_000 });
  // Opened → "Đã mở" at once on its shelf card, and the chapter counts it.
  await page.getByRole('button', { name: 'Về trang chủ' }).click();
  await enterLab(page);
  await expect(card()).toHaveAccessibleDescription(/Đã mở/);
  await expect(page.locator('.shelf-card__mark[data-state="opened"] svg')).toHaveCount(1);
  await expect(
    page
      .locator('.shelf', { has: page.getByRole('button', { name: 'Ném ngang', exact: true }) })
      .locator('.shelf__count'),
  ).toHaveText(/^1\/\d+ đã mở$/);
  await card().click();
  await page.getByRole('tab', { name: 'Thử thách' }).click();

  // Predict – observe – explain: the right answer is computed by the engine. Doubling v₀ leaves
  // the fall time t = √(2h₀/g) unchanged. The bench locks the prediction, then the main action
  // runs it.
  const predict = page.getByRole('region', { name: 'Dự đoán trước' });
  const lock = predict.getByRole('button', { name: 'Chốt dự đoán' });
  await expect(lock).toBeDisabled();
  await predict.getByRole('radio', { name: 'Tăng 2 lần' }).click();
  await lock.click();
  await page
    .getByRole('group', { name: 'Điều khiển thời gian' })
    .getByRole('button', { name: 'Chạy để kiểm tra' })
    .click();
  await expect(predict.getByRole('status')).toContainText('Kết quả khác với dự đoán');
  await expect(predict.getByRole('radio', { name: 'Không đổi' })).toHaveClass(/is-correct/);
  await expect(predict.getByRole('textbox', { name: 'Bạn giải thích thế nào?' })).toBeVisible();

  // Challenge: land 40 m away from h₀ = 45 m (scene default, g = 9,81 m/s²) → v₀ = 40 / t.
  const challenge = page.getByRole('region', { name: /Thử thách: Ném trúng đích 40 m/ });
  await challenge.getByRole('button', { name: 'Bắt đầu thử thách' }).click();
  await expect(challenge).toContainText('Hiện tại');
  const v0 = page.getByRole('textbox', { name: /Vận tốc ban đầu/ });
  await v0.fill((40 / Math.sqrt((2 * 45) / 9.81)).toFixed(2));
  await v0.press('Enter');
  await expect(challenge.getByRole('status').last()).toContainText('Chính xác!');
  await expect(challenge).toContainText('Đã hoàn thành');

  // Topic complete (opened + predicted + challenge) → "Đã xong" on its card; badges on the shelf.
  await page.getByRole('button', { name: 'Về trang chủ' }).click();
  await expect(page.getByRole('button', { name: /AI Teacher/ }).first()).toBeVisible();
  await enterLab(page);
  await expect(card()).toHaveAccessibleDescription(/Đã xong/);
  await expect(page.locator('.shelf-card__mark[data-state="complete"]')).toHaveCount(1);
  await expect(page.getByText('Vượt thử thách')).toBeVisible();
  await expect(page.getByText('Bước đầu tiên')).toBeVisible();
});

test('a reminder to rest the eyes after ~45 minutes of continuous use', async ({ page }) => {
  await page.clock.install();
  await openLab(page);
  for (let m = 0; m < 45; m++) {
    await page.mouse.move(200 + (m % 5), 300);
    await page.clock.fastForward('01:00');
  }
  await page.mouse.move(250, 320);
  await expect(page.getByText('Bạn đã học khoảng 45 phút liên tục')).toBeVisible();
});
