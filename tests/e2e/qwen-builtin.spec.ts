import { expect, test, type Page } from '@playwright/test';
import { openLab } from './nav';

/**
 * Qwen inside the app (#190) in the browser: no desktop app, so no `llama-server` and no Rust
 * command exists. The Qwen card says it runs only in the SimLab app and offers nothing to
 * download or run; a saved Qwen choice is told the same and sends nothing anywhere. Every cloud
 * host, HuggingFace and Wikipedia are counted and refused. The card's other states are tested in
 * `QwenSettings.test.tsx` (Rust's commands faked).
 */

const UNSUPPORTED = 'Qwen trong app chỉ chạy trong ứng dụng SimLab trên Windows';

async function guardOnline(page: Page, asked: string[]): Promise<void> {
  for (const host of [
    'https://generativelanguage.googleapis.com/**',
    'https://api.groq.com/**',
    'https://api.anthropic.com/**',
    'https://*.wikipedia.org/**',
    'https://huggingface.co/**',
    'https://*.hf.co/**',
  ]) {
    await page.route(host, (route) => {
      asked.push(route.request().url());
      return route.abort('blockedbyclient');
    });
  }
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('the Qwen card outside the desktop app: says why, nothing to download, fits 1366×768', async ({
  page,
}) => {
  const asked: string[] = [];
  await guardOnline(page, asked);
  await openLab(page);
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).first().click();
  const settings = page.getByRole('dialog', { name: 'Cài đặt' });
  await settings.getByRole('tab', { name: 'AI trong SimLab' }).click();
  const panel = page.locator('#settings-local');
  const card = panel.getByRole('group', { name: 'Qwen 3.5 9B (mạnh hơn Gemma)' });
  await expect(card).toBeVisible();
  await expect(card.getByText(UNSUPPORTED)).toBeVisible();
  await expect(card.getByRole('button')).toHaveCount(0);
  // The Gemma models are still offered below it.
  await expect(panel.getByRole('radiogroup')).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(await panel.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  expect(asked).toEqual([]);
});

test('a saved Qwen choice in the browser: the learner is told, nothing goes online', async ({
  page,
}) => {
  const asked: string[] = [];
  await guardOnline(page, asked);
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.local-ai',
      JSON.stringify({
        state: { userEndpoints: [], selected: { builtin: true }, checks: {} },
        version: 1,
      }),
    );
    localStorage.setItem(
      'stemsim.teacher-chat',
      JSON.stringify({
        state: {
          engine: 'local',
          engineChosen: true,
          previousEngine: { engine: 'cloud', chosen: true },
        },
        version: 6,
      }),
    );
    // A cloud key is there too: it must still not be used.
    (globalThis as { __STEMSIM_TEST_GEMINI_KEY__?: string }).__STEMSIM_TEST_GEMINI_KEY__ =
      'test-key';
  });
  await openLab(page);
  await page.getByRole('button', { name: 'AI Teacher', exact: true }).click();
  const chat = page.getByRole('region', { name: 'Trò chuyện với AI Teacher' });
  await chat.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Lực ma sát là gì?');
  await chat.getByRole('textbox', { name: 'Nhập câu hỏi' }).press('Enter');
  await expect(chat.getByRole('alert')).toContainText(UNSUPPORTED, { timeout: 20_000 });
  expect(asked).toEqual([]);
});
