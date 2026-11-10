import { expect, test, type Locator, type Page } from '@playwright/test';
import { openLab, openStudioFromLab } from '../nav';

/**
 * Bench twin of tests/e2e/layout.spec.ts (0.8.1 B2, same titles: scripts/e2e/title-parity.mjs).
 * The bench has no bottom panel: graphs, Lời giải and Thử thách are notebook tabs (a 312 px
 * drawer the full stage height), the parameters are in the tray, the library is "Kệ bài"
 * (docs/BENCH_DESIGN.md §8, §9.3, §9.4, §14 "layout.spec geometry").
 */
test.use({ viewport: { width: 1366, height: 768 } });

/** Plot area (uPlot's `.u-over`) a learner can still read: at least four y values. */
const MIN_PLOT_HEIGHT = 80;
/**
 * Physics lessons with a view of their own: the bottom panel shows the module's table, with no
 * graph tab and no Run (waiting for the tab ran into the 5 min timeout). fourier.spec.ts checks
 * the lesson's figure at 1366 × 768 instead.
 */
const OWN_VIEW = ['Hoạ âm và chuỗi Fourier'];

interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  height: number;
}

/** Everything that went wrong with the notebook's chart on screen now (empty = fine). */
async function chartProblems(page: Page, expectEmpty: boolean): Promise<string[]> {
  const g = await page.evaluate(() => {
    const rect = (el: Element | null | undefined) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    };
    const panel = document.querySelector('.notebook__drawer');
    const tab = panel?.querySelector('[role="tabpanel"] .panel__scroll');
    const chart = panel?.querySelector('.chart');
    const empty = chart?.querySelector('.chart__empty');
    // The words themselves, not their (full-width) paragraph.
    let text = null;
    if (empty) {
      const range = document.createRange();
      range.selectNodeContents(empty);
      text = rect(range as unknown as Element);
    }
    return {
      panel: rect(panel),
      // A phase portrait (a graph with an x quantity) draws on its own canvas, legend as a list.
      over: rect(chart?.querySelector('.u-over, .chart__canvas')),
      legend: rect(panel?.querySelector('.u-legend, .phase-legend')),
      text,
      hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      // The graph tab must fit the drawer: anything that scrolls is hidden at first sight.
      tabOverflow: tab ? tab.scrollHeight - tab.clientHeight : 0,
    };
  });
  const out: string[] = [];
  const inside = (a: Rect, b: Rect) =>
    a.top >= b.top - 0.5 &&
    a.bottom <= b.bottom + 0.5 &&
    a.left >= b.left - 0.5 &&
    a.right <= b.right + 0.5;
  if (!g.panel || !g.over || !g.legend) return ['chart not drawn yet'];
  if (g.over.height < MIN_PLOT_HEIGHT)
    out.push(`plot area ${g.over.height.toFixed(0)} px < ${MIN_PLOT_HEIGHT} px`);
  if (!inside(g.legend, g.panel))
    out.push(
      `legend ${g.legend.bottom.toFixed(0)} outside the drawer (${g.panel.bottom.toFixed(0)})`,
    );
  if (expectEmpty && !g.text) out.push('no "no data" text');
  if (!expectEmpty && g.text) out.push('"no data" text still shown');
  if (g.text && !inside(g.text, g.over)) out.push('"no data" text outside the plot area');
  if (g.hScroll) out.push('horizontal scroll');
  if (g.tabOverflow > 1) out.push(`graph tab scrolls by ${g.tabOverflow} px`);
  return out;
}

