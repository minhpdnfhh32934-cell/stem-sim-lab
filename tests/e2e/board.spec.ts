import { expect, test, type Page } from '@playwright/test';
import { fulfillGemini } from './fakeAi';

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
    // Streamed (a question) or whole (Think's draft), as the request asked.
    return fulfillGemini(route, next.text, next.finishReason, 'gemini-test');
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

/** The texts on the board that are not erased, top to bottom (then left to right). */
const textsTopDown = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.board__sheet .board__el[data-id]')]
      .filter((e) => !e.classList.contains('is-erased'))
      .map((e) => ({
        box: e.getBoundingClientRect(),
        text: e.querySelector('.sr-only')?.textContent ?? '',
      }))
      .sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left)
      .map((e) => e.text.trim()),
  );

test('"Viết tiếp" keeps the steps in order when "<step>" opens on the first step’s line', async ({
  page,
}) => {
  // The opening tag is text until its closing tag arrives with the rest of the answer: then the
  // first line reads differently and is written again, above the lines after it (fix round 1 of
  // step F1a: it was written again below "2.", with a gap where "1." had been).
  await fakeGemini(page, [
    { text: '<step>1. m = 2 kg\n2. F = 10 N', finishReason: 'MAX_TOKENS' },
    { text: '3. a = F/m = 5 m/s²</step>', finishReason: 'STOP' },
  ]);
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  await page.getByRole('radio', { name: 'Giảng trên bảng' }).click();
  const board = page.getByRole('region', { name: 'Bảng trắng của AI Teacher' });
  await expect(board).toContainText('Hỏi AI Teacher một câu', { timeout: 20_000 });
  await page.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Tính gia tốc');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await board.getByRole('button', { name: 'Viết nhanh' }).click();
  await expect(board).toContainText('F = 10 N', { timeout: 15_000 });

  await page.getByRole('button', { name: 'Viết tiếp' }).click();
  await expect(page.getByRole('button', { name: 'Viết tiếp' })).toHaveCount(0);
  await expect(board).toContainText('a = F/m = 5 m/s²', { timeout: 15_000 });
  await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({ timeout: 15_000 });
  const texts = await textsTopDown(page);
  expect(texts).toHaveLength(3);
  expect(texts[0]).toContain('m = 2 kg');
  expect(texts[1]).toContain('F = 10 N');
  expect(texts[2]).toContain('a = F/m = 5 m/s²');
  for (const text of texts) expect(text).not.toContain('step');
});

test('"Viết tiếp" of an answer that ran onto a second face keeps every line there', async ({
  page,
}) => {
  // Fix round 2 of step F1a: the first line reads differently once "</step>" arrives, so
  // everything after it is placed again, and the second face is opened again. Its lines took
  // their old ids back and stayed hidden as erased stumps (only the face's title and "Xong." were
  // left on "Bảng 2").
  const steps = (a: number, b: number) =>
    Array.from(
      { length: b - a + 1 },
      (_, i) => `Bước ${String(a + i)}: x${String(a + i)} = ${String(a + i)} m`,
    ).join('\n');
  await fakeGemini(page, [
    {
      text: `# Bài\n<step>${steps(1, 11)}\n## Phần 2\n${steps(12, 13)}\n`,
      finishReason: 'MAX_TOKENS',
    },
    { text: `${steps(14, 14)}</step>\n\nXong.`, finishReason: 'STOP' },
  ]);
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  await page.getByRole('radio', { name: 'Giảng trên bảng' }).click();
  const board = page.getByRole('region', { name: 'Bảng trắng của AI Teacher' });
  await expect(board).toContainText('Hỏi AI Teacher một câu', { timeout: 20_000 });
  await page.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Tính quãng đường');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await board.getByRole('button', { name: 'Viết nhanh' }).click();
  await expect(board).toContainText('x13 = 13 m', { timeout: 15_000 });

  await page.getByRole('button', { name: 'Viết tiếp' }).click();
  await expect(page.getByRole('button', { name: 'Viết tiếp' })).toHaveCount(0);
  // Eleven lines are written again: at once, not at the pen's pace.
  await board.getByRole('button', { name: 'Viết nhanh' }).click();
  await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({ timeout: 15_000 });
  const face1 = board.getByRole('tab', { name: /^Bảng 1/ });
  const face2 = board.getByRole('tab', { name: /^Bảng 2/ });
  await expect(face2).toHaveAttribute('aria-selected', 'true');
  await expect(board.getByRole('tab', { name: /^Bảng 3/ })).toHaveCount(0);
  const second = await textsTopDown(page);
  const at = (needle: string) => second.findIndex((t) => t.includes(needle));
  expect(second.filter((t) => t === 'Phần 2').length).toBeGreaterThan(0);
  for (const needle of ['x12 = 12 m', 'x13 = 13 m', 'x14 = 14 m', 'Xong'])
    expect(
      second.filter((t) => t.includes(needle)),
      needle,
    ).toHaveLength(1);
  expect(at('x12 = 12 m')).toBeLessThan(at('x13 = 13 m'));
  expect(at('x13 = 13 m')).toBeLessThan(at('x14 = 14 m'));
  expect(at('x14 = 14 m')).toBeLessThan(at('Xong'));

  // The first face: every step once, in order, none of them on the second face.
  await face1.click();
  await expect(face1).toHaveAttribute('aria-selected', 'true');
  const first = await textsTopDown(page);
  for (let i = 1; i <= 11; i++) {
    const needle = `x${String(i)} = ${String(i)} m`;
    expect(
      first.filter((t) => t.endsWith(needle)),
      needle,
    ).toHaveLength(1);
    if (i > 1) {
      const prev = `x${String(i - 1)} = ${String(i - 1)} m`;
      expect(first.findIndex((t) => t.endsWith(prev))).toBeLessThan(
        first.findIndex((t) => t.endsWith(needle)),
      );
    }
  }
  for (const text of [...first, ...second]) expect(text).not.toContain('step');
});

