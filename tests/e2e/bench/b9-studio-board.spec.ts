import { expect, test, type Page } from '@playwright/test';
import { fulfillGemini } from '../fakeAi';
import { openLab } from '../nav';

/**
 * #205 B9, part A on Science Studio and the teaching board at 1366 × 768, 100 % and 140 %: the
 * "Báo cáo" step (lesson panel 640 px) keeps the live stage's edge inside the window, with its
 * confidence chip reduced to its icon (the words in its name and tooltip); on the board, the
 * quick requests and "Báo cáo nội dung không phù hợp" are 40 px targets.
 */

const LESSON = [
  '# Rơi tự do',
  '1. Chọn chiều dương hướng xuống.',
  '2. Viết công thức quãng đường:',
  '$$s = \\frac{1}{2} g t^2$$',
  '3. Thay số đã cho trong đề.',
].join('\n');

async function setUp(page: Page, fontScale: number) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript((scale) => {
    localStorage.setItem(
      'stemsim.settings',
      JSON.stringify({ state: { locale: 'vi', fontScale: scale }, version: 2 }),
    );
  }, fontScale);
}

const sideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const fontScale of [1, 1.4] as const) {
  const pct = `${String(fontScale * 100)} %`;

  test(`Science Studio "Báo cáo" at ${pct}: the live stage's edge stays in the window`, async ({
    page,
  }) => {
    await setUp(page, fontScale);
    await openLab(page);
    await page.getByRole('radio', { name: 'Có hướng dẫn' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Science Studio' })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('tab', { name: 'Vật lý' }).click();
    await page.getByRole('radio', { name: /√2/ }).click();
    const next = page.getByRole('button', { name: /^Tiếp:/ });
    await next.click();
    await page.getByRole('button', { name: 'Chạy thí nghiệm' }).click();
    await expect(page.getByText(/Đã có số đo của cả hai điều kiện/)).toBeVisible();
    await next.click();
    for (const step of ['Giải thích', 'Kết luận', 'Báo cáo']) {
      const box = page.locator('textarea').first();
      if (await next.isDisabled()) await box.fill('Thời gian rơi tỉ lệ với căn bậc hai độ cao.');
      await expect(next).toHaveAccessibleName(`Tiếp: ${step}`);
      await next.click();
    }
    await expect(page.locator(".studio-flow[data-step='report']")).toBeVisible();

    const edge = page.locator('.studio-live .bench-edge');
    await expect(edge).toBeVisible();
    expect(await sideScroll(page)).toBe(0);
    const outside = await edge.evaluate((el) =>
      // Each slot of the edge (the chip clips its own words).
      [...el.children]
        .filter((c) => {
          const b = c.getBoundingClientRect();
          return b.width > 0 && b.right > window.innerWidth + 1 && !c.closest('.sr-only');
        })
        .map((c) => c.className),
    );
    expect(outside).toEqual([]);
    // The run controls and the scrubber are all there.
    await expect(edge.getByRole('button', { name: 'Chạy (Space)' })).toBeVisible();
    const scrub = await edge.getByRole('slider').boundingBox();
    expect(scrub?.width ?? 0).toBeGreaterThanOrEqual(80);
    // The chip: its icon on the edge, its words in its name and in the tooltip.
    const chip = edge.locator('.bench-chip');
    await expect(chip).toHaveAccessibleName(/Định lượng chính xác/);
    const box = await chip.boundingBox();
    expect(box?.x ?? Infinity).toBeLessThanOrEqual(1366 - (box?.width ?? 0));
    await chip.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Định lượng chính xác');
  });

  test(`the teaching board at ${pct}: quick requests and the report button are 40 px targets`, async ({
    page,
  }) => {
    await setUp(page, fontScale);
    await page.addInitScript(() => {
      globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'test-key';
    });
    await page.route('https://generativelanguage.googleapis.com/v1beta/**', async (route) => {
      if (route.request().url().includes('/models?')) {
        return route.fulfill({
          json: {
            models: [
              { name: 'models/gemini-test', supportedGenerationMethods: ['generateContent'] },
            ],
          },
        });
      }
      return fulfillGemini(route, LESSON, 'STOP', 'gemini-test');
    });
    await page.goto('/');
    await page.locator('.launch-card--teacher').click();
    await page.getByRole('radio', { name: 'Bảng giảng' }).click();
    const board = page.getByRole('region', { name: 'Bảng trắng của AI Teacher' });
    await expect(board).toContainText('Hỏi AI Teacher một câu', { timeout: 20_000 });
    await page.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Giải bài rơi tự do');
    await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
    await board.getByRole('button', { name: 'Viết nhanh' }).click();
    await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({ timeout: 15_000 });

    const quick = page.getByRole('group', { name: 'Yêu cầu nhanh' }).getByRole('button');
    await expect(quick).toHaveCount(6);
    const reports = page.getByRole('button', { name: 'Báo cáo nội dung không phù hợp' });
    expect(await reports.count()).toBeGreaterThanOrEqual(1);
    for (const b of [...(await quick.all()), ...(await reports.all())]) {
      if (!(await b.isVisible())) continue;
      const r = await b.boundingBox();
      expect(Math.min(r?.width ?? 0, r?.height ?? 0), await b.innerText()).toBeGreaterThanOrEqual(
        40,
      );
    }
    expect(await sideScroll(page)).toBe(0);
  });
}