async function checkEveryGraph(page: Page, topic: string, expectEmpty: boolean): Promise<void> {
  const radios = page.getByRole('radiogroup', { name: 'Chọn đồ thị' }).getByRole('radio');
  const count = await radios.count();
  expect(count, topic).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const radio = radios.nth(i);
    if (i === 0) await radio.click();
    else {
      // Keyboard too: Enter picks the graph and the focus stays on the picker.
      await radio.focus();
      await radio.press('Enter');
      await expect(radio).toHaveAttribute('aria-checked', 'true');
      await expect(radio).toBeFocused();
    }
    const name = `${topic} · ${await radio.innerText()} · ${expectEmpty ? 'before' : 'after'} Run`;
    await expect.poll(() => chartProblems(page, expectEmpty), { message: name }).toEqual([]);
    // The live legend (time under the cursor) is uPlot's; a phase portrait has none.
    const phase = (await page.locator('.notebook .chart__canvas').count()) > 0;
    if (!expectEmpty && !phase) {
      // Hovering fills the live legend; the plot must keep its width under the mouse.
      const over = page.locator('.notebook .u-over');
      const before = await over.boundingBox();
      if (!before) throw new Error(`${name}: no plot area`);
      // Without the cursor the legend shows dashes, never a made-up "0 s".
      const time = page.locator('.notebook .u-legend .u-value').first();
      await expect(time).toHaveText('—');
      await over.hover({ position: { x: before.width * 0.6, y: before.height / 2 } });
      await expect(time).toHaveText(/\d s$/);
      // Let the legend's new width reach the layout, the ResizeObserver and uPlot's resize.
      await page.evaluate(
        () =>
          new Promise<void>((done) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                done();
              });
            });
          }),
      );
      expect((await over.boundingBox())?.width, `${name}: plot width on hover`).toBeCloseTo(
        before.width,
        0,
      );
      await page.mouse.move(0, 0);
    }
  }
}

/** The physics shelf, from the launch page or from a topic (the header's subject crumb). */
async function physicsShelf(page: Page): Promise<Locator> {
  const crumb = page.locator('.bench-crumbs').getByRole('button', { name: 'Vật lý' });
  if (await crumb.count()) await crumb.click();
  else {
    await openLab(page);
    await page.getByRole('radio', { name: 'Vật lý' }).click();
  }
  return page.getByRole('main').locator('.shelf-card__open:not([aria-disabled])');
}

test('every physics graph is readable at 1366 × 768, before and after running', async ({
  page,
}) => {
  test.setTimeout(300_000);
  let topics = await physicsShelf(page);
  const total = await topics.count();
  expect(total).toBeGreaterThanOrEqual(13);
  const hud = page.locator('.stage__hud-title');
  let previous: string | null = null;
  for (let i = 0; i < total; i++) {
    if (i > 0) topics = await physicsShelf(page);
    const button = topics.nth(i);
    const topic = (await button.innerText()).trim();
    if (OWN_VIEW.includes(topic)) continue;
    await button.click();
    // The dev server compiles each scene on first use (up to ~20 s on a busy machine); the
    // stage names the scene, which may differ from the shelf's title.
    if (previous === null) await expect(hud).toBeVisible({ timeout: 20_000 });
    else await expect(hud).not.toHaveText(previous, { timeout: 20_000 });
    previous = await hud.innerText();
    await page.getByRole('tab', { name: 'Đồ thị' }).click();
    await checkEveryGraph(page, topic, true);
    await page.getByRole('button', { name: 'Chạy (Space)' }).click();
    await expect(page.locator('.notebook .chart__empty')).toHaveCount(0, { timeout: 10_000 });
    await checkEveryGraph(page, topic, false);
    await page.getByRole('button', { name: 'Đặt lại (R)' }).click();
  }
});

// ───────────── Shared shell layout (#70 group S, 1366 × 768) ─────────────

async function box(l: Locator) {
  const b = await l.boundingBox();
  if (!b) throw new Error('not on screen');
  return { ...b, bottom: b.y + b.height, right: b.x + b.width };
}

/**
 * True when nothing lies over the middle of `l` (the topmost element there is `l` or inside it).
 * A middle its scroll box has scrolled out of view counts as uncovered (nothing floats there).
 */
async function uncovered(l: Locator): Promise<boolean> {
  return l.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const [x, y] = [r.left + r.width / 2, r.top + r.height / 2];
    const clip = el.closest('.panel__scroll')?.getBoundingClientRect();
    if (clip && (y < clip.top || y > clip.bottom)) return true;
    const top = document.elementFromPoint(x, y);
    return top !== null && el.contains(top);
  });
}

async function openPhysics(page: Page, topic: string) {
  await openLab(page);
  await page.getByRole('radio', { name: 'Vật lý' }).click();
  await page.getByRole('main').getByRole('button', { name: topic, exact: true }).click();
  await expect(page.locator('.stage__hud-title')).toBeVisible({ timeout: 20_000 });
}

