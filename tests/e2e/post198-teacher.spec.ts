import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { fulfillGemini } from './fakeAi';

/**
 * AI Teacher checks written after PR #198 for the bench (tests/e2e/bench, no longer run), carried
 * over to the classic window at 1366 × 768: the one age rule on every way in, the page's words
 * (#205 B5, user decision 14/11/2026), the page in the app's look (user request 18/11/2026; #234's
 * station before: the app's tabs, no second connection chip, the orb's place, the app's chat
 * cards, the Advanced pages Ghi nhớ and Lượt dùng) and the
 * board's quick requests (#205 B9). What each test checks is unchanged; the bench header's parts
 * (its h1 "AI Teacher") are not in the classic window, the top bar's AI pill is.
 */

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function settings(
  page: Page,
  theme: 'light' | 'dark',
  fontScale = 1,
  uiMode: 'basic' | 'advanced' = 'basic',
) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(
    ([t, scale, mode]) => {
      localStorage.setItem(
        'stemsim.settings',
        JSON.stringify({
          state: { locale: 'vi', fontScale: scale, theme: t, uiMode: mode },
          version: 2,
        }),
      );
    },
    [theme, fontScale, uiMode] as const,
  );
}

async function openTeacher(page: Page) {
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  const screen = page.getByRole('region', { name: 'Dạy học bằng AI' });
  // The first open of the lazy page compiles it on the dev server (up to 20 s).
  await expect(screen).toBeVisible({ timeout: 20_000 });
  return screen;
}

// ───────────── One age rule on every way in (safetyStore `teacherLocked`) ─────────────

async function teacherCommands(page: Page) {
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Tìm nhanh' });
  await expect(palette).toBeVisible({ timeout: 20_000 });
  await palette.getByRole('combobox').fill('AI Teacher');
  return palette.getByRole('option', { name: /AI Teacher —/ });
}

test.describe('under 18 (age question not answered yet)', () => {
  test.use({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:1420',
          // The first-run steps already seen, as in ai-flow.spec.ts: the age question comes alone.
          localStorage: [
            { name: 'stemsim.tourDone', value: '1' },
            { name: 'stemsim.whatsnew', value: '{"lastSeen": "999.0.0"}' },
          ],
        },
      ],
    },
  });

  test('the launch card opens no AI Teacher and Ctrl+K has no AI Teacher command', async ({
    page,
  }) => {
    await page.goto('/');
    const gate = page.getByRole('dialog', { name: 'Trước khi bắt đầu' });
    await expect(gate).toBeVisible({ timeout: 20_000 });
    await gate.getByRole('button', { name: 'Tôi chưa đủ 18 tuổi' }).click();
    await expect(gate).toHaveCount(0);

    // The door stays shut whichever way it is asked: the card (off, and it says why), then the
    // palette.
    const card = page.locator('.launch-card--teacher');
    await expect(card).toBeDisabled();
    await expect(card).toContainText('AI Teacher cần bạn đủ 18 tuổi');
    await expect(page.getByRole('region', { name: 'Dạy học bằng AI' })).toHaveCount(0);
    await expect(page.locator('.launch-card--lab')).toBeVisible();
    const commands = await teacherCommands(page);
    await expect(commands).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: 'Dạy học bằng AI' })).toHaveCount(0);
  });
});

test('18 and over: Ctrl+K offers both AI Teacher pages and opens one', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Virtual Lab/ })).toBeVisible({ timeout: 20_000 });
  const commands = await teacherCommands(page);
  await expect(commands).toHaveCount(2);
  await commands.filter({ hasText: 'AI Teacher — trò chuyện' }).click();
  await expect(page.getByRole('region', { name: 'Dạy học bằng AI' })).toBeVisible({
    timeout: 20_000,
  });
});

// ───────────── The page's words (#205 B5, user decision 14/11/2026) ─────────────

test('the AI Teacher page says it is an AI in the chat footer; no "Là một AI" chip', async ({
  page,
}) => {
  const screen = await openTeacher(page);
  await expect(screen.locator('.chat-panel__footer')).toContainText(
    'Câu trả lời AI có thể chưa chính xác',
  );
  // No separate "Là một AI" chip (user decision 14/11/2026).
  await expect(page.getByText('Là một AI', { exact: true })).toHaveCount(0);
});

