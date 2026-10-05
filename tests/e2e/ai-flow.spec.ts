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

test('no API key → the settings show the Gemini key guide', async ({ page }) => {
  await mockGemini(page, { noKey: true });
  await typeProblem(page, item.text);
  await expect(page.locator('.ai-status')).toHaveAttribute('data-status', 'offline');
  await expect(page.locator('.ai-status')).toContainText('thiếu key');
  await page.getByRole('button', { name: 'Phân tích đề' }).click();
  const dialog = page.getByRole('dialog', { name: 'Không phân tích được đề' });
  await expect(dialog).toContainText('Hướng dẫn lấy khóa API Gemini');
  await dialog.getByRole('button', { name: 'Mở Cài đặt AI' }).click();
  const guide = page.locator('details.ai-guide');
  await expect(guide).toHaveAttribute('open', '');
  await expect(guide).toContainText('từ 18 tuổi trở lên');
  await expect(guide).toContainText('Create API key');
  await expect(guide.getByRole('button', { name: 'Mở trang tạo khóa' })).toBeVisible();
  // The removed local provider is no longer offered.
  await expect(page.getByRole('radio', { name: /LM Studio/ })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Gemini (khuyên dùng)' })).toBeChecked();
});

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
