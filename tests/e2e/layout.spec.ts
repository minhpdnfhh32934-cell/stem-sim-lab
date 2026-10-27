import { expect, test, type Locator, type Page } from '@playwright/test';
import { openLab, openStudioFromLab } from './nav';

/**
 * Bottom-panel charts at the smallest supported screen (1366 × 768, default panel sizes): every
 * graph of every physics topic, before and after running. Issue #69 (plan #37 §9b).
 */
test.use({ viewport: { width: 1366, height: 768 } });

/** Plot area (uPlot's `.u-over`) a learner can still read: at least four y values. */
const MIN_PLOT_HEIGHT = 80;

interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  height: number;
}

/** Everything that went wrong with the chart on screen now (empty = fine). */
async function chartProblems(page: Page, expectEmpty: boolean): Promise<string[]> {
  const g = await page.evaluate(() => {
    const rect = (el: Element | null | undefined) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    };
    const panel = document.querySelector('.bottom-panel');
    const tab = panel?.querySelector('[role="tabpanel"]');
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
      over: rect(chart?.querySelector('.u-over')),
      legend: rect(panel?.querySelector('.u-legend')),
      text,
      hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      // The graph tab must fit the panel: anything that scrolls is hidden at first sight.
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
      `legend ${g.legend.bottom.toFixed(0)} outside the panel (${g.panel.bottom.toFixed(0)})`,
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
    if (!expectEmpty) {
      // Hovering fills the live legend; the plot must keep its width under the mouse.
      const over = page.locator('.bottom-panel .u-over');
      const before = await over.boundingBox();
      if (!before) throw new Error(`${name}: no plot area`);
      // Without the cursor the legend shows dashes, never a made-up "0 s".
      const time = page.locator('.bottom-panel .u-legend .u-value').first();
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

test('every physics graph is readable at 1366 × 768, before and after running', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await openLab(page);
  await page.getByRole('radio', { name: 'Vật lý' }).click();
  const topics = page
    .getByRole('complementary', { name: 'Thư viện chủ đề' })
    .getByRole('list', { name: 'Vật lý' })
    .locator('li[data-status="available"] .tree__topic--button');
  const total = await topics.count();
  expect(total).toBeGreaterThanOrEqual(13);
  const hud = page.locator('.stage__hud-title');
  let previous: string | null = null;
  for (let i = 0; i < total; i++) {
    const button = topics.nth(i);
    const topic = (await button.locator('.tree__topic-title').innerText()).trim();
    await button.click();
    // The dev server compiles each scene on first use (up to ~20 s on a busy machine); the
    // stage names the scene, which may differ from the library's title.
    await expect(button).toHaveAttribute('aria-current', 'true', { timeout: 20_000 });
    if (previous === null) await expect(hud).toBeVisible({ timeout: 20_000 });
    else await expect(hud).not.toHaveText(previous, { timeout: 20_000 });
    previous = await hud.innerText();
    await page.getByRole('tab', { name: 'Đồ thị' }).click();
    await checkEveryGraph(page, topic, true);
    await page.getByRole('button', { name: 'Chạy (Space)' }).click();
    await expect(page.locator('.bottom-panel .chart__empty')).toHaveCount(0, { timeout: 10_000 });
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
const overlap = (a: { x: number; y: number; right: number; bottom: number }, b: typeof a) =>
  a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;

async function openPhysics(page: Page, topic: string) {
  await openLab(page);
  await page.getByRole('radio', { name: 'Vật lý' }).click();
  await page.getByRole('button', { name: topic, exact: true }).click();
  await expect(page.locator('.stage__hud-title')).toBeVisible({ timeout: 20_000 });
}

test('the AI Teacher button covers no Inspector line and no Studio button (UI-01)', async ({
  page,
}) => {
  await openPhysics(page, 'Rơi tự do');
  const bubble = await box(page.locator('.chat-bubble'));
  const inspector = await box(page.locator('.inspector .panel__scroll'));
  expect(inspector.bottom).toBeLessThanOrEqual(bubble.y + 1);
  await openStudioFromLab(page);
  const next = page.getByRole('button', { name: /^Tiếp/ }).last();
  await expect(next).toBeVisible();
  // The centre keeps a strip free above the button: scrolled into view, nothing is under it.
  await next.scrollIntoViewIfNeeded();
  expect(overlap(await box(next), await box(page.locator('.chat-bubble')))).toBe(false);
});

test('the tool palette keeps clear of the captions scenes write at x = 60 px (UI-02)', async ({
  page,
}) => {
  // The y numbers move right of the palette instead (drawGrid labelLeft, unit-tested).
  await openPhysics(page, 'Sóng dừng trên dây');
  const stage = await box(page.getByRole('region', { name: 'Khung mô phỏng' }));
  const tools = await box(page.locator('.stage__toolbar'));
  expect(tools.right - stage.x).toBeLessThanOrEqual(58);
});

test('Lời giải: answers on one line, formulas inside the panel, a cue while it scrolls (UI-07, UI-09)', async ({
  page,
}) => {
  await openPhysics(page, 'Chuyển động thẳng biến đổi đều');
  await page.getByRole('tab', { name: 'Lời giải' }).click();
  const scroll = page.locator('.bottom-panel .panel__scroll');
  await expect(page.locator('.solution__answers tr').first()).toBeVisible();
  for (const chip of await page.locator('.solution__check span').all())
    expect((await box(chip)).height).toBeLessThan(24);
  for (const th of await page.locator('.solution__answers th').all())
    expect((await box(th)).height).toBeLessThan(30);
  // Nothing runs past the right edge; the panel says there is more below, until the end.
  expect(await scroll.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
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
  const scroll = page.locator('.bottom-panel .panel__scroll');
  const run = page.getByRole('button', { name: 'Chạy để kiểm tra' });
  await expect(run).toBeAttached();
  const below = (await box(run)).bottom > (await box(scroll)).bottom;
  if (below) await expect(scroll).toHaveAttribute('data-more-below', '');
});

test('smallest bottom panel: the whole chart fits, x axis included (UI-24)', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.layout',
      JSON.stringify({ state: { bottomHeight: 0 }, version: 1 }),
    );
  });
  await openPhysics(page, 'Con lắc lò xo');
  await page.getByRole('tab', { name: 'Đồ thị' }).click();
  const panel = await box(page.locator('.bottom-panel .panel__scroll'));
  const chart = await box(page.locator('.bottom-panel .chart').first());
  expect(chart.bottom).toBeLessThanOrEqual(panel.bottom + 1);
  expect((await box(page.locator('.bottom-panel .u-over').first())).height).toBeGreaterThanOrEqual(
    40,
  );
});

test('a checkbox parameter is one row with its source chip (UI-53)', async ({ page }) => {
  await openPhysics(page, 'Chuyển động thẳng biến đổi đều');
  // The source chips show in Advanced mode.
  await page.getByRole('radio', { name: 'Nâng cao' }).click();
  const row = page.locator('.param__head:has(.param__toggle)').first();
  const input = await box(row.locator('.param__toggle input[type="checkbox"]'));
  const text = await box(row.locator('.param__toggle span'));
  const chip = await box(row.locator('.param__source'));
  // The box itself is centred on the chip's line and does not touch its text.
  expect(Math.abs(input.y + input.height / 2 - (chip.y + chip.height / 2))).toBeLessThan(4);
  expect(text.x - input.right).toBeGreaterThanOrEqual(4);
});

test('suggestion cards in one row have the same height (UI-30)', async ({ page }) => {
  await openLab(page);
  const cards = await Promise.all((await page.locator('.home__topic').all()).map(box));
  expect(cards.length).toBeGreaterThan(2);
  for (const a of cards)
    for (const b of cards)
      if (Math.abs(a.y - b.y) < 2) expect(Math.abs(a.height - b.height)).toBeLessThan(1.5);
});

test('library: a selected title keeps its line; a checkbox sits by its label (UI-42, UI-43)', async ({
  page,
}) => {
  await openLab(page);
  await page.getByRole('radio', { name: 'Hóa học' }).click();
  const item = page.getByRole('button', { name: 'Thư viện phản ứng đã kiểm chứng', exact: true });
  const before = (await box(item)).height;
  await page.getByRole('button', { name: 'Thuyết va chạm', exact: true }).click();
  await item.click();
  await expect(item).toHaveAttribute('aria-current', 'true', { timeout: 20_000 });
  expect((await box(item)).height).toBeLessThanOrEqual(before + 1);
  await page.getByRole('button', { name: 'Thuyết va chạm', exact: true }).click();
  const label = page.locator('label', { hasText: 'Phản ứng thuận nghịch' });
  await expect(label).toBeVisible({ timeout: 20_000 });
  const input = await box(label.locator('input[type="checkbox"]'));
  const text = await box(label.locator('span').first());
  expect(text.x - input.right).toBeLessThan(16);
  expect((await box(label)).height).toBeGreaterThanOrEqual(40);
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
  expect(
    await page.locator('.shell__center').evaluate((el) => el.scrollHeight - el.clientHeight),
  ).toBeLessThanOrEqual(1);
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