for (const fontScale of [1, 1.4] as const) {
  test(`AI Teacher at ${String(fontScale * 100)} %: no repeated notice, "Kết nối AI", "Deepthink", a wider chat`, async ({
    page,
  }) => {
    await settings(page, 'light', fontScale);
    const room = await openTeacher(page);
    // The room does not repeat its region's name as a title.
    await expect(room.getByText('Dạy học bằng AI', { exact: true })).toHaveCount(0);

    // Not connected: no notice bar; the empty conversation's button opens Kết nối AI.
    await expect(room.getByText(/Chưa kết nối AI/)).toHaveCount(0);
    await room.getByRole('button', { name: 'Kết nối AI' }).click();
    const sheet = page.getByRole('dialog', { name: 'Cài đặt' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('tab', { name: 'Kết nối AI', selected: true })).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(room.getByRole('button', { name: /Deepthink/ })).toBeVisible();

    // The conversation takes at least 70 % of the room's width (the face column was 30 %).
    const chat = await room.getByRole('main').boundingBox();
    const whole = await room.boundingBox();
    expect((chat?.width ?? 0) / (whole?.width ?? 1)).toBeGreaterThanOrEqual(0.7);
    expect(await overflow(page)).toBe(0);
  });
}

// ───────────── The page in the app's look (#234 steps 4–5, 18/11/2026) ─────────────

/** The orb's box once its glide (glide.ts) has played. */
async function settledBox(slot: Locator) {
  await slot.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const box = await slot.boundingBox();
  if (!box) throw new Error('the orb has no box');
  return box;
}

async function seriousForAxe(page: Page) {
  const result = await new AxeBuilder({ page }).include('.teacher').analyze();
  return result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.id} (${v.nodes.map((n) => `${n.target.join(' ')}: ${n.any.map((a) => a.message).join(' ')}`).join(' | ')})`,
    );
}

for (const theme of ['light', 'dark'] as const)
  for (const fontScale of [1, 1.4])
    test(`page, ${theme}, ${String(fontScale * 100)} %: app tabs, no chip, talk ↔ board, no horizontal scroll`, async ({
      page,
    }) => {
      await settings(page, theme, fontScale);
      const screen = await openTeacher(page);

      // Trò chuyện · Bảng giảng: the layout switch keeps its radios and their names.
      const tabs = screen.getByRole('radiogroup', { name: 'Các trang của AI Teacher' });
      const talk = tabs.getByRole('radio', { name: 'Trò chuyện' });
      const board = tabs.getByRole('radio', { name: 'Bảng giảng' });
      await expect(talk).toHaveAttribute('aria-checked', 'true');
      // Basic mode: the two layouts only (03 Ghi nhớ and 04 Lượt dùng are Advanced pages).
      await expect(tabs.getByRole('radio')).toHaveCount(2);
      // The app's tabs (as in the bottom panel): an icon and the name each, the open one marked.
      await expect(tabs.getByRole('radio').locator('svg')).toHaveCount(2);
      await expect(talk).toHaveClass(/\btabs__tab\b.*\bis-selected\b/);
      await expect(board).not.toHaveClass(/\bis-selected\b/);
      for (const tab of [talk, board])
        expect((await tab.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(40);

      // Not connected: the top bar's pill says so, and the room has no chip claiming an AI
      // (#233: the old one said "AI trực tuyến"; #205 B5: the room never repeats "Chưa kết nối").
      await expect(page.locator('.ai-status__label')).toHaveText('Chưa kết nối AI');
      await expect(screen.locator('.teacher__link')).toHaveCount(0);

      // The orb is aria-hidden; its state is said in a polite live region.
      const state = screen.locator('.teacher__state');
      await expect(state).toHaveAttribute('aria-live', 'polite');
      await expect(state).toHaveText('Đang chờ');

      // Talk: the orb at the left of the conversation, level with its top; the conversation
      // keeps the page's height (an orb above it left the answers ~180 px at 1366 × 768).
      const slot = screen.locator('.teacher__orb-slot');
      const chat = screen.locator('.teacher__chat-wrap');
      const orbTalk = await settledBox(slot);
      const chatBox = await chat.boundingBox();
      if (!chatBox) throw new Error('no chat box');
      expect(orbTalk.x + orbTalk.width).toBeLessThanOrEqual(chatBox.x);
      expect(orbTalk.y).toBeGreaterThanOrEqual(chatBox.y);
      expect(orbTalk.y).toBeLessThanOrEqual(chatBox.y + 40);
      expect(chatBox.height).toBeGreaterThan(560);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      expect(await seriousForAxe(page)).toEqual([]);

      // Board: the orb small in the top-left corner, the board beside it.
      await board.click();
      await expect(screen).toHaveAttribute('data-layout', 'board');
      const whiteboard = page.getByRole('region', { name: 'Bảng trắng của AI Teacher' });
      await expect(whiteboard).toBeVisible({ timeout: 20_000 });
      const orbBoard = await settledBox(slot);
      const boardBox = await whiteboard.boundingBox();
      if (!boardBox) throw new Error('no board box');
      expect(orbBoard.width).toBeCloseTo(88, 0);
      expect(orbBoard.x + orbBoard.width).toBeLessThanOrEqual(boardBox.x);
      expect(orbBoard.y).toBeLessThanOrEqual(boardBox.y + 8);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      expect(await seriousForAxe(page)).toEqual([]);

      await talk.click();
      await expect(screen).toHaveAttribute('data-layout', 'talk');
      expect((await settledBox(slot)).width).toBeCloseTo(orbTalk.width, 0);
    });

test('the orb glides to the corner, and jumps there under reduced motion', async ({ page }) => {
  // Counts the glides started on the orb's slot. Counting the animations still playing raced the
  // 500 ms glide on a slow runner (the board's first compile can outlast it, PR #254).
  await page.addInitScript(() => {
    const w = window as unknown as { __orbGlides: number };
    w.__orbGlides = 0;
    // eslint-disable-next-line @typescript-eslint/unbound-method -- re-applied to the same element below
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      if (this.classList.contains('teacher__orb-slot')) w.__orbGlides += 1;
      return animate.apply(this, args);
    };
  });
  await settings(page, 'dark');
  const screen = await openTeacher(page);
  const slot = screen.locator('.teacher__orb-slot');
  const glides = () =>
    page.evaluate(() => (window as unknown as { __orbGlides: number }).__orbGlides);
  await settledBox(slot);
  expect(await glides()).toBe(0);
  await screen.getByRole('radio', { name: 'Bảng giảng' }).click();
  await expect(screen).toHaveAttribute('data-layout', 'board');
  expect(await glides()).toBe(1);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await settledBox(slot);
  await screen.getByRole('radio', { name: 'Trò chuyện' }).click();
  await expect(screen).toHaveAttribute('data-layout', 'talk');
  // The layout effect runs with the switch's commit: no second glide under reduced motion.
  expect(await glides()).toBe(1);
});

for (const tier of ['medium', 'low'] as const)
  test(`an answer on the app's chat card (${tier} tier): AI label, report button, state "Đã trả lời"`, async ({
    page,
  }) => {
    await settings(page, 'dark');
    await page.addInitScript((preference) => {
      globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'test-key';
      localStorage.setItem(
        'stemsim.perf',
        JSON.stringify({ state: { preference, benchmark: null }, version: 1 }),
      );
    }, tier);
    const answer = 'Gia tốc rơi tự do gần mặt đất là g ≈ 9,8 m/s², hướng xuống.';
    await page.route('https://generativelanguage.googleapis.com/v1beta/**', (route) =>
      fulfillGemini(route, answer),
    );
    const screen = await openTeacher(page);
    // Connected: the top bar's pill names who answers; the page does not say it a second time.
    await expect(page.locator('.ai-status__label')).toHaveText('Đã kết nối Gemini');
    await expect(screen.locator('.teacher__link')).toHaveCount(0);

    const panel = page.getByRole('region', { name: 'Trò chuyện với AI Teacher' });
    await panel.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Gia tốc rơi tự do?');
    await panel.getByRole('button', { name: 'Gửi câu hỏi' }).click();
    const card = panel.locator('.chat-message--assistant .chat-message__body').last();
    await expect(card).toContainText(answer);
    await expect(card.getByText(/mô hình gemini-test/)).toBeVisible();
    await expect(
      card.getByRole('button', { name: 'Báo cáo nội dung không phù hợp' }),
    ).toBeVisible();
    await expect(screen.locator('.teacher__state')).toHaveText('Đã trả lời');

    // The app's look on every tier: the answer on the chat card of the lab's bubble
    // (--bg-panel-2), the conversation on the app's panel (--bg-panel); opaque, no backdrop-filter.
    const look = (el: Element, token: string) => {
      const probe = document.createElement('i');
      probe.style.background = `var(${token})`;
      el.append(probe);
      const want = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, want, blur: s.backdropFilter };
    };
    const cardLook = await card.evaluate(look, '--bg-panel-2');
    expect(cardLook.bg).toBe(cardLook.want);
    expect(cardLook.blur).toBe('none');
    const panelLook = await panel.evaluate(look, '--bg-panel');
    expect(panelLook.bg).toBe(panelLook.want);
    expect(panelLook.blur).toBe('none');
    expect(cardLook.want).toMatch(/^rgb\(/);
  });

