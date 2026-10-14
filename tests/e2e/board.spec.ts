import { expect, test, type Page } from '@playwright/test';

/**
 * "Giảng trên bảng" with a fake Gemini server (no real model): a plain markdown answer is laid
 * out on the whiteboard, a cut answer is continued on the same board ("Viết tiếp"), the board
 * carries the AI label, and the page fits 1366×768.
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

test('a markdown answer is laid out on the board, and a cut answer is continued on it', async ({
  page,
}) => {
  const systems = await fakeGemini(page, [
    { text: LESSON, finishReason: 'MAX_TOKENS' },
    { text: '4. Kết luận: quãng đường tỉ lệ với bình phương thời gian.', finishReason: 'STOP' },
  ]);
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  await page.getByRole('radio', { name: 'Giảng trên bảng' }).click();
  const board = page.getByRole('region', { name: 'Bảng trắng của AI Teacher' });
  // The board is lazy-loaded ("Đang chuẩn bị bảng…"): the first load can be slow in a full run.
  await expect(board).toContainText('Hỏi AI Teacher một câu', { timeout: 20_000 });

  await page.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Giải bài rơi tự do');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();

  // The cloud AI was asked for a board lesson.
  await expect.poll(() => systems.length).toBe(1);
  expect(systems[0]).toContain('CHẾ ĐỘ BẢNG TRẮNG');
  await board.getByRole('button', { name: 'Viết nhanh' }).click();
  await expect(board.locator('[data-id="h1"]')).toContainText('Rơi tự do');
  await expect(board.locator('.board__el.is-body')).toHaveCount(4); // 3 steps + the formula
  await expect(board.locator('.katex').first()).toBeVisible();
  await expect(board.getByText('Nội dung do AI hỗ trợ')).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // The answer stopped at the output limit: "Viết tiếp" writes the rest on the same board.
  await page.getByRole('button', { name: 'Viết tiếp' }).click();
  await expect(page.getByRole('button', { name: 'Viết tiếp' })).toHaveCount(0);
  await expect(board).toContainText('quãng đường tỉ lệ với bình phương thời gian', {
    timeout: 15_000,
  });
  await expect(board.locator('[data-id="h1"]')).toContainText('Rơi tự do');
});

test('Think on the board: hidden reasoning and the reviewer’s notes reach neither the board nor the chat', async ({
  page,
}) => {
  await fakeGemini(page, [
    { text: `<think>nháp nội bộ 7 kg</think>${LESSON}`, finishReason: 'STOP' },
  ]);
  const reviews: string[] = [];
  await page.addInitScript(() => {
    globalThis.__STEMSIM_TEST_GROQ_KEY__ = 'groq-test-key';
  });
  await page.route('https://api.groq.com/openai/v1/**', (route) => {
    reviews.push(route.request().postData() ?? '');
    return route.fulfill({
      json: {
        choices: [
          {
            message: {
              content: `Nhận xét: bản nháp đúng. Dưới đây là bản đã sửa:\n**GHI CHÚ:**\n${LESSON}\n<think>kiểm tra lần cuối`,
            },
          },
        ],
        model: 'qwen-test',
      },
    });
  });
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  await page.getByRole('radio', { name: 'Giảng trên bảng' }).click();
  const board = page.getByRole('region', { name: 'Bảng trắng của AI Teacher' });
  await expect(board).toContainText('Hỏi AI Teacher một câu', { timeout: 20_000 });
  const panel = page.getByRole('region', { name: 'Trò chuyện với AI Teacher' });
  await panel.getByRole('button', { name: /Think/ }).click();
  await panel.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Giải bài rơi tự do');
  await panel.getByRole('button', { name: 'Gửi câu hỏi' }).click();

  // The reviewer got the draft without its hidden reasoning.
  await expect.poll(() => reviews.length).toBe(1);
  expect(reviews[0]).toContain('Rơi tự do');
  expect(reviews[0]).not.toContain('nháp nội bộ');

  await board.getByRole('button', { name: 'Viết nhanh' }).click();
  await expect(board.locator('[data-id="h1"]')).toContainText('Rơi tự do');
  await expect(board.locator('.board__el.is-body')).toHaveCount(4);
  // ("Think" itself is the name of the toggle in the chat, so only the tag is looked for.)
  const internal = /bản nháp|bản đã sửa|GHI CHÚ|kiểm tra lần cuối|nháp nội bộ|<\/?think/iu;
  await expect(board).not.toContainText(internal);
  await expect(panel).not.toContainText(internal);
  await expect(panel.getByText(/Đã rà soát: groq/)).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

/** A lesson that moves to a second face and writes a long line there (item 5). */
const TWO_FACES = [
  'Hôm nay mình xét <write id="t1" zone="title" role="heading">Rơi tự do</write>.',
  'Trước hết <write id="a1" zone="steps">vật chỉ chịu tác dụng của trọng lực</write>.',
  'Sang mặt bảng mới <newboard title="Phần 2"/> ta ghi <write id="b1" zone="steps">quãng đường rơi tăng theo bình phương thời gian nên càng về sau vật càng rơi nhanh hơn trước rất nhiều</write>.',
  'Cuối cùng <write id="c1" zone="steps">kết thúc bài học hôm nay</write>.',
].join(' ');

