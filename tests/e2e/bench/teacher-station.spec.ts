import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { fulfillGemini } from '../fakeAi';

/**
 * AI Teacher's station (#234 step 4) at 1366 × 768: numbered tabs, the connection chip (the
 * header pill's words, only while an AI can answer), the orb beside the conversation (talk) and
 * small in the top-left corner (board), AI Teacher's answers on glass cards, opaque on the Low tier. Light and dark,
 * Cỡ chữ 100 % and 140 %: no horizontal scroll, 40 px tabs, nothing serious for axe.
 */

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function settings(page: Page, theme: 'light' | 'dark', fontScale = 1) {
  await page.addInitScript(
    ([t, scale]) => {
      localStorage.setItem(
        'stemsim.settings',
        JSON.stringify({ state: { locale: 'vi', fontScale: scale, theme: t }, version: 2 }),
      );
    },
    [theme, fontScale] as const,
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
    test(`station, ${theme}, ${String(fontScale * 100)} %: tabs, chip, talk ↔ board, no horizontal scroll`, async ({
      page,
    }) => {
      await settings(page, theme, fontScale);
      const screen = await openTeacher(page);

      // 01 TRÒ CHUYỆN · 02 BẢNG GIẢNG: the layout switch keeps its radios and their names.
      const tabs = screen.getByRole('radiogroup', { name: 'Xem thử bố cục' });
      const talk = tabs.getByRole('radio', { name: 'Trò chuyện' });
      const board = tabs.getByRole('radio', { name: 'Bảng giảng' });
      await expect(talk).toHaveAttribute('aria-checked', 'true');
      await expect(tabs).toContainText('01');
      await expect(tabs).toContainText('02');
      for (const tab of [talk, board])
        expect((await tab.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(40);

      // Not connected: the header's pill says so, and the room has no chip claiming an AI
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
  await settings(page, 'dark');
  const screen = await openTeacher(page);
  const slot = screen.locator('.teacher__orb-slot');
  const playing = () => slot.evaluate((el) => el.getAnimations().length);
  await settledBox(slot);
  await screen.getByRole('radio', { name: 'Bảng giảng' }).click();
  expect(await playing()).toBe(1);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await settledBox(slot);
  await screen.getByRole('radio', { name: 'Trò chuyện' }).click();
  await expect(screen).toHaveAttribute('data-layout', 'talk');
  expect(await playing()).toBe(0);
});

for (const tier of ['medium', 'low'] as const)
  test(`an answer on a glass card (${tier} tier): AI label, report button, state "Đã trả lời"`, async ({
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
    await expect(screen).toHaveAttribute('data-glass', tier === 'low' ? 'solid' : 'glass');
    // Connected: the chip names who answers, in the header pill's words.
    await expect(page.locator('.ai-status__label')).toHaveText('Đã kết nối Gemini');
    await expect(screen.locator('.teacher__link')).toHaveText(
      (await page.locator('.ai-status__label').textContent()) ?? '',
    );

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

    // Translucent glass, or an opaque card on the Low tier; never a backdrop-filter.
    const look = await card.evaluate((el) => {
      const s = getComputedStyle(el);
      const alpha =
        /\/\s*([\d.]+)\s*\)$/.exec(s.backgroundColor)?.[1] ??
        /^rgba\([^)]*,\s*([\d.]+)\)$/.exec(s.backgroundColor)?.[1] ??
        '1';
      return { alpha: Number(alpha), blur: s.backdropFilter };
    });
    expect(look.blur).toBe('none');
    if (tier === 'low') expect(look.alpha).toBe(1);
    else expect(look.alpha).toBeLessThan(1);
  });
