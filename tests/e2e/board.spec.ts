import { expect, test, type Page } from '@playwright/test';

/**
 * "Giảng trên bảng" with a fake Gemini server (no real model): the answer is written on the
 * board step by step, a cut answer can be continued, and the page fits 1366×768.
 */

const LESSON = [
  '# Rơi tự do',
  '1. Chọn chiều dương hướng xuống.',
  '2. Viết công thức quãng đường:',
  '$$s = \\frac{1}{2} g t^2$$',
  '3. Thay số đã cho trong đề.',
].join('\n');

async function fakeGemini(page: Page, answers: { text: string; finishReason: string }[]) {
  const systems: string[] = [];
  await page.addInitScript(() => {
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'test-key';
  });
  await page.route('https://generativelanguage.googleapis.com/v1beta/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/models?')) {
      return route.fulfill({
        json: {
          models: [{ name: 'models/gemini-test', supportedGenerationMethods: ['generateContent'] }],
        },
      });
    }
    const body = route.request().postDataJSON() as {
      systemInstruction?: { parts?: { text?: string }[] };
    };
    systems.push(body.systemInstruction?.parts?.[0]?.text ?? '');
    const next = answers.shift() ?? { text: 'Xong.', finishReason: 'STOP' };
    return route.fulfill({
      json: {
        candidates: [
          { content: { parts: [{ text: next.text }] }, finishReason: next.finishReason },
        ],
        modelVersion: 'gemini-test',
      },
    });
  });
  return systems;
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('the board writes the answer step by step and continues a cut answer', async ({ page }) => {
  const systems = await fakeGemini(page, [
    { text: LESSON, finishReason: 'MAX_TOKENS' },
    { text: '4. Kết luận: quãng đường tỉ lệ với bình phương thời gian.', finishReason: 'STOP' },
  ]);
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  await page.getByRole('radio', { name: 'Giảng trên bảng' }).click();
  const board = page.getByRole('region', { name: 'Bảng giảng' });
  await expect(board).toContainText('Hỏi thầy một câu');

  await page.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Giải bài rơi tự do');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();

  await expect(board.getByRole('heading', { name: 'Rơi tự do' })).toBeVisible();
  // The AI was asked for a lesson layout (title + numbered steps).
  expect(systems[0]).toContain('bảng giảng');
  await board.getByRole('button', { name: 'Hiện tất cả' }).click();
  await expect(board.getByRole('listitem')).toHaveCount(3);
  await expect(board.locator('.katex').first()).toBeVisible();
  await expect(board.getByText('Nội dung do AI hỗ trợ')).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // The answer stopped at the output limit: "Viết tiếp" adds the rest to the same lesson.
  await page.getByRole('button', { name: 'Viết tiếp' }).click();
  await expect(page.getByRole('button', { name: 'Viết tiếp' })).toHaveCount(0);
  await board.getByRole('button', { name: 'Hiện tất cả' }).click();
  await expect(board.getByRole('listitem')).toHaveCount(4);
  await expect(board).toContainText('quãng đường tỉ lệ với bình phương thời gian');
});
