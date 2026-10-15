import { expect, test, type Page } from '@playwright/test';
import { fulfillGemini } from './fakeAi';

/**
 * A whole learning session with the AI Teacher (audit H, 2026-10-13): question → lesson spoken
 * and written on the board → pause / resume → check question → the learner answers → feedback →
 * the related simulation opens. Gemini and the Windows voice are fakes; what the voice was given
 * is recorded so the test can check that speech and board tell the same thing.
 */

const LESSON = [
  'Hôm nay mình xét <write id="t1" zone="title" role="heading">Vì sao NST nhân đôi trước nguyên phân</write> nhé.',
  'Ở kì trung gian, trong pha S, <write id="k1" zone="steps" role="keyword">ADN nhân đôi</write><underline target="k1"/>.',
  'Nhờ đó mỗi nhiễm sắc thể có hai cromatit chị em, và <write id="r1" zone="steps" role="result">mỗi tế bào con nhận đủ bộ 2n</write><box target="r1"/>.',
  'Lỗi hay gặp là nghĩ ADN nhân đôi ở kì đầu.',
  'Câu hỏi kiểm tra: ADN nhân đôi ở pha nào của chu kì tế bào?',
].join(' ');
const FEEDBACK =
  'Chưa đúng: ở kì giữa nhiễm sắc thể đã là nhiễm sắc thể kép rồi. ADN nhân đôi ở pha S của kì trung gian. Em thử nói lại: vì sao ở kì giữa mỗi nhiễm sắc thể có hai cromatit?';

async function setUp(page: Page, opts: { down?: boolean } = {}) {
  const calls: string[] = [];
  await page.addInitScript(() => {
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'test-key';
    localStorage.setItem(
      'stemsim.teacher-voice',
      JSON.stringify({
        state: { enabled: true, engine: 'system', style: 'vui', speed: 1, voiceURI: '' },
        version: 2,
      }),
    );
    // Fake Windows voice: "speaks" 25 ms per character and records what it was given.
    const log: string[] = [];
    (window as unknown as { __speech: string[] }).__speech = log;
    let current: {
      onend?: () => void;
      onerror?: (e: { error: string }) => void;
      timer?: number;
    } | null = null;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [],
        speak(u: SpeechSynthesisUtterance & { timer?: number }) {
          log.push(u.text);
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
          // Like Chrome: cancelling the phrase being spoken fires "error" with "interrupted".
          c?.onerror?.({ error: 'interrupted' });
        },
        addEventListener() {},
        removeEventListener() {},
      },
    });
  });
  await page.route('https://generativelanguage.googleapis.com/v1beta/**', (route) => {
    if (opts.down) return route.abort('internetdisconnected');
    const body = route.request().postData() ?? '';
    calls.push(body);
    const text = calls.length === 1 ? LESSON : FEEDBACK;
    return fulfillGemini(route, text);
  });
  return calls;
}

test('a whole session: lesson on the board with voice, check question, feedback, simulation', async ({
  page,
}) => {
  const calls = await setUp(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  await page.getByRole('radio', { name: 'Giảng trên bảng' }).click();
  const board = page.getByRole('region', { name: 'Bảng trắng của AI Teacher' });
  const panel = page.getByRole('region', { name: 'Trò chuyện với AI Teacher' });
  await panel
    .getByRole('textbox', { name: 'Nhập câu hỏi' })
    .fill('Vì sao nhiễm sắc thể phải nhân đôi trước khi tế bào nguyên phân?');
  await panel.getByRole('button', { name: 'Gửi câu hỏi' }).click();

  // The cloud AI was asked for a board lesson with a check question at the end.
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toContain('CHẾ ĐỘ BẢNG TRẮNG');
  expect(calls[0]).toContain('câu hỏi kiểm tra');

  // Board and voice tell the same thing: the written words are read where they stand.
  await expect(board.locator('[data-id="k1"]')).toBeVisible({ timeout: 15_000 });
  const speech = () => page.evaluate(() => (window as unknown as { __speech: string[] }).__speech);
  // "ADN nhân đôi" on the board is heard as "a đê nờ nhân đôi".
  await expect.poll(async () => (await speech()).join(' ')).toContain('a đê nờ nhân đôi');

  // Pause and resume: the sentence that was cut is read again, nothing is lost.
  await board.getByRole('button', { name: 'Tạm dừng' }).click();
  const paused = (await speech()).length;
  await page.waitForTimeout(400);
  expect((await speech()).length).toBe(paused);
  await board.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect
    .poll(async () => (await speech()).join(' '), { timeout: 30_000 })
    .toContain('pha nào của chu kì tế bào');
  await expect(board.locator('.board__mark.is-box.is-shown')).toHaveCount(1, { timeout: 30_000 });
  // No spoken fragment like "Đề cho." or "là." without what was written.
  for (const line of await speech()) expect(line).not.toMatch(/[,:]\.$|\s\.$/);

  // The chat offers the matching simulation; the learner answers the check question first.
  await expect(panel.getByRole('button', { name: 'Xem mô phỏng: Nguyên phân' })).toBeVisible();
  await panel.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Ở kì giữa ạ.');
  await panel.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await expect.poll(() => calls.length).toBe(2);
  // The second request carries the conversation (the lesson and its check question).
  expect(calls[1]).toContain('pha nào của chu kì tế bào');
  await expect(panel.getByText(/Chưa đúng: ở kì giữa/).first()).toBeVisible({ timeout: 15_000 });

  // The simulation link survives the short reply and opens the lab topic.
  await panel.getByRole('button', { name: 'Xem mô phỏng: Nguyên phân' }).click();
  await expect(page.locator('.science-card')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.science-card')).toContainText('Nguyên phân');
  expect(errors).toEqual([]);
});

test('no network: the session says so clearly and nothing hangs', async ({ page }) => {
  await setUp(page, { down: true });
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  const panel = page.getByRole('region', { name: 'Trò chuyện với AI Teacher' });
  await panel.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Nguyên phân là gì?');
  await panel.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await expect(panel.getByRole('alert')).toBeVisible({ timeout: 20_000 });
  // The learner can ask again: the send button comes back.
  await panel.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Thử lại');
  await expect(panel.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled();
});