/** Fake Windows voice (25 ms per character), as in lesson-flow.spec.ts. */
async function fakeVoice(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.teacher-voice',
      JSON.stringify({
        state: { enabled: true, engine: 'system', style: 'vui', speed: 1, voiceURI: '' },
        version: 2,
      }),
    );
    let current: { onerror?: (e: { error: string }) => void; timer?: number } | null = null;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [],
        speak(u: SpeechSynthesisUtterance & { timer?: number }) {
          current = u as never;
          u.timer = window.setTimeout(() => {
            current = null;
            u.onend?.(new Event('end') as SpeechSynthesisEvent);
          }, 25 * u.text.length);
        },
        cancel() {
          if (current?.timer) window.clearTimeout(current.timer);
          const c = current;
          current = null;
          c?.onerror?.({ error: 'interrupted' });
        },
        addEventListener() {},
        removeEventListener() {},
      },
    });
  });
}

test('switching faces while the teacher writes pauses the pen and keeps the board', async ({
  page,
}) => {
  await fakeGemini(page, [{ text: TWO_FACES, finishReason: 'STOP' }]);
  await fakeVoice(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  await page.getByRole('radio', { name: 'Giảng trên bảng' }).click();
  const board = page.getByRole('region', { name: 'Bảng trắng của AI Teacher' });
  await expect(board).toContainText('Hỏi AI Teacher một câu', { timeout: 20_000 });
  await page.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Giải thích rơi tự do');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();

  const face1 = board.getByRole('tab', { name: /^Bảng 1/ });
  const face2 = board.getByRole('tab', { name: /^Bảng 2/ });
  const pen = board.locator('.board__pen');
  const shown = (id: string) =>
    board.locator(`[data-id="${id}"] .board__char[style*="visibility: visible"]`);
  const hidden = (id: string) =>
    board.locator(`[data-id="${id}"] .board__char[style*="visibility: hidden"]`);

  // The teacher writes on the second face.
  await expect(face2).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 });
  await expect(shown('b1').first()).toBeAttached({ timeout: 10_000 });
  await expect(pen).toHaveCount(1);

  // The learner looks back at the first face: no pen there, the lesson waits, the view stays.
  await face1.click();
  await expect(pen).toHaveCount(0);
  await expect(board.getByRole('button', { name: 'Tiếp tục' })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(face1).toHaveAttribute('aria-selected', 'true');
  await expect(pen).toHaveCount(0);
  await expect(hidden('a1')).toHaveCount(0);
  await expect(board.locator('[data-id="a1"]')).toContainText('trọng lực');

  // Back on the teacher's face: what was written is still there, the pen with it, still paused.
  await face2.click();
  await expect(pen).toHaveCount(1);
  const written = await shown('b1').count();
  expect(written).toBeGreaterThan(0);
  await expect(hidden('b1').first()).toBeAttached();
  await page.waitForTimeout(1000);
  expect(await shown('b1').count()).toBe(written);

  // "Tiếp tục" (asked from the first face) brings the view back and finishes the lesson.
  await face1.click();
  await board.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(face2).toHaveAttribute('aria-selected', 'true');
  await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({ timeout: 30_000 });
  await expect(hidden('b1')).toHaveCount(0);
  await expect(board.locator('[data-id="c1"]')).toContainText('kết thúc bài học hôm nay');
  await expect(pen).toHaveCount(0);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // Taught again, then "Trò chuyện" in the middle and back: the lesson waits with "Tiếp tục".
  await board.getByRole('button', { name: 'Giảng lại' }).click();
  await expect(shown('a1').first()).toBeAttached({ timeout: 10_000 });
  await expect(board.getByRole('button', { name: 'Tạm dừng' })).toBeVisible();
  await page.getByRole('radio', { name: 'Trò chuyện' }).click();
  await expect(board).toHaveCount(0);
  await page.getByRole('radio', { name: 'Giảng trên bảng' }).click();
  await expect(board.getByRole('button', { name: 'Tiếp tục' })).toBeVisible({ timeout: 10_000 });
  await expect(shown('a1').first()).toBeAttached();
  await board.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({ timeout: 30_000 });
  await expect(hidden('c1')).toHaveCount(0);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
