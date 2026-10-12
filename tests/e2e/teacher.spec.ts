import { expect, test, type Page } from '@playwright/test';
import { openLab } from './nav';

/** "Thầy AI": launch page entry, the full teacher page and the floating chat bubble. */

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('the AI teacher page: honest label, no screen toggle, fits 1366×768, Esc goes back', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  const screen = page.getByRole('region', { name: 'Dạy học bằng AI' });
  await expect(screen).toBeVisible();
  await expect(page.getByText('Thầy/cô AI', { exact: true })).toBeVisible();
  // The screen-context switch belongs to the bubble only.
  await expect(page.getByRole('checkbox', { name: 'Lấy thông tin từ màn hình' })).toHaveCount(0);
  // No API key and no local model: a clear notice, never a pretend answer.
  await expect(page.getByText(/Chưa có API/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cài đặt' }).first()).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  for (const name of ['Gửi câu hỏi', 'Em chưa hiểu chỗ này']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  }

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
  await page.getByRole('button', { name: 'Thầy AI', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Trò chuyện với Thầy AI' });
  await expect(panel).toBeVisible();
  const toggle = panel.getByRole('checkbox', { name: 'Lấy thông tin từ màn hình' });
  await expect(toggle).not.toBeChecked();
  await toggle.check({ force: true });
  await expect(toggle).toBeChecked();

  // Closing and opening the bubble again starts with the toggle off.
  await page.getByRole('button', { name: 'Đóng chat' }).first().click();
  await page.getByRole('button', { name: 'Thầy AI', exact: true }).click();
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

  // "Cài đặt" lands on the right section of Settings.
  await panel.getByRole('button', { name: 'Cài đặt' }).click();
  await expect(page.locator('#settings-ai, #settings-teacher').first()).toBeInViewport();
});

test('knowledge library: add a .txt file, refuse a .pdf, Wikipedia stays off', async ({ page }) => {
  await openLab(page);
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).first().click();
  const teacher = page.locator('#settings-teacher');
  await teacher.scrollIntoViewIfNeeded();
  await expect(teacher.getByText('Dữ liệu của em đi đâu?')).toBeVisible();
  await expect(teacher.getByRole('checkbox', { name: /Tra thêm Wikipedia/ })).not.toBeChecked();

  await teacher.getByRole('button', { name: 'Mở thư viện' }).click();
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
  await page.getByRole('button', { name: 'Thầy AI', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Trò chuyện với Thầy AI' });
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
  await page.getByRole('button', { name: 'Thầy AI', exact: true }).click();
  await panel.getByRole('button', { name: /Think/ }).click();
  await expect(panel.getByText(/Groq \(miễn phí\) \(rà soát\)/)).toBeVisible();
  await panel.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Lực là gì?');
  await panel.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await expect(panel.getByText('Câu trả lời đã được rà soát.')).toBeVisible();
  await expect(panel.getByText('Nội dung do AI hỗ trợ')).toBeVisible();
  await expect(panel.getByText(/Đã rà soát: groq/)).toBeVisible();
  expect(calls).toEqual({ gemini: 1, groq: 1, wiki: 0 });
});
