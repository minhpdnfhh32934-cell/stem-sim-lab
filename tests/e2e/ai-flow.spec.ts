import { expect, test, type Page } from '@playwright/test';
import golden from '../golden/physics.json' with { type: 'json' };

interface Item {
  id: string;
  text: string;
  quantities: { key: string; value: number; unit: string; quote: string }[];
}
const item = (golden as { items: Item[] }).items.find((i) => i.id === 'nn-01')!;

interface MockOptions {
  /** What the fake model answers for each JSON schema / explanation. */
  classification?: unknown;
  extraction?: unknown;
  explanation?: string;
  down?: boolean;
  /** HTTP status to answer every call with (e.g. 429 quota). */
  status?: number;
  /** Answer like Gemini does for a wrong key (HTTP 400 API_KEY_INVALID). */
  badKey?: boolean;
  /** No test key in the page (as if the student has not entered one). */
  noKey?: boolean;
}

/**
 * Fake Gemini server. The browser build only talks to Gemini with a key injected by the
 * test runner (real keys live in the desktop app's keychain, never in the web page).
 */
async function mockGemini(page: Page, o: MockOptions = {}) {
  const stats = { generate: 0 };
  if (!o.noKey) {
    await page.addInitScript(() => {
      globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'test-key';
    });
  }
  await page.route('https://generativelanguage.googleapis.com/v1beta/**', async (route) => {
    if (o.down) return route.abort('internetdisconnected');
    if (o.status) return route.fulfill({ status: o.status, json: { error: { code: o.status } } });
    if (o.badKey) {
      return route.fulfill({
        status: 400,
        json: {
          error: {
            code: 400,
            message: 'API key not valid. Please pass a valid API key.',
            details: [{ reason: 'API_KEY_INVALID' }],
          },
        },
      });
    }
    expect(route.request().headers()['x-goog-api-key']).toBe('test-key');
    const url = route.request().url();
    if (url.includes('/models?')) {
      return route.fulfill({
        json: {
          models: [{ name: 'models/gemini-test', supportedGenerationMethods: ['generateContent'] }],
        },
      });
    }
    stats.generate++;
    const body = route.request().postDataJSON() as {
      generationConfig?: { responseJsonSchema?: { properties?: Record<string, unknown> } };
    };
    const props = body.generationConfig?.responseJsonSchema?.properties ?? {};
    const content =
      'topic' in props
        ? JSON.stringify(
            o.classification ?? {
              topic: 'horizontalProjectile',
              reason: 'ném ngang',
              unsupported_parts: [],
            },
          )
        : 'quantities' in props
          ? JSON.stringify(
              o.extraction ?? {
                quantities: item.quantities,
                questions: ['time_of_flight', 'range'],
                assumptions: ['Lấy g = 10 m/s²'],
                unsupported_parts: [],
                clarifications: [],
              },
            )
          : (o.explanation ?? 'Vật rơi mất 3 s nên đi được tầm xa 45 m.');
    return route.fulfill({
      json: {
        candidates: [
          {
            content: { role: 'model', parts: [{ text: content }] },
            finishReason: 'STOP',
          },
        ],
      },
    });
  });
  return stats;
}

/** Fake Groq server (OpenAI-compatible), used as the free fallback. */
async function mockGroq(page: Page) {
  const stats = { calls: 0 };
  await page.addInitScript(() => {
    globalThis.__STEMSIM_TEST_GROQ_KEY__ = 'groq-test-key';
  });
  await page.route('https://api.groq.com/openai/v1/**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer groq-test-key');
    stats.calls++;
    const body = route.request().postDataJSON() as {
      response_format?: { json_schema?: { schema?: { properties?: Record<string, unknown> } } };
    };
    const props = body.response_format?.json_schema?.schema?.properties ?? {};
    const content =
      'topic' in props
        ? JSON.stringify({
            topic: 'horizontalProjectile',
            reason: 'ném ngang',
            unsupported_parts: [],
          })
        : JSON.stringify({
            quantities: item.quantities,
            questions: ['time_of_flight', 'range'],
            assumptions: [],
            unsupported_parts: [],
            clarifications: [],
          });
    return route.fulfill({
      json: { choices: [{ message: { content } }], model: 'qwen/qwen3.8-27b' },
    });
  });
  return stats;
}

async function typeProblem(page: Page, text: string) {
  await page.goto('/');
  await page.getByLabel('Đề bài', { exact: true }).fill(text);
}