test('the AI Teacher button covers no Inspector line and no Studio button (UI-01)', async ({
  page,
}) => {
  // The bench has no floating chat bubble (§13: the "Hỏi AI" tab replaces it), so UI-01 becomes
  // "no floating element over the tray or a lesson footer".
  await openPhysics(page, 'Rơi tự do');
  await expect(page.locator('.chat-bubble')).toHaveCount(0);
  const rows = page.locator('.tray .panel__scroll .param');
  await expect(rows.first()).toBeVisible();
  for (const row of await rows.all())
    if (await row.isVisible()) expect(await uncovered(row)).toBe(true);
  await page.locator('.bench-crumbs').getByRole('button', { name: 'Virtual Lab' }).click();
  await openStudioFromLab(page);
  const next = page.getByRole('button', { name: /^Tiếp/ }).last();
  await expect(next).toBeVisible({ timeout: 20_000 });
  await next.scrollIntoViewIfNeeded();
  await expect(page.locator('.chat-bubble')).toHaveCount(0);
  expect(await uncovered(next)).toBe(true);
});

test('the tool palette keeps clear of the captions scenes write at x = 60 px (UI-02)', async ({
  page,
}) => {
  // The bench's palette is one row ("Chọn | Kéo" + "Vừa khung", §9.4 TL), wider than the classic
  // column: what must hold is the same, no caption a scene writes starts under it.
  await page.addInitScript(() => {
    const w = window as unknown as { __texts: { text: string; x: number; y: number }[] };
    w.__texts = [];
    const proto = CanvasRenderingContext2D.prototype;
    const fill = Reflect.get<CanvasRenderingContext2D, 'fillText'>(proto, 'fillText');
    proto.fillText = function (text: string, x: number, y: number) {
      // Canvas units are scaled by devicePixelRatio; the stage canvas sets that transform.
      const m = this.getTransform();
      if (this.canvas.closest('.stage'))
        w.__texts.push({ text, x: m.a * x + m.e, y: m.d * y + m.f });
      Reflect.apply(fill, this, [text, x, y]);
    };
  });
  await openPhysics(page, 'Sóng dừng trên dây');
  const stage = await box(page.getByRole('region', { name: 'Khung mô phỏng' }));
  const tools = await box(page.locator('.stage__toolbar'));
  await page.waitForTimeout(300);
  const dpr = await page.evaluate(() => devicePixelRatio);
  const texts = await page.evaluate(
    () => (window as unknown as { __texts: { text: string; x: number; y: number }[] }).__texts,
  );
  const captions = texts.filter((f) => /\p{L}{3}/u.test(f.text));
  expect(captions.length).toBeGreaterThan(0);
  const [l, r, t, b] = [
    tools.x - stage.x,
    tools.right - stage.x,
    tools.y - stage.y,
    tools.bottom - stage.y,
  ];
  for (const c of captions) {
    const [x, y] = [c.x / dpr, c.y / dpr];
    expect(
      x >= l && x <= r && y >= t && y <= b,
      `${c.text} at ${x.toFixed(0)}, ${y.toFixed(0)}`,
    ).toBe(false);
  }
});

