declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openLab } from '../nav';

/**
 * The bench: a topic card on the shelf (back to the shelf through the subject crumb when a topic
 * is open; the bench has no library column beside the stage).
 */
async function openCard(page: Page, name: string) {
  const crumb = page
    .locator('.bench-crumbs')
    .getByRole('button', { name: 'Sinh học', exact: true });
  if ((await crumb.count()) > 0) await crumb.click();
  await page.getByRole('main').getByRole('button', { name, exact: true }).click();
}

/**
 * Biology topics open their 3D views here: WebGL runs in software (SwiftShader), never on the
 * GPU (a laptop GPU driver reset is not a test result; see mitosis3d.spec.ts).
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

const TOPICS = [
  'Nguyên phân',
  'Giảm phân',
  'ADN → mARN → Protein',
  'Đột biến điểm',
  'Di truyền Mendel',
  'Định luật Hardy–Weinberg',
  'Phiêu bạt di truyền',
  'Tăng trưởng logistic',
  'Con mồi – vật ăn thịt (Lotka–Volterra)',
  'Động học enzyme (Michaelis–Menten)',
  'Khuếch tán & thẩm thấu',
  'Tế bào nhân sơ và nhân thực',
  'Từ tế bào đến DNA',
];

async function openBiology(page: Page) {
  await openLab(page);
  await page.getByRole('radio', { name: 'Sinh học' }).click();
}

test('every biology topic opens without errors and publishes a Science Card', async ({ page }) => {
  // Thirteen topics, twelve of them opening a 3D view in software: ~15 s on a fast CI runner, but a slow
  // one took 6-8 s per topic and ran out of the 60 s default after eight (2026-10-23, eastus).
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openBiology(page);
  for (const [i, name] of TOPICS.entries()) {
    await openCard(page, name);
    // Each topic is a lazy module: the dev server compiles it on first use, which can take
    // several seconds while other spec files run in parallel.
    await expect(page.locator('.science-card')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(400);
    if (process.env.SHOTS)
      await page.screenshot({ path: `${process.env.SHOTS}/bio-${String(i)}.png` });
  }
  expect(errors).toEqual([]);
});

test('Mendel dihybrid cross shows 9 : 3 : 3 : 1', async ({ page }) => {
  await openBiology(page);
  await page.getByRole('button', { name: 'Di truyền Mendel', exact: true }).click();
  // A lazy module, compiled by the dev server on first use (the stage was still empty after
  // 5 s in the full parallel run, 2026-10-20).
  await expect(page.getByText('9 : 3 : 3 : 1', { exact: true })).toBeVisible({ timeout: 20_000 });
});

test('point mutation: C→T at position 13 is a nonsense mutation', async ({ page }) => {
  await openBiology(page);
  await page.getByRole('button', { name: 'Đột biến điểm', exact: true }).click();
  await expect(page.getByText('Đột biến vô nghĩa')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Met–Ala–Phe', { exact: true })).toBeVisible();
});

test('osmosis view shows the van ’t Hoff equilibrium', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openBiology(page);
  await page.getByRole('button', { name: 'Khuếch tán & thẩm thấu', exact: true }).click();
  await page.getByRole('radio', { name: 'Thẩm thấu' }).click();
  await expect(page.getByText(/Π₀ = iC₀RT/)).toBeVisible();
  await expect(page.locator('.science-card')).toContainText('Thẩm thấu');
  await page.waitForTimeout(500);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/bio-osmosis.png` });
  expect(errors).toEqual([]);
});

type Box = { x: number; y: number; width: number; height: number };
const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('"Hỏi thầy" never covers the stage: it sits in the Inspector, under its last line', async ({
  page,
}) => {
  await openBiology(page);
  await page
    .getByRole('button', { name: 'Con mồi – vật ăn thịt (Lotka–Volterra)', exact: true })
    .click();
  await expect(page.locator('.science-card')).toBeVisible({ timeout: 20_000 });
  // The bench: "Hỏi thầy" is the notebook's "Hỏi AI" tab, on the rail beside the stage; the
  // tray (the Inspector) keeps its whole list above the bench edge.
  const ask = await page.getByRole('tab', { name: 'Hỏi AI' }).boundingBox();
  const center = await page.locator('.bench__stage').boundingBox();
  const tray = await page
    .getByRole('complementary', { name: 'Điều chỉnh (bảng thuộc tính)' })
    .boundingBox();
  const edge = await page.locator('.bench-edge').boundingBox();
  if (!ask || !center || !tray || !edge) throw new Error('layout missing');
  expect(intersects(ask, center)).toBe(false);
  expect(intersects(ask, tray)).toBe(false);
  expect(tray.y + tray.height).toBeLessThanOrEqual(edge.y + 1);
});

/** Controls matched by each selector that are drawn smaller than 40 px (or "none on screen"). */
async function smallTargets(page: Page, selectors: string[]): Promise<string[]> {
  return page.evaluate((list) => {
    const out: string[] = [];
    for (const sel of list) {
      const els = [...document.querySelectorAll<HTMLElement>(sel)].filter(
        (el) => el.getClientRects().length > 0,
      );
      if (els.length === 0) out.push(`${sel}: none on screen`);
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.height < 40)
          out.push(`${sel} ${String(Math.round(r.width))}x${String(Math.round(r.height))}`);
      }
    }
    return out;
  }, selectors);
}

