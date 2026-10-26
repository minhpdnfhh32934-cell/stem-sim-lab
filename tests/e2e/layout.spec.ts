import { expect, test, type Page } from '@playwright/test';
import { openLab } from './nav';

/**
 * The physics graphs fit the bottom panel at 1366×768 with its default height (issue #58): the
 * legend stays inside the panel, the "Nhấn Chạy…" note stays inside the plot area (never on the
 * axis numbers) and the plot area is tall enough to read.
 */
const MIN_PLOT_HEIGHT = 80;

interface Measure {
  /** The graphs tab's visible box and whether its content overflows it. */
  panelBottom: number;
  panelOverflow: number;
  plot: { top: number; bottom: number; height: number } | null;
  legendBottom: number | null;
  empty: { top: number; bottom: number } | null;
  pageOverflow: number;
}

function measure(page: Page): Promise<Measure> {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('.bottom-panel [role="tabpanel"]');
    const chart = document.querySelector('.graph-panel .chart');
    const box = (el: Element | null | undefined) => el?.getBoundingClientRect() ?? null;
    const over = box(chart?.querySelector('.u-over'));
    const legend = box(document.querySelector('.graph-panel .u-legend'));
    const empty = box(chart?.querySelector('.chart__empty'));
    return {
      panelBottom: panel?.getBoundingClientRect().bottom ?? 0,
      panelOverflow: panel ? panel.scrollHeight - panel.clientHeight : 0,
      plot: over && { top: over.top, bottom: over.bottom, height: over.height },
      legendBottom: legend?.bottom ?? null,
      empty: empty && { top: empty.top, bottom: empty.bottom },
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

/** Every graph of the open topic, before (`noData`) or after a run. */
async function checkGraphs(page: Page, topic: string, noData: boolean): Promise<void> {
  const picker = page.getByRole('radiogroup', { name: 'Chọn đồ thị' });
  await expect(picker.getByRole('radio').first()).toBeVisible();
  const names = await picker.getByRole('radio').allTextContents();
  expect(names.length, topic).toBeGreaterThan(0);
  for (const name of names) {
    await picker.getByRole('radio', { name, exact: true }).click();
    const where = `${topic} › ${name}${noData ? ' (before Run)' : ''}`;
    // The plot settles after its ResizeObserver; wait for the final size.
    await expect
      .poll(async () => (await measure(page)).plot?.height ?? 0, { message: where })
      .toBeGreaterThanOrEqual(MIN_PLOT_HEIGHT);
    const m = await measure(page);
    expect(m.legendBottom, where).not.toBeNull();
    expect(m.legendBottom ?? Infinity, `${where}: legend inside the panel`).toBeLessThanOrEqual(
      m.panelBottom + 0.5,
    );
    expect(m.panelOverflow, `${where}: nothing hidden below the panel`).toBeLessThanOrEqual(0);
    expect(m.pageOverflow, `${where}: no horizontal scroll`).toBeLessThanOrEqual(0);
    if (noData) {
      const plot = m.plot;
      const empty = m.empty;
      expect(empty, `${where}: the "Nhấn Chạy" note`).not.toBeNull();
      if (plot && empty) {
        expect(empty.top, `${where}: note inside the plot`).toBeGreaterThanOrEqual(plot.top - 0.5);
        expect(empty.bottom, `${where}: note above the axis`).toBeLessThanOrEqual(
          plot.bottom + 0.5,
        );
      }
    } else {
      expect(m.empty, `${where}: no note once there is data`).toBeNull();
    }
  }
}

test('physics graphs fit the bottom panel at 1366×768, before and after Run', async ({ page }) => {
  test.setTimeout(240_000);
  await openLab(page);
  const physics = page
    .getByRole('complementary', { name: 'Thư viện chủ đề' })
    .getByRole('list', { name: 'Vật lý' });
  const topics = await physics
    .locator('li[data-status="available"] .tree__topic-title')
    .allTextContents();
  expect(topics.length).toBeGreaterThanOrEqual(13);
  let previous = '';
  for (const topic of topics) {
    await physics.getByRole('button', { name: topic, exact: true }).click();
    await page.getByRole('tab', { name: 'Đồ thị' }).click();
    // Wait for this topic's scene (the first open of a lazy module can take up to 20 s), so the
    // graph list read below is never the previous topic's.
    const panel = page.locator('.graph-panel');
    await expect(panel).toHaveAttribute('data-scene', /.+/, { timeout: 20_000 });
    await expect(panel).not.toHaveAttribute('data-scene', previous, { timeout: 20_000 });
    previous = (await panel.getAttribute('data-scene')) ?? '';
    await checkGraphs(page, topic, true);
    const timeline = page.getByRole('group', { name: 'Điều khiển thời gian' });
    await timeline.getByRole('button', { name: 'Chạy (Space)' }).click();
    await expect(page.locator('.graph-panel .chart__empty')).toHaveCount(0);
    await timeline.getByRole('button', { name: 'Tạm dừng (Space)' }).click();
    await checkGraphs(page, topic, false);
  }
});

test('graph picker keeps keyboard focus; hovering the plot does not resize it', async ({
  page,
}) => {
  await openLab(page);
  await page.getByRole('button', { name: 'Con lắc đơn', exact: true }).click();
  await page.getByRole('tab', { name: 'Đồ thị' }).click();
  const picker = page.getByRole('radiogroup', { name: 'Chọn đồ thị' });
  const second = picker.getByRole('radio').nth(1);
  await second.focus();
  await page.keyboard.press('Enter');
  await expect(second).toHaveAttribute('aria-checked', 'true');
  await expect(second).toBeFocused();

  const timeline = page.getByRole('group', { name: 'Điều khiển thời gian' });
  await timeline.getByRole('button', { name: 'Chạy (Space)' }).click();
  await expect(page.locator('.graph-panel .chart__empty')).toHaveCount(0);
  await timeline.getByRole('button', { name: 'Tạm dừng (Space)' }).click();
  const over = page.locator('.graph-panel .u-over');
  const before = await over.boundingBox();
  expect(before).not.toBeNull();
  if (!before) return;
  // The live legend now shows numbers instead of "—": the plot keeps its width.
  await page.mouse.move(before.x + before.width * 0.6, before.y + before.height / 2);
  await expect(page.locator('.graph-panel__legend .u-value').nth(1)).not.toHaveText('—');
  const after = await over.boundingBox();
  expect(after?.width).toBe(before.width);
});
