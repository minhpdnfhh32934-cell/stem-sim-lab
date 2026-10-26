import { expect, test, type Page } from '@playwright/test';
import { openLab } from './nav';

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
  return out;
}

async function checkEveryGraph(page: Page, topic: string, expectEmpty: boolean): Promise<void> {
  const radios = page.getByRole('radiogroup', { name: 'Chọn đồ thị' }).getByRole('radio');
  const count = await radios.count();
  expect(count, topic).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const radio = radios.nth(i);
    await radio.click();
    const name = `${topic} · ${await radio.innerText()} · ${expectEmpty ? 'before' : 'after'} Run`;
    await expect.poll(() => chartProblems(page, expectEmpty), { message: name }).toEqual([]);
    if (!expectEmpty) {
      // Hovering fills the live legend; the plot must keep its width under the mouse.
      const over = page.locator('.bottom-panel .u-over');
      const before = await over.boundingBox();
      if (!before) throw new Error(`${name}: no plot area`);
      await over.hover({ position: { x: before.width * 0.6, y: before.height / 2 } });
      await expect(page.locator('.bottom-panel .u-legend .u-value').first()).not.toHaveText('0 s');
      await page.waitForTimeout(300);
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
  const library = page.getByRole('complementary', { name: 'Thư viện chủ đề' });
  const topics = library.locator('.tree__topic--button');
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