test.describe('touch screen', () => {
  test.use({ hasTouch: true });

  test('biology controls, the subject and Basic/Advanced switches are >= 40 px', async ({
    page,
  }) => {
    await openBiology(page);
    // The bench: the subjects are the shelf's radios, the inspector is the tray.
    expect(await smallTargets(page, ['.shelf-subject'])).toEqual([]);
    await openCard(page, 'Giảm phân');
    await expect(page.locator('.science-card')).toBeVisible({ timeout: 20_000 });
    // The counts table (its row buttons) is the notebook's first tab on the bench.
    await page
      .getByRole('tablist', { name: 'Bảng đồ thị và lời giải' })
      .getByRole('tab')
      .first()
      .click();
    expect(
      await smallTargets(page, ['.mode-switch .segmented__item', '.bio-row-btn', '.tray select']),
    ).toEqual([]);
    await openCard(page, 'Tăng trưởng logistic');
    await expect(page.locator('.science-card')).toContainText('logistic', { timeout: 20_000 });
    expect(await smallTargets(page, ['.tray input[type="range"]'])).toEqual([]);
  });
});

test('the short charts of the bottom panel show at least three y values', async ({ page }) => {
  await openBiology(page);
  for (const name of [
    'Tăng trưởng logistic',
    'Con mồi – vật ăn thịt (Lotka–Volterra)',
    'Phiêu bạt di truyền',
    'Động học enzyme (Michaelis–Menten)',
    'Khuếch tán & thẩm thấu',
  ]) {
    await openCard(page, name);
    // The bench: the module's chart is the notebook's first tab.
    const first = page
      .getByRole('tablist', { name: 'Bảng đồ thị và lời giải' })
      .getByRole('tab')
      .first();
    if (
      (await first.getAttribute('aria-selected')) !== 'true' ||
      (await page.getByRole('tabpanel').count()) === 0
    )
      await first.click();
    const plot = page.getByRole('tabpanel').locator('.chart__plot[data-y-ticks]');
    await expect(plot).toHaveCount(1, { timeout: 20_000 });
    await expect
      .poll(async () => Number(await plot.getAttribute('data-y-ticks')), { message: name })
      .toBeGreaterThanOrEqual(3);
  }
});

test('cell structure: a part opens its card; targets >= 40 px, no horizontal scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openBiology(page);
  await openCard(page, 'Tế bào nhân sơ và nhân thực');
  // The bench: the whole Science Card is the notebook's "Thẻ khoa học" tab.
  await page.getByRole('tab', { name: 'Thẻ khoa học' }).click();
  await expect(page.getByRole('tabpanel').locator('.science-card')).toContainText(
    'Minh họa — không theo tỉ lệ',
    { timeout: 20_000 },
  );
  await page.getByRole('radio', { name: 'Thực vật' }).click();
  const parts = page.getByRole('group', { name: 'Bộ phận tế bào' });
  await parts.getByRole('button', { name: 'Lục lạp', exact: true }).click();
  const card = page.locator('.cell-part-card');
  await expect(card.locator('strong')).toHaveText('Lục lạp');
  await expect(card).toContainText('quang hợp');
  // The plant has the longest list; the cell switch and "Hiện tên" (in the 3D view's corner
  // since the cell has a 3D view, over the 2D picture otherwise) are targets too. The view loads
  // lazily: counted before it was on screen, the list came out one short (seen after the
  // every-topic test in the same worker, on main too).
  await expect(page.getByRole('button', { name: 'Hiện tên các bộ phận' })).toBeVisible();
  const sizes = await page
    .locator(
      '.cell-parts .segmented__item, .cell-parts .m3d-parts__item, button[aria-label="Hiện tên các bộ phận"]',
    )
    .evaluateAll((els) =>
      els.map((e) => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height)),
    );
  expect(sizes.length).toBe(3 + 12 + 1);
  expect(sizes.filter((s) => s < 40)).toEqual([]);
  // The bacterium has no chloroplast: its card closes and its list shows the nucleoid.
  await page.getByRole('radio', { name: 'Vi khuẩn' }).click();
  await expect(card).toHaveCount(0);
  await expect(parts.getByRole('button', { name: 'Lục lạp', exact: true })).toHaveCount(0);
  await parts.getByRole('button', { name: 'Vùng nhân', exact: true }).click();
  await expect(card.locator('strong')).toHaveText('Vùng nhân');
  const heights = await parts
    .getByRole('button')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(heights.filter((h) => h < 40)).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
  expect(errors).toEqual([]);
});
