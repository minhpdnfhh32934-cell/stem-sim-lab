import { expect, test, type Page, type Route } from '@playwright/test';
import { openLab } from './nav';

/**
 * AI on this computer (Ollama, LM Studio, llama.cpp; Settings → "AI trên máy khác"). No real
 * runtime is started: Ollama on 127.0.0.1:11434 is a fake answered by `page.route`, the other
 * usual addresses refuse the connection. Every cloud host and Wikipedia is counted and refused,
 * so a request that leaves the computer fails the test.
 */

const OLLAMA = 'http://127.0.0.1:11434';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const ANSWER = ['Lực ma sát ', 'cản trở chuyển động ', 'của vật trên mặt tiếp xúc.'];

interface Counters {
  runtime: number;
  chat: number;
  /** Every request to the runtime, answered or not, as "METHOD /path". */
  requests: string[];
  cloud: string[];
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Online hosts: counted and refused (none may be asked while a local runtime answers). */
async function guardOnline(page: Page, counters: Counters): Promise<void> {
  for (const host of [
    'https://generativelanguage.googleapis.com/**',
    'https://api.groq.com/**',
    'https://api.anthropic.com/**',
    'https://*.wikipedia.org/**',
  ]) {
    await page.route(host, (route) => {
      counters.cloud.push(route.request().url());
      return route.abort('blockedbyclient');
    });
  }
  // LM Studio and llama.cpp are not running on this "computer".
  for (const port of [1234, 8080]) {
    await page.route(`http://127.0.0.1:${port}/**`, (route) => route.abort('connectionrefused'));
  }
}

/** A fake Ollama: version, model list, model details and a streamed (NDJSON) chat. */
async function fakeOllama(page: Page, counters: Counters, down = false): Promise<void> {
  await page.route(`${OLLAMA}/**`, async (route: Route) => {
    counters.runtime++;
    const req = route.request();
    const path = new URL(req.url()).pathname;
    counters.requests.push(`${req.method()} ${path}`);
    if (down) return route.abort('connectionrefused');
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const json = (body: unknown) => route.fulfill({ headers: CORS, json: body });
    if (path === '/api/version') return json({ version: '0.12.6' });
    if (path === '/api/tags') {
      return json({
        models: [
          {
            name: 'qwen3:8b',
            model: 'qwen3:8b',
            size: 5_225_388_164,
            details: { family: 'qwen3', parameter_size: '8.2B', quantization_level: 'Q4_K_M' },
          },
          { name: 'gpt-oss:120b-cloud', model: 'gpt-oss:120b-cloud', remote_host: 'ollama.com' },
        ],
      });
    }
    if (path === '/api/show') {
      return json({
        details: { family: 'qwen3' },
        model_info: { 'general.architecture': 'qwen3', 'qwen3.context_length': 40960 },
        capabilities: ['completion', 'thinking'],
      });
    }
    if (path === '/api/chat') {
      counters.chat++;
      const body = req.postDataJSON() as { stream?: boolean; options?: { num_ctx?: number } };
      expect(body.stream).toBe(true);
      // The window this request needs, never the model's whole 40k one.
      expect(body.options?.num_ctx).toBeGreaterThan(0);
      expect(body.options?.num_ctx).toBeLessThanOrEqual(40960);
      const lines = [
        ...ANSWER.map((content) => ({
          model: 'qwen3:8b',
          message: { role: 'assistant', content },
          done: false,
        })),
        {
          model: 'qwen3:8b',
          message: { role: 'assistant', content: '' },
          done: true,
          done_reason: 'stop',
        },
      ];
      return route.fulfill({
        headers: { ...CORS, 'Content-Type': 'application/x-ndjson' },
        body: lines.map((l) => JSON.stringify(l)).join('\n') + '\n',
      });
    }
    return route.fulfill({ status: 404, headers: CORS, body: '404 page not found' });
  });
}

async function openRuntimesPage(page: Page) {
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).first().click();
  const settings = page.getByRole('dialog', { name: 'Cài đặt' });
  await settings
    .getByRole('tab', { name: 'AI trên máy khác (Ollama, LM Studio, llama.cpp)' })
    .click();
  const panel = page.locator('#settings-runtimes');
  await expect(panel).toBeVisible();
  return { settings, panel };
}