test('"Viết tiếp" twice in a row keeps both faces as teaching at once (audit G8)', async ({
  page,
}) => {
  // The first "Viết tiếp" erased a stump of "Bước 14" in place; the second could not take the
  // second face off and placed every line again on it (Bảng 1 kept only its title, Bảng 3 opened).
  const steps = (a: number, b: number) =>
    Array.from(
      { length: b - a + 1 },
      (_, i) => `Bước ${String(a + i)}: x${String(a + i)} = ${String(a + i)} m`,
    ).join('\n');
  await fakeGemini(page, [
    {
      text: `# Bài\n<step>${steps(1, 11)}\n## Phần 2\n${steps(12, 13)}\nBước 14: x14 = `,
      finishReason: 'MAX_TOKENS',
    },
    // Cut after a space: the parts join without one (memory.ts `joinContinuation`).
    { text: '14 m\n', finishReason: 'MAX_TOKENS' },
    { text: '</step>\n\nXong.', finishReason: 'STOP' },
  ]);
  const board = await openBoard(page);
  await page.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Tính quãng đường');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await board.getByRole('button', { name: 'Viết nhanh' }).click();
  await expect(board).toContainText('x13 = 13 m', { timeout: 15_000 });
  for (let round = 0; round < 2; round++) {
    await page.getByRole('button', { name: 'Viết tiếp' }).click();
    await board.getByRole('button', { name: 'Viết nhanh' }).click();
    await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({
      timeout: 15_000,
    });
  }
  await expect(page.getByRole('button', { name: 'Viết tiếp' })).toHaveCount(0);
  await expect(board.getByRole('tab', { name: /^Bảng 3/ })).toHaveCount(0);
  const second = await textsTopDown(page);
  for (const needle of ['x12 = 12 m', 'x13 = 13 m', 'x14 = 14 m', 'Xong'])
    expect(
      second.filter((t) => t.includes(needle)),
      needle,
    ).toHaveLength(1);
  expect(second.some((t) => t.endsWith('x1 = 1 m'))).toBe(false);
  const face1 = board.getByRole('tab', { name: /^Bảng 1/ });
  await face1.click();
  await expect(face1).toHaveAttribute('aria-selected', 'true');
  const first = await textsTopDown(page);
  for (let i = 1; i <= 11; i++) {
    const needle = `x${String(i)} = ${String(i)} m`;
    expect(
      first.filter((t) => t.endsWith(needle)),
      needle,
    ).toHaveLength(1);
  }
});

test('a sentence that opens like a source line ("Nguồn điện…", "Liên kết…") stays; only its link goes', async ({
  page,
}) => {
  const board = await askOnBoard(
    page,
    [
      '# Dòng điện',
      '',
      'Nguồn điện tạo ra hiệu điện thế giữa hai cực (https://vi.wikipedia.org/wiki/Nguồn_điện).',
      '',
      'Liên kết ion hình thành giữa kim loại và phi kim (https://vi.wikipedia.org/wiki/Liên_kết_ion).',
      '',
      'U = 12 V.',
    ].join('\n'),
  );
  await board.getByRole('button', { name: 'Viết nhanh' }).click();
  await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({ timeout: 15_000 });
  const texts = await textsTopDown(page);
  expect(texts).toHaveLength(4);
  expect(texts[0]).toContain('Dòng điện');
  expect(texts[1]).toContain('Nguồn điện tạo ra hiệu điện thế giữa hai cực');
  expect(texts[2]).toContain('Liên kết ion hình thành giữa kim loại và phi kim');
  expect(texts[3]).toContain('U = 12 V');
  for (const text of texts) expect(text).not.toMatch(/https?:|wikipedia/iu);
});