test('problem → confirmation table → simulation → solution → AI explanation', async ({ page }) => {
  await mockGemini(page);
  await typeProblem(page, item.text);
  await expect(page.locator('.ai-status')).toHaveAttribute('data-status', 'cloud');
  await page.getByRole('button', { name: 'Phân tích đề' }).click();

  const dialog = page.getByRole('dialog', { name: 'Tôi hiểu đề như sau' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Ném ngang', { exact: true })).toBeVisible();
  // Values come from the problem, each with its quote; g is from the problem too.
  await expect(dialog.getByRole('textbox', { name: 'Vận tốc ban đầu' })).toHaveValue('15');
  await expect(dialog.getByText('Trích đề: “g = 10 m/s²”')).toBeVisible();
  await expect(dialog.getByText('Thời gian chuyển động', { exact: false }).first()).toBeVisible();

  // AI content is labelled, with a report button (PROMPT_PHAN_2 A3).
  await expect(dialog.getByText('Nội dung do AI hỗ trợ')).toBeVisible();
  await dialog.getByRole('button', { name: 'Báo cáo nội dung không phù hợp' }).click();
  await expect(dialog.getByText('Đã ghi nhận báo cáo')).toBeVisible();

  await dialog.getByRole('button', { name: 'Mô phỏng' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('tab', { name: 'Lời giải' }).click();
  const answers = page.locator('.solution__answers');
  await expect(answers).toContainText('3 s');
  await expect(answers).toContainText('45 m');
  await expect(answers.locator('tr.is-asked')).toHaveCount(2);

  await page.getByRole('button', { name: 'AI diễn giải' }).click();
  await expect(page.getByText('Vật rơi mất 3 s nên đi được tầm xa 45 m.')).toBeVisible();
  await expect(page.getByText('Đã kiểm tra: mọi con số')).toBeVisible();
});

test('a confirmed problem is not sent to the AI again', async ({ page }) => {
  const stats = await mockGemini(page);
  await typeProblem(page, item.text);
  const analyze = page.getByRole('button', { name: 'Phân tích đề' });
  const dialog = page.getByRole('dialog', { name: 'Tôi hiểu đề như sau' });
  await analyze.click();
  await dialog.getByRole('button', { name: 'Mô phỏng' }).click();
  await expect(dialog).toBeHidden();
  const afterFirst = stats.generate;
  expect(afterFirst).toBeGreaterThanOrEqual(2);

  await analyze.click();
  await expect(dialog.getByText('đã được đọc và xác nhận trước đây')).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Vận tốc ban đầu' })).toHaveValue('15');
  expect(stats.generate).toBe(afterFirst);

  await dialog.getByRole('button', { name: 'Đọc lại bằng AI' }).click();
  await expect(dialog.getByText('đã được đọc và xác nhận trước đây')).toBeHidden();
  await expect(dialog.getByRole('textbox', { name: 'Vận tốc ban đầu' })).toHaveValue('15');
  expect(stats.generate).toBeGreaterThan(afterFirst);
});

test('an explanation with a number the engine did not compute is hidden', async ({ page }) => {
  await mockGemini(page, { explanation: 'Vật bay 3 s, tầm xa khoảng 47,5 m.' });
  await typeProblem(page, item.text);
  await page.getByRole('button', { name: 'Phân tích đề' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Mô phỏng' }).click();
  await page.getByRole('tab', { name: 'Lời giải' }).click();
  await page.getByRole('button', { name: 'AI diễn giải' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Đã ẩn diễn giải' })).toContainText(
    '47,5',
  );
  await expect(page.getByText('Vật bay 3 s, tầm xa khoảng 47,5 m.')).toHaveCount(0);
});

test('an invented number is dropped and the value must be entered', async ({ page }) => {
  await mockGemini(page, {
    extraction: {
      // 20 m/s is 72 km/h converted by the AI: not in the problem → rejected.
      quantities: [
        { key: 'h0', value: 45, unit: 'm', quote: 'độ cao 45 m' },
        { key: 'v0', value: 20, unit: 'm/s', quote: 'vận tốc ban đầu' },
      ],
      questions: [],
      assumptions: [],
      unsupported_parts: [],
      clarifications: [],
    },
  });
  await typeProblem(page, item.text);
  await page.getByRole('button', { name: 'Phân tích đề' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/không có trong đề — đã bỏ qua/)).toBeVisible();
  const confirm = dialog.getByRole('button', { name: 'Mô phỏng' });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('textbox', { name: 'Vận tốc ban đầu' }).fill('15');
  await expect(confirm).toBeEnabled();
});

test('unsupported problems are reported, with the manual builder offered', async ({ page }) => {
  await mockGemini(page, {
    classification: {
      topic: 'unsupported',
      reason: 'Bài về mạch điện',
      unsupported_parts: ['mạch điện'],
    },
  });
  await typeProblem(page, 'Cho mạch điện gồm R = 10 Ω nối tiếp với nguồn 12 V.');
  await page.getByRole('button', { name: 'Phân tích đề' }).click();
  const dialog = page.getByRole('dialog', { name: 'Chưa mô phỏng được đề này' });
  await expect(dialog).toContainText('Bài về mạch điện');
  await dialog.getByRole('button', { name: 'Tự dựng cảnh' }).click();
  await expect(page.getByRole('dialog', { name: 'Tự dựng cảnh' })).toBeVisible();
});

test('no Internet → clear error with next steps', async ({ page }) => {
  await mockGemini(page, { down: true });
  await typeProblem(page, item.text);
  await page.getByRole('button', { name: 'Phân tích đề' }).click();
  const dialog = page.getByRole('dialog', { name: 'Không phân tích được đề' });
  await expect(dialog).toContainText('Kiểm tra kết nối Internet');
  await expect(dialog.getByRole('button', { name: 'Tự dựng cảnh' })).toBeVisible();
});

test('free quota used up (HTTP 429) is explained in simple words', async ({ page }) => {
  await mockGemini(page, { status: 429 });
  await typeProblem(page, item.text);
  await page.getByRole('button', { name: 'Phân tích đề' }).click();
  const dialog = page.getByRole('dialog', { name: 'Không phân tích được đề' });
  await expect(dialog).toContainText('hết lượt dùng AI miễn phí');
  await expect(dialog).toContainText('Đợi khoảng 1 phút');
});

test('no API key → the AI button opens "Kết nối AI" with the Gemini key guide', async ({
  page,
}) => {
  await mockGemini(page, { noKey: true });
  await typeProblem(page, item.text);
  await expect(page.locator('.ai-status')).toHaveAttribute('data-status', 'offline');
  await expect(page.locator('.ai-status')).toContainText('thiếu key');
  const analyze = page.getByRole('button', { name: 'Phân tích đề' });
  await expect(analyze).toHaveAttribute('data-tip', /Kết nối AI để dùng tính năng này/);
  await analyze.click();
  const settings = page.getByRole('dialog', { name: 'Cài đặt' });
  await expect(settings.getByText('Kết nối AI', { exact: true })).toBeVisible();
  const guide = page.locator('details.ai-guide').filter({ hasText: 'khóa API Gemini' });
  await expect(guide).toHaveAttribute('open', '');
  // The free Groq fallback has its own (closed) guide below.
  const groqGuide = page.locator('details.ai-guide').filter({ hasText: 'khóa API Groq' });
  await expect(groqGuide).not.toHaveAttribute('open', '');
  await expect(settings.getByRole('radio', { name: 'Groq (miễn phí)' }).last()).toBeChecked();
  await expect(guide).toContainText('từ 18 tuổi trở lên');
  await expect(guide).toContainText('Create API key');
  // Step-by-step drawings.
  await expect(guide.getByRole('img')).toHaveCount(3);
  await expect(guide.getByRole('button', { name: 'Mở trang tạo khóa' })).toBeVisible();
  await expect(settings.getByText('Chưa có khóa.').first()).toBeVisible();
  // The removed local provider is no longer offered.
  await expect(page.getByRole('radio', { name: /LM Studio/ })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Gemini (khuyên dùng)' })).toBeChecked();
  await settings.getByRole('button', { name: 'Kiểm tra key' }).first().click();
  await expect(
    settings.getByRole('status').filter({ hasText: 'Chưa có khóa.' }).first(),
  ).toBeVisible();
});

for (const [name, opts, expected] of [
  ['valid key', {}, 'Kết nối thành công'],
  ['wrong key', { badKey: true }, 'Key không hợp lệ'],
  ['quota used up', { status: 429 }, 'Hết hạn mức'],
  ['no Internet', { down: true }, 'Không có mạng'],
] as const) {
  test(`"Kiểm tra key" explains: ${name}`, async ({ page }) => {
    await mockGemini(page, opts);
    await page.goto('/');
    await page.getByRole('button', { name: 'Cài đặt' }).click();
    const settings = page.getByRole('dialog', { name: 'Cài đặt' });
    // Only the last characters of a stored key are ever shown.
    await expect(settings.getByText('Đã lưu khóa: ••••••••')).toBeVisible();
    await expect(settings.getByRole('textbox', { name: 'Mô hình', exact: true })).toHaveCount(1);
    await settings.getByRole('button', { name: 'Kiểm tra key' }).first().click();
    await expect(settings.locator('.ai-test').first()).toContainText(expected);
    // The key never ends up in the page's storage.
    const stored = await page.evaluate(() =>
      Array.from({ length: localStorage.length }, (_, i) => {
        const k = localStorage.key(i) ?? '';
        return `${k}=${localStorage.getItem(k) ?? ''}`;
      }).join('\n'),
    );
    expect(stored).not.toContain('test-key');
  });
}

test('manual mode builds a scene without any AI call', async ({ page }) => {
  let calls = 0;
  await page.route('https://generativelanguage.googleapis.com/**', (route) => {
    calls++;
    return route.abort();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Tự dựng cảnh (không dùng AI)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tự dựng cảnh' });
  await dialog.getByRole('combobox', { name: 'Chủ đề' }).selectOption('freeFall');
  await expect(dialog.getByRole('textbox', { name: 'Độ cao ban đầu' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Mô phỏng' }).click();
  await expect(page.locator('.stage canvas')).toBeVisible();
  expect(calls).toBe(0);
});

test('a problem with a phone number is not sent to the AI', async ({ page }) => {
  const stats = await mockGemini(page);
  await typeProblem(page, `${item.text} Liên hệ em: 0912 345 678.`);
  await page.getByRole('button', { name: 'Phân tích đề' }).click();
  const dialog = page.getByRole('dialog', { name: 'Không phân tích được đề' });
  await expect(dialog).toContainText('thông tin cá nhân (số điện thoại)');
  await expect(dialog.getByRole('button', { name: 'Thử lại' })).toHaveCount(0);
  expect(stats.generate).toBe(0);
  // The incident log has the kind and the time only.
  const log = await page.evaluate(() => localStorage.getItem('stemsim.incidents') ?? '');
  expect(log).toContain('inputPersonalData');
  expect(log).not.toContain('0912');
});

test.describe('first run (age question not answered yet)', () => {
  test.use({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:1420',
          localStorage: [{ name: 'stemsim.tourDone', value: '1' }],
        },
      ],
    },
  });

  test('the 18+ question comes first; "under 18" keeps simulations and turns AI off', async ({
    page,
  }) => {
    const stats = await mockGemini(page);
    await page.goto('/');
    const gate = page.getByRole('dialog', { name: 'Trước khi bắt đầu' });
    await expect(gate).toBeVisible();
    await expect(gate.getByRole('button', { name: 'Tôi đủ 18 tuổi — bật AI' })).toBeDisabled();
    await gate.getByRole('button', { name: 'Tôi chưa đủ 18 tuổi' }).click();
    await expect(gate).toBeHidden();
    await expect(page.locator('.ai-status')).toContainText('AI: chưa mở');
    await page.getByLabel('Đề bài', { exact: true }).fill(item.text);
    await page.getByRole('button', { name: 'Phân tích đề' }).click();
    await expect(page.getByRole('dialog', { name: 'Không phân tích được đề' })).toContainText(
      'AI chưa được mở',
    );
    expect(stats.generate).toBe(0);
    // Simulations still work without AI.
    await page.reload();
    await expect(gate).toBeHidden();
  });

  test('"18+" with the terms turns AI on', async ({ page }) => {
    await mockGemini(page);
    await page.goto('/');
    const gate = page.getByRole('dialog', { name: 'Trước khi bắt đầu' });
    await gate.getByRole('button', { name: 'Đọc quyền riêng tư & điều khoản' }).click();
    const privacy = page.getByRole('dialog', { name: 'Quyền riêng tư & dùng AI an toàn' });
    await expect(privacy).toContainText('Dùng AI để học hiệu quả và an toàn');
    await privacy.getByRole('button', { name: 'Đóng' }).last().click();
    await gate.getByRole('checkbox').check();
    await gate.getByRole('button', { name: 'Tôi đủ 18 tuổi — bật AI' }).click();
    await expect(gate).toBeHidden();
    await expect(page.locator('.ai-status')).toHaveAttribute('data-status', 'cloud');
  });
});

test('signs of a crisis show support lines at once, even without an API key', async ({ page }) => {
  const stats = await mockGemini(page, { noKey: true });
  await typeProblem(page, 'Em mệt quá, em không muốn sống nữa');
  await page.getByRole('button', { name: 'Phân tích đề' }).click();
  const dialog = page.getByRole('dialog', { name: 'Mình muốn hỏi thăm bạn' });
  await expect(dialog).toContainText('096 306 1414');
  await expect(dialog).toContainText('115');
  expect(stats.generate).toBe(0);
});

test('Gemini out of free quota → the free Groq fallback answers, and the label says so', async ({
  page,
}) => {
  await mockGemini(page, { status: 429 });
  const groq = await mockGroq(page);
  await typeProblem(page, item.text);
  await page.getByRole('button', { name: 'Phân tích đề' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tôi hiểu đề như sau' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('qwen/qwen3.8-27b (dự phòng', { exact: false })).toBeVisible();
  await expect(dialog.locator('.ai-label__model')).toContainText('dự phòng');
  await expect(dialog.getByRole('textbox', { name: 'Vận tốc ban đầu' })).toHaveValue('15');
  expect(groq.calls).toBe(2);
});