test('detect → choose → the AI Teacher answers on this computer, nothing goes online', async ({
  page,
}) => {
  const counters: Counters = { runtime: 0, chat: 0, requests: [], cloud: [] };
  await guardOnline(page, counters);
  await fakeOllama(page, counters);
  await openLab(page);

  const { settings, panel } = await openRuntimesPage(page);
  // Nothing is asked when the page opens.
  expect(counters.runtime).toBe(0);
  // The fallback is stated where the learner chooses: a failure is reported, nothing goes online.
  await expect(
    panel.getByText(/^Phương án dự phòng: khi AI trên máy gặp lỗi/).first(),
  ).toBeVisible();
  await panel.getByRole('button', { name: 'Tìm trên máy này' }).click();
  await expect(panel.getByText('Đang chạy · phiên bản 0.12.6')).toBeVisible();
  await expect(panel.getByText('Không thấy', { exact: true })).toHaveCount(2);
  const models = panel.getByRole('radiogroup', { name: 'Mô hình của Ollama' });
  // A model that runs online is shown, never selectable.
  await expect(models.getByRole('radio', { name: /gpt-oss:120b-cloud/ })).toBeDisabled();
  await models.getByRole('radio', { name: /qwen3:8b/ }).check();
  await panel.getByRole('button', { name: 'Kiểm tra kết nối' }).click();
  await expect(panel.getByText(/Kết nối được/)).toBeVisible();
  await panel.getByRole('button', { name: 'Dùng cho AI Teacher' }).click();
  await expect(
    panel.getByText('AI Teacher đang trả lời bằng mô hình này, ngay trên máy em.'),
  ).toBeVisible();
  // 1366×768: the page fits without a horizontal scroll bar.
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(await panel.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  await settings.getByRole('button', { name: 'Đóng' }).first().click();
  // The top bar names the AI on this computer and never says the problem goes online.
  const status = page.locator('.topbar .ai-status');
  await expect(status).toHaveAttribute('data-status', 'local');
  await expect(status).toHaveAttribute('aria-label', /^AI trên máy: Ollama\. .*không gửi lên mạng/);
  await expect(status).not.toHaveAttribute('aria-label', /gửi lên máy chủ/);

  await page.getByRole('button', { name: 'AI Teacher', exact: true }).click();
  const chat = page.getByRole('region', { name: 'Trò chuyện với AI Teacher' });
  await expect(
    chat.getByText(
      'Câu hỏi được xử lý cục bộ trên máy này bởi Ollama (127.0.0.1:11434), không gửi lên mạng.',
    ),
  ).toBeVisible();
  await chat.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Lực ma sát là gì?');
  await chat.getByRole('textbox', { name: 'Nhập câu hỏi' }).press('Enter');
  await expect(chat.getByText(ANSWER.join(''))).toBeVisible({ timeout: 20_000 });
  await expect(chat.getByText(/Ollama · qwen3:8b/)).toBeVisible();
  expect(counters.chat).toBe(1);
  expect(counters.cloud).toEqual([]);

  // Restart: the choice is restored as saved, without asking the runtime.
  const before = counters.runtime;
  await page.reload();
  await openLab(page);
  const again = await openRuntimesPage(page);
  await expect(again.panel.getByText('Ollama · qwen3:8b tại 127.0.0.1:11434')).toBeVisible();
  await expect(again.panel.getByText(/SimLab chưa hỏi chương trình lần này/)).toBeVisible();
  expect(counters.runtime).toBe(before);
  expect(counters.cloud).toEqual([]);
});

test('the chosen runtime is down: the learner is told, nothing goes online', async ({ page }) => {
  const counters: Counters = { runtime: 0, chat: 0, requests: [], cloud: [] };
  await guardOnline(page, counters);
  await fakeOllama(page, counters, true);
  // A choice saved earlier (as "Dùng cho AI Teacher" saves it).
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.local-ai',
      JSON.stringify({
        state: {
          userEndpoints: [],
          selected: {
            kind: 'ollama',
            baseUrl: 'http://127.0.0.1:11434',
            model: 'qwen3:8b',
            label: 'Ollama · qwen3:8b',
          },
          checks: {},
        },
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
  const alert = chat.getByRole('alert');
  await expect(alert).toContainText('Mình chưa kết nối được tới Ollama trên máy này', {
    timeout: 20_000,
  });
  await expect(alert.getByRole('button', { name: /Hỏi lại/ })).toBeVisible();
  // Only the runtime on this computer was tried, once: the first request (who are you?) was
  // refused, so nothing more was asked. No retry, no cloud, no Wikipedia.
  expect(counters.requests).toEqual(['GET /api/version']);
  expect(counters.chat).toBe(0);
  expect(counters.cloud).toEqual([]);
  // "Hỏi lại" is the learner's click: exactly one more request, still nothing online.
  await alert.getByRole('button', { name: /Hỏi lại/ }).click();
  await expect(chat.getByRole('alert')).toContainText(
    'Mình chưa kết nối được tới Ollama trên máy này',
    { timeout: 20_000 },
  );
  await expect.poll(() => counters.requests.length).toBe(2);
  // Nothing more follows by itself.
  await page.waitForTimeout(500);
  expect(counters.requests).toEqual(['GET /api/version', 'GET /api/version']);
  expect(counters.cloud).toEqual([]);

  // The top-bar pill opens the runtime's page; its search says the chosen model cannot be used
  // now, and why (never "đang trả lời bằng mô hình này").
  await page.locator('.topbar .ai-status').click();
  const panel = page.locator('#settings-runtimes');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Tìm trên máy này' }).click();
  const chosen = panel.getByRole('group', { name: 'Đang chọn cho AI Teacher' });
  await expect(chosen.getByText('Chưa dùng được', { exact: true })).toBeVisible();
  await expect(chosen.getByRole('alert')).toContainText(
    'Mình chưa kết nối được tới Ollama trên máy này',
  );
  await expect(chosen).not.toContainText('AI Teacher đang trả lời bằng mô hình này');
  await expect(chosen.getByRole('button', { name: 'Bỏ chọn' })).toBeEnabled();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(counters.chat).toBe(0);
  expect(counters.cloud).toEqual([]);
});