test('the board shows learning content only: no greeting, reasoning, echo, rule or empty box', async ({
  page,
}) => {
  await fakeGemini(page, [
    {
      text: [
        'Chào bạn! Mình sẽ cùng giải bài toán này nhé.',
        '',
        '# Rơi tự do',
        '**GHI CHÚ:**',
        '1. Chọn chiều dương hướng xuống.',
        '<think>người dùng muốn số, thử g = 7</think>',
        '2. Quãng đường $s = \\frac{1}{2} g t^2$ với g = 10 m/s², t = 2 s.',
        '---',
        '**Kết luận:**',
        '',
        'Đáp số: s = 20 m',
      ].join('\n'),
      finishReason: 'STOP',
    },
  ]);
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  await page.getByRole('radio', { name: 'Giảng trên bảng' }).click();
  const board = page.getByRole('region', { name: 'Bảng trắng của AI Teacher' });
  await expect(board).toContainText('Hỏi AI Teacher một câu', { timeout: 20_000 });
  await page.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Giải bài rơi tự do');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();

  await board.getByRole('button', { name: 'Viết nhanh' }).click();
  await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({ timeout: 15_000 });
  const elements = board.locator('.board__el');
  await expect(elements).toHaveCount(4); // title, 2 steps, the result
  await expect(board.locator('[data-id="h1"]')).toContainText('Rơi tự do');
  await expect(board.locator('.board__el.is-result')).toHaveCount(1);
  await expect(board.locator('.board__el.is-result')).toContainText('s = 20 m');
  await expect(board.locator('.board__mark.is-box')).toHaveCount(1);
  for (const text of await elements.allTextContents())
    expect(text).not.toMatch(/Chào|GHI CHÚ|---|think|thử g|Kết luận:/u);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
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

/*
 * Item 3: the AI Teacher uses the whole board. Assertions are relative (fractions of the board's
 * view, rectangles that must not meet), never pixel constants: fonts and KaTeX set the sizes.
 */

/** A lesson of steps only (the usual Gemma answer): written across the whole width. */
const WIDE_LESSON = [
  '# Chuyển động rơi tự do',
  '1. Chọn gốc tọa độ tại mặt đất, chiều dương hướng lên, gốc thời gian lúc thả vật là 0 s.',
  '2. Vật được thả rơi từ độ cao 45 m so với mặt đất, bỏ qua sức cản của không khí.',
  '3. Gia tốc rơi tự do lấy g = 10 m/s², vận tốc ban đầu của vật bằng 0 m/s.',
  '4. Quãng đường vật rơi được sau t giây là s = 5t² mét, tính từ lúc thả vật.',
  '5. Vật chạm đất khi quãng đường rơi bằng độ cao ban đầu 45 m, nên t = 3 s.',
  '$$s = \\frac{1}{2} g t^2$$',
  '$$t = \\sqrt{\\frac{2h}{g}} = \\sqrt{\\frac{2 \\cdot 45}{10}} = 3\\ \\text{s}$$',
].join('\n');

/** Given data on the side, steps with a long equality chain, a table on the right. */
const THREE_LESSON = [
  'Hôm nay <write id="t1" zone="title" role="heading">Định luật II Newton</write>.',
  'Đề cho <write id="g1" zone="side_notes" role="note">m = 4 kg, F = 20 N</write>.',
  'Áp dụng <write id="s1" zone="steps">định luật II Newton cho vật</write>.',
  'Ta có <write id="f1" zone="steps" math="true">a = \\frac{F}{m} = \\frac{20\\ \\text{N}}{4\\ \\text{kg}} = \\frac{20}{4}\\ \\text{m/s}^2 = 5\\ \\text{m/s}^2 = 5{,}0\\ \\text{m/s}^2</write>.',
  'Ghi lại <draw id="d1" zone="diagram" type="table" spec=\'{"header":["Đại lượng","Giá trị"],"rows":[["m","4 kg"],["F","20 N"],["a","5 m/s²"]]}\'/>.',
].join(' ');

/** Rectangles of the board on screen, measured in the page. */
interface Rect {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  styleLeft: string;
  styleTop: string;
}

async function rects(page: Page) {
  return page.evaluate(() => {
    const box = (e: Element) => e.getBoundingClientRect();
    const viewport = document.querySelector('.board__viewport');
    const sheet = document.querySelector('.board__sheet');
    if (!viewport || !sheet) throw new Error('no board');
    const els = [...document.querySelectorAll<HTMLElement>('.board__sheet .board__el')].map(
      (e): Rect => {
        const r = box(e);
        return {
          id: e.dataset.id ?? 'draw',
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          styleLeft: e.style.left,
          styleTop: e.style.top,
        };
      },
    );
    /** The ink of each written element: its lines. */
    const ink = [...document.querySelectorAll<HTMLElement>('.board__sheet [data-id]')].map((e) => {
      const lines = [...e.querySelectorAll('.board__line')].map(box);
      return {
        id: e.dataset.id ?? '',
        lines: lines.length,
        left: Math.min(...lines.map((l) => l.left)),
        right: Math.max(...lines.map((l) => l.right)),
      };
    });
    const v = box(viewport);
    const s = box(sheet);
    const node = viewport as HTMLElement;
    return {
      viewport: { left: v.left, right: v.right, width: node.clientWidth },
      sheet: { left: s.left, right: s.right, top: s.top, width: s.width },
      scroll: { width: node.scrollWidth, client: node.clientWidth },
      els,
      ink,
      katex: [...document.querySelectorAll('.board__sheet .katex')].map((k) => box(k).right),
    };
  });
}

const meet = (a: Rect, b: Rect) =>
  a.left < b.right - 0.5 &&
  b.left < a.right - 0.5 &&
  a.top < b.bottom - 0.5 &&
  b.top < a.bottom - 0.5;

function expectNoOverlap(els: Rect[]) {
  for (let i = 0; i < els.length; i++)
    for (let j = i + 1; j < els.length; j++) {
      const a = els[i];
      const b = els[j];
      if (a && b) expect(meet(a, b), `${a.id} / ${b.id}`).toBe(false);
    }
}

async function askOnBoard(page: Page, text: string) {
  await fakeGemini(page, [{ text, finishReason: 'STOP' }]);
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  await page.getByRole('radio', { name: 'Giảng trên bảng' }).click();
  const board = page.getByRole('region', { name: 'Bảng trắng của AI Teacher' });
  await expect(board).toContainText('Hỏi AI Teacher một câu', { timeout: 20_000 });
  await page.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Giải giúp em bài này');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  return board;
}

test('item 3: steps alone are written across the whole board, nothing overlaps or spills', async ({
  page,
}) => {
  const board = await askOnBoard(page, WIDE_LESSON);
  await board.getByRole('button', { name: 'Viết nhanh' }).click();
  await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({ timeout: 15_000 });
  await expect(board.locator('.board__rules line')).toHaveCount(0);
  const r = await rects(page);
  const steps = r.ink.filter((e) => e.id !== 'h1');
  expect(steps.length).toBeGreaterThanOrEqual(7);
  const first = steps[0];
  if (!first) throw new Error('no step');
  // From the left margin…
  expect((first.left - r.viewport.left) / r.viewport.width).toBeLessThan(0.05);
  // …across most of the board (the old middle column was 40 % of it).
  const widest = Math.max(...steps.map((e) => e.right - e.left));
  expect(widest / r.viewport.width).toBeGreaterThanOrEqual(0.6);
  expectNoOverlap(r.els);
  for (const e of r.els) expect(e.right).toBeLessThanOrEqual(r.viewport.right);
  for (const right of r.katex) expect(right).toBeLessThanOrEqual(r.viewport.right);
  expect(r.scroll.width).toBeLessThanOrEqual(r.scroll.client);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  // The zoom buttons are real targets.
  for (const name of ['Phóng to bảng', 'Thu nhỏ bảng']) {
    const size = await board.getByRole('button', { name }).boundingBox();
    expect(size?.width).toBeGreaterThanOrEqual(40);
    expect(size?.height).toBeGreaterThanOrEqual(40);
  }
});

test('item 3: given data left, steps in the middle, a table right; a long chain on several lines', async ({
  page,
}) => {
  const board = await askOnBoard(page, THREE_LESSON);
  await board.getByRole('button', { name: 'Viết nhanh' }).click();
  await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({ timeout: 15_000 });
  await expect(board.locator('.board__drawing table')).toBeVisible();
  const r = await rects(page);
  const at = (id: string) => r.els.find((e) => e.id === id);
  const given = at('g1');
  const step = at('s1');
  const table = r.els.find((e) => e.id === 'draw');
  expect(given && step && table).toBeTruthy();
  expect(given?.left).toBeLessThan(step?.left ?? 0);
  expect(step?.left).toBeLessThan(table?.left ?? 0);
  // The table is inside its box.
  const inside = await page.evaluate(() => {
    const box = document.querySelector('.board__drawing')?.getBoundingClientRect();
    const table = document.querySelector('.board__drawing table')?.getBoundingClientRect();
    return box && table ? table.right <= box.right + 1 && table.bottom <= box.bottom + 1 : false;
  });
  expect(inside).toBe(true);
  // The chain is written on several lines, all inside the middle region of the board.
  const chain = r.ink.find((e) => e.id === 'f1');
  expect(chain?.lines).toBeGreaterThanOrEqual(2);
  const k = r.sheet.width / 1200;
  expect(chain?.right).toBeLessThanOrEqual(r.sheet.left + (340 + 480) * k + 1);
  for (const right of r.katex) expect(right).toBeLessThanOrEqual(r.sheet.right);
  await expect(board.locator('.board__rules line')).not.toHaveCount(0);
  expectNoOverlap(r.els);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('item 3: resizing the window during a lesson moves nothing on the board', async ({ page }) => {
  await fakeVoice(page);
  const board = await askOnBoard(page, TWO_FACES.replace(/<newboard[^>]*\/>/, ''));
  // Written while the window changes size.
  await expect(board.locator('[data-id="a1"]')).toBeAttached({ timeout: 20_000 });
  const before = (await rects(page)).els;
  for (const size of [
    { width: 1100, height: 700 },
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(300);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  }
  await board.getByRole('button', { name: 'Viết nhanh' }).click();
  await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({ timeout: 15_000 });
  const r = await rects(page);
  for (const old of before) {
    const now = r.els.find((e) => e.id === old.id);
    expect({ left: now?.styleLeft, top: now?.styleTop }).toEqual({
      left: old.styleLeft,
      top: old.styleTop,
    });
  }
  // Drawn where the board says, at the new scale.
  const k = r.sheet.width / 1200;
  for (const e of r.els)
    expect(Math.abs(e.left - r.sheet.left - parseFloat(e.styleLeft) * k)).toBeLessThan(1);
  expectNoOverlap(r.els);
  expect(r.scroll.width).toBeLessThanOrEqual(r.scroll.client);
});

/** A long lesson of long steps: zoomed in, the camera must follow the pen down and across. */
const LONG_LESSON = [
  '# Chuyển động ném ngang',
  '1. Chọn hệ trục tọa độ Oxy có gốc tại điểm ném, trục Ox nằm ngang theo hướng ném và trục Oy hướng thẳng xuống dưới.',
  '2. Theo phương ngang vật không chịu lực nào nên chuyển động thẳng đều với vận tốc bằng vận tốc ném ban đầu.',
  '3. Theo phương thẳng đứng vật chỉ chịu tác dụng của trọng lực nên rơi tự do với gia tốc bằng gia tốc trọng trường.',
  '4. Hai chuyển động thành phần này xảy ra cùng một lúc và hoàn toàn độc lập với nhau trong suốt quá trình bay.',
  '5. Thời gian bay chỉ phụ thuộc vào độ cao lúc ném, không phụ thuộc vào vận tốc ném ban đầu của vật đó.',
  '6. Tầm xa bằng vận tốc ném nhân với thời gian bay, nên ném càng nhanh thì vật rơi xuống càng xa chân tháp.',
  '7. Quỹ đạo của vật là một nhánh parabol, bắt đầu từ điểm ném và cong dần xuống phía mặt đất bên dưới.',
  '8. Vận tốc lúc chạm đất là tổng hợp của vận tốc theo phương ngang và vận tốc theo phương thẳng đứng lúc đó.',
  '9. Muốn kiểm tra kết quả, em hãy so sánh tầm xa tính được với tầm xa đo được trong mô phỏng của bài học.',
].join('\n');

test('item 3: zoomed in, the camera follows the pen down and across the board while it writes', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await fakeVoice(page);
  await fakeGemini(page, [{ text: LONG_LESSON, finishReason: 'STOP' }]);
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  await page.getByRole('radio', { name: 'Giảng trên bảng' }).click();
  const board = page.getByRole('region', { name: 'Bảng trắng của AI Teacher' });
  await expect(board).toContainText('Hỏi AI Teacher một câu', { timeout: 20_000 });
  // Zoom 2 (three steps) before the lesson: it is kept for the whole session.
  for (let n = 0; n < 3; n++) await board.getByRole('button', { name: 'Phóng to bảng' }).click();
  await expect(board.getByRole('button', { name: 'Phóng to bảng' })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Giải thích ném ngang');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await expect(board.locator('.board__pen')).toHaveCount(1, { timeout: 20_000 });
  await board.getByRole('combobox', { name: 'Tốc độ viết' }).selectOption('2');

  // Where the pen tip is, seen from the viewport, every 50 ms until the lesson ends (the
  // reviewer's probe: before the fix the pen was out of view most of the time, scrollTop 0).
  await page.evaluate(() => {
    const samples: PenSample[] = [];
    const timer = window.setInterval(() => {
      const pen = document.querySelector('.board__pen');
      const viewport = document.querySelector<HTMLElement>('.board__viewport');
      if (!pen || !viewport) return;
      const p = pen.getBoundingClientRect();
      const v = viewport.getBoundingClientRect();
      // The tip of the pen icon is its lower left corner.
      const inside = (at: number, from: number, size: number) => at >= from && at <= from + size;
      samples.push({
        x: inside(p.left, v.left, viewport.clientWidth),
        y: inside(p.bottom, v.top, viewport.clientHeight),
        top: viewport.scrollTop,
      });
    }, 50);
    Object.assign(window, {
      __penSamples: () => {
        window.clearInterval(timer);
        return samples;
      },
    });
  });
  await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({ timeout: 90_000 });
  const samples = await page.evaluate(() =>
    (window as unknown as { __penSamples: () => PenSample[] }).__penSamples(),
  );
  expect(samples.length).toBeGreaterThan(100);
  const out = samples.map((s) => !s.x || !s.y);
  let longest = 0;
  let run = 0;
  for (const o of out) {
    run = o ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  // The camera went down the board with the teacher…
  expect(Math.max(...samples.map((s) => s.top))).toBeGreaterThan(0);
  // …the pen was in view nearly all the time (only during a pan to the start of a new line)…
  expect(out.filter(Boolean).length / samples.length).toBeLessThan(0.1);
  expect(samples.filter((s) => !s.y).length / samples.length).toBeLessThan(0.05);
  // …and never out of view for long (20 samples: about 1 s).
  expect(longest).toBeLessThan(20);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('item 3: zoomed in, a resize keeps the part of the board in the middle of the view', async ({
  page,
}) => {
  const board = await askOnBoard(page, LONG_LESSON);
  await board.getByRole('button', { name: 'Viết nhanh' }).click();
  await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({ timeout: 15_000 });
  for (let n = 0; n < 3; n++) await board.getByRole('button', { name: 'Phóng to bảng' }).click();
  await expect(board.getByRole('button', { name: 'Phóng to bảng' })).toBeDisabled();
  /** The board row and column (board units) in the middle of the view, and the room to scroll. */
  const middle = () =>
    page.evaluate(() => {
      const v = document.querySelector<HTMLElement>('.board__viewport');
      const scaler = document.querySelector<HTMLElement>('.board__scaler');
      if (!v || !scaler) throw new Error('no board');
      const scale = scaler.getBoundingClientRect().width / 1200;
      return {
        row: (v.scrollTop + v.clientHeight / 2) / scale,
        column: (v.scrollLeft + v.clientWidth / 2) / scale,
        top: v.scrollTop,
        maxTop: v.scrollHeight - v.clientHeight,
        left: v.scrollLeft,
        maxLeft: v.scrollWidth - v.clientWidth,
      };
    });
  // The learner looks at a part of the board away from its edges.
  await page.evaluate(() => {
    const v = document.querySelector<HTMLElement>('.board__viewport');
    if (!v) return;
    v.scrollTo({
      top: (v.scrollHeight - v.clientHeight) * 0.4,
      left: (v.scrollWidth - v.clientWidth) * 0.4,
      behavior: 'instant',
    });
  });
  await page.waitForTimeout(300);
  const before = await middle();
  expect(before.top).toBeGreaterThan(0);
  expect(before.left).toBeGreaterThan(0);
  // The height alone (the scale stays), then the width and the height (a new scale).
  for (const size of [
    { width: 1366, height: 640 },
    { width: 1100, height: 700 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(400);
    const now = await middle();
    // Not held at an edge: the middle could stay where it was…
    expect(now.top).toBeGreaterThan(0);
    expect(now.top).toBeLessThan(now.maxTop);
    expect(now.left).toBeGreaterThan(0);
    expect(now.left).toBeLessThan(now.maxLeft);
    // …and it did (within 2 board units: a pixel or two of rounding).
    expect(Math.abs(now.row - before.row), JSON.stringify(size)).toBeLessThan(2);
    expect(Math.abs(now.column - before.column), JSON.stringify(size)).toBeLessThan(2);
  }
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

/** One look at the pen while the lesson plays: its tip inside the view sideways / vertically. */
interface PenSample {
  x: boolean;
  y: boolean;
  top: number;
}

test('item 3: faces keep their writing and the learner’s strokes; zoom scrolls inside the board', async ({
  page,
}) => {
  const board = await askOnBoard(page, TWO_FACES);
  await board.getByRole('button', { name: 'Viết nhanh' }).click();
  await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({ timeout: 15_000 });
  const face1 = board.getByRole('tab', { name: /^Bảng 1/ });
  const face2 = board.getByRole('tab', { name: /^Bảng 2/ });
  await expect(face2).toHaveAttribute('aria-selected', 'true');

  // The learner circles a word on the second face, zoomed in and scrolled.
  await board.getByRole('button', { name: 'Phóng to bảng' }).click();
  await board.getByRole('button', { name: 'Phóng to bảng' }).click();
  await expect(board.getByRole('button', { name: 'Vừa khung' })).toBeVisible();
  const scrolled = await page.evaluate(() => {
    const v = document.querySelector<HTMLElement>('.board__viewport');
    if (!v) return null;
    v.scrollTo({ left: v.scrollWidth - v.clientWidth, top: 0, behavior: 'instant' });
    return { width: v.scrollWidth, client: v.clientWidth, left: v.scrollLeft };
  });
  expect(scrolled?.width).toBeGreaterThan(scrolled?.client ?? Infinity);
  expect(scrolled?.left).toBeGreaterThan(0);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  const target = board.locator('[data-id="b1"]');
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error('b1 not on screen');
  await board.getByRole('button', { name: 'Bút của em' }).click();
  const x = box.x + Math.min(box.width / 2, 60);
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y + 4, { steps: 3 });
  await page.mouse.up();
  const stroke = board.locator('.board__student polyline');
  await expect(stroke).toHaveCount(1);
  const points = (await stroke.getAttribute('points')) ?? '';
  const [px, py] = (points.split(' ')[0] ?? '').split(',').map(Number);
  // The point is in board units, inside the element the learner drew on.
  const style = await target.evaluate((e) => ({
    left: parseFloat((e as HTMLElement).style.left),
    top: parseFloat((e as HTMLElement).style.top),
    height: parseFloat((e as HTMLElement).style.height),
    width: parseFloat((e as HTMLElement).style.width),
  }));
  expect(px).toBeGreaterThanOrEqual(style.left);
  expect(px).toBeLessThanOrEqual(style.left + style.width);
  expect(py).toBeGreaterThanOrEqual(style.top);
  expect(py).toBeLessThanOrEqual(style.top + style.height);

  // To the first face and back: the writing and the stroke are where they were.
  const where = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.board__sheet [data-id]')].map((e) => [
        e.dataset.id,
        e.style.left,
        e.style.top,
      ]),
    );
  const onFace2 = await where();
  await face1.click();
  await expect(board.locator('[data-id="a1"]')).toBeVisible();
  await expect(stroke).toHaveCount(0);
  await face2.click();
  expect(await where()).toEqual(onFace2);
  await expect(stroke).toHaveAttribute('points', points);
  await board.getByRole('button', { name: 'Vừa khung' }).click();
  await expect(board.getByRole('button', { name: 'Vừa khung' })).toHaveCount(0);
  await expect(stroke).toHaveAttribute('points', points);
  const fitted = await page.evaluate(() => {
    const v = document.querySelector<HTMLElement>('.board__viewport');
    return v ? v.scrollWidth - v.clientWidth : -1;
  });
  expect(fitted).toBeLessThanOrEqual(0);
});

/** A hand loop around `box` with the mouse (screen px), as a learner circles with "Khoanh để hỏi". */
async function drawLoop(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  pad = 14,
) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rx = box.width / 2 + pad;
  const ry = box.height / 2 + pad;
  const at = (i: number) => {
    const a = (2 * Math.PI * i) / 32;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  };
  await page.mouse.move(at(0).x, at(0).y);
  await page.mouse.down();
  for (let i = 1; i <= 32; i++) await page.mouse.move(at(i).x, at(i).y, { steps: 2 });
  await page.mouse.up();
}

test('item 2: circle a formula and ask about it; the answer is in the chat, the lesson stays', async ({
  page,
}) => {
  const systems = await fakeGemini(page, [
    { text: LESSON, finishReason: 'STOP' },
    { text: 'Công thức này cho biết quãng đường vật rơi sau thời gian t.', finishReason: 'STOP' },
  ]);
  const board = await openBoard(page);
  await page.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Giải bài rơi tự do');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await board.getByRole('button', { name: 'Viết nhanh' }).click();
  await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => systems.length).toBe(1);

  await board.getByRole('button', { name: 'Khoanh để hỏi' }).click();
  const formula = board.locator('.board__el', { has: page.locator('.katex') }).first();
  const box = await formula.boundingBox();
  if (!box) throw new Error('no formula on the board');
  await drawLoop(page, box);
  const bar = board.getByRole('group', { name: 'Chỗ em khoanh trên bảng' });
  await expect(bar).toContainText('Em khoanh:');
  await expect(bar).toContainText('s = 1/2 g t²');
  // The question carries the circled part (the chip above the box says so).
  await expect(page.locator('.chat-panel__board-chip')).toContainText('Hỏi về:');
  await expect(page.locator('.chat-panel')).toContainText('kèm phần chữ em khoanh trên bảng');
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await bar.getByRole('button', { name: 'Hỏi thầy chỗ này' }).click();
  await expect.poll(() => systems.length).toBe(2);
  // The formula's LaTeX, in its fenced block; a chat answer, not a new board lesson.
  expect(systems[1]).toContain('<board_selection>');
  expect(systems[1]).toContain('s = \\frac{1}{2} g t^2');
  expect(systems[1]).not.toContain('CHẾ ĐỘ BẢNG TRẮNG');
  const chat = page.locator('.chat-panel');
  const aside = chat.locator('article.chat-message--assistant').last();
  await expect(aside).toContainText('Công thức này cho biết quãng đường vật rơi', {
    timeout: 15_000,
  });
  await expect(aside).toContainText('Nội dung do AI hỗ trợ');
  await expect(chat.locator('article.chat-message--user').last()).toContainText('Về chỗ em khoanh');
  // The board keeps the original lesson; the answer is not written on it.
  await expect(board.locator('[data-id="h1"]')).toContainText('Rơi tự do');
  await expect(board.locator('.board__el.is-body')).toHaveCount(4);
  await expect(board.locator('.board__sheet')).not.toContainText('Công thức này cho biết');
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('item 2: a loop around nothing gets the app’s own answer and asks the AI nothing', async ({
  page,
}) => {
  const systems = await fakeGemini(page, [{ text: LESSON, finishReason: 'STOP' }]);
  const board = await openBoard(page);
  await page.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Giải bài rơi tự do');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await board.getByRole('button', { name: 'Viết nhanh' }).click();
  await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => systems.length).toBe(1);

  await board.getByRole('button', { name: 'Khoanh để hỏi' }).click();
  const sheet = await board.locator('.board__student').boundingBox();
  if (!sheet) throw new Error('no board');
  // The right of the board, level with the steps: nothing is written there.
  await drawLoop(page, {
    x: sheet.x + sheet.width * 0.82,
    y: sheet.y + sheet.height * 0.5,
    width: 50,
    height: 24,
  });
  const bar = board.getByRole('group', { name: 'Chỗ em khoanh trên bảng' });
  await expect(bar).toContainText('Mình chưa thấy em khoanh vào chữ hay hình nào trên bảng');
  await expect(bar.getByRole('button', { name: 'Hỏi thầy chỗ này' })).toHaveCount(0);
  await expect(page.locator('.chat-panel__board-chip')).toHaveCount(0);
  expect(systems).toHaveLength(1);
});

test('item 2: circling during the lesson pauses it; "Quay lại bài giảng" teaches on to the end', async ({
  page,
}) => {
  await fakeGemini(page, [{ text: LESSON, finishReason: 'STOP' }]);
  const board = await openBoard(page);
  await page.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Giải bài rơi tự do');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  const title = board.locator('[data-id="h1"]');
  await expect(board.getByRole('button', { name: 'Tạm dừng' })).toBeVisible({ timeout: 15_000 });
  await board.getByRole('combobox', { name: 'Tốc độ viết' }).selectOption('2');
  await expect(title).toBeVisible();

  await board.getByRole('button', { name: 'Khoanh để hỏi' }).click();
  const box = await title.boundingBox();
  if (!box) throw new Error('no title');
  await drawLoop(page, box, 10);
  await expect(board.getByRole('button', { name: 'Quay lại bài giảng' })).toBeVisible();
  await expect(board.getByRole('button', { name: 'Tạm dừng' })).toHaveCount(0);
  await expect(board.getByRole('group', { name: 'Chỗ em khoanh trên bảng' })).toBeVisible();

  await board.getByRole('button', { name: 'Quay lại bài giảng' }).click();
  await expect(board.getByRole('group', { name: 'Chỗ em khoanh trên bảng' })).toHaveCount(0);
  await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({ timeout: 45_000 });
  await expect(board.locator('.board__el.is-body')).toHaveCount(4);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('item 2: at 1366×768 the bar stays on the board: the subtitle, the AI label and the loop stay in view', async ({
  page,
}) => {
  const steps = [
    '# Rơi tự do',
    '1. Chọn chiều dương hướng xuống.',
    '2. Viết công thức quãng đường:',
    '$$s = \\frac{1}{2} g t^2$$',
    '3. Thay số đã cho trong đề.',
    '4. Tính thời gian rơi.',
    '5. Tính vận tốc lúc chạm đất.',
    '6. Kiểm tra đơn vị.',
    '7. Kết luận.',
  ].join('\n');
  await fakeGemini(page, [{ text: steps, finishReason: 'STOP' }]);
  const board = await openBoard(page);
  await page.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Giải bài rơi tự do');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await board.getByRole('button', { name: 'Viết nhanh' }).click();
  await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible({ timeout: 15_000 });
  // The toolbar is one row ("Bút của em" and "Vừa khung" show their icon only on this narrow
  // board; the main tools keep their names, see the next test).
  const tool = board.getByRole('button', { name: 'Khoanh để hỏi' });
  expect((await board.locator('.board__toolbar').boundingBox())?.height).toBeLessThanOrEqual(48);
  await tool.click();

  const box = async (selector: string) => {
    const b = await board.locator(selector).first().boundingBox();
    if (!b) throw new Error(`no ${selector}`);
    return { top: b.y, bottom: b.y + b.height, left: b.x, right: b.x + b.width };
  };
  const view = await box('.board__viewport');
  // A big loop over the visible board: many parts, the learner is asked which.
  await drawLoop(page, {
    x: view.left + 40,
    y: view.top + 30,
    width: view.right - view.left - 140,
    height: view.bottom - view.top - 80,
  });
  const bar = board.getByRole('group', { name: 'Chỗ em khoanh trên bảng' });
  await expect(bar).toContainText('Em khoanh khá nhiều chỗ');
  await expect(bar.getByRole('button', { name: 'Cả phần này' })).toBeInViewport();
  await expect(bar.getByRole('button', { name: 'Bỏ chọn' })).toBeInViewport({ ratio: 1 });
  // Inside the board's area: the subtitle and the AI label below are never covered.
  const shown = await box('.board__ask-bar');
  const area = await box('.board__area');
  expect(shown.bottom).toBeLessThanOrEqual(area.bottom + 0.5);
  expect(shown.bottom).toBeLessThanOrEqual((await box('.board__subtitle')).top);
  const covered = await page.evaluate(() => {
    const label = document.querySelector('.board .ai-label');
    if (!label) return 'no label';
    const r = label.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return top && label.contains(top) ? null : (top?.className ?? 'nothing');
  });
  expect(covered).toBeNull();
  // The board did not change size when the bar appeared.
  expect(await box('.board__viewport')).toEqual(view);

  // A loop low in the view: the bar goes above it, the board does not move, the loop stays seen.
  await bar.getByRole('button', { name: 'Khoanh lại' }).click();
  const low = await page.evaluate((v) => {
    for (const el of document.querySelectorAll('.board__el.is-body')) {
      const r = el.getBoundingClientRect();
      const middle = r.top + r.height / 2;
      if (middle > v.top + (v.bottom - v.top) * 0.55 && r.bottom < v.bottom - 30)
        return { x: r.left, y: r.top, width: Math.min(r.width, 300), height: r.height };
    }
    return null;
  }, view);
  if (!low) throw new Error('no step low in the view');
  const scrolled = () =>
    page.evaluate(() => document.querySelector('.board__viewport')?.scrollTop ?? -1);
  const before = await scrolled();
  await drawLoop(page, low, 8);
  await expect(bar).toContainText('Em khoanh:');
  await expect(bar).toHaveClass(/is-top/);
  expect(await scrolled()).toBe(before);
  const hit = await box('.board__hit');
  const top = await box('.board__ask-bar');
  expect(top.bottom).toBeLessThanOrEqual(hit.top);
  expect(hit.bottom).toBeLessThanOrEqual(view.bottom);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

/** Opens AI Teacher on the board layout (the board is lazy-loaded). */
test('item 2: at 1366×768 "Khoanh để hỏi" and "Viết nhanh" keep their names; one row while asking, zoomed in', async ({
  page,
}) => {
  await fakeGemini(page, [{ text: LESSON, finishReason: 'STOP' }]);
  const board = await openBoard(page);
  // The UI font is wider on Linux than Segoe UI on Windows (the toolbar wrapped on CI only): the
  // toolbar is checked with a wide font and wider spacing on every system, so it has to fold.
  await page.addStyleTag({
    content: `.board__toolbar, .board__toolbar button, .board__toolbar select {
      font-family: Verdana, 'DejaVu Sans', sans-serif; letter-spacing: 0.05em; }`,
  });
  await page.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Giải bài rơi tự do');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await expect(board.getByRole('button', { name: 'Tạm dừng' })).toBeVisible({ timeout: 15_000 });
  // The slowest pen: the lesson is still being written while the learner circles.
  await board.getByRole('combobox', { name: 'Tốc độ viết' }).selectOption('0.75');
  /** The width of a button's own name as it is drawn (1 px or less: hidden, icon only). */
  const labelWidth = async (name: string) =>
    (await board.getByRole('button', { name }).locator('.board__tool-label').boundingBox())
      ?.width ?? 0;
  const toolbarHeight = async () =>
    (await board.locator('.board__toolbar').boundingBox())?.height ?? 0;
  const check = async () => {
    // On touch there is no tooltip: the main tools show their names.
    expect(await labelWidth('Khoanh để hỏi')).toBeGreaterThan(40);
    expect(await labelWidth('Viết nhanh')).toBeGreaterThan(40);
    expect(await labelWidth('Bút của em')).toBeLessThanOrEqual(1);
    expect(await toolbarHeight()).toBeLessThanOrEqual(48);
    // Every control is at least as tall as a touch target.
    const heights = await board
      .locator('.board__toolbar button, .board__toolbar select')
      .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().height));
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(40);
  };
  await check();

  // The widest state: zoomed in ("Vừa khung" appears) and paused to ask ("Quay lại bài giảng").
  await board.getByRole('button', { name: 'Phóng to bảng' }).click();
  await expect(board.getByRole('button', { name: 'Vừa khung' })).toBeVisible();
  await board.getByRole('button', { name: 'Khoanh để hỏi' }).click();
  const title = board.locator('[data-id="h1"]');
  const box = await title.boundingBox();
  if (!box) throw new Error('no title');
  await drawLoop(page, box, 10);
  await expect(board.getByRole('button', { name: 'Quay lại bài giảng' })).toBeVisible();
  await check();
  expect(await labelWidth('Vừa khung')).toBeLessThanOrEqual(1);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

async function openBoard(page: Page) {
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  await page.getByRole('radio', { name: 'Giảng trên bảng' }).click();
  const board = page.getByRole('region', { name: 'Bảng trắng của AI Teacher' });
  await expect(board).toContainText('Hỏi AI Teacher một câu', { timeout: 20_000 });
  return board;
}
