import { expect, test, type Page } from '@playwright/test';
import { openLab } from './nav';

/** "AI Teacher": launch page entry, the full teacher page and the floating chat bubble. */

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('the AI teacher page: honest label, no screen toggle, fits 1366×768, Esc goes back', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  const screen = page.getByRole('region', { name: 'Dạy học bằng AI' });
  await expect(screen).toBeVisible();
  await expect(screen.getByText('AI Teacher', { exact: true }).first()).toBeVisible();
  // The screen-context switch belongs to the bubble only.
  await expect(page.getByRole('checkbox', { name: 'Lấy thông tin từ màn hình' })).toHaveCount(0);
  // No API key and no local model: a clear notice, never a pretend answer.
  await expect(page.getByText(/Chưa có API/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cài đặt' }).first()).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  for (const name of ['Gửi câu hỏi', 'Về trang chủ']) {
    const box = await screen.getByRole('button', { name }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  }
  // Compact page: the lab's subject switch is not shown, and "Chậm hơn"… wait for an answer.
  await expect(page.getByRole('radiogroup', { name: 'Môn học' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Em chưa hiểu chỗ này' })).toHaveCount(0);

  await page.getByRole('radio', { name: 'Giảng trên bảng' }).click();
  await expect(screen).toHaveAttribute('data-layout', 'board');
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await page.keyboard.press('Escape');
  await expect(page.locator('.launch-card--lab')).toBeVisible();
});

test('chat bubble: screen toggle off by default, Think explains the missing second key', async ({
  page,
}) => {
  await openLab(page);
  await page.getByRole('button', { name: 'AI Teacher', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Trò chuyện với AI Teacher' });
  await expect(panel).toBeVisible();
  const toggle = panel.getByRole('checkbox', { name: 'Lấy thông tin từ màn hình' });
  await expect(toggle).not.toBeChecked();
  await toggle.check({ force: true });
  await expect(toggle).toBeChecked();

  // Closing and opening the bubble again starts with the toggle off.
  await page.getByRole('button', { name: 'Đóng chat' }).first().click();
  await page.getByRole('button', { name: 'AI Teacher', exact: true }).click();
  await expect(
    panel.getByRole('checkbox', { name: 'Lấy thông tin từ màn hình' }),
  ).not.toBeChecked();

  await panel.getByRole('button', { name: /Think/ }).click();
  await expect(
    panel
      .getByRole('status')
      .filter({ hasText: /API|khóa/ })
      .first(),
  ).toBeVisible();

  // "Cài đặt" lands on the right page of Settings.
  await panel.getByRole('button', { name: 'Cài đặt' }).click();
  const shown = page.locator('.settings-panel:not([hidden])');
  await expect(shown).toHaveAttribute('id', /^settings-(ai|teacher|local)$/);
  await expect(shown).toBeInViewport();
});

test('knowledge library: add a .txt file, refuse a .pdf, Wikipedia stays off', async ({ page }) => {
  await openLab(page);
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).first().click();
  const settings = page.getByRole('dialog', { name: 'Cài đặt' });
  await settings.getByRole('tab', { name: 'AI Teacher' }).click();
  await expect(page.locator('#settings-teacher').getByText('Dữ liệu của em đi đâu?')).toBeVisible();

  await settings.getByRole('tab', { name: 'Thư viện kiến thức' }).click();
  const teacher = page.locator('#settings-knowledge');
  await expect(teacher.getByRole('checkbox', { name: /Tra thêm Wikipedia/ })).not.toBeChecked();
  const input = teacher.locator('input[type="file"]');
  await input.setInputFiles({
    name: 'dong-luc-hoc.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Định luật II Newton: F = m·a.'),
  });
  await expect(teacher.getByText('dong-luc-hoc.txt')).toBeVisible();

  await input.setInputFiles({
    name: 'bai-giang.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4'),
  });
  await expect(teacher.getByRole('alert')).toContainText('Hỗ trợ .txt, .md, .csv, .json');

  await teacher.getByRole('button', { name: /Xóa dong-luc-hoc\.txt/ }).click();
  await expect(teacher.getByText('dong-luc-hoc.txt')).toHaveCount(0);
});

test('Think: Gemini drafts, Groq reviews; the answer is labelled; nothing goes to Wikipedia', async ({
  page,
}) => {
  const calls = { gemini: 0, groq: 0, wiki: 0 };
  await page.addInitScript(() => {
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'test-key';
  });
  await page.route('https://generativelanguage.googleapis.com/v1beta/**', (route) => {
    calls.gemini++;
    return route.fulfill({
      json: {
        candidates: [
          {
            content: { role: 'model', parts: [{ text: 'Bản nháp của Gemini.' }] },
            finishReason: 'STOP',
          },
        ],
      },
    });
  });
  await page.route('https://api.groq.com/openai/v1/**', (route) => {
    calls.groq++;
    return route.fulfill({
      json: {
        choices: [{ message: { content: 'Câu trả lời đã được rà soát.' } }],
        model: 'qwen-test',
      },
    });
  });
  await page.route(/wikipedia\.org/, (route) => {
    calls.wiki++;
    return route.abort();
  });

  await openLab(page);
  await page.getByRole('button', { name: 'AI Teacher', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Trò chuyện với AI Teacher' });
  // The pre-selected Gemma has no model here, so the connected API answers — and the panel says so.
  await expect(panel.getByRole('combobox', { name: 'Chọn mô hình AI' })).toHaveValue('cloud');
  await expect(panel.getByText(/sẽ được gửi tới: Gemini/)).toBeVisible();

  // Think without a Groq key: explained before anything is sent.
  await panel.getByRole('button', { name: /Think/ }).click();
  await expect(panel.getByText(/Think cần một API thứ hai/)).toBeVisible();

  // With a Groq key (as if saved in Settings) Think works end to end.
  await page.addInitScript(() => {
    globalThis.__STEMSIM_TEST_GROQ_KEY__ = 'groq-test-key';
  });
  await page.reload();
  await page.getByRole('button', { name: /Phòng thí nghiệm/ }).click();
  await page.getByRole('button', { name: 'AI Teacher', exact: true }).click();
  await panel.getByRole('button', { name: /Think/ }).click();
  await expect(panel.getByText(/Groq \(miễn phí\) \(rà soát\)/)).toBeVisible();
  await panel.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Lực là gì?');
  await panel.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await expect(panel.getByText('Câu trả lời đã được rà soát.')).toBeVisible();
  await expect(panel.getByText('Nội dung do AI hỗ trợ')).toBeVisible();
  await expect(panel.getByText(/Đã rà soát: groq/)).toBeVisible();
  expect(calls).toEqual({ gemini: 1, groq: 1, wiki: 0 });
});

test('whiteboard: the answer is taught on the board (written, circled, boxed), the chat shows no tags', async ({
  page,
}) => {
  const bodies: string[] = [];
  await page.addInitScript(() => {
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'test-key';
  });
  const lesson = [
    'Ta xét <write id="t1" zone="title" role="heading">Định luật II Newton</write> nhé.',
    'Đề cho <write id="g1" zone="side_notes" role="note">Cho: m = 2 kg, F = 10 N</write>.',
    'Công thức là <write id="f1" zone="steps" math="true">a = \\frac{F}{m}</write><circle target="f1"/>.',
    'Thay số <write id="r1" zone="steps" role="result">a = 10/2 = 5 m/s²</write><box target="r1"/>.',
  ].join(' ');
  await page.route('https://generativelanguage.googleapis.com/v1beta/**', (route) => {
    bodies.push(route.request().postData() ?? '');
    return route.fulfill({
      json: {
        candidates: [
          { content: { role: 'model', parts: [{ text: lesson }] }, finishReason: 'STOP' },
        ],
      },
    });
  });

  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  await page.getByRole('radio', { name: 'Giảng trên bảng' }).click();
  const board = page.getByRole('region', { name: 'Bảng trắng của AI Teacher' });
  await expect(board).toBeVisible({ timeout: 20_000 });
  const panel = page.getByRole('region', { name: 'Trò chuyện với AI Teacher' });
  await panel
    .getByRole('textbox', { name: 'Nhập câu hỏi' })
    .fill('Vật 2 kg chịu lực 10 N, gia tốc?');
  await panel.getByRole('button', { name: 'Gửi câu hỏi' }).click();

  // The AI was asked for a board lesson (TeachScript), with no coordinates.
  await expect.poll(() => bodies.length).toBe(1);
  expect(bodies[0]).toContain('CHẾ ĐỘ BẢNG TRẮNG');

  // Written on the board, then marked by hand.
  await board.getByRole('button', { name: 'Viết nhanh' }).click();
  await expect(board.locator('[data-id="t1"]')).toContainText('Định luật II Newton');
  await expect(board.locator('[data-id="r1"]')).toContainText('a = 10/2 = 5 m/s²');
  await expect(board.locator('.board__mark.is-circle.is-shown')).toHaveCount(1);
  await expect(board.locator('.board__mark.is-box.is-shown')).toHaveCount(1);
  await expect(board.getByRole('button', { name: 'Giảng lại' })).toBeVisible();
  // The chat keeps a readable copy: no raw tags.
  await expect(panel.getByText(/<write/)).toHaveCount(0);
  await expect(panel.getByText('Định luật II Newton').first()).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});
