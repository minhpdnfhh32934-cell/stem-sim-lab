import { expect, test, type Locator, type Page } from '@playwright/test';
import reactions from '../../data/reactions.json' with { type: 'json' };
import { fulfillGemini } from './fakeAi';
import { enterLab, enterStudio } from './nav';

/**
 * Science Studio end to end (brief flows 1–12; acceptance criteria in
 * docs/work-log/2026-10-19-S6-tests-skills.md). The expected values come from the repository data
 * (`data/reactions.json`), from textbook formulas computed here, or from the lab's own solution —
 * never from the Studio code under test. Every AI host is routed to a stub that records the call:
 * none may happen unless the learner sends a question.
 *
 * The Biology test runs the mitosis model at low quality (its 2D picture), so it stays in the
 * light project; the 3D path of the same lesson is covered by studio-biology.spec.ts.
 */

const AI_HOSTS =
  /generativelanguage\.googleapis\.com|api\.anthropic\.com|api\.groq\.com|huggingface\.co|\.hf\.co|wikipedia\.org/;

interface LibraryRecord {
  id: string;
  reactants: { coef: number; formula: string }[];
  products: { coef: number; formula: string }[];
  observation: { vi: string };
  sources: { citation: string }[];
  review_status: string;
}

function record(id: string): LibraryRecord {
  const r = (reactions.items as unknown as LibraryRecord[]).find((x) => x.id === id);
  if (!r) throw new Error(`no library record ${id}`);
  return r;
}

const SUB: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
};
const sub = (formula: string) => formula.replace(/\d/g, (d) => SUB[d] ?? d);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The record's equation as a pattern (coefficient 1 omitted, optional space after a coefficient). */
function equationPattern(r: LibraryRecord): RegExp {
  const side = (xs: LibraryRecord['products']) =>
    xs
      .map((x) => (x.coef === 1 ? '' : `${String(x.coef)}\\s?`) + escape(sub(x.formula)))
      .join(' \\+ ');
  return new RegExp(`${side(r.reactants)} → ${side(r.products)}`);
}

interface Watch {
  errors: string[];
  aiCalls: string[];
  failed: { status: number; url: string }[];
}

/**
 * When `node_modules` is a link to another checkout, Vite's dev server refuses the KaTeX font
 * files outside the project root (403); a normal install and the packaged app serve them. Only
 * these responses — and the browser's matching "403" console lines — are tolerated.
 */
const LINKED_KATEX_FONT = /\/@fs\/.*\/node_modules\/katex\/dist\/fonts\//;

async function watch(page: Page, quality: 'low' | 'medium' = 'medium'): Promise<Watch> {
  const w: Watch = { errors: [], aiCalls: [], failed: [] };
  page.on('pageerror', (e) => w.errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') w.errors.push(m.text());
  });
  page.on('response', (r) => {
    if (r.status() >= 400) w.failed.push({ status: r.status(), url: r.url() });
  });
  await page.route(AI_HOSTS, (route) => {
    w.aiCalls.push(route.request().url());
    return route.abort();
  });
  await page.addInitScript((preference) => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference, benchmark: null }, version: 1 }),
    );
  }, quality);
  return w;
}

async function openStudio(page: Page, tab?: 'Hóa học' | 'Sinh học' | 'Vật lý' | 'Soạn bài') {
  await enterStudio(page);
  // The studio screen is a lazy module, compiled by the dev server on first use (seen
  // 2026-10-20: still "Đang tải mô phỏng…" after 5 s in the full parallel run).
  await expect(page.getByRole('heading', { level: 1, name: 'Science Studio' })).toBeVisible({
    timeout: 20_000,
  });
  if (tab) await page.getByRole('tab', { name: tab }).click();
}

const next = (page: Page) => page.getByRole('button', { name: /^Tiếp:/ });
const tube = (page: Page) => page.getByRole('img', { name: /^Ống nghiệm/ });
const add = (page: Page, formula: string) =>
  page.getByRole('button', { name: `Thêm dung dịch ${sub(formula)}` }).click();
const mix = (page: Page) => page.getByRole('button', { name: 'Lắc để trộn' }).click();