for (const fontScale of [1, 1.4])
  test(`Advanced, ${String(fontScale * 100)} %: 03 Ghi nhớ and 04 Lượt dùng say real facts; a typed question stays`, async ({
    page,
  }) => {
    await settings(page, 'dark', fontScale, 'advanced');
    const screen = await openTeacher(page);
    const tabs = screen.getByRole('radiogroup', { name: 'Các trang của AI Teacher' });
    await expect(tabs.getByRole('radio')).toHaveCount(4);
    // The app's tabs: an icon and the name each (Ghi nhớ, Lượt dùng: their pages' own icons).
    await expect(tabs.getByRole('radio').locator('svg')).toHaveCount(4);
    for (const tab of await tabs.getByRole('radio').all())
      expect((await tab.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(40);

    const conversation = page.getByRole('region', { name: 'Trò chuyện với AI Teacher' });
    const question = conversation.getByRole('textbox', { name: 'Nhập câu hỏi' });
    await question.fill('Vì sao trời xanh?');

    await tabs.getByRole('radio', { name: 'Ghi nhớ' }).click();
    await expect(screen.getByRole('heading', { name: 'AI Teacher đang nhớ gì' })).toBeVisible();
    await expect(screen.getByText('Chưa có gì để nhớ: cuộc trò chuyện còn trống.')).toBeVisible();
    await expect(conversation).toBeHidden();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    expect(await seriousForAxe(page)).toEqual([]);

    await tabs.getByRole('radio', { name: 'Lượt dùng' }).click();
    await expect(
      screen.getByRole('heading', { name: 'Lượt dùng AI trực tuyến hôm nay' }),
    ).toBeVisible();
    // The day counter is the desktop app's (ai_usage): the browser build says so, with no number.
    await expect(
      screen.getByText('Số lượt chỉ đếm được trong ứng dụng SimLab trên máy tính.'),
    ).toBeVisible();
    await expect(screen.getByText(/Hôm nay đã dùng/)).toHaveCount(0);
    await expect(screen).not.toContainText(/token|LLM|JSON/i);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    expect(await seriousForAxe(page)).toEqual([]);

    await tabs.getByRole('radio', { name: 'Trò chuyện' }).click();
    await expect(question).toHaveValue('Vì sao trời xanh?');
  });

test('an Advanced page left open: switching to Basic shows the conversation again', async ({
  page,
}) => {
  await settings(page, 'light', 1, 'advanced');
  const screen = await openTeacher(page);
  const tabs = screen.getByRole('radiogroup', { name: 'Các trang của AI Teacher' });
  await tabs.getByRole('radio', { name: 'Lượt dùng' }).click();
  await expect(
    screen.getByRole('heading', { name: 'Lượt dùng AI trực tuyến hôm nay' }),
  ).toBeVisible();

  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Tìm nhanh' });
  await palette.getByRole('combobox').fill('cơ bản');
  await palette.getByRole('option', { name: 'Chuyển sang chế độ Cơ bản' }).click();

  await expect(tabs.getByRole('radio')).toHaveCount(2);
  await expect(tabs.getByRole('radio', { name: 'Trò chuyện' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('region', { name: 'Trò chuyện với AI Teacher' })).toBeVisible();
  await expect(
    screen.getByRole('heading', { name: 'Lượt dùng AI trực tuyến hôm nay' }),
  ).toHaveCount(0);
});

// ───────────── The teaching board (#205 B9) ─────────────

const LESSON = [
  '# Rơi tự do',
  '1. Chọn chiều dương hướng xuống.',
  '2. Viết công thức quãng đường:',
  '$$s = \\frac{1}{2} g t^2$$',
  '3. Thay số đã cho trong đề.',
].join('\n');

for (const fontScale of [1, 1.4] as const) {
  test(`the teaching board at ${String(fontScale * 100)} %: quick requests and the report button are 40 px targets`, async ({
    page,
  }) => {
    await settings(page, 'light', fontScale);
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
    expect(await overflow(page)).toBe(0);
  });
}
