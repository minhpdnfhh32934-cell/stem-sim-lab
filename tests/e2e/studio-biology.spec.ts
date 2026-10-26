declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { enterLab, enterStudio } from './nav';

/**
 * Biology Studio, lesson "Nguyên phân 3D" on the lab's own mitosis model: predict → experiment
 * (3D view, stage record, find the parts) → observe → explain → conclude → report; the session
 * survives a reload, and the regular Mitosis topic keeps the learner's own settings.
 *
 * WebGL runs in software (SwiftShader), never on the GPU, like mitosis3d.spec.ts. No AI is
 * needed: every AI host is routed to a stub that records the call, and none may happen.
 */
const SWIFTSHADER = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
test.use({
  launchOptions: {
    args: SWIFTSHADER,
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

const AI_HOSTS =
  /generativelanguage\.googleapis\.com|api\.anthropic\.com|api\.groq\.com|huggingface\.co|\.hf\.co/;

/** The functions of the lesson's activity, in order, answered with their own part. */
const PARTS = ['Màng tế bào', 'Nhân tế bào', 'Màng nhân', 'Nhân con', 'Thoi phân bào'];

async function setUp(page: Page): Promise<{ errors: string[]; aiCalls: string[] }> {
  const errors: string[] = [];
  const aiCalls: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.route(AI_HOSTS, (route) => {
    aiCalls.push(route.request().url());
    return route.abort();
  });
  // A slow test machine may measure as "low" quality, where mitosis uses the 2D picture.
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
  return { errors, aiCalls };
}

async function expectSoftwareWebGL(page: Page): Promise<void> {
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'no WebGL 2';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  });
  expect(renderer, 'WebGL must run in software (SwiftShader), never on the GPU').toContain(
    'SwiftShader',
  );
}

async function openMitosisTopic(page: Page): Promise<void> {
  await page.getByRole('radio', { name: 'Sinh học' }).click();
  // The topic list adds a progress note ("Đã học") as the button's description.
  await page
    .getByRole('list', { name: 'Sinh học' })
    .getByRole('button', { name: /^Nguyên phân( |$)/ })
    .click();
  await expect(page.locator('.m3d canvas')).toBeVisible({ timeout: 20_000 });
}

/** From the launch page: lab → Science Studio → Sinh học. */
async function openStudioBiology(page: Page): Promise<void> {
  await enterStudio(page);
  await page.getByRole('tab', { name: 'Sinh học' }).click();
  await expect(page.getByRole('heading', { name: /^Nguyên phân 3D/ })).toBeVisible();
}

const next = (page: Page) => page.getByRole('button', { name: /^Tiếp:/ });
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('Biology Studio: mitosis lesson end to end, session kept, lab settings given back', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { errors, aiCalls } = await setUp(page);

  // The learner's own lab settings: plant cell, 2n = 6, 3D view.
  await page.goto('/');
  await enterLab(page);
  await expectSoftwareWebGL(page);
  await openMitosisTopic(page);
  await page.getByRole('radio', { name: 'Thực vật' }).click();
  await page.getByLabel('Bộ NST lưỡng bội 2n').selectOption('3');
  await expect(page.getByRole('radio', { name: 'Thực vật' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // From the open Nguyên phân topic: its Science Studio lesson (inspector card).
  await page
    .getByRole('complementary', { name: 'Bảng thuộc tính' })
    .getByRole('button', { name: /^Học theo bài: Nguyên phân 3D/ })
    .click();
  await expect(page.getByRole('tab', { name: 'Sinh học' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('heading', { name: /^Nguyên phân 3D/ })).toBeVisible();

  // Predict: one of the model's stages.
  await expect(next(page)).toBeDisabled();
  await page.getByRole('radio', { name: 'Kì giữa' }).click();
  await next(page).click();

  // Experiment: the lab's 3D view on the lesson's cell, with the cell type locked.
  const model = page.locator('.bio-studio__model');
  await expect(model.locator('.m3d canvas')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('radio', { name: 'Động vật' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('radio', { name: 'Thực vật' })).toBeDisabled();
  await expect(page.getByText(/Bài học giữ mô hình ở tế bào động vật, 2n = 4/)).toBeVisible();
  expect(await overflowX(page)).toBeLessThanOrEqual(0);

  // Change the stage, record it: the counts come from the model.
  await page
    .getByRole('group', { name: 'Các kì' })
    .getByRole('button', { name: 'Kì giữa' })
    .click();
  await expect(page.getByText('Kì đang xem: Kì giữa')).toBeVisible();
  await page.getByRole('button', { name: 'Ghi lại kì này' }).click();
  const recorder = page.getByRole('region', { name: 'Quan sát các kì' });
  await expect(recorder.locator('[data-quantity="onPlane"] dd')).toHaveText('4');
  await expect(recorder.locator('[data-quantity="chromosomes"] dd')).toHaveText('4');
  await expect(page.getByText(/Đã có quan sát trả lời câu hỏi dự đoán/)).toBeVisible();

  // Find the parts: pick each part in the parts list, answer its function, then check.
  const parts = page.getByRole('group', { name: 'Bộ phận tế bào' });
  for (const [i, part] of PARTS.entries()) {
    await parts.getByRole('button', { name: part, exact: true }).click();
    await expect(page.getByText(`Bộ phận đang chọn: ${part}`)).toBeVisible();
    await page
      .getByRole('button', { name: new RegExp(`^Trả lời chức năng ${String(i + 1)} `) })
      .click();
  }
  await page.getByRole('button', { name: 'Kiểm tra' }).click();
  await expect(page.getByText(/Đúng 5\/5\./)).toBeVisible();
  await next(page).click();

  // Observe: the recorded stage with its counts, and the pending-review label.
  const runs = page.getByRole('list', { name: 'Các kì đã ghi lại' });
  await expect(runs.locator('[data-quantity="onPlane"] dd')).toHaveText('4');
  await expect(runs.getByText('Trả lời câu hỏi', { exact: true })).toBeVisible();
  await expect(runs.locator('[data-fact="review"] dd')).toHaveText(
    'Mô tả kì và chức năng bộ phận chưa được kiểm duyệt.',
  );
  await expect(page.getByText(/không đo từ vị trí trong hình/)).toBeVisible();
  await next(page).click();

  // Explain → Conclude → Report.
  await page
    .getByLabel('Giải thích của em')
    .fill('Ở kì giữa mọi tâm động nằm trên mặt phẳng xích đạo.');
  await next(page).click();
  await expect(page.getByText('Kết quả mô phỏng: Kì giữa')).toBeVisible();
  await expect(
    page.getByText('Theo mô hình, ở Kì giữa: 4/4 tâm động nằm trên mặt phẳng xích đạo.'),
  ).toBeVisible();
  await page
    .getByLabel('Kết luận của em')
    .fill('NST kép xếp thành một hàng ở mặt phẳng xích đạo vào kì giữa.');
  await next(page).click();
  const report = page.getByLabel('Bản xem trước báo cáo');
  await expect(report).toContainText('Số đo từ mô phỏng');
  await expect(report).toContainText('Người học chọn: Kì giữa');
  await expect(report).toContainText(/Số tâm động nằm trên mặt phẳng xích đạo\s*\|\s*A\s*\|\s*4\b/);
  await expect(report).toContainText(/Số NST kép\s*\|\s*A\s*\|\s*4\b/);
  expect(await overflowX(page)).toBeLessThanOrEqual(0);

  // The regular Mitosis topic opens with the learner's own settings.
  await page.getByRole('button', { name: 'Về trang chủ' }).click();
  await enterLab(page);
  await openMitosisTopic(page);
  await expect(page.getByRole('radio', { name: 'Thực vật' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('radio', { name: 'Thực vật' })).toBeEnabled();
  await expect(page.getByLabel('Bộ NST lưỡng bội 2n')).toHaveValue('3');

  // Reload: the lesson session is kept (report step, same counts).
  await page.reload();
  await openStudioBiology(page);
  await expect(page.locator('.studio-steps [aria-current="step"]')).toContainText('Báo cáo');
  await expect(page.getByLabel('Bản xem trước báo cáo')).toContainText(
    /Số tâm động nằm trên mặt phẳng xích đạo\s*\|\s*A\s*\|\s*4\b/,
  );
  expect(await overflowX(page)).toBeLessThanOrEqual(0);

  expect(aiCalls).toEqual([]);
  expect(errors).toEqual([]);
});