async function expectClean(page: Page, w: Watch) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'no horizontal scroll at 1366×768').toBeLessThanOrEqual(0);
  expect(w.aiCalls, 'no AI request').toEqual([]);
  const font = (f: Watch['failed'][number]) => f.status === 403 && LINKED_KATEX_FONT.test(f.url);
  expect(
    w.failed.filter((f) => !font(f)),
    'no failed request',
  ).toEqual([]);
  const fontErrors = w.failed.some(font);
  const errors = w.errors.filter((e) => !(fontErrors && /status of 403 \(Forbidden\)/.test(e)));
  expect(errors, 'no page or console error').toEqual([]);
}

/** A number shown in Vietnamese format ("2,019 s", "19,81 m/s") as a JS number. */
async function numberIn(cell: Locator): Promise<number> {
  const text = (await cell.innerText()).trim();
  const m = /-?[\d.]*\d(?:,\d+)?/.exec(text);
  if (!m) throw new Error(`no number in "${text}"`);
  return Number(m[0].replace(/\./g, '').replace(',', '.'));
}

const NOT_IN_DB = /chưa có trong cơ sở dữ liệu đã kiểm chứng/;
const LESSON_PENDING = /Nội dung bài này chưa được kiểm duyệt/;

test('opens from the lab; each subject tab shows its own lesson', async ({ page }) => {
  const w = await watch(page);
  await page.goto('/');
  await openStudio(page);
  const tabs = page.getByRole('tablist', { name: 'Chọn môn trong Studio' }).getByRole('tab');
  await expect(tabs).toHaveText(['Hóa học', 'Sinh học', 'Vật lý', 'Soạn bài']);

  const lessons: [string, RegExp][] = [
    ['Hóa học', /^Nhận biết ion Cl⁻ bằng dung dịch AgNO₃/],
    ['Sinh học', /^Nguyên phân 3D/],
    ['Vật lý', /^Rơi tự do: thả từ độ cao gấp đôi/],
  ];
  for (const [tab, heading] of lessons) {
    await page.getByRole('tab', { name: tab }).click();
    await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible();
    await expect(page.getByText(LESSON_PENDING)).toBeVisible();
    await expect(next(page)).toBeDisabled();
  }
  await page.getByRole('tab', { name: 'Soạn bài' }).click();
  await expect(page.getByRole('button', { name: 'Tạo bài mới' })).toBeVisible();
  await expectClean(page, w);
});