test('Lời giải: answers on one line, formulas inside the panel, a cue while it scrolls (UI-07, UI-09)', async ({
  page,
}) => {
  await openPhysics(page, 'Chuyển động thẳng biến đổi đều');
  await page.getByRole('tab', { name: 'Lời giải' }).click();
  const scroll = page.locator('.notebook .panel__scroll');
  await expect(page.locator('.solution__answers tr').first()).toBeVisible();
  for (const chip of await page.locator('.solution__check span').all())
    expect((await box(chip)).height).toBeLessThan(24);
  for (const th of await page.locator('.solution__answers th').all())
    expect((await box(th)).height).toBeLessThan(30);
  // Nothing runs past the right edge; the panel says there is more below, until the end (the
  // notebook is the stage's height: the cue shows only when the answers do not fit).
  expect(await scroll.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  if (await scroll.evaluate((el) => el.scrollHeight - el.clientHeight > 1))
    await expect(scroll).toHaveAttribute('data-more-below', '');
  await scroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(scroll).not.toHaveAttribute('data-more-below');
});

test('Thử thách: a button below the panel edge comes with a scroll cue (UI-10)', async ({
  page,
}) => {
  await openPhysics(page, 'Lò xo (định luật Hooke)');
  await page.getByRole('tab', { name: 'Thử thách' }).click();
  const scroll = page.locator('.notebook .panel__scroll');
  const check = scroll.getByRole('button').last();
  await expect(check).toBeAttached();
  const below = (await box(check)).bottom > (await box(scroll)).bottom;
  if (below) await expect(scroll).toHaveAttribute('data-more-below', '');
});

test('smallest bottom panel: the whole chart fits, x axis included (UI-24)', async ({ page }) => {
  // No bottom panel to shrink: the shortest bench is a 1366 × 688 window (§14), where the
  // notebook drawer still holds the whole chart.
  await page.setViewportSize({ width: 1366, height: 688 });
  await openPhysics(page, 'Con lắc lò xo');
  await page.getByRole('tab', { name: 'Đồ thị' }).click();
  const panel = await box(page.locator('.notebook .panel__scroll'));
  const chart = await box(page.locator('.notebook .chart').first());
  expect(chart.bottom).toBeLessThanOrEqual(panel.bottom + 1);
  expect((await box(page.locator('.notebook .u-over').first())).height).toBeGreaterThanOrEqual(40);
});

test('a checkbox parameter is one row with its source chip (UI-53)', async ({ page }) => {
  await openPhysics(page, 'Chuyển động thẳng biến đổi đều');
  // The source chips show in Advanced mode.
  await page.getByRole('radio', { name: 'Nâng cao' }).click();
  const row = page.locator('.tray .param__head:has(.param__toggle)').first();
  const input = await box(row.locator('.param__toggle input[type="checkbox"]'));
  const text = await box(row.locator('.param__toggle span'));
  const chip = await box(row.locator('.param__source'));
  // The box itself is centred on the chip's line and does not touch its text.
  expect(Math.abs(input.y + input.height / 2 - (chip.y + chip.height / 2))).toBeLessThan(4);
  expect(text.x - input.right).toBeGreaterThanOrEqual(4);
});

test('suggestion cards in one row have the same height (UI-30)', async ({ page }) => {
  // The shelf's topic cards are the bench's suggestions (§9.3).
  await openLab(page);
  const cards = await Promise.all((await page.locator('.shelf-card').all()).map(box));
  expect(cards.length).toBeGreaterThan(2);
  for (const a of cards)
    for (const b of cards)
      if (Math.abs(a.y - b.y) < 2) expect(Math.abs(a.height - b.height)).toBeLessThan(1.5);
});

/** The chemistry shelf card named `name`, its title, and back to the shelf after opening it. */
function chemistryCard(page: Page, name: string) {
  const open = page.getByRole('main').getByRole('button', { name, exact: true });
  const card = page
    .getByRole('main')
    .locator('.shelf-card')
    .filter({ has: page.getByRole('button', { name, exact: true }) });
  return { open, card };
}
async function backToChemistry(page: Page) {
  await page.locator('.bench-crumbs').getByRole('button', { name: 'Hóa học' }).click();
}

test('library: a selected title keeps its line; a checkbox sits by its label (UI-42, UI-43)', async ({
  page,
}) => {
  await openLab(page);
  await page.getByRole('radio', { name: 'Hóa học' }).click();
  const { open, card } = chemistryCard(page, 'Thư viện phản ứng đã kiểm chứng');
  const before = (await box(card)).height;
  await open.click();
  await expect(page.locator('.bench-crumb--current')).toBeVisible({ timeout: 20_000 });
  await backToChemistry(page);
  await expect(card.locator('.shelf-card__mark')).toBeVisible();
  expect((await box(card)).height).toBeLessThanOrEqual(before + 1);
  await page.getByRole('main').getByRole('button', { name: 'Thuyết va chạm', exact: true }).click();
  const label = page.locator('label', { hasText: 'Phản ứng thuận nghịch' });
  await expect(label).toBeVisible({ timeout: 20_000 });
  const input = await box(label.locator('input[type="checkbox"]'));
  const text = await box(label.locator('span').first());
  expect(text.x - input.right).toBeLessThan(16);
  expect((await box(label)).height).toBeGreaterThanOrEqual(40);
});

for (const fontScale of [1.25, 1.4])
  test(`library at ${fontScale}× font: a title keeps its line when it gets its mark (UI-42)`, async ({
    page,
  }) => {
    // Wider text (a larger font, or Linux fonts on CI) must not make the mark push a title down.
    await page.addInitScript((scale) => {
      localStorage.setItem(
        'stemsim.settings',
        JSON.stringify({ state: { fontScale: scale }, version: 2 }),
      );
    }, fontScale);
    await openLab(page);
    await page.getByRole('radio', { name: 'Hóa học' }).click();
    for (const name of ['Thư viện phản ứng đã kiểm chứng', 'Cân bằng hóa học & Le Chatelier']) {
      const { open, card } = chemistryCard(page, name);
      const title = open.locator('.shelf-card__title');
      const before = await box(card);
      const titleBefore = await box(title);
      await open.click();
      // The crumb names the module ("Thư viện phản ứng"); it is absent on the shelf.
      await expect(page.locator('.bench-crumb--current')).toBeVisible({ timeout: 20_000 });
      await backToChemistry(page);
      await expect(card.locator('.shelf-card__mark')).toBeVisible();
      // The title keeps the same width (whatever the font, the mark never takes its room) …
      expect((await box(title)).width, name).toBeGreaterThanOrEqual(titleBefore.width - 0.5);
      // … so it keeps its lines.
      expect((await box(card)).height, name).toBeLessThanOrEqual(before.height + 1);
    }
  });

test('a short window with a large font keeps the stage at its minimum (UI-24)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 600 });
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.settings',
      JSON.stringify({ state: { fontScale: 1.4 }, version: 2 }),
    );
  });
  await openPhysics(page, 'Con lắc lò xo');
  const stage = await box(page.getByRole('region', { name: 'Khung mô phỏng' }));
  const rootPx = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).fontSize),
  );
  expect(stage.height).toBeGreaterThanOrEqual(12 * rootPx - 1);
  // The frame never scrolls as a whole: header, bench and edge stay on screen.
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
    ),
  ).toBeLessThanOrEqual(1);
  await expect(page.getByRole('button', { name: 'Chạy (Space)' })).toBeInViewport();
});

