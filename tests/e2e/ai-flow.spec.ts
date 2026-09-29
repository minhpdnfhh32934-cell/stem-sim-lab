import { expect, test, type Page } from '@playwright/test';
import golden from '../golden/physics.json' with { type: 'json' };

interface Item {
  id: string;
  text: string;
  quantities: { key: string; value: number; unit: string; quote: string }[];
}
const item = (golden as { items: Item[] }).items.find((i) => i.id === 'nn-01')!;

interface MockOptions {
  /** What the fake model answers for each JSON schema name / explanation. */
  classification?: unknown;
  extraction?: unknown;
  explanation?: string;
  down?: boolean;
}

/** Fake LM Studio server (OpenAI-compatible) on localhost:1234. */
async function mockLmStudio(page: Page, o: MockOptions = {}) {
  await page.route('http://localhost:1234/v1/**', async (route) => {
    if (o.down) return route.abort('connectionrefused');
    const url = route.request().url();
    if (url.endsWith('/models')) {
      return route.fulfill({ json: { data: [{ id: 'qwen-test' }] } });
    }
    const body = route.request().postDataJSON() as {
      response_format?: { json_schema?: { name?: string } };
    };
    const name = body.response_format?.json_schema?.name;
    const content =
      name === 'topic_classification'
        ? JSON.stringify(
            o.classification ?? {
              topic: 'horizontalProjectile',
              reason: 'ném ngang',
              unsupported_parts: [],
            },
          )
        : name === 'scene_spec'
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
      json: { model: 'qwen-test', choices: [{ message: { role: 'assistant', content } }] },
    });
  });
}

async function typeProblem(page: Page, text: string) {
  await page.goto('/');
  await page.getByLabel('Đề bài', { exact: true }).fill(text);
}

test('problem → confirmation table → simulation → solution → AI explanation', async ({ page }) => {
  await mockLmStudio(page);
  await typeProblem(page, item.text);
  await expect(page.locator('.ai-status')).toHaveAttribute('data-status', 'local');
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

test('an explanation with a number the engine did not compute is hidden', async ({ page }) => {
  await mockLmStudio(page, { explanation: 'Vật bay 3 s, tầm xa khoảng 47,5 m.' });
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
  await mockLmStudio(page, {
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
  await mockLmStudio(page, {
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

test('LM Studio not running → clear error with next steps', async ({ page }) => {
  await mockLmStudio(page, { down: true });
  await typeProblem(page, item.text);
  await expect(page.locator('.ai-status')).toHaveAttribute('data-status', 'offline');
  await page.getByRole('button', { name: 'Phân tích đề' }).click();
  const dialog = page.getByRole('dialog', { name: 'Không phân tích được đề' });
  await expect(dialog).toContainText('Start Server');
  await expect(dialog.getByRole('button', { name: 'Mở Cài đặt AI' })).toBeVisible();
});

test('manual mode builds a scene without any AI call', async ({ page }) => {
  let calls = 0;
  await page.route('http://localhost:1234/v1/chat/**', (route) => {
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