test('the launch page has two entries; a lab topic opens its lesson; the session is kept', async ({
  page,
}) => {
  const w = await watch(page);
  await page.goto('/');
  // User decision 2026-10-20: Virtual Lab and AI Teacher only; Science Studio is in the lab.
  await expect(page.locator('.launch-card strong')).toHaveText(['Virtual Lab', 'AI Teacher']);
  await expect(page.getByRole('button', { name: /Science Studio/ })).toHaveCount(0);
  await enterLab(page);

  const library = page.getByRole('complementary', { name: 'Thư viện chủ đề' });
  const entry = library.getByRole('button', { name: /^Science Studio/ });
  await expect(entry).toBeVisible();
  expect((await entry.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(40);

  // Chemistry topic → its lesson from the inspector card.
  await page.getByRole('radio', { name: 'Hóa học' }).click();
  await library.getByRole('button', { name: /^Thư viện phản ứng đã kiểm chứng( |$)/ }).click();
  const inspector = page.getByRole('complementary', { name: 'Bảng thuộc tính' });
  const openChem = inspector.getByRole('button', {
    name: /^Học theo bài: Nhận biết ion Cl⁻ bằng dung dịch AgNO₃/,
  });
  await expect(openChem).toBeVisible({ timeout: 20_000 });
  expect((await openChem.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(40);
  await openChem.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Science Studio' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('tab', { name: 'Hóa học' })).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('heading', { level: 2, name: /^Nhận biết ion Cl⁻ bằng dung dịch AgNO₃/ }),
  ).toBeVisible();
  // The lab's library stays beside the lesson.
  await expect(entry).toHaveAttribute('aria-current', 'page');

  // One step of the lesson, then back to the lab and in again: the session is where it was.
  await page.getByRole('radio', { name: 'Xuất hiện kết tủa' }).click();
  await next(page).click();
  await expect(page.locator('.studio-steps [aria-current="step"]')).toContainText('Thí nghiệm');
  await page.getByRole('button', { name: 'Về Virtual Lab' }).click();
  await expect(page.getByRole('heading', { name: 'Hôm nay học gì?' })).toBeVisible();
  await library.getByRole('button', { name: /^Thư viện phản ứng đã kiểm chứng( |$)/ }).click();
  await openChem.click();
  await expect(page.locator('.studio-steps [aria-current="step"]')).toContainText('Thí nghiệm');

  // The studio tab chooses the subject the library lists. Rơi tự do: "Dự đoán trước" is the
  // lesson's prediction, not a second one in the lab.
  await page.getByRole('tab', { name: 'Vật lý' }).click();
  await expect(library.getByRole('list', { name: 'Vật lý' })).toBeVisible();
  await library.getByRole('button', { name: 'Rơi tự do', exact: true }).click();
  await page.getByRole('tab', { name: 'Thử thách' }).click();
  const predict = page.getByRole('region', { name: 'Dự đoán trước' });
  await expect(predict.getByRole('radio')).toHaveCount(0);
  await predict.getByRole('button', { name: 'Dự đoán trong Science Studio' }).click();
  await expect(page.getByRole('tab', { name: 'Vật lý' })).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('heading', { level: 2, name: /^Rơi tự do: thả từ độ cao gấp đôi/ }),
  ).toBeVisible();
  await expectClean(page, w);
});

test('chemistry practical: bench, library phenomenon, POE, report; session survives reload', async ({
  page,
}) => {
  const w = await watch(page);
  const agcl = record('agcl');
  const baso4 = record('baso4');
  await page.goto('/');
  await openStudio(page, 'Hóa học');

  // Predict first; the bench is closed until then.
  await expect(next(page)).toBeDisabled();
  await page.getByRole('radio', { name: 'Xuất hiện kết tủa' }).click();
  await next(page).click();

  // An impossible action is refused and changes nothing.
  await expect(tube(page)).toHaveAccessibleName(/Ống nghiệm trống/);
  await mix(page);
  await expect(page.getByRole('alert')).toContainText('trống');
  await expect(tube(page)).toHaveAccessibleName(/Ống nghiệm trống/);

  // Held-out 1: a pair with no library record — no observation is invented.
  await add(page, 'NaCl');
  await add(page, 'H2SO4');
  await mix(page);
  await expect(page.getByText(NOT_IN_DB).first()).toBeVisible();
  await expect(page.getByText(/Kết tủa trắng/)).toHaveCount(0);
  await expect(next(page)).toBeDisabled();

  // Held-out 2: a real record that is not the question's pair — shown, but it is no answer.
  await page.getByRole('button', { name: 'Rửa ống nghiệm' }).click();
  await add(page, 'BaCl2');
  await add(page, 'H2SO4');
  await mix(page);
  await expect(page.getByText(baso4.observation.vi).first()).toBeVisible();
  await expect(page.getByText(equationPattern(baso4)).first()).toBeVisible();
  await expect(next(page)).toBeDisabled();

  // The question's pair: state, phenomenon and equation all from the `agcl` record.
  await page.getByRole('button', { name: 'Rửa ống nghiệm' }).click();
  await add(page, 'NaCl');
  await add(page, 'AgNO3');
  await mix(page);
  await expect(tube(page)).toHaveAccessibleName(/Thư viện ghi có kết tủa/);
  await expect(page.getByText(agcl.observation.vi).first()).toBeVisible();
  await expect(page.getByText(equationPattern(agcl)).first()).toBeVisible();
  expect(agcl.review_status).toBe('pending');
  await expect(page.getByText('Bản ghi thư viện chưa được kiểm duyệt.').first()).toBeVisible();

  // Saved evidence: the prediction is locked once a mix is recorded.
  await page.getByRole('button', { name: 'Quay lại' }).click();
  await expect(page.getByRole('radio', { name: 'Không thấy kết tủa' })).toBeDisabled();
  await next(page).click();
  await next(page).click();

  // Observe: three mixes, the question's pair first.
  const runs = page.getByRole('list', { name: 'Các lần trộn đã ghi lại' }).getByRole('listitem');
  await expect(runs).toHaveCount(3);
  await expect(runs.first()).toContainText('Cặp của câu hỏi');
  await expect(runs.first()).toContainText(agcl.observation.vi);

  // Reload: the session (step, mixes, locked prediction) comes back.
  await page.reload();
  await openStudio(page, 'Hóa học');
  await expect(page.locator('.studio-steps [aria-current="step"]')).toContainText('Quan sát');
  await expect(runs).toHaveCount(3);
  await next(page).click();

  // Explain → Conclude: the verdict and the phenomenon are the record's.
  await page
    .getByLabel('Giải thích của em')
    .fill('Thư viện ghi có kết tủa trắng AgCl khi trộn hai dung dịch này.');
  await next(page).click();
  await expect(page.getByText('Kết quả mô phỏng: Xuất hiện kết tủa')).toBeVisible();
  await expect(page.getByText('Dự đoán của em khớp với kết quả mô phỏng.')).toBeVisible();
  await expect(page.getByText(`Hiện tượng theo thư viện: ${agcl.observation.vi}`)).toBeVisible();
  await page
    .getByLabel('Kết luận của em')
    .fill('AgNO₃ nhận biết ion Cl⁻ vì tạo kết tủa trắng AgCl.');
  await next(page).click();

  // Report: the record's text and its own sources; no measurement table, nothing it cannot know.
  const report = page.getByLabel('Bản xem trước báo cáo');
  await expect(report).toContainText(agcl.observation.vi);
  for (const s of agcl.sources) await expect(report).toContainText(s.citation);
  await expect(report).toContainText('chưa được kiểm duyệt');
  await expect(report).toContainText(NOT_IN_DB);
  await expect(report).not.toContainText('Số đo từ mô phỏng');
  await expect(report).not.toContainText(/\d+(,\d+)?\s?(g|mol|kJ|L)\b/);
  await expectClean(page, w);
});

test('biology: stages recorded in the 2D picture match textbook mitosis (2n = 4)', async ({
  page,
}) => {
  const w = await watch(page, 'low');
  await page.goto('/');
  await openStudio(page, 'Sinh học');
  await page.getByRole('radio', { name: 'Kì giữa' }).click();
  await next(page).click();

  // Low quality draws the 2D picture: stages are reached with its step buttons, in order.
  await expect(page.getByRole('radiogroup', { name: 'Kiểu hiển thị' })).toBeVisible();
  const recorder = page.getByRole('region', { name: 'Quan sát các kì' });
  const current = recorder.getByText(/^Kì đang xem: /);
  const counts = async (stage: string) => {
    for (let i = 0; i < 12 && (await current.innerText()) !== `Kì đang xem: ${stage}`; i++) {
      await page.getByRole('button', { name: 'Bước tiếp theo' }).click();
    }
    await expect(current).toHaveText(`Kì đang xem: ${stage}`);
    await page.getByRole('button', { name: 'Ghi lại kì này' }).click();
    return {
      chromosomes: await recorder.locator('[data-quantity="chromosomes"] dd').innerText(),
      onPlane: await recorder.locator('[data-quantity="onPlane"] dd').innerText(),
    };
  };
  // Held-out (textbook mitosis, 2n = 4): metaphase holds 4 double chromosomes, all on the plate;
  // anaphase holds 4n = 8 single chromosomes moving to the poles, none on the plate.
  expect(await counts('Kì giữa')).toEqual({ chromosomes: '4', onPlane: '4' });
  await expect(recorder.getByText(/Đã có quan sát trả lời câu hỏi dự đoán/)).toBeVisible();
  expect(await counts('Kì sau')).toEqual({ chromosomes: '8', onPlane: '0' });
  await expect(recorder.getByText(/Kì này chưa trả lời câu hỏi dự đoán/)).toBeVisible();
  await expectClean(page, w);
});

test('physics: a non-default height gives the closed-form times; the lab agrees', async ({
  page,
}) => {
  const w = await watch(page);
  const g = 9.81;
  const h = 20;
  await page.goto('/');
  await openStudio(page, 'Vật lý');
  await page.getByRole('radio', { name: /√2/ }).click();
  await next(page).click();

  // Change the variable: A = 20 m, so B (twice as high) = 40 m.
  await page.getByLabel(/^Độ cao ban đầu/).fill(String(h));
  await expect(page.locator('[data-condition="A"]')).toContainText('20 m');
  await expect(page.locator('[data-condition="B"]')).toContainText('40 m');
  await page.getByRole('button', { name: 'Chạy thí nghiệm' }).click();
  // The learner stays on the experiment until "Tiếp: Quan sát".
  await expect(page.getByText(/Đã có số đo của cả hai điều kiện/)).toBeVisible();
  await next(page).click();

  const table = page.locator('table.studio-table');
  await expect(table).toBeVisible();
  const row = (name: RegExp) => table.getByRole('row', { name });
  const cells = (name: RegExp) => row(name).getByRole('cell');
  // Held-out: closed form computed here, not by the app.
  const tA = Math.sqrt((2 * h) / g);
  const tB = Math.sqrt((2 * 2 * h) / g);
  const vA = Math.sqrt(2 * g * h);
  const vB = Math.sqrt(2 * g * 2 * h);
  const near = (got: number, want: number) => {
    expect(Math.abs(got - want) / want).toBeLessThan(0.005);
  };
  near(await numberIn(cells(/Độ cao ban đầu/).nth(0)), h);
  near(await numberIn(cells(/Độ cao ban đầu/).nth(1)), 2 * h);
  near(await numberIn(cells(/Thời gian chuyển động/).nth(0)), tA);
  near(await numberIn(cells(/Thời gian chuyển động/).nth(1)), tB);
  near(await numberIn(cells(/Tốc độ chạm đất/).nth(0)), vA);
  near(await numberIn(cells(/Tốc độ chạm đất/).nth(1)), vB);
  await expect(row(/Tỉ số B\/A/)).toContainText('1,414');
  const shownA = (
    await cells(/Thời gian chuyển động/)
      .nth(0)
      .innerText()
  ).trim();

  // Regression of an existing flow: the lab opens the same run and its own solution agrees.
  await page.getByRole('button', { name: 'Chạy A trong Virtual Lab' }).click();
  await page.getByRole('tab', { name: 'Lời giải' }).click();
  const answers = page.locator('.solution__answers');
  await expect(answers).toContainText(shownA);
  await expectClean(page, w);
});

test('authoring: a chemistry lesson on the BaSO₄ record, previewed and kept after reload', async ({
  page,
}) => {
  const w = await watch(page);
  const baso4 = record('baso4');
  const title = 'Nhận biết ion sunfat bằng BaCl₂';
  await page.goto('/');
  await openStudio(page, 'Soạn bài');
  await page.getByRole('button', { name: 'Tạo bài mới' }).click();
  await page
    .getByRole('group', { name: 'Chọn môn cho bài mới' })
    .getByRole('button', { name: 'Hóa học' })
    .click();
  await expect(page.getByRole('heading', { name: 'Bài mới — Hóa học' })).toBeVisible();

  // An empty lesson is refused with the reasons.
  await page.getByRole('button', { name: 'Lưu bài' }).click();
  await expect(page.getByRole('alert')).toContainText('Hãy đặt tên bài');

  // The options are the library's precipitation records, keyed by record id.
  await page.getByLabel('Phản ứng của câu hỏi').selectOption(baso4.id);
  const fill = (group: string, text: string) =>
    page.getByRole('group', { name: group }).getByLabel('Tiếng Việt').fill(text);
  await fill('Tên bài', title);
  await fill('Mục tiêu', 'Nhận ra kết tủa trắng khi nhỏ BaCl₂ vào dung dịch H₂SO₄');
  await fill('Kết luận mong đợi', 'Thư viện ghi kết tủa trắng BaSO₄, dùng nhận biết ion sunfat.');
  await fill('Câu hỏi dự đoán', 'Nhỏ BaCl₂ vào dung dịch H₂SO₄, em đoán thấy gì?');
  await page.getByRole('button', { name: 'Lưu bài' }).click();

  const item = page.getByRole('list', { name: 'Bài đã soạn' }).getByRole('listitem');
  await expect(item).toHaveCount(1);
  await expect(item.getByRole('heading', { name: title })).toBeVisible();

  // Reload: the authored lesson is still there; preview it in the Chemistry studio.
  await page.reload();
  await openStudio(page, 'Soạn bài');
  await item.getByRole('button', { name: 'Xem trước' }).click();
  await expect(page.getByRole('tab', { name: 'Hóa học' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible();
  await expect(page.getByText(/Nội dung do giáo viên soạn/).first()).toBeVisible();

  // The authored lesson runs on the library: its pair gives the record's phenomenon.
  await page.getByRole('radio', { name: 'Xuất hiện kết tủa' }).click();
  await next(page).click();
  await add(page, 'BaCl2');
  await add(page, 'H2SO4');
  await mix(page);
  await expect(tube(page)).toHaveAccessibleName(/Thư viện ghi có kết tủa/);
  await expect(page.getByText(baso4.observation.vi).first()).toBeVisible();
  await expect(next(page)).toBeEnabled();
  await expectClean(page, w);
});

test('Hỏi thầy (mocked Gemini): the question carries the engine numbers only when shared', async ({
  page,
}) => {
  const w = await watch(page);
  const bodies: string[] = [];
  await page.addInitScript(() => {
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'test-key';
  });
  const answer =
    'Thời gian rơi tỉ lệ với căn bậc hai của độ cao, nên độ cao gấp đôi không làm thời gian gấp đôi.';
  await page.route('https://generativelanguage.googleapis.com/v1beta/**', (route) => {
    bodies.push(route.request().postData() ?? '');
    return fulfillGemini(route, answer);
  });
  await page.goto('/');
  await openStudio(page, 'Vật lý');
  await page.getByRole('radio', { name: /√2/ }).click();
  await next(page).click();
  await page.getByRole('button', { name: 'Chạy thí nghiệm' }).click();
  await next(page).click();
  const timeA = (
    await page
      .locator('table.studio-table')
      .getByRole('row', { name: /Thời gian chuyển động/ })
      .getByRole('cell')
      .nth(0)
      .innerText()
  ).trim();
  const digits = /\d+(,\d+)?/.exec(timeA)?.[0] ?? 'missing';
  const shownTime = new RegExp(digits.replace(',', '[.,]'));

  // The bubble opens with a question about this step; nothing is sent until the learner sends.
  await page.getByRole('button', { name: 'Hỏi thầy' }).click();
  const panel = page.getByRole('region', { name: 'Trò chuyện với AI Teacher' });
  await expect(panel.getByRole('textbox', { name: 'Nhập câu hỏi' })).toHaveValue(
    /Rơi tự do: thả từ độ cao gấp đôi.*bước Quan sát/,
  );
  expect(bodies).toEqual([]);

  // Shared screen: the request carries the engine's measured time.
  const toggle = panel.getByRole('checkbox', { name: 'Lấy thông tin từ màn hình' });
  await expect(toggle).not.toBeChecked();
  await toggle.check({ force: true });
  await panel.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await expect.poll(() => bodies.length).toBe(1);
  expect(bodies[0]).toMatch(shownTime);
  await expect(panel.getByText(answer)).toBeVisible();
  await expect(panel.getByText('Nội dung do AI hỗ trợ').first()).toBeVisible();

  // Not shared: the next question leaves the lesson's numbers out.
  await toggle.uncheck({ force: true });
  await panel.getByRole('textbox', { name: 'Nhập câu hỏi' }).fill('Vì sao lại như vậy ạ?');
  await panel.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await expect.poll(() => bodies.length).toBe(2);
  // Nowhere in the request: neither in the instructions nor in the earlier turns.
  expect(bodies[1]).not.toMatch(shownTime);
  await expectClean(page, w);
});

test('"Cách học": the guide opens by itself on the first visit only; the button reopens it', async ({
  page,
}) => {
  const w = await watch(page);
  // A learner who never saw the guide (storage-state.json marks it seen for the other specs).
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('stemsim.studio');
  });
  await page.reload();
  await openStudio(page);
  const guide = page.getByRole('dialog', { name: 'Học trong Science Studio' });
  await expect(guide).toBeVisible();
  await guide.getByRole('button', { name: 'Tiếp' }).click();
  // The second step points at the subject tabs.
  await expect(page.getByRole('dialog', { name: 'Chọn môn và bài' })).toBeVisible();
  await expect(page.locator('.tour__spot')).toBeVisible();
  // No horizontal scroll, neither for the page nor inside the studio (it scrolls on its own).
  expect(
    await page.evaluate(() => {
      const studio = document.querySelector('.studio');
      return (
        document.documentElement.scrollWidth <= innerWidth &&
        studio !== null &&
        studio.scrollWidth <= studio.clientWidth
      );
    }),
  ).toBe(true);
  // Every step's card stays inside the window, and the spotlight is on screen (a target below
  // the fold is scrolled into view).
  for (;;) {
    const box = await page.locator('.tour__card').boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.y >= 0 && box.y + box.height <= viewport.height).toBe(true);
    const spot = page.locator('.tour__spot');
    if ((await spot.count()) > 0) {
      const s = await spot.boundingBox();
      expect(s && viewport && s.y < viewport.height && s.y + s.height > 0).toBe(true);
    }
    const nextStep = page.getByRole('dialog').getByRole('button', { name: 'Tiếp' });
    if ((await nextStep.count()) === 0) break;
    await nextStep.click();
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Reopening the app: it does not open by itself again; "Cách học" shows it on demand.
  await page.reload();
  await openStudio(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cách học' }).click();
  await expect(guide).toBeVisible();
  await page.keyboard.press('Escape');
  // The lab's own first-run tour is untouched (already done in storage-state.json).
  await page.getByRole('button', { name: 'Về Virtual Lab' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expectClean(page, w);
});