test('a hidden switch input in Settings stays hidden (the checkbox rule is scoped, UI-43)', async ({
  page,
}) => {
  await openLab(page);
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).first().click();
  await page
    .getByRole('tab', { name: /Trí nhớ hội thoại/ })
    .first()
    .click();
  const input = page.locator('.chat-toggle input').first();
  await expect(input).toBeAttached();
  const b = await input.boundingBox();
  expect(b === null || (b.width <= 2 && b.height <= 2)).toBe(true);
});

test('the y-axis numbers start right of the tool palette (UI-02, drawGrid labelLeft)', async ({
  page,
}) => {
  // Record every left-aligned canvas text and where it starts (CSS px, the canvas is scaled).
  await page.addInitScript(() => {
    const w = window as unknown as { __fills: { text: string; x: number }[] };
    w.__fills = [];
    const proto = CanvasRenderingContext2D.prototype;
    const fill = Reflect.get<CanvasRenderingContext2D, 'fillText'>(proto, 'fillText');
    proto.fillText = function (text: string, x: number, y: number) {
      // The stage's canvas only (the launch page's still draws a grid of its own).
      if (this.textAlign === 'left' && this.canvas.closest('.stage')) w.__fills.push({ text, x });
      Reflect.apply(fill, this, [text, x, y]);
    };
  });
  await openPhysics(page, 'Rơi tự do');
  const stage = await box(page.getByRole('region', { name: 'Khung mô phỏng' }));
  const tools = await box(page.locator('.stage__toolbar'));
  await page.waitForTimeout(300);
  const numbers = await page.evaluate(() =>
    (window as unknown as { __fills: { text: string; x: number }[] }).__fills.filter((f) =>
      /^[-−]?[\d.,]+$/.test(f.text),
    ),
  );
  expect(numbers.length).toBeGreaterThan(2);
  for (const n of numbers) expect(n.x, n.text).toBeGreaterThanOrEqual(tools.right - stage.x);
});
