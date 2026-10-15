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
  await board.getByRole('radio', { name: '2×' }).click();

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
